// src/pages/DiagnosticPage.jsx
// Visit /diagnostic to probe the backend and see exactly what's failing.
// No dependencies on the rest of the app — pure fetch + DOM.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "/api";

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
      log(`✓ ${name} — ok in ${ms}ms ${result ? `· ${result}` : ""}`, "text-emerald-700");
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

    log(`env: VITE_API_BASE = ${API_BASE}`);
    log(`env: MODE = ${import.meta.env.MODE}`);
    log(`origin: ${window.location.origin}`);
    log(`userAgent: ${navigator.userAgent}`);
    log("—");

    // 1) Simple GET health — no CORS preflight, no body
    const healthURL = `${String(API_BASE).replace(/\/$/, "")}/health`;
    const healthOk = await probe(`GET ${healthURL}`, async () => {
      const r = await fetch(healthURL, { cache: "no-store" });
      const txt = await r.text();
      return `HTTP ${r.status} · body: ${txt.slice(0, 120)}`;
    });

    // 2) CORS preflight check — OPTIONS with made-up headers
    await probe(`OPTIONS preflight ${healthURL}`, async () => {
      const r = await fetch(healthURL, {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
          Origin: window.location.origin,
        },
      });
      return `HTTP ${r.status}`;
    });

    // 3) POST shipments/public with a clearly-invalid body, just to see if
    //    the connection completes. We don't care if it 400s — that proves
    //    the server is reachable and handling POST.
    const createURL = `${String(API_BASE).replace(/\/$/, "")}/shipments/public`;
    await probe(`POST ${createURL} (probe only)`, async () => {
      const r = await fetch(createURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ __diagnostic: true }),
      });
      const txt = await r.text();
      return `HTTP ${r.status} · body: ${txt.slice(0, 200)}`;
    });

    // 4) DNS-level sanity: fetch a known-up public endpoint to show the
    //    user's own network is fine (rules out ISP issues).
    await probe(`GET https://www.google.com/generate_204`, async () => {
      await fetch("https://www.google.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
      });
      return "reachable (no-cors)";
    });

    log("—");
    if (healthOk) {
      log("Health passed. If POST fails above, backend is up but shipments endpoint is broken or Mongo is unreachable from Render.", "text-amber-700");
    } else {
      log("Health FAILED. The Render service is unreachable. Check: 1) Render dashboard — is the service Live? 2) Did the last deploy succeed? 3) Is the URL correct?", "text-rose-700");
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
          <h1 className="text-2xl font-bold">Backend Diagnostic</h1>
          <div className="flex gap-2">
            <button
              onClick={runAll}
              disabled={running}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm disabled:opacity-50"
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
              <b className="text-rose-400">Health fails with `Failed to fetch` / timeout</b> →
              the backend itself is unreachable. Not a code problem. Go to the Render dashboard
              and check the service status + logs. Common causes: service suspended, last deploy failed,
              wrong URL.
            </p>
            <p>
              <b className="text-amber-400">Health passes but POST fails with 500 / 502 / timeout</b> →
              the backend is up but the endpoint is crashing. Usually means MongoDB Atlas is
              blocking Render — fix by allowing `0.0.0.0/0` in Atlas Network Access.
            </p>
            <p>
              <b className="text-emerald-400">Health passes, POST returns 4xx</b> → everything's
              wired correctly; the 4xx is just our probe sending an invalid body on purpose.
            </p>
            <p>
              <b className="text-amber-400">Google probe fails too</b> → your own
              internet/network is blocking something. Try a different network or disable VPN/blockers.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
