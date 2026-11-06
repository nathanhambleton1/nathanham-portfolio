import React, { useEffect, useState, useRef } from 'react';
import { Lock, ChevronDown } from 'lucide-react';

type SipBatch = { id: string; count: number };

export default function SipsLockOverlay({
  open,
  batches = [],
  onDismissBatch,
  processing,
  onClearAll,
}: {
  open: boolean;
  batches?: SipBatch[];
  onDismissBatch: () => void;
  processing?: boolean;
  onClearAll?: () => Promise<void> | void;
  // legacy compat — no longer used
  sipCount?: number;
  onDone?: () => void;
  currentBalance?: number | null;
  players?: any[];
  showBalances?: boolean;
  currentPlayerId?: string | number | null;
  currentPlayer?: any | null;
  allowGiveSips?: boolean;
  onAssignSips?: (...args: any[]) => any;
  onPaySubmit?: (...args: any[]) => any;
  onOpenCollect?: () => void;
  onCollect?: (...args: any[]) => any;
}) {
  const [fanned, setFanned] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [displayedBatches, setDisplayedBatches] = useState<SipBatch[]>(batches);
  const [closing, setClosing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const prevFrontIdRef = React.useRef<string | null>(null);
  const frontIsNew =
    batches.length > 0 &&
    prevFrontIdRef.current !== null &&
    prevFrontIdRef.current !== batches[0]?.id;
  React.useLayoutEffect(() => {
    prevFrontIdRef.current = batches[0]?.id ?? null;
  });

  useEffect(() => {
    if (!open) setFanned(false);
    // Sync displayed batches when prop changes
    setDisplayedBatches(batches);
  }, [open]);

  const triggerCloseFan = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setFanned(false);
    }, 380);
  };

  useEffect(() => {
    setDisplayedBatches(batches);
  }, [batches]);

  if (!open || displayedBatches.length === 0) return null;

  const frontBatch = displayedBatches[0];
  const totalSips = displayedBatches.reduce((s, b) => s + b.count, 0);
  const canOpenFan = displayedBatches.length > 0;
  const peekBatches = displayedBatches.slice(1, 6);
  const peekCount = peekBatches.length;

  // Per-depth: [translateY-up, scale, opacity] — lift increments taper off each level
  const peekStyle: [number, number, number][] = [
    [22, 0.93, 1],   // depth 1 (+22)
    [34, 0.86, 1],   // depth 2 (+12)
    [42, 0.80, 1],   // depth 3 (+8)
    [47, 0.75, 1],   // depth 4 (+5)
    [50, 0.71, 1],   // depth 5 (+3)
  ];

  const handleDone = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (processing || dismissingId) return;
    const id = frontBatch.id;
    setDismissingId(id);
    // Animate out, then call parent to advance queue / clear in DB
    setTimeout(() => {
      setDismissingId(null);
      try { onDismissBatch(); } catch (err) { /* ignore */ }
    }, 260);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const forwardWheel = (e: React.WheelEvent) => {
    // Forward wheel scrolling to window so background scrolls
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches?.[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const y = e.touches?.[0]?.clientY ?? 0;
    const delta = touchStartY.current - y;
    touchStartY.current = y;
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
    }
  };

  const handleClearAllAnimated = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (processing || dismissingId) return;
    // Animate each displayed batch out in sequence
    const local = [...displayedBatches];
    for (const b of local) {
      setDismissingId(b.id);
      await sleep(220);
      setDisplayedBatches((prev) => prev.filter((x) => x.id !== b.id));
      setDismissingId(null);
      await sleep(40);
    }
    // After animation complete, ask parent to clear in DB
    try {
      if (onClearAll) await onClearAll();
    } catch (err) {
      console.error('onClearAll failed', err);
    }
  };

  return (
    <>
      <style>{`
        @keyframes sips-in {
          from { transform: translateY(110%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes sips-dismiss {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to   { transform: translateY(-48px) scale(0.88); opacity: 0; }
        }
        @keyframes sips-promote {
          from { transform: translateY(-10px) scale(0.94); opacity: 0.85; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes sips-fan-item {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sips-fan-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(110%) scale(0.98); }
        }
      `}</style>

      {/* Backdrop — only rendered when fanned, clicking it closes the fan */}
      {fanned && (
        <div
          className="fixed inset-0 z-[100000]"
          style={{
            background: closing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.25)',
            backdropFilter: closing ? 'blur(0px)' : 'blur(6px)',
            WebkitBackdropFilter: closing ? 'blur(0px)' : 'blur(6px)',
            touchAction: 'none',
            transition: 'opacity 0.42s ease, backdrop-filter 0.42s ease, -webkit-backdrop-filter 0.42s ease, background 0.42s ease',
            opacity: closing ? 0 : 1,
          }}
          onClick={() => triggerCloseFan()}
          onWheel={forwardWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        />
      )}

      {/* Bar + stack */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100001] px-4 sm:px-6"
        style={{ animation: 'sips-in 0.35s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}
      >
        {/* ── FANNED view ── */}
        {fanned && (
          <div
            className="pb-4 sm:pb-5 flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
            onWheel={forwardWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{ touchAction: 'none' }}
          >
            {/* Down arrow to close */}
            {/* Header row aligned to card width: collapse chevron centered above total, Clear all aligned with right edge of cards */}
              <div
                className="w-full max-w-lg mx-auto"
                onClick={(e) => e.stopPropagation()}
                style={{
                  animation: closing ? undefined : 'sips-fan-item 0.15s ease-out both',
                  transition: 'transform 0.28s ease, opacity 0.28s ease',
                  transform: closing ? 'translateY(8px)' : undefined,
                  opacity: closing ? 0 : 1,
                }}
              >
              <div className="flex justify-center mb-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); triggerCloseFan(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-background/80 text-muted-foreground backdrop-blur-xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Collapse"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full border border-foreground/10 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
                    <span className="truncate">
                      {totalSips} total sip{totalSips !== 1 ? 's' : ''} · {displayedBatches.length} round{displayedBatches.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                </div>
                <div className="flex flex-shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={handleClearAllAnimated}
                    className="h-10 rounded-full border border-foreground/10 bg-background/80 px-4 text-xs font-medium text-muted-foreground backdrop-blur-xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Clear all pending sips"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </div>
            {/* Cards listed newest on top, current (active) at bottom */}
            {[...displayedBatches].reverse().map((batch, i) => {
              const isActive = batch.id === frontBatch.id;
              const depthFromFront = Math.max(0, displayedBatches.length - 1 - i);
              // Non-active cards fade out + drift down slightly; active card stays in place
              const closingDelay = `${depthFromFront * 0.03}s`;

              return (
                <div
                  key={batch.id}
                  className={`w-full max-w-lg mx-auto rounded-2xl border px-4 py-3 flex items-center gap-3 bg-background/90 backdrop-blur-xl backdrop-saturate-150 ${
                    isActive
                      ? 'border-brand/30 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.75),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]'
                      : 'border-foreground/10 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]'
                  }`}
                  style={{
                    opacity: closing && !isActive ? 0 : (isActive ? 1 : 0.6),
                    animation: dismissingId === batch.id
                      ? 'sips-dismiss 0.26s cubic-bezier(0.4,0,1,1) forwards'
                      : closing
                      ? undefined
                      : `sips-fan-item 0.18s ease-out ${i * 0.04}s both`,
                    transform: closing && !isActive ? 'translateY(10px) scale(0.97)' : undefined,
                    transition: closing ? `transform 0.32s ease ${closingDelay}, opacity 0.28s ease ${closingDelay}` : undefined,
                    overflow: 'hidden',
                    touchAction: 'none',
                  }}
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                      isActive
                        ? 'bg-brand/10 text-brand ring-brand/20'
                        : 'bg-foreground/[0.06] text-muted-foreground ring-foreground/10'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-display font-semibold tracking-tight text-sm text-foreground">
                      {batch.count} sip{batch.count !== 1 ? 's' : ''}{isActive ? ' pending' : ''}
                    </span>
                    {isActive && (
                      <div className="text-xs leading-tight truncate text-muted-foreground">
                        Drink up, then tap done
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <button
                      type="button"
                      disabled={!!processing}
                      onClick={handleDone}
                      className="flex-shrink-0 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.12)] transition hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      style={{
                        opacity: processing ? 0.7 : 1,
                        cursor: processing ? 'wait' : 'pointer',
                      }}
                    >
                      Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STACKED view ── */}
        {!fanned && (
          <div
            className="pb-4 sm:pb-5"
            style={{ paddingTop: `${peekCount > 0 ? peekStyle[peekCount - 1][0] + 6 : 0}px` }}
          >
            <div className="relative w-full max-w-lg mx-auto">
              {/* Peek cards behind the front — rendered back-to-front so front card is on top */}
              {[...peekBatches].reverse().map((_, ri) => {
                const i = peekBatches.length - 1 - ri;
                const [lift, scale, opacity] = peekStyle[i];
                return (
                  <div
                    key={i}
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 rounded-2xl border border-foreground/10 bg-background/90 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-2px_32px_rgb(0_0_0/0.35),0_4px_24px_rgb(0_0_0/0.2),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]"
                    style={{
                      height: '64px',
                      transform: `translateY(-${lift}px) scale(${scale})`,
                      transformOrigin: 'bottom center',
                      opacity,
                      zIndex: 10 - i,
                      transition: 'transform 0.3s cubic-bezier(0.34,1.3,0.64,1), opacity 0.3s ease',
                    }}
                  />
                );
              })}

              {/* Front card — tap it (not Done) to open fan */}
              <div
                className="relative rounded-2xl border border-brand/30 bg-background/90 backdrop-blur-xl backdrop-saturate-150 px-4 py-3 flex items-center gap-3 shadow-[0_-2px_32px_rgb(0_0_0/0.35),0_4px_24px_rgb(0_0_0/0.2),inset_0_1px_0_0_hsl(var(--foreground)/0.06)]"
                style={{
                  zIndex: 30,
                  cursor: canOpenFan ? 'pointer' : 'default',
                  animation: dismissingId === frontBatch.id
                    ? 'sips-dismiss 0.26s cubic-bezier(0.4,0,1,1) forwards'
                    : frontIsNew
                    ? 'sips-promote 0.28s cubic-bezier(0.34,1.3,0.64,1) both'
                    : undefined,
                }}
                onClick={() => { if (canOpenFan) setFanned(true); }}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                  <Lock className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold tracking-tight text-sm leading-tight truncate text-foreground">
                    {frontBatch.count} sip{frontBatch.count !== 1 ? 's' : ''} pending
                  </div>
                  <div className="mt-0.5 text-xs leading-tight truncate text-muted-foreground">
                    Drink up, then tap done
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!!processing || !!dismissingId}
                  aria-disabled={!!processing}
                  className="flex-shrink-0 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.12)] transition hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  style={{
                    opacity: processing ? 0.7 : 1,
                    cursor: processing ? 'wait' : 'pointer',
                  }}
                  onClick={handleDone}
                >
                  {processing ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        style={{ animation: 'spin 1s linear infinite' }}>
                        <style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M22 12a10 10 0 00-10-10" strokeLinecap="round" />
                      </svg>
                      Wait…
                    </span>
                  ) : 'Done'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
