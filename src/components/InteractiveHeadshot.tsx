import { useState, useEffect, useRef } from 'react';

const InteractiveHeadshot = () => {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const headshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!headshotRef.current) return;

      const rect = headshotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Limit the eye movement range
      const maxMovement = 8;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const limitedDistance = Math.min(distance, 100);

      const eyeX = (deltaX / distance) * (limitedDistance / 100) * maxMovement;
      const eyeY = (deltaY / distance) * (limitedDistance / 100) * maxMovement;

      setEyePosition({ x: eyeX, y: eyeY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
      ref={headshotRef}
      className="relative w-48 h-48 mx-auto mb-8 group cursor-pointer"
    >
      {/* Main headshot container */}
      <div className="w-full h-full rounded-full bg-gradient-to-br from-muted/30 to-card/50 p-1 minimal-hover">
        <div className="w-full h-full rounded-full bg-muted overflow-hidden relative border border-minimal-border">
          {/* Placeholder for actual photo */}
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <div className="text-4xl text-gray-400">📸</div>
          </div>
          
          {/* Interactive Eyes Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Left Eye */}
              <div 
                className="absolute w-3 h-3 bg-foreground rounded-full transition-all duration-100 ease-out"
                style={{
                  transform: `translate(${-20 + eyePosition.x}px, ${-5 + eyePosition.y}px)`,
                }}
              />
              {/* Right Eye */}
              <div 
                className="absolute w-3 h-3 bg-foreground rounded-full transition-all duration-100 ease-out"
                style={{
                  transform: `translate(${20 + eyePosition.x}px, ${-5 + eyePosition.y}px)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-minimal-accent/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default InteractiveHeadshot;