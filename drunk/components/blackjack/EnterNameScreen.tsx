import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

interface EnterNameScreenProps {
  mode: "join" | "create";
  gameCode: string;
  name: string;
  setName: (name: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

const EnterNameScreen = ({
  mode,
  gameCode,
  name,
  setName,
  loading,
  error,
  onSubmit,
  onBack,
}: EnterNameScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl mb-2">
            {mode === "create" ? "Dealer Name" : "Enter Your Name"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "You'll be the dealer for this table."
              : `Joining table: ${gameCode}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                const raw = e.target.value ?? '';
                const upper = raw.toUpperCase();
                let filtered = upper.replace(/[^A-Z ]+/g, '');
                if (filtered.length > 10) filtered = filtered.slice(0, 10);
                setName(filtered);
              }}
              maxLength={10}
              autoFocus
            />
            {error && <div className="text-destructive text-sm text-center">{error}</div>}
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
                {loading ? "Joining..." : "Continue"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnterNameScreen;
