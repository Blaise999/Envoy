// supabase/functions/geocode/index.ts
//
// Server-side geocoder. Solves the three things a browser cannot:
//
//   1. Sends a proper identifying User-Agent (Nominatim's usage policy
//      requires one; browsers can't set it, so browser requests get blocked
//      under load).
//   2. Caches every result in public.geocodes, shared by ALL visitors. The
//      second person to ship to Onitsha gets a Postgres hit, not a network
//      round-trip.
//   3. Falls through multiple providers, so full street addresses resolve —
//      not just "City, Country".
//
// Optional secrets (each unlocks a better provider; Nominatim needs none):
//   GEOAPIFY_KEY     https://www.geoapify.com   3k/day free
//   LOCATIONIQ_KEY   https://locationiq.com     5k/day free
//   MAPBOX_TOKEN     https://mapbox.com         100k/mo free
//   GEOCODE_UA       contact string for Nominatim, e.g. "Envoy/1.0 (ops@shipenvoy.com)"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");

const GEOAPIFY_KEY = env("GEOAPIFY_KEY");
const LOCATIONIQ_KEY = env("LOCATIONIQ_KEY");
const MAPBOX_TOKEN = env("MAPBOX_TOKEN");
const GEOCODE_UA = env("GEOCODE_UA", "EnvoyCourier/1.0 (+https://www.shipenvoy.com)");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

type Hit = {
  lat: number;
  lon: number;
  display: string;
  precision: string;
  provider: string;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/* ------------------------------- providers ------------------------------- */

/** Geoapify — good street-level coverage, generous free tier. */
async function viaGeoapify(q: string): Promise<Hit | null> {
  if (!GEOAPIFY_KEY) return null;
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&limit=1&format=json&apiKey=${GEOAPIFY_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const f = d?.results?.[0];
  if (!f?.lat || !f?.lon) return null;
  return {
    lat: Number(f.lat),
    lon: Number(f.lon),
    display: f.formatted ?? q,
    precision: f.housenumber ? "address" : f.street ? "street" : f.city ? "city" : "region",
    provider: "geoapify",
  };
}

/** LocationIQ — Nominatim-compatible, commercial-friendly. */
async function viaLocationIQ(q: string): Promise<Hit | null> {
  if (!LOCATIONIQ_KEY) return null;
  const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const f = Array.isArray(d) ? d[0] : null;
  if (!f?.lat || !f?.lon) return null;
  const a = f.address ?? {};
  return {
    lat: Number(f.lat),
    lon: Number(f.lon),
    display: f.display_name ?? q,
    precision: a.house_number ? "address" : a.road ? "street" : (a.city || a.town || a.village) ? "city" : "region",
    provider: "locationiq",
  };
}

/** Mapbox — very strong on partial/messy input. */
async function viaMapbox(q: string): Promise<Hit | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const f = d?.features?.[0];
  if (!Array.isArray(f?.center)) return null;
  const t: string[] = f.place_type ?? [];
  return {
    lat: Number(f.center[1]),
    lon: Number(f.center[0]),
    display: f.place_name ?? q,
    precision: t.includes("address") ? "address"
      : t.includes("street") ? "street"
      : t.includes("place") || t.includes("locality") ? "city"
      : t.includes("country") ? "country" : "region",
    provider: "mapbox",
  };
}

/** Nominatim — free, no key. Fine from a server with a real User-Agent. */
async function viaNominatim(q: string): Promise<Hit | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": GEOCODE_UA, "Accept": "application/json" },
  });
  if (!r.ok) return null;
  const d = await r.json();
  const f = Array.isArray(d) ? d[0] : null;
  if (!f?.lat || !f?.lon) return null;
  const a = f.address ?? {};
  return {
    lat: Number(f.lat),
    lon: Number(f.lon),
    display: f.display_name ?? q,
    precision: a.house_number ? "address" : a.road ? "street" : (a.city || a.town || a.village) ? "city" : "region",
    provider: "nominatim",
  };
}

/**
 * Try providers in order of quality, stopping at the first hit. Keyed
 * providers come first because they handle messy free-form input better;
 * Nominatim is the always-available floor.
 */
async function geocodeUpstream(q: string): Promise<Hit | null> {
  const chain = [viaGeoapify, viaLocationIQ, viaMapbox, viaNominatim];
  for (const fn of chain) {
    try {
      const hit = await fn(q);
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) return hit;
    } catch (e) {
      console.warn(`[geocode] ${fn.name} failed:`, (e as Error).message);
    }
  }
  return null;
}

/**
 * Progressively drop the most specific parts of an address until something
 * resolves. "44 Ojukwu Road, Awka, Anambra, Nigeria" that fails at street
 * level still yields Awka rather than nothing.
 */
function broadenings(q: string): string[] {
  const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [q];
  for (let i = 1; i < parts.length - 1 && out.length < 4; i++) {
    out.push(parts.slice(i).join(", "));
  }
  if (parts.length > 1) out.push(parts.slice(-2).join(", "));
  return [...new Set(out)];
}

/* -------------------------------- handler -------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const queries: string[] = Array.isArray(body.queries)
      ? body.queries
      : body.q
      ? [String(body.q)]
      : [];

    if (!queries.length) return json({ error: "q or queries is required" }, 400);
    if (queries.length > 10) return json({ error: "Maximum 10 queries per call" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const results: Record<string, unknown> = {};

    for (const raw of queries) {
      const q = String(raw ?? "").trim();
      if (!q) continue;
      const key = norm(q);

      // 1. cache
      const { data: cached } = await db
        .from("geocodes")
        .select("*")
        .eq("query_norm", key)
        .maybeSingle();

      const staleMiss =
        cached && !cached.found &&
        new Date(cached.updated_at).getTime() < Date.now() - 7 * 864e5;

      if (cached && !staleMiss) {
        await db.from("geocodes").update({ hits: (cached.hits ?? 0) + 1 }).eq("query_norm", key);
        results[q] = cached.found
          ? {
              found: true, lat: cached.lat, lon: cached.lon,
              display: cached.display, precision: cached.precision,
              provider: cached.provider, cached: true,
            }
          : { found: false, cached: true };
        continue;
      }

      // 2. upstream, broadening on failure
      let hit: Hit | null = null;
      let usedQuery = q;
      for (const attempt of broadenings(q)) {
        hit = await geocodeUpstream(attempt);
        if (hit) { usedQuery = attempt; break; }
      }

      // 3. write through (negative results cached too, so typos don't
      //    hammer the upstream provider on every page view)
      await db.from("geocodes").upsert(
        {
          query_norm: key,
          query_raw: q,
          lat: hit?.lat ?? null,
          lon: hit?.lon ?? null,
          display: hit?.display ?? null,
          precision: hit?.precision ?? "unknown",
          provider: hit?.provider ?? "none",
          found: !!hit,
          hits: 1,
        },
        { onConflict: "query_norm" },
      );

      results[q] = hit
        ? {
            found: true, lat: hit.lat, lon: hit.lon,
            display: hit.display, precision: hit.precision,
            provider: hit.provider, cached: false,
            ...(usedQuery !== q ? { broadenedTo: usedQuery } : {}),
          }
        : { found: false, cached: false };
    }

    // single-query calls get the object directly
    if (queries.length === 1) return json(results[String(queries[0]).trim()] ?? { found: false });
    return json({ results });
  } catch (e) {
    console.error("[geocode]", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
