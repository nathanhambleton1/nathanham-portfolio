import { useEffect, useState } from 'react';

type Props = {
  player: { name?: string | null; username?: string | null; avatar_url?: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizeClasses = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-20 h-20 text-2xl',
};

// How many times to retry a photo that fails to load (flaky party wifi),
// with a cache-busting query so the browser doesn't reuse the failed response.
const MAX_RETRIES = 2;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export default function PlayerAvatar({ player, size = 'md', className = '' }: Props) {
  const displayName = (player.name || (player as any).username || '') as string;
  const sz = sizeClasses[size];
  const url = player.avatar_url || null;

  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // A new URL (photo changed, or arrived from the account) gets a fresh start.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    const src = attempt === 0 ? url : `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}`;
    return (
      <img
        key={src}
        src={src}
        alt={displayName || 'Player'}
        decoding="async"
        draggable={false}
        onError={() => {
          if (attempt < MAX_RETRIES) {
            window.setTimeout(() => setAttempt((a) => a + 1), 800 * (attempt + 1));
          } else {
            setFailed(true);
          }
        }}
        className={`${sz} rounded-full object-cover shrink-0 bg-foreground/10 ring-1 ring-foreground/10 ${className}`}
      />
    );
  }

  const initials = initialsOf(displayName);

  return (
    <div
      className={`${sz} rounded-full bg-brand/10 text-brand ring-1 ring-inset ring-brand/20 flex items-center justify-center shrink-0 select-none font-semibold leading-none ${className}`}
      aria-label={displayName || 'Player'}
    >
      {initials ? (
        initials
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3/5 h-3/5">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </div>
  );
}
