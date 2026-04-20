// src/pages/services/ServicesOverviewPage.jsx
// Editorial-style services index — big type, asymmetric grid, very different
// feel from any boilerplate services page.
import { Link } from "react-router-dom";
import Logo from "../../assets/envoy.png";
import { IMG, onImgErr } from "../../utils/images";

const SERVICES = [
  {
    tag: "01",
    slug: "express",
    title: "Express Parcel",
    kicker: "Door-to-door, cross-border",
    body: "24 to 72 hours, more than 220 lanes, duties pre-calculated at the point of label creation. Your buyer sees the total before checkout, and again at delivery — never between.",
    stats: [["24–72h", "Transit"], ["220+", "Lanes"], ["$0", "Hidden fees"]],
    cta: "Book an express parcel",
    feat: true,
    img: IMG.airplane,
  },
  {
    tag: "02",
    slug: "freight",
    title: "Freight & Cargo",
    kicker: "Pallets, containers, ocean and air",
    body: "For shipments above 70 kg. Air freight for urgent cargo, sea freight for routine volume, and full-truck-load road options across Europe and North America.",
    stats: [["70kg+", "Min weight"], ["LCL/FCL", "Ocean"], ["24/7", "Tracking"]],
    cta: "Request a freight quote",
    img: IMG.cargoShip,
  },
  {
    tag: "03",
    slug: "ecommerce",
    title: "E-commerce",
    kicker: "Platform-native",
    body: "One-click install for Shopify, WooCommerce, BigCommerce. Labels print on paid orders, returns come with QR codes, and customers get a tracking page that matches your brand.",
    stats: [["1-click", "Install"], ["QR", "Returns"], ["Your", "Brand"]],
    cta: "Connect your store",
    img: IMG.merchant,
  },
  {
    tag: "04",
    slug: "customs",
    title: "Customs & Clearance",
    kicker: "Pre-clear, don't wait",
    body: "Licensed brokers on both sides of every border we ship across. Duties paid delivered (DDP) as standard — so the border isn't the line your parcels die at.",
    stats: [["Licensed", "Brokers"], ["DDP", "Standard"], ["Pre-clear", "On file"]],
    cta: "Learn about customs",
    img: IMG.boxes,
  },
  {
    tag: "05",
    slug: "domestic",
    title: "Domestic",
    kicker: "Same-day and next-day",
    body: "Same-day delivery across seven European metros, next-day across our full domestic network. No fuel surcharges hiding behind the base rate — what we quote is what you pay.",
    stats: [["7", "Same-day cities"], ["Next-day", "Nationwide"], ["No", "Surcharges"]],
    cta: "Ship domestic",
    img: IMG.truck,
  },
  {
    tag: "06",
    slug: "warehousing",
    title: "Warehousing",
    kicker: "Fulfillment, bonded storage, returns",
    body: "Hold inventory in our bonded facilities across London, Rotterdam, Dubai, and Singapore. Pick, pack, and ship on the same network — with full visibility into every SKU.",
    stats: [["4", "Hubs"], ["Bonded", "Facilities"], ["SKU", "Visibility"]],
    cta: "Tour a warehouse",
    img: IMG.warehouse,
  },
];

