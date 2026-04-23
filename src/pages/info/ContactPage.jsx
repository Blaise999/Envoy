import PageShell from "../../components/PageShell";
import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <PageShell title="Talk to a real human." subtitle="We answer emails in under 4 hours during business days, and calls within 40 seconds. Pick the channel that fits.">
      <div className="grid lg:grid-cols-5 gap-8">
        <section className="lg:col-span-3">
          <h2 className="text-2xl font-black mb-6">Send us a message</h2>
          {sent ? (
            <div className="p-8 rounded-2xl bg-blue-50 border border-blue-200 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500 grid place-items-center mx-auto">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="mt-4 font-bold text-blue-900 text-lg">Message sent.</div>
              <div className="mt-1 text-blue-800">We'll reply within 4 business hours. Usually sooner.</div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-5 p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Your name</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Work email</label>
                  <input required type="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition" placeholder="jane@company.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Company (optional)</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition" placeholder="Acme Logistics Co." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">What's this about?</label>
                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition bg-white">
                  <option>I have a question about a shipment</option>
                  <option>I want to get a quote</option>
                  <option>I'm interested in enterprise pricing</option>
                  <option>Partnerships and integrations</option>
                  <option>Press enquiry</option>
                  <option>Something else</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Tracking number (if relevant)</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition font-mono" placeholder="EV9876543210" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Message</label>
                <textarea required rows={6} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition resize-none" placeholder="Tell us what's going on..." />
              </div>
              <button className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition shadow-md">
                Send message
              </button>
            </form>
          )}
        </section>
        <aside className="lg:col-span-2 space-y-5">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-blue-600 uppercase">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live now
            </div>
            <div className="mt-3 font-black text-lg">Call operations</div>
            <a href="tel:+442035000000" className="block mt-1 text-2xl font-black text-slate-900 hover:text-blue-600">+44 20 3500 0000</a>
            <div className="mt-2 text-sm text-slate-600">Avg pickup: 38 seconds · 24/7</div>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <div className="font-bold">General support</div>
            <a href="mailto:hello@shipenvoy.com" className="block mt-1 text-blue-600 font-semibold">hello@shipenvoy.com</a>
            <div className="mt-1 text-sm text-slate-500">Reply within 4 business hours</div>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <div className="font-bold">Sales (enterprise only)</div>
            <a href="mailto:sales@shipenvoy.com" className="block mt-1 text-blue-600 font-semibold">sales@shipenvoy.com</a>
            <div className="mt-1 text-sm text-slate-500">For volumes above 10k/month</div>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 bg-white">
            <div className="font-bold">Press</div>
            <a href="mailto:press@shipenvoy.com" className="block mt-1 text-blue-600 font-semibold">press@shipenvoy.com</a>
            <div className="mt-1 text-sm text-slate-500">Media kit and spokespeople</div>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900 text-white">
            <div className="font-bold">HQ</div>
            <div className="mt-2 text-sm text-slate-300">21 Wharf Road<br />London N1 7GS, United Kingdom</div>
            <div className="mt-3 text-sm text-slate-400">Open Mon-Fri, 9am-6pm GMT</div>
          </div>
        </aside>
      </div>
      <section className="mt-20">
        <h2 className="text-2xl sm:text-3xl font-black mb-6">Find us elsewhere</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { h: "Rotterdam EU Hub", a: "Haven 4212, 3199 LA Rotterdam, NL", t: "+31 10 555 0000" },
            { h: "Dubai MENA Hub", a: "Dubai South Logistics District, UAE", t: "+971 4 555 0000" },
            { h: "Singapore APAC Hub", a: "7 Changi North Rise, 498788", t: "+65 6555 0000" },
            { h: "New York Office", a: "260 West Broadway, NY 10013, USA", t: "+1 212 555 0000" },
            { h: "Tokyo Office", a: "Roppongi Hills Mori Tower, 6-10-1, Minato-ku", t: "+81 3 5555 0000" },
            { h: "Madrid Office", a: "Paseo de la Castellana 95, 28046", t: "+34 91 555 0000" },
          ].map((o) => (
            <div key={o.h} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="font-bold">{o.h}</div>
              <div className="mt-1 text-sm text-slate-600">{o.a}</div>
              <a href={`tel:${o.t}`} className="mt-1 block text-sm text-blue-600 font-semibold">{o.t}</a>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
