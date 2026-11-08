import { useEffect } from "react";
import drunkSupabase, { SUPABASE_ANON_KEY, SUPABASE_URL } from "./drunkSupabase";

/*
 * Tiny first-party analytics for Drunkopoly: one row per screen viewed, plus
 * how long the tab was actually visible on it. Writes go through the
 * drunkopoly_track_view / drunkopoly_track_ping RPCs
 * (supabase/drunkopoly_site_analytics.sql); the lobby's Site Traffic panel
 * reads the totals back from drunkopoly_site_stats() (only for @nathan_ham).
 *
 * Nobody has to sign in to be counted. If they happen to be signed in, the
 * server reads their username from the session token.
 *
 * Not tracked: localhost, automated browsers, and anyone who has opened a
 * Drunkopoly page once with ?notrack (undo with ?track).
 */

export type TrackedPage = "lobby" | "game" | "rules" | "messages" | "player";

const VISITOR_KEY = "drunkopoly:visitor";
const SESSION_KEY = "drunkopoly:session";
const OPT_OUT_KEY = "drunkopoly:notrack";
const PING_MS = 15_000;

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

const stored = (storage: () => Storage, key: string) => {
  try {
    const s = storage();
    let id = s.getItem(key);
    if (!id) {
      id = uuid();
      s.setItem(key, id);
    }
    return id;
  } catch {
    return uuid();
  }
};

let sessionId: string | null = null;
let sentReferrer = false;

/*
 * How this tab arrived, read once when the module loads, before the lobby
 * strips ?invite= from the URL. Game QR codes add &src=qr to the invite link.
 */
const landing = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite") || params.get("code");
    const src = params.get("src");
    if (src === "qr") return { source: "qr", gameCode: code };
    if (code) return { source: "invite_link", gameCode: code };
    return { source: null as string | null, gameCode: null as string | null };
  } catch {
    return { source: null as string | null, gameCode: null as string | null };
  }
})();
let landingSent = false;

const trackingEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("notrack")) localStorage.setItem(OPT_OUT_KEY, "1");
    if (params.has("track")) localStorage.removeItem(OPT_OUT_KEY);
    if (localStorage.getItem(OPT_OUT_KEY)) return false;
  } catch {
    /* storage blocked: still count the visit */
  }
  if (navigator.webdriver) return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(window.location.hostname);
};

const deviceType = () => {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
};

/** External referring host, sent only with the first view of a tab session. */
const externalReferrer = () => {
  if (sentReferrer) return null;
  sentReferrer = true;
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host && host !== window.location.hostname.replace(/^www\./, "") ? host : null;
  } catch {
    return null;
  }
};

const post = (fn: string, body: Record<string, unknown>, token = SUPABASE_ANON_KEY) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    // keepalive lets the final ping finish while the tab is closing
    keepalive: true,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const rpc = (fn: string, body: Record<string, unknown>) =>
  post(fn, body).catch(() => {
    /* analytics must never break the game */
  });

/** Like rpc, but sends the signed-in player's token so the server can see who it is. */
const rpcAsUser = async (fn: string, body: Record<string, unknown>) => {
  try {
    const { data } = await drunkSupabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      const res = await post(fn, body, token);
      if (res.ok) return;
    }
    // Signed out, or the token expired: still count the view anonymously.
    await post(fn, body);
  } catch {
    /* analytics must never break the game */
  }
};

/** Attach the name someone joined a game as to their whole tab session. */
export const trackPlayer = (playerName: string, gameCode?: string | null) => {
  if (!sessionId || !playerName) return;
  void rpc("drunkopoly_track_player", { p_session: sessionId, p_player_name: playerName, p_game_code: gameCode ?? null });
};

/**
 * Records a view of `page` while the calling component is mounted and the
 * page is set. Changing `page` closes the current view and starts a new one.
 */
export const useTrackPage = (page: TrackedPage | null) => {
  useEffect(() => {
    if (!page || !trackingEnabled()) return;
    sessionId ??= stored(() => sessionStorage, SESSION_KEY);

    const id = uuid();
    let visibleMs = 0;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let lastSent = -1;

    const seconds = () => Math.round((visibleMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000);
    const ping = () => {
      const s = seconds();
      if (s === lastSent) return;
      lastSent = s;
      void rpc("drunkopoly_track_ping", { p_id: id, p_seconds: s });
    };

    // The ping can only update an existing row, so wait for the insert first.
    const referrer = externalReferrer();
    const first = !landingSent;
    landingSent = true;
    const created = rpcAsUser("drunkopoly_track_view", {
      p_id: id,
      p_visitor: stored(() => localStorage, VISITOR_KEY),
      p_session: sessionId,
      p_page: page,
      p_referrer: referrer,
      p_device: deviceType(),
      p_source: landing.source ?? (referrer ? "referral" : "direct"),
      p_game_code: first ? landing.gameCode : null,
      p_player_name: null,
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince ??= Date.now();
      } else {
        if (visibleSince) visibleMs += Date.now() - visibleSince;
        visibleSince = null;
        ping();
      }
    };
    const onPageHide = () => {
      onVisibility();
      ping();
    };
    const timer = window.setInterval(() => {
      if (visibleSince) void created.then(ping);
    }, PING_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void created.then(ping);
    };
  }, [page]);
};
