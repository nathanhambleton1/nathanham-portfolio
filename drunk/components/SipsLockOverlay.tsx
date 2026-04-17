import React, { useEffect, useState } from 'react';
import { Lock, ChevronDown } from 'lucide-react';

type SipBatch = { id: string; count: number };

export default function SipsLockOverlay({
  open,
  batches = [],
  onDismissBatch,
  processing,
}: {
  open: boolean;
  batches?: SipBatch[];
  onDismissBatch: () => void;
  processing?: boolean;
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
  }, [open]);

  if (!open || batches.length === 0) return null;

  const frontBatch = batches[0];
  const totalSips = batches.reduce((s, b) => s + b.count, 0);
  const hasStack = batches.length > 1;
  const peekBatches = batches.slice(1, 6);
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
    setDismissingId(frontBatch.id);
    setFanned(false);
    setTimeout(() => {
      setDismissingId(null);
      onDismissBatch();
    }, 260);
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
      `}</style>

      {/* Backdrop — only rendered when fanned, clicking it closes the fan */}
      {fanned && (
        <div
          className="fixed inset-0 z-[100000]"
          style={{
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setFanned(false)}
        />
      )}

      {/* Bar + stack */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100001] px-4 sm:px-6"
        style={{ animation: 'sips-in 0.35s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}
      >
        {/* ── FANNED view ── */}
        {fanned && (
          <div className="pb-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Down arrow to close */}
            <div className="flex justify-center" style={{ animation: 'sips-fan-item 0.15s ease-out both' }}>
              <button
                type="button"
                onClick={() => setFanned(false)}
                className="p-1.5 rounded-full"
                style={{ color: 'hsl(var(--foreground) / 0.7)', background: 'hsl(var(--background) / 0.6)' }}
                aria-label="Collapse"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
            {/* Total header */}
            <div
              className="text-center text-xs font-medium"
              style={{ color: 'hsl(var(--foreground) / 0.85)', animation: 'sips-fan-item 0.15s ease-out both' }}
            >
              {totalSips} total sip{totalSips !== 1 ? 's' : ''} · {batches.length} round{batches.length !== 1 ? 's' : ''}
            </div>

            {/* Cards listed newest on top, current (active) at bottom */}
            {[...batches].reverse().map((batch, i) => {
              const isActive = batch.id === frontBatch.id;
              return (
                <div
                  key={batch.id}
                  className="w-full max-w-lg mx-auto rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: 'hsl(var(--background))',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid hsl(var(--foreground) / 0.18)',
                    boxShadow: isActive ? '0 4px 20px rgba(0,0,0,0.18)' : 'none',
                    opacity: isActive ? 1 : 0.6,
                    animation: `sips-fan-item 0.18s ease-out ${i * 0.04}s both`,
                  }}
                >
                  <Lock
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: `hsl(var(--foreground) / ${isActive ? '0.7' : '0.4'})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-semibold text-sm"
                      style={{ color: 'hsl(var(--foreground))' }}
                    >
                      {batch.count} sip{batch.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isActive && (
                    <button
                      type="button"
                      disabled={!!processing}
                      onClick={handleDone}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{
                        background: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
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
                    className="absolute inset-x-0 bottom-0 rounded-2xl"
                    style={{
                      height: '58px',
                      transform: `translateY(-${lift}px) scale(${scale})`,
                      transformOrigin: 'bottom center',
                      opacity,
                      background: 'hsl(var(--background))',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      border: '1px solid hsl(var(--foreground) / 0.18)',
                      boxShadow: '0 -2px 32px rgba(0,0,0,0.35), 0 4px 24px rgba(0,0,0,0.2)',
                      zIndex: 10 - i,
                      transition: 'transform 0.3s cubic-bezier(0.34,1.3,0.64,1), opacity 0.3s ease',
                    }}
                  />
                );
              })}

              {/* Front card — tap it (not Done) to open fan */}
              <div
                className="relative rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: 'hsl(var(--background))',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid hsl(var(--foreground) / 0.18)',
                  boxShadow: '0 -2px 32px rgba(0,0,0,0.35), 0 4px 24px rgba(0,0,0,0.2)',
                  zIndex: 30,
                  cursor: hasStack ? 'pointer' : 'default',
                  animation: dismissingId === frontBatch.id
                    ? 'sips-dismiss 0.26s cubic-bezier(0.4,0,1,1) forwards'
                    : frontIsNew
                    ? 'sips-promote 0.28s cubic-bezier(0.34,1.3,0.64,1) both'
                    : undefined,
                }}
                onClick={() => { if (hasStack) setFanned(true); }}
              >
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--foreground) / 0.7)' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {frontBatch.count} sip{frontBatch.count !== 1 ? 's' : ''} pending
                  </div>
                  <div className="text-xs leading-tight truncate" style={{ color: 'hsl(var(--foreground) / 0.5)' }}>
                    Drink up, then tap done
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!!processing || !!dismissingId}
                  aria-disabled={!!processing}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{
                    background: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
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
