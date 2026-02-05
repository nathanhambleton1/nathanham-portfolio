import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";

interface ConfirmSettingsScreenProps {
  dealerStandsOnSoft17: boolean;
  setDealerStandsOnSoft17: (value: boolean) => void;
  insuranceEnabled: boolean;
  setInsuranceEnabled: (value: boolean) => void;
  doubleDownEnabled: boolean;
  setDoubleDownEnabled: (value: boolean) => void;
  splitEnabled: boolean;
  setSplitEnabled: (value: boolean) => void;
  maxSplits: string;
  setMaxSplits: (value: string) => void;
  numberOfDecks: string;
  setNumberOfDecks: (value: string) => void;
  chipsEnabled: boolean;
  setChipsEnabled: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

const ConfirmSettingsScreen = ({
  dealerStandsOnSoft17,
  setDealerStandsOnSoft17,
  insuranceEnabled,
  setInsuranceEnabled,
  doubleDownEnabled,
  setDoubleDownEnabled,
  splitEnabled,
  setSplitEnabled,
  maxSplits,
  setMaxSplits,
  numberOfDecks,
  setNumberOfDecks,
  chipsEnabled,
  setChipsEnabled,
  loading,
  error,
  onConfirm,
  onBack,
}: ConfirmSettingsScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Table Settings</CardTitle>
          <CardDescription className="text-center">Configure the rules for your blackjack table</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label>Dealer stands on soft 17</label>
            <Switch
              checked={dealerStandsOnSoft17}
              onCheckedChange={setDealerStandsOnSoft17}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Insurance enabled</label>
            <Switch
              checked={insuranceEnabled}
              onCheckedChange={setInsuranceEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Double down enabled</label>
            <Switch
              checked={doubleDownEnabled}
              onCheckedChange={setDoubleDownEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Split enabled</label>
            <Switch
              checked={splitEnabled}
              onCheckedChange={setSplitEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Track chips in app</label>
            <Switch
              checked={chipsEnabled}
              onCheckedChange={setChipsEnabled}
            />
          </div>
          {splitEnabled && (
            <div className="space-y-2">
              <label className="text-sm">Max splits allowed</label>
              <div className="flex gap-2">
                {['1', '2', '3', '4'].map((val) => (
                  <Button
                    key={val}
                    variant={maxSplits === val ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMaxSplits(val)}
                    className="flex-1"
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm">Number of decks</label>
            <div className="flex gap-2">
              {['1', '2', '4', '6', '8'].map((val) => (
                <Button
                  key={val}
                  variant={numberOfDecks === val ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNumberOfDecks(val)}
                  className="flex-1"
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>
          {error && <div className="text-destructive text-sm text-center">{error}</div>}
          <div className="flex flex-col gap-2">
            <Button onClick={onConfirm} className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Table'}
            </Button>
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmSettingsScreen;
