import { Palette } from "lucide-react";
import { useTheme, ThemeName } from "@/contexts/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const themeOptions: { value: ThemeName; label: string; color: string }[] = [
  { value: "dark", label: "Dark", color: "hsl(250, 24%, 9%)" },
  { value: "light", label: "Light", color: "hsl(0, 0%, 100%)" },
  { value: "red", label: "Red", color: "hsl(0, 84%, 60%)" },
  { value: "blue", label: "Blue", color: "hsl(210, 100%, 60%)" },
  { value: "green", label: "Green", color: "hsl(142, 76%, 45%)" },
];

const ThemePicker = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose theme">
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-2">
          <p className="text-sm font-medium">Choose Theme</p>
          <div className="flex gap-2 flex-wrap">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm flex-1 min-w-[45%] transition-all ${
                  theme === option.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: option.color }}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemePicker;
