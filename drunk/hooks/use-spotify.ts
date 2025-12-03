import { useState, useEffect, useCallback, useRef } from 'react';

const CLIENT_ID = (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = (import.meta as any).env?.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/drunk/power-hour`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
].join(' ');

interface SpotifyTrack {
  name: string;
  artists: string[];
  album: string;
  albumArt: string;
  duration: number;
  uri: string;
}

interface SpotifyState {
  isAuthenticated: boolean;
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  position: number;
  device_id: string | null;
}

export const useSpotify = () => {
  const [state, setState] = useState<SpotifyState>({
    isAuthenticated: false,
    isPlaying: false,
    currentTrack: null,
    position: 0,
    device_id: null,
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const deviceIdRef = useRef<string | null>(null);

  // Check for token in URL or localStorage
  useEffect(() => {
    const hash = window.location.hash;
    let token = localStorage.getItem('spotify_access_token');

    if (!token && hash) {
      const params = new URLSearchParams(hash.substring(1));
      const urlToken = params.get('access_token');
      
      if (urlToken) {
        token = urlToken;
        localStorage.setItem('spotify_access_token', urlToken);
        window.location.hash = ''; // Clear the hash
      }
    }

    if (token) {
      setAccessToken(token);
      setState(prev => ({ ...prev, isAuthenticated: true }));
    }
  }, []);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!accessToken) return;

    // Load Spotify SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      const player = new (window as any).Spotify.Player({
        name: 'Power Hour Player',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(accessToken);
        },
        volume: 0.5,
      });

      // Ready
      player.addListener('ready', ({ device_id }: any) => {
        console.log('Ready with Device ID', device_id);
        deviceIdRef.current = device_id;
        setState(prev => ({ ...prev, device_id }));
      });

      // Not Ready
      player.addListener('not_ready', ({ device_id }: any) => {
        console.log('Device ID has gone offline', device_id);
      });

      // Player state changed
      player.addListener('player_state_changed', (state: any) => {
        if (!state) return;

        const track = state.track_window.current_track;
        setState(prev => ({
          ...prev,
          isPlaying: !state.paused,
          position: state.position,
          currentTrack: track ? {
            name: track.name,
            artists: track.artists.map((a: any) => a.name),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || '',
            duration: track.duration_ms,
            uri: track.uri,
          } : null,
        }));
      });

      player.connect();
      playerRef.current = player;
    };

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [accessToken]);

  const login = useCallback(() => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('spotify_access_token');
    setAccessToken(null);
    setState({
      isAuthenticated: false,
      isPlaying: false,
      currentTrack: null,
      position: 0,
      device_id: null,
    });
    if (playerRef.current) {
      playerRef.current.disconnect();
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: state.isPlaying ? 'PUT' : 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (state.isPlaying) {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [accessToken, state.isPlaying]);

  const skipNext = useCallback(async () => {
    if (!accessToken) return;

    try {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error skipping track:', error);
    }
  }, [accessToken]);

  const skipPrevious = useCallback(async () => {
    if (!accessToken) return;

    try {
      await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error going to previous track:', error);
    }
  }, [accessToken]);

  const seek = useCallback(async (positionMs: number) => {
    if (!accessToken) return;

    try {
      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, [accessToken]);

  return {
    ...state,
    login,
    logout,
    togglePlay,
    skipNext,
    skipPrevious,
    seek,
  };
};
