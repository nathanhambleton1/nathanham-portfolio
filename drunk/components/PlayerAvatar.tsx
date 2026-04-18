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

export default function PlayerAvatar({ player, size = 'md', className = '' }: Props) {
  const displayName = (player.name || (player as any).username || '') as string;
  const sz = sizeClasses[size];

  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={displayName || 'Player'}
        className={`${sz} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sz} rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 select-none ${className}`}
      aria-label={displayName || 'Player'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3/5 h-3/5">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}
