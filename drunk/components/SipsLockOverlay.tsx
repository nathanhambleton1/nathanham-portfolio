import React, { useEffect, useState } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { setDropdownOpen } from './ui/dropdown-menu';
import { ChevronDown, Info, DollarSign, UserPlus, MoreVertical, Users } from 'lucide-react';
import SipPopup from './SipPopup';
import PayPopup from './PayPopup';
import CollectPopup from './CollectPopup';

export default function SipsLockOverlay({
  open,
  sipCount,
  onDone,
  processing,
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
  sipCount: number;
  onDone: () => void;
  processing?: boolean;
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
  useLockBodyScroll(!!open, { scrollToTop: true });

  React.useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<'bank' | 'players' | 'tax' | null>('bank');

  // Reset any internal popup flags when the overlay opens so the overlay
  // always starts with its internal popups closed.
  useEffect(() => {
    if (open) {
      setSipModalOpen(false);
      setPayModalOpen(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] pointer-events-auto">
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-[100000] min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center text-white">
          <div className="flex flex-col items-center gap-6 py-12">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
              <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0110 0v2" />
            </svg>
            
            <div className="text-2xl font-bold">You have {sipCount} sip{sipCount > 1 ? 's' : ''}</div>

            <BalancesAndInfo
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
                  console.error('Assign sips error from SipsLockOverlay:', err);
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
                  console.error('PayPopup submit error from SipsLockOverlay:', err);
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
                    console.error('Collect error from SipsLockOverlay:', err);
                    throw err;
                  }
                }}
              />

            <div className="w-full mt-4">
              <button
                type="button"
                disabled={!!processing}
                aria-disabled={!!processing}
                className={`w-full px-4 py-3 rounded text-lg bg-white text-black transition-opacity duration-150 ${processing ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:opacity-95'}`}
                onClick={() => { if (!processing) onDone(); }}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    Processing…
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{
                        animation: 'spin 1s linear infinite'
                      }}
                    >
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M22 12a10 10 0 00-10-10" strokeLinecap="round" />
                    </svg>
                  </span>
                ) : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalancesAndInfo({
  currentBalance,
  players,
  showBalances,
  currentPlayerId,
  onOpenSip,
  onOpenPay,
  onOpenCollect,
  allowGiveSips,
}: {
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
  // only show non-bankrupt (active) players in the balances list
  const activePlayers = (players || []).filter((p) => !p.is_bankrupt);

  return (
    <div className="mb-6 text-left w-full px-6">
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
                <div className="text-sm text-white/80">{allowGiveSips ? 'Give sips, pay bank, and more' : 'Pay bank and players'}</div>
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
                  {allowGiveSips && (
                    <button
                      type="button"
                      onClick={() => { onOpenSip && onOpenSip(); }}
                      className={`w-full text-left p-2 rounded bg-transparent flex items-center gap-2 hover:bg-white/6`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Give Sips</span>
                    </button>
                  )}

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
                <div className="text-sm font-medium text-white/80 mb-2">Player balances</div>
                <div className="divide-y divide-white/6 max-h-40 overflow-auto">
                  {(activePlayers && activePlayers.length > 0) ? (
                    showBalances ? (
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
                        const current = (players || []).find((p) => String(p.id) === String(currentPlayerId));
                        if (current?.is_bankrupt) {
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
                <div className="mb-2">Finish your sips to continue playing.</div>
                <div>You cannot collect money until you've finished.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
