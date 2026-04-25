// src/pages/track/TrackPage.jsx
// Idle: dot-grid world map (branded SVG) + tracking form.
// Result: real Leaflet map with origin/dest markers,
// animated route polyline, progress timeline + receiver details.

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
/*  City coords — lat/lon for Leaflet                            */
/*  Add more here anytime. Best long-term fix: backend coords.    */
/* ============================================================ */
const CITY_COORDS = {
  // United Kingdom
  london: { lat: 51.5074, lon: -0.1278, label: "London, United Kingdom" },
  manchester: { lat: 53.4808, lon: -2.2426, label: "Manchester, United Kingdom" },
  birmingham: { lat: 52.4862, lon: -1.8904, label: "Birmingham, United Kingdom" },
  liverpool: { lat: 53.4084, lon: -2.9916, label: "Liverpool, United Kingdom" },
  leeds: { lat: 53.8008, lon: -1.5491, label: "Leeds, United Kingdom" },
  glasgow: { lat: 55.8642, lon: -4.2518, label: "Glasgow, United Kingdom" },
  edinburgh: { lat: 55.9533, lon: -3.1883, label: "Edinburgh, United Kingdom" },
  bristol: { lat: 51.4545, lon: -2.5879, label: "Bristol, United Kingdom" },
  cardiff: { lat: 51.4816, lon: -3.1791, label: "Cardiff, United Kingdom" },

  // United States
  "new york": { lat: 40.7128, lon: -74.006, label: "New York, USA" },
  "los angeles": { lat: 34.0522, lon: -118.2437, label: "Los Angeles, USA" },
  chicago: { lat: 41.8781, lon: -87.6298, label: "Chicago, USA" },
  houston: { lat: 29.7604, lon: -95.3698, label: "Houston, USA" },
  phoenix: { lat: 33.4484, lon: -112.074, label: "Phoenix, USA" },
  philadelphia: { lat: 39.9526, lon: -75.1652, label: "Philadelphia, USA" },
  "san antonio": { lat: 29.4241, lon: -98.4936, label: "San Antonio, USA" },
  "san diego": { lat: 32.7157, lon: -117.1611, label: "San Diego, USA" },
  dallas: { lat: 32.7767, lon: -96.797, label: "Dallas, USA" },
  "san jose": { lat: 37.3382, lon: -121.8863, label: "San Jose, USA" },
  austin: { lat: 30.2672, lon: -97.7431, label: "Austin, USA" },
  jacksonville: { lat: 30.3322, lon: -81.6557, label: "Jacksonville, USA" },
  "fort worth": { lat: 32.7555, lon: -97.3308, label: "Fort Worth, USA" },
  columbus: { lat: 39.9612, lon: -82.9988, label: "Columbus, USA" },
  charlotte: { lat: 35.2271, lon: -80.8431, label: "Charlotte, USA" },
  "san francisco": { lat: 37.7749, lon: -122.4194, label: "San Francisco, USA" },
  indianapolis: { lat: 39.7684, lon: -86.1581, label: "Indianapolis, USA" },
  seattle: { lat: 47.6062, lon: -122.3321, label: "Seattle, USA" },
  denver: { lat: 39.7392, lon: -104.9903, label: "Denver, USA" },
  washington: { lat: 38.9072, lon: -77.0369, label: "Washington, USA" },
  boston: { lat: 42.3601, lon: -71.0589, label: "Boston, USA" },
  miami: { lat: 25.7617, lon: -80.1918, label: "Miami, USA" },
  atlanta: { lat: 33.749, lon: -84.388, label: "Atlanta, USA" },
  orlando: { lat: 28.5383, lon: -81.3792, label: "Orlando, USA" },
  "las vegas": { lat: 36.1699, lon: -115.1398, label: "Las Vegas, USA" },

  // Canada
  toronto: { lat: 43.6532, lon: -79.3832, label: "Toronto, Canada" },
  vancouver: { lat: 49.2827, lon: -123.1207, label: "Vancouver, Canada" },
  montreal: { lat: 45.5017, lon: -73.5673, label: "Montreal, Canada" },
  calgary: { lat: 51.0447, lon: -114.0719, label: "Calgary, Canada" },
  ottawa: { lat: 45.4215, lon: -75.6972, label: "Ottawa, Canada" },

  // Nigeria
  lagos: { lat: 6.5244, lon: 3.3792, label: "Lagos, Nigeria" },
  abuja: { lat: 9.0765, lon: 7.3986, label: "Abuja, Nigeria" },
  enugu: { lat: 6.4498, lon: 7.5026, label: "Enugu, Nigeria" },
  "port harcourt": { lat: 4.8156, lon: 7.0498, label: "Port Harcourt, Nigeria" },
  ibadan: { lat: 7.3775, lon: 3.947, label: "Ibadan, Nigeria" },
  kano: { lat: 12.0022, lon: 8.592, label: "Kano, Nigeria" },
  kaduna: { lat: 10.5105, lon: 7.4165, label: "Kaduna, Nigeria" },
  owerri: { lat: 5.4891, lon: 7.0176, label: "Owerri, Nigeria" },
  "benin city": { lat: 6.335, lon: 5.6037, label: "Benin City, Nigeria" },
  aba: { lat: 5.1216, lon: 7.3733, label: "Aba, Nigeria" },
  onitsha: { lat: 6.1667, lon: 6.7833, label: "Onitsha, Nigeria" },

  // Ghana / Africa
  accra: { lat: 5.6037, lon: -0.187, label: "Accra, Ghana" },
  kumasi: { lat: 6.6666, lon: -1.6163, label: "Kumasi, Ghana" },
  nairobi: { lat: -1.2921, lon: 36.8219, label: "Nairobi, Kenya" },
  mombasa: { lat: -4.0435, lon: 39.6682, label: "Mombasa, Kenya" },
  "cape town": { lat: -33.9249, lon: 18.4241, label: "Cape Town, South Africa" },
  johannesburg: { lat: -26.2041, lon: 28.0473, label: "Johannesburg, South Africa" },
  pretoria: { lat: -25.7479, lon: 28.2293, label: "Pretoria, South Africa" },
  durban: { lat: -29.8587, lon: 31.0218, label: "Durban, South Africa" },
  cairo: { lat: 30.0444, lon: 31.2357, label: "Cairo, Egypt" },
  alexandria: { lat: 31.2001, lon: 29.9187, label: "Alexandria, Egypt" },
  casablanca: { lat: 33.5731, lon: -7.5898, label: "Casablanca, Morocco" },
  marrakesh: { lat: 31.6295, lon: -7.9811, label: "Marrakesh, Morocco" },
  dakar: { lat: 14.7167, lon: -17.4677, label: "Dakar, Senegal" },
  addis: { lat: 8.9806, lon: 38.7578, label: "Addis Ababa, Ethiopia" },
  "addis ababa": { lat: 8.9806, lon: 38.7578, label: "Addis Ababa, Ethiopia" },

  // Europe
  paris: { lat: 48.8566, lon: 2.3522, label: "Paris, France" },
  marseille: { lat: 43.2965, lon: 5.3698, label: "Marseille, France" },
  lyon: { lat: 45.764, lon: 4.8357, label: "Lyon, France" },
  berlin: { lat: 52.52, lon: 13.405, label: "Berlin, Germany" },
  munich: { lat: 48.1351, lon: 11.582, label: "Munich, Germany" },
  hamburg: { lat: 53.5511, lon: 9.9937, label: "Hamburg, Germany" },
  madrid: { lat: 40.4168, lon: -3.7038, label: "Madrid, Spain" },
  barcelona: { lat: 41.3874, lon: 2.1686, label: "Barcelona, Spain" },
  lisbon: { lat: 38.7223, lon: -9.1393, label: "Lisbon, Portugal" },
  porto: { lat: 41.1579, lon: -8.6291, label: "Porto, Portugal" },
  rome: { lat: 41.9028, lon: 12.4964, label: "Rome, Italy" },
  milan: { lat: 45.4642, lon: 9.19, label: "Milan, Italy" },
  naples: { lat: 40.8518, lon: 14.2681, label: "Naples, Italy" },
  amsterdam: { lat: 52.3676, lon: 4.9041, label: "Amsterdam, Netherlands" },
  rotterdam: { lat: 51.9244, lon: 4.4777, label: "Rotterdam, Netherlands" },
  brussels: { lat: 50.8503, lon: 4.3517, label: "Brussels, Belgium" },
  antwerp: { lat: 51.2194, lon: 4.4025, label: "Antwerp, Belgium" },
  zurich: { lat: 47.3769, lon: 8.5417, label: "Zurich, Switzerland" },
  geneva: { lat: 46.2044, lon: 6.1432, label: "Geneva, Switzerland" },
  vienna: { lat: 48.2082, lon: 16.3738, label: "Vienna, Austria" },
  prague: { lat: 50.0755, lon: 14.4378, label: "Prague, Czech Republic" },
  warsaw: { lat: 52.2297, lon: 21.0122, label: "Warsaw, Poland" },
  stockholm: { lat: 59.3293, lon: 18.0686, label: "Stockholm, Sweden" },
  oslo: { lat: 59.9139, lon: 10.7522, label: "Oslo, Norway" },
  copenhagen: { lat: 55.6761, lon: 12.5683, label: "Copenhagen, Denmark" },
  helsinki: { lat: 60.1699, lon: 24.9384, label: "Helsinki, Finland" },
  dublin: { lat: 53.3498, lon: -6.2603, label: "Dublin, Ireland" },
  athens: { lat: 37.9838, lon: 23.7275, label: "Athens, Greece" },
  istanbul: { lat: 41.0082, lon: 28.9784, label: "Istanbul, Turkey" },

  // Middle East
  dubai: { lat: 25.2048, lon: 55.2708, label: "Dubai, UAE" },
  "abu dhabi": { lat: 24.4539, lon: 54.3773, label: "Abu Dhabi, UAE" },
  doha: { lat: 25.2854, lon: 51.531, label: "Doha, Qatar" },
  riyadh: { lat: 24.7136, lon: 46.6753, label: "Riyadh, Saudi Arabia" },
  jeddah: { lat: 21.4858, lon: 39.1925, label: "Jeddah, Saudi Arabia" },
  telaviv: { lat: 32.0853, lon: 34.7818, label: "Tel Aviv, Israel" },
  "tel aviv": { lat: 32.0853, lon: 34.7818, label: "Tel Aviv, Israel" },

  // Asia
  tokyo: { lat: 35.6762, lon: 139.6503, label: "Tokyo, Japan" },
  osaka: { lat: 34.6937, lon: 135.5023, label: "Osaka, Japan" },
  kyoto: { lat: 35.0116, lon: 135.7681, label: "Kyoto, Japan" },
  beijing: { lat: 39.9042, lon: 116.4074, label: "Beijing, China" },
  shanghai: { lat: 31.2304, lon: 121.4737, label: "Shanghai, China" },
  guangzhou: { lat: 23.1291, lon: 113.2644, label: "Guangzhou, China" },
  shenzhen: { lat: 22.5431, lon: 114.0579, label: "Shenzhen, China" },
  hongkong: { lat: 22.3193, lon: 114.1694, label: "Hong Kong" },
  "hong kong": { lat: 22.3193, lon: 114.1694, label: "Hong Kong" },
  singapore: { lat: 1.3521, lon: 103.8198, label: "Singapore" },
  seoul: { lat: 37.5665, lon: 126.978, label: "Seoul, South Korea" },
  mumbai: { lat: 19.076, lon: 72.8777, label: "Mumbai, India" },
  delhi: { lat: 28.7041, lon: 77.1025, label: "Delhi, India" },
  bangalore: { lat: 12.9716, lon: 77.5946, label: "Bangalore, India" },
  chennai: { lat: 13.0827, lon: 80.2707, label: "Chennai, India" },
  hyderabad: { lat: 17.385, lon: 78.4867, label: "Hyderabad, India" },
  bangkok: { lat: 13.7563, lon: 100.5018, label: "Bangkok, Thailand" },
  kuala: { lat: 3.139, lon: 101.6869, label: "Kuala Lumpur, Malaysia" },
  "kuala lumpur": { lat: 3.139, lon: 101.6869, label: "Kuala Lumpur, Malaysia" },
  jakarta: { lat: -6.2088, lon: 106.8456, label: "Jakarta, Indonesia" },
  manila: { lat: 14.5995, lon: 120.9842, label: "Manila, Philippines" },
  hanoi: { lat: 21.0278, lon: 105.8342, label: "Hanoi, Vietnam" },
  "ho chi minh": { lat: 10.8231, lon: 106.6297, label: "Ho Chi Minh City, Vietnam" },

  // Australia / Oceania
  sydney: { lat: -33.8688, lon: 151.2093, label: "Sydney, Australia" },
  melbourne: { lat: -37.8136, lon: 144.9631, label: "Melbourne, Australia" },
  brisbane: { lat: -27.4698, lon: 153.0251, label: "Brisbane, Australia" },
  perth: { lat: -31.9523, lon: 115.8613, label: "Perth, Australia" },
  auckland: { lat: -36.8509, lon: 174.7645, label: "Auckland, New Zealand" },
  wellington: { lat: -41.2865, lon: 174.7762, label: "Wellington, New Zealand" },

  // South America
  "sao paulo": { lat: -23.5558, lon: -46.6396, label: "São Paulo, Brazil" },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729, label: "Rio de Janeiro, Brazil" },
  buenosaires: { lat: -34.6037, lon: -58.3816, label: "Buenos Aires, Argentina" },
  "buenos aires": { lat: -34.6037, lon: -58.3816, label: "Buenos Aires, Argentina" },
  santiago: { lat: -33.4489, lon: -70.6693, label: "Santiago, Chile" },
  lima: { lat: -12.0464, lon: -77.0428, label: "Lima, Peru" },
  bogota: { lat: 4.711, lon: -74.0721, label: "Bogotá, Colombia" },
  medellin: { lat: 6.2442, lon: -75.5812, label: "Medellín, Colombia" },

  // Mexico / Caribbean
  "mexico city": { lat: 19.4326, lon: -99.1332, label: "Mexico City, Mexico" },
  cancun: { lat: 21.1619, lon: -86.8515, label: "Cancún, Mexico" },
  havana: { lat: 23.1136, lon: -82.3666, label: "Havana, Cuba" },
  "santo domingo": { lat: 18.4861, lon: -69.9312, label: "Santo Domingo, Dominican Republic" },
  kingston: { lat: 17.9712, lon: -76.7936, label: "Kingston, Jamaica" },
};

