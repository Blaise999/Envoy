import PageShell from "../../components/PageShell";

export default function CookiesPage() {
  const rows = [
    { n: "envoy_session", p: "Essential", d: "Keeps you logged in", life: "Session" },
    { n: "envoy_csrf",    p: "Essential", d: "Prevents cross-site request forgery", life: "Session" },
    { n: "envoy_pref",    p: "Functional", d: "Remembers language and UI preferences", life: "12 months" },
    { n: "_ga, _ga_*",    p: "Analytics", d: "Google Analytics — usage measurement", life: "24 months" },
    { n: "_fbp",          p: "Marketing", d: "Ad retargeting on Meta", life: "3 months" },
  ];
  return (
    <PageShell title="Cookie Policy" subtitle="How we use cookies and similar technologies.">
      <p className="text-slate-700 mb-6">We use cookies to keep you signed in, remember your preferences, measure how visitors use our site, and (with your consent) show relevant advertising. You can change your preferences any time from the cookie banner at the bottom of the page.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="p-4">Cookie</th>
              <th className="p-4">Purpose</th>
              <th className="p-4">Description</th>
              <th className="p-4">Lifetime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.n}>
                <td className="p-4 font-mono text-xs">{r.n}</td>
                <td className="p-4"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">{r.p}</span></td>
                <td className="p-4 text-slate-600">{r.d}</td>
                <td className="p-4 text-slate-500">{r.life}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
