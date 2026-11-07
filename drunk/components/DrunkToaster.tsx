import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { useToast, registerCustomToaster } from "@/hooks/use-toast";
import { cn } from "../lib/utils";
import { ART } from "./boardPieces";
import { streetColor, type PropertyColor } from "./BoardArt";

/**
 * Drunkopoly notifications, drawn as cards from the deck.
 *
 * Every `toast({...})` call in the Drunkopoly pages lands here (same global
 * store as the stock shadcn toaster, which stands down while this is mounted).
 * Each toast flips down from the top of the screen as a cream card-stock card
 * with an engraved border, a board illustration and a rubber stamp that slams
 * on after it lands. Tap the card or flick it up to dismiss.
 */

type Kind = "denied" | "approved" | "telegram" | "notice";

const KINDS: Record<Kind, { deck: string; stamp: string; ink: string; band: PropertyColor }> = {
  denied: { deck: "Bank notice", stamp: "Denied", ink: "#b3261e", band: "red" },
  approved: { deck: "Receipt", stamp: "Approved", ink: "#1f6b40", band: "green" },
  telegram: { deck: "Telegram", stamp: "Urgent", ink: "#24497f", band: "dark-blue" },
  notice: { deck: "House rules", stamp: "Notice", ink: "#9a5b12", band: "orange" },
};

const DURATION: Record<Kind, number> = { denied: 3500, approved: 2200, telegram: 4500, notice: 2800 };

const text = (n: React.ReactNode) => (typeof n === "string" || typeof n === "number" ? String(n) : "");

