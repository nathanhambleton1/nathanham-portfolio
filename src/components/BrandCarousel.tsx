import { BRANDS } from '@/lib/brands';
import BrandLogo from './BrandLogo';

// Logos are one-color cutouts tinted with the theme's text color (see BrandLogo),
// so they stay legible on every theme.
const BrandCarousel = () => (
  <div className="w-full overflow-hidden bg-card/30 backdrop-blur-sm border border-minimal-border rounded-lg p-6">
    <div className="mb-6 text-center">
      <h3 className="text-2xl font-semibold text-foreground mb-2">Collaborated Brands</h3>
      <p className="text-muted-foreground">Companies I've worked with across various projects</p>
    </div>

    {/* Edge fade + seamless loop: two copies slide left by 50%. */}
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max brand-carousel" style={{ animationDuration: '40s' }}>
        {[...BRANDS, ...BRANDS].map((brand, index) => (
          <div
            key={`${brand.name}-${index}`}
            className="flex h-32 items-center px-8"
            aria-hidden={index >= BRANDS.length}
          >
            <BrandLogo
              brand={brand}
              area={5200}
              className="text-foreground/85"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Stats */}
    <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-8 text-center">
      <div>
        <div className="text-2xl font-bold text-foreground">150,000,000+</div>
        <div className="text-sm text-muted-foreground">Views</div>
      </div>
      <div className="hidden sm:block w-px h-8 bg-minimal-border" />
      <div>
        <div className="text-2xl font-bold text-foreground">20,000,000+</div>
        <div className="text-sm text-muted-foreground">Likes</div>
      </div>
      <div className="hidden sm:block w-px h-8 bg-minimal-border" />
      <div>
        <div className="text-2xl font-bold text-foreground">800,000+</div>
        <div className="text-sm text-muted-foreground">Followers</div>
      </div>
    </div>
  </div>
);

export default BrandCarousel;
