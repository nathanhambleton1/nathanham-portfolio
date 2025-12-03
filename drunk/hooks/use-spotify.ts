import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

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
  error: string | null;
}

export const useSpotify = () => {
  const [state, setState] = useState<SpotifyState>({
    isAuthenticated: false,
    isPlaying: false,
    currentTrack: null,
    position: 0,
    device_id: null,
    error: null,
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const deviceIdRef = useRef<string | null>(null);
  const tokenValidatedRef = useRef<boolean>(false);

  // Validate token with Spotify API
  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return true;
      } else if (response.status === 401) {
        console.warn('Spotify token is invalid or expired');
        return false;
      } else {
        console.error('Error validating token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Network error validating token:', error);
      return false;
    }
  }, []);

  // Check for token in URL or localStorage
  useEffect(() => {
    const hash = window.location.hash;
    let token = localStorage.getItem('spotify_access_token');

    if (!token && hash) {
      const params = new URLSearchParams(hash.substring(1));
      const urlToken = params.get('access_token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (error) {
        const errorMsg = errorDescription || error;
        console.error('Spotify OAuth error:', errorMsg);
        toast.error('Spotify Connection Failed', {
          description: `Unable to connect: ${errorMsg}. Please try again.`,
        });
        setState(prev => ({ ...prev, error: errorMsg }));
        // Clear the error from URL
        window.location.hash = '';
        // Clear any stale token
        localStorage.removeItem('spotify_access_token');
        return;
      }
      
      if (urlToken) {
        token = urlToken;
        localStorage.setItem('spotify_access_token', urlToken);
        window.location.hash = ''; // Clear the hash
        toast.success('Spotify Connected', {
          description: 'Successfully authenticated with Spotify',
        });
      }
    }

    if (token && !tokenValidatedRef.current) {
      // Validate the token before using it
      validateToken(token).then(isValid => {
        tokenValidatedRef.current = true;
        if (isValid) {
          setAccessToken(token);
          setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('spotify_access_token');
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: false,
            error: 'Your Spotify session has expired. Please reconnect.',
          }));
          toast.error('Spotify Session Expired', {
            description: 'Please reconnect to Spotify to continue.',
          });
        }
      });
    }
  }, [validateToken]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!accessToken) return;

    // Check if SDK is already loaded
    if ((window as any).Spotify) {
      initializePlayer();
      return;
    }

    // Load Spotify SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    
    script.onerror = () => {
      console.error('Failed to load Spotify SDK');
      toast.error('Spotify SDK Error', {
        description: 'Failed to load Spotify player. Please check your internet connection and try again.',
      });
      setState(prev => ({ ...prev, error: 'Failed to load Spotify SDK' }));
    };
    
    document.body.appendChild(script);

    function initializePlayer() {
      try {
        const player = new (window as any).Spotify.Player({
          name: 'Power Hour Player',
          getOAuthToken: (cb: (token: string) => void) => {
            if (accessToken) cb(accessToken);
          },
          volume: 0.5,
        });

        // Ready
        player.addListener('ready', ({ device_id }: any) => {
          console.log('Ready with Device ID', device_id);
          deviceIdRef.current = device_id;
          setState(prev => ({ ...prev, device_id, error: null }));
          toast.success('Spotify Player Ready', {
            description: 'Your Spotify player is ready to use',
          });
        });

        // Not Ready
        player.addListener('not_ready', ({ device_id }: any) => {
          console.log('Device ID has gone offline', device_id);
          toast.error('Spotify Player Offline', {
            description: 'Your Spotify player has gone offline',
          });
        });

        // Authentication error
        player.addListener('authentication_error', ({ message }: any) => {
          console.error('Spotify authentication error:', message);
          localStorage.removeItem('spotify_access_token');
          setAccessToken(null);
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: false,
            error: 'Authentication failed. Please reconnect.',
          }));
          toast.error('Spotify Authentication Error', {
            description: 'Your session has expired. Please reconnect to Spotify.',
          });
        });

        // Account error
        player.addListener('account_error', ({ message }: any) => {
          console.error('Spotify account error:', message);
          toast.error('Spotify Account Error', {
            description: message || 'There was an issue with your Spotify account',
          });
        });

        // Playback error
        player.addListener('playback_error', ({ message }: any) => {
          console.error('Spotify playback error:', message);
          toast.error('Playback Error', {
            description: message || 'Unable to play track',
          });
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
      } catch (error) {
        console.error('Error initializing Spotify player:', error);
        toast.error('Spotify Player Error', {
          description: 'Failed to initialize Spotify player. Please try reconnecting.',
        });
        setState(prev => ({ ...prev, error: 'Failed to initialize player' }));
      }
    }

    (window as any).onSpotifyWebPlaybackSDKReady = initializePlayer;

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [accessToken]);

  const login = useCallback(() => {
    if (!CLIENT_ID) {
      toast.error('Configuration Error', {
        description: 'Spotify Client ID is not configured. Please contact support.',
      });
      console.error('VITE_SPOTIFY_CLIENT_ID is not set');
      return;
    }
    
    console.log('CLIENT_ID:', CLIENT_ID);
    console.log('REDIRECT_URI:', REDIRECT_URI);
    
    // Clear any previous errors
    setState(prev => ({ ...prev, error: null }));
    tokenValidatedRef.current = false;
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    console.log('Spotify Auth URL:', authUrl);
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('spotify_access_token');
    setAccessToken(null);
    tokenValidatedRef.current = false;
    setState({
      isAuthenticated: false,
      isPlaying: false,
      currentTrack: null,
      position: 0,
      device_id: null,
      error: null,
    });
    if (playerRef.current) {
      playerRef.current.disconnect();
    }
    toast.success('Disconnected from Spotify', {
      description: 'You have been logged out of Spotify',
    });
  }, []);

  const handleApiError = useCallback(async (response: Response, action: string) => {
    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid
      localStorage.removeItem('spotify_access_token');
      setAccessToken(null);
      tokenValidatedRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false,
        error: 'Session expired',
      }));
      toast.error('Spotify Session Expired', {
        description: 'Please reconnect to Spotify to continue.',
      });
      return true;
    } else if (response.status === 404) {
      toast.error('No Active Device', {
        description: 'Please start playback on a Spotify device first.',
      });
      return true;
    } else if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error ${action}:`, response.status, errorText);
      toast.error('Spotify Error', {
        description: `Unable to ${action}. Please try again.`,
      });
      return true;
    }
    return false;
  }, []);

  const togglePlay = useCallback(async () => {
    if (!accessToken) {
      toast.error('Not Connected', {
        description: 'Please connect to Spotify first.',
      });
      return;
    }

    try {
      const endpoint = state.isPlaying ? 'pause' : 'play';
      const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      await handleApiError(response, endpoint);
    } catch (error) {
      console.error('Error toggling playback:', error);
      toast.error('Network Error', {
        description: 'Unable to connect to Spotify. Please check your internet connection.',
      });
    }
  }, [accessToken, state.isPlaying, handleApiError]);

  const skipNext = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      await handleApiError(response, 'skip track');
    } catch (error) {
      console.error('Error skipping track:', error);
      toast.error('Network Error', {
        description: 'Unable to skip track. Please check your connection.',
      });
    }
  }, [accessToken, handleApiError]);

  const skipPrevious = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      await handleApiError(response, 'go to previous track');
    } catch (error) {
      console.error('Error going to previous track:', error);
      toast.error('Network Error', {
        description: 'Unable to go to previous track. Please check your connection.',
      });
    }
  }, [accessToken, handleApiError]);

  const seek = useCallback(async (positionMs: number) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      await handleApiError(response, 'seek');
    } catch (error) {
      console.error('Error seeking:', error);
      toast.error('Network Error', {
        description: 'Unable to seek. Please check your connection.',
      });
    }
  }, [accessToken, handleApiError]);

  // Clear error when user interacts
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Log state for debugging
  useEffect(() => {
    console.log('[Spotify] isAuthenticated:', state.isAuthenticated);
    console.log('[Spotify] isPlaying:', state.isPlaying);
    console.log('[Spotify] currentTrack:', state.currentTrack);
    console.log('[Spotify] position:', state.position);
    console.log('[Spotify] device_id:', state.device_id);
    if (state.error) {
      console.log('[Spotify] error:', state.error);
    }
  }, [state]);

  return {
    ...state,
    login,
    logout,
    togglePlay,
    skipNext,
    skipPrevious,
    seek,
    clearError,
  };
};
