// src/pages/track/TrackPage.jsx
// Idle: dot-grid world map (branded SVG) + tracking form.
// Result: real Leaflet map (Thunderforest tiles) with origin/dest markers,
//         animated route polyline, progress timeline + delivery card beside it.
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../../assets/envoy.png";
import { shipments as ShipAPI } from "../../utils/api";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker assets for bundlers
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const TF_KEY = import.meta.env.VITE_THUNDERFOREST_KEY || "";

/* ============================================================ */
/*  City coords — lat/lon (real, for Leaflet)                    */
/* ============================================================ */
const CITY_COORDS = {
  "london":      { lat: 51.5074, lon: -0.1278, label: "London, UK" },
  "new york":    { lat: 40.7128, lon: -74.0060, label: "New York, USA" },
  "paris":       { lat: 48.8566, lon:   2.3522, label: "Paris, France" },
  "berlin":      { lat: 52.5200, lon: 13.4050, label: "Berlin, Germany" },
  "madrid":      { lat: 40.4168, lon:  -3.7038, label: "Madrid, Spain" },
  "dubai":       { lat: 25.2048, lon:  55.2708, label: "Dubai, UAE" },
  "tokyo":       { lat: 35.6762, lon: 139.6503, label: "Tokyo, Japan" },
  "sydney":      { lat: -33.8688, lon: 151.2093, label: "Sydney, Australia" },
  "mumbai":      { lat: 19.0760, lon:  72.8777, label: "Mumbai, India" },
  "singapore":   { lat: 1.3521,  lon: 103.8198, label: "Singapore" },
  "cape town":   { lat: -33.9249, lon: 18.4241, label: "Cape Town" },
  "los angeles": { lat: 34.0522, lon: -118.2437, label: "Los Angeles, USA" },
  "toronto":     { lat: 43.6532, lon: -79.3832, label: "Toronto, Canada" },
  "rotterdam":   { lat: 51.9244, lon:   4.4777, label: "Rotterdam, NL" },
  "milan":       { lat: 45.4642, lon:   9.1900, label: "Milan, Italy" },
  "amsterdam":   { lat: 52.3676, lon:   4.9041, label: "Amsterdam, NL" },
};

function findCity(str = "") {
  const s = str.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) if (s.includes(k)) return v;
  return null;
}

function buildDemo(ref) {
  return {
    trackingNumber: ref,
    status: "IN_TRANSIT",
    from: "Paris, France",
    to: "New York, USA",
    estimatedDelivery: "Apr 25, 2026",
    service: "Express",
    weight: "2.4 kg",
    timeline: [
      { label: "Ordered",          time: "Apr 15, 9:30 AM", done: true },
      { label: "Picked Up",        time: "Apr 15, 2:15 PM", done: true },
      { label: "Processed",        time: "Apr 16, 8:00 AM", done: true },
      { label: "In Transit",       time: "Apr 17, 6:45 AM", done: true, current: true },
      { label: "Out for Delivery", time: "Apr 24, —",       done: false },
      { label: "Delivered",        time: "Apr 25, —",       done: false },
    ],
    updates: [
      { date: "Apr 20, 2026 · 14:22", note: "Flight touched down at JFK" },
      { date: "Apr 18, 2026 · 09:14", note: "Departed CDG sorting centre" },
      { date: "Apr 17, 2026 · 18:03", note: "Cleared outbound customs" },
      { date: "Apr 16, 2026 · 11:40", note: "Arrived Paris hub" },
      { date: "Apr 15, 2026 · 14:15", note: "Picked up from shipper" },
      { date: "Apr 15, 2026 · 09:30", note: "Shipment created" },
    ],
    _demo: true,
  };
}

