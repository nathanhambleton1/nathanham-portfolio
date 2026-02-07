import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "../components/ui/use-toast";
import { ChevronLeft, MessageSquarePlus, Send } from "lucide-react";

// Keep consistent with Drunkopoly.tsx (this app currently duplicates clients per page).
const supabaseUrl = "https://kcyrvubzhsphpxfsewii.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ChatRow = {
  id: string;
  game_id: string;
  title: string | null;
  created_at: string;
  created_by_player_id: string | null;
};

type ChatMemberRow = {
  chat_id: string;
  player_id: string;
  last_read_at: string | null;
};

type ChatMemberLiteRow = {
  chat_id: string;
  player_id: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  game_id: string;
  sender_player_id: string;
  body: string;
  kind: string | null;
  meta: any | null;
  created_at: string;
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

async function getOrCreateDirectChat(gameId: string, a: string, b: string): Promise<string> {
  const ids = [a, b].sort();

  // Find any existing chat where both are members.
  const { data: memberRows, error: memErr } = await supabase
    .from("drunkopoly_chat_members")
    .select("chat_id, player_id")
    .eq("player_id", ids[0]);
  if (memErr) throw memErr;

  const candidateChatIds = Array.from(new Set((memberRows || []).map((r: any) => r.chat_id)));
  if (candidateChatIds.length > 0) {
    const { data: otherMem, error: otherErr } = await supabase
      .from("drunkopoly_chat_members")
      .select("chat_id, player_id")
      .in("chat_id", candidateChatIds)
      .eq("player_id", ids[1]);
    if (otherErr) throw otherErr;
    const match = (otherMem || [])[0];
    if (match?.chat_id) {
      // Ensure chat belongs to game.
      const { data: chatRow, error: chatErr } = await supabase
        .from("drunkopoly_chats")
        .select("id, game_id")
        .eq("id", match.chat_id)
        .limit(1)
        .single();
      if (!chatErr && chatRow?.game_id === gameId) return match.chat_id;
    }
  }

  // Create chat + members.
  const { data: chatCreated, error: cErr } = await supabase
    .from("drunkopoly_chats")
    .insert([{ game_id: gameId, title: null, created_by_player_id: a }])
    .select()
    .limit(1)
    .single();
  if (cErr) throw cErr;

  await supabase.from("drunkopoly_chat_members").insert([
    { chat_id: chatCreated.id, player_id: a, last_read_at: new Date().toISOString() },
    { chat_id: chatCreated.id, player_id: b, last_read_at: null },
  ]);

  return chatCreated.id;
}

export default function Messages() {
  const navigate = useNavigate();

  const STORAGE_KEY_CODE = "drunkopoly:gameCode";
  const STORAGE_KEY_NAME = "drunkopoly:name";

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any | null>(null);
  const [me, setMe] = useState<any | null>(null);
  const [players, setPlayers] = useState<any[]>([]);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [members, setMembers] = useState<Record<string, ChatMemberRow>>({});
  const [chatMembersByChat, setChatMembersByChat] = useState<Record<string, string[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [newChatPlayerId, setNewChatPlayerId] = useState<string>("");
  const [draft, setDraft] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const gameCode = useMemo(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_CODE) || "").toUpperCase();
    } catch {
      return "";
    }
  }, []);

  const savedName = useMemo(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_NAME) || "").toUpperCase();
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!gameCode) throw new Error("Missing game code. Go back to Drunkopoly and join the game first.");
        if (!savedName) throw new Error("Missing player name. Go back to Drunkopoly and join the game first.");

        const { data: gRows, error: gErr } = await supabase.from("games").select("*").eq("code", gameCode).limit(1);
        if (gErr) throw gErr;
        const g = (gRows || [])[0];
        if (!g) throw new Error("Game not found.");

        const { data: pRows, error: pErr } = await supabase.from("players").select("*").eq("game_id", g.id);
        if (pErr) throw pErr;
        const allPlayers = pRows || [];
        const mine = allPlayers.find((p: any) => (p.name || "").toUpperCase() === savedName);
        if (!mine) throw new Error("Player not found in this game.");

        if (!mounted) return;
        setGame(g);
        setMe(mine);
        setPlayers(allPlayers);
      } catch (e: any) {
        console.error("Messages init error", e);
        toast({ title: "Unable to open messages", description: e?.message || "Unknown error", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [gameCode, savedName]);

  async function refreshChats(gid: string, myId: string) {
    const { data: memberRows, error: mErr } = await supabase
      .from("drunkopoly_chat_members")
      .select("chat_id, player_id, last_read_at")
      .eq("player_id", myId);
    if (mErr) throw mErr;
    const myMembers = (memberRows || []) as any[];
    const chatIds = myMembers.map((r) => r.chat_id);
    const nextMembers: Record<string, ChatMemberRow> = {};
    for (const r of myMembers) nextMembers[r.chat_id] = r;
    setMembers(nextMembers);

    if (chatIds.length === 0) {
      setChats([]);
      setActiveChatId(null);
      setChatMembersByChat({});
      return;
    }

    const { data: chatRows, error: cErr } = await supabase
      .from("drunkopoly_chats")
      .select("*")
      .eq("game_id", gid)
      .in("id", chatIds)
      .order("created_at", { ascending: false });
    if (cErr) throw cErr;
    setChats((chatRows || []) as any);

    // Fetch all members for these chats so we can display "who" each chat is with.
    const { data: allMemberRows, error: allMemErr } = await supabase
      .from("drunkopoly_chat_members")
      .select("chat_id, player_id")
      .in("chat_id", chatIds);
    if (allMemErr) throw allMemErr;
    const byChat: Record<string, string[]> = {};
    for (const r of (allMemberRows || []) as unknown as ChatMemberLiteRow[]) {
      if (!byChat[r.chat_id]) byChat[r.chat_id] = [];
      byChat[r.chat_id].push(r.player_id);
    }
    setChatMembersByChat(byChat);

    setActiveChatId((prev) => {
      if (prev && chatIds.includes(prev)) return prev;
      return (chatRows || [])[0]?.id ?? null;
    });
  }

  async function refreshMessages(chatId: string) {
    const { data, error } = await supabase
      .from("drunkopoly_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    setMessages((data || []) as any);
  }

  async function markRead(chatId: string, myId: string) {
    const now = new Date().toISOString();
    setMembers((prev) => ({ ...prev, [chatId]: { ...(prev[chatId] || { chat_id: chatId, player_id: myId, last_read_at: null }), last_read_at: now } }));
    await supabase
      .from("drunkopoly_chat_members")
      .update({ last_read_at: now })
      .eq("chat_id", chatId)
      .eq("player_id", myId);
  }

  useEffect(() => {
    if (!game?.id || !me?.id) return;
    let stopped = false;
    let timer: any = null;

    const tick = async () => {
      try {
        await refreshChats(game.id, me.id);
      } catch (e) {
        if (!stopped) console.warn("Refresh chats failed", e);
      }
      if (!stopped) timer = setTimeout(tick, 2500);
    };

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [game?.id, me?.id]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let stopped = false;
    let timer: any = null;

    const tick = async () => {
      try {
        await refreshMessages(activeChatId);
        if (game?.id && me?.id) await markRead(activeChatId, me.id);
      } catch (e) {
        if (!stopped) console.warn("Refresh messages failed", e);
      }
      if (!stopped) timer = setTimeout(tick, 1500);
    };
    tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeChatId, game?.id, me?.id]);

  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      // ignore
    }
  }, [messages.length, activeChatId]);

  const otherPlayers = useMemo(() => {
    const mid = me?.id;
    return (players || []).filter((p: any) => p.id !== mid).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  }, [players, me?.id]);

  const chatLabelById = useMemo(() => {
    const myId = String(me?.id || "");
    const pMap = new Map<string, string>();
    for (const p of players || []) pMap.set(String(p.id), String(p.name || "Unknown"));

    const out: Record<string, string> = {};
    for (const c of chats) {
      if (c.title && String(c.title).trim()) {
        out[c.id] = String(c.title).trim();
        continue;
      }
      const ids = (chatMembersByChat[c.id] || []).filter((id) => String(id) !== myId);
      if (ids.length === 0) {
        out[c.id] = "Chat";
        continue;
      }
      const names = ids.map((id) => pMap.get(String(id)) || "Unknown");
      out[c.id] = names.join(", ");
    }
    return out;
  }, [chats, chatMembersByChat, players, me?.id]);

  const activeChatLabel = useMemo(() => {
    if (!activeChatId) return "";
    return chatLabelById[activeChatId] || "Chat";
  }, [activeChatId, chatLabelById]);

  async function onCreateDirectChat() {
    try {
      if (!game?.id || !me?.id) return;
      const pid = (newChatPlayerId || "").trim();
      if (!pid) {
        toast({ title: "Select a player", description: "Choose someone to message." });
        return;
      }
      const chatId = await getOrCreateDirectChat(game.id, me.id, pid);
      setActiveChatId(chatId);
      setNewChatPlayerId("");
      await refreshChats(game.id, me.id);
    } catch (e: any) {
      console.error("Create chat failed", e);
      toast({ title: "Failed to create chat", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function notifyRecipients(chatId: string, senderName: string, body: string) {
    try {
      const { data: memRows, error: memErr } = await supabase
        .from("drunkopoly_chat_members")
        .select("player_id")
        .eq("chat_id", chatId);
      if (memErr) throw memErr;
      const targets = (memRows || []).map((r: any) => r.player_id).filter((id: string) => id !== me?.id);
      if (targets.length === 0) return;

      const formatted = `[from:${senderName}] ${body}`;
      await supabase
        .from("players")
        .update({ has_new_messenger: true, messenger_data: formatted })
        .in("id", targets);
    } catch (e) {
      console.warn("Recipient notify failed", e);
    }
  }

  async function onSend() {
    try {
      if (!game?.id || !me?.id || !activeChatId) return;
      const body = (draft || "").trim();
      if (!body) return;

      setDraft("");
      const { error } = await supabase.from("drunkopoly_chat_messages").insert([
        {
          chat_id: activeChatId,
          game_id: game.id,
          sender_player_id: me.id,
          body,
          kind: "chat",
          meta: null,
        },
      ]);
      if (error) throw error;

      await notifyRecipients(activeChatId, me.name || "Unknown", body);
      await refreshMessages(activeChatId);
      await markRead(activeChatId, me.id);
    } catch (e: any) {
      console.error("Send failed", e);
      toast({ title: "Send failed", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg p-6">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      <div className="px-6 py-4">
        <div className="relative flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/drunk/drunkopoly")}
            className="absolute left-0"
            aria-label="Back"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="font-semibold text-lg text-center">Messages</div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-92px)]">
          <Card className="md:col-span-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Chats
                <MessageSquarePlus className="w-4 h-4 opacity-70" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={newChatPlayerId}
                  onChange={(e) => setNewChatPlayerId(e.target.value)}
                >
                  <option value="">New chat with...</option>
                  {otherPlayers.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={onCreateDirectChat}>
                  Create
                </Button>
              </div>

              <div className="flex-1 overflow-auto border rounded-md bg-muted/10">
                <div className="p-2 flex flex-col gap-1">
                  {chats.length === 0 && <div className="text-sm text-muted-foreground p-2">No chats yet.</div>}
                  {chats.map((c) => {
                    const active = c.id === activeChatId;
                    const label = chatLabelById[c.id] || "Chat";
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveChatId(c.id)}
                        className={[
                          "text-left w-full px-3 py-2 rounded-md border transition-colors",
                          active ? "bg-background border-primary shadow-sm" : "bg-transparent border-border/60 hover:bg-background/60",
                        ].join(" ")}
                        style={active ? { boxShadow: "0 0 0 1px hsl(var(--primary) / 0.15)" } : undefined}
                      >
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-xs text-muted-foreground">{fmtTime(c.created_at)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{activeChatId ? activeChatLabel : "Conversation"}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex-1 overflow-auto border rounded-md bg-muted/10">
                <div className="p-3 flex flex-col gap-2">
                  {activeChatId == null && <div className="text-sm text-muted-foreground">Pick a chat or create one.</div>}
                  {activeChatId != null &&
                    messages.map((m) => {
                      const mine = m.sender_player_id === me?.id;
                      const sender = players.find((p: any) => p.id === m.sender_player_id)?.name || "Unknown";
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-lg border px-3 py-2 ${mine ? "bg-background" : "bg-muted/30"}`}>
                            <div className="text-xs text-muted-foreground">
                              {mine ? "You" : sender} · {fmtTime(m.created_at)}
                              {m.kind && m.kind !== "chat" ? ` · ${m.kind}` : ""}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                          </div>
                        </div>
                      );
                    })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={activeChatId ? "Write a message..." : "Create or pick a chat first"}
                  disabled={!activeChatId}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Button onClick={onSend} disabled={!activeChatId || !(draft || "").trim()}>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
