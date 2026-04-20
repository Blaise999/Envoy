# Envoy — Design Notes

## Theme
Light theme throughout, emerald as brand color. Dark hero section on the homepage (LuminaShip-style) with a custom SVG world map background, pulsing connection lines, and floating 3D package boxes.

## Homepage (`src/App.jsx`)
- **Hero (dark):** "Deliver the Extraordinary" with emerald gradient text, tracking input, dual CTAs, 10M+/99.9%/220+/24/7 stats strip. Animated world map dots + 5 floating package boxes.
- Services, coverage, steps, rates, testimonials, support sections below — all light theme.
- Footer: every link works. No more `href="#"` dead ends.

## Tracking Page (`src/pages/track/TrackPage.jsx`) — completely redesigned
**Initial state:** Centered "Track Your Shipment" title, subtitle, clean floating input card with emerald ring glow, faint world map backdrop. No map visible yet, no clutter.

**After user presses Track:**
- Title transforms to "Shipment Details"
- Full-screen interactive Leaflet map takes center stage (60-70vh) with CartoDB light tiles
- Origin + destination marked with custom animated emerald pins (pulsing glow effect)
- Dashed emerald route line connecting them
- **Left floating panel:** Journey timeline (Ordered → Picked Up → Processed → In Transit (animated) → Out for Delivery → Delivered)
- **Right floating panels:** Estimated Delivery card, Live Updates card (scrollable), Service/Weight card
- Tracking number + status pill at top, with "track another" input inline
- Falls back to demo data if API doesn't return anything — users always see something

## New pages (all with shared PageShell)
- `/careers` — 6 open positions, team stats
- `/news` — 5 realistic company news posts
- `/developers` — API reference + code snippet + SDK links
- `/docs` — Documentation index across 4 categories
- `/status` — System status dashboard + incident history
- `/privacy` — Full privacy policy
- `/terms` — 10-section ToS
- `/cookies` — Cookie table
- `/security` — Security practices + responsible disclosure
- `/sitemap` — All routes organized

## Assets
- Logo: dark "Envoy" text + emerald paper-plane mark
- Favicons regenerated for 16/32/48/apple/android
- Unsplash photo URLs with onError → emerald fallback SVG
