// Image URLs (Unsplash, stable IDs). onError swaps in an emerald fallback SVG.
// This file is the single source of truth for all non-logo imagery.
// Every "local asset PNG" from the original project has been redirected here
// because many of the originals had visible GlobalEdge branding.
export const IMG = {
  // Homepage / services overview
  warehouse:  "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1400&q=80&auto=format&fit=crop",
  cargoShip:  "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?w=1400&q=80&auto=format&fit=crop",
  airplane:   "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1400&q=80&auto=format&fit=crop",
  boxes:      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1400&q=80&auto=format&fit=crop",
  // Personas
  merchant:   "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&q=80&auto=format&fit=crop",
  enterprise: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80&auto=format&fit=crop",
  developer:  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80&auto=format&fit=crop",
  // Warehousing / fulfilment (previously local branded PNGs)
  commerce:       "https://images.unsplash.com/photo-1556742400-b5b7c5121f3c?w=1200&q=80&auto=format&fit=crop",
  inbound:        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80&auto=format&fit=crop",
  binShelf:       "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=1200&q=80&auto=format&fit=crop",
  palletRacking:  "https://images.unsplash.com/photo-1586528116493-ce4c3f86b82a?w=1200&q=80&auto=format&fit=crop",
  climateControl: "https://images.unsplash.com/photo-1586528116022-aeda1700dfa6?w=1200&q=80&auto=format&fit=crop",
  networkMap:     "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&q=80&auto=format&fit=crop",
  onboarding:     "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop",
  packing:        "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80&auto=format&fit=crop",
  dispatch:       "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=1200&q=80&auto=format&fit=crop",
  d2cCosmetics:   "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80&auto=format&fit=crop",
  electronicsB2B: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&auto=format&fit=crop",
  apparelDrop:    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80&auto=format&fit=crop",
  marketplacePrep:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80&auto=format&fit=crop",
  // Deprecated aliases
  truck:   "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80&auto=format&fit=crop",
  courier: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80&auto=format&fit=crop",
  rates:   "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=80&auto=format&fit=crop",
  support: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80&auto=format&fit=crop",
  hero:    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1400&q=80&auto=format&fit=crop",
  map:     "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&q=80&auto=format&fit=crop",
};

export const FALLBACK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
       <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
         <stop offset='0%' stop-color='#ecfdf5'/><stop offset='100%' stop-color='#d1fae5'/>
       </linearGradient></defs>
       <rect width='800' height='600' fill='url(#g)'/>
       <g fill='#10b981'><circle cx='400' cy='280' r='58'/>
         <path d='M362 280 L430 240 L420 330 Z' fill='#ffffff'/></g>
       <text x='400' y='410' text-anchor='middle' fill='#065f46'
             font-family='system-ui,sans-serif' font-size='28' font-weight='700' letter-spacing='4'>ENVOY</text>
     </svg>`
  );

export function onImgErr(e) {
  if (e.currentTarget.src !== FALLBACK_SVG) e.currentTarget.src = FALLBACK_SVG;
}
