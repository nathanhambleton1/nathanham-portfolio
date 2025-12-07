import { useState, useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Award } from "lucide-react";

interface ManualScoringProps {
  players: any[]; // players in preferred display/order
  event: any;
  onScoresSaved: (scores: { playerId: string, points: number, ranking: number }[]) => void;
}

export const ManualScoring = ({ players, event, onScoresSaved }: ManualScoringProps) => {
  const [orderedPlayers, setOrderedPlayers] = useState<any[]>(players || []);
  const draggingRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    // Update the local order when parent players change unless user is actively dragging
    // or we recently saved (within 500ms) to avoid feedback loops
    const timeSinceUpdate = Date.now() - lastUpdateRef.current;
    if (!draggingRef.current && timeSinceUpdate > 500) {
      setOrderedPlayers(players || []);
    }
  }, [players]);

  const calculatePoints = (positionIndex: number, playerCount?: number): number => {
    if (!event) return 0;
    const ranking = positionIndex + 1; // positionIndex 0 -> rank 1
    const totalPlayers = playerCount !== undefined ? playerCount : (orderedPlayers && orderedPlayers.length) || players.length || 0;

    if (event.point_mode === 'ranking' || (event.pointMode && event.pointMode === 'ranking')) {
      return Math.max(0, totalPlayers - (ranking - 1));
    }

    switch (ranking) {
      case 1: return event.first_place_points || 5;
      case 2: return event.second_place_points || 3;
      case 3: return event.third_place_points || 2;
      case 4: return event.fourth_place_points || 1;
      case 5: return event.fifth_place_points || 1;
      default: return 0;
    }
  };

  const onDragEnd = (result: DropResult) => {
    draggingRef.current = false;
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    if (src === dst) return;
    const next = Array.from(orderedPlayers);
    const [moved] = next.splice(src, 1);
    next.splice(dst, 0, moved);
    setOrderedPlayers(next);
    
    // Mark the time of this update to prevent feedback loops
    lastUpdateRef.current = Date.now();
    
    // Save the new ordering immediately with the updated list
    const scores = next.map((p, idx) => ({
      playerId: p.id,
      points: calculatePoints(idx, next.length),
      ranking: idx + 1,
    }));
    onScoresSaved(scores);
  };

  const onDragStart = () => {
    draggingRef.current = true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Enter Rankings (drag to reorder)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
            <Droppable droppableId="ranking-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {orderedPlayers.map((p, idx) => (
                    <Draggable key={p.id} draggableId={String(p.id)} index={idx}>
                      {(dr, snapshot) => (
                        <div
                          ref={dr.innerRef}
                          {...dr.draggableProps}
                          {...dr.dragHandleProps}
                          className={`flex items-center justify-between p-3 border rounded bg-amber-50 text-amber-900 border-amber-200 transition-shadow ${snapshot.isDragging ? 'ring-2 ring-amber-300 bg-amber-100 shadow-md' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-amber-700">#{idx + 1}</span>
                            <div className="font-medium text-amber-900">{p.name}</div>
                          </div>
                          <div className="text-sm text-amber-700">{calculatePoints(idx)} pts</div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </CardContent>
    </Card>
  );
};
