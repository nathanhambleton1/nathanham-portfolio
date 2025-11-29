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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Web Audio API refs for mixing where supported
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  // refs for scheduling sips (works with fixed or random intervals)
  const previousMinute = useRef(0);
  const nextSipAtRef = useRef<number>(60);
  const lastSipAtRef = useRef<number>(0);
  const currentIntervalRef = useRef<number>(60);
  const sipCountRef = useRef<number>(0);
  const [sipCount, setSipCount] = useState(0);
  const [randomMode, setRandomMode] = useState(false);

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
    let interval: NodeJS.Timeout;

    const totalDuration = 3600; // always run for one hour

    if (isRunning && elapsedSeconds < totalDuration) {
      interval = setInterval(() => {
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
            // increment sip counters
            sipCountRef.current += 1;
            setSipCount(sipCountRef.current);

            // play beep + toast
            playBeep();
            toast.success(`Sip ${sipCountRef.current}!`, {
              description: "Take a sip! 🍺",
            });

            // move last sip time and schedule next sip
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
      }, 1000);
    } else if (elapsedSeconds >= totalDuration && !isComplete) {
      setIsRunning(false);
      setIsComplete(true);
      toast.success("Power Hour Complete! 🎉", {
        description: `You made it through ${sipCountRef.current} sips!`,
      });
    }

    return () => clearInterval(interval);
  }, [isRunning, elapsedSeconds, isComplete, soundEnabled, audioUnlocked]);

  const playBeep = () => {
    if (!soundEnabled) return;

    // Prefer Web Audio API buffer playback (may mix on many platforms).
    const ctx = audioCtxRef.current;
    const buffer = beepBufferRef.current;
    if (ctx && buffer) {
      try {
        // Create a one-shot buffer source
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        // connect to gain if present
        if (gainNodeRef.current) src.connect(gainNodeRef.current);
        else src.connect(ctx.destination);
        // start immediately
        src.start();
      } catch (err) {
        console.warn("WebAudio beep play failed:", err);
        // fallback to audio element
        playAudioElementFallback();
      }
      return;
    }

    // Fallback: play the audio element
    playAudioElementFallback();
  };

  const playAudioElementFallback = () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise) playPromise.catch((err) => console.warn("Beep play failed:", err));
    } catch (error) {
      console.error("Error playing beep element:", error);
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
    if (!audioRef.current) return;
    const el = audioRef.current;
    el.currentTime = 0;
    const playPromise = el.play();
    if (playPromise) {
      playPromise
        .then(() => {
          el.pause();
          el.currentTime = 0;
          setAudioUnlocked(true);
        })
        .catch((err) => {
          console.warn("Initial audio unlock failed:", err);
        });
    }
  };

  const handleStart = () => {
    setIsRunning(true);
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
        </Card>
      </div>
    </div>
  );
};

export default PowerHour;
