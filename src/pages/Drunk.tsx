import { Routes, Route } from "react-router-dom";
import Index from "../../drunk/pages/Index";
import PowerHour from "../../drunk/pages/PowerHour";
import BeerPong from "../../drunk/pages/BeerPong";
import KingsCup from "../../drunk/pages/KingsCup";
import SipRoulette from "../../drunk/pages/SipRoulette";
import BeerBall from "../../drunk/pages/BeerBall";
import Drunkopoly from "../../drunk/pages/Drunkopoly";
import NotFound from "../../drunk/pages/NotFound";
import "../../drunk/index.css";

const Drunk = () => (
  <div className="min-h-screen">
    <Routes>
      <Route index element={<Index />} />
      <Route path="drunkopoly" element={<Drunkopoly />} />
      <Route path="power-hour" element={<PowerHour />} />
      <Route path="beer-pong" element={<BeerPong />} />
      <Route path="kings-cup" element={<KingsCup />} />
      <Route path="sip-roulette" element={<SipRoulette />} />
      <Route path="beer-ball" element={<BeerBall />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </div>
);

export default Drunk;
