// Travel section shell: scrapbook background, fonts, providers, nested routes.

import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { EditModeProvider } from "./context/EditMode";
import Explore from "./pages/Explore";
import GlassDetail from "./pages/GlassDetail";
import TripDetail from "./pages/TripDetail";
import "./travel.css";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Quicksand:wght@400;500;600;700&family=Shadows+Into+Light&display=swap";

export default function TravelApp() {
  // Inject the scrapbook fonts at runtime so index.html stays untouched.
  useEffect(() => {
    if (document.querySelector('link[data-travel-fonts="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    link.setAttribute("data-travel-fonts", "1");
    document.head.appendChild(link);
  }, []);

  return (
    <EditModeProvider>
      <div className="travel-root travel-page">
        <Routes>
          <Route index element={<Explore />} />
          <Route path="glass/:id" element={<GlassDetail />} />
          <Route path="trip/:id" element={<TripDetail />} />
          <Route path="*" element={<Explore />} />
        </Routes>
      </div>
    </EditModeProvider>
  );
}
