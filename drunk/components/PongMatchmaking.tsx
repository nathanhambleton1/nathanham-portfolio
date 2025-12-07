import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Trophy, Users } from "lucide-react";

interface PongMatchmakingProps {
  players: any[];
  onTeamsCreated: (teams: { team1: string[], team2: string[] }[]) => void;
}

export const PongMatchmaking = ({ players, onTeamsCreated }: PongMatchmakingProps) => {
  const [rankings, setRankings] = useState<string[]>(players.map(p => p.id));
  
  const generatePongTeams = () => {
    if (players.length < 4) {
      return;
    }

    // Snake draft based on skill ranking
    // Top players get paired with bottom players for balance
    const sorted = [...rankings];
    const teams: { team1: string[], team2: string[] }[] = [];
    
    // For beer pong, create pairs (2v2)
    // Strategy: pair best with worst for balance
    const numPairs = Math.floor(sorted.length / 2);
    
    for (let i = 0; i < numPairs; i += 2) {
      if (i + 1 < numPairs) {
        const team1 = [
          players.find(p => p.id === sorted[i])?.name,
          players.find(p => p.id === sorted[sorted.length - 1 - i])?.name
        ].filter(Boolean);
        
        const team2 = [
          players.find(p => p.id === sorted[i + 1])?.name,
          players.find(p => p.id === sorted[sorted.length - 2 - i])?.name
        ].filter(Boolean);
        
        if (team1.length === 2 && team2.length === 2) {
          teams.push({ team1, team2 });
        }
      }
    }
    
    onTeamsCreated(teams);
  };

  const movePlayerUp = (index: number) => {
    if (index === 0) return;
    const newRankings = [...rankings];
    [newRankings[index - 1], newRankings[index]] = [newRankings[index], newRankings[index - 1]];
    setRankings(newRankings);
  };

  const movePlayerDown = (index: number) => {
    if (index === rankings.length - 1) return;
    const newRankings = [...rankings];
    [newRankings[index], newRankings[index + 1]] = [newRankings[index + 1], newRankings[index]];
    setRankings(newRankings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Pong Skill-Based Matchmaking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Rank Players (Best to Worst)</Label>
          <div className="space-y-2">
            {rankings.map((playerId, index) => {
              const player = players.find(p => p.id === playerId);
              if (!player) return null;
              
              return (
                <div key={playerId} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600">#{index + 1}</span>
                    <span>{player.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => movePlayerUp(index)}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => movePlayerDown(index)}
                      disabled={index === rankings.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <Button 
          className="w-full" 
          onClick={generatePongTeams}
          disabled={players.length < 4}
        >
          <Users className="w-4 h-4 mr-2" />
          Generate Balanced Matchups
        </Button>
      </CardContent>
    </Card>
  );
};
