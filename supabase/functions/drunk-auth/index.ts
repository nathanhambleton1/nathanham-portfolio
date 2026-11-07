// Drunkopoly accounts: just a phone number. No password, no email, no texts.
//
// Each profile (drunk_users) is linked to a Supabase Auth user so the browser
// gets a real session (profile edits are tied to auth.uid()). The auth user
// has a placeholder email and no password; this function signs players in by
// minting a session for the account that owns the phone number.
//
// POST { action, ...payload }
//   lookup          { phone }       -> { exists, first_name?, avatar_url? }
//   check_username  { username }    -> { status: available|taken|legacy, first_name?, last_name?, avatar_url? }
//   signin          { phone }       -> { session, first_name }       (404 not_found if no account)
//   signup          { phone, username, first_name, last_name?, avatar_url?, claim? }
//                                   -> { session, claimed }           (409 legacy_confirm_required)
//   set_avatar      { avatar_url }  -> { avatar_url }   (signed-in: Authorization: Bearer <user token>)
//                   Saves the new photo and deletes the old file from storage.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Placeholder address for the auth user. Never emailed (nothing here sends mail).
const PLACEHOLDER_EMAIL_DOMAIN = "players.nathanham.tech";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = () =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

class Fail extends Error {
  constructor(public code: string, message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Accepts "(555) 123-4567", "555-123-4567", "+1 555 123 4567"… -> "+15551234567". */
function normalizePhone(raw: unknown): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{9}$/.test(digits)) throw new Fail("invalid_phone", "Enter a valid 10-digit phone number");
  return `+1${digits}`;
}

function cleanUsername(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (!/^[A-Za-z0-9_.]{3,20}$/.test(v)) {
    throw new Fail("invalid_username", "Usernames are 3-20 letters, numbers, _ or .");
  }
  return v;
}

function cleanName(raw: unknown, field: string, required: boolean): string | null {
  const v = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!v) {
    if (required) throw new Fail("invalid_name", `Enter your ${field}`);
    return null;
  }
  if (v.length > 30) throw new Fail("invalid_name", `Your ${field} is too long`);
  return v;
}

