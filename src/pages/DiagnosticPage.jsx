// src/pages/DiagnosticPage.jsx
// Visit /diagnostic to probe Supabase and see exactly what's failing.
// Rewritten for the Supabase backend — the old version probed the Render
// Express service, which no longer exists.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../libs/supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "(not set)";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function ts() {
  return new Date().toLocaleTimeString();
}

export default function DiagnosticPage() {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);

  function log(line, cls = "text-slate-700") {
    setLogs((L) => [...L, { t: ts(), line, cls }]);
  }

  async function probe(name, fn) {
    const started = Date.now();
    log(`→ ${name} …`);
    try {
      const result = await fn();
      const ms = Date.now() - started;
      log(`✓ ${name} — ok in ${ms}ms ${result ? `· ${result}` : ""}`, "text-blue-700");
      return true;
    } catch (e) {
      const ms = Date.now() - started;
      log(
        `✗ ${name} — FAILED after ${ms}ms · ${e?.name || ""} · ${e?.message || e}`,
        "text-rose-600"
      );
      return false;
    }
  }

  async function runAll() {
    setLogs([]);
    setRunning(true);

    log(`env: VITE_SUPABASE_URL = ${SUPABASE_URL}`);
    log(`env: VITE_SUPABASE_ANON_KEY = ${ANON_KEY ? `set (${ANON_KEY.length} chars)` : "MISSING"}`);
    log(`env: MODE = ${import.meta.env.MODE}`);
    log(`origin: ${window.location.origin}`);
    log("—");

    // 1) Can we reach the project at all?
    const reachable = await probe("Supabase REST reachable", async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: ANON_KEY },
        cache: "no-store",
      });
      return `HTTP ${r.status}`;
    });

    // 2) Auth service
    await probe("Auth service (getSession)", async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data?.session ? `signed in as ${data.session.user.email}` : "no active session";
    });

    // 3) Public RPC — proves the schema migration ran and anon has EXECUTE
    await probe("rpc quote_shipment (schema + grants)", async () => {
      const { data, error } = await supabase.rpc("quote_shipment", {
        payload: { parcel: { weight: 2, length: 20, width: 20, height: 20 }, serviceLevel: "express" },
      });
      if (error) throw error;
      return `quoted ${data?.currency} ${data?.price}`;
    });

    // 4) Public tracking RPC — a miss returns null, which is still a pass
    await probe("rpc track_shipment (anon access)", async () => {
      const { error } = await supabase.rpc("track_shipment", { p_tracking: "EV000000000000" });
      if (error) throw error;
      return "callable (unknown tracking returns null, as expected)";
    });

    // 5) Discount / routing codes
    await probe('rpc validate_discount_code("blaise")', async () => {
      const { data, error } = await supabase.rpc("validate_discount_code", { p_code: "blaise" });
      if (error) throw error;
      return data?.valid
        ? `valid · ${data.percentOff}% off · routes to a specific admin`
        : `NOT FOUND — did the seed migration run?`;
    });

    // 6) RLS sanity: anon must NOT be able to read the shipments table directly
    await probe("RLS: direct anon read of shipments is blocked", async () => {
      const { data, error } = await supabase.from("shipments").select("id").limit(1);
      if (error) return `blocked (${error.message})`;
      if (!data || data.length === 0) return "returned 0 rows (RLS working)";
      throw new Error(`LEAK: anon read ${data.length} shipment row(s) — check RLS policies`);
    });

    // 7) Storage bucket for goods photos
    await probe("Storage bucket `goods`", async () => {
      const { error } = await supabase.storage.from("goods").list("shipments", { limit: 1 });
      if (error) throw error;
      return "reachable";
    });

    // 8) Rules out the user's own network
    await probe("GET https://www.google.com/generate_204", async () => {
      await fetch("https://www.google.com/generate_204", { mode: "no-cors", cache: "no-store" });
      return "reachable (no-cors)";
    });

    log("—");
    if (!reachable) {
      log(
        "Supabase is unreachable. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env, " +
          "and that the project isn't paused in the Supabase dashboard.",
        "text-rose-700"
      );
    } else {
      log("Reachable. Any ✗ above points at the specific missing piece.", "text-amber-700");
    }
    setRunning(false);
  }

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Supabase Diagnostic</h1>
          <div className="flex gap-2">
            <button
              onClick={runAll}
              disabled={running}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm disabled:opacity-50"
            >
              {running ? "Running…" : "Re-run probes"}
            </button>
            <Link to="/" className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-sm">
              Home
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-black/50 border border-slate-700 p-4 font-mono text-xs leading-6">
          {logs.map((l, i) => (
            <div key={i} className={l.cls}>
              <span className="text-slate-500">[{l.t}]</span> {l.line}
            </div>
          ))}
          {logs.length === 0 && <div className="text-slate-500">Waiting…</div>}
        </div>

        <details className="mt-6 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold">What do these results mean?</summary>
          <div className="mt-3 space-y-2 text-slate-400">
            <p>
              <b className="text-rose-400">REST unreachable / anon key missing</b> → the `.env` isn't
              wired up, or the project is paused. Copy `.env.example` to `.env` and fill in the URL
              and anon key from Supabase → Project Settings → API.
            </p>
            <p>
              <b className="text-amber-400">`quote_shipment` fails with "function does not exist"</b> →
              the migrations in `supabase/migrations/` haven't been run. Run them in order via the
              SQL editor or `supabase db push`.
            </p>
            <p>
              <b className="text-amber-400">`validate_discount_code` says NOT FOUND</b> → the schema
              is there but the seed migration (`…_seed_admins.sql`) hasn't run, so the admins and the
              "blaise" routing code don't exist yet.
            </p>
            <p>
              <b className="text-rose-400">RLS LEAK</b> → anonymous visitors can read the shipments
              table. Re-run `…_rls.sql`; this one matters.
            </p>
            <p>
              <b className="text-amber-400">Google probe fails too</b> → your own network is blocking
              something. Try a different network or disable VPN/blockers.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
