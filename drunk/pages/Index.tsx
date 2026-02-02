import { GameCard } from "../components/GameCard";
import { Clock, Trophy, Crown, Dices, Users, Award } from "lucide-react";

const Index = () => {
  const games = [
    {
      title: "Drunkopoly",
      description: "Monopoly with a drinking twist.",
      icon: Crown,
      path: "drunkopoly",
    },
    {
      title: "Power Hour",
      description: "Sip of beer every minute for an hour.",
      icon: Clock,
      path: "power-hour",
    },
    {
      title: "Beer Ball",
      description: "Organize teams and create match schedules.",
      icon: Users,
      path: "beer-ball",
    },
    {
      title: "King's Cup Tracker",
      description: "Draw cards and see the rules.",
      icon: Crown,
      path: "kings-cup",
    },
    {
      title: "Beer Pong Scoreboard",
      description: "Track cups and scores for beer pong.",
      icon: Trophy,
      path: "beer-pong",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-bg pb-24">
      <div className="container max-w-2xl mx-auto px-4 py-16 pb-24">
        <header className="text-center mb-12 animate-slide-up pt-1 pb-8">
        </header>
        {/* Game Cards */}
        <div className="grid gap-4 mb-12">
          {games.map((game, index) => (
            <div
              key={game.path}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <GameCard {...game} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
