
import { useState } from 'react';

const BrandCarousel = () => {



  // List of logo files in public/brands
  const logoFiles = [
    '64badf4f419c2759ae088b55_Filmora_edited.jpg',
    'apex.webp',
    'Asus-Logo_00000.png',
    'audible logo_00000.png',
    'best-buy-01-logo-black-and-white.png',
    'directv_hz_rgb_wht.png',
    'feature-black_edited.jpg',
    'google-white-logo-1.png',
    'Kia logo_00000.png',
    'logo-org-ncdot-white.png',
    'Niantic_logo_white_on_black.png',
    'Prime_Video_Logo.png',
    'soundcore_ffe05b87-8952-4492-8049-315712b26180.webp',
    'star field.png',
  ];

  // Create brand objects with name and logo path
  const brands = logoFiles.map((file, idx) => ({
    name: `Brand ${idx + 1}`,
    logo: `/nathanham-portfolio/brands/${file}`,
  }));

  // Duplicate the brands array to create seamless infinite scroll
  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className="w-full overflow-hidden bg-card/30 backdrop-blur-sm border border-minimal-border rounded-lg p-6">
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-semibold text-foreground mb-2">Collaborated Brands</h3>
        <p className="text-muted-foreground">Companies I've worked with across various projects</p>
      </div>

  <div className="relative">

  {/* Edge fade effect using CSS mask */}

        {/* Scrolling container */}
        <div
          className="flex gap-8 brand-carousel"
          style={{
            width: `${duplicatedBrands.length * 128}px`,
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
          }}
        >
          {duplicatedBrands.map((brand, index) => (
            <div
              key={`${brand.name}-${index}`}
              className="flex-shrink-0 flex items-center justify-center"
            >
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-32 h-32 object-contain group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
                style={{ filter: 'brightness(1)' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 flex justify-center items-center gap-8 text-center">
        <div>
          <div className="text-2xl font-bold text-foreground">150,000,000+</div>
          <div className="text-sm text-muted-foreground">Views</div>
        </div>
        <div className="w-px h-8 bg-minimal-border" />
        <div>
          <div className="text-2xl font-bold text-foreground">20,000,000+</div>
          <div className="text-sm text-muted-foreground">Likes</div>
        </div>
        <div className="w-px h-8 bg-minimal-border" />
        <div>
          <div className="text-2xl font-bold text-foreground">800,000+</div>
          <div className="text-sm text-muted-foreground">Followers</div>
        </div>
      </div>
    </div>
  );
};

export default BrandCarousel;