function normalizeLocationText(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCity(str = "") {
  const s = normalizeLocationText(str);
  if (!s) return null;

  // Exact key or contained key match
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (s === k || s.includes(k)) return v;
  }

  return null;
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordFromFields({ lat, lon, lng, label }) {
  const finalLat = numberOrNull(lat);
  const finalLon = numberOrNull(lon ?? lng);
  if (finalLat === null || finalLon === null) return null;
  return {
    lat: finalLat,
    lon: finalLon,
    label: label || "Location",
  };
}

function buildPointFromShipment(ship, type) {
  if (!ship) return null;

  if (type === "origin") {
    const fromText = firstNonEmpty(
      ship.from,
      ship.origin,
      ship.originAddress,
      ship.senderAddress,
      ship.pickupAddress
    );

    // Supports backend returning origin coordinates in many possible shapes
    const direct = coordFromFields({
      lat: firstNonEmpty(ship.originLat, ship.fromLat, ship.pickupLat, ship.origin?.lat, ship.fromCoords?.lat),
      lon: firstNonEmpty(
        ship.originLon,
        ship.originLng,
        ship.fromLon,
        ship.fromLng,
        ship.pickupLon,
        ship.pickupLng,
        ship.origin?.lon,
        ship.origin?.lng,
        ship.fromCoords?.lon,
        ship.fromCoords?.lng
      ),
      label: fromText || "Origin",
    });

    if (direct) return direct;

    const found = findCity(fromText);
    if (found) return { ...found, label: fromText || found.label };

    return null;
  }

  const toText = firstNonEmpty(
    ship.to,
    ship.destination,
    ship.dest,
    ship.destinationAddress,
    ship.recipientAddress,
    ship.deliveryAddress
  );

  // Supports backend returning destination coordinates in many possible shapes
  const direct = coordFromFields({
    lat: firstNonEmpty(
      ship.destinationLat,
      ship.destLat,
      ship.toLat,
      ship.deliveryLat,
      ship.destination?.lat,
      ship.toCoords?.lat,
      ship.destCoords?.lat
    ),
    lon: firstNonEmpty(
      ship.destinationLon,
      ship.destinationLng,
      ship.destLon,
      ship.destLng,
      ship.toLon,
      ship.toLng,
      ship.deliveryLon,
      ship.deliveryLng,
      ship.destination?.lon,
      ship.destination?.lng,
      ship.toCoords?.lon,
      ship.toCoords?.lng,
      ship.destCoords?.lon,
      ship.destCoords?.lng
    ),
    label: toText || "Destination",
  });

  if (direct) return direct;

  const found = findCity(toText);
  if (found) return { ...found, label: toText || found.label };

  return null;
}

function buildDemo(ref) {
  return {
    trackingNumber: ref,
    status: "IN_TRANSIT",
    from: "Denver, USA",
    to: "London, United Kingdom",
    estimatedDelivery: "Apr 25, 2026",
    service: "Express",
    weight: "2.4 kg",

    recipientEmail: "receiver@example.com",
    recipientAddress: "221B Baker Street, London, United Kingdom",
    contact: {
      shipperName: "Demo Sender",
      shipperEmail: "sender@example.com",
      shipperPhone: "+1 303 000 0000",
      recipientName: "Demo Receiver",
      recipientPhone: "+44 20 0000 0000",
    },

    timeline: [
      { label: "Ordered", time: "Apr 15, 9:30 AM", done: true },
      { label: "Picked Up", time: "Apr 15, 2:15 PM", done: true },
      { label: "Processed", time: "Apr 16, 8:00 AM", done: true },
      { label: "In Transit", time: "Apr 17, 6:45 AM", done: true, current: true },
      { label: "Out for Delivery", time: "Apr 24, —", done: false },
      { label: "Delivered", time: "Apr 25, —", done: false },
    ],
    updates: [
      { date: "Apr 20, 2026 · 14:22", note: "Flight touched down near destination hub" },
      { date: "Apr 18, 2026 · 09:14", note: "Departed origin sorting centre" },
      { date: "Apr 17, 2026 · 18:03", note: "Cleared outbound customs" },
      { date: "Apr 16, 2026 · 11:40", note: "Arrived origin hub" },
      { date: "Apr 15, 2026 · 14:15", note: "Picked up from shipper" },
      { date: "Apr 15, 2026 · 09:30", note: "Shipment created" },
    ],
    _demo: true,
  };
}

/* ============================================================ */
/*  Custom blue marker                                           */
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
/*  Idle dot-grid SVG                                            */
/* ============================================================ */
function DotGridBg() {
  const continents = [
    [0.18, 0.42, 0.12, 0.22],
    [0.27, 0.72, 0.06, 0.18],
    [0.47, 0.38, 0.09, 0.14],
    [0.52, 0.66, 0.07, 0.15],
    [0.7, 0.46, 0.17, 0.2],
    [0.84, 0.78, 0.07, 0.1],
  ];

  const dots = useMemo(() => {
    const arr = [];
    const rows = 44;
    const cols = 88;

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

function ReceiverDetailsCard({ ship }) {
  const recipientName = firstNonEmpty(
    ship?.contact?.recipientName,
    ship?.recipientName,
    ship?.receiverName,
    ship?.consigneeName
  );

  const recipientEmail = firstNonEmpty(
    ship?.recipientEmail,
    ship?.contact?.recipientEmail,
    ship?.receiverEmail,
    ship?.consigneeEmail
  );

  const recipientPhone = firstNonEmpty(
    ship?.contact?.recipientPhone,
    ship?.recipientPhone,
    ship?.receiverPhone,
    ship?.consigneePhone
  );

  const recipientAddress = firstNonEmpty(
    ship?.recipientAddress,
    ship?.deliveryAddress,
    ship?.destinationAddress,
    ship?.receiverAddress,
    ship?.consigneeAddress
  );

  const finalDestination = firstNonEmpty(ship?.to, ship?.destination, ship?.dest);

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
        Receiver Details
      </div>

      <div className="grid gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-400">Name</div>
          <div className="font-semibold text-slate-900">
            {recipientName || "Not provided"}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-400">Email</div>
            <div className="font-semibold break-all text-slate-900">
              {recipientEmail || "Not provided"}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Phone</div>
            <div className="font-semibold text-slate-900">
              {recipientPhone || "Not provided"}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Final destination</div>
          <div className="font-semibold text-slate-900">
            {finalDestination || "Not provided"}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Final address</div>
          <div className="font-semibold text-slate-900">
            {recipientAddress || "Not provided"}
          </div>
        </div>
      </div>
    </div>
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

      // The real backend should return trackingNumber/id plus receiver fields.
      // If not found, we show demo data.
      setShip(data && (data.trackingNumber || data.id) ? data : buildDemo(id));
    } catch (e) {
      setShip(buildDemo(id));
    } finally {
      setLoading(false);
    }
  }

  const hasResult = !!ship;

  const route = useMemo(() => {
    if (!ship) return null;

    const origin = buildPointFromShipment(ship, "origin");
    const dest = buildPointFromShipment(ship, "dest");

    if (!origin || !dest) {
      console.warn("Map route unavailable. Missing coordinates/city match for shipment:", {
        from: ship.from || ship.origin,
        to: ship.to || ship.dest || ship.destination,
        ship,
      });
      return null;
    }

    return { origin, dest };
  }, [ship]);

  // Great-circle-ish curve for polyline
  const routeArc = useMemo(() => {
    if (!route) return null;

    const { origin, dest } = route;
    const steps = 40;
    const points = [];

    const latMid = (origin.lat + dest.lat) / 2 + Math.abs(origin.lat - dest.lat) * 0.25 + 8;
    const lonMid = (origin.lon + dest.lon) / 2;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      const lat =
        (1 - t) * (1 - t) * origin.lat +
        2 * (1 - t) * t * latMid +
        t * t * dest.lat;

      const lon =
        (1 - t) * (1 - t) * origin.lon +
        2 * (1 - t) * t * lonMid +
        t * t * dest.lon;

      points.push([lat, lon]);
    }

    return points;
  }, [route]);

  const tileUrl = TF_KEY
    ? `https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=${TF_KEY}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tileAttr = TF_KEY
    ? '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const shipperName = firstNonEmpty(ship?.contact?.shipperName, ship?.shipperName, ship?.senderName);
  const fromText = firstNonEmpty(ship?.from, ship?.origin, ship?.originAddress, "Origin unavailable");
  const toText = firstNonEmpty(ship?.to, ship?.destination, ship?.dest, "Destination unavailable");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={Logo} alt="Envoy" className="h-12 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900">Home</Link>
            <Link to="/track" className="text-blue-600 font-semibold">Track</Link>
            <Link to="/services" className="hover:text-slate-900">Services</Link>
            <Link to="/about" className="hover:text-slate-900">About</Link>
            <Link to="/contact" className="hover:text-slate-900">Contact</Link>
          </nav>

          <Link
            to="/services/express"
            className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition"
          >
            Get a Quote
          </Link>
        </div>
      </header>

      {/* ========== IDLE STATE ========== */}
      {!hasResult && (
        <section className="relative flex-1 overflow-hidden min-h-[80vh]">
          <div className="absolute inset-0 opacity-60">
            <DotGridBg />
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/60 via-transparent to-slate-50/70 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live tracking · 220+ lanes
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight">
              Track Your Shipment
            </h1>

            <p className="mt-3 text-slate-500 text-lg">
              Enter your tracking number below
            </p>

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
          </div>
        </section>
      )}

      {/* ========== RESULT STATE ========== */}
      {hasResult && (
        <section className="flex-1">
          {/* Top header row */}
          <div className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  Shipment Details of
                </div>

                <div className="mt-1 flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                    {ship.trackingNumber || ship.id || ref}
                  </h1>

                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
                    {(ship.status || "in transit").replaceAll("_", " ")}
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
              {/* MAP */}
              <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-lg relative">
                <div className="aspect-[5/3] lg:aspect-auto lg:h-[600px] relative">
                  {route ? (
                    <MapContainer
                      center={[
                        (route.origin.lat + route.dest.lat) / 2,
                        (route.origin.lon + route.dest.lon) / 2,
                      ]}
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
                          <b>From</b>
                          <br />
                          {route.origin.label}
                        </Popup>
                      </Marker>

                      <Marker position={[route.dest.lat, route.dest.lon]} icon={bluePin}>
                        <Popup>
                          <b>Final destination</b>
                          <br />
                          {route.dest.label}
                        </Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-slate-100 text-center px-6">
                      <div>
                        <div className="text-slate-700 font-bold">Map route unavailable</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Add coordinates from backend or add this city to CITY_COORDS.
                        </div>
                        <div className="mt-3 text-xs text-slate-400">
                          From: {fromText}
                          <br />
                          To: {toText}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating timeline bottom-left */}
                <div className="absolute left-5 bottom-5 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-4 sm:p-5 max-w-xs hidden sm:block z-[400]">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">
                    Progress
                  </div>

                  <ol className="relative space-y-3">
                    <span className="absolute left-[6px] top-1.5 bottom-1.5 w-0.5 bg-slate-200" />

                    {(ship.timeline || []).map((t, i) => (
                      <li key={i} className="relative pl-5">
                        <span
                          className={`absolute left-0 top-1 w-3 h-3 rounded-full ring-2 ring-white ${
                            t.current
                              ? "bg-blue-500 animate-pulse"
                              : t.done
                              ? "bg-blue-500"
                              : "bg-slate-300"
                          }`}
                        />

                        <div
                          className={`text-xs font-semibold ${
                            t.current
                              ? "text-blue-600"
                              : t.done
                              ? "text-slate-900"
                              : "text-slate-500"
                          }`}
                        >
                          {t.label}{" "}
                          <span className="text-slate-400 font-normal">
                            {t.time}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* DETAILS */}
              <div className="lg:col-span-4 space-y-5">
                <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                    Estimated Delivery
                  </div>

                  <div className="mt-1 text-3xl font-black">
                    {ship.estimatedDelivery || ship.eta || "Pending"}
                  </div>

                  <div className="mt-5 grid gap-5">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                      <div>
                        <div className="text-xs text-slate-400 font-semibold">From</div>
                        <div className="font-bold">{fromText}</div>
                        {shipperName ? (
                          <div className="text-xs text-slate-500 mt-1">{shipperName}</div>
                        ) : null}
                      </div>

                      <svg
                        className="w-6 h-6 text-blue-500 shrink-0 mt-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-semibold">To</div>
                        <div className="font-bold">{toText}</div>
                        <div className="text-xs text-slate-500 mt-1">Final destination</div>
                      </div>
                    </div>

                    <ReceiverDetailsCard ship={ship} />
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Service</div>
                      <div className="font-semibold">{ship.service || ship.serviceType || "Express"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Weight</div>
                      <div className="font-semibold">
                        {ship.weight || ship.parcel?.weight || ship.freight?.weight || "Pending"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                      Live Updates
                    </div>

                    <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>

                  <ul className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                    {(ship.updates || []).map((u, i) => (
                      <li key={i} className="relative pl-5 text-sm">
                        <span
                          className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${
                            i === 0 ? "bg-blue-500" : "bg-slate-300"
                          }`}
                        />

                        <div className="text-xs text-slate-500">{u.date}</div>
                        <div className="text-slate-800 font-medium">{u.note}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Goods photos */}
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
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
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

                <Link
                  to="/contact"
                  className="block text-center w-full px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
                >
                  Contact Support
                </Link>

                {ship._demo && (
                  <p className="text-xs text-slate-500 text-center">
                    This is a demo trace. Real shipment data appears here once connected to your backend.
                  </p>
                )}
              </div>
            </div>

            {/* Mobile timeline */}
            <div className="mt-6 lg:hidden rounded-3xl bg-white border border-slate-200 shadow p-5">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">
                Progress
              </div>

              <ol className="relative space-y-4">
                <span className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-slate-200" />

                {(ship.timeline || []).map((t, i) => (
                  <li key={i} className="relative pl-6">
                    <span
                      className={`absolute left-0 top-0.5 w-4 h-4 rounded-full ring-2 ring-white ${
                        t.current
                          ? "bg-blue-500 animate-pulse"
                          : t.done
                          ? "bg-blue-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <div
                      className={`text-sm font-semibold ${
                        t.current
                          ? "text-blue-600"
                          : t.done
                          ? "text-slate-900"
                          : "text-slate-500"
                      }`}
                    >
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