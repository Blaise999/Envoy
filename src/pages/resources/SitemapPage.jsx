import PageShell from "../../components/PageShell";
import { Link } from "react-router-dom";

export default function SitemapPage() {
  const groups = [
    { h: "Main pages", links: [["Home", "/"], ["Track a shipment", "/track"], ["Get a quote", "/services/express"], ["Sign in", "/auth/login"], ["Create an account", "/auth/register"]] },
    { h: "All services", links: [["Overview", "/services"], ["Express Parcel", "/services/express"], ["Freight & Cargo", "/services/freight"], ["E-commerce", "/services/ecommerce"], ["Customs & Clearance", "/services/customs"], ["Domestic", "/services/domestic"], ["Warehousing", "/services/warehousing"]] },
    { h: "Company", links: [["About", "/about"], ["Careers", "/careers"], ["News", "/news"], ["Contact", "/contact"]] },
    { h: "Support", links: [["FAQ", "/faq"], ["System status", "/status"], ["Contact support", "/contact"]] },
    { h: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Security", "/security"]] },
    { h: "For customers", links: [["Dashboard", "/dashboard"], ["Billing", "/billing"]] },
  ];
  return (
    <PageShell title="Sitemap" subtitle="Every page on the Envoy website, one click away.">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10">
        {groups.map((g) => (
          <section key={g.h}>
            <h2 className="font-black text-slate-900 mb-4 text-lg">{g.h}</h2>
            <ul className="space-y-2.5 text-sm">
              {g.links.map(([l, to]) => (
                <li key={to}>
                  <Link to={to} className="text-slate-600 hover:text-blue-600 transition">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-16 p-8 rounded-3xl bg-slate-50 border border-slate-100">
        <h3 className="font-black text-xl">Can't find what you're looking for?</h3>
        <p className="mt-2 text-slate-600">Drop us a line and we'll point you the right way.</p>
        <Link to="/contact" className="mt-4 inline-block px-5 py-2.5 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400 transition">
          Contact us
        </Link>
      </div>
    </PageShell>
  );
}
