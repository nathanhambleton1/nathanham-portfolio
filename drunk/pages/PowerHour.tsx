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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const previousMinute = useRef(0);

  const currentMinute = Math.floor(elapsedSeconds / 60) + 1;
  const progress = ((elapsedSeconds % 60) / 60) * 100;
  const displayMinutes = Math.floor(elapsedSeconds / 60);
  const displaySeconds = elapsedSeconds % 60;

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && elapsedSeconds < 3600) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newSeconds = prev + 1;
          const newMinute = Math.floor(newSeconds / 60);

          // Check if we've hit a new minute
          if (newMinute > previousMinute.current && newMinute <= 60) {
            previousMinute.current = newMinute;
            playBeep();
            toast.success(`Minute ${newMinute}!`, {
              description: "Take a sip! 🍺",
            });
          }

          return newSeconds;
        });
      }, 1000);
    } else if (elapsedSeconds >= 3600 && !isComplete) {
      setIsRunning(false);
      setIsComplete(true);
      toast.success("Power Hour Complete! 🎉", {
        description: "You made it through all 60 minutes!",
      });
    }

    return () => clearInterval(interval);
  }, [isRunning, elapsedSeconds, isComplete, soundEnabled, audioUnlocked]);

  const playBeep = () => {
    if (!soundEnabled) return;
    if (!audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.catch((err) => {
          console.warn("Beep play failed:", err);
        });
      }
    } catch (error) {
      console.error("Error playing beep:", error);
    }
  };

  // Called on Start/Resume button pointer down to "unlock" audio on iOS
  const initAudioOnGesture = () => {
    if (!audioRef.current || audioUnlocked === true) return;

    const el = audioRef.current;
    el.currentTime = 0;

    const playPromise = el.play();
    if (playPromise) {
      playPromise
        .then(() => {
          // Immediately pause; we've now unlocked the audio element
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
          <p className="text-muted-foreground">Take a sip every minute for 60 minutes</p>
        </div>

        <Card className="bg-gradient-card border-border p-8 mb-6">
          {/* Timer Display */}
          <div className="text-center mb-8">
            {isComplete ? (
              <div className="animate-pulse-glow">
                <p className="text-6xl font-bold text-primary mb-2">Complete! 🎉</p>
                <p className="text-xl text-muted-foreground">You made it through all 60 minutes!</p>
              </div>
            ) : (
              <>
                <p className="text-4xl font-bold text-primary mb-2">
                  Minute {currentMinute} / 60
                </p>
                <p className="text-3xl text-foreground font-mono">
                  {String(displayMinutes).padStart(2, "0")}:
                  {String(displaySeconds).padStart(2, "0")}
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

        <div className="text-center text-sm text-muted-foreground">
          <p>Pro tip: Have your drinks ready before starting!</p>
        </div>
      </div>
    </div>
  );
};

export default PowerHour;
