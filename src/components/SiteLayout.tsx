import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { UnlockProvider } from "./UnlockProvider";

// Shared header + footer for the main site pages (home, portfolio, finance, 404).
// The standalone apps (games, travel) render their own full-screen UI and are
// mounted outside this layout in App.tsx.
const SiteLayout = () => (
  <UnlockProvider>
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <div className="flex-1 pt-16">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  </UnlockProvider>
);

export default SiteLayout;
