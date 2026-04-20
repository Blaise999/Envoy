import PageShell from "../../components/PageShell";

export default function NewsPage() {
  const featured = {
    date: "Mar 12, 2026",
    tag: "Product",
    title: "Envoy launches same-day delivery in Madrid and Milan",
    blurb: "Our European network just expanded. Same-day parcel delivery is now live in two more metros, bringing total same-day coverage to seven cities across the EU.",
    read: "6 min read",
  };
  const posts = [
    { date: "Feb 28, 2026", tag: "Company", title: "Series B: $45M to expand the Envoy network", blurb: "We closed our Series B led by Atlantica Ventures, with participation from existing investors. The capital goes into fulfillment infrastructure and customs technology.", read: "4 min read" },
    { date: "Feb 04, 2026", tag: "Engineering", title: "How we cut tracking-scan latency by 62%", blurb: "Our engineering team moved tracking event ingestion to an event-sourced pipeline. Here's what changed and the measurable impact on our delivery promise.", read: "12 min read" },
    { date: "Jan 20, 2026", tag: "Partnerships", title: "Envoy is now the official logistics partner for three major marketplaces", blurb: "Automated label printing, COD, and returns now live in-checkout for thousands of merchants. Early customers are seeing 18% lower failed-delivery rates.", read: "3 min read" },
    { date: "Jan 08, 2026", tag: "Impact", title: "100% carbon-neutral shipping across our network", blurb: "Every shipment is now offset through our partnership with Climate Vault. We're also piloting a fleet of electric delivery vans in our three largest European hubs.", read: "5 min read" },
    { date: "Dec 15, 2025", tag: "Product", title: "Introducing Envoy Returns — one-click, QR-coded, free", blurb: "Your customers can now start a return from their tracking page. We pick up, inspect, and refund — all on the same network.", read: "4 min read" },
    { date: "Nov 22, 2025", tag: "Operations", title: "Why we opened a fifth sorting hub in Rotterdam", blurb: "Port proximity and rail access meant Rotterdam had been a bottleneck for years. The new 220,000 sq ft facility is already processing 14% of our European volume.", read: "7 min read" },
    { date: "Oct 30, 2025", tag: "Engineering", title: "Post-mortem: the 94-minute outage on Oct 17", blurb: "A database failover didn't go as planned. Here's exactly what happened, how long it took to notice, and what we're doing differently.", read: "10 min read" },
  ];
  const tags = ["All", "Product", "Engineering", "Company", "Partnerships", "Impact", "Operations"];
  return (
    <PageShell title="News & Press" subtitle="Product launches, company updates, and engineering deep-dives. We write when we have something to say.">
      <div className="flex flex-wrap gap-2 mb-10">
        {tags.map((t, i) => (
          <button key={t} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${i === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{t}</button>
        ))}
      </div>
      <article className="mb-12 rounded-3xl overflow-hidden border border-slate-200 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="p-8 sm:p-12">
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-block px-2 py-1 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-widest">Featured · {featured.tag}</span>
            <span className="text-slate-500">{featured.date} · {featured.read}</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">{featured.title}</h2>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-3xl">{featured.blurb}</p>
          <a href="#" className="mt-6 inline-flex items-center gap-2 text-emerald-700 font-bold hover:text-emerald-800">Read the full post →</a>
        </div>
      </article>
      <div className="grid md:grid-cols-2 gap-5">
        {posts.map((p) => (
          <article key={p.title} className="p-6 sm:p-7 rounded-2xl border border-slate-200 bg-white hover:shadow-lg hover:border-emerald-200 transition">
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-block px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{p.tag}</span>
              <span className="text-slate-500">{p.date}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{p.read}</span>
            </div>
            <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
            <p className="mt-2 text-slate-600">{p.blurb}</p>
            <a href="#" className="mt-4 inline-block text-emerald-600 font-semibold hover:text-emerald-700">Read more →</a>
          </article>
        ))}
      </div>
      <div className="mt-16 p-8 sm:p-10 rounded-3xl bg-slate-900 text-white">
        <div className="grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-black">Get the Envoy newsletter</h3>
            <p className="mt-3 text-slate-300">A monthly email. Product updates, logistics nerdery, the occasional customer story. No marketing fluff.</p>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input type="email" placeholder="you@work.com" className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:border-emerald-400" />
            <button className="px-5 py-3 rounded-xl bg-emerald-500 font-semibold hover:bg-emerald-400 transition">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="mt-10 p-6 rounded-2xl bg-slate-50 text-center">
        <p className="text-slate-600">Press inquiries: <a href="mailto:press@shipenvoy.com" className="text-emerald-600 font-semibold">press@shipenvoy.com</a></p>
      </div>
    </PageShell>
  );
}
