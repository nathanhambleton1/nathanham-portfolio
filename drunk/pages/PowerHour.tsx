// TypeScript interfaces for Wake Lock API
interface WakeLockSentinel extends EventTarget {
  release: () => Promise<void>;
  type: 'screen' | 'system';
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface Navigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
}
import { useState, useEffect, useRef } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const PowerHour = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // interval between sips in seconds (default 60 = 1:00)
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Web Audio API refs for mixing where supported
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  // Wake lock / keep-awake refs
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoFallbackRef = useRef<HTMLVideoElement | null>(null);
  // refs for scheduling sips (works with fixed or random intervals)
  const previousMinute = useRef(0);
  const nextSipAtRef = useRef<number>(60);
  const lastSipAtRef = useRef<number>(0);
  const currentIntervalRef = useRef<number>(60);
  const sipCountRef = useRef<number>(0);
  const [sipCount, setSipCount] = useState(0);
  const [randomMode, setRandomMode] = useState(false);
  // Wake lock is enabled automatically (always on)

  const formatInterval = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m)}:${String(s).padStart(2, "0")}`;
  };
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };
  const currentSip = sipCount + (elapsedSeconds < nextSipAtRef.current ? 1 : 0);
  const currentInterval = currentIntervalRef.current || intervalSeconds;
  const progress = Math.max(0, Math.min(100, ((elapsedSeconds - lastSipAtRef.current) / currentInterval) * 100));
  const displayMinutes = Math.floor(elapsedSeconds / 60);
  const displaySeconds = elapsedSeconds % 60;

  const secondsUntilNext = Math.max(0, Math.ceil((nextSipAtRef.current || currentInterval) - elapsedSeconds));
  const totalRemaining = Math.max(0, 3600 - elapsedSeconds);

  const minRandom = 30;
  const maxRandom = 120;
  const randBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const totalSips = randomMode ? undefined : Math.floor(3600 / intervalSeconds);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = Date.now();
    const totalDuration = 3600;

    const updateTimer = () => {
      const now = Date.now();
      const delta = now - lastTime;

      if (delta >= 1000) { // Update every second
        lastTime = now - (delta % 1000); // Compensate for drift

        setElapsedSeconds((prev) => {
          const newSeconds = prev + 1;

          // If we haven't scheduled nextSipAt yet (fresh start), ensure it's set
          if (!nextSipAtRef.current) {
            const firstInterval = randomMode ? randBetween(minRandom, maxRandom) : intervalSeconds;
            currentIntervalRef.current = firstInterval;
            nextSipAtRef.current = firstInterval;
          }

          // Check if we've reached or passed the next scheduled sip
          if (newSeconds >= nextSipAtRef.current && newSeconds <= totalDuration) {
            sipCountRef.current += 1;
            setSipCount(sipCountRef.current);
            playBeep();
            toast.success(`Sip ${sipCountRef.current}!`, {
              description: "Take a sip! 🍺",
            });

            lastSipAtRef.current = nextSipAtRef.current;
            if (randomMode) {
              const nextInterval = randBetween(minRandom, maxRandom);
              currentIntervalRef.current = nextInterval;
              nextSipAtRef.current = lastSipAtRef.current + nextInterval;
            } else {
              currentIntervalRef.current = intervalSeconds;
              nextSipAtRef.current = lastSipAtRef.current + intervalSeconds;
            }
          }

          // If we've reached the end of the hour
          if (newSeconds >= totalDuration && !isComplete) {
            setIsRunning(false);
            setIsComplete(true);
            toast.success("Power Hour Complete! 🎉", {
              description: `You made it through ${sipCountRef.current} sips!`,
            });
          }

          return newSeconds;
        });
      }

      if (isRunning && elapsedSeconds < totalDuration) {
        animationFrameId = requestAnimationFrame(updateTimer);
      }
    };

    if (isRunning && elapsedSeconds < totalDuration) {
      animationFrameId = requestAnimationFrame(updateTimer);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isRunning, elapsedSeconds, isComplete, soundEnabled, audioUnlocked]);

  // Manage wake lock when preference or running state changes
  // Acquire wake lock on mount and re-acquire on visibility change.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible - reacquiring wake lock');
        await acquireWakeLock();
      }
    };

    // Try to acquire immediately when the component mounts
    void acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      void releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void releaseWakeLock();
    };
  }, []);

  const playBeep = () => {
    if (!soundEnabled) return;
    // Attempt to use WebAudio if available and ready, otherwise fallback
    (async () => {
      // Ensure audio systems are ready (resume suspended contexts, etc.)
      await ensureAudioReady();

      const ctx = audioCtxRef.current;
      const buffer = beepBufferRef.current;
      if (ctx && buffer) {
        try {
          if (ctx.state === "suspended") {
            try {
              await ctx.resume();
            } catch (e) {
              console.warn("Failed to resume AudioContext before beep:", e);
            }
          }

          const src = ctx.createBufferSource();
          src.buffer = buffer;
          if (gainNodeRef.current) src.connect(gainNodeRef.current);
          else src.connect(ctx.destination);
          src.start();
          return;
        } catch (err) {
          console.warn("WebAudio beep play failed:", err);
          // fallback to audio element
          await playAudioElementFallback();
          return;
        }
      }

      // Fallback: play the audio element
      await playAudioElementFallback();
    })();
  };

  const playAudioElementFallback = () => {
    // Return a Promise so callers can await retries
    return new Promise<void>((resolve) => {
      if (!audioRef.current) return resolve();
      const el = audioRef.current;
      try {
        el.pause();
        el.currentTime = 0;
        // Some platforms require `load()` before play after source change
        try {
          el.load();
        } catch {}

        const p = el.play();
        if (p && typeof p.then === "function") {
          p
            .then(() => {
              // immediately pause so we don't overlap if this was only an unlock
              // but do not pause if the user expects to hear the beep now (we just played it)
              // small delay to ensure the beeper finishes when appropriate
              resolve();
            })
            .catch((err) => {
              console.warn("Beep play failed (fallback):", err);
              // Try a quick unlock attempt: play/pause
              tryUnlockAudioElement();
              resolve();
            });
        } else {
          resolve();
        }
      } catch (error) {
        console.error("Error playing beep element:", error);
        resolve();
      }
    });
  };

  // Ensure audio context / element are in a usable state. Called on user gestures and before attempting playback.
  const ensureAudioReady = async () => {
    // If a Web Audio context exists and is suspended, try resuming it
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
        | typeof AudioContext
        | undefined;

      if (!audioCtxRef.current && Ctx) {
        audioCtxRef.current = new Ctx();
        gainNodeRef.current = audioCtxRef.current.createGain();
        gainNodeRef.current.gain.value = 1.0;
        gainNodeRef.current.connect(audioCtxRef.current.destination);
      }

      if (audioCtxRef.current) {
        if (audioCtxRef.current.state === "suspended") {
          try {
            await audioCtxRef.current.resume();
            setAudioUnlocked(true);
          } catch (err) {
            console.warn("Failed to resume audio context:", err);
          }
        }

        // If we don't have the buffer loaded yet, try to fetch/decode it (non-blocking)
        if (!beepBufferRef.current) {
          try {
            const base = (import.meta as any).env?.BASE_URL ?? "/";
            const url = `${base}beep.mp3`;
            const res = await fetch(url);
            const arr = await res.arrayBuffer();
            const decoded = await audioCtxRef.current.decodeAudioData(arr.slice(0));
            beepBufferRef.current = decoded;
            setAudioUnlocked(true);
          } catch (err) {
            console.warn("Failed to load beep buffer in ensureAudioReady:", err);
          }
        }
      }
    } catch (err) {
      console.warn("ensureAudioReady error:", err);
    }

    // Always attempt to unlock the audio element as well
    try {
      if (audioRef.current) {
        const el = audioRef.current;
        // If element is paused, try a quick muted play/pause to unlock
        if (el.paused) {
          try {
            const originallyMuted = el.muted;
            const originallyVolume = el.volume;
            el.muted = true;
            el.volume = 0;
            await el.play();
            el.pause();
            el.currentTime = 0;
            el.muted = originallyMuted;
            el.volume = originallyVolume;
            setAudioUnlocked(true);
          } catch (err) {
            // ignore: unlock may fail without gesture
          }
        }
      }
    } catch (err) {
      // ignore
    }
  };

  // Called on Start/Resume button pointer down to "unlock" audio on iOS and initialize WebAudio
  const initAudioOnGesture = () => {
    if (audioUnlocked) return;

    // First try to create/unlock the Web Audio API context so we can play
    // short sounds through it (this can allow mixing on some platforms).
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
          | typeof AudioContext
          | undefined;
        if (Ctx) {
          audioCtxRef.current = new Ctx();
          // create gain node for volume control
          gainNodeRef.current = audioCtxRef.current.createGain();
          gainNodeRef.current.gain.value = 1.0;
          gainNodeRef.current.connect(audioCtxRef.current.destination);
        }
      }

      // If we have a WebAudio context, fetch and decode the beep into a buffer.
      if (audioCtxRef.current && !beepBufferRef.current) {
        const base = (import.meta as any).env?.BASE_URL ?? "/";
        const url = `${base}beep.mp3`;
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((arr) => audioCtxRef.current!.decodeAudioData(arr))
          .then((decoded) => {
            beepBufferRef.current = decoded;
            setAudioUnlocked(true);
          })
          .catch((err) => {
            console.warn("Failed to load beep into WebAudio buffer:", err);
            // Fallback: try unlocking the audio element
            tryUnlockAudioElement();
          });
        return;
      }

      // If we reached here and WebAudio isn't available, fall back to unlocking the audio element
      tryUnlockAudioElement();
    } catch (err) {
      console.warn("initAudioOnGesture error:", err);
      tryUnlockAudioElement();
    }
  };

  const tryUnlockAudioElement = () => {
    // Try to unlock the audio element using a silent (muted) quick play/pause.
    // This is less likely to steal audio focus from background music players.
    if (!audioRef.current) return;
    const el = audioRef.current;
    try {
      const originallyMuted = el.muted;
      const originallyVolume = el.volume;
      // Mute and set volume very low to avoid interrupting other audio
      el.muted = true;
      el.volume = 0;
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p
          .then(() => {
            el.pause();
            el.currentTime = 0;
            // restore volume/mute
            el.muted = originallyMuted;
            el.volume = originallyVolume;
            setAudioUnlocked(true);
          })
          .catch((err) => {
            // restore and log
            el.muted = originallyMuted;
            el.volume = originallyVolume;
            console.warn("Initial audio unlock failed (muted attempt):", err);
          });
      }
    } catch (err) {
      console.warn("tryUnlockAudioElement error:", err);
    }
  };

  // Acquire a screen wake lock if available; otherwise try a silent video fallback.
  const acquireWakeLock = async () => {
    // Attempt to acquire wake lock regardless of app state (always-on behavior)
    
    try {
      // First, try to release any existing lock
      await releaseWakeLock();
      
      // Check if Wake Lock API is supported
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          
          // Listen for release events
          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake Lock was released');
            wakeLockRef.current = null;
          });
          
          console.log('Wake Lock is active');
          return;
        } catch (err: any) {
          console.warn(`Wake Lock request failed: ${err.name}, ${err.message}`);
        }
      }
      
      // Fallback: Use a no-sleep canvas technique (works in most browsers)
      startCanvasFallback();
      
    } catch (err) {
      console.warn('Failed to acquire wake lock:', err);
      startCanvasFallback();
    }
  };

  const startCanvasFallback = () => {
    try {
      // Create a hidden canvas that continuously animates
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.opacity = '0';
      canvas.style.pointerEvents = 'none';
      canvas.id = 'wake-lock-canvas';
      
      if (!document.getElementById('wake-lock-canvas')) {
        document.body.appendChild(canvas);
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Simple animation that runs continuously
      let frameId: number | null = null;
      const animate = () => {
        // Very light drawing that won't affect performance
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillRect(0, 0, 1, 1);

        // Request next frame - this keeps the screen awake
        frameId = requestAnimationFrame(animate);
        // Store the frame ID so we can cancel it later
        (canvas as any)._wakeLockFrameId = frameId;
      };

      animate();
      
    } catch (err) {
      console.warn('Canvas fallback failed:', err);
      startVisibilityFallback();
    }
  };

  // Another fallback: Use visibility API to reset timer on visibility change
  const startVisibilityFallback = () => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab is now visible again
        console.log('Tab became visible - ensuring timer integrity');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store reference to remove later
    (document as any)._visibilityHandler = handleVisibilityChange;
  };

  const releaseWakeLock = async () => {
    try {
      // Release the Wake Lock API if it exists
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      
      // Clean up canvas fallback
      const canvas = document.getElementById('wake-lock-canvas');
      if (canvas && (canvas as any)._wakeLockFrameId) {
        cancelAnimationFrame((canvas as any)._wakeLockFrameId);
      }
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Clean up visibility fallback
      if ((document as any)._visibilityHandler) {
        document.removeEventListener('visibilitychange', (document as any)._visibilityHandler);
        delete (document as any)._visibilityHandler;
      }
      
    } catch (err) {
      console.warn('Error releasing wake lock:', err);
    }
  };


  const handleStart = async () => {
    // Ensure audio is ready on each explicit start/resume (helps after source changes)
    await ensureAudioReady();
    setIsRunning(true);
    // Wake lock is managed automatically on mount/visibility; no manual action needed here
    if (elapsedSeconds === 0) {
      previousMinute.current = 0;
      // Play a confirmation beep when the session first starts
      playBeep();
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    // keep wake lock active (managed on mount/unmount)
    setElapsedSeconds(0);
    setIsComplete(false);
    previousMinute.current = 0;
    // reset scheduling refs and sip counters
    nextSipAtRef.current = randomMode ? randBetween(minRandom, maxRandom) : intervalSeconds;
    lastSipAtRef.current = 0;
    currentIntervalRef.current = randomMode ? nextSipAtRef.current : intervalSeconds;
    sipCountRef.current = 0;
    setSipCount(0);
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
      {/* Beep audio – BASE_URL handles GitHub Pages subpath like /drunk/power-hour */}
      <audio
        ref={audioRef}
        src={`${(import.meta as any).env?.BASE_URL ?? '/'}beep.mp3`}
        preload="auto"
        playsInline
      />

      <div className="container max-w-2xl mx-auto px-4 py-8 flex flex-col items-center justify-center">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Power Hour</h1>
          {randomMode ? (
            <p className="text-muted-foreground">Take a sip at random intervals (0:30–2:00) for 1 hour</p>
          ) : (
            <p className="text-muted-foreground">Take a sip every {formatInterval(intervalSeconds)} for {totalSips} sips</p>
          )}
        </div>

        <Card className="bg-gradient-card border-border p-8 mb-6">
          {/* Interval Selector */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {([60, 90, 120] as number[]).map((secs) => (
              <Button
                key={secs}
                onClick={() => {
                  if (isRunning) return;
                  setRandomMode(false);
                  setIntervalSeconds(secs);
                  setElapsedSeconds(0);
                  setIsComplete(false);
                  previousMinute.current = 0;
                  // reset scheduling refs
                  nextSipAtRef.current = secs;
                  lastSipAtRef.current = 0;
                  currentIntervalRef.current = secs;
                  sipCountRef.current = 0;
                  setSipCount(0);
                }}
                variant={intervalSeconds === secs && !randomMode ? undefined : "outline"}
                className={`px-4 py-2 ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isRunning}
              >
                {formatInterval(secs)}
              </Button>
            ))}

            <Button
              key="random"
              onClick={() => {
                if (isRunning) return;
                setRandomMode(true);
                setElapsedSeconds(0);
                setIsComplete(false);
                previousMinute.current = 0;
                const first = randBetween(minRandom, maxRandom);
                nextSipAtRef.current = first;
                lastSipAtRef.current = 0;
                currentIntervalRef.current = first;
                sipCountRef.current = 0;
                setSipCount(0);
              }}
              variant={randomMode ? undefined : "outline"}
              className={`px-4 py-2 ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={isRunning}
            >
              Random
            </Button>
          </div>

          {/* Timer Display */}
          <div className="text-center mb-8">
            {isComplete ? (
                <div className="animate-pulse-glow">
                  <p className="text-6xl font-bold text-primary mb-2">Complete! 🎉</p>
                  <p className="text-xl text-muted-foreground">You made it through {sipCount} sips!</p>
                </div>
              ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">Total remaining: {formatTime(totalRemaining)}</p>
                    <p className="text-lg font-medium text-primary mb-2">
                      {totalSips ? `Sip ${currentSip} / ${totalSips}` : `Sip ${currentSip}`}
                    </p>
                    <p className="text-6xl text-foreground font-mono font-bold">
                      {formatTime(secondsUntilNext)}
                    </p>
                  </>
                )}
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-1000 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center mb-6">
            {!isRunning ? (
              <Button
                onPointerDown={initAudioOnGesture}
                onTouchStart={initAudioOnGesture}
                onMouseDown={initAudioOnGesture}
                onClick={handleStart}
                className="bg-white text-black hover:bg-gray-100 px-8 py-6 text-lg border border-gray-300 shadow"
                disabled={isComplete}
              >
                <Play className="w-5 h-5 mr-2" />
                {elapsedSeconds === 0 ? "Start" : "Resume"}
              </Button>
            ) : (
              <Button
                onClick={handlePause}
                className="bg-white text-black hover:bg-gray-100 px-8 py-6 text-lg border border-gray-300 shadow"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              onClick={handleReset}
              variant="outline"
              className="px-8 py-6 text-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-center gap-3 pt-10">
            <Switch
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
            <Label htmlFor="sound-toggle" className="text-base cursor-pointer">
              Sound: {soundEnabled ? "On" : "Off"}
            </Label>
          </div>
          {/* Spacer for gap */}
          <div className="py-2" />
          {/* Short sound hint with info icon, only shown if sound is enabled */}
          {soundEnabled && (
            <div className="flex flex-col items-center justify-center pt-8">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {/* Info/hint icon (SVG) */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4" />
                  <circle cx="12" cy="8" r="1" fill="currentColor" />
                </svg>
                No sound? Turn on your ringer.
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PowerHour;
