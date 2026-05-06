import React, { useState, useEffect, useRef } from 'react';
import useLockBodyScroll from '../hooks/use-lock-body-scroll';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';

// American roulette wheel order (clockwise from top)
const WHEEL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3,
  24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6,
  21, 33, 16, 4, 23, 35, 14, 2,
]; // 37 = "00"

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

function numColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0 || n === 37) return 'green';
  return RED_NUMS.has(n) ? 'red' : 'black';
}

function numLabel(n: number): string {
  return n === 37 ? '00' : String(n);
}

type Bet = { kind: 'number'; value: number } | { kind: 'red' } | { kind: 'black' };

function payout(bet: Bet): number {
  return bet.kind === 'number' ? 36 : 2;
}

function betLabel(bet: Bet): string {
  if (bet.kind === 'red') return 'Red';
  if (bet.kind === 'black') return 'Black';
  return numLabel(bet.value);
}

function checkWin(bet: Bet, result: number): boolean {
  if (bet.kind === 'number') return bet.value === result;
  if (bet.kind === 'red') return RED_NUMS.has(result);
  return BLACK_NUMS.has(result);
}

// Rotation so the fixed top-pointer lands on section idx
function wheelRotationForIndex(idx: number): number {
  const total = WHEEL_ORDER.length;
  const center = (idx + 0.5) * (360 / total);
  const offset = (360 - (center % 360) + 360) % 360;
  const spins = (4 + Math.floor(Math.random() * 4)) * 360;
  return spins + offset;
}

// ─── SVG Wheel ──────────────────────────────────────────────────────────────
function WheelSVG({ rotation, phase }: { rotation: number; phase: string }) {
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
      {/* Outer gold ring */}
      <circle cx={cx} cy={cy} r={outerR + 4} fill="none" stroke="#b45309" strokeWidth="6" />
      {/* Spinning group */}
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
            <path d={path} fill={fill} stroke="#92400e" strokeWidth="0.6" />
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
        {/* Inner decorative ring */}
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#92400e" strokeWidth="1.5" />
        {/* Center hub */}
        <circle cx={cx} cy={cy} r={20} fill="#1c1917" stroke="#b45309" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={10} fill="#d97706" />
        <circle cx={cx} cy={cy} r={5} fill="#92400e" />
      </g>
      {/* Static pointer */}
      <polygon points={`${cx},${cy - outerR - 2} ${cx - 6},${cy - outerR + 10} ${cx + 6},${cy - outerR + 10}`} fill="#fbbf24" />
    </svg>
  );
}

