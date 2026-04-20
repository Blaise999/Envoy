import PageShell from "../../components/PageShell";
import { Link } from "react-router-dom";

export default function CareersPage() {
  const roles = [
    { title: "Senior Logistics Operations Manager", loc: "London, UK", type: "Full-time", dept: "Operations" },
    { title: "Software Engineer — Tracking Platform", loc: "Remote (EMEA)", type: "Full-time", dept: "Engineering" },
    { title: "Staff Engineer — Routing Systems", loc: "Remote / London", type: "Full-time", dept: "Engineering" },
    { title: "Customer Experience Lead", loc: "London, UK", type: "Full-time", dept: "Support" },
    { title: "Warehouse Associate", loc: "Rotterdam, NL", type: "Full-time", dept: "Operations" },
    { title: "Data Analyst — Network Optimization", loc: "Remote", type: "Full-time", dept: "Data" },
    { title: "Customs Broker", loc: "Rotterdam, NL", type: "Full-time", dept: "Operations" },
    { title: "Courier / Delivery Rider", loc: "Multiple cities", type: "Part-time", dept: "Operations" },
    { title: "Senior Product Designer", loc: "Remote (EMEA)", type: "Full-time", dept: "Design" },
    { title: "Head of Marketing", loc: "London, UK", type: "Full-time", dept: "Marketing" },
  ];
  const values = [
    { h: "Parcels first.", d: "Every decision gets measured against one question: does it get a parcel to a customer faster, or more reliably, or cheaper? If not, we're not shipping it." },
    { h: "Write the letter to the customer.", d: "When something goes wrong, the first thing we do is draft the note we'd want to get from a courier. Then we build the process around being able to actually send it." },
    { h: "Boring is a feature.", d: "We love elegant systems. We love boring, predictable, on-time even more. Your parcel arriving is not supposed to be surprising." },
    { h: "Show your working.", d: "We publish our on-time stats, incident post-mortems, and salary bands. If we can't defend it in the open, we probably shouldn't be doing it." },
  ];
  return (
    <PageShell title="Join the team moving the world." subtitle="We're hiring across engineering, operations, support, and design. If you love solving hard logistics problems at scale, you'll fit in fine.">
      <div className="grid sm:grid-cols-4 gap-4 mb-16">
        {[["350+","Team members"],["12","Countries"],["4.7/5","Glassdoor rating"],["83%","Retention after 2 yrs"]].map(([n,l]) => (
          <div key={l} className="rounded-2xl border border-slate-200 p-6 bg-white">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">{n}</div>
            <div className="text-sm text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>
      <section className="mb-20">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">How we work</h2>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl">Four things we say out loud, and try to live by. You should agree with most of them before we talk.</p>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {values.map((v) => (
            <div key={v.h} className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-100">
              <h3 className="text-xl font-bold">{v.h}</h3>
              <p className="mt-3 text-slate-600 leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-20">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">What's on offer</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ["Competitive salary", "Published bands for every role. You'll know what the job pays before you apply."],
            ["Stock options", "Every full-time hire gets equity, not just senior folks."],
            ["Private health", "Vitality or equivalent in your country. Dental and optical included."],
            ["Remote-first", "Most roles are fully remote within EMEA. We have offices if you want them."],
            ["Paid time off", "30 days plus local public holidays. Actually take them."],
            ["Learning budget", "£1,500/year for books, courses, conferences. Use it or lose it."],
            ["Parental leave", "6 months fully paid for primary carers, 12 weeks for secondary."],
            ["Kit you pick", "MacBook or ThinkPad, whatever works. Desk, chair, monitor — your call."],
            ["Ship free stuff", "Every teammate gets a shipping allowance for personal parcels, worldwide."],
          ].map(([h, d]) => (
            <div key={h} className="p-5 rounded-xl border border-slate-200 bg-white">
              <div className="font-bold text-slate-900">{h}</div>
              <div className="mt-1 text-sm text-slate-600">{d}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-16">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-8">Open positions</h2>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {roles.map((r) => (
            <div key={r.title} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3 hover:bg-slate-50 transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold tracking-widest uppercase">{r.dept}</span>
                  <div className="font-semibold text-slate-900">{r.title}</div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{r.loc} · {r.type}</div>
              </div>
              <Link to="/contact" className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition shrink-0">Apply →</Link>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-16">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">What to expect from the process</h2>
        <ol className="mt-8 space-y-5">
          {[
            ["Intro call (30 min)","Someone from the hiring team. We talk about what you've built, what you want next, and whether Envoy is vaguely plausible."],
            ["Craft interview (60–90 min)","Role-specific. Engineers get a pair-programming session with real code; ops candidates walk us through a sorting-centre bottleneck."],
            ["Team loop (2–3 hours, split)","Three to four conversations with people you'd actually work with. Half of it is you interviewing us."],
            ["Offer","We make decisions within 48 hours of your last conversation. We don't ghost."],
          ].map(([h,d],i) => (
            <li key={h} className="flex gap-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white grid place-items-center font-black">{i + 1}</div>
              <div><div className="font-bold">{h}</div><div className="mt-1 text-slate-600">{d}</div></div>
            </li>
          ))}
        </ol>
      </section>
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
        <h3 className="text-2xl sm:text-3xl font-black">Don't see your role?</h3>
        <p className="mt-3 text-emerald-50 max-w-xl">We're always on the lookout for exceptional people — especially folks with backgrounds we haven't thought to hire for yet.</p>
        <a href="mailto:careers@shipenvoy.com" className="mt-6 inline-block px-6 py-3 rounded-full bg-white text-emerald-700 font-semibold hover:bg-emerald-50 transition">careers@shipenvoy.com</a>
      </div>
    </PageShell>
  );
}
