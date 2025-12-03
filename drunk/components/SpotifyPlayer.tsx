import { useEffect, useState } from 'react';
import { useSpotify } from '../hooks/use-spotify';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Play, Pause, SkipForward, SkipBack, Music } from 'lucide-react';

export const SpotifyPlayer = () => {
  const {
    isAuthenticated,
    isPlaying,
    currentTrack,
    position,
    login,
    logout,
    togglePlay,
    skipNext,
    skipPrevious,
    seek,
  } = useSpotify();

  const [localPosition, setLocalPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      setLocalPosition(position);
    }
  }, [position, isDragging]);

  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    const interval = setInterval(() => {
      if (!isDragging) {
        setLocalPosition(prev => Math.min(prev + 1000, currentTrack.duration));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, isDragging]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = Math.floor(percentage * currentTrack.duration);
    
    setLocalPosition(newPosition);
    seek(newPosition);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isAuthenticated) {
    return (
      <Card className="bg-gradient-card border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-green-500" />
            <div>
              <p className="font-medium text-foreground">Connect Spotify</p>
              <p className="text-xs text-muted-foreground">Control your music while playing</p>
            </div>
          </div>
          <Button 
            onClick={login}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Connect
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border p-4">
      <div className="flex flex-col gap-3">
        {/* Track Info */}
        {currentTrack && (
          <div className="flex items-center gap-3">
            {currentTrack.albumArt && (
              <img 
                src={currentTrack.albumArt} 
                alt={currentTrack.album}
                className="w-12 h-12 rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{currentTrack.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {currentTrack.artists.join(', ')}
              </p>
            </div>
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              Disconnect
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        {currentTrack && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(localPosition)}
            </span>
            <div 
              className="flex-1 h-2 bg-muted rounded-full overflow-hidden cursor-pointer relative"
              onClick={handleSeek}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div 
                className="h-full bg-green-500 transition-all"
                style={{ 
                  width: `${(localPosition / currentTrack.duration) * 100}%`,
                  transitionDuration: isDragging ? '0ms' : '1000ms'
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(currentTrack.duration)}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={skipPrevious}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={!currentTrack}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            onClick={togglePlay}
            className="h-10 w-10 rounded-full p-0 bg-white text-black hover:bg-gray-100"
            disabled={!currentTrack}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>
          <Button
            onClick={skipNext}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={!currentTrack}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
