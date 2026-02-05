import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode, Settings, LogOut, ChevronDown, Info, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../ui/use-toast";

interface BlackjackHeaderProps {
  gameCode: string;
  player: { name: string; is_dealer: boolean; balance: number; buy_in_with_sips: boolean; sips_owed: number };
  onLogout: () => void;
  onOpenSettings?: () => void;
  onOpenChipRequest?: () => void;
  chipsEnabled: boolean;
}

export const BlackjackHeader = ({ gameCode, player, onLogout, onOpenSettings, onOpenChipRequest, chipsEnabled }: BlackjackHeaderProps) => {
  const [qrOpen, setQrOpen] = useState(false);
  const navigate = useNavigate();

  const handleCopyInvite = async () => {
    try {
      const base = window.location.origin + window.location.pathname;
      const inviteUrl = `${base}?code=${encodeURIComponent(gameCode)}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        toast({ title: 'Invite link copied', description: 'Paste it to share the game.' });
      }
    } catch (err) {
      toast({ title: 'Unable to copy', description: 'Copying invite link failed.' });
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm border-b">
      <div className="flex items-center gap-2">
        <div className="px-3 py-1 rounded-md flex items-center gap-3 bg-muted/50 border border-muted-foreground/20">
          <div className="font-semibold text-lg">{player.name}</div>
          {!player.is_dealer && chipsEnabled && !player.buy_in_with_sips && (
            <div className="text-sm font-mono text-green-600 dark:text-green-400 font-bold">
              ${player.balance}
            </div>
          )}
          {!player.is_dealer && player.buy_in_with_sips && (
            <div className="text-sm font-mono text-blue-600 dark:text-blue-400 font-bold">
              {player.sips_owed || 0} sips
            </div>
          )}
          {!player.is_dealer && !chipsEnabled && !player.buy_in_with_sips && (
            <div className="text-xs uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">
              Cards only
            </div>
          )}
          {player.is_dealer && (
            <div className="text-xs uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
              Dealer
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="font-mono px-4 py-2 text-base font-bold uppercase tracking-widest flex items-center gap-2"
            >
              {gameCode}
              <ChevronDown size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" className="w-full justify-start gap-2" onClick={() => setQrOpen(true)}>
                <QrCode size={16} />
                QR Code
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-2" onClick={handleCopyInvite}>
                <Copy size={16} />
                Invite Link
              </Button>
              {!player.is_dealer && chipsEnabled && !player.buy_in_with_sips && onOpenChipRequest && (
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={onOpenChipRequest}>
                  <DollarSign size={16} />
                  Request Chips
                </Button>
              )}
              {onOpenSettings && (
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={onOpenSettings}>
                  <Settings size={16} />
                  Settings
                </Button>
              )}
              <Button variant="destructive" className="w-full justify-start gap-2 mt-2" onClick={onLogout}>
                <LogOut size={16} />
                Leave Game
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG 
                value={`${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(gameCode)}`} 
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Scan this code to join the game
            </p>
            <p className="text-center font-mono font-bold text-lg mt-2">
              {gameCode}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
