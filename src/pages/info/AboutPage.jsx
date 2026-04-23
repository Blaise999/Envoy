import PageShell from "../../components/PageShell";
import { IMG, onImgErr } from "../../utils/images";
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <PageShell title="We move parcels. That's the whole thing." subtitle="Envoy is a logistics company. We're not a marketplace, a platform, or a synergy enabler. We pick up parcels, we move them, we deliver them. On time, usually, and transparently, always.">
      <section className="mb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">How this started</h2>
            <div className="mt-6 space-y-4 text-slate-700 leading-relaxed">
              <p>In 2021, our founders were running operations at a cross-border marketplace. They worked with eleven different couriers, each with their own portal, their own exception codes, their own idea of what "in transit" meant.</p>
              <p>The customer service team spent half their week answering one question — "where is my package?" — because nobody could answer it in under twenty clicks. When packages went missing, it took days to even find out which carrier had lost them.</p>
              <p>So they built the dashboard they wished existed. Then they realised the reason it didn't exist was because most couriers didn't actually want their customers to have it.</p>
              <p>Envoy is the other kind of courier. The kind that sends you a scan when something arrives and an apology when something's late. The kind whose tracking page you'd actually want to show a customer.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-xl"><img src={IMG.warehouse} onError={onImgErr} alt="" className="w-full h-full object-cover" /></div>
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-xl mt-8"><img src={IMG.cargoShip} onError={onImgErr} alt="" className="w-full h-full object-cover" /></div>
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-xl -mt-8"><img src={IMG.airplane} onError={onImgErr} alt="" className="w-full h-full object-cover" /></div>
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-xl"><img src={IMG.boxes} onError={onImgErr} alt="" className="w-full h-full object-cover" /></div>
          </div>
        </div>
      </section>

      <section className="mb-20 p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <div className="text-sm font-bold uppercase tracking-widest text-blue-100">What we believe</div>
        <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight leading-tight">The last mile isn't the delivery — it's the impression.</h2>
        <p className="mt-6 text-lg sm:text-xl text-blue-50 leading-relaxed max-w-3xl">
          When your customer gets a parcel from you, they don't separate out "the delivery part" from "the product part". The whole thing is you. A chipped box, a confused courier, a three-day-stale tracking page — those are your brand now. We've built our company around that reality.
        </p>
      </section>

      <section className="mb-20">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">The numbers</h2>
        <p className="mt-3 text-lg text-slate-600">Not curated. Pulled from our operations dashboard, updated monthly.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: "350", l: "Full-time team", sub: "Across 12 countries" },
            { n: "4,800+", l: "Partner drivers", sub: "Vetted and badged" },
            { n: "34", l: "Airport hubs", sub: "Inside secure cargo areas" },
            { n: "99.9%", l: "On-time rate", sub: "Trailing 90-day average" },
            { n: "11 min", l: "Avg customs clearance", sub: "Pre-cleared lanes" },
            { n: "0.4%", l: "Exception rate", sub: "Lost, damaged, or misrouted" },
            { n: "$45M", l: "Series B, 2026", sub: "Led by Atlantica Ventures" },
            { n: "$0", l: "Hidden fees", sub: "Ever" },
          ].map((s) => (
            <div key={s.l} className="p-6 rounded-2xl border border-slate-200 bg-white">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-blue-600 to-blue-400 bg-clip-text text-transparent">{s.n}</div>
              <div className="mt-2 font-bold text-slate-900">{s.l}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Leadership</h2>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl">The people in the room when hard calls get made.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { name: "Elena Vasquez", role: "Co-founder & CEO", bg: "Previously COO at a cross-border marketplace. Forbes 30 Under 30, 2024." },
            { name: "Marcus Weld", role: "Co-founder & CTO", bg: "Built the routing engine at a major carrier for six years. MIT '14." },
            { name: "Priya Sharma", role: "COO", bg: "Ran ground ops at a global freight-forwarder across 40 countries." },
            { name: "Tomás Rivera", role: "CFO", bg: "Goldman Sachs, then CFO at two logistics scale-ups. Chartered Accountant." },
          ].map((p) => (
            <div key={p.name} className="p-6 rounded-2xl border border-slate-200 bg-white">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 grid place-items-center text-white font-black text-xl">
                {p.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="mt-4 font-bold">{p.name}</div>
              <div className="text-sm text-blue-600 font-semibold">{p.role}</div>
              <p className="mt-2 text-sm text-slate-600">{p.bg}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Where we are</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { city: "London", role: "Headquarters", addr: "21 Wharf Road, N1 7GS" },
            { city: "Rotterdam", role: "Main EU hub", addr: "Haven 4212, 3199 LA" },
            { city: "Dubai", role: "MENA hub", addr: "Dubai South Logistics District" },
            { city: "Singapore", role: "APAC hub", addr: "7 Changi North Rise" },
            { city: "New York", role: "Americas office", addr: "260 West Broadway, NYC 10013" },
            { city: "Tokyo", role: "Japan office", addr: "Roppongi Hills Mori Tower" },
          ].map((o) => (
            <div key={o.city} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="font-black text-lg">{o.city}</div>
              <div className="text-sm text-blue-600 font-semibold">{o.role}</div>
              <div className="mt-2 text-sm text-slate-600">{o.addr}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="p-10 rounded-3xl bg-slate-900 text-white text-center">
        <h3 className="text-2xl sm:text-3xl font-black">Think we'd be a good fit?</h3>
        <p className="mt-3 text-slate-300 max-w-xl mx-auto">Whether you're looking to ship with us, partner with us, or join us — start here.</p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link to="/auth/register" className="px-6 py-3 rounded-full bg-blue-500 font-semibold hover:bg-blue-400 transition">Ship with us</Link>
          <Link to="/careers" className="px-6 py-3 rounded-full bg-white/10 border border-white/20 font-semibold hover:bg-white/15 transition">See open roles</Link>
          <Link to="/contact" className="px-6 py-3 rounded-full bg-white/10 border border-white/20 font-semibold hover:bg-white/15 transition">Partner with us</Link>
        </div>
      </div>
    </PageShell>
  );
}