function kindFor(variant: string | null | undefined, title: string): Kind {
  const t = title.toLowerCase();
  if (variant === "destructive") return "denied";
  if (/fail|incorrect|not allowed|insufficient|invalid|missing|unable|error|not found|can'?t|cannot|wrong/.test(t)) return "denied";
  if (/message/.test(t)) return "telegram";
  if (/updated|copied|unlocked|signed in|signed out|moved over|removed|saved|success/.test(t)) return "approved";
  return "notice";
}

/** Pick board artwork that matches what the toast is about. */
function artFor(kind: Kind, haystack: string): string | null {
  const t = haystack.toLowerCase();
  if (kind === "telegram") return null; // gets the envelope
  if (/jail/.test(t)) return ART.jail;
  if (/insufficient|fund|payment|balance|money|\$/.test(t)) return kind === "denied" ? ART.bank : ART.money;
  if (/sip/.test(t)) return ART.sips;
  if (/timer/.test(t)) return ART.tradeTimer;
  if (/bankrupt|tax/.test(t)) return ART.tax;
  if (/invite|player|join|game/.test(t) && kind !== "denied") return ART.passGo;
  if (kind === "denied") return ART.police;
  if (kind === "approved") return ART.money;
  return ART.passGo;
}

const PAPER = "#f4ecd8";
const INK = "#2a2118";

const Envelope = ({ color }: { color: string }) => (
  <svg viewBox="0 0 64 48" aria-hidden className="h-full w-full -rotate-6 drop-shadow-[0_2px_0_rgba(42,33,24,0.25)]">
    <rect x="3" y="5" width="58" height="38" rx="3" fill="#fffaf0" stroke={INK} strokeWidth="2.5" />
    <path d="M4 7 L32 28 L60 7" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M4 41 L24 22 M60 41 L40 22" stroke={INK} strokeWidth="1.5" opacity="0.4" />
    <circle cx="32" cy="28" r="7" fill={color} stroke={INK} strokeWidth="2" />
    <path d="M29 28h6M32 25v6" stroke="#fffaf0" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default function DrunkToaster() {
  const { toasts } = useToast();

  React.useEffect(() => registerCustomToaster(), []);

  return (
    <ToastPrimitives.Provider swipeDirection="up" swipeThreshold={30}>
      {toasts.map(({ id, title, description, action, variant, duration, className, ...props }) => {
        const titleText = text(title);
        const descText = text(description);
        const kind = kindFor(variant, titleText);
        const { deck, stamp, ink, band } = KINDS[kind];
        const art = artFor(kind, `${titleText} ${descText}`);
        const deckLabel = art === ART.police ? "Citation" : art === ART.jail ? "Jail" : deck;
        const isTelegram = kind === "telegram";

        return (
          <ToastPrimitives.Root
            key={id}
            duration={duration ?? DURATION[kind]}
            className={cn(
              "drunk-card-toast group pointer-events-auto relative w-full select-none [perspective:900px]",
              "data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none",
              "data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform",
              className,
            )}
            {...props}
          >
            <div
              className="drunk-card-face relative overflow-hidden rounded-[10px] border-2 p-[5px] shadow-[0_14px_30px_-10px_rgb(0_0_0/0.85)]"
              style={{
                borderColor: INK,
                color: INK,
                backgroundColor: PAPER,
                backgroundImage:
                  "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.55), transparent 45%), radial-gradient(circle at 85% 90%, rgba(120,90,40,0.12), transparent 50%)",
              }}
            >
              {/* Engraved inner rule, like a printed card */}
              <div className="relative flex items-stretch gap-3 rounded-[6px] border-[1.5px] border-dashed p-2.5 pr-3" style={{ borderColor: `${INK}55` }}>
                {/* Illustration in a little board space */}
                <div className="flex w-[64px] shrink-0 flex-col overflow-hidden rounded-[4px] border-[1.5px] bg-[#fffaf0]" style={{ borderColor: INK }}>
                  <span className="h-2.5 shrink-0 border-b-[1.5px]" style={{ backgroundColor: streetColor(band), borderColor: INK }} />
                  <span className="flex flex-1 items-center justify-center p-1.5">
                    {art ? (
                      <img src={art} alt="" draggable={false} className="h-[46px] w-[46px] object-contain drop-shadow-[0_2px_0_rgba(42,33,24,0.2)]" />
                    ) : (
                      <span className="h-[38px] w-[46px]">
                        <Envelope color={ink} />
                      </span>
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center gap-1.5 font-board text-[10px] font-semibold uppercase leading-none tracking-[0.24em]" style={{ color: `${INK}99` }}>
                    <span aria-hidden className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: ink }} />
                    <span style={{ color: ink }}>{deckLabel}</span>
                  </div>

                  {title && (
                    <ToastPrimitives.Title className="mt-1.5 pr-14 font-board text-[18px] font-bold uppercase leading-[1.05] tracking-[0.02em] break-words">
                      {title}
                    </ToastPrimitives.Title>
                  )}

                  {description && (
                    <ToastPrimitives.Description
                      className={cn(
                        "mt-1 line-clamp-4 break-words leading-snug",
                        isTelegram ? "font-mono text-[12.5px] uppercase tracking-tight" : "font-display text-[14px] font-medium",
                      )}
                      style={{ color: `${INK}cc` }}
                    >
                      {description}
                      {isTelegram && <span className="ml-1 font-bold" style={{ color: ink }}>STOP.</span>}
                    </ToastPrimitives.Description>
                  )}

                  {action && <div className="relative z-10 mt-2">{action}</div>}
                </div>
              </div>

              {/* Rubber stamp */}
              <span
                aria-hidden
                className="drunk-stamp pointer-events-none absolute right-2.5 top-2.5 rounded-[4px] border-[2.5px] px-1.5 py-0.5 font-board text-[12px] font-bold uppercase leading-none tracking-[0.18em] mix-blend-multiply"
                style={{ color: ink, borderColor: ink, boxShadow: `inset 0 0 0 1px ${PAPER}, inset 0 0 0 2px ${ink}` }}
              >
                {stamp}
              </span>
            </div>

            {/* Whole card is the dismiss target — easy to hit on a phone */}
            <ToastPrimitives.Close aria-label="Dismiss notification" className="absolute inset-0 z-0 rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70" />
          </ToastPrimitives.Root>
        );
      })}
      {/* iOS Safari (26+) tints the status bar from whatever fixed element sits
          at the top edge, and doesn't re-check once it's gone. This strip pins
          that to the page background, above any card that's swiped up into it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[201] h-[max(4px,env(safe-area-inset-top))] bg-background"
      />
      {/* Kept off the very top edge on purpose: iOS Safari tints its status bar
          from fixed elements touching the top, and would stay cream after the
          card leaves. */}
      <ToastPrimitives.Viewport className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[200] mx-auto flex max-h-screen w-full max-w-[440px] flex-col gap-3 px-3 outline-none sm:top-5" />
    </ToastPrimitives.Provider>
  );
}