async function profileByPhone(phone: string) {
  const { data, error } = await admin()
    .from("drunk_users")
    .select("id, auth_user_id, first_name, avatar_url")
    .eq("phone", phone)
    .not("auth_user_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Mint a session for an auth user without a password (nothing is emailed). */
async function sessionFor(authUserId: string) {
  const db = admin();
  const { data: u, error: uErr } = await db.auth.admin.getUserById(authUserId);
  if (uErr || !u?.user?.email) throw new Fail("not_found", "No account uses that phone number", 404);
  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (linkErr || !link?.properties?.hashed_token) throw new Error(linkErr?.message ?? "Couldn't start a session");
  const { data, error } = await anon().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error || !data.session) throw new Error(error?.message ?? "Couldn't start a session");
  const { access_token, refresh_token } = data.session;
  return { access_token, refresh_token };
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

const AVATAR_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

const isOurAvatar = (url: unknown): url is string =>
  typeof url === "string" && url.startsWith(AVATAR_PREFIX) && url.length > AVATAR_PREFIX.length;

/** Storage path inside the avatars bucket, e.g. "nathan_ham_1776555991617.jpg". */
const avatarPath = (url: string) => decodeURIComponent(url.slice(AVATAR_PREFIX.length).split("?")[0]);

/**
 * Point a profile (and any game seats that copied its photo) at a new photo,
 * then delete the old file so replaced photos don't pile up in storage.
 */
async function replaceAvatar(profileId: string, oldUrl: string | null, newUrl: string) {
  const db = admin();
  const { error } = await db.from("drunk_users").update({ avatar_url: newUrl }).eq("id", profileId);
  if (error) throw error;
  if (!oldUrl || oldUrl === newUrl) return;

  // Seats keep a copy of the photo URL; move them to the new one so none break.
  await db.from("players").update({ avatar_url: newUrl }).eq("user_id", profileId);
  await db.from("players").update({ avatar_url: newUrl }).eq("avatar_url", oldUrl);

  if (!isOurAvatar(oldUrl)) return;
  // Never delete a file another account still uses.
  const { count } = await db.from("drunk_users").select("id", { count: "exact", head: true }).eq("avatar_url", oldUrl);
  if (count) return;
  const { error: rmErr } = await db.storage.from("avatars").remove([avatarPath(oldUrl)]);
  if (rmErr) console.warn("Old avatar delete failed", rmErr.message);
}

async function setAvatar(body: any, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: whoErr } = await admin().auth.getUser(token);
  if (whoErr || !who?.user) throw new Fail("signed_out", "Sign in to change your photo", 401);
  if (!isOurAvatar(body.avatar_url)) throw new Fail("invalid_avatar", "That photo didn't upload correctly. Try again.");

  const { data: profile, error } = await admin()
    .from("drunk_users")
    .select("id, avatar_url")
    .eq("auth_user_id", who.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Fail("not_found", "Profile not found", 404);

  await replaceAvatar(profile.id, profile.avatar_url, body.avatar_url);
  return { avatar_url: body.avatar_url };
}

// ---------------------------------------------------------------------------

async function lookup(body: any) {
  const phone = normalizePhone(body.phone);
  const profile = await profileByPhone(phone);
  if (!profile) return { exists: false };
  return { exists: true, first_name: profile.first_name, avatar_url: profile.avatar_url };
}

async function checkUsername(body: any) {
  const username = cleanUsername(body.username);
  const { data, error } = await admin()
    .from("drunk_users")
    .select("id, auth_user_id, first_name, last_name, avatar_url")
    .ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "available" };
  if (data.auth_user_id) return { status: "taken" };
  return { status: "legacy", id: data.id, first_name: data.first_name, last_name: data.last_name, avatar_url: data.avatar_url };
}

async function signin(body: any) {
  const phone = normalizePhone(body.phone);
  const profile = await profileByPhone(phone);
  if (!profile) throw new Fail("not_found", "No account uses that phone number", 404);
  return { session: await sessionFor(profile.auth_user_id), first_name: profile.first_name };
}

async function signup(body: any) {
  const phone = normalizePhone(body.phone);
  const username = cleanUsername(body.username);
  const firstName = cleanName(body.first_name, "first name", true)!;
  const lastName = cleanName(body.last_name, "last name", false);
  const avatarUrl = isOurAvatar(body.avatar_url) ? body.avatar_url : null;

  const db = admin();

  if (await profileByPhone(phone)) {
    throw new Fail("phone_taken", "That phone number already has an account");
  }

  // Username: free, already claimed, or an old (pre-phone) account to move over.
  const name = await checkUsername({ username });
  if (name.status === "taken") throw new Fail("username_taken", "That username is taken");
  let legacyId: string | null = null;
  if (name.status === "legacy") {
    if (!body.claim) {
      throw new Fail("legacy_confirm_required", "That username belongs to an existing account", 409, {
        first_name: name.first_name,
        last_name: name.last_name,
        avatar_url: name.avatar_url,
      });
    }
    legacyId = name.id as string;
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: `${crypto.randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: { app: "drunkopoly", username },
  });
  if (createErr || !created?.user) throw new Fail("signup_failed", createErr?.message || "Could not create the account", 500);
  const authUserId = created.user.id;

  try {
    if (legacyId) {
      const updates: Record<string, unknown> = {
        auth_user_id: authUserId,
        phone,
        username,
        first_name: firstName,
        password: null,
      };
      if (lastName) updates.last_name = lastName;
      const { data, error } = await db
        .from("drunk_users")
        .update(updates)
        .eq("id", legacyId)
        .is("auth_user_id", null)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw Object.assign(new Error("already claimed"), { code: "23505" });
      // A new photo replaces the old account's one (and the old file is deleted).
      if (avatarUrl) await replaceAvatar(legacyId, (name.avatar_url as string | null) ?? null, avatarUrl);
    } else {
      const { error } = await db.from("drunk_users").insert({
        auth_user_id: authUserId,
        phone,
        username,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        wins: 0,
        losses: 0,
        total_sips: 0,
      });
      if (error) throw error;
    }
  } catch (err) {
    await db.auth.admin.deleteUser(authUserId).catch(() => {});
    if ((err as any)?.code === "23505") throw new Fail("conflict", "That phone number or username was just taken — try again");
    throw err;
  }

  return { session: await sessionFor(authUserId), claimed: !!legacyId };
}

const ACTIONS: Record<string, (body: any, req: Request) => Promise<unknown>> = {
  lookup,
  check_username: async (b) => {
    const { id: _id, ...rest } = (await checkUsername(b)) as Record<string, unknown>;
    return rest;
  },
  signin,
  signup,
  set_avatar: setAvatar,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const handler = ACTIONS[String(body?.action)];
    if (!handler) throw new Fail("unknown_action", "Unknown action");
    return json(await handler(body, req));
  } catch (err) {
    if (err instanceof Fail) return json({ error: err.code, message: err.message, ...err.extra }, err.status);
    console.error("drunk-auth error", err);
    return json({ error: "server_error", message: "Something went wrong. Try again." }, 500);
  }
});
