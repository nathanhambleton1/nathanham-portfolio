import { useEffect, useMemo, useRef, useState } from "react";

type SessionItem = {
  key: string;
  title?: string;
  updatedAtMs?: number;
  lastMessageText?: string;
};

type ChatMsg = {
  id: string;
  role?: string;
  text: string;
  ts?: number;
};

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  schedule?: unknown;
  state?: {
    nextRunAtMs?: number;
    lastStatus?: string;
  };
};

type WsReqFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type WsResFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: any;
  error?: { message?: string };
};

type WsEventFrame = {
  type: "event";
  event: string;
  payload?: any;
};

const LS_KEY = "athena_gateway_settings_v1";

function toText(message: any): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((c: any) => (typeof c?.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

const Athena = () => {
  const [gatewayUrl, setGatewayUrl] = useState("wss://YOUR-GATEWAY-HOST/ws");
  const [gatewayToken, setGatewayToken] = useState("");
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");

  const [jobs, setJobs] = useState<CronJob[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ sessionKey: string; excerpt: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>());

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.gatewayUrl) setGatewayUrl(parsed.gatewayUrl);
      if (parsed.gatewayToken) setGatewayToken(parsed.gatewayToken);
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ gatewayUrl, gatewayToken }));
  };

  const request = (method: string, params?: unknown) => {
    return new Promise<any>((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }
      const id = crypto.randomUUID();
      pendingRef.current.set(id, { resolve, reject });
      const frame: WsReqFrame = { type: "req", id, method, params };
      ws.send(JSON.stringify(frame));
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 15000);
    });
  };

  const loadSessions = async () => {
    const res = await request("sessions.list", { limit: 100, includeLastMessage: true });
    const items = (res?.sessions ?? res?.items ?? []) as any[];
    const mapped: SessionItem[] = items.map((s) => ({
      key: s.key,
      title: s.title ?? s.label ?? s.key,
      updatedAtMs: s.updatedAtMs,
      lastMessageText: s.lastMessageText ?? s.lastMessage?.text,
    }));
    setSessions(mapped);
    if (!selectedSession && mapped[0]?.key) setSelectedSession(mapped[0].key);
  };

  const loadJobs = async () => {
    const res = await request("cron.list", { includeDisabled: true });
    setJobs((res?.jobs ?? []) as CronJob[]);
  };

  const loadHistory = async (sessionKey: string) => {
    if (!sessionKey) return;
    const res = await request("chat.history", { sessionKey, limit: 200 });
    const rows = (res?.messages ?? res?.items ?? []) as any[];
    const mapped: ChatMsg[] = rows.map((m, i) => ({
      id: m.id ?? `${i}`,
      role: m.role ?? m.kind,
      text: toText(m.message ?? m),
      ts: m.ts ?? m.createdAtMs,
    }));
    setMessages(mapped);
  };

  const connect = async () => {
    setError("");
    setStatus("connecting");
    try {
      const ws = new WebSocket(gatewayUrl);
      wsRef.current = ws;

      ws.onmessage = async (ev) => {
        let frame: WsResFrame | WsEventFrame;
        try {
          frame = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (frame.type === "res") {
          const pending = pendingRef.current.get(frame.id);
          if (!pending) return;
          pendingRef.current.delete(frame.id);
          if (frame.ok) pending.resolve(frame.payload);
          else pending.reject(new Error(frame.error?.message ?? "Gateway error"));
          return;
        }

        if (frame.type === "event") {
          if (frame.event === "chat.event") {
            const p = frame.payload;
            if (!p || p.sessionKey !== selectedSession) return;
            const text = toText(p.message);
            if (!text) return;
            setMessages((prev) => [...prev, { id: `${p.runId}-${p.seq}`, role: "assistant", text, ts: Date.now() }]);
          }
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection failed.");
      };

      ws.onclose = () => {
        setStatus("disconnected");
      };

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        setTimeout(() => reject(new Error("Connect timeout")), 8000);
      });

      await request("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          displayName: "Athena Remote",
          version: "1.0.0",
          platform: "web",
          mode: "ui",
        },
        caps: [],
        auth: {
          token: gatewayToken,
        },
      });

      setStatus("connected");
      saveSettings();
      await Promise.all([loadSessions(), loadJobs()]);
    } catch (e: any) {
      setStatus("disconnected");
      setError(e?.message ?? "Failed to connect");
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    pendingRef.current.clear();
    setStatus("disconnected");
  };

  useEffect(() => {
    if (status === "connected" && selectedSession) {
      loadHistory(selectedSession).catch((e) => setError(String(e?.message ?? e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, status]);

  const sendChat = async () => {
    if (!selectedSession || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text, ts: Date.now() }]);
    try {
      await request("chat.send", {
        sessionKey: selectedSession,
        message: text,
        idempotencyKey: crypto.randomUUID(),
      });
      await loadHistory(selectedSession);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const list = sessions.slice(0, 120);
      const out: Array<{ sessionKey: string; excerpt: string }> = [];
      for (const s of list) {
        const h = await request("chat.history", { sessionKey: s.key, limit: 200 });
        const rows = (h?.messages ?? h?.items ?? []) as any[];
        for (const r of rows) {
          const text = toText(r.message ?? r);
          if (text.toLowerCase().includes(q)) {
            out.push({ sessionKey: s.key, excerpt: text.slice(0, 180) });
            if (out.length >= 200) break;
          }
        }
        if (out.length >= 200) break;
      }
      setSearchResults(out);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const statusColor = useMemo(() => {
    if (status === "connected") return "#16a34a";
    if (status === "connecting") return "#f59e0b";
    return "#ef4444";
  }, [status]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16, color: "#e5e7eb" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Athena Remote</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Remote OpenClaw panel for chat, jobs, and full-history search. Use a reachable <b>wss://</b> gateway endpoint for access from anywhere.
      </p>

      <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label>
            Gateway WebSocket URL
            <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 4 }} />
          </label>
          <label>
            Gateway Token
            <input value={gatewayToken} onChange={(e) => setGatewayToken(e.target.value)} type="password" style={{ width: "100%", padding: 8, marginTop: 4 }} />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={connect} disabled={status === "connecting"}>Connect</button>
            <button onClick={disconnect}>Disconnect</button>
            <span style={{ color: statusColor, fontWeight: 600 }}>{status}</span>
          </div>
          {error && <div style={{ color: "#f87171" }}>{error}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 12 }}>
        <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10, maxHeight: 700, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Sessions</h3>
            <button onClick={() => loadSessions().catch((e) => setError(String(e?.message ?? e)))}>Refresh</button>
          </div>
          {sessions.map((s) => (
            <div
              key={s.key}
              onClick={() => setSelectedSession(s.key)}
              style={{
                padding: 8,
                borderRadius: 6,
                cursor: "pointer",
                background: selectedSession === s.key ? "#1f2937" : "transparent",
                border: "1px solid #374151",
                marginBottom: 6,
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.title || s.key}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{s.key}</div>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", maxHeight: 700 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>Chat</h3>
            <button onClick={() => selectedSession && loadHistory(selectedSession).catch((e) => setError(String(e?.message ?? e)))}>Refresh</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", border: "1px solid #374151", borderRadius: 8, padding: 8, marginBottom: 8 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{m.role || "msg"}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Message selected session..."
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10, maxHeight: 320, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Jobs</h3>
              <button onClick={() => loadJobs().catch((e) => setError(String(e?.message ?? e)))}>Refresh</button>
            </div>
            {jobs.map((j) => (
              <div key={j.id} style={{ border: "1px solid #374151", borderRadius: 6, padding: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>{j.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{j.id}</div>
                <div style={{ fontSize: 12 }}>
                  {j.enabled ? "Enabled" : "Disabled"} • Next: {j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toLocaleString() : "n/a"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10, maxHeight: 360, overflow: "auto" }}>
            <h3>Search all chats</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="keyword" style={{ flex: 1, padding: 8 }} />
              <button onClick={runSearch} disabled={searching}>{searching ? "Searching..." : "Search"}</button>
            </div>
            {searchResults.map((r, i) => (
              <div key={`${r.sessionKey}-${i}`} style={{ borderTop: "1px solid #374151", paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.sessionKey}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{r.excerpt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Athena;
