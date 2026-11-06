// Brands Nathan has worked with. Each logo in public/brands/mask is a one-color
// cutout (white on transparent) so <BrandLogo> can tint it with the current
// theme's text color via CSS mask. `ratio` is width / height of the cutout.

export interface Brand {
  name: string;
  src: string;
  ratio: number;
}

export const BRANDS: Brand[] = [
  { name: "Wondershare Filmora", src: "/brands/mask/wondershare.png", ratio: 2.5 },
  { name: "Apex Legends", src: "/brands/mask/apex.png", ratio: 1.55 },
  { name: "ASUS", src: "/brands/mask/asus.png", ratio: 4.744 },
  { name: "Audible", src: "/brands/mask/audible.png", ratio: 3.494 },
  { name: "Best Buy", src: "/brands/mask/best-buy.png", ratio: 1.475 },
  { name: "DIRECTV", src: "/brands/mask/directv.png", ratio: 5.263 },
  { name: "Autodesk", src: "/brands/mask/autodesk.png", ratio: 9.669 },
  { name: "Google", src: "/brands/mask/google.png", ratio: 3.038 },
  { name: "Kia", src: "/brands/mask/kia.png", ratio: 4.244 },
  { name: "NCDOT", src: "/brands/mask/ncdot.png", ratio: 1.0 },
  { name: "Niantic", src: "/brands/mask/niantic.png", ratio: 3.163 },
  { name: "Prime Video", src: "/brands/mask/prime-video.png", ratio: 3.256 },
  { name: "soundcore", src: "/brands/mask/soundcore.png", ratio: 5.889 },
  { name: "Starfield", src: "/brands/mask/starfield.png", ratio: 1.462 },
];
