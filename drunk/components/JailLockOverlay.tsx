import React, { useEffect, useState } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { setDropdownOpen } from './ui/dropdown-menu';
import { ChevronDown, Info, DollarSign, UserPlus, MoreVertical, Users } from 'lucide-react';
import SipPopup from './SipPopup';
import CollectPopup from './CollectPopup';
import PayPopup from './PayPopup';

export default function JailLockOverlay({
  open,
  jailedByName,
  hasGetOutCard,
  currentBalance,
  payProcessing,
  cardProcessing,
  onPayToGetOut,
  onUseCard,
  // visual flash when a payment was blocked due to insufficient funds
  payInsufficientFlash,
  // optional props for balances display
  players,
  showBalances = false,
  currentPlayerId,
  // optional sip props
  currentPlayer,
  allowGiveSips,
  onAssignSips,
  onPaySubmit,
  onOpenCollect,
  onCollect,
}: {
  open: boolean;
  jailedByName?: string | null;
  hasGetOutCard?: boolean;
  currentBalance?: number | null;
  payProcessing?: boolean;
  cardProcessing?: boolean;
  onPayToGetOut: () => void;
  onUseCard: () => void;
  payInsufficientFlash?: boolean;
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
  // new optional props: players list and showBalances/currentPlayerId
  // these will be passed by the page where available
  useLockBodyScroll(!!open, { scrollToTop: true });

  React.useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<'bank' | 'players' | 'tax' | null>('bank');

  // Reset internal popups when overlay opens to avoid auto-opening leftover state
  useEffect(() => {
    if (open) {
      setSipModalOpen(false);
      setPayModalOpen(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] pointer-events-auto overflow-auto bg-background text-foreground">
      <div className="relative z-[9999] min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="max-w-lg w-full text-center p-6 sm:p-8 rounded-2xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] overflow-auto max-h-[calc(100vh-5rem)] text-foreground motion-safe:animate-rise">
          <img src="/drunkopoly/in_jail.webp" alt="In Jail" draggable={false} className="mx-auto mb-5 h-28 w-auto select-none drop-shadow-[0_12px_24px_rgb(0_0_0/0.5)]" />

          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive shadow-[0_0_10px_hsl(var(--destructive))]" />
            Locked
          </div>
          <div className="mt-2 mb-6 font-display text-3xl font-semibold tracking-tight">You're in Jail</div>

          <BalancesAndInfo
            startedByName={jailedByName}
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
                console.error('Assign sips error from JailLockOverlay:', err);
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
                console.error('Collect error from JailLockOverlay:', err);
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
                console.error('PayPopup submit error from JailLockOverlay:', err);
                throw err;
              }
            }}
          />

          <div className="space-y-3">
            <button
              type="button"
              disabled={!!payProcessing}
              aria-disabled={!!payProcessing}
              className={`w-full h-12 px-4 rounded-xl text-base font-semibold bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.12)] transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${payProcessing ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-primary/90'} ${payInsufficientFlash ? 'ring-2 ring-destructive ring-offset-2 ring-offset-background' : ''}`}
              onClick={() => { if (!payProcessing) onPayToGetOut(); }}
            >
              {payProcessing ? (
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
              ) : 'Pay $50 to get out'}
            </button>
            <button
              type="button"
              disabled={!!cardProcessing}
              aria-disabled={!!cardProcessing}
              className={`w-full min-h-[48px] px-4 py-2 rounded-xl text-base font-medium text-foreground border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${cardProcessing ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:border-brand/40 hover:bg-foreground/[0.06]'}`}
              onClick={() => { if (!cardProcessing) onUseCard(); }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !cardProcessing) { e.preventDefault(); onUseCard(); } }}
            >
              {cardProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  Using card…
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
              ) : "Use 'Get Out of Jail Free' card"}
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
  // only show non-bankrupt (active) players in the balances list
  const activePlayers = (players || []).filter((p) => !p.is_bankrupt);

  return (
    <div className="mb-6 text-left">
          <div className="space-y-3">
        <div>
          <button
            type="button"
            onClick={() => setOpenSection((v) => (v === 'actions' ? null : 'actions'))}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:border-brand/40 aria-expanded:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-expanded={openSection === 'actions'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                <MoreVertical className="w-5 h-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="font-display font-semibold tracking-tight">Actions</div>
                <div className="text-sm text-muted-foreground truncate">{allowGiveSips ? 'Give sips, pay bank, and more' : 'Pay bank and players'}</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 flex-shrink-0 text-muted-foreground transform-gpu"
              style={{ transform: openSection === 'actions' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'actions' && (
              <div className="mt-3 px-0">
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-2">
                <div className="space-y-1">
                  {allowGiveSips && (
                    <button
                      type="button"
                      onClick={() => { onOpenSip && onOpenSip(); }}
                      className="w-full min-h-[44px] text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium text-foreground transition hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>svg]:text-brand"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Give Sips</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenCollect && onOpenCollect()}
                    className="w-full min-h-[44px] text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium text-foreground transition hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>svg]:text-brand"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Collect From Bank</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPay && onOpenPay('bank')}
                    className="w-full min-h-[44px] text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium text-foreground transition hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>svg]:text-brand"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Pay Bank</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPay && onOpenPay('players')}
                    className="w-full min-h-[44px] text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium text-foreground transition hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>svg]:text-brand"
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
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:border-brand/40 aria-expanded:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-expanded={openSection === 'balances'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                <DollarSign className="w-5 h-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="font-display font-semibold tracking-tight">Balances</div>
                <div className="text-sm text-muted-foreground truncate">Your balance and others</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 flex-shrink-0 text-muted-foreground transform-gpu"
              style={{ transform: openSection === 'balances' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'balances' && (
              <div className="mt-3 px-0">
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-2">
                <div className="mb-1 px-2 pt-1 text-[11px] uppercase tracking-widest text-muted-foreground">Player balances</div>
                <div className="divide-y divide-foreground/10 max-h-40 overflow-auto px-2">
                  {(activePlayers && activePlayers.length > 0) ? (
                    showBalances ? (
                      (() => {
                        const sorted = [...activePlayers].sort((a, b) => {
                          if (String(a.id) === String(currentPlayerId)) return -1;
                          if (String(b.id) === String(currentPlayerId)) return 1;
                          return (a.name || '').toString().localeCompare((b.name || '').toString());
                        });
                        return sorted.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground">
                            <div className={`min-w-0 truncate ${String(p.id) === String(currentPlayerId) ? 'font-medium text-foreground' : ''}`}>
                              {p.name}{String(p.id) === String(currentPlayerId) ? ' • You' : ''}
                            </div>
                            <div className="flex-shrink-0 font-display font-semibold tabular-nums text-foreground">${Number(p.balance ?? 0).toLocaleString()}</div>
                          </div>
                        ));
                      })()
                    ) : (
                      (() => {
                        const currentActive = activePlayers.find((p) => String(p.id) === String(currentPlayerId));
                        if (currentActive) {
                          return (
                            <div key={currentActive.id} className="flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground">
                              <div className="min-w-0 truncate font-medium text-foreground">{currentActive.name} • You</div>
                              <div className="flex-shrink-0 font-display font-semibold tabular-nums text-foreground">${Number(currentActive.balance ?? 0).toLocaleString()}</div>
                            </div>
                          );
                        }
                        // If current player is bankrupt or no active current player, don't show balances
                        const current = (players || []).find((p) => String(p.id) === String(currentPlayerId));
                        if (current?.is_bankrupt) {
                          return <div className="py-2 text-sm text-muted-foreground">You are bankrupt — balances hidden.</div>;
                        }
                        return <div className="py-2 text-sm text-muted-foreground">Other players' balances are hidden by game settings.</div>;
                      })()
                    )
                  ) : (
                    <div className="py-2 text-sm text-muted-foreground">No active players</div>
                  )}
                </div>
                {!showBalances && (
                  <div className="mt-1 border-t border-foreground/10 px-2 pt-2 pb-1 text-xs text-muted-foreground">Other players' balances are hidden by game settings.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOpenSection((v) => (v === 'info' ? null : 'info'))}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:border-brand/40 aria-expanded:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-expanded={openSection === 'info'}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                <Info className="w-5 h-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="font-display font-semibold tracking-tight">Info</div>
                <div className="text-sm text-muted-foreground truncate">Hints and status</div>
              </div>
            </div>
            <ChevronDown
              className="w-5 h-5 flex-shrink-0 text-muted-foreground transform-gpu"
              style={{ transform: openSection === 'info' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
            />
          </button>

          {openSection === 'info' && (
            <div className="mt-3 px-0">
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-sm leading-relaxed text-muted-foreground">
                {startedByName && <div className="mb-2 text-[11px] uppercase tracking-widest">Sent to jail by <span className="text-foreground">{startedByName}</span></div>}
                <div>Your screen is locked while you're in jail. Choose an option to get out.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
