import PageShell from "../../components/PageShell";
import { Link } from "react-router-dom";

export default function DevelopersPage() {
  return (
    <PageShell
      title="Build with Envoy"
      subtitle="REST APIs and webhooks to create shipments, fetch rates, and stream tracking events straight into your product."
    >
      {/* Hero code snippet */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 text-slate-100 mb-12">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
          <span className="text-xs font-mono text-slate-400">POST /v1/shipments</span>
          <span className="text-xs font-mono text-emerald-400">201 Created</span>
        </div>
        <pre className="p-5 text-xs sm:text-sm overflow-x-auto">
{`curl -X POST https://api.shipenvoy.com/v1/shipments \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin":  { "country": "GB", "city": "London" },
    "dest":    { "country": "GB", "city": "London" },
    "parcel":  { "weight_kg": 2.4, "value_usd": 120 },
    "service": "express"
  }'`}
        </pre>
      </div>

      {/* Feature grid */}
      <div className="grid sm:grid-cols-2 gap-5 mb-12">
        {[
          { h: "REST API", d: "JSON over HTTPS, versioned endpoints, clear error codes." },
          { h: "Webhooks", d: "Get notified on scan events, delivery, and exceptions in real time." },
          { h: "OAuth & API Keys", d: "Scoped keys for servers and OAuth for marketplace integrations." },
          { h: "SDKs", d: "Official libraries for Node.js, Python, Ruby, and PHP." },
          { h: "Sandbox", d: "Test credentials with fully simulated scans and edge cases." },
          { h: "Rate Limits", d: "1000 requests/min on production, with burst allowance." },
        ].map((f) => (
          <div key={f.h} className="p-6 rounded-2xl border border-slate-200 bg-white">
            <h3 className="font-bold text-lg">{f.h}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/docs" className="px-5 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition">Read the docs</Link>
        <Link to="/status" className="px-5 py-3 rounded-xl bg-white border border-slate-200 font-semibold hover:bg-slate-50 transition">API status</Link>
        <a href="https://github.com" className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition">GitHub →</a>
      </div>
    </PageShell>
  );
}
