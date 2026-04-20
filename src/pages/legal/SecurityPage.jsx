import PageShell from "../../components/PageShell";

export default function SecurityPage() {
  const pillars = [
    { h: "Encryption in transit", d: "Every request to Envoy is TLS 1.3 with HSTS preload. Internal service-to-service calls use mTLS with short-lived certificates rotated daily.", icon: "lock" },
    { h: "Encryption at rest", d: "Databases, backups, and object storage are AES-256 encrypted. Keys are managed by AWS KMS and rotated quarterly, with customer-specific keys available on enterprise plans.", icon: "shield" },
    { h: "Access control", d: "Least-privilege IAM, mandatory MFA for all employees, and hardware security keys (YubiKey) for any production access. SSO available on Team and Enterprise plans.", icon: "key" },
    { h: "Penetration testing", d: "Independent penetration tests twice per year by two different firms, plus continuous automated vulnerability scanning across all services.", icon: "bug" },
    { h: "Compliance", d: "SOC 2 Type II (finalising). PCI-DSS handled via our payment partners — we never store card numbers. GDPR and UK GDPR compliant by default.", icon: "badge" },
    { h: "Incident response", d: "24/7 on-call. Customers notified of incidents affecting their data within 72 hours, usually much sooner. Public post-mortems for every major incident.", icon: "alert" },
  ];
  return (
    <PageShell title="Security at Envoy" subtitle="How we protect your shipments, your account, and everything in between.">
      <div className="mb-14 p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 grid place-items-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black">We take this seriously.</h2>
            <p className="mt-3 text-slate-300 leading-relaxed">
              Logistics data is sensitive. Home addresses, package contents, delivery patterns — it adds up to a detailed map of someone's life. We treat your data like we'd want a courier to treat ours: locked down, need-to-know, and never sold.
            </p>
          </div>
        </div>
      </div>
      <section className="mb-16">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-8">The basics, done right</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {pillars.map((it) => (
            <div key={it.h} className="p-6 sm:p-7 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition">
              <h3 className="font-bold text-lg">{it.h}</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">{it.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-16">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">How we think about it</h2>
        <div className="mt-8 space-y-6 text-slate-700 leading-relaxed max-w-3xl">
          <p>Security at Envoy is a product team problem, not a checklist someone signs off on once a year. The same engineers who build the shipping features own their security posture, with a central platform team providing the paved road — vetted libraries, managed secrets, automated checks in CI.</p>
          <p>We follow a zero-trust model: every service authenticates every request, network location alone never grants access, and session tokens are short-lived. Production changes require code review plus automated tests plus a second human to approve any migration touching customer data.</p>
          <p>We run red-team exercises twice a year where a small internal team tries to break things. The findings are shared with the whole engineering org — the goal is for everyone to see how failures happen, not to embarrass the team that owned the broken thing.</p>
        </div>
      </section>
      <section className="mb-16">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-8">What you can do</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            ["Turn on MFA", "Settings → Security → Two-factor authentication. Use an authenticator app, not SMS. Takes 90 seconds."],
            ["Use a password manager", "We don't care which one — 1Password, Bitwarden, iCloud Keychain are all fine. Don't reuse passwords."],
            ["Review your sessions", "Settings → Security → Active sessions. If you see a session you don't recognise, revoke it and change your password."],
            ["Invite teammates properly", "Use the Team Members page, not a shared login. Everyone gets their own account with role-based permissions."],
          ].map(([h, d]) => (
            <div key={h} className="p-5 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="font-bold text-emerald-900">{h}</div>
              <div className="mt-1 text-sm text-emerald-800">{d}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white">
        <h3 className="text-2xl font-black">Found a security issue?</h3>
        <p className="mt-3 text-slate-300">Please tell us. We pay bounties for real vulnerabilities, and we don't sue researchers who act in good faith.</p>
        <div className="mt-5 space-y-2 text-sm">
          <div><span className="text-slate-400">Email:</span> <a href="mailto:security@shipenvoy.com" className="text-emerald-400 font-semibold">security@shipenvoy.com</a></div>
          <div><span className="text-slate-400">PGP key:</span> <a href="#" className="text-emerald-400 font-semibold">Fingerprint 4A2B 8F3C 1D9E 7F6A · keys.openpgp.org</a></div>
          <div><span className="text-slate-400">Scope:</span> anything under shipenvoy.com, api.shipenvoy.com, and our iOS/Android apps.</div>
        </div>
      </div>
    </PageShell>
  );
}
