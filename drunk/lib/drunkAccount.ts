import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { drunkSupabase as supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./drunkSupabase";
import { toE164 } from "./phone";

// Drunkopoly accounts: just a phone number — no password, no email, no texts.
//
// Entering a number signs you into the account that owns it (or starts a new
// one). The `drunk-auth` edge function does the lookup and hands back a real
// Supabase session, so profile edits are tied to the signed-in player and the
// browser never sees anyone else's number.
//
// One shared store (not per-component state) so the lobby, the in-game menu
// and the profile dialog all agree on who is signed in.

export type DrunkProfile = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  phone: string | null;
  wins: number | null;
  losses: number | null;
  total_sips: number | null;
  created_at?: string;
};

type AccountState = {
  /** False until the saved session (if any) has been checked. */
  ready: boolean;
  session: Session | null;
  profile: DrunkProfile | null;
};

let state: AccountState = { ready: false, session: null, profile: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export class AccountError extends Error {
  constructor(public code: string, message: string, public extra: Record<string, any> = {}) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Session bootstrap
// ---------------------------------------------------------------------------

const loadProfile = async (): Promise<DrunkProfile | null> => {
  const { data, error } = await supabase.rpc("drunk_my_profile");
  if (error) throw error;
  return (data as DrunkProfile | null) ?? null;
};

let loadingFor: string | null = null;
const syncSession = async (session: Session | null) => {
  if (!session) {
    loadingFor = null;
    set({ ready: true, session: null, profile: null });
    return;
  }
  if (loadingFor === session.user.id && state.profile) {
    set({ session });
    return;
  }
  loadingFor = session.user.id;
  try {
    const profile = await loadProfile();
    if (loadingFor !== session.user.id) return;
    set({ ready: true, session, profile });
  } catch (err) {
    console.warn("Loading Drunkopoly profile failed", err);
    set({ ready: true, session, profile: state.profile });
  }
};

let started = false;
const start = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  // Accounts from before phone sign-in were cached here; they no longer sign you in.
  try { localStorage.removeItem("drunkopoly:authUser"); } catch { /* ignore */ }

  supabase.auth.getSession().then(({ data }) => syncSession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => {
    // Don't await Supabase calls inside this callback (it can deadlock the auth lock).
    window.setTimeout(() => { void syncSession(session); }, 0);
  });
};

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The signed-in Drunkopoly account (or null), kept in sync everywhere. */
export const useDrunkAccount = () => useSyncExternalStore(subscribe, () => state, () => state);

// ---------------------------------------------------------------------------
// Edge function calls
// ---------------------------------------------------------------------------

const callAuth = async <T = any>(action: string, payload: Record<string, unknown>, userToken?: string): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/drunk-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${userToken ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new AccountError("network", "Couldn't reach the server. Check your connection.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, message, ...extra } = body || {};
    throw new AccountError(error || "server_error", message || "Something went wrong. Try again.", extra);
  }
  return body as T;
};

const adoptSession = async (s: { access_token: string; refresh_token: string }) => {
  const { data, error } = await supabase.auth.setSession(s);
  if (error) throw new AccountError("session", error.message);
  await syncSession(data.session);
};

export type PhoneLookup = { exists: boolean; first_name?: string | null; avatar_url?: string | null };
export const lookupPhone = (phone: string) => callAuth<PhoneLookup>("lookup", { phone: toE164(phone) });

export type UsernameCheck = {
  status: "available" | "taken" | "legacy";
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};
export const checkUsername = (username: string) => callAuth<UsernameCheck>("check_username", { username });

/**
 * Signs into the account that owns this number. Returns its first name, or
 * null when no account uses the number yet (time to sign up).
 */
export const signInWithPhone = async (phone: string): Promise<{ firstName: string | null } | null> => {
  try {
    const { session, first_name } = await callAuth("signin", { phone: toE164(phone) });
    await adoptSession(session);
    return { firstName: first_name ?? null };
  } catch (err) {
    if (err instanceof AccountError && err.code === "not_found") return null;
    throw err;
  }
};

export type SignUpInput = {
  phone: string;
  username: string;
  firstName: string;
  lastName?: string;
  avatarFile?: File | null;
  /** The player confirmed an old (pre-phone) account with this username is theirs. */
  claim?: boolean;
};

/** Returns true when an existing (pre-phone) account was moved over. */
export const signUpWithPhone = async (input: SignUpInput): Promise<boolean> => {
  let avatar_url: string | null = null;
  if (input.avatarFile) avatar_url = await uploadAvatar(input.avatarFile, input.username);
  const { session, claimed } = await callAuth("signup", {
    phone: toE164(input.phone),
    username: input.username,
    first_name: input.firstName,
    last_name: input.lastName || null,
    avatar_url,
    claim: !!input.claim,
  });
  await adoptSession(session);
  return !!claimed;
};

// ---------------------------------------------------------------------------
// Signed-in actions
// ---------------------------------------------------------------------------

export const signOutAccount = async () => {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  set({ session: null, profile: null });
};

export const refreshProfile = async () => {
  if (!state.session) return null;
  const profile = await loadProfile();
  set({ profile });
  return profile;
};

/** Locally merge fields (e.g. stats the game just wrote) without a round-trip. */
export const patchProfile = (patch: Partial<DrunkProfile>) => {
  if (!state.profile) return;
  set({ profile: { ...state.profile, ...patch } });
};

/**
 * Update the editable parts of a profile: first name, last name and photo.
 * (Username and phone number are fixed once the account is created.)
 * A new photo goes through the edge function, which deletes the old file.
 */
export const updateProfileDetails = async (opts: { firstName: string; lastName: string; avatarFile?: File | null }) => {
  const p = state.profile;
  if (!p || !state.session) throw new AccountError("signed_out", "Not signed in");
  const firstName = opts.firstName.trim();
  if (!firstName) throw new AccountError("invalid_name", "Enter your first name");
  const names = { first_name: firstName, last_name: opts.lastName.trim() || null };
  if (names.first_name !== p.first_name || names.last_name !== (p.last_name || null)) {
    const { error } = await supabase.from("drunk_users").update(names).eq("id", p.id);
    if (error) throw new AccountError("save", error.message);
    patchProfile(names);
  }
  if (opts.avatarFile) {
    const url = await uploadAvatar(opts.avatarFile, p.username);
    const { avatar_url } = await callAuth<{ avatar_url: string }>("set_avatar", { avatar_url: url }, state.session.access_token);
    patchProfile({ avatar_url });
  }
};

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

/** Center-crop to a square and shrink to a JPEG (phones upload huge photos). 1024px keeps
 *  the full-screen photo viewer sharp while staying ~100–200 KB. */
const compressImage = (file: File, maxDim = 1024, quality = 0.8): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const out = Math.min(maxDim, side);
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      // Default smoothing is low quality and leaves big phone photos jagged/blurry.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be read")); };
    img.src = url;
  });

export const uploadAvatar = async (file: File, username: string): Promise<string> => {
  const blob = await compressImage(file);
  const path = `${(username || "player").toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new AccountError("upload", "Photo upload failed. Try a different photo.");
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
};