// ─── Betting Table ───────────────────────────────────────────────────────────
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
    return true;
  };
  const isResult = (n: number) => resultNum != null && n === resultNum;

  const cellBase = 'flex items-center justify-center text-xs font-bold cursor-pointer select-none border border-amber-800 transition-all duration-100';
  const numCell = (n: number) => {
    const color = numColor(n);
    const bg = color === 'red' ? 'bg-red-700 hover:bg-red-500'
      : color === 'black' ? 'bg-neutral-900 hover:bg-neutral-700'
      : 'bg-green-700 hover:bg-green-600';
    const sel = isSel({ kind: 'number', value: n }) ? 'ring-2 ring-yellow-400 scale-105 z-10' : '';
    const res = isResult(n) ? 'ring-4 ring-white animate-pulse' : '';
    return (
      <div
        key={n}
        className={`${cellBase} ${bg} ${sel} ${res} text-white`}
        style={{ minWidth: 0, aspectRatio: '1 / 1.4' }}
        onClick={() => !disabled && onSelect?.({ kind: 'number', value: n })}
      >
        {n}
      </div>
    );
  };

  return (
    <div className="w-full" style={{ background: '#14532d', border: '2px solid #92400e', borderRadius: 8, padding: 6 }}>
      {/* 0 and 00 */}
      <div className="flex gap-0.5 mb-0.5">
        {[0, 37].map(n => {
          const sel = isSel({ kind: 'number', value: n }) ? 'ring-2 ring-yellow-400 scale-105' : '';
          const res = isResult(n) ? 'ring-4 ring-white animate-pulse' : '';
          return (
            <div
              key={n}
              className={`${cellBase} flex-1 bg-green-700 hover:bg-green-600 text-white py-1.5 ${sel} ${res}`}
              onClick={() => !disabled && onSelect?.({ kind: 'number', value: n })}
            >
              {numLabel(n)}
            </div>
          );
        })}
      </div>

      {/* Number rows */}
      <div className="grid mb-0.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {ROWS.map((row, ri) =>
          row.map(n => (
            <div key={`${ri}-${n}`} onClick={() => !disabled && onSelect?.({ kind: 'number', value: n })}>
              {numCell(n)}
            </div>
          ))
        )}
      </div>

      {/* Dozen bets — decorative only */}
      <div className="grid grid-cols-3 gap-0.5 mb-0.5">
        {['1st 12', '2nd 12', '3rd 12'].map(lbl => (
          <div key={lbl} className="text-center text-xs py-1 text-amber-300/50 border border-amber-800/40 bg-green-800/40">
            {lbl}
          </div>
        ))}
      </div>

      {/* Even-money row */}
      <div className="grid grid-cols-6 gap-0.5">
        {[
          { lbl: '1–18', b: null },
          { lbl: 'EVEN', b: null },
          { lbl: 'RED',  b: { kind: 'red' } as Bet },
          { lbl: 'BLACK',b: { kind: 'black' } as Bet },
          { lbl: 'ODD',  b: null },
          { lbl: '19–36',b: null },
        ].map(({ lbl, b }) => {
          const active = !!b;
          const sel = b && isSel(b) ? 'ring-2 ring-yellow-400 scale-105' : '';
          const bg = lbl === 'RED' ? 'bg-red-700 hover:bg-red-500 text-white'
            : lbl === 'BLACK' ? 'bg-neutral-900 hover:bg-neutral-700 text-white'
            : 'bg-green-700 text-amber-200/50';
          return (
            <div
              key={lbl}
              className={`${cellBase} py-1.5 text-center text-xs ${bg} ${sel} ${active && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => active && !disabled && b && onSelect?.(b)}
            >
              {lbl}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Popup ──────────────────────────────────────────────────────────────
export default function RoulettePopup({
  open, onOpenChange, amount, onResult,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  onResult: (won: boolean) => void;
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
    setResultNum(result);
    setWon(didWin);
    setRotation(wheelRotationForIndex(idx));
    setPhase('spinning');
    timer.current = setTimeout(() => setPhase('result'), 4200);
  };

  const handleConfirm = () => { onResult(won); onOpenChange(false); };
  const winAmt = selected ? amount * payout(selected) : 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (phase === 'spinning') return; onOpenChange(v); }}>
      <DialogContent
        className="p-0 border-0 overflow-hidden max-w-md w-full"
        style={{ background: '#052e16', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid #92400e' }}>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-400">🎰 Roulette</div>
            <div className="text-sm text-green-300">
              Wagering <span className="font-bold text-white">${amount.toLocaleString()}</span>
              {selected && (
                <span className="ml-2 text-amber-300">
                  → Win: ${winAmt.toLocaleString()} ({payout(selected) - 1}:1)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-3 py-3 flex flex-col gap-3">
          {/* Wheel */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: 180, height: 180 }}>
              <WheelSVG rotation={rotation} phase={phase} />
            </div>
          </div>

          {/* Status */}
          <div className="text-center min-h-[2rem]">
            {phase === 'bet' && !selected && (
              <p className="text-green-400 text-sm">Select a bet below</p>
            )}
            {phase === 'bet' && selected && (
              <p className="text-amber-300 font-semibold text-sm">
                Bet: <span className={
                  selected.kind === 'red' ? 'text-red-400'
                  : selected.kind === 'black' ? 'text-gray-300'
                  : 'text-white'
                }>{betLabel(selected)}</span>
                {' '}— Win ${winAmt.toLocaleString()} or lose $0
              </p>
            )}
            {phase === 'spinning' && (
              <p className="text-amber-400 animate-pulse font-semibold">🎲 Spinning…</p>
            )}
            {phase === 'result' && resultNum != null && (
              <div>
                <div className={`text-xl font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                  {won ? '🎉 You Won!' : '💸 You Lost!'}
                </div>
                <div className="text-sm mt-0.5" style={{ color: numColor(resultNum) === 'red' ? '#f87171' : numColor(resultNum) === 'black' ? '#d1d5db' : '#4ade80' }}>
                  Ball landed on <span className="font-bold">{numLabel(resultNum)}</span> ({numColor(resultNum)})
                  {won && <span className="text-white ml-1">· Collect ${winAmt.toLocaleString()}</span>}
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

        {/* Footer */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #92400e' }}>
          {phase === 'bet' && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 text-green-300 hover:text-white hover:bg-green-900"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 font-bold text-black"
                style={{ background: selected ? '#d97706' : '#6b7280', cursor: selected ? 'pointer' : 'not-allowed' }}
                disabled={!selected}
                onClick={handleSpin}
              >
                Spin!
              </Button>
            </div>
          )}
          {phase === 'result' && (
            <Button
              className="w-full font-bold text-black"
              style={{ background: won ? '#16a34a' : '#6b7280' }}
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
