import React, { useState, useEffect, useRef } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';

// American roulette wheel order (clockwise from top)
export const WHEEL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3,
  24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6,
  21, 33, 16, 4, 23, 35, 14, 2,
]; // 37 = "00"

export const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const BLACK_NUMS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

export function numColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0 || n === 37) return 'green';
  return RED_NUMS.has(n) ? 'red' : 'black';
}

export function numLabel(n: number): string {
  return n === 37 ? '00' : String(n);
}

export type Bet =
  | { kind: 'number'; value: number }
  | { kind: 'red' }
  | { kind: 'black' }
  | { kind: 'low' }
  | { kind: 'high' }
  | { kind: 'even' }
  | { kind: 'odd' }
  | { kind: 'dozen'; value: 1 | 2 | 3 };

function payout(bet: Bet): number {
  if (bet.kind === 'number') return 36;
  if (bet.kind === 'dozen') return 3;
  return 2;
}

export function betLabel(bet: Bet): string {
  if (bet.kind === 'red') return 'Red';
  if (bet.kind === 'black') return 'Black';
  if (bet.kind === 'low') return '1–18';
  if (bet.kind === 'high') return '19–36';
  if (bet.kind === 'even') return 'Even';
  if (bet.kind === 'odd') return 'Odd';
  if (bet.kind === 'dozen') return `${bet.value === 1 ? '1st' : bet.value === 2 ? '2nd' : '3rd'} 12`;
  return numLabel(bet.value);
}

function checkWin(bet: Bet, result: number): boolean {
  if (bet.kind === 'number') return bet.value === result;
  if (bet.kind === 'red') return RED_NUMS.has(result);
  if (bet.kind === 'black') return BLACK_NUMS.has(result);
  // 0 and 00 lose all outside bets
  if (result === 0 || result === 37) return false;
  if (bet.kind === 'low') return result >= 1 && result <= 18;
  if (bet.kind === 'high') return result >= 19 && result <= 36;
  if (bet.kind === 'even') return result % 2 === 0;
  if (bet.kind === 'odd') return result % 2 === 1;
  if (bet.kind === 'dozen') {
    if (bet.value === 1) return result >= 1 && result <= 12;
    if (bet.value === 2) return result >= 13 && result <= 24;
    return result >= 25 && result <= 36;
  }
  return false;
}

function wheelRotationForIndex(idx: number): number {
  const total = WHEEL_ORDER.length;
  const center = (idx + 0.5) * (360 / total);
  const offset = (360 - (center % 360) + 360) % 360;
  const spins = (4 + Math.floor(Math.random() * 4)) * 360;
  return spins + offset;
}

export type RouletteSpinBroadcast = {
  spinnerPlayerId: string;
  spinnerName: string;
  spinnerAvatar?: string | null;
  betLabel: string;
  payoutMultiplier: number;
  resultNum: number;
  rotation: number;
  won: boolean;
  amount: number;
  winAmt: number;
};

// ─── SVG Wheel ───────────────────────────────────────────────────────────────
export function WheelSVG({ rotation, phase }: { rotation: number; phase: string }) {
  const cx = 100, cy = 100;
  const outerR = 92, innerR = 52;
  const total = WHEEL_ORDER.length;
  const deg = 360 / total;

  const sectors = WHEEL_ORDER.map((n, i) => {
    const s = (i * deg - 90) * (Math.PI / 180);
    const e = ((i + 1) * deg - 90) * (Math.PI / 180);
    const cos = Math.cos, sin = Math.sin;
    const x1 = cx + outerR * cos(s), y1 = cy + outerR * sin(s);
    const x2 = cx + outerR * cos(e), y2 = cy + outerR * sin(e);
    const ix1 = cx + innerR * cos(s), iy1 = cy + innerR * sin(s);
    const ix2 = cx + innerR * cos(e), iy2 = cy + innerR * sin(e);
    const mid = ((i + 0.5) * deg - 90) * (Math.PI / 180);
    const tr = (outerR + innerR) / 2;
    const tx = cx + tr * cos(mid), ty = cy + tr * sin(mid);
    const textDeg = (i + 0.5) * deg;
    const fill = numColor(n) === 'green' ? '#15803d' : numColor(n) === 'red' ? '#dc2626' : '#111827';
    const path = `M${ix1},${iy1}L${x1},${y1}A${outerR},${outerR} 0 0,1 ${x2},${y2}L${ix2},${iy2}A${innerR},${innerR} 0 0,0 ${ix1},${iy1}Z`;
    return { n, path, fill, tx, ty, textDeg };
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={outerR + 4} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: phase === 'spinning'
            ? 'transform 4s cubic-bezier(0.15, 0.6, 0.1, 1)'
            : 'none',
        }}
      >
        {sectors.map(({ n, path, fill, tx, ty, textDeg }) => (
          <g key={`${n}-${textDeg}`}>
            <path d={path} fill={fill} stroke="#555" strokeWidth="0.6" />
            <text
              x={tx} y={ty}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="5.5" fontWeight="700" fill="white"
              fontFamily="sans-serif"
              transform={`rotate(${textDeg}, ${tx}, ${ty})`}
            >
              {numLabel(n)}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={20} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={10} fill="hsl(var(--primary))" />
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--primary-foreground) / 0.3)" />
      </g>
      {/* Static pointer */}
      <polygon
        points={`${cx},${cy - outerR - 2} ${cx - 6},${cy - outerR + 10} ${cx + 6},${cy - outerR + 10}`}
        fill="hsl(var(--primary))"
      />
    </svg>
  );
}

