import React, { useState } from "react";
import { Palette } from "lucide-react";
import { useTheme, ThemeName } from '@/contexts/ThemeContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  logo: string;
  title: string;
}

const themeOptions: { value: ThemeName; label: string; color: string }[] = [
  { value: 'dark', label: 'Dark', color: 'hsl(250, 24%, 9%)' },
  { value: 'light', label: 'Light', color: 'hsl(0, 0%, 100%)' },
  { value: 'red', label: 'Red', color: 'hsl(0, 84%, 60%)' },
  { value: 'blue', label: 'Blue', color: 'hsl(210, 100%, 60%)' },
  { value: 'green', label: 'Green', color: 'hsl(142, 76%, 45%)' },
];

const Header: React.FC<HeaderProps> = ({ logo, title }) => {
  const { theme, setTheme } = useTheme();
  
  return (
    <header className="flex items-center gap-4 py-4 px-6 border-b border-border bg-card/40 backdrop-blur-md">
      <img src={logo} alt="Logo" className="h-10 w-10 rounded-lg shadow" />
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <div className="ml-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
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
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-md text-sm flex-1 min-w-[45%] transition-all
                      ${theme === option.value 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                      }
                    `}
                    title={option.label}
                  >
                    <div 
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
      </div>
    </header>
  );
};

export default Header;
