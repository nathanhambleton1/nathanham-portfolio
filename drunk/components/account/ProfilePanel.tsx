import { useEffect, useState } from "react";
import { Loader2, Lock, LogOut } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";
import { PhotoPicker } from "./AccountFlow";
import {
  refreshProfile,
  signOutAccount,
  updateProfileDetails,
  useDrunkAccount,
} from "../../lib/drunkAccount";
import { formatE164 } from "../../lib/phone";

const LABEL = "mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground";
const ROW = "rounded-xl border border-foreground/10 bg-foreground/[0.03]";

/** A read-only field (username, phone): set at sign-up, can't be changed. */
const LockedField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className={LABEL}>{label}</div>
    <div className={`${ROW} flex h-11 items-center justify-between gap-2 px-3 font-mono text-sm text-muted-foreground`}>
      <span className="truncate">{value}</span>
      <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="Can't be changed" />
    </div>
  </div>
);

/**
 * The signed-in account. Photo and first/last name can change; the username
 * and phone number are fixed once the account is created.
 */
const ProfilePanel = ({ onSignedOut, showRecord = true }: { onSignedOut?: () => void; showRecord?: boolean }) => {
  const { profile } = useDrunkAccount();
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats change during games; pull the latest when the panel opens.
  useEffect(() => { refreshProfile().catch(() => {}); }, []);

  // Re-seed the fields when a different account loads.
  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!profile) return null;

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username;
  const detailsChanged =
    !!photo || firstName.trim() !== (profile.first_name ?? "") || lastName.trim() !== (profile.last_name ?? "");
  const dirty = detailsChanged;

  const wins = profile.wins ?? 0;
  const losses = profile.losses ?? 0;
  const played = wins + losses;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfileDetails({ firstName, lastName, avatarFile: photo });
      setPhoto(null);
      setPreview(null);
      toast({ title: "Profile saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PhotoPicker
        preview={preview}
        fallback={{ name: fullName, avatar_url: profile.avatar_url }}
        label="Change photo"
        onPick={(f) => { setPhoto(f); setPreview(f ? URL.createObjectURL(f) : null); }}
      />

      <LockedField label="Username" value={`@${profile.username}`} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-first" className={LABEL}>First name</label>
          <Input id="pf-first" className="h-11" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={30} />
        </div>
        <div>
          <label htmlFor="pf-last" className={LABEL}>Last name</label>
          <Input id="pf-last" className="h-11" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={30} />
        </div>
      </div>

      <LockedField label="Phone number" value={formatE164(profile.phone) || "—"} />

      {error && (
        <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>
      )}
      <Button className="w-full" onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saving ? "Saving…" : "Save changes"}
      </Button>

      {/* Record (the profile page shows the full stats board instead) */}
      {showRecord && <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Record</div>
        <div className={`${ROW} overflow-hidden`}>
          <div className="flex gap-3 p-4">
            <div className="flex-1 text-center">
              <div className="font-display text-2xl font-bold tracking-tight text-brand">{wins}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">Wins</div>
            </div>
            <div className="w-px bg-foreground/10" />
            <div className="flex-1 text-center">
              <div className="font-display text-2xl font-bold tracking-tight">{losses}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">Losses</div>
            </div>
            <div className="w-px bg-foreground/10" />
            <div className="flex-1 text-center">
              <div className="font-display text-2xl font-bold tracking-tight">{played > 0 ? Math.round((wins / played) * 100) : 0}%</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">Win rate</div>
            </div>
          </div>
          <div className="h-px bg-foreground/10" />
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <div className="font-display text-2xl font-bold tracking-tight text-amber-500">{(profile.total_sips ?? 0).toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Total sips all time</div>
          </div>
        </div>
      </div>}

      <Button
        variant="ghost"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={async () => {
          await signOutAccount();
          toast({ title: "Signed out" });
          onSignedOut?.();
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
};

export default ProfilePanel;
