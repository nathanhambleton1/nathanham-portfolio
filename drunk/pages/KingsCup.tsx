import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface CardType {
  rank: Rank;
  suit: Suit;
  rule: string;
}

const rules: Record<Rank, string> = {
  A: "Waterfall – Everyone drinks, can't stop until the person to your right stops",
  "2": "You – Choose someone to drink",
  "3": "Me – You drink",
  "4": "Floor – Last person to touch the floor drinks",
  "5": "Guys – All guys drink",
  "6": "Chicks – All girls drink",
  "7": "Heaven – Last person to raise their hand drinks",
  "8": "Mate – Choose a drinking buddy",
  "9": "Rhyme – Pick a word, everyone rhymes or drinks",
  "10": "Categories – Pick a category, everyone names something or drinks",
  J: "Never Have I Ever – Three fingers up, drink for each you've done",
  Q: "Question Master – People must answer your questions with questions",
  K: "King's Cup – Pour some of your drink into the King's Cup. Last King drinks it all!",
};

const KingsCup = () => {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [history, setHistory] = useState<CardType[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeDeck = () => {
    const suits: Suit[] = ["♠", "♥", "♦", "♣"];
    const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    
    const newDeck: CardType[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        newDeck.push({ rank, suit, rule: rules[rank] });
      }
    }

    // Shuffle deck
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }

    setDeck(newDeck);
    setCurrentCard(null);
    setHistory([]);
    setIsInitialized(true);
    toast.success("Deck shuffled and ready! 🃏");
  };

  const drawCard = () => {
    if (deck.length === 0) {
      toast.error("Deck is empty! Reshuffle to continue.");
      return;
    }

    const drawnCard = deck[0];
    const remainingDeck = deck.slice(1);
    
    setCurrentCard(drawnCard);
    setDeck(remainingDeck);
    setHistory([drawnCard, ...history].slice(0, 5));

    toast.success(`${drawnCard.rank}${drawnCard.suit} drawn!`);
  };

  const getSuitColor = (suit: Suit) => {
    return suit === "♥" || suit === "♦" ? "text-red-500" : "text-foreground";
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <BackButton />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">King's Cup</h1>
          <p className="text-muted-foreground">Virtual deck with rules built-in</p>
        </div>

        {/* Current Card Display */}
        {currentCard ? (
          <Card className="bg-gradient-card border-border p-8 mb-6 text-center">
            <div className="mb-4">
              <p className={`text-8xl font-bold ${getSuitColor(currentCard.suit)}`}>
                {currentCard.rank}
                {currentCard.suit}
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-2xl font-bold text-primary mb-2">
                {currentCard.rank} = {currentCard.rank === "A" ? "Waterfall" :
                  currentCard.rank === "2" ? "You" :
                  currentCard.rank === "3" ? "Me" :
                  currentCard.rank === "4" ? "Floor" :
                  currentCard.rank === "5" ? "Guys" :
                  currentCard.rank === "6" ? "Chicks" :
                  currentCard.rank === "7" ? "Heaven" :
                  currentCard.rank === "8" ? "Mate" :
                  currentCard.rank === "9" ? "Rhyme" :
                  currentCard.rank === "10" ? "Categories" :
                  currentCard.rank === "J" ? "Never Have I Ever" :
                  currentCard.rank === "Q" ? "Question Master" :
                  "King's Cup"}
              </p>
              <p className="text-foreground leading-relaxed">{currentCard.rule}</p>
            </div>
          </Card>
        ) : (
          <Card className="bg-gradient-card border-border p-12 mb-6 text-center">
            <p className="text-6xl mb-4">🃏</p>
            <p className="text-xl text-muted-foreground">
              {isInitialized ? "Draw a card to begin" : "Shuffle the deck to start"}
            </p>
          </Card>
        )}

        {/* Cards Remaining */}
        <div className="text-center mb-6">
          <p className="text-lg text-muted-foreground">
            Cards remaining: <span className="font-bold text-foreground">{deck.length}</span> / 52
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mb-8">
          {deck.length > 0 ? (
            <Button
              onClick={drawCard}
              className="flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground py-6 text-lg"
            >
              Draw Card
            </Button>
          ) : (
            <Button
              onClick={initializeDeck}
              className="flex-1 bg-gradient-secondary hover:opacity-90 text-secondary-foreground py-6 text-lg"
            >
              <Shuffle className="w-5 h-5 mr-2" />
              New Game / Reshuffle
            </Button>
          )}
          
          {isInitialized && (
            <Button
              onClick={initializeDeck}
              variant="outline"
              className="py-6 text-lg"
            >
              <Shuffle className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <Card className="bg-gradient-card border-border p-6">
            <h3 className="text-lg font-bold text-foreground mb-3">Recent Cards</h3>
            <div className="space-y-2">
              {history.map((card, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b border-border last:border-0"
                >
                  <span className={`text-2xl font-bold ${getSuitColor(card.suit)}`}>
                    {card.rank}
                    {card.suit}
                  </span>
                  <span className="text-sm text-muted-foreground">{card.rule.split("–")[0]}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isInitialized && (
          <div className="text-center">
            <Button
              onClick={initializeDeck}
              className="bg-gradient-primary hover:opacity-90 text-primary-foreground px-8 py-6 text-lg"
            >
              <Shuffle className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KingsCup;
