import React, { useEffect, useState } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { setDropdownOpen } from './ui/dropdown-menu';
import { ChevronDown, Info, DollarSign, UserPlus, MoreVertical, Users } from 'lucide-react';
import SipPopup from './SipPopup';
import PayPopup from './PayPopup';
import CollectPopup from './CollectPopup';

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
  currentBalance,
  players,
  showBalances = false,
  currentPlayerId,
  currentPlayer,
  allowGiveSips,
  onAssignSips,
  onPaySubmit,
  onOpenCollect,
  onCollect,
}: {
  open: boolean;
  expiresAt?: string | null;
  startedByName?: string | null;
  onDone: () => void;
  currentBalance?: number | null;
  players?: any[];
  showBalances?: boolean;
  currentPlayerId?: string | number | null;
  currentPlayer?: any | null;
  allowGiveSips?: boolean;
  onAssignSips?: (to: string | string[], sip_count: number) => Promise<void> | void;
  onPaySubmit?: (payments: { to: string | null; amount: number }[], opts?: { freeParking?: boolean; description?: string | null; mode?: 'bank' | 'players' | 'tax' }) => Promise<void> | void;
  onOpenCollect?: () => void;
  onCollect?: (opts: any) => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<'bank' | 'players' | 'tax' | null>('bank');
  
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

  useLockBodyScroll(!!open, { scrollToTop: true });

  React.useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  // Ensure any internal popup state is reset when the overlay opens so it
  // doesn't auto-open stale dialogs from previous mounts.
  useEffect(() => {
    if (open) {
      setSipModalOpen(false);
      setPayModalOpen(false);
    }
  }, [open]);

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
    <div className="fixed inset-0 z-[99999] pointer-events-auto">
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-[99999] min-h-screen flex items-center justify-center px-6">
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
          {/* Collapsible sections: Balances (open by default) and Info */}
          {/* Persist open/closed state in localStorage */}
          <BalancesAndInfo
            startedByName={startedByName}
            currentBalance={currentBalance}
            players={players}
            showBalances={showBalances}
            currentPlayerId={currentPlayerId}
            onOpenSip={() => setSipModalOpen(true)}
            onOpenPay={(mode: 'bank' | 'players' | 'tax') => { setPayMode(mode ?? 'bank'); setPayModalOpen(true); }}
            onOpenCollect={() => setCollectModalOpen(true)}
            allowGiveSips={!!allowGiveSips}
          />

          <SipPopup
            open={sipModalOpen}
            onOpenChange={(v) => setSipModalOpen(v)}
            currentPlayer={currentPlayer ?? null}
            players={players ?? []}
            allowSelf={!!allowGiveSips}
            onSubmit={async (to, sip_count) => {
              if (!onAssignSips) return;
              try {
                await onAssignSips(to, sip_count);
              } catch (err) {
                console.error('Assign sips error from TradeLockOverlay:', err);
                throw err;
              }
            }}
          />

          <PayPopup
            open={payModalOpen}
            onOpenChange={(v) => setPayModalOpen(v)}
            mode={payMode}
            currentPlayer={currentPlayer ?? null}
            players={players ?? []}
            showBalances={showBalances}
            onSubmit={async (payments, opts) => {
              if (!onPaySubmit) return;
              try {
                await onPaySubmit(payments, { ...(opts || {}), mode: (payMode ?? 'bank') });
              } catch (err) {
                console.error('PayPopup submit error from TradeLockOverlay:', err);
                throw err;
              }
            }}
          />

          <CollectPopup
            open={collectModalOpen}
            onOpenChange={(v) => setCollectModalOpen(v)}
            mode={'bank'}
            currentPlayer={currentPlayer}
            game={null}
            onCollect={async (opts) => {
              if (!onCollect || !currentPlayer) return;
              try {
                await onCollect(opts);
              } catch (err) {
                console.error('Collect error from TradeLockOverlay:', err);
                throw err;
              }
            }}
          />

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

function BalancesAndInfo({
  startedByName,
  currentBalance,
  players,
  showBalances,
  currentPlayerId,
  onOpenSip,
  onOpenPay,
  onOpenCollect,
  allowGiveSips,
}: {
  startedByName?: string | null;
  currentBalance?: number | null;
  players?: any[];
  showBalances?: boolean;
  currentPlayerId?: string | number | null;
  onOpenSip?: () => void;
  onOpenPay?: (mode: 'bank' | 'players' | 'tax') => void;
  onOpenCollect?: () => void;
  allowGiveSips?: boolean;
}) {
  // only one section may be open at a time: 'actions' | 'balances' | 'info' | null
  // All dropdowns start closed by default (no localStorage persistence)
  const [openSection, setOpenSection] = useState<'actions' | 'balances' | 'info' | null>(null);

  // determine if the current player is bankrupt so we can hide payment actions
  const current = (players || []).find((p) => String(p.id) === String(currentPlayerId));
  const isBankrupt = !!current?.is_bankrupt;
  // only show non-bankrupt (active) players in the balances list
  const activePlayers = (players || []).filter((p) => !p.is_bankrupt);

  const actionsCaption = isBankrupt
    ? 'Give Sips'
    : (allowGiveSips ? 'Give sips, pay bank, and more' : 'Pay bank and players');

  return (
    <div className="mb-6 text-left">
      <div className="space-y-3">
        <div>
          <button
            type="button"
            onClick={() => setOpenSection((v) => (v === 'actions' ? null : 'actions'))}
            className="w-full flex items-center justify-between gap-3 p-3 rounded bg-white/5 hover:bg-white/8"
            aria-expanded={openSection === 'actions'}
          >
            <div className="flex items-center gap-3">
              <MoreVertical className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Actions</div>
                <div className="text-sm text-white/80">{actionsCaption}</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 transform-gpu"
              style={{ transform: openSection === 'actions' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'actions' && (
            <div className="mt-3 px-0">
              <div className="rounded bg-white/5 border border-white/8 p-3">
                <div className="space-y-2">
                  {/* If player is bankrupt, hide collect/pay buttons and only show Give Sips */}
                  {(allowGiveSips || isBankrupt) && (
                    <button
                      type="button"
                      onClick={() => { onOpenSip && onOpenSip(); }}
                      className={`w-full text-left p-2 rounded bg-transparent flex items-center gap-2 hover:bg-white/6`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Give Sips</span>
                    </button>
                  )}

                  {!isBankrupt && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenCollect && onOpenCollect()}
                        className="w-full text-left p-2 rounded bg-transparent flex items-center gap-2 hover:bg-white/6"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Collect From Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPay && onOpenPay('bank')}
                        className="w-full text-left p-2 rounded bg-transparent flex items-center gap-2 hover:bg-white/6"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Pay Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenPay && onOpenPay('players')}
                        className="w-full text-left p-2 rounded bg-transparent flex items-center gap-2 hover:bg-white/6"
                      >
                        <Users className="w-4 h-4" />
                        <span>Pay Players</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpenSection((v) => (v === 'balances' ? null : 'balances'))}
            className="w-full flex items-center justify-between gap-3 p-3 rounded bg-white/5 hover:bg-white/8"
            aria-expanded={openSection === 'balances'}
          >
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Balances</div>
                <div className="text-sm text-white/80">Your balance and others</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 transform-gpu"
              style={{ transform: openSection === 'balances' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'balances' && (
            <div className="mt-3 px-0">
              <div className="rounded bg-white/5 border border-white/8 p-3">
                {/* unified list: current player first, then others */}
                <div className="text-sm font-medium text-white/80 mb-2">Player balances</div>
                <div className="divide-y divide-white/6 max-h-40 overflow-auto">
                  {(activePlayers && activePlayers.length > 0) ? (
                    showBalances ? (
                      // put current (active) player first
                      (() => {
                        const sorted = [...activePlayers].sort((a, b) => {
                          if (String(a.id) === String(currentPlayerId)) return -1;
                          if (String(b.id) === String(currentPlayerId)) return 1;
                          return (a.name || '').toString().localeCompare((b.name || '').toString());
                        });
                        return sorted.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-2 text-sm text-white/80">
                            <div className={`${String(p.id) === String(currentPlayerId) ? 'font-medium' : ''}`}>
                              {p.name}{String(p.id) === String(currentPlayerId) ? ' • You' : ''}
                            </div>
                            <div>${Number(p.balance ?? 0).toLocaleString()}</div>
                          </div>
                        ));
                      })()
                    ) : (
                      (() => {
                        const currentActive = activePlayers.find((p) => String(p.id) === String(currentPlayerId));
                        if (currentActive) {
                          return (
                            <div key={currentActive.id} className="flex items-center justify-between py-2 text-sm text-white/80">
                              <div className="font-medium">{currentActive.name} • You</div>
                              <div>${Number(currentActive.balance ?? 0).toLocaleString()}</div>
                            </div>
                          );
                        }
                        // If current player is bankrupt or no active current player, don't show balances
                        if (isBankrupt) {
                          return <div className="text-sm text-white/70">You are bankrupt — balances hidden.</div>;
                        }
                        return <div className="text-sm text-white/70">Other players' balances are hidden by game settings.</div>;
                      })()
                    )
                  ) : (
                    <div className="text-sm text-white/70">No active players</div>
                  )}
                </div>
                {!showBalances && (
                  <div className="mt-2 text-sm text-white/70">Other players' balances are hidden by game settings.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpenSection((v) => (v === 'info' ? null : 'info'))}
            className="w-full flex items-center justify-between gap-3 p-3 rounded bg-white/5 hover:bg-white/8"
            aria-expanded={openSection === 'info'}
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Info</div>
                <div className="text-sm text-white/80">Hints and status</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 transform-gpu"
              style={{ transform: openSection === 'info' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'info' && (
            <div className="mt-3 px-0">
              <div className="rounded bg-white/5 border border-white/8 p-3 text-sm text-white/90">
                {startedByName && <div className="mb-2">Started by {startedByName}</div>}
                <div>The trade UI is locked for the duration. When finished, press <strong>Done</strong> to unlock for everyone.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
