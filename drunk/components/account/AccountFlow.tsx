import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Camera, Check, ChevronLeft, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import PlayerAvatar from "../PlayerAvatar";
import { ColorBand } from "../BoardArt";
import PhoneInput from "./PhoneInput";
import { HeroLogo } from "./AccountShell";
import { AccountError, checkUsername, signInWithPhone, signUpWithPhone, type UsernameCheck } from "../../lib/drunkAccount";
import { formatPhoneInput, isValidPhone } from "../../lib/phone";

// Phone-only sign in. Enter your number: if it has an account you're in,
// otherwise you set up a profile on the spot (photo, name, username). Typing
// a username that belongs to an old, pre-phone account offers to move that
// account — stats, wins and photo — over to the number.

const LABEL = "mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground";

const ErrorNote = ({ children }: { children: ReactNode }) => (
  <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
    {children}
  </div>
);

const Hero = ({ eyebrow, title, onBack, backLabel, logo }: { eyebrow: ReactNode; title: ReactNode; onBack?: () => void; backLabel?: string; logo?: boolean }) => (
  <div className="w-full max-w-md">
    {logo && (
      <div className="mb-8 motion-safe:animate-rise">
        <HeroLogo className="w-full max-w-md" />
      </div>
    )}
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-safe:animate-rise"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel ?? "Back"}
      </button>
    )}
    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise" style={{ animationDelay: "70ms" }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
      {eyebrow}
    </p>
    <h1
      className="mt-3 pb-2 font-display text-4xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-5xl motion-safe:animate-rise"
      style={{ animationDelay: "140ms" }}
    >
      {title}
    </h1>
  </div>
);

const FlowCard = ({ children }: { children: ReactNode }) => (
  <Card className="mt-8 w-full max-w-md overflow-hidden motion-safe:animate-rise" style={{ animationDelay: "210ms" }}>
    <div aria-hidden className="px-6 pt-5">
      <ColorBand className="h-1 opacity-80" />
    </div>
    <CardContent className="pt-5">{children}</CardContent>
  </Card>
);

/** Big tappable photo picker. */
export const PhotoPicker = ({ preview, fallback, onPick, label = "Add a photo" }: {
  preview: string | null;
  fallback?: { name?: string | null; avatar_url?: string | null } | null;
  onPick: (file: File | null) => void;
  label?: string;
}) => (
  <label className="group flex cursor-pointer flex-col items-center gap-2 focus-within:outline-none">
    <span className="relative">
      {preview ? (
        <img src={preview} alt="Your photo" className="h-24 w-24 rounded-full object-cover ring-2 ring-brand/30" />
      ) : fallback?.avatar_url ? (
        <PlayerAvatar player={fallback} size="xl" className="!h-24 !w-24" />
      ) : (
        <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 bg-foreground/[0.03] text-muted-foreground transition-colors group-hover:border-brand/50 group-hover:text-foreground">
          <Camera className="h-7 w-7" />
        </span>
      )}
      <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background text-foreground shadow-md">
        <Camera className="h-4 w-4" />
      </span>
    </span>
    <span className="text-xs text-muted-foreground group-hover:text-foreground">{label}</span>
    <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
  </label>
);

type FlowProps = {
  /** Called once signed in (or signed up). */
  onDone?: (result: { kind: "signin" | "signup" | "claimed"; firstName: string }) => void;
  /** Shows a small "play as guest" escape hatch when provided. */
  onGuest?: () => void;
  /** Back button on the first step. */
  onBack?: () => void;
  backLabel?: string;
  /** Context shown above the title, e.g. the game being joined. */
  eyebrow?: ReactNode;
  /** Render without the big hero heading (e.g. inside a dialog). */
  compact?: boolean;
  /** Show the big Drunkopoly logo above the first step's heading. */
  logo?: boolean;
};

