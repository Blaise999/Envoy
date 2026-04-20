import PageShell from "../components/PageShell";
import { Link } from "react-router-dom";

export default function SitemapPage() {
  const sections = [
    {
      cat: "Main",
      links: [
        ["Home", "/"],
        ["Track a shipment", "/track"],
        ["Create shipment", "/services/express"],
      ],
    },
    {
      cat: "Services",
      links: [
        ["Express Delivery", "/services/express"],
        ["Freight & Cargo", "/services/freight"],
        ["E-commerce", "/services/ecommerce"],
        ["Customs & Clearance", "/services/customs"],
        ["Domestic Shipping", "/services/domestic"],
        ["Warehousing", "/services/warehousing"],
      ],
    },
    {
      cat: "Company",
      links: [
        ["About", "/about"],
        ["Careers", "/careers"],
        ["News", "/news"],
        ["Contact", "/contact"],
      ],
    },
    {
      cat: "Resources",
      links: [
        ["Developers", "/developers"],
        ["Documentation", "/docs"],
        ["API Status", "/status"],
        ["FAQ", "/faq"],
      ],
    },
    {
      cat: "Legal",
      links: [
        ["Privacy Policy", "/privacy"],
        ["Terms of Service", "/terms"],
        ["Cookie Policy", "/cookies"],
        ["Security", "/security"],
      ],
    },
    {
      cat: "Account",
      links: [
        ["Sign in", "/auth/login"],
        ["Create account", "/auth/register"],
        ["Dashboard", "/dashboard"],
      ],
    },
  ];
  return (
    <PageShell title="Sitemap" subtitle="Every page on Envoy, in one place.">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
        {sections.map((s) => (
          <div key={s.cat}>
            <h2 className="font-bold text-lg mb-3">{s.cat}</h2>
            <ul className="space-y-2">
              {s.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-slate-700 hover:text-emerald-600">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
