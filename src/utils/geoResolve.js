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

import { supabase } from "../libs/supabaseClient";

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
  return [parts[0], parts[parts.length - 1]];
}

/**
 * Every (city, country) pair worth trying against the local DB.
 *
 * The old code only ever tried the FIRST segment as the city, so
 * "12 Baker Street, London, UK" looked up a city called "12 Baker Street"
 * and always missed. A street address has its city in the middle, so try
 * each segment as the city against the last segment as the country.
 */
function cityCountryCandidates(text = "") {
  const parts = String(text).split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1) return [[parts[0], ""]];

  const country = parts[parts.length - 1];
  const out = [];

  // A postcode starts with at most two letters before its first digit
  // ("NW1 6XE", "SW1A", "10001"). That rule keeps real district names that
  // happen to end in a number, like "Dublin 2".
  const isPostcode = (t) => /^[A-Z]{0,2}\d[\dA-Z\s-]*$/i.test(t);
  const startsWithNumber = (t) => /^\d/.test(t);

  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (!seg) continue;
    if (isPostcode(seg)) continue;
    if (startsWithNumber(seg) && parts.length > 2) continue;  // "12 Baker Street"
    out.push([seg, country]);

    // "Dublin 2" also worth trying as plain "Dublin"
    const stripped = seg.replace(/\s+\d+$/, "").trim();
    if (stripped && stripped !== seg) out.push([stripped, country]);
  }

  if (!out.length) out.push([parts[0], country]);
  return out;
}

/**
 * Does this look like a street address rather than a bare city?
 * If so the server-side geocoder is tried FIRST, because the local database
 * is city-level only and would answer with the wrong precision — a city
 * centroid instead of the actual door.
 */
function looksLikeStreetAddress(text = "") {
  const t = String(text).trim();
  if (/^\d+\s+\S/.test(t)) return true;                       // "12 Baker Street, ..."
  if (/\b(street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|way|boulevard|blvd|plaza|square|sq|crescent|terrace|court|ct|suite|apt|flat|unit|block|no\.?)\b/i.test(t)) return true;
  return t.split(",").filter(Boolean).length >= 3;            // enough parts to be an address
}

/* ---------- Sources ---------- */

// Shared cache in Postgres — one cheap round-trip, no Edge Function cold start.
async function trySharedCache(query) {
  try {
    const { data, error } = await supabase.rpc("geocode_cached", { p_q: query });
    if (error || !data) return null;
    if (data.found === false) return "MISS";   // known-bad, don't re-query upstream
    if (typeof data.lat === "number" && typeof data.lon === "number") {
      return { lat: data.lat, lon: data.lon, label: data.display || query };
    }
  } catch { /* offline / not deployed yet */ }
  return null;
}

// Server-side geocoder: real User-Agent, multiple providers, street-level
// results, and it writes what it finds back into the shared cache.
async function tryEdgeGeocode(query) {
  try {
    const { data, error } = await supabase.functions.invoke("geocode", {
      body: { q: query },
    });
    if (error || !data || data.found === false) return null;
    if (typeof data.lat === "number" && typeof data.lon === "number") {
      return { lat: data.lat, lon: data.lon, label: data.display || query };
    }
  } catch { /* function not deployed — fall through to Nominatim */ }
  return null;
}

// 2. Local geoDb (synchronous, curated set only — no chunk download)
function tryLocal(query) {
  for (const [city, country] of cityCountryCandidates(query)) {
    const r = lookupCoords(city, country || "");
    if (r && typeof r.lat === "number" && typeof r.lon === "number") {
      return { lat: r.lat, lon: r.lon, label: query };
    }
  }
  return null;
}

// 2b. Local geoDb (async — pulls in the full ~67k-city DB chunk on demand)
async function tryLocalFull(query) {
  for (const [city, country] of cityCountryCandidates(query)) {
    const r = await lookupCoordsAsync(city, country || "");
    if (r && typeof r.lat === "number" && typeof r.lon === "number") {
      return { lat: r.lat, lon: r.lon, label: query };
    }
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
 * cache → local DB → shared cache → server geocoder → Nominatim → centroid.
 */
export async function resolveCoords(query) {
  if (!query) return null;
  const key = normKey(query);

  // 1. cache. A precise hit is final; an approximate (country-centroid) hit
  // is kept only as a fallback while we try to find something precise.
  const hit = cacheGet(key);
  if (hit && !hit.approx) return hit;
  const fallback = hit && hit.approx ? hit : null;

  // 1b. Street addresses go to the server geocoder FIRST — the local DB is
  // city-level, so using it here would silently downgrade a door to a city
  // centre. Bare city names skip this and stay instant.
  if (looksLikeStreetAddress(query)) {
    const pre = await trySharedCache(query);
    if (pre && pre !== "MISS") {
      cacheSet(key, pre);
      return pre;
    }
    if (pre !== "MISS") {
      const edge = await tryEdgeGeocode(query);
      if (edge) {
        cacheSet(key, edge);
        return edge;
      }
    }
  }

  // 2. local DB — curated set first (instant, no network)
  let result = tryLocal(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 2b. local DB — full ~64k-city set (lazy static asset)
  result = await tryLocalFull(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 3. shared Postgres cache — someone else may already have resolved this
  const shared = await trySharedCache(query);
  if (shared && shared !== "MISS") {
    cacheSet(key, shared);
    return shared;
  }

  // 4. server-side geocoder (street-level, multi-provider). Skipped when the
  //    shared cache already recorded this query as unresolvable.
  if (shared !== "MISS") {
    result = await tryEdgeGeocode(query);
    if (result) {
      cacheSet(key, result);
      return result;
    }
  }

  // 5. Nominatim direct — last resort if the Edge Function isn't deployed
  result = await tryNominatim(query);
  if (result) {
    cacheSet(key, result);
    return result;
  }

  // 6. Country centroid — guaranteed fallback so the map always plots.
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
