import PageShell from "../../components/PageShell";

export default function StatusPage() {
  const systems = [
    { n: "Tracking", s: "Operational", d: "Live scan events, webhooks, public tracking pages." },
    { n: "Label Printing", s: "Operational", d: "Label PDF generation across all carriers and services." },
    { n: "Payments", s: "Operational", d: "Card, bank transfer, and invoicing." },
    { n: "Dashboard", s: "Operational", d: "The customer-facing web dashboard." },
    { n: "Notifications", s: "Operational", d: "Email, SMS, and webhook delivery notifications." },
    { n: "Customs Platform", s: "Operational", d: "Duty calculation and broker submissions." },
    { n: "Pickup Booking", s: "Operational", d: "Scheduling couriers for collection." },
    { n: "Rates Engine", s: "Operational", d: "Real-time shipping quotes across all lanes." },
  ];
  const incidents = [
    { date: "Oct 17, 2025", title: "Dashboard and scan ingestion outage", duration: "94 minutes", resolved: true, severity: "Major" },
    { date: "Aug 02, 2025", title: "Elevated latency on tracking webhooks", duration: "38 minutes", resolved: true, severity: "Minor" },
    { date: "Jun 14, 2025", title: "Label generation delays in EU region", duration: "22 minutes", resolved: true, severity: "Minor" },
  ];
  return (
    <PageShell title="System Status" subtitle="Live operational status of every Envoy service. Updated every 30 seconds.">
      <div className="mb-10 p-6 rounded-3xl border-2 border-emerald-200 bg-emerald-50 flex items-center gap-4">
        <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
        <div>
          <div className="font-bold text-emerald-900 text-lg">All systems operational</div>
          <div className="text-sm text-emerald-800">Last checked: just now</div>
        </div>
      </div>
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Services</h2>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {systems.map((x) => (
            <div key={x.n} className="flex items-center justify-between p-5">
              <div>
                <div className="font-semibold">{x.n}</div>
                <div className="text-sm text-slate-500">{x.d}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">{x.s}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-12">
        <h2 className="text-2xl font-bold">Uptime (last 90 days)</h2>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-[repeat(90,1fr)] gap-0.5">
            {Array.from({length: 90}).map((_, i) => (
              <div key={i} className="h-8 bg-emerald-500 rounded-sm" style={{opacity: i === 27 ? 0.35 : 0.85}} title={i === 27 ? "Oct 17 — partial outage" : "Operational"} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-600">99.98% uptime</span>
            <span className="text-slate-500">90 days ago → today</span>
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-bold mb-4">Past incidents</h2>
        <div className="space-y-3">
          {incidents.map((i) => (
            <div key={i.title} className="p-5 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${i.severity === "Major" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{i.severity}</span>
                    <span className="text-sm text-slate-500">{i.date}</span>
                  </div>
                  <div className="mt-2 font-semibold">{i.title}</div>
                  <div className="text-sm text-slate-600">Duration: {i.duration}</div>
                </div>
                <span className="text-sm font-semibold text-emerald-700 shrink-0">Resolved</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-10 text-center text-sm text-slate-500">
        Subscribe to status updates at <a href="#" className="text-emerald-600 font-semibold">status.shipenvoy.com</a>
      </div>
    </PageShell>
  );
}
