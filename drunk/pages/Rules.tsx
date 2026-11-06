import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Dice1, Beer, Home, Building, DollarSign, Gift, ChevronLeft } from "lucide-react";

const RuleRow = ({ icon: Icon, title, children }: any) => (
  <div className="flex items-start gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-brand/40">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="font-display font-semibold tracking-tight text-foreground">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  </div>
);

const Rules = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="w-full" style={{ height: '36px' }} />
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-safe:animate-rise"
          >
            <ChevronLeft className="h-4 w-4" />Back
          </button>
          <div
            className="mt-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise"
            style={{ animationDelay: '70ms' }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
            Drunkopoly
          </div>
          <h1
            className="mt-3 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text pb-2 font-display text-5xl font-bold leading-[0.95] tracking-tight text-transparent motion-safe:animate-rise"
            style={{ animationDelay: '140ms' }}
          >
            Rules
          </h1>
        </div>

        <Card className="p-4 sm:p-6 motion-safe:animate-rise" style={{ animationDelay: '210ms' }}>
          <CardContent className="p-0">
            <div className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="text-brand">//</span> How to drink
            </div>
            <div className="grid gap-4">
              <RuleRow icon={Beer} title="Drinks & Sips">
                Take sips as dictated by actions below. Rules are additive — multiple rules may apply on a single landing.
              </RuleRow>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <RuleRow icon={Dice1} title="Rolls">
                    If you roll doubles, takes sips equal to one die's number (i.e. 2x5 = 5 sips).
                  </RuleRow>

                  <RuleRow icon={Home} title="Properties">
                    One sip for each property you land on, plus one extra sip for each house on that property — except houses you own.
                  </RuleRow>

                  <RuleRow icon={Building} title="Purchase">
                    If you purchase a property, house, or hotel: take one sip.
                  </RuleRow>

                  <RuleRow icon={Gift} title="Chance & Community Chest">
                    If the card is good for you, everyone else takes 3 sips. If the card is bad, take 3 sips yourself. If you have to pay money to the bank, add a sip to the communal cup.
                  </RuleRow>
                </div>

                <div className="space-y-4">
                  <RuleRow icon={DollarSign} title="Taxes & Free Parking">
                    Add a sip to the communal cup when landing on Luxury Tax or Income Tax. For Free Parking: if you choose to take money from Free Parking, drink the communal cup.
                  </RuleRow>

                  <RuleRow icon={Beer} title="Railroads">
                    Landing on a railroad: take one sip for each railroad owned by the owner (i.e., 1 sip per railroad they have).
                  </RuleRow>

                  <RuleRow icon={Beer} title="Go & Passing Go">
                    Landing on GO: 4 sips. Passing GO: 2 sips.
                  </RuleRow>

                  <RuleRow icon={Beer} title="Jail">
                    No drinks while in jail. If you are sent to jail, finish your current drink.
                  </RuleRow>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="mt-6 flex justify-end border-t border-foreground/10 p-0 pt-4">
            <Button className="h-11 rounded-full px-6" onClick={() => navigate(-1)}>Close</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Rules;
