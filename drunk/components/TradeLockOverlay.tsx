import React, { useEffect, useState } from 'react';

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TradeLockOverlay({
  open,
  expiresAt,
  startedByName,
  onDone,
}: {
  open: boolean;
  expiresAt?: string | null;
  startedByName?: string | null;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [open]);

  // fast flash toggle when expired to create a rapid pulse/glow effect
  useEffect(() => {
    if (!open) return;
    const expires = expiresAt ? new Date(expiresAt).getTime() : null;
    const expiredNow = expires ? (expires - Date.now() <= 0) : false;
    let iv: number | null = null;
    if (expiredNow) {
      setFlash(true);
      iv = window.setInterval(() => setFlash((v) => !v), 200);
    } else {
      setFlash(false);
    }
    return () => { if (iv) clearInterval(iv); };
  }, [open, expiresAt]);

  if (!open) return null;

  const expires = expiresAt ? new Date(expiresAt).getTime() : null;
  const remainingMs = expires ? expires - now : null;
  const expired = remainingMs !== null ? remainingMs <= 0 : false;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-40 min-h-screen flex items-center justify-center px-6">
        <div className={`max-w-lg w-full text-center text-white p-12 rounded`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto mb-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
            <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={1.5} />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0110 0v2" />
          </svg>

          <div className="text-2xl font-bold mb-2">Trade Timer Countdown</div>
          <h2
            className={`text-5xl font-extrabold mb-2 ${expired ? 'text-red-500' : 'text-white'}`}
            style={
              expired
                ? (flash ? { textShadow: '0 0 28px rgba(239,68,68,0.95)', transform: 'scale(1.04)' } : { textShadow: '0 0 8px rgba(239,68,68,0.6)' })
                : undefined
            }
          >
            {formatRemaining(remainingMs ?? 0)}
          </h2>
          {startedByName && <div className="text-sm text-white/80 mb-4">Started by {startedByName}</div>}

          <div className="mb-6 text-white/90 text-sm">
            The trade UI is locked for the duration. When finished, press Done to unlock for everyone.
          </div>

          <div className="w-full">
            <button
              className={`w-full px-4 py-3 rounded text-lg bg-white text-black border ${expired ? 'border-red-500' : 'border-transparent'}`}
              style={expired && flash ? { boxShadow: '0 0 18px rgba(239,68,68,0.75)' } : undefined}
              onClick={onDone}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
