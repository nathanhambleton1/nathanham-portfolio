import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "../components/Header";
import Index from "../../drunk/pages/Index";
import PowerHour from "../../drunk/pages/PowerHour";
import BeerPong from "../../drunk/pages/BeerPong";
import KingsCup from "../../drunk/pages/KingsCup";
import BeerBall from "../../drunk/pages/BeerBall";
import Drunkopoly from "../../drunk/pages/Drunkopoly";
import Rules from "../../drunk/pages/Rules";
import NotFound from "../../drunk/pages/NotFound";
import "../../drunk/index.css";


const Drunk = () => {
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
      document.title = "Nathan Hambleton – Portfolio";
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
        {/* Beer Olympics removed */}
        <Route path="power-hour" element={<PowerHour />} />
        <Route path="beer-pong" element={<BeerPong />} />
        <Route path="kings-cup" element={<KingsCup />} />
        <Route path="beer-ball" element={<BeerBall />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

export default Drunk;
