import PageShell from "../../components/PageShell";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const sections = [
    {
      h: "Shipping basics",
      items: [
        { q: "How do I track a shipment?", a: "Use the tracking box at the top of the homepage, or head to the Track page. Paste your tracking ID (they start with EV) and you'll see a live map, timeline, and every scan event." },
        { q: "How fast does a parcel actually arrive?", a: "Express to major cities in the EU, UK, and US arrives in 24-48 hours. Intercontinental express is 48-72 hours. Freight is 3-14 days depending on mode and route — we'll tell you the window before you book." },
        { q: "Do you deliver to PO boxes?", a: "For domestic shipments in most countries, yes. For international, it depends on the destination — some customs authorities won't clear parcels addressed to a PO box. The booking flow will warn you." },
        { q: "What's the heaviest thing I can ship?", a: "Our express service goes up to 70kg per parcel. Above that you want freight — up to full 40-foot containers. No theoretical upper limit on freight; we've moved machines weighing 12 tonnes." },
      ],
    },
    {
      h: "Pricing & payment",
      items: [
        { q: "What does \"duties included\" actually mean?", a: "We calculate the destination country's import duties and taxes at the moment you print the label, and we pay them for you at the border. Your customer receives the parcel with nothing to pay on the other end. Yes, really included." },
        { q: "Are there hidden fees?", a: "No. The quote you see at checkout is the price you pay. Fuel, duties, remote-area surcharges — all built into the visible number. If we ever have to charge more after the fact, we'll email you with the reason before charging." },
        { q: "What payment methods do you accept?", a: "Card (Visa, Mastercard, Amex), bank transfer, and SEPA for EU. Business accounts moving more than £2,000/month qualify for monthly invoicing." },
        { q: "Can I get a refund if you miss the promised delivery date?", a: "Yes. If we're more than 24 hours late and it's our fault, we refund the shipping cost automatically — no claim needed. Duties and declared-value coverage aren't refunded." },
      ],
    },
    {
      h: "International & customs",
      items: [
        { q: "Which countries do you ship to?", a: "220+ countries and territories. The booking flow will tell you the available services for any given lane. We have full coverage of EU, UK, US, Canada, most of APAC, and the major MENA economies." },
        { q: "Will my customer have to deal with customs?", a: "On our pre-cleared lanes, no. We handle the declaration and pay duties at the border. On a few destinations where pre-clearance isn't available, the customer may need to present ID or sign — we'll flag this in the tracking page." },
        { q: "What if my shipment is held by customs?", a: "Our customs team gets notified automatically and starts working on it. You'll get an email within 2 hours of the hold, with what's needed to release. We handle the paperwork on your behalf." },
        { q: "What can't I ship internationally?", a: "Weapons, illegal drugs, live animals, currency, counterfeit goods, and anything banned in either the origin or destination country. See our Terms for the full list." },
      ],
    },
    {
      h: "Claims, returns, and exceptions",
      items: [
        { q: "What do I do if my shipment is lost?", a: "A shipment is officially \"lost\" after 15 business days of no scans for international or 7 business days for domestic. Before that, our ops team is already investigating. File a claim from your dashboard; we pay out against the declared value." },
        { q: "How do returns work?", a: "If you've enabled Envoy Returns, your customer gets a QR code in their tracking page. They take it to any partner drop-off location. We collect, inspect, and refund on the same network." },
        { q: "What if the parcel is damaged?", a: "Photograph the damage immediately. File a claim from your dashboard within 30 days of delivery. We pay out up to the declared value against proof." },
        { q: "What if the recipient isn't home?", a: "For standard service we attempt delivery up to three times. For express, we leave it with a neighbour or at a secure location if the recipient authorised that; otherwise we bring it to a pickup point and email them." },
      ],
    },
    {
      h: "Account & billing",
      items: [
        { q: "How do I open a business account?", a: "Click \"Get a Quote\" on the homepage and follow the signup. You'll be live with an account within 3 minutes, no sales call required. We verify business details afterwards for compliance." },
        { q: "How do I add teammates?", a: "Settings → Team members → Invite. Each person gets their own login with role-based permissions: Viewer, Operator, or Admin." },
        { q: "Can I change my billing email?", a: "Yes, from Settings → Billing → Billing contact. Invoices go to that address; notifications still go to the primary account email." },
        { q: "What if I want to close my account?", a: "Settings → Account → Close account. We delete your personal data within 30 days, except shipment records we're legally required to keep for 7 years." },
      ],
    },
  ];
  const norm = search.toLowerCase().trim();
  const filtered = norm ? sections.map(s => ({
    ...s,
    items: s.items.filter(i => (i.q + " " + i.a).toLowerCase().includes(norm))
  })).filter(s => s.items.length > 0) : sections;
  return (
    <PageShell title="Frequently asked questions." subtitle="Answers to the things people actually ask, in plain English. If your question isn't here, email us.">
      <div className="mb-12 p-2 rounded-full border border-slate-200 bg-white shadow-sm flex items-stretch max-w-2xl">
        <div className="flex items-center px-4 text-slate-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <input type="text" placeholder="Search for an answer..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 outline-none bg-transparent text-sm py-2.5" />
        {search && <button onClick={() => setSearch("")} className="px-4 text-slate-400 hover:text-slate-700 text-sm">Clear</button>}
      </div>
      {filtered.length === 0 && (
        <div className="p-10 text-center rounded-2xl bg-slate-50 border border-slate-200">
          <div className="font-bold text-lg">No matching questions.</div>
          <div className="mt-2 text-slate-600">Try different keywords, or <Link to="/contact" className="text-blue-600 font-semibold">ask us directly</Link>.</div>
        </div>
      )}
      <div className="space-y-14">
        {filtered.map((s) => (
          <section key={s.h}>
            <h2 className="text-2xl sm:text-3xl font-black mb-5">{s.h}</h2>
            <div className="space-y-3">
              {s.items.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 hover:border-blue-300 transition">
                  <summary className="list-none cursor-pointer flex items-center justify-between font-semibold text-slate-900 gap-4">
                    <span>{f.q}</span>
                    <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <p className="mt-4 text-slate-600 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-20 p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white text-center">
        <h3 className="text-2xl sm:text-3xl font-black">Still can't find what you need?</h3>
        <p className="mt-3 text-slate-300">Write us at envoymailservices@gmail.com or call +44 20 3500 0000. Real humans, any hour.</p>
        <Link to="/contact" className="mt-6 inline-block px-6 py-3 rounded-full bg-blue-500 font-semibold hover:bg-blue-400 transition">Contact support</Link>
      </div>
    </PageShell>
  );
}
