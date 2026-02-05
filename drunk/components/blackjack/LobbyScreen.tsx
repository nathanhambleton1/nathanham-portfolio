import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Users, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";

interface BlackjackPlayer {
  id: string;
  name: string;
  is_dealer: boolean;
  balance: number;
  is_online: boolean;
  seat_position: number | null;
}

interface ChipRequest {
  id: string;
  player_id: string;
  amount: number;
  status: string;
}

interface BlackjackGame {
  code: string;
  name: string;
  settings: any;
  turn_order?: string[];
}

interface LobbyScreenProps {
  game: BlackjackGame;
  player: BlackjackPlayer;
  playersList: BlackjackPlayer[];
  chipRequests: ChipRequest[];
  setChipRequestDialogOpen: (open: boolean) => void;
  setChipRequestAmount: (amount: string) => void;
  onStartBetting: () => void;
  onApproveChipRequest: (requestId: string, approve: boolean) => void;
  onGiveChips: (playerId: string, amount: number) => void;
  onLogout: () => void;
  onSitAtTable?: () => void;
  copyInviteUrlToClipboard: () => void;
  onUpdatePlayerOrder?: (orderedPlayerIds: string[]) => void;
}

const LobbyScreen = ({
  game,
  player,
  playersList,
  chipRequests,
  setChipRequestDialogOpen,
  setChipRequestAmount,
  onStartBetting,
  onApproveChipRequest,
  onGiveChips,
  onLogout,
  onSitAtTable,
  copyInviteUrlToClipboard,
  onUpdatePlayerOrder,
}: LobbyScreenProps) => {
  const isDealer = player?.is_dealer;
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?code=${game?.code}` : '';

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Ordered non-dealer players (optimistic local state for immediate UI updates)
  const [orderedNonDealerPlayers, setOrderedNonDealerPlayers] = useState<BlackjackPlayer[]>([]);

  // Compute canonical ordering: prefer game.turn_order if set, otherwise use seat_position
  const computeOrdered = () => {
    const nd = playersList.filter(p => !p.is_dealer);
    if (game?.turn_order && game.turn_order.length > 0) {
      const ordered = game.turn_order
        .map((id: string) => nd.find(p => p.id === id))
        .filter(Boolean) as BlackjackPlayer[];
      const remaining = nd.filter(p => !(game.turn_order ?? []).includes(p.id));
      return [...ordered, ...remaining];
    }
    return nd.sort((a, b) => (a.seat_position || 0) - (b.seat_position || 0));
  };

  useEffect(() => {
    setOrderedNonDealerPlayers(computeOrdered());
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [playersList, game?.turn_order]);

  const applyReorder = (fromIndex: number, toIndex: number) => {
    if (!isDealer || !onUpdatePlayerOrder) return;
    if (fromIndex === toIndex) return;

    const reorderedPlayers = [...orderedNonDealerPlayers];
    const [draggedPlayer] = reorderedPlayers.splice(fromIndex, 1);
    reorderedPlayers.splice(toIndex, 0, draggedPlayer);

    // Optimistically update UI
    setOrderedNonDealerPlayers(reorderedPlayers);

    // Persist new order
    onUpdatePlayerOrder(reorderedPlayers.map(p => p.id));
  };

  const getIndexFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    const row = el?.closest?.('[data-player-index]') as HTMLElement | null;
    if (!row) return null;
    const idx = Number(row.dataset.playerIndex);
    return Number.isFinite(idx) ? idx : null;
  };

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (!isDealer || !onUpdatePlayerOrder) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggedIndex(index);
    setDragOverIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedIndex === null) return;
    const idx = getIndexFromPoint(e.clientX, e.clientY);
    if (idx === null) return;
    if (idx !== dragOverIndex) setDragOverIndex(idx);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedIndex === null) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    const dropIndex = dragOverIndex ?? draggedIndex;
    applyReorder(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gradient-bg p-4">
      <div className="max-w-2xl mx-auto space-y-4 pb-8">

        {/* Players List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Players ({orderedNonDealerPlayers.length})
            </CardTitle>
            {isDealer && orderedNonDealerPlayers.length > 1 && (
              <CardDescription>
                Drag players to set dealing order (top to bottom)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {orderedNonDealerPlayers.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No players yet. Share the code to invite players!
              </div>
            ) : (
              orderedNonDealerPlayers.map((p, index) => (
                <div
                  key={p.id}
                  data-player-index={index}
                  className={`flex items-center justify-between p-3 bg-muted rounded-lg transition-all ${
                    isDealer && onUpdatePlayerOrder ? 'cursor-move' : ''
                  } ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${
                    dragOverIndex === index ? 'border-2 border-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDealer && onUpdatePlayerOrder && (
                      <span
                        className="cursor-grab touch-none"
                        onPointerDown={(e) => handlePointerDown(e, index)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        aria-label="Reorder player"
                        role="button"
                        tabIndex={0}
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                      </span>
                    )}
                    <div className={`w-3 h-3 rounded-full ${p.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">#{index + 1}</span>
                        {p.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Balance: ${p.balance}
                      </div>
                    </div>
                  </div>
                  {isDealer && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGiveChips(p.id, 5)}
                      >
                        +$5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGiveChips(p.id, 10)}
                      >
                        +$10
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Chip Requests (Dealer Only) */}
        {isDealer && chipRequests.length > 0 && (
          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle>Chip Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {chipRequests.map((req) => {
                const requester = playersList.find(p => p.id === req.player_id);
                return (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-semibold">{requester?.name}</div>
                      <div className="text-sm text-muted-foreground">${req.amount}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onApproveChipRequest(req.id, true)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onApproveChipRequest(req.id, false)}>
                        Deny
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Your Info (Player) */}
        {!isDealer && player && (
          <Card>
            <CardContent className="space-y-3">
            </CardContent>
            <CardContent className="space-y-3">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => { setChipRequestAmount(""); setChipRequestDialogOpen(true); }}
              >
                Request Chips
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Table Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Table Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Decks:</span> {game.settings.num_decks}
              </div>
              <div>
                <span className="text-muted-foreground">Blackjack:</span> {game.settings.blackjack_payout}:1
              </div>
              <div>
                <span className="text-muted-foreground">Soft 17:</span>{' '}
                {game.settings.hit_on_soft_17 ? 'Hit' : 'Stand'}
              </div>
              <div>
                <span className="text-muted-foreground">Double:</span>{' '}
                {game.settings.double_down_enabled ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="text-muted-foreground">Split:</span>{' '}
                {game.settings.split_enabled ? `Yes (${game.settings.max_splits}x)` : 'No'}
              </div>
              <div>
                <span className="text-muted-foreground">Insurance:</span>{' '}
                {game.settings.insurance_enabled ? 'Yes' : 'No'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isDealer ? (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                size="lg"
                onClick={onStartBetting}
                disabled={orderedNonDealerPlayers.length === 0}
              >
                Start Betting Round
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-center text-muted-foreground py-2">
                Waiting for dealer to start the round...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
