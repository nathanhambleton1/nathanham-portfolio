import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { toast } from "../components/ui/use-toast";
import { ArrowLeft, ArrowUp, ChevronLeft, Pencil } from "lucide-react";

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

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function groupTime(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (mins < 60 * 24) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

async function getOrCreateDirectChat(gameId: string, a: string, b: string): Promise<string> {
  const ids = [a, b].sort();
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
      const { data: chatRow, error: chatErr } = await supabase
        .from("drunkopoly_chats")
        .select("id, game_id")
        .eq("id", match.chat_id)
        .limit(1)
        .single();
      if (!chatErr && chatRow?.game_id === gameId) return match.chat_id;
    }
  }
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
  const [lastMessageByChat, setLastMessageByChat] = useState<Record<string, MessageRow>>({});
  const [chatsLoading, setChatsLoading] = useState<boolean>(true);
  const chatsInitializedRef = React.useRef(false);

  const [draft, setDraft] = useState<string>("");
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const initializedChatsRef = React.useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const gameCode = useMemo(() => {
    try { return (localStorage.getItem(STORAGE_KEY_CODE) || "").toUpperCase(); } catch { return ""; }
  }, []);

  const savedName = useMemo(() => {
    try { return (localStorage.getItem(STORAGE_KEY_NAME) || "").toUpperCase(); } catch { return ""; }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!gameCode) throw new Error("Missing game code.");
        if (!savedName) throw new Error("Missing player name.");
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
        toast({ title: "Unable to open messages", description: e?.message || "Unknown error", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [gameCode, savedName]);

  async function refreshChats(gid: string, myId: string) {
    if (!chatsInitializedRef.current) setChatsLoading(true);
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
      setActiveChatId((prev) => (prev ? null : prev));
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

    // Fetch last message per chat for preview
    if (chatIds.length > 0) {
      const previews: Record<string, MessageRow> = {};
      await Promise.all(
        chatIds.map(async (cid) => {
          const { data } = await supabase
            .from("drunkopoly_chat_messages")
            .select("*")
            .eq("chat_id", cid)
            .order("created_at", { ascending: false })
            .limit(1);
          if (data && data[0]) previews[cid] = data[0] as MessageRow;
        })
      );
      setLastMessageByChat(previews);
    }
    setActiveChatId((prev) => {
      if (prev && chatIds.includes(prev)) return prev;
      return null;
    });
    setChatsLoading(false);
    chatsInitializedRef.current = true;
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
    setMembers((prev) => ({
      ...prev,
      [chatId]: { ...(prev[chatId] || { chat_id: chatId, player_id: myId, last_read_at: null }), last_read_at: now },
    }));
    await supabase.from("drunkopoly_chat_members").update({ last_read_at: now }).eq("chat_id", chatId).eq("player_id", myId);
  }

  useEffect(() => {
    if (!game?.id || !me?.id) return;
    let stopped = false;
    let timer: any = null;
    const tick = async () => {
      try { await refreshChats(game.id, me.id); } catch (e) { if (!stopped) console.warn("Refresh chats failed", e); }
      if (!stopped) timer = setTimeout(tick, 2500);
    };
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [game?.id, me?.id]);

  useEffect(() => {
    if (!activeChatId) { setMessages([]); return; }

    // If this chat hasn't been initialized yet, load it with a spinner.
    let stopped = false;
    let timer: any = null;
    const doInitialLoad = async () => {
      if (!initializedChatsRef.current.has(activeChatId)) {
        setMessages([]);
        setMessagesLoading(true);
        try {
          await refreshMessages(activeChatId);
          if (game?.id && me?.id) await markRead(activeChatId, me.id);
          initializedChatsRef.current.add(activeChatId);
        } catch (e) {
          if (!stopped) console.warn("Initial load messages failed", e);
        } finally {
          if (!stopped) setMessagesLoading(false);
        }
      }
    };

    const tick = async () => {
      try {
        await refreshMessages(activeChatId);
        if (game?.id && me?.id) await markRead(activeChatId, me.id);
      } catch (e) { if (!stopped) console.warn("Refresh messages failed", e); }
      if (!stopped) timer = setTimeout(tick, 1500);
    };

    doInitialLoad().then(() => { if (!stopped) tick(); });
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [activeChatId, game?.id, me?.id]);

  useEffect(() => {
    try { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch { /* ignore */ }
  }, [messages.length, activeChatId]);

  // Focus input when opening a chat
  useEffect(() => {
    if (activeChatId) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeChatId]);

  const otherPlayers = useMemo(() => {
    const mid = me?.id;
    return (players || []).filter((p: any) => p.id !== mid).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  }, [players, me?.id]);

  const playersSorted = useMemo(() => {
    const myId = String(me?.id || "");
    const list = (otherPlayers || []).map((p: any) => {
      let chatId: string | null = null;
      for (const cid of Object.keys(chatMembersByChat || {})) {
        const members = chatMembersByChat[cid] || [];
        if (members.includes(String(p.id)) && members.includes(myId)) { chatId = cid; break; }
      }
      const lastMsg = chatId ? lastMessageByChat[chatId] : null;
      const lastTime = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;
      return { player: p, chatId, lastMsg, lastTime };
    });
    list.sort((a, b) => b.lastTime - a.lastTime || String(a.player.name).localeCompare(String(b.player.name)));
    return list;
  }, [otherPlayers, chatMembersByChat, lastMessageByChat, me?.id]);

  const chatLabelById = useMemo(() => {
    const myId = String(me?.id || "");
    const pMap = new Map<string, string>();
    for (const p of players || []) pMap.set(String(p.id), String(p.name || "Unknown"));
    const out: Record<string, string> = {};
    for (const c of chats) {
      if (c.title && String(c.title).trim()) { out[c.id] = String(c.title).trim(); continue; }
      const ids = (chatMembersByChat[c.id] || []).filter((id) => String(id) !== myId);
      if (ids.length === 0) { out[c.id] = "Chat"; continue; }
      out[c.id] = ids.map((id) => pMap.get(String(id)) || "Unknown").join(", ");
    }
    return out;
  }, [chats, chatMembersByChat, players, me?.id]);

  const unreadByChat = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const c of chats) {
      const m = members[c.id];
      const lastMsg = lastMessageByChat[c.id];
      if (!lastMsg) { out[c.id] = false; continue; }
      if (lastMsg.sender_player_id === me?.id) { out[c.id] = false; continue; }
      if (!m?.last_read_at) { out[c.id] = true; continue; }
      out[c.id] = new Date(lastMsg.created_at) > new Date(m.last_read_at);
    }
    return out;
  }, [chats, members, lastMessageByChat, me?.id]);

  // Sort chats: most recent message first
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aLast = lastMessageByChat[a.id]?.created_at ?? a.created_at;
      const bLast = lastMessageByChat[b.id]?.created_at ?? b.created_at;
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });
  }, [chats, lastMessageByChat]);

  const activeChatLabel = useMemo(() => {
    if (!activeChatId) return "";
    return chatLabelById[activeChatId] || "Chat";
  }, [activeChatId, chatLabelById]);

  const activeChatOtherPlayer = useMemo(() => {
    if (!activeChatId) return null;
    const myId = String(me?.id || "");
    const otherIds = (chatMembersByChat[activeChatId] || []).filter((id) => String(id) !== myId);
    if (otherIds.length !== 1) return null;
    return players.find((p: any) => String(p.id) === otherIds[0]) ?? null;
  }, [activeChatId, chatMembersByChat, players, me?.id]);

  async function onCreateDirectChat(pid?: string) {
    const targetId = (pid || "").trim();
    if (!targetId || !game?.id || !me?.id) return;
    try {
      const chatId = await getOrCreateDirectChat(game.id, me.id, targetId);
      setActiveChatId(chatId);
      await refreshChats(game.id, me.id);
      await refreshMessages(chatId);
      await markRead(chatId, me.id);
    } catch (e: any) {
      toast({ title: "Failed to create chat", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function notifyRecipients(chatId: string, senderName: string, body: string) {
    try {
      const { data: memRows, error: memErr } = await supabase.from("drunkopoly_chat_members").select("player_id").eq("chat_id", chatId);
      if (memErr) throw memErr;
      const targets = (memRows || []).map((r: any) => r.player_id).filter((id: string) => id !== me?.id);
      if (targets.length === 0) return;
      await supabase.from("players").update({ has_new_messenger: true, messenger_data: `[from:${senderName}] ${body}` }).in("id", targets);
    } catch (e) { console.warn("Recipient notify failed", e); }
  }

  async function onSend() {
    try {
      if (!game?.id || !me?.id || !activeChatId) return;
      const body = (draft || "").trim();
      if (!body) return;
      setDraft("");
      const { error } = await supabase.from("drunkopoly_chat_messages").insert([{
        chat_id: activeChatId, game_id: game.id, sender_player_id: me.id, body, kind: "chat", meta: null,
      }]);
      if (error) throw error;
      await notifyRecipients(activeChatId, me.name || "Unknown", body);
      await refreshMessages(activeChatId);
      await markRead(activeChatId, me.id);
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  // Show timestamp label between messages when gap > 10 min
  function shouldShowTime(msgs: MessageRow[], idx: number) {
    if (idx === 0) return true;
    const prev = new Date(msgs[idx - 1].created_at).getTime();
    const curr = new Date(msgs[idx].created_at).getTime();
    return curr - prev > 10 * 60 * 1000;
  }

  const inConversation = activeChatId !== null;

  const safeTop: React.CSSProperties = { paddingTop: "max(env(safe-area-inset-top), 12px)" };
  const safeBottom: React.CSSProperties = { paddingBottom: "max(env(safe-area-inset-bottom), 12px)" };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden flex bg-background">

      {/* ── SIDEBAR / CHAT LIST ── */}
      <div
        className={[
          "flex flex-col bg-background border-r border-border/60",
          "w-full md:w-80 md:shrink-0",
          inConversation ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 pb-3 border-b border-border/60 relative"
          style={safeTop}
        >
          <button
            onClick={() => navigate("/drunk/drunkopoly")}
            className="flex items-center gap-0.5 text-primary text-sm font-medium -ml-1 px-1 py-1 rounded-md hover:bg-primary/10 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full flex justify-center">
            <span className="font-semibold text-base pointer-events-auto">Messages</span>
          </div>
          {/* compose removed; messages show all players */}
        </div>

        {/* Compose feature removed — list shows all players */}

        {/* Chat list: show all players and open/create direct chat on click */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden">
          {chatsLoading ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" fill="none" strokeOpacity="0.2" />
                <path fill="currentColor" d="M25 5a20 20 0 0 1 20 20h-4a16 16 0 0 0-16-16z">
                  <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
          ) : (
            playersSorted.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center mt-16 px-8 leading-relaxed">No other players in this game.</div>
            ) : (
              playersSorted.map(({ player, chatId, lastMsg }) => {
          
            const label = player.name || "Player";
            const isUnread = chatId ? unreadByChat[chatId] : false;
            const preview = lastMsg ? (lastMsg.kind === "payment" ? "💸 Payment note" : lastMsg.body) : "No messages yet";
            const time = lastMsg ? relativeTime(lastMsg.created_at) : "";

            return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onCreateDirectChat(String(player.id))}
                  className={[
                    "w-full text-left flex items-center gap-3 px-6 py-4 border-b border-border/30 transition-colors",
                    chatId === activeChatId ? "bg-primary/10" : "hover:bg-muted/40 active:bg-muted/60",
                  ].join(" ")}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`text-base truncate ${isUnread ? "font-semibold" : "font-medium"}`}>{label}</span>
                      <span className="text-sm text-muted-foreground shrink-0">{time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className={`text-sm truncate ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>{preview}</span>
                      {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />}
                    </div>
                  </div>
                </button>
            );
              }))
          )}
        </div>
      </div>

      {/* ── CONVERSATION PANEL ── */}
      <div
        className={[
          "flex flex-col flex-1 min-w-0 bg-background overflow-hidden",
          inConversation ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        {!activeChatId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Pencil className="w-6 h-6 opacity-30" />
            </div>
            <p className="text-sm text-center">Select a conversation or tap the pencil to start one</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div
              className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border/60 bg-background/90 backdrop-blur-md relative"
              style={safeTop}
            >
              <button
                onClick={() => setActiveChatId(null)}
                className="md:hidden flex items-center gap-0.5 text-primary text-sm font-medium -ml-1 px-1 py-1 rounded-md hover:bg-primary/10 shrink-0 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full flex justify-center">
                <span className="font-semibold text-sm max-w-[70%] truncate text-center pointer-events-auto">{activeChatLabel}</span>
              </div>
            </div>

            {/* Messages scroll area */}
            <div
              className="flex-1 min-h-0 px-4 pt-0 flex flex-col border-t border-border/60"
              style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
            >
              {messagesLoading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <svg className="w-8 h-8 text-primary" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" fill="none" strokeOpacity="0.2" />
                    <path fill="currentColor" d="M25 5a20 20 0 0 1 20 20h-4a16 16 0 0 0-16-16z">
                      <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                    </path>
                  </svg>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground mt-10">No messages yet. Say hi!</div>
              ) : (
                <div className="flex-1 flex flex-col gap-0 justify-end overflow-y-auto">
                  {messages.map((m, idx) => {
                    const mine = m.sender_player_id === me?.id;
                    const isPayment = m.kind === "payment";
                    const showTime = shouldShowTime(messages, idx);
                    const nextMsg = messages[idx + 1];
                    const prevMsg = messages[idx - 1];
                    const isLastInGroup = !nextMsg || nextMsg.sender_player_id !== m.sender_player_id;
                    const isFirstInGroup = !prevMsg || prevMsg.sender_player_id !== m.sender_player_id;

                    return (
                      <div key={m.id} className={isFirstInGroup && idx > 0 ? "mt-2" : "mt-1"}>
                        {showTime && (
                          <div className="text-center text-xs text-muted-foreground my-4 font-medium">
                            {groupTime(m.created_at)}
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-1.5`}>
                          <div
                            className={[
                              "max-w-[95%] sm:max-w-[85%] inline-flex items-center px-6 py-3 text-base leading-normal rounded-xl",
                              isPayment
                                ? "bg-yellow-500/20 text-foreground border border-yellow-500/30"
                                : mine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            ].join(" ")}
                            style={{ paddingLeft: 20, paddingRight: 20 }}
                          >
                            {isPayment && (
                              <div className="text-sm font-medium opacity-60 mb-0.5">💸 Payment note</div>
                            )}
                            <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Input bar */}
            <div
              className="flex-shrink-0 w-full flex items-center gap-2 px-4 pt-1 bg-background"
              style={safeBottom}
            >
              <div className="flex-1 flex items-center bg-muted/50 border border-border/60 rounded-full px-4 py-2 min-h-[40px]">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: '16px' }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
                  }}
                />
              </div>
              <button
                onClick={onSend}
                disabled={!(draft || "").trim()}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-25 transition-opacity"
                aria-label="Send"
              >
                <ArrowUp className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