const AccountFlow = ({ onDone, onGuest, onBack, backLabel, eyebrow, compact, logo }: FlowProps) => {
  const [step, setStep] = useState<"phone" | "signup">("phone");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sign-up fields
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [nameCheck, setNameCheck] = useState<(UsernameCheck & { for: string }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // Names typed before moving an old account over, restored on "undo".
  const namesBeforeClaim = useRef<{ first: string; last: string } | null>(null);

  // Moving an old account over brings its first and last name with it.
  const startClaim = (old: UsernameCheck) => {
    namesBeforeClaim.current = { first: firstName, last: lastName };
    if (old.first_name) setFirstName(old.first_name);
    setLastName(old.last_name ?? "");
    setClaiming(true);
    setError(null);
  };
  const undoClaim = () => {
    if (namesBeforeClaim.current) {
      setFirstName(namesBeforeClaim.current.first);
      setLastName(namesBeforeClaim.current.last);
      namesBeforeClaim.current = null;
    }
    setClaiming(false);
  };

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  // Check the username shortly after typing stops.
  const checkSeq = useRef(0);
  useEffect(() => {
    const u = username.trim();
    // A different username cancels moving the old account (and its names) over.
    if (namesBeforeClaim.current) {
      setFirstName(namesBeforeClaim.current.first);
      setLastName(namesBeforeClaim.current.last);
      namesBeforeClaim.current = null;
    }
    setClaiming(false);
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(u)) { setNameCheck(null); setChecking(false); return; }
    const seq = ++checkSeq.current;
    setChecking(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await checkUsername(u);
        if (seq === checkSeq.current) setNameCheck({ ...res, for: u });
      } catch {
        if (seq === checkSeq.current) setNameCheck(null);
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [username]);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : "Something went wrong");

  const checkPhone = async (value: string) => {
    if (!isValidPhone(value)) { setError("Enter a full 10-digit phone number"); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithPhone(value);
      if (res) onDone?.({ kind: "signin", firstName: res.firstName || "" });
      else setStep("signup");
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    void checkPhone(phone);
  };

  // Typing (or autofilling) the last digit submits on its own: one less tap.
  // Only on the step from incomplete to complete, so coming back to this step
  // with a full number, or a failed attempt, doesn't loop.
  const onPhoneChange = (v: string) => {
    const completed = !isValidPhone(phone) && isValidPhone(v);
    setPhone(v);
    setError(null);
    if (completed && !busy) void checkPhone(v);
  };

  const legacy = nameCheck?.status === "legacy" && nameCheck.for === username.trim() ? nameCheck : null;
  const taken = nameCheck?.status === "taken" && nameCheck.for === username.trim();
  const usernameOk = /^[A-Za-z0-9_.]{3,20}$/.test(username.trim());
  // A photo is part of the profile, unless the old account being moved over already has one.
  const hasPhoto = !!photo || (claiming && !!legacy?.avatar_url);
  const canSignUp = !!firstName.trim() && usernameOk && !taken && hasPhoto && (!legacy || claiming);

  const submitSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSignUp) {
      if (!firstName.trim()) setError("Enter your first name");
      else if (!usernameOk) setError("Pick a username (3–20 letters, numbers, _ or .)");
      else if (taken) setError("That username is taken");
      else if (legacy && !claiming) setError("That username belongs to an older account — move it over or pick another");
      else if (!hasPhoto) setError("Add a profile photo so everyone knows who's who");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const claimed = await signUpWithPhone({
        phone,
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarFile: photo,
        claim: claiming,
      });
      onDone?.({ kind: claimed ? "claimed" : "signup", firstName: firstName.trim() });
    } catch (err) {
      if (err instanceof AccountError && err.code === "legacy_confirm_required") {
        setNameCheck({
          status: "legacy",
          first_name: err.extra.first_name,
          last_name: err.extra.last_name,
          avatar_url: err.extra.avatar_url,
          for: username.trim(),
        });
        setError(null);
      } else {
        fail(err);
      }
    } finally { setBusy(false); }
  };

  // ---- Step: phone -------------------------------------------------------
  if (step === "phone") {
    return (
      <>
        {!compact && <Hero eyebrow={eyebrow ?? "Drunkopoly account"} title="What’s your number?" onBack={onBack} backLabel={backLabel} logo={logo} />}
        <FlowCard>
          <form onSubmit={submitPhone} className="space-y-4">
            <div>
              <label htmlFor="drunk-phone" className={LABEL}>Phone number</label>
              <PhoneInput id="drunk-phone" value={phone} onChange={onPhoneChange} autoFocus />
              <p className="mt-2 text-xs text-muted-foreground">
                Your number is your login — it keeps your stats, wins and photo with you across every game. No texts, no password.
              </p>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" size="lg" className="w-full py-4 text-base font-semibold" disabled={!isValidPhone(phone) || busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Let’s play
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
            {onGuest && (
              <button
                type="button"
                onClick={onGuest}
                className="block w-full pt-1 text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Play as a guest
              </button>
            )}
          </form>
        </FlowCard>
      </>
    );
  }

  // ---- Step: sign up (new number) ----------------------------------------
  const toPhone = () => { setStep("phone"); setError(null); };
  return (
    <>
      {!compact && (
        <Hero
          eyebrow={<span className="font-mono normal-case tracking-normal">{formatPhoneInput(phone)}</span>}
          title="New here? Grab a seat"
          onBack={toPhone}
          backLabel="Different number"
        />
      )}
      <FlowCard>
        <form onSubmit={submitSignup} className="space-y-5">
          {compact && (
            <div className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm">
              <span className="font-mono text-muted-foreground">{formatPhoneInput(phone)}</span>
              <button type="button" onClick={toPhone} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Change
              </button>
            </div>
          )}

          <PhotoPicker
            preview={photoPreview}
            fallback={claiming && legacy ? { name: legacy.first_name, avatar_url: legacy.avatar_url } : null}
            label={photo ? "Change photo" : claiming && legacy?.avatar_url ? "Keeping your old photo — tap to change" : "Add a profile photo"}
            onPick={(f) => {
              setPhoto(f);
              setPhotoPreview(f ? URL.createObjectURL(f) : null);
              setError(null);
            }}
          />

          <div>
            <label htmlFor="su-username" className={LABEL}>Username</label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">@</span>
              <Input
                id="su-username"
                className="h-12 pl-8 pr-10 font-mono"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 20))}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="username"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : taken ? (
                  <X className="h-4 w-4 text-destructive" />
                ) : (nameCheck?.status === "available" && nameCheck.for === username.trim()) || claiming ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : null}
              </span>
            </div>
            {username && !usernameOk ? (
              <p className="mt-2 text-xs text-muted-foreground">3–20 letters, numbers, _ or .</p>
            ) : !legacy && !taken ? (
              <p className="mt-2 text-xs text-muted-foreground">Pick carefully — your username can’t be changed later.</p>
            ) : null}
            {taken && <p className="mt-2 text-xs text-destructive">That username is taken.</p>}

            {/* An old, pre-phone account owns this username: offer to move it over. */}
            {legacy && (
              <div className={cn("mt-3 rounded-xl border p-3", claiming ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-brand/30 bg-brand/[0.06]")}>
                <div className="flex items-center gap-3">
                  <PlayerAvatar player={{ name: legacy.first_name, avatar_url: legacy.avatar_url }} size="lg" />
                  <div className="min-w-0 flex-1 text-sm">
                    {claiming ? (
                      <>
                        <div className="font-medium text-foreground">Moving @{username.trim()} to this number</div>
                        <div className="text-xs text-muted-foreground">Its name, wins, sips and photo come with it.</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-foreground">Is @{username.trim()} your old account?</div>
                        <div className="text-xs text-muted-foreground">
                          {legacy.first_name ? `${legacy.first_name} played before phone sign-in. ` : ""}
                          Move it to this number to keep its wins, sips and photo.
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {!claiming ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="button" size="sm" onClick={() => startClaim(legacy)}>
                      Yes, that’s me
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setUsername("")}>
                      No, pick another
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={undoClaim} className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Not mine — undo
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="su-first" className={LABEL}>First name</label>
              <Input id="su-first" className="h-12" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" placeholder="First" maxLength={30} />
            </div>
            <div>
              <label htmlFor="su-last" className={LABEL}>Last name <span className="normal-case tracking-normal">(optional)</span></label>
              <Input id="su-last" className="h-12" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" placeholder="Last" maxLength={30} />
            </div>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" size="lg" className={cn("w-full py-4 text-base font-semibold", !canSignUp && "opacity-60")} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {claiming ? "Move account & play" : "Create account & play"}
          </Button>
        </form>
      </FlowCard>
    </>
  );
};

export default AccountFlow;
