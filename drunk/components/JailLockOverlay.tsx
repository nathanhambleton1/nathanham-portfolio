import React, { useEffect, useState } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { setDropdownOpen } from './ui/dropdown-menu';
import { ChevronDown, Info, DollarSign, UserPlus, MoreVertical, Users } from 'lucide-react';
import SipPopup from './SipPopup';
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
  // optional props for balances display
  players,
  showBalances = false,
  currentPlayerId,
  // optional sip props
  currentPlayer,
  allowGiveSips,
  onAssignSips,
  onPaySubmit,
}: {
  open: boolean;
  jailedByName?: string | null;
  hasGetOutCard?: boolean;
  currentBalance?: number | null;
  payProcessing?: boolean;
  cardProcessing?: boolean;
  onPayToGetOut: () => void;
  onUseCard: () => void;
  players?: any[];
  showBalances?: boolean;
  currentPlayerId?: string | number | null;
  currentPlayer?: any | null;
  allowGiveSips?: boolean;
  onAssignSips?: (to: string | string[], sip_count: number) => Promise<void> | void;
  onPaySubmit?: (payments: { to: string | null; amount: number }[], opts?: { freeParking?: boolean; description?: string | null; mode?: 'bank' | 'players' | 'tax' }) => Promise<void> | void;
}) {
  // new optional props: players list and showBalances/currentPlayerId
  // these will be passed by the page where available
  useLockBodyScroll(!!open, { scrollToTop: true });

  React.useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
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
    <div className="fixed inset-0 z-[100000] pointer-events-auto">
      <div className="absolute inset-0 bg-black" />
      <div className="relative z-[9999] min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center text-white p-12 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 mx-auto mb-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="10" width="18" height="11" rx="2" />
            <path d="M7 10V7a5 5 0 0110 0v3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 13v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div className="text-2xl font-bold mb-2">You're in Jail</div>

          <BalancesAndInfo
            startedByName={jailedByName}
            currentBalance={currentBalance}
            players={players}
            showBalances={showBalances}
            currentPlayerId={currentPlayerId}
            onOpenSip={() => setSipModalOpen(true)}
            onOpenPay={(mode: 'bank' | 'players' | 'tax') => { setPayMode(mode ?? 'bank'); setPayModalOpen(true); }}
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
              className={`w-full px-4 py-3 rounded text-lg bg-white text-black transition-opacity duration-150 ${payProcessing ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:opacity-95'}`}
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
              className={`w-full px-4 py-3 rounded text-lg border border-white/20 transition-colors duration-150 focus:outline-none ${cardProcessing ? 'opacity-70 cursor-wait' : 'bg-transparent text-white cursor-pointer hover:bg-white/10'}`}
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
  allowGiveSips,
}: {
  startedByName?: string | null;
  currentBalance?: number | null;
  players?: any[];
  showBalances?: boolean;
  currentPlayerId?: string | number | null;
  onOpenSip?: () => void;
  onOpenPay?: (mode: 'bank' | 'players' | 'tax') => void;
  allowGiveSips?: boolean;
}) {
  // only one section may be open at a time: 'actions' | 'balances' | 'info' | null
  // All dropdowns start closed by default (no localStorage persistence)
  const [openSection, setOpenSection] = useState<'actions' | 'balances' | 'info' | null>(null);

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
                <div className="text-sm text-white/80">Give sips, pay bank, and more</div>
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
                  <button
                    type="button"
                    onClick={() => { if (!allowGiveSips) return; onOpenSip && onOpenSip(); }}
                    disabled={!allowGiveSips}
                    aria-disabled={!allowGiveSips}
                    className={`w-full text-left p-2 rounded bg-transparent flex items-center gap-2 ${!allowGiveSips ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/6'}`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Give Sips</span>
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
                  {(players && players.length > 0) ? (
                    (() => {
                      const sorted = [...players].sort((a, b) => {
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
                    <div className="text-sm text-white/70">No players</div>
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
                {startedByName && <div className="mb-2">Sent to jail by {startedByName}</div>}
                <div>Your screen is locked while you're in jail. Choose an option to get out.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
