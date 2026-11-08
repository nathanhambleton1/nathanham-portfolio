import { Check } from "lucide-react";

/**
 * A player-to-player payment, drawn in the chat thread the way iMessage draws
 * an Apple Pay transfer, but printed as Drunkopoly play money: the note is
 * tinted like the matching banknote denomination, with an engraved frame and a
 * medallion holding the amount. Any note attached to the payment is shown by the
 * caller as an ordinary bubble beneath the card.
 */

const INK = "#2a2118";

// Classic play-money tints, keyed by the largest bill that fits the amount.
const BILLS: { min: number; paper: string; deep: string }[] = [
  { min: 500, paper: "#f3c48c", deep: "#b5651d" },
  { min: 100, paper: "#eedbaa", deep: "#8a6a2a" },
  { min: 50, paper: "#d8c5ea", deep: "#6a4a93" },
  { min: 20, paper: "#c8e6bd", deep: "#2f7a3a" },
  { min: 10, paper: "#bfe0f0", deep: "#2a6f95" },
  { min: 5, paper: "#f4c6cf", deep: "#a8455a" },
  { min: 0, paper: "#f2efe4", deep: "#6b6355" },
];

export function billFor(amount: number) {
  return BILLS.find((b) => amount >= b.min) ?? BILLS[BILLS.length - 1];
}

const TYPE_LABEL: Record<string, string> = {
  rent: "Rent",
  tax: "Tax",
  trade: "Trade",
};

export default function PaymentCard({
  amount,
  mine,
  counterpartName,
  type,
}: {
  amount: number;
  /** True when the viewer sent this payment. */
  mine: boolean;
  counterpartName: string;
  type?: string | null;
}) {
  const bill = billFor(amount);
  const label = type ? TYPE_LABEL[type] : undefined;
  const status = mine ? `Paid to ${counterpartName}` : `Received`;

  return (
    <div
      className="relative w-[232px] max-w-full select-none overflow-hidden rounded-[18px] border-2 p-[5px] shadow-[0_14px_28px_-12px_rgb(0_0_0/0.9)]"
      style={{
        borderColor: INK,
        color: INK,
        backgroundColor: bill.paper,
        backgroundImage:
          "radial-gradient(circle at 15% 10%, rgba(255,255,255,0.55), transparent 45%), radial-gradient(circle at 90% 95%, rgba(80,50,10,0.14), transparent 55%), repeating-linear-gradient(135deg, rgba(42,33,24,0.045) 0 2px, transparent 2px 6px)",
      }}
    >
      <div className="relative rounded-[13px] border-[1.5px] px-3 pb-2.5 pt-2" style={{ borderColor: `${INK}66` }}>
        {/* Header: wordmark + corner denomination, like a printed bill */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-[3px] border-[1.5px] bg-[#fffaf0] px-1.5 py-[1px] font-board text-[10px] font-bold uppercase leading-none tracking-[0.2em]"
            style={{ borderColor: INK }}
          >
            Drunkopoly Pay
          </span>
          {label && (
            <span className="font-board text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: bill.deep }}>
              {label}
            </span>
          )}
        </div>

        {/* Medallion with the amount */}
        <div className="mt-2 flex justify-center">
          <div
            className="flex min-w-[140px] items-center justify-center rounded-[50%] border-2 bg-[#fffaf0]/70 px-5 py-1.5"
            style={{ borderColor: INK, boxShadow: `inset 0 0 0 3px ${bill.paper}, inset 0 0 0 4.5px ${INK}55` }}
          >
            <span className="font-board text-[34px] font-bold leading-none tracking-tight tabular-nums">
              <span className="mr-0.5 align-top text-[18px] leading-[1.4]">$</span>
              {Math.round(amount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Status line, like the "Sent"/"Received" under an Apple Pay bubble */}
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold leading-none" style={{ color: `${INK}cc` }}>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: bill.deep }}>
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
          </span>
          <span className="truncate">{status}</span>
        </div>
      </div>
    </div>
  );
}
