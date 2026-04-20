import PageShell from "../../components/PageShell";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" subtitle="Last updated: January 15, 2026. We wrote this in English, not lawyer, so you can actually tell what we're doing with your data.">
      <div className="max-w-3xl space-y-10 text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-slate-900">The short version</h2>
          <p className="mt-3">We collect what we need to ship your parcels, get them through customs, take your payment, and keep your account secure. We don't sell data. We don't run ads off your shipping history. If you leave, we delete what we're legally allowed to delete.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">1. Who we are</h2>
          <p className="mt-3">Envoy Logistics Ltd. ("Envoy", "we", "us") is a UK-registered company (company number XX-XXXXXXX), with its registered office at 21 Wharf Road, London, UK. We are the data controller for the personal data described in this policy.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">2. What we collect</h2>
          <p className="mt-3">We collect the following categories of personal data:</p>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li><b>Account data:</b> name, email, phone number, business name (if applicable), country.</li>
            <li><b>Shipping data:</b> pickup and delivery addresses, parcel weight and dimensions, declared contents, customs values, tracking events.</li>
            <li><b>Payment data:</b> card last four digits, billing address, payment history. Full card numbers are handled by our payment processors (Stripe, Adyen) — we never see or store them.</li>
            <li><b>Device and usage data:</b> IP address, browser type, pages visited, device type. We use this to detect fraud, debug issues, and improve the product.</li>
            <li><b>Support data:</b> your messages to our support team, any attachments, and our notes on the conversation.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">3. How we use it</h2>
          <p className="mt-3">We use your data to:</p>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li>Pick up, transport, and deliver your shipments.</li>
            <li>Calculate duties and submit customs declarations to the relevant authorities.</li>
            <li>Process payments and issue receipts and invoices.</li>
            <li>Send you tracking updates and critical account notifications (you can't opt out of these as long as you have an active shipment).</li>
            <li>Send marketing emails, but only if you've opted in.</li>
            <li>Detect and prevent fraud, abuse, and policy violations.</li>
            <li>Improve the service — aggregated, de-identified where possible.</li>
            <li>Comply with legal obligations, including tax and customs requirements.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">4. Who we share it with</h2>
          <p className="mt-3">We share your data only when needed to deliver a shipment or operate the business:</p>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li><b>Partner carriers</b> who perform final-mile delivery or cross-border freight.</li>
            <li><b>Customs authorities</b> in origin, transit, and destination countries.</li>
            <li><b>Payment processors</b> (Stripe, Adyen).</li>
            <li><b>Infrastructure providers</b> (AWS, Cloudflare) under GDPR-compliant data-processing agreements.</li>
            <li><b>Analytics and support tools</b> (Linear, Intercom, PostHog) — strictly for running the service.</li>
          </ul>
          <p className="mt-3">We do not sell your data. We do not share it with advertisers.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">5. Your rights</h2>
          <p className="mt-3">Under GDPR, UK GDPR, and CCPA you have the right to access, correct, or delete your personal data, to restrict or object to certain processing, and to port your data to another service. To exercise any of these, email <a href="mailto:privacy@shipenvoy.com" className="text-emerald-600 font-semibold">privacy@shipenvoy.com</a>. We respond within 30 days.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">6. Retention</h2>
          <p className="mt-3">We keep shipment records for 7 years after the shipment date — this is the minimum we're required to hold for tax and customs reasons. Account data is kept for as long as your account is active, plus 2 years. Support conversations are retained for 3 years. After that, we delete or irreversibly anonymize.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">7. International transfers</h2>
          <p className="mt-3">Our primary infrastructure is in the EU (Frankfurt and Dublin). Some support tools are US-based and covered by Standard Contractual Clauses or the UK-US Data Bridge. We don't transfer data to jurisdictions without adequate protection.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">8. Security</h2>
          <p className="mt-3">TLS 1.3 in transit. AES-256 at rest. Mandatory MFA for employees. Hardware security keys for production access. More detail on our <a href="/security" className="text-emerald-600 font-semibold">Security page</a>.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">9. Changes</h2>
          <p className="mt-3">We'll email account holders at least 30 days before any material change to this policy. You can find the current version, and an archive of previous versions, at envoy.com/privacy.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">10. Contact</h2>
          <p className="mt-3">Our Data Protection Officer can be reached at <a href="mailto:dpo@shipenvoy.com" className="text-emerald-600 font-semibold">dpo@shipenvoy.com</a>. You also have the right to lodge a complaint with your local supervisory authority (ICO in the UK, CNIL in France, etc.).</p>
        </section>
      </div>
    </PageShell>
  );
}