// ─── Betting Table ────────────────────────────────────────────────────────────
const ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function BettingTable({
  selected, onSelect, resultNum, disabled,
}: {
  selected: Bet | null;
  onSelect?: (b: Bet) => void;
  resultNum?: number | null;
  disabled?: boolean;
}) {
  const isSel = (b: Bet) => {
    if (!selected) return false;
    if (b.kind !== selected.kind) return false;
    if (b.kind === 'number' && selected.kind === 'number') return b.value === selected.value;
    if (b.kind === 'dozen' && selected.kind === 'dozen') return b.value === selected.value;
    return true;
  };
  const isResult = (n: number) => resultNum != null && n === resultNum;

  const cellBase = 'flex items-center justify-center text-xs font-bold select-none border border-border transition-all duration-100';

  return (
    <div className="w-full rounded-lg border border-border overflow-hidden bg-card">
      {/* 0 and 00 */}
      <div className="flex gap-px p-px">
        {[0, 37].map(n => {
          const sel = isSel({ kind: 'number', value: n }) ? 'ring-2 ring-primary scale-105' : '';
          const res = isResult(n) ? 'ring-4 ring-primary animate-pulse' : '';
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              className={`${cellBase} flex-1 bg-muted hover:bg-accent text-foreground py-1.5 ${sel} ${res} ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => !disabled && onSelect?.({ kind: 'number', value: n })}
            >
              {numLabel(n)}
            </button>
          );
        })}
      </div>

      {/* Number grid */}
      <div className="grid p-px gap-px" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        {ROWS.map((row, ri) =>
          row.map(n => {
            const color = numColor(n);
            const bg = color === 'red'
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white';
            const sel = isSel({ kind: 'number', value: n }) ? 'ring-2 ring-primary scale-105 z-10' : '';
            const res = isResult(n) ? 'ring-4 ring-primary animate-pulse' : '';
            return (
              <button
                key={`${ri}-${n}`}
                type="button"
                disabled={disabled}
                className={`${cellBase} ${bg} ${sel} ${res} w-full ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ aspectRatio: '1 / 1.4' }}
                onClick={() => !disabled && onSelect?.({ kind: 'number', value: n })}
              >
                {n}
              </button>
            );
          })
        )}
      </div>

      {/* Dozen row */}
      <div className="grid grid-cols-3 gap-px p-px">
        {([1, 2, 3] as const).map(d => {
          const bet: Bet = { kind: 'dozen', value: d };
          const sel = isSel(bet) ? 'ring-2 ring-primary scale-105' : '';
          const lbl = d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12';
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              className={`${cellBase} py-1.5 text-center text-xs bg-muted hover:bg-accent text-foreground ${sel} ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => !disabled && onSelect?.(bet)}
            >
              {lbl}
            </button>
          );
        })}
      </div>

      {/* Even-money row */}
      <div className="grid grid-cols-6 gap-px p-px">
        {([
          { lbl: '1–18',  bet: { kind: 'low' }   as Bet },
          { lbl: 'EVEN',  bet: { kind: 'even' }  as Bet },
          { lbl: 'RED',   bet: { kind: 'red' }   as Bet },
          { lbl: 'BLACK', bet: { kind: 'black' } as Bet },
          { lbl: 'ODD',   bet: { kind: 'odd' }   as Bet },
          { lbl: '19–36', bet: { kind: 'high' }  as Bet },
        ] as const).map(({ lbl, bet }) => {
          const sel = isSel(bet) ? 'ring-2 ring-primary scale-105' : '';
          const bg = lbl === 'RED'
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : lbl === 'BLACK'
            ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
            : 'bg-muted hover:bg-accent text-foreground';
          return (
            <button
              key={lbl}
              type="button"
              disabled={disabled}
              className={`${cellBase} py-1.5 text-center text-xs ${bg} ${sel} ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => !disabled && onSelect?.(bet)}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Popup ───────────────────────────────────────────────────────────────
export default function RoulettePopup({
  open, onOpenChange, amount, onResult, onSpin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  onResult: (won: boolean, multiplier: number) => void;
  onSpin?: (data: RouletteSpinBroadcast) => void;
}) {
  const [phase, setPhase] = useState<'bet' | 'spinning' | 'result'>('bet');
  const [selected, setSelected] = useState<Bet | null>(null);
  const [rotation, setRotation] = useState(0);
  const [resultNum, setResultNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLockBodyScroll(!!open);

  useEffect(() => {
    if (open) { setPhase('bet'); setSelected(null); setRotation(0); setResultNum(null); setWon(false); }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open]);

  const handleSpin = () => {
    if (!selected || phase !== 'bet') return;
    const idx = Math.floor(Math.random() * WHEEL_ORDER.length);
    const result = WHEEL_ORDER[idx];
    const didWin = checkWin(selected, result);
    const rot = wheelRotationForIndex(idx);
    const mult = payout(selected);
    setResultNum(result);
    setWon(didWin);
    setRotation(rot);
    setPhase('spinning');
    timer.current = setTimeout(() => setPhase('result'), 4200);
    onSpin?.({
      spinnerPlayerId: '',
      spinnerName: '',
      spinnerAvatar: null,
      betLabel: betLabel(selected),
      payoutMultiplier: mult,
      resultNum: result,
      rotation: rot,
      won: didWin,
      amount,
      winAmt: amount * mult,
    });
  };

  const handleConfirm = () => { onResult(won, selected ? payout(selected) : 1); onOpenChange(false); };
  const winAmt = selected ? amount * payout(selected) : 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (phase === 'spinning') return; onOpenChange(v); }}>
      <DialogContent
        className="p-0 border border-border overflow-y-auto max-w-md w-full bg-background"
        style={{ maxHeight: '92dvh' }}
      >
        {/* Header — sticky so it stays visible while body scrolls */}
        <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b border-border bg-background">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">Roulette</div>
            <div className="text-sm text-muted-foreground">
              Wagering{' '}
              <span className="font-semibold text-foreground">${amount.toLocaleString()}</span>
              {selected && (
                <span className="ml-2 text-primary">
                  · Win ${winAmt.toLocaleString()} ({payout(selected) - 1}:1)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-3 py-3 flex flex-col gap-3">
          {/* Wheel */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: 180, height: 180 }}>
              <WheelSVG rotation={rotation} phase={phase} />
            </div>
          </div>

          {/* Status */}
          <div className="text-center min-h-[2rem]">
            {phase === 'bet' && !selected && (
              <p className="text-muted-foreground text-sm">Select a bet below</p>
            )}
            {phase === 'bet' && selected && (
              <p className="text-foreground font-semibold text-sm">
                Bet:{' '}
                <span className={selected.kind === 'red' ? 'text-red-400' : selected.kind === 'black' ? 'text-muted-foreground' : 'text-foreground'}>
                  {betLabel(selected)}
                </span>
                {' '}· Win ${winAmt.toLocaleString()} or lose nothing
              </p>
            )}
            {phase === 'spinning' && (
              <p className="text-primary animate-pulse font-semibold text-sm">Spinning...</p>
            )}
            {phase === 'result' && resultNum != null && (
              <div>
                <div className={`text-xl font-bold ${won ? 'text-primary' : 'text-destructive'}`}>
                  {won ? 'You Won!' : 'You Lost!'}
                </div>
                <div className="text-sm mt-0.5 text-muted-foreground">
                  Ball landed on{' '}
                  <span
                    className="font-bold"
                    style={{ color: numColor(resultNum) === 'red' ? '#f87171' : numColor(resultNum) === 'black' ? 'hsl(var(--muted-foreground))' : '#4ade80' }}
                  >
                    {numLabel(resultNum)}
                  </span>{' '}
                  ({numColor(resultNum)})
                  {won && <span className="text-foreground ml-1">· Collect ${winAmt.toLocaleString()}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Betting Table */}
          {phase !== 'spinning' && (
            <BettingTable
              selected={selected}
              onSelect={phase === 'bet' ? setSelected : undefined}
              resultNum={resultNum}
              disabled={phase === 'result'}
            />
          )}
        </div>

        {/* Footer — sticky so it stays visible while body scrolls */}
        <div className="sticky bottom-0 z-10 px-4 py-3 border-t border-border bg-background">
          {phase === 'bet' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-bold"
                disabled={!selected}
                onClick={handleSpin}
              >
                Spin
              </Button>
            </div>
          )}
          {phase === 'result' && (
            <Button
              className="w-full font-bold"
              variant={won ? 'default' : 'outline'}
              onClick={handleConfirm}
            >
              {won ? `Collect $${winAmt.toLocaleString()}` : 'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
