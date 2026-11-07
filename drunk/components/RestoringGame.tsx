import { useEffect, useState } from "react";
import { Die, STREET_GROUPS, streetColor } from "./BoardArt";

// Shown while a saved game session is being restored (e.g. after a refresh),
// so the page goes straight from this to the board instead of flashing the
// join screen first. Two dice tumble, a token hops around the street colours,
// and the caption cycles through a few board-game-flavoured status lines.

const LINES = [
  "Shaking the dice",
  "Counting your cash",
  "Finding your seat",
  "Topping up your drink",
  "Checking who's in jail",
];

const randFace = (prev: number) => {
  let n = prev;
  while (n === prev) n = 1 + Math.floor(Math.random() * 6);
  return n;
};

const RestoringGame = ({ gameCode, name }: { gameCode?: string | null; name?: string | null }) => {
  const [faces, setFaces] = useState<[number, number]>([5, 3]);
  const [step, setStep] = useState(0);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const roll = window.setInterval(() => {
      setFaces(([a, b]) => [randFace(a), randFace(b)]);
    }, reduce ? 900 : 220);
    const hop = window.setInterval(() => setStep((s) => (s + 1) % STREET_GROUPS.length), reduce ? 900 : 260);
    const caption = window.setInterval(() => setLine((l) => (l + 1) % LINES.length), 1600);
    return () => {
      window.clearInterval(roll);
      window.clearInterval(hop);
      window.clearInterval(caption);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="restoring-fade-in min-h-screen bg-gradient-bg flex flex-col items-center justify-center px-4"
    >
      <div className="relative h-28 w-36 text-foreground">
        <div className="restoring-die absolute left-2 top-2 h-16 w-16">
          <Die value={faces[0]} className="h-full w-full" />
        </div>
        <div className="restoring-die restoring-die-b absolute bottom-0 right-2 h-14 w-14">
          <Die value={faces[1]} className="h-full w-full" />
        </div>
        <div aria-hidden className="restoring-shadow absolute -bottom-3 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-foreground/10 blur-[2px]" />
      </div>

      {/* A token hopping around the street colours */}
      <div aria-hidden className="mt-10 flex w-56 gap-1.5">
        {STREET_GROUPS.map((c, i) => (
          <span
            key={c}
            className="h-1.5 flex-1 rounded-full transition-all duration-200"
            style={{
              backgroundColor: streetColor(c),
              opacity: i === step ? 1 : i < step ? 0.55 : 0.18,
              transform: i === step ? "scaleY(2)" : undefined,
            }}
          />
        ))}
      </div>

      <p className="mt-8 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {gameCode ? <>Rejoining game <span className="font-semibold text-foreground">{gameCode}</span></> : "Rejoining your game"}
      </p>
      <p key={line} className="restoring-line mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
        {LINES[line]}…
      </p>
      {name ? <p className="mt-2 text-sm text-muted-foreground">Welcome back, {name}</p> : null}
    </div>
  );
};

export default RestoringGame;
