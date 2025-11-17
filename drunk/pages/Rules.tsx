import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Dice1, Beer, Home, Building, DollarSign, Gift, ArrowLeft } from "lucide-react";

const RuleRow = ({ icon: Icon, title, children }: any) => (
  <div className="flex gap-4 items-start">
    <div className="w-12 h-12 rounded-md bg-transparent flex items-center justify-center text-foreground/90 shadow-sm">
      <Icon className="w-6 h-6" />
    </div>
    <div className="flex-1">
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{children}</div>
    </div>
  </div>
);

const Rules = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="w-full" style={{ height: '36px' }} />
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">Rules</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />Back
            </Button>
          </div>
        </div>

        <Card className="bg-gradient-card border-border p-6">
          <CardContent>
            <div className="grid gap-6">
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

          <CardFooter className="flex justify-end">
            <Button onClick={() => navigate(-1)}>Close</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Rules;
