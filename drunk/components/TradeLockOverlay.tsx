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
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  
  // Initialize alarm audio on mount
  useEffect(() => {
    try {
      const a = new Audio('/alarm.mp3');
      a.preload = 'auto';
      a.volume = 0.85;
      a.loop = true;
      audioRef.current = a;
      // Load the audio immediately
      a.load();
    } catch (e) {
      console.warn('Alarm audio init failed', e);
    }
    
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {}
      }
    };
  }, []);

  // Update timer display
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [open]);

  // Handle expiration: flash effect and alarm sound
  useEffect(() => {
    if (!open) return;
    const expires = expiresAt ? new Date(expiresAt).getTime() : null;
    const expiredNow = expires ? (expires - Date.now() <= 0) : false;
    let iv: number | null = null;
    if (expiredNow) {
      setFlash(true);
      iv = window.setInterval(() => setFlash((v) => !v), 200);
      // Start alarm audio on expiry
      try {
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          // Use play() with promise handling for better browser compatibility
          const playPromise = a.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('Alarm play failed (may be blocked by browser):', err);
            });
          }
        }
      } catch (err) {
        console.warn('Alarm play error:', err);
      }
    } else {
      setFlash(false);
      // Stop alarm if running
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {}
      }
    }
    return () => { if (iv) clearInterval(iv); };
  }, [open, expiresAt, now]);

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
            className={`text-5xl font-extrabold mb-2 transition-all duration-300 ${expired ? 'text-red-600' : 'text-white'}`}
            style={
              expired
                ? (flash 
                    ? { 
                        textShadow: '0 0 40px rgba(220,38,38,1), 0 0 20px rgba(220,38,38,0.8), 0 0 10px rgba(220,38,38,0.6)', 
                        transform: 'scale(1.05)' 
                      } 
                    : { 
                        textShadow: '0 0 20px rgba(220,38,38,0.7), 0 0 10px rgba(220,38,38,0.5)' 
                      })
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
              className={`w-full px-4 py-3 rounded text-lg bg-white text-black border border-transparent`}
              onClick={() => {
                // stop alarm when user dismisses
                if (audioRef.current) {
                  try {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  } catch (e) {}
                }
                onDone();
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