export default function ServicesOverviewPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><img src={Logo} alt="Envoy" className="h-12 w-auto" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900">Home</Link>
            <Link to="/track" className="hover:text-slate-900">Track</Link>
            <Link to="/services" className="text-emerald-600 font-semibold">Services</Link>
            <Link to="/about" className="hover:text-slate-900">About</Link>
            <Link to="/contact" className="hover:text-slate-900">Contact</Link>
          </nav>
          <Link to="/auth/register" className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition">
            Open an account
          </Link>
        </div>
      </header>

      {/* Hero — editorial magazine cover vibe */}
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-emerald-100/60 via-emerald-50/40 to-transparent -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="text-xs font-semibold tracking-[0.3em] text-emerald-600 uppercase">Issue 06 · Services</div>
            <h1 className="mt-5 text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95]">
              What<br />
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">we actually</span><br />
              do.
            </h1>
          </div>
          <div className="lg:col-span-5">
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed">
              Six services. One account. Every one of them designed so your parcels arrive when you said they would, and your customers stop calling you to ask where their stuff is.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-500">
              {["Express", "Freight", "E-commerce", "Customs", "Domestic", "Warehousing"].map((t) => (
                <span key={t} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service cards — asymmetric magazine grid */}
      <section className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
          {SERVICES.map((s, idx) => (
            <ServiceRow key={s.slug} s={s} reversed={idx % 2 === 1} />
          ))}
        </div>
      </section>

      {/* Stat banner */}
      <section className="bg-slate-950 text-white py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-px bg-white/10 rounded-3xl overflow-hidden">
            {[
              { n: "4,800+", l: "Drivers in our network" },
              { n: "12", l: "Countries with same-day" },
              { n: "98.7%", l: "Parcels with no exceptions" },
              { n: "11 min", l: "Avg customs clearance" },
            ].map((s) => (
              <div key={s.l} className="bg-slate-950 p-8 text-center">
                <div className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-transparent">{s.n}</div>
                <div className="mt-2 text-sm text-slate-400">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ-ish comparison */}
      <section className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Not sure which service fits?</h2>
          <p className="mt-4 text-lg text-slate-600">A rough decision tree — pick the row that sounds most like your situation.</p>

          <div className="mt-10 rounded-2xl overflow-hidden border border-slate-200 bg-white divide-y divide-slate-200">
            {[
              { q: "I run an online store and ship a few hundred orders a week", a: "E-commerce + Express", to: "/services/ecommerce" },
              { q: "I need something heavy — pallets, machinery, containers", a: "Freight & Cargo", to: "/services/freight" },
              { q: "I'm sending a single parcel to a customer abroad", a: "Express Parcel", to: "/services/express" },
              { q: "My goods are stuck at the border more often than I'd like", a: "Customs & Clearance", to: "/services/customs" },
              { q: "I need delivery inside the country, today or tomorrow", a: "Domestic", to: "/services/domestic" },
              { q: "I want someone else to hold my stock and ship it out", a: "Warehousing & Fulfillment", to: "/services/warehousing" },
            ].map((r) => (
              <Link to={r.to} key={r.q} className="flex items-center justify-between p-6 hover:bg-emerald-50/50 transition group">
                <div className="flex-1 pr-4">
                  <div className="font-semibold text-slate-900">"{r.q}"</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-emerald-600 font-bold group-hover:underline">{r.a}</div>
                </div>
                <svg className="w-5 h-5 text-slate-400 ml-4 group-hover:text-emerald-600 group-hover:translate-x-1 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Still can't decide? Just call us.</h2>
          <p className="mt-4 text-lg text-slate-600">Our operations team picks up within 40 seconds, and they're mostly ex-couriers. They'll tell you which service fits in about two minutes.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/contact" className="px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20">Talk to operations</Link>
            <Link to="/track" className="px-6 py-3 rounded-full bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition">Track a parcel instead</Link>
          </div>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="border-t border-slate-200 py-10 text-sm text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Envoy Logistics Ltd.</div>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-900">Terms</Link>
            <Link to="/security" className="hover:text-slate-900">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ServiceRow({ s, reversed }) {
  return (
    <article className={`grid lg:grid-cols-12 gap-8 lg:gap-12 items-center`}>
      <div className={`lg:col-span-7 ${reversed ? "lg:order-2" : ""}`}>
        <div className="relative rounded-3xl overflow-hidden aspect-[16/10] group shadow-xl">
          <img src={s.img} onError={onImgErr} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" loading="lazy" />
          <div className="absolute top-5 left-5 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-black tracking-widest">
            {s.tag}
          </div>
          {s.feat && (
            <div className="absolute top-5 right-5 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              Most booked
            </div>
          )}
        </div>
      </div>
      <div className={`lg:col-span-5 ${reversed ? "lg:order-1" : ""}`}>
        <div className="text-xs font-semibold tracking-widest text-emerald-600 uppercase">{s.kicker}</div>
        <h2 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight">{s.title}</h2>
        <p className="mt-4 text-lg text-slate-600">{s.body}</p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
          {s.stats.map(([n, l]) => (
            <div key={l} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-black text-slate-900">{n}</div>
              <div className="text-xs text-slate-500 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        <Link to={`/services/${s.slug}`} className="mt-6 inline-flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-700 group">
          {s.cta}
          <span className="group-hover:translate-x-1 transition">→</span>
        </Link>
      </div>
    </article>
  );
}
