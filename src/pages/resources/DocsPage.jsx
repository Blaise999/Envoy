import PageShell from "../../components/PageShell";

export default function DocsPage() {
  const sections = [
    {
      cat: "Getting Started",
      items: [
        { t: "Quickstart", d: "Create your first shipment in 5 minutes." },
        { t: "Authentication", d: "API keys, scopes, and security best practices." },
        { t: "Environments", d: "Sandbox vs. production endpoints." },
      ],
    },
    {
      cat: "Core APIs",
      items: [
        { t: "Shipments", d: "Create, retrieve, update, and cancel shipments." },
        { t: "Rates", d: "Fetch real-time shipping quotes." },
        { t: "Tracking", d: "Query events or subscribe via webhooks." },
        { t: "Addresses", d: "Validate and normalize delivery addresses." },
      ],
    },
    {
      cat: "Webhooks",
      items: [
        { t: "Event types", d: "scan.created, shipment.delivered, shipment.exception, and more." },
        { t: "Signing & verification", d: "Verify webhook signatures with HMAC-SHA256." },
        { t: "Retries", d: "Exponential backoff with up to 72h of retries." },
      ],
    },
    {
      cat: "Guides",
      items: [
        { t: "Integrate with Shopify", d: "Auto-print labels on order paid." },
        { t: "Build a tracking page", d: "Embed your branded tracking UI." },
        { t: "Handle returns", d: "Issue return labels via API." },
      ],
    },
  ];

  return (
    <PageShell
      title="Documentation"
      subtitle="Everything you need to integrate Envoy into your product."
    >
      <div className="grid md:grid-cols-2 gap-8">
        {sections.map((s) => (
          <section key={s.cat}>
            <h2 className="text-xl font-bold mb-3">{s.cat}</h2>
            <ul className="space-y-2">
              {s.items.map((it) => (
                <li key={it.t} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition">
                  <a href="#" className="block">
                    <div className="font-semibold">{it.t}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{it.d}</div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200">
        <h3 className="font-bold text-lg">Need help?</h3>
        <p className="mt-1 text-slate-600">Email <a href="mailto:developers@shipenvoy.com" className="text-emerald-600 font-semibold">developers@shipenvoy.com</a> or join our developer Slack.</p>
      </div>
    </PageShell>
  );
}
