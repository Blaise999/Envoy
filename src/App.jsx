// src/App.jsx — Envoy homepage
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./assets/envoy.png";
import { IMG, onImgErr } from "./utils/images";
import { ChatWidget } from "./components/support/ChatWidget";

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  useEffect(() => setMounted(true), []);

  const nav = [
    { label: "Track", to: "/track" },
    { label: "Services", to: "/services" },
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center"><img src={Logo} alt="Envoy" className="h-12 w-auto" /></Link>
          <nav className="hidden md:flex items-center gap-7">
            {nav.map((n) => (
              <Link key={n.label} to={n.to} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">Sign in</Link>
            <Link to="/services/express" className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 shadow-sm transition">
              Get a Quote
            </Link>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {nav.map((n) => (
              <Link key={n.label} to={n.to} onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg hover:bg-slate-50 font-medium">
                {n.label}
              </Link>
            ))}
            <div className="pt-2 flex gap-2">
              <Link to="/auth/login" className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-100 font-medium">Sign in</Link>
              <Link to="/services/express" className="flex-1 text-center px-3 py-2 rounded-lg bg-blue-500 text-white font-semibold">Get a Quote</Link>
            </div>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-60"><WorldMapBg /></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_60%)]" />
        <FloatingBoxes />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 text-center">
          <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/30 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Now delivering in 220+ countries
            </span>

            <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.02] tracking-tight">
              Parcels that{" "}
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-sky-300 bg-clip-text text-transparent">
                show up.
              </span>
              <br />
              When you said they would.
            </h1>

            <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Envoy handles the whole messy middle between your warehouse and your customer's door. You send it, we move it, nobody calls you about where it is.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); if (trackingId.trim()) navigate(`/track?ref=${trackingId.trim()}`); }}
              className="mt-10 mx-auto max-w-xl flex items-stretch rounded-full bg-white/10 backdrop-blur border border-white/20 shadow-2xl p-1.5"
            >
              <div className="flex items-center px-4 text-slate-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                </svg>
              </div>
              <input
                type="text"
                className="flex-1 outline-none bg-transparent text-white px-1 text-sm sm:text-base py-3 placeholder:text-slate-400"
                placeholder="Paste a tracking number"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />
              <button type="submit" className="px-5 sm:px-7 py-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-semibold hover:from-blue-400 hover:to-blue-300 transition shadow-lg shadow-blue-500/30">
                Track →
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              <Link to="/services/express" className="text-blue-300 hover:text-blue-200 font-semibold">Ship a package →</Link>
              <Link to="/services/express?type=parcel#quote" className="text-blue-300 hover:text-blue-200 font-semibold">See rates →</Link>
              <Link to="/contact" className="text-blue-300 hover:text-blue-200 font-semibold">Talk to sales →</Link>
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur overflow-hidden">
          <div className="flex gap-12 py-3 animate-[scroll_40s_linear_infinite] whitespace-nowrap text-xs sm:text-sm text-slate-300">
            {[...Array(2)].map((_, k) => (
              <div key={k} className="flex gap-12 shrink-0">
                <span><b className="text-blue-400">● Delivered</b> · Paris → London · 6h 23m</span>
                <span><b className="text-blue-400">● In transit</b> · Singapore → Sydney · 142 parcels</span>
                <span><b className="text-blue-400">● Out for delivery</b> · New York, USA</span>
                <span><b className="text-blue-400">● Customs cleared</b> · Rotterdam port</span>
                <span><b className="text-blue-400">● Picked up</b> · Tokyo fulfillment</span>
                <span><b className="text-blue-400">● Delivered</b> · Dubai → Mumbai · 14h 02m</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }
          @keyframes floatBox { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)) } 50% { transform: translateY(-12px) rotate(var(--r,0deg)) } }
        `}</style>
      </section>

      {/* ============ METRIC STRIP ============ */}
      <section className="relative -mt-10 z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-3xl overflow-hidden bg-slate-200 shadow-2xl">
          {[
            { n: "10M+", l: "Parcels a year" },
            { n: "99.9%", l: "On-time rate" },
            { n: "220+", l: "Countries" },
            { n: "24/7", l: "Operations" },
          ].map((s) => (
            <div key={s.l} className="bg-white p-6 sm:p-8 text-center">
              <div className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-blue-600 to-blue-400 bg-clip-text text-transparent">{s.n}</div>
              <div className="mt-1 text-xs sm:text-sm text-slate-500 uppercase tracking-wider font-semibold">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ LOGO BAR ============ */}
      <section className="py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest">
            Moving parcels for teams at
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 sm:gap-10 items-center">
            {[
              "MERIDIAN", "Brightline", "KAJI", "Northwind", "Atlas&Co", "Helio"
            ].map((brand) => (
              <div key={brand} className="text-center text-slate-400 font-black text-xl tracking-tight opacity-60 hover:opacity-100 hover:text-slate-700 transition">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROMISE ============ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-widest">The promise</div>
            <h2 className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Shipping that doesn't feel like shipping.
            </h2>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Most couriers treat logistics like a cost centre. We treat it like the last impression your brand makes on a customer. That usually means the one that sticks.
            </p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              So our drivers show up with the right paperwork, our tracking page doesn't look like it was built in 2003, and if something goes wrong you'll hear from us before you hear from your customer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/services" className="px-6 py-3 rounded-full bg-slate-900 text-white font-semibold hover:bg-slate-800 transition">
                See all services
              </Link>
              <Link to="/about" className="px-6 py-3 rounded-full bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition">
                Our story
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
              <img src={IMG.warehouse} onError={onImgErr} alt="Inside a fulfillment centre" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="aspect-square rounded-3xl overflow-hidden shadow-xl mt-8">
              <img src={IMG.cargoShip} onError={onImgErr} alt="Cargo ship at port" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="aspect-square rounded-3xl overflow-hidden shadow-xl -mt-8">
              <img src={IMG.airplane} onError={onImgErr} alt="Cargo plane at dawn" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="aspect-square rounded-3xl overflow-hidden shadow-xl">
              <img src={IMG.boxes} onError={onImgErr} alt="Parcels ready for dispatch" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ SPOTLIGHT ROWS ============ */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-widest">What we do</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">Every link in the chain. One bill.</h2>
            <p className="mt-4 text-lg text-slate-600">Six services, built to fit together so you don't spend your week copy-pasting tracking numbers between six different couriers' dashboards.</p>
          </div>

          <div className="mt-16 space-y-24">
            <SpotlightRow
              n="01"
              title="Express parcels, cross-border"
              body="Door to door in 24–72 hours, to more than 220 countries. We calculate duties at checkout, pay them at the border, and deliver without your customer ever seeing a customs bill."
              cta={{ to: "/services/express", text: "Explore Express" }}
              img={IMG.airplane}
              align="left"
            />
            <SpotlightRow
              n="02"
              title="Freight & container cargo"
              body="Air, sea, and road freight for pallets and full containers. Dedicated account managers for bookings over 500kg — with visibility from the pier to your dock."
              cta={{ to: "/services/freight", text: "Explore Freight" }}
              img={IMG.cargoShip}
              align="right"
            />
            <SpotlightRow
              n="03"
              title="Warehousing & fulfillment"
              body="Hold your inventory in our bonded facilities. We pick, pack, and ship on the same network, or plug into the API for custom workflows. Returns come back to the same place."
              cta={{ to: "/services/warehousing", text: "Explore Warehousing" }}
              img={IMG.warehouse}
              align="left"
            />
          </div>
        </div>
      </section>

      {/* ============ PROCESS ============ */}
      <section className="bg-slate-950 text-white py-20 sm:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-blue-400 uppercase tracking-widest">How it works</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">A parcel's journey, drawn simply.</h2>
            <p className="mt-4 text-lg text-slate-400">From the moment you click "book" to the moment your customer signs.</p>
          </div>

          <div className="mt-12 relative">
            <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent hidden md:block" />
            <div className="grid md:grid-cols-4 gap-10 relative">
              {[
                { t: "Book", d: "Get a quote, generate a label, schedule a pickup. Under a minute, no phone call." },
                { t: "Collect", d: "Our courier picks up at your door, or you drop off at any of our 4,000 partner locations." },
                { t: "Move", d: "Air, sea, or road. Sorted through hubs designed for speed, not ceremony." },
                { t: "Deliver", d: "Hand-off with photo confirmation. Signature if you asked for one." },
              ].map((s, i) => (
                <div key={s.t} className="relative">
                  <div className="w-24 h-24 mx-auto md:mx-0 rounded-2xl bg-blue-500/10 ring-1 ring-blue-400/30 grid place-items-center text-2xl font-black text-blue-300 relative z-10 backdrop-blur">
                    0{i + 1}
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-center md:text-left">{s.t}</h3>
                  <p className="mt-2 text-slate-400 text-center md:text-left">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ GLOBAL NETWORK ============ */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-widest">The network</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">One network. Every continent.</h2>
            <p className="mt-4 text-lg text-slate-600">
              Our hubs sit inside 34 major airports, 12 sea ports, and 80+ sorting centres. Stitched together by a routing engine that picks the fastest path on every single scan.
            </p>
            <ul className="mt-8 space-y-4 text-slate-700">
              {[
                ["Customs pre-clearance", "Most shipments clear before they land. The border stops being a bottleneck."],
                ["Flat duty calculation", "Your buyer sees the total at checkout — not at their door, demanding cash."],
                ["Predictive ETAs", "Our model updates arrival estimates on every scan. No more \"out for delivery\" for four straight days."],
              ].map(([h, d]) => (
                <li key={h} className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-blue-500 grid place-items-center mt-0.5">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div><b className="text-slate-900">{h}.</b> {d}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-slate-950 aspect-square sm:aspect-[4/3]">
            <div className="w-full h-full relative">
              <WorldMapBg />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_60%)]" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PERSONA CARDS ============ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-widest">Built for</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">Whoever's doing the shipping.</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              {
                tag: "Merchants",
                title: "Ship from your checkout",
                body: "One-click install for Shopify, WooCommerce, and BigCommerce. Labels print on paid orders. Returns come back with a QR code.",
                cta: "For merchants",
                href: "/services/ecommerce",
                img: IMG.merchant,
              },
              {
                tag: "Enterprise",
                title: "Dedicated capacity",
                body: "Volume pricing, dedicated lanes, priority customs, and a named account manager — for businesses moving 10k+ parcels a month.",
                cta: "For enterprise",
                href: "/contact",
                img: IMG.enterprise,
              },
              {
                tag: "Everyone else",
                title: "Send one thing, once",
                body: "You're sending a birthday present to your sister. You shouldn't need a developer to do that. Sign up, pay, drop off — done.",
                cta: "Ship something",
                href: "/services/express",
                img: IMG.developer,
              },
            ].map((p) => (
              <article key={p.tag} className="group rounded-3xl overflow-hidden border border-slate-200 bg-white hover:shadow-xl transition-all">
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={p.img} onError={onImgErr} alt={p.tag} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                </div>
                <div className="p-6">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest">{p.tag}</div>
                  <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
                  <p className="mt-2 text-slate-600">{p.body}</p>
                  <Link to={p.href} className="mt-4 inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700">
                    {p.cta} <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIAL ============ */}
      <RotatingTestimonial />

      {/* ============ FAQ SNIPPET ============ */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-sm font-semibold text-blue-600 uppercase tracking-widest">Quick answers</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight">Things people ask before signing up.</h2>
          </div>
          <div className="mt-10 space-y-3">
            {[
              {
                q: "How fast does a parcel actually arrive?",
                a: "Express to most major cities in the EU, UK, and US arrives in 24–48 hours. Intercontinental express lands in 48–72. Freight takes 3–14 days depending on mode and route — we'll tell you before you book.",
              },
              {
                q: "What does \"duties included\" mean, and is it really included?",
                a: "We calculate the destination country's duties and taxes at the moment you print the label. You pay once, we pay the customs office on the other side, and your customer gets the parcel without a surprise bill. Yes, really included.",
              },
              {
                q: "What if something goes wrong with my shipment?",
                a: "If a parcel is delayed more than 24 hours past its promised window, we refund the shipping cost. If it's lost or damaged, we pay out the declared value — no novel-length claims forms. A real human from operations emails you first; you don't chase us.",
              },
              {
                q: "Do I have to sign a contract?",
                a: "No. You pay per shipment. If you're moving enough volume that a contract would save you money, we'll reach out — or you can poke us first at sales@shipenvoy.com.",
              },
            ].map((f) => (
              <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 hover:border-blue-300 transition">
                <summary className="list-none cursor-pointer flex items-center justify-between font-semibold text-slate-900">
                  <span>{f.q}</span>
                  <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="mt-4 text-slate-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/faq" className="text-blue-600 font-semibold hover:text-blue-700">See all questions →</Link>
          </div>
        </div>
      </section>

      {/* ============ CTA BANNER ============ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-10 sm:p-16 text-white">
            <div className="absolute inset-0 opacity-40"><WorldMapBg /></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.3),transparent_60%)]" />
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Ready to ship?</h2>
              <p className="mt-4 text-lg text-slate-300">Your first shipment is on us. Make an account in three minutes — no sales call, no long demo, nothing.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth/register" className="px-6 py-3 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400 transition shadow-lg shadow-blue-500/30">Create free account</Link>
                <Link to="/contact" className="px-6 py-3 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white font-semibold hover:bg-white/15 transition">Talk to sales</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-5 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                    <path d="M2 10l20-7-7 20-3-9z" />
                  </svg>
                </div>
                <span className="text-xl font-black text-white">Envoy</span>
              </div>
              <p className="mt-4 text-sm text-slate-400 max-w-xs">
                Shipping you don't have to think about. Book it, forget it, customer gets it.
              </p>
              <div className="mt-6 flex gap-3">
                {["Twitter", "LinkedIn", "Instagram"].map((s) => (
                  <a key={s} href="#" aria-label={s} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition text-xs">
                    {s[0]}
                  </a>
                ))}
              </div>
            </div>

            {[
              ["Product", [["Track", "/track"], ["Services", "/services"], ["Pricing", "/services/express?type=parcel#quote"]]],
              ["Company", [["About", "/about"], ["Careers", "/careers"], ["News", "/news"], ["Contact", "/contact"]]],
              ["More", [["FAQ", "/faq"], ["Status", "/status"], ["Sitemap", "/sitemap"]]],
            ].map(([h, items]) => (
              <div key={h}>
                <div className="text-white font-semibold">{h}</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {items.map(([l, to]) => (
                    <li key={l}><Link to={to} className="hover:text-white transition">{l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-slate-500">
            <div>© {new Date().getFullYear()} Envoy Logistics Ltd. All rights reserved.</div>
            <div className="flex gap-5">
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/security" className="hover:text-white">Security</Link>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}

/* ============ SUB-COMPONENTS ============ */

function SpotlightRow({ n, title, body, cta, img, align = "left" }) {
  const reversed = align === "right";
  return (
    <div className={`grid lg:grid-cols-2 gap-10 items-center ${reversed ? "lg:[&>:first-child]:order-2" : ""}`}>
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl aspect-[4/3]">
        <img src={img} onError={onImgErr} alt={title} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute bottom-4 left-4 text-white font-black text-3xl drop-shadow-2xl">{n}</div>
      </div>
      <div>
        <div className="text-6xl font-black text-blue-500/20 leading-none">{n}</div>
        <h3 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight">{title}</h3>
        <p className="mt-4 text-lg text-slate-600">{body}</p>
        <Link to={cta.to} className="mt-6 inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700">
          {cta.text} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

function RotatingTestimonial() {
  const quotes = [
    { q: "We switched from three different couriers to one contract with Envoy. Our on-time rate went from 87% to 99.2% in the first quarter. That's what sold our CFO.", name: "Elena Vasquez", role: "Head of Operations, Meridian Apparel" },
    { q: "Their tracking experience is what we wanted to build ourselves, but didn't have the team to. Support tickets dropped by half in two months.", name: "James O'Connor", role: "Founder, Brightline Marketplace" },
    { q: "The customs pre-clearance is wizardry. We used to lose two days at the border on every EU shipment. Now it's zero.", name: "Hiroshi Tanaka", role: "Logistics Director, Kaji Imports" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % quotes.length), 6000);
    return () => clearInterval(id);
  }, [quotes.length]);

  const t = quotes[i];
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <svg className="w-12 h-12 mx-auto text-blue-500/30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 7h4v4H9c0 2 1 3 3 3v2c-4 0-6-3-6-6V7zm8 0h4v4h-2c0 2 1 3 3 3v2c-4 0-6-3-6-6V7z" />
        </svg>
        <blockquote className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-snug min-h-[140px] transition-all duration-500" key={i}>
          "{t.q}"
        </blockquote>
        <div className="mt-6">
          <div className="font-bold">{t.name}</div>
          <div className="text-sm text-slate-500">{t.role}</div>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {quotes.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Testimonial ${k + 1}`}
              className={`h-2 rounded-full transition ${i === k ? "bg-blue-500 w-8" : "bg-slate-300 hover:bg-slate-400 w-2"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorldMapBg() {
  const continents = [
    [0.18, 0.42, 0.12, 0.22],
    [0.27, 0.72, 0.06, 0.18],
    [0.47, 0.38, 0.09, 0.14],
    [0.52, 0.66, 0.07, 0.15],
    [0.70, 0.46, 0.17, 0.20],
    [0.84, 0.78, 0.07, 0.10],
  ];
  const dots = useMemo(() => {
    const arr = [];
    const rows = 32, cols = 64;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c / (cols - 1);
        const y = r / (rows - 1);
        const inLand = continents.some(([cx, cy, rx, ry]) => {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          return dx * dx + dy * dy < 1;
        });
        if (inLand && Math.random() > 0.14) arr.push({ x, y, k: `${r}-${c}` });
      }
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      {dots.map(({ x, y, k }) => (
        <circle key={k} cx={x * 1000} cy={y * 500} r={1.5} fill="#60a5fa" opacity="0.55" />
      ))}
      {[
        [220, 230, 475, 220],
        [475, 220, 700, 260],
        [700, 260, 840, 390],
      ].map(([x1, y1, x2, y2], i) => (
        <g key={`ln-${i}`}>
          <path
            d={`M${x1} ${y1} Q ${(x1+x2)/2} ${Math.min(y1,y2)-30} ${x2} ${y2}`}
            stroke="#3b82f6" strokeOpacity="0.55" strokeWidth="1.2" fill="none" strokeDasharray="4 4"
          />
          <circle cx={x1} cy={y1} r="3" fill="#60a5fa">
            <animate attributeName="r" values="3;7;3" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
          <circle cx={x2} cy={y2} r="3" fill="#60a5fa">
            <animate attributeName="r" values="3;7;3" dur="2s" repeatCount="indefinite" begin={`${i * 0.3 + 1}s`} />
          </circle>
        </g>
      ))}
    </svg>
  );
}

function FloatingBoxes() {
  const boxes = [
    { left: "8%", top: "25%", size: 56, delay: 0, rot: -12 },
    { left: "16%", top: "62%", size: 44, delay: 1.2, rot: 8 },
    { left: "82%", top: "30%", size: 50, delay: 0.6, rot: 14 },
    { left: "88%", top: "68%", size: 38, delay: 2.0, rot: -6 },
    { left: "72%", top: "18%", size: 34, delay: 1.6, rot: 20 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden sm:block">
      {boxes.map((b, i) => (
        <div key={i} className="absolute" style={{
          left: b.left, top: b.top, width: b.size, height: b.size,
          transform: `rotate(${b.rot}deg)`, animation: `floatBox 6s ease-in-out ${b.delay}s infinite`,
        }}>
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-xl">
            <polygon points="32,4 60,18 32,32 4,18" fill="#d2a172" />
            <polygon points="4,18 32,32 32,60 4,46" fill="#7a4f27" />
            <polygon points="60,18 32,32 32,60 60,46" fill="#a87745" />
            <rect x="30" y="4" width="4" height="28" fill="#0f172a" opacity="0.25" />
            <rect x="4" y="30" width="56" height="3" fill="#0f172a" opacity="0.2" />
          </svg>
        </div>
      ))}
    </div>
  );
}
