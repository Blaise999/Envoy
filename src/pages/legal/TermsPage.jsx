import PageShell from "../../components/PageShell";

export default function TermsPage() {
  return (
    <PageShell title="Terms of Service" subtitle="Last updated: January 15, 2026. Read these before shipping with us.">
      <div className="max-w-3xl space-y-10 text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-slate-900">1. Who these apply to</h2>
          <p className="mt-3">By creating an Envoy account, booking a shipment through our website, or using our API, you agree to these Terms. If you're using Envoy on behalf of an organization, you confirm you have the authority to bind that organization. If you don't agree, don't use the service.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">2. What we do</h2>
          <p className="mt-3">Envoy provides logistics services: collection, transport, customs handling, and delivery of parcels and freight. We do this either as a carrier directly or by contracting with partner carriers. We act as your agent for customs purposes when authorized to do so.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">3. Prohibited items</h2>
          <p className="mt-3">You may not ship:</p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Weapons, ammunition, or military-grade technology</li>
            <li>Illegal drugs or controlled substances</li>
            <li>Hazardous materials outside our regulated hazmat channels</li>
            <li>Counterfeit goods</li>
            <li>Live animals (unless you've arranged a dedicated live-animal service separately)</li>
            <li>Currency or negotiable instruments</li>
            <li>Human remains or body parts</li>
            <li>Anything banned under the laws of the origin, transit, or destination country</li>
          </ul>
          <p className="mt-3">If we find prohibited items in transit, we may open the package, return it, surrender it to authorities, or dispose of it. No refund.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">4. Your obligations</h2>
          <p className="mt-3">You are responsible for:</p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>Packaging your shipment properly for the mode of transport.</li>
            <li>Accurately describing the contents, value, and weight.</li>
            <li>Providing a valid, complete delivery address and receiver contact information.</li>
            <li>Complying with export and import regulations at both ends.</li>
            <li>Paying all charges, including duties and any surcharges we disclose to you in advance.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">5. Pricing & payment</h2>
          <p className="mt-3">Quoted rates include base shipping. Fuel, customs duties, and any surcharges are shown before checkout. Payment is due at the time of booking unless you have a credit arrangement. Late payment incurs interest at the Bank of England base rate + 4%, from the due date.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">6. Liability & insurance</h2>
          <p className="mt-3">Our liability for loss, damage, or delay is capped per the Warsaw / Montreal Conventions for international shipments and applicable national limits for domestic ones — unless you purchase additional declared-value coverage at checkout.</p>
          <p className="mt-3">For declared-value shipments, we pay out up to the declared amount against proof of loss or damage. Claims must be filed within 30 days of the delivery date (or expected delivery date for lost parcels).</p>
          <p className="mt-3">We are not liable for: consequential damages, packaging failures, goods held by customs beyond our control, or force majeure events (war, natural disaster, strike, etc.).</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">7. Delivery promise & refund</h2>
          <p className="mt-3">If we quote a delivery date and miss it by more than 24 hours for reasons within our control, we refund the shipping cost automatically. Duties and declared-value coverage are not refunded.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">8. API usage</h2>
          <p className="mt-3">If you use the Envoy API, additional rate-limit and security terms apply. Don't share API keys, don't use the sandbox environment for real shipments, and don't try to reverse-engineer our systems.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">9. Termination</h2>
          <p className="mt-3">Either party may terminate the contract for convenience with 30 days' written notice. We may suspend or terminate your account immediately if you materially breach these Terms, misuse the service, or fail to pay after reminders.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">10. Governing law</h2>
          <p className="mt-3">These Terms are governed by English law. Disputes go to the courts of London — unless a different jurisdiction is mandatory under your local consumer law.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">11. Changes</h2>
          <p className="mt-3">We'll notify account holders at least 30 days before any material change. Continuing to use the service after the change takes effect counts as acceptance.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">12. Contact</h2>
          <p className="mt-3">Questions about these Terms? Email <a href="mailto:legal@shipenvoy.com" className="text-emerald-600 font-semibold">legal@shipenvoy.com</a>.</p>
        </section>
      </div>
    </PageShell>
  );
}
