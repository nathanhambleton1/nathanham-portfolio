import React from 'react';
import { Lock } from 'lucide-react';

export default function SipsLockOverlay({
  open,
  sipCount,
  onDone,
  processing,
}: {
  open: boolean;
  sipCount: number;
  onDone: () => void;
  processing?: boolean;
  // Legacy props kept for call-site compatibility — no longer used
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
  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes sips-bar-in {
          from { transform: translateY(110%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        className="fixed bottom-0 left-0 right-0 z-[100001] px-4 pb-4 sm:px-6 sm:pb-5"
        style={{ animation: 'sips-bar-in 0.35s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}
      >
        <div
          className="w-full max-w-lg mx-auto rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: 'hsl(var(--background) / 0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid hsl(var(--border) / 0.25)',
            boxShadow: '0 -2px 32px rgba(0,0,0,0.35), 0 4px 24px rgba(0,0,0,0.2)',
          }}
        >
          {/* Lock icon + sip count */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--foreground) / 0.7)' }} />
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate" style={{ color: 'hsl(var(--foreground))' }}>
                {sipCount} sip{sipCount !== 1 ? 's' : ''} pending
              </div>
              <div className="text-xs leading-tight truncate" style={{ color: 'hsl(var(--foreground) / 0.5)' }}>
                Drink up, then tap done
              </div>
            </div>
          </div>

          {/* Done button */}
          <button
            type="button"
            disabled={!!processing}
            aria-disabled={!!processing}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              opacity: processing ? 0.7 : 1,
              cursor: processing ? 'wait' : 'pointer',
            }}
            onClick={() => { if (!processing) onDone(); }}
          >
            {processing ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M22 12a10 10 0 00-10-10" strokeLinecap="round" />
                </svg>
                Wait…
              </span>
            ) : 'Done'}
          </button>
        </div>
      </div>
    </>
  );
}
