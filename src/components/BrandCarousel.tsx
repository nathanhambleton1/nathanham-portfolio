import { useEffect, useState } from 'react';

interface Brand {
  name: string;
  logo: string; // Will be emoji/text for now, can be replaced with actual logos later
}

const BrandCarousel = () => {
  const [isPaused, setIsPaused] = useState(false);

  // Placeholder brands - these will be replaced with actual company logos
  const brands: Brand[] = [
    { name: 'Tesla', logo: '⚡' },
    { name: 'SpaceX', logo: '🚀' },
    { name: 'Apple', logo: '🍎' },
    { name: 'Google', logo: '🔍' },
    { name: 'Microsoft', logo: '📊' },
    { name: 'Meta', logo: '👁️' },
    { name: 'Netflix', logo: '📺' },
    { name: 'Amazon', logo: '📦' },
    { name: 'Intel', logo: '💾' },
    { name: 'NVIDIA', logo: '🎮' },
    { name: 'Samsung', logo: '📱' },
    { name: 'Sony', logo: '🎵' },
  ];

  // Duplicate the brands array to create seamless infinite scroll
  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className="w-full overflow-hidden bg-card/30 backdrop-blur-sm border border-tech-border rounded-lg p-6">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-semibold text-tech-glow mb-2">Collaborated Brands</h3>
        <p className="text-muted-foreground">Companies I've worked with across various projects</p>
      </div>

      <div 
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Gradient overlays for smooth edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-card/100 via-card/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-card/100 via-card/80 to-transparent z-10 pointer-events-none" />

        {/* Scrolling container */}
        <div 
          className={`flex gap-8 ${isPaused ? '' : 'brand-carousel'}`}
          style={{ width: `${duplicatedBrands.length * 120}px` }}
        >
          {duplicatedBrands.map((brand, index) => (
            <div
              key={`${brand.name}-${index}`}
              className="flex-shrink-0 w-20 h-20 flex items-center justify-center bg-muted/50 backdrop-blur-sm rounded-lg border border-tech-border/50 hover:border-tech-glow/50 transition-all duration-300 group cursor-pointer"
            >
              <div className="text-center">
                <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">
                  {brand.logo}
                </div>
                <div className="text-xs text-muted-foreground group-hover:text-tech-glow transition-colors font-mono">
                  {brand.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 flex justify-center items-center gap-8 text-center">
        <div>
          <div className="text-2xl font-bold text-tech-glow">800K+</div>
          <div className="text-sm text-muted-foreground">TikTok Followers</div>
        </div>
        <div className="w-px h-8 bg-tech-border" />
        <div>
          <div className="text-2xl font-bold text-tech-glow">{brands.length}+</div>
          <div className="text-sm text-muted-foreground">Brand Partners</div>
        </div>
      </div>
    </div>
  );
};

export default BrandCarousel;