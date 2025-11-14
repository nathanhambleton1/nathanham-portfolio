import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface GameCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

export const GameCard = ({ title, description, icon: Icon, path }: GameCardProps) => {
  return (
    <Link to={path} className="block">
      <Card className="bg-gradient-card border-border hover:shadow-glow hover:scale-105 transition-all duration-300 cursor-pointer p-6 h-full">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
};
