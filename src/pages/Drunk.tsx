import { useEffect } from "react";
import { DEFAULT_TITLE } from "@/lib/sites";
import { Routes, Route } from "react-router-dom";
import Index from "../../drunk/pages/Index";
import PowerHour from "../../drunk/pages/PowerHour";
import BeerPong from "../../drunk/pages/BeerPong";
import KingsCup from "../../drunk/pages/KingsCup";
import PartnerTournament from "../../drunk/pages/BeerBall";
import Drunkopoly from "../../drunk/pages/Drunkopoly";
import Messages from "../../drunk/pages/Messages";
import Blackjack from "../../drunk/pages/Blackjack";
import Rules from "../../drunk/pages/Rules";
import NotFound from "../../drunk/pages/NotFound";
import "../../drunk/index.css";


const Drunk = () => {
  // The drinking games are monochrome: swap the site's cyan accent for plain
  // white across every /drunk page. Set on <html> (not a wrapper) so portalled
  // dialogs/popovers inherit it; removed again when leaving the section.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", "var(--foreground)");
    return () => {
      root.style.removeProperty("--brand");
    };
  }, []);

  useEffect(() => {
    document.title = "Drinking Games";
    // Change favicon
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) {
      favicon.setAttribute("href", "/drunk_logo.png");
    }
    
    // Set Media Session metadata for iOS media player
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Drinking Games',
          artist: 'nathanham.com',
          artwork: [
            { src: '/drunk_logo.png', sizes: '512x512', type: 'image/png' }
          ]
        });
      }
    } catch (err) {
      console.warn('Media Session API failed:', err);
    }
    
    return () => {
      document.title = DEFAULT_TITLE;
      if (favicon) {
        favicon.setAttribute("href", "/logo.png");
      }
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Routes>
        <Route index element={<Index />} />
        <Route path="drunkopoly" element={<Drunkopoly />} />
        <Route path="drunkopoly/rules" element={<Rules />} />
        <Route path="drunkopoly/messages" element={<Messages />} />
        <Route path="blackjack" element={<Blackjack />} />
        {/* Beer Olympics removed */}
        <Route path="power-hour" element={<PowerHour />} />
        <Route path="beer-pong" element={<BeerPong />} />
        <Route path="kings-cup" element={<KingsCup />} />
        <Route path="partner-tournament" element={<PartnerTournament />} />
        <Route path="beer-ball" element={<PartnerTournament />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

export default Drunk;
