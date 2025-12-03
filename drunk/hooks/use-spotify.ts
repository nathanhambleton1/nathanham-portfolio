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

// PKCE helper functions
const generateRandomString = (length: number): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current playback state from Spotify API
  const fetchPlaybackState = useCallback(async (token: string): Promise<void> => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 204) {
        // No active playback
        setState(prev => ({
          ...prev,
          currentTrack: null,
          isPlaying: false,
          position: 0,
        }));
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired
          localStorage.removeItem('spotify_access_token');
          localStorage.removeItem('spotify_refresh_token');
          localStorage.removeItem('spotify_token_expiry');
          setAccessToken(null);
          tokenValidatedRef.current = false;
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: false,
            error: 'Session expired',
          }));
        }
        return;
      }

      const data = await response.json();
      
      if (data.item) {
        setState(prev => ({
          ...prev,
          currentTrack: {
            name: data.item.name,
            artists: data.item.artists.map((a: any) => a.name),
            album: data.item.album.name,
            albumArt: data.item.album.images[0]?.url || '',
            duration: data.item.duration_ms,
            uri: data.item.uri,
          },
          isPlaying: data.is_playing,
          position: data.progress_ms || 0,
        }));
      } else {
        setState(prev => ({
          ...prev,
          currentTrack: null,
          isPlaying: false,
          position: 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching playback state:', error);
    }
  }, []);

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

  // Exchange authorization code for access token
  const exchangeCodeForToken = useCallback(async (code: string) => {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('No code verifier found');
      return;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to exchange code for token');
      }

      const data = await response.json();
      const token = data.access_token;
      const refreshToken = data.refresh_token;
      const expiresIn = data.expires_in;

      // Store tokens and expiry
      localStorage.setItem('spotify_access_token', token);
      if (refreshToken) {
        localStorage.setItem('spotify_refresh_token', refreshToken);
      }
      localStorage.setItem('spotify_token_expiry', String(Date.now() + expiresIn * 1000));
      localStorage.removeItem('spotify_code_verifier');

      setAccessToken(token);
      setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
      toast.success('Spotify Connected', {
        description: 'Successfully authenticated with Spotify',
      });
    } catch (error: any) {
      console.error('Error exchanging code for token:', error);
      toast.error('Spotify Connection Failed', {
        description: error.message || 'Unable to complete authentication',
      });
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, []);

  // Check for authorization code or token in URL/localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      const errorMsg = errorDescription || error;
      console.error('Spotify OAuth error:', errorMsg);
      toast.error('Spotify Connection Failed', {
        description: `Unable to connect: ${errorMsg}. Please try again.`,
      });
      setState(prev => ({ ...prev, error: errorMsg }));
      // Clear the error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code) {
      // Exchange authorization code for access token
      exchangeCodeForToken(code);
      // Clear the code from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check for existing token
    const token = localStorage.getItem('spotify_access_token');
    const tokenExpiry = localStorage.getItem('spotify_token_expiry');

    if (token && tokenExpiry && !tokenValidatedRef.current) {
      const expiryTime = parseInt(tokenExpiry, 10);
      if (Date.now() < expiryTime) {
        // Token is still valid
        validateToken(token).then(isValid => {
          tokenValidatedRef.current = true;
          if (isValid) {
            setAccessToken(token);
            setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
            // Immediately fetch current playback state
            fetchPlaybackState(token);
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_refresh_token');
            localStorage.removeItem('spotify_token_expiry');
            setState(prev => ({ 
              ...prev, 
              isAuthenticated: false,
              error: 'Your Spotify session has expired. Please reconnect.',
            }));
          }
        });
      } else {
        // Token expired, try to refresh
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (refreshToken) {
          // TODO: Implement token refresh
          console.log('Token expired, need to refresh');
        }
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
      }
    }
  }, [validateToken, exchangeCodeForToken, fetchPlaybackState]);

  // Poll playback state when authenticated
  useEffect(() => {
    if (!accessToken || !state.isAuthenticated) {
      // Clear polling when not authenticated
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Fetch immediately
    fetchPlaybackState(accessToken);

    // Then poll every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchPlaybackState(accessToken);
    }, 1000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [accessToken, state.isAuthenticated, fetchPlaybackState]);

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
            description: 'Your Spotify player is now ready',
          });
          
          // Immediately fetch current playback state
          if (accessToken) {
            fetchPlaybackState(accessToken);
          }
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
  }, [accessToken, fetchPlaybackState]);

  const login = useCallback(async () => {
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
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    
    // Store code verifier for later use
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    
    // Use Authorization Code flow with PKCE
    const authUrl = `https://accounts.spotify.com/authorize?` +
      `client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&code_challenge_method=S256` +
      `&code_challenge=${codeChallenge}`;
    
    console.log('Spotify Auth URL:', authUrl);
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('spotify_code_verifier');
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

    if (!deviceIdRef.current) {
      toast.error('Player Not Ready', {
        description: 'Please wait for the Spotify player to initialize.',
      });
      return;
    }

    try {
      if (state.isPlaying) {
        // Pause playback
        const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok && response.status !== 204) {
          await handleApiError(response, 'pause');
        }
      } else {
        // Start/resume playback - transfer to this device if needed
        const response = await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            device_id: deviceIdRef.current,
          }),
        });

        if (response.status === 404) {
          // No active playback anywhere - need to start something
          toast.error('No Active Playback', {
            description: 'Please start playing music in Spotify first, then try again.',
          });
          return;
        }

        if (!response.ok && response.status !== 204) {
          await handleApiError(response, 'play');
        } else {
          // Successfully started playback, fetch updated state
          setTimeout(() => {
            if (accessToken) {
              fetchPlaybackState(accessToken);
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      toast.error('Network Error', {
        description: 'Unable to connect to Spotify. Please check your internet connection.',
      });
    }
  }, [accessToken, state.isPlaying, handleApiError, fetchPlaybackState]);

  const skipNext = useCallback(async () => {
    if (!accessToken) return;

    try {
      const deviceQuery = deviceIdRef.current ? `?device_id=${deviceIdRef.current}` : '';
      const response = await fetch(`https://api.spotify.com/v1/me/player/next${deviceQuery}`, {
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
      const deviceQuery = deviceIdRef.current ? `?device_id=${deviceIdRef.current}` : '';
      const response = await fetch(`https://api.spotify.com/v1/me/player/previous${deviceQuery}`, {
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
      const deviceQuery = deviceIdRef.current ? `&device_id=${deviceIdRef.current}` : '';
      const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}${deviceQuery}`, {
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
