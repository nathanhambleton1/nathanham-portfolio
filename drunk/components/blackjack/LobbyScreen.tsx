import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode, Users, GripVertical } from "lucide-react";
import { useState } from "react";

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
}

interface LobbyScreenProps {
  game: BlackjackGame;
  player: BlackjackPlayer;
  playersList: BlackjackPlayer[];
  chipRequests: ChipRequest[];
  qrDialogOpen: boolean;
  setQrDialogOpen: (open: boolean) => void;
  chipRequestDialogOpen: boolean;
  setChipRequestDialogOpen: (open: boolean) => void;
  chipRequestAmount: string;
  setChipRequestAmount: (amount: string) => void;
  onStartBetting: () => void;
  onRequestChips: () => void;
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
  qrDialogOpen,
  setQrDialogOpen,
  chipRequestDialogOpen,
  setChipRequestDialogOpen,
  chipRequestAmount,
  setChipRequestAmount,
  onStartBetting,
  onRequestChips,
  onApproveChipRequest,
  onGiveChips,
  onLogout,
  onSitAtTable,
  copyInviteUrlToClipboard,
  onUpdatePlayerOrder,
}: LobbyScreenProps) => {
  const nonDealerPlayers = playersList.filter(p => !p.is_dealer);
  const isDealer = player?.is_dealer;
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?code=${game?.code}` : '';

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || !isDealer || !onUpdatePlayerOrder) return;

    const reorderedPlayers = [...nonDealerPlayers];
    const [draggedPlayer] = reorderedPlayers.splice(draggedIndex, 1);
    reorderedPlayers.splice(dropIndex, 0, draggedPlayer);

    // Update the order
    onUpdatePlayerOrder(reorderedPlayers.map(p => p.id));
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">{game.name}</CardTitle>
              <Badge variant="outline" className="text-lg px-3 py-1">
                {game.code}
              </Badge>
            </div>
            <CardDescription>
              {isDealer ? "You are the dealer" : "Waiting in lobby"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                variant="outline" 
                onClick={() => setQrDialogOpen(true)}
              >
                <QrCode className="w-4 h-4 mr-2" />
                Show QR Code
              </Button>
              <Button 
                className="flex-1" 
                variant="outline" 
                onClick={copyInviteUrlToClipboard}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Players List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Players ({nonDealerPlayers.length})
            </CardTitle>
            {isDealer && nonDealerPlayers.length > 1 && (
              <CardDescription>
                Drag players to set dealing order (top to bottom)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {nonDealerPlayers.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No players yet. Share the code to invite players!
              </div>
            ) : (
              nonDealerPlayers.map((p, index) => (
                <div
                  key={p.id}
                  draggable={isDealer && onUpdatePlayerOrder !== undefined}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
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
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
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
                        onClick={() => onGiveChips(p.id, 100)}
                      >
                        +$100
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGiveChips(p.id, 500)}
                      >
                        +$500
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
            <CardHeader>
              <CardTitle>Your Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Balance:</span>
                <span className="text-xl font-bold">${player.balance}</span>
              </div>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => setChipRequestDialogOpen(true)}
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
                disabled={nonDealerPlayers.length === 0}
              >
                Start Betting Round
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                size="lg"
                onClick={onSitAtTable}
              >
                Go to Table View
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                size="lg"
                onClick={onSitAtTable}
              >
                Sit at Table
              </Button>
              <div className="text-center text-muted-foreground py-2">
                Waiting for dealer to start the round...
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-destructive"
            onClick={onLogout}
          >
            Leave Table
          </Button>
        </div>
      </div>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Players</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <QRCodeSVG value={inviteUrl} size={200} />
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Game Code</div>
              <div className="text-2xl font-bold">{game.code}</div>
            </div>
            <Button onClick={copyInviteUrlToClipboard} className="w-full">
              Copy Invite Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chip Request Dialog */}
      <Dialog open={chipRequestDialogOpen} onOpenChange={setChipRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Chips</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="number"
              placeholder="Amount"
              value={chipRequestAmount}
              onChange={(e) => setChipRequestAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {[100, 250, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setChipRequestAmount(String(amount))}
                  className="flex-1"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onRequestChips} className="w-full">
              Request ${chipRequestAmount || '0'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LobbyScreen;
