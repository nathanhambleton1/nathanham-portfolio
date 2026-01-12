import { useTheme, ThemeName } from '@/contexts/ThemeContext';
import { Palette } from 'lucide-react';

const themeOptions: { value: ThemeName; label: string; color: string }[] = [
  { value: 'dark', label: 'Dark', color: 'hsl(250, 24%, 9%)' },
  { value: 'light', label: 'Light', color: 'hsl(0, 0%, 100%)' },
  { value: 'red', label: 'Red', color: 'hsl(0, 84%, 60%)' },
  { value: 'blue', label: 'Blue', color: 'hsl(210, 100%, 60%)' },
  { value: 'green', label: 'Green', color: 'hsl(142, 76%, 45%)' },
];

export const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
      <div className="flex-1">
        <div className="font-medium text-sm flex items-center gap-2">
          <Palette size={16} />
          Theme
        </div>
      </div>
      <div className="flex gap-2">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`
              w-8 h-8 rounded-full border-2 transition-all
              ${theme === option.value 
                ? 'border-primary scale-110 shadow-lg' 
                : 'border-border hover:border-primary/50 hover:scale-105'
              }
            `}
            style={{ backgroundColor: option.color }}
            title={option.label}
            aria-label={`Select ${option.label} theme`}
          >
            {theme === option.value && (
              <span className="sr-only">Selected</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
