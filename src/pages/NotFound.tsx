import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black text-foreground flex items-center justify-center px-4">
      <div className="bg-card/60 border border-minimal-border rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <h1 className="text-6xl md:text-7xl font-extrabold text-minimal-accent mb-4 drop-shadow-lg">404</h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-6 font-light">Oops! The page you’re looking for doesn’t exist.</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-minimal-accent text-black font-semibold rounded-lg shadow hover:bg-minimal-accent/80 transition-colors duration-200"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
