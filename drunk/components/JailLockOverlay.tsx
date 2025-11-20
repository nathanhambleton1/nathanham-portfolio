import React from 'react';

export default function JailLockOverlay({
  open,
  jailedByName,
  hasGetOutCard,
  currentBalance,
  payProcessing,
  cardProcessing,
  onPayToGetOut,
  onUseCard,
}: {
  open: boolean;
  jailedByName?: string | null;
  hasGetOutCard?: boolean;
  currentBalance?: number | null;
  payProcessing?: boolean;
  cardProcessing?: boolean;
  onPayToGetOut: () => void;
  onUseCard: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-40 min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center text-white p-12 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto mb-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="10" width="18" height="11" rx="2" />
            <path d="M7 10V7a5 5 0 0110 0v3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 13v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div className="text-2xl font-bold mb-2">You're in Jail</div>
          {jailedByName && <div className="text-sm text-white/80 mb-2">Sent to jail by {jailedByName}</div>}
          <div className="text-sm text-white/80 mb-2">Balance: ${Number(currentBalance ?? 0).toLocaleString()}</div>

          <div className="mb-6 text-white/90 text-sm">
            Your screen is locked while you're in jail. Choose an option to get out.
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={!!payProcessing}
              aria-disabled={!!payProcessing}
              className={`w-full px-4 py-3 rounded text-lg bg-white text-black transition-opacity duration-150 ${payProcessing ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:opacity-95'}`}
              onClick={() => { if (!payProcessing) onPayToGetOut(); }}
            >
              {payProcessing ? 'Processing…' : 'Pay $50 to get out'}
            </button>
            <button
              type="button"
              disabled={!!cardProcessing}
              aria-disabled={!!cardProcessing}
              className={`w-full px-4 py-3 rounded text-lg border border-white/20 transition-colors duration-150 focus:outline-none ${cardProcessing ? 'opacity-70 cursor-wait' : 'bg-transparent text-white cursor-pointer hover:bg-white/10'}`}
              onClick={() => { if (!cardProcessing) onUseCard(); }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !cardProcessing) { e.preventDefault(); onUseCard(); } }}
            >
              {cardProcessing ? "Using card…" : "Use 'Get Out of Jail Free' card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
