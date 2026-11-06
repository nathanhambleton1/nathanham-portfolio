import { useEffect } from "react";
import { DEFAULT_TITLE } from "@/lib/sites";
import TravelApp from "../travel/TravelApp";

// Route entry for /travel. Sets the document title (and restores it on
// unmount), matching the pattern used by Drunk.tsx.
const Travel = () => {
  useEffect(() => {
    document.title = "Our Travels";
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, []);

  return <TravelApp />;
};

export default Travel;