/* ============================================================ */
/*  Custom blue marker                                        */
/* ============================================================ */
const bluePin = L.divIcon({
  className: "envoy-pin",
  html: `
    <div style="
      position: relative;
      width: 32px;
      height: 44px;
    ">
      <div style="
        position:absolute; inset:0;
        background:#3b82f6;
        clip-path: path('M16 0C7.2 0 0 7.2 0 16c0 11 16 28 16 28s16-17 16-28C32 7.2 24.8 0 16 0z');
        box-shadow: 0 4px 12px rgba(59,130,246,0.45);
      "></div>
      <div style="
        position:absolute; left:50%; top:14px; transform:translateX(-50%);
        width:14px; height:14px; border-radius:50%; background:white;
      "></div>
    </div>
  `,
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
});

/* ============================================================ */
/*  Auto-fit helper                                              */
/* ============================================================ */
function FitToRoute({ origin, dest }) {
  const map = useMap();
  useEffect(() => {
    if (!origin || !dest) return;
    const bounds = L.latLngBounds([origin.lat, origin.lon], [dest.lat, dest.lon]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 5 });
  }, [origin, dest, map]);
  return null;
}

/* ============================================================ */
/*  Idle dot-grid SVG (unchanged — matches homepage)             */
/* ============================================================ */
function DotGridBg() {
  const continents = [
    [0.18, 0.42, 0.12, 0.22],
    [0.27, 0.72, 0.06, 0.18],
    [0.47, 0.38, 0.09, 0.14],
    [0.52, 0.66, 0.07, 0.15],
    [0.70, 0.46, 0.17, 0.20],
    [0.84, 0.78, 0.07, 0.10],
  ];
  const dots = useMemo(() => {
    const arr = [];
    const rows = 44, cols = 88;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c / (cols - 1);
        const y = r / (rows - 1);
        const inLand = continents.some(([cx, cy, rx, ry]) => {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          return dx * dx + dy * dy < 1;
        });
        if (inLand && Math.random() > 0.1) arr.push({ x, y, k: `${r}-${c}` });
      }
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      {dots.map(({ x, y, k }) => (
        <circle key={k} cx={x * 1600} cy={y * 800} r={2} fill="#94a3b8" opacity={0.5} />
      ))}
    </svg>
  );
}

