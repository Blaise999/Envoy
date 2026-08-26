// src/utils/geoResolve.js
//
// Robust city/address → { lat, lon, label } resolver.
//
// Resolution waterfall (fast → slow, stops on first hit):
//   1. localStorage cache  (instant, no network)
//   2. Local CITY_COORDS db (huge offline dataset, no network)
//   3. Public Nominatim API (last resort, slowest, rate-limited)
//   4. Country centroid    (guaranteed fallback so a route always plots)
//
// The old /api/geocode proxy step is gone with the Express backend.
//
// Result is cached in localStorage so subsequent loads skip every network hop.
//
// Usage:
//   import { resolveCoords, resolveCoordsAll } from "../utils/geoResolve";
//   const point = await resolveCoords("London, UK");
//   const [origin, dest] = await resolveCoordsAll(["Lagos, NG", "London, UK"]);

import { lookupCoords, lookupCoordsAsync, countryCentroid } from "./geoDb";

const CACHE_KEY = "envoy_geo_cache_v1";
const CACHE_LIMIT = 500;     // keep latest 500 lookups
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ---------- Local cache ---------- */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    return obj;
  } catch {
    return {};
  }
}

function writeCache(obj) {
  try {
    // trim to last N entries by createdAt
    const entries = Object.entries(obj);
    if (entries.length > CACHE_LIMIT) {
      entries.sort(([, a], [, b]) => (b?.t || 0) - (a?.t || 0));
      const trimmed = Object.fromEntries(entries.slice(0, CACHE_LIMIT));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    }
  } catch {}
}

function cacheGet(key) {
  const c = readCache();
  const v = c[key];
  if (!v) return null;
  if (Date.now() - (v.t || 0) > CACHE_TTL_MS) return null;
  if (typeof v.lat !== "number" || typeof v.lon !== "number") return null;
  return { lat: v.lat, lon: v.lon, label: v.label || key, approx: !!v.approx };
}

function cacheSet(key, point) {
  const c = readCache();
  c[key] = {
    lat: point.lat,
    lon: point.lon,
    label: point.label,
    approx: !!point.approx,
    t: Date.now(),
  };
  writeCache(c);
}

/* ---------- Normalisation ---------- */
function normKey(input = "") {
  return String(input).trim().toLowerCase().replace(/\s+/g, " ");
}

function splitCityCountry(text = "") {
  // "Lagos, NG" → ["Lagos", "NG"]
  // "Lagos, Nigeria" → ["Lagos", "Nigeria"]
  // "Lagos" → ["Lagos", ""]
  const parts = String(text).split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  // last segment is country, first is city; ignore middles (regions)
  return [parts[0], parts[parts.length - 1]];
}

/* ---------- Sources ---------- */

// 2. Local geoDb (synchronous, curated set only — no chunk download)
function tryLocal(query) {
  const [city, country] = splitCityCountry(query);
  if (!city) return null;
  const r = lookupCoords(city, country || "");
  if (r && typeof r.lat === "number" && typeof r.lon === "number") {
    return { lat: r.lat, lon: r.lon, label: query };
  }
  return null;
}

// 2b. Local geoDb (async — pulls in the full ~67k-city DB chunk on demand)
async function tryLocalFull(query) {
  const [city, country] = splitCityCountry(query);
  if (!city) return null;
  const r = await lookupCoordsAsync(city, country || "");
  if (r && typeof r.lat === "number" && typeof r.lon === "number") {
    return { lat: r.lat, lon: r.lon, label: query };
  }
  return null;
}

// 4. Country centroid — guaranteed last-resort so a route always plots.
function tryCountry(query) {
  const [, country] = splitCityCountry(query);
  if (!country) return null;
  const c = countryCentroid(country);
  if (c && typeof c.lat === "number" && typeof c.lon === "number") {
    return { lat: c.lat, lon: c.lon, label: query, approx: true };
  }
  return null;
}

// 3. Nominatim (last resort — public, rate-limited to 1/sec)
let nominatimQueue = Promise.resolve();
async function tryNominatim(query) {
  // serialize to be polite
  const task = nominatimQueue.then(async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept": "application/json" } }
      );
      if (!res.ok) return null;
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0] && arr[0].lat && arr[0].lon) {
        return {
          lat: Number(arr[0].lat),
          lon: Number(arr[0].lon),
          label: arr[0].display_name || query,
        };
      }
    } catch {}
    return null;
  });
  // throttle: wait 1.1s between calls
  nominatimQueue = task.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100))
  );
  return task;
}

/* ---------- Public API ---------- */

/**
 * resolveCoords(query) → { lat, lon, label } | null
 *
 * Tries cache → local DB → Nominatim → centroid. Caches successful results.
 */
export async function resolveCoords(query) {
  if (!query) return null;
  const key = normKey(query);

  // 1. cache. A precise hit is final; an approximate (country-centroid) hit
  // is kept only as a fallback while we try to find something precise.
  const hit = cacheGet(key);
  if (hit && !hit.approx) return hit;
  const fallback = hit && hit.approx ? hit : null;

  // 2. local DB — curated set first (instant, no network)
  let result = tryLocal(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 2b. local DB — full ~67k-city set (lazy chunk)
  result = await tryLocalFull(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 3. Nominatim
  result = await tryNominatim(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 4. Country centroid — guaranteed fallback so the map always plots.
  result = fallback || tryCountry(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  return null;
}

/** Resolve a list of queries in parallel (with cache). */
export async function resolveCoordsAll(queries = []) {
  return Promise.all(queries.map((q) => resolveCoords(q)));
}

/** Synchronous: cache + local DB only (no network). Useful for first paint. */
export function resolveCoordsSync(query) {
  if (!query) return null;
  const key = normKey(query);
  const hit = cacheGet(key);
  if (hit) return hit;
  const local = tryLocal(query);
  if (local) {
    cacheSet(key, local);
    return local;
  }
  // Guaranteed fallback: country centroid (so the map plots immediately
  // whenever the text names a recognisable country).
  const country = tryCountry(query);
  if (country) {
    cacheSet(key, country);
    return country;
  }
  return null;
}

/** Manually seed a known coord (useful for admin overrides). */
export function seedCoords(query, lat, lon, label) {
  if (!query || typeof lat !== "number" || typeof lon !== "number") return;
  cacheSet(normKey(query), { lat, lon, label: label || query });
}

/** Clear the local cache (debug helper). */
export function clearGeoCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