/* ============================================================ */
/*  Main page                                                    */
/* ============================================================ */
export default function TrackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [ref, setRef] = useState(params.get("ref") || "");
  const [loading, setLoading] = useState(false);
  const [ship, setShip] = useState(null);

  useEffect(() => {
    const r = params.get("ref");
    if (r) submitLookup(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitLookup(value) {
    const id = value.trim();
    if (!id) return;
    setLoading(true);
    try {
      const data = await ShipAPI.track(id).catch(() => null);
      setShip((data && (data.trackingNumber || data.id)) ? data : buildDemo(id));
    } catch (e) {
      setShip(buildDemo(id));
    } finally {
      setLoading(false);
    }
  }

  const hasResult = !!ship;

  const route = useMemo(() => {
    if (!ship) return null;
    const origin = findCity(ship.from || ship.origin || "") || CITY_COORDS.paris;
    const dest   = findCity(ship.to   || ship.dest   || "") || CITY_COORDS["new york"];
    return { origin, dest };
  }, [ship]);

  // Great-circle-ish curve for polyline (simple bezier-ish arc)
  const routeArc = useMemo(() => {
    if (!route) return null;
    const { origin, dest } = route;
    const steps = 40;
    const points = [];
    const latMid = (origin.lat + dest.lat) / 2 + Math.abs(origin.lat - dest.lat) * 0.25 + 8;
    const lonMid = (origin.lon + dest.lon) / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic Bezier: B = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const lat = (1-t)*(1-t)*origin.lat + 2*(1-t)*t*latMid + t*t*dest.lat;
      const lon = (1-t)*(1-t)*origin.lon + 2*(1-t)*t*lonMid + t*t*dest.lon;
      points.push([lat, lon]);
    }
    return points;
  }, [route]);

  // Pick tile URL — prefer Thunderforest if key configured, else free OSM
  const tileUrl = TF_KEY
    ? `https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=${TF_KEY}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttr = TF_KEY
    ? '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><img src={Logo} alt="Envoy" className="h-12 w-auto" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900">Home</Link>
            <Link to="/track" className="text-blue-600 font-semibold">Track</Link>
            <Link to="/services" className="hover:text-slate-900">Services</Link>
            <Link to="/about" className="hover:text-slate-900">About</Link>
            <Link to="/contact" className="hover:text-slate-900">Contact</Link>
          </nav>
          <Link to="/services/express" className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition">
            Get a Quote
          </Link>
        </div>
      </header>

      {/* ========== IDLE STATE ========== */}
      {!hasResult && (
        <section className="relative flex-1 overflow-hidden min-h-[80vh]">
          <div className="absolute inset-0 opacity-60"><DotGridBg /></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/60 via-transparent to-slate-50/70 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live tracking · 220+ lanes
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight">
              Track Your Shipment
            </h1>
            <p className="mt-3 text-slate-500 text-lg">Enter your tracking number below</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (ref.trim()) {
                  navigate(`/track?ref=${encodeURIComponent(ref.trim())}`, { replace: true });
                  submitLookup(ref);
                }
              }}
              className="mt-8 mx-auto w-full max-w-2xl flex items-stretch rounded-2xl bg-white border border-slate-200 shadow-2xl p-2"
            >
              <div className="flex items-center px-3 text-slate-400">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                </svg>
              </div>
              <input
                className="flex-1 outline-none px-1 text-base sm:text-lg py-3 bg-transparent placeholder:text-slate-400"
                placeholder="e.g. EV9876543210"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white font-semibold hover:from-blue-400 hover:to-blue-300 transition shadow-md disabled:opacity-60"
              >
                {loading ? "…" : "Track"}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span>Input above:</span>
              {[].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setRef(t);
                    navigate(`/track?ref=${t}`, { replace: true });
                    submitLookup(t);
                  }}
                  className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700 font-mono transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== RESULT STATE (real Leaflet map) ========== */}
      {hasResult && (
        <section className="flex-1">
          {/* Top header row */}
          <div className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Shipment Details of</div>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                    {ship.trackingNumber || ref}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
                    {(ship.status || "in transit").replace("_", " ")}
                  </span>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ref.trim()) {
                    setShip(null);
                    navigate(`/track?ref=${encodeURIComponent(ref.trim())}`, { replace: true });
                    submitLookup(ref);
                  }
                }}
                className="flex items-stretch gap-2 max-w-md w-full sm:w-auto"
              >
                <input
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400 transition"
                  placeholder="Track another shipment"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
                <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition">
                  Track
                </button>
              </form>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid lg:grid-cols-12 gap-6">
              {/* MAP — left 8 columns */}
              <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg relative">
                <div className="aspect-[5/3] lg:aspect-auto lg:h-[600px] relative">
                  {route && (
                    <MapContainer
                      center={[(route.origin.lat + route.dest.lat) / 2, (route.origin.lon + route.dest.lon) / 2]}
                      zoom={3}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                      worldCopyJump={true}
                    >
                      <TileLayer url={tileUrl} attribution={tileAttr} />
                      <FitToRoute origin={route.origin} dest={route.dest} />

                      {routeArc && (
                        <Polyline
                          positions={routeArc}
                          pathOptions={{
                            color: "#3b82f6",
                            weight: 4,
                            opacity: 0.9,
                            dashArray: "8 6",
                          }}
                        />
                      )}

                      <Marker position={[route.origin.lat, route.origin.lon]} icon={bluePin}>
                        <Popup>
                          <b>From</b><br />
                          {route.origin.label}
                        </Popup>
                      </Marker>
                      <Marker position={[route.dest.lat, route.dest.lon]} icon={bluePin}>
                        <Popup>
                          <b>To</b><br />
                          {route.dest.label}
                        </Popup>
                      </Marker>
                    </MapContainer>
                  )}
                </div>

                {/* Floating timeline bottom-left (like reference image) */}
                <div className="absolute left-5 bottom-5 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-4 sm:p-5 max-w-xs hidden sm:block z-[400]">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">Progress</div>
                  <ol className="relative space-y-3">
                    <span className="absolute left-[6px] top-1.5 bottom-1.5 w-0.5 bg-slate-200" />
                    {(ship.timeline || []).map((t, i) => (
                      <li key={i} className="relative pl-5">
                        <span
                          className={`absolute left-0 top-1 w-3 h-3 rounded-full ring-2 ring-white ${
                            t.current ? "bg-blue-500 animate-pulse" : t.done ? "bg-blue-500" : "bg-slate-300"
                          }`}
                        />
                        <div className={`text-xs font-semibold ${t.current ? "text-blue-600" : t.done ? "text-slate-900" : "text-slate-500"}`}>
                          {t.label} <span className="text-slate-400 font-normal">{t.time}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* DETAILS — right 4 columns */}
              <div className="lg:col-span-4 space-y-5">
                <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Estimated Delivery</div>
                  <div className="mt-1 text-3xl font-black">{ship.estimatedDelivery || "Apr 25, 2026"}</div>
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold">From</div>
                      <div className="font-bold">{ship.from}</div>
                    </div>
                    <svg className="w-6 h-6 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-semibold">To</div>
                      <div className="font-bold">{ship.to}</div>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Service</div>
                      <div className="font-semibold">{ship.service || "Express"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Weight</div>
                      <div className="font-semibold">{ship.weight || "2.4 kg"}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Live Updates</div>
                    <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <ul className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                    {(ship.updates || []).map((u, i) => (
                      <li key={i} className="relative pl-5 text-sm">
                        <span className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${i === 0 ? "bg-blue-500" : "bg-slate-300"}`} />
                        <div className="text-xs text-slate-500">{u.date}</div>
                        <div className="text-slate-800 font-medium">{u.note}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Goods photos — discreet thumbs, click to open full size */}
                {Array.isArray(ship.goodsPhotos) && ship.goodsPhotos.length > 0 && (
                  <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                      Parcel Photos
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {ship.goodsPhotos.slice(0, 6).map((url, i) => {
                        const src = typeof url === "string" ? url : url?.url;
                        if (!src) return null;
                        return (
                          <a
                            key={i}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-blue-400 transition"
                            title="Click to enlarge"
                          >
                            <img
                              src={src}
                              alt={`Parcel photo ${i + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          </a>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">
                      Photos captured at booking · for your reference
                    </p>
                  </div>
                )}

                <Link to="/contact" className="block text-center w-full px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition">
                  Contact Support
                </Link>

                {ship._demo && (
                  <p className="text-xs text-slate-500 text-center">
                    This is a demo trace. Real shipment data appears here once connected to our backend.
                  </p>
                )}
              </div>
            </div>

            {/* Mobile timeline below map */}
            <div className="mt-6 lg:hidden rounded-3xl bg-white border border-slate-200 shadow p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">Progress</div>
              <ol className="relative space-y-4">
                <span className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-slate-200" />
                {(ship.timeline || []).map((t, i) => (
                  <li key={i} className="relative pl-6">
                    <span
                      className={`absolute left-0 top-0.5 w-4 h-4 rounded-full ring-2 ring-white ${
                        t.current ? "bg-blue-500 animate-pulse" : t.done ? "bg-blue-500" : "bg-slate-300"
                      }`}
                    />
                    <div className={`text-sm font-semibold ${t.current ? "text-blue-600" : t.done ? "text-slate-900" : "text-slate-500"}`}>
                      {t.label}
                    </div>
                    <div className="text-xs text-slate-500">{t.time}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
