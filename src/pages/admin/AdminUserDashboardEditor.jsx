// src/pages/admin/AdminUserDashboardEditor.jsx
//
// Forms-based per-user dashboard editor for admins.
// Lets the admin edit every section the user can see in their own dashboard.
//

import React, { useEffect, useState } from "react";
import { adminUsers } from "../../utils/api";

const TABS = [
  { key: "profile",    label: "Profile" },
  { key: "billing",    label: "Billing" },
  { key: "shipments",  label: "Shipments" },
  { key: "addresses",  label: "Addresses" },
  { key: "payments",   label: "Payment methods" },
  { key: "pickups",    label: "Pickups" },
  { key: "quotes",     label: "Quotes" },
  { key: "support",    label: "Support tickets" },
  { key: "notif",      label: "Notifications" },
  { key: "raw",        label: "Raw JSON" },
];

export default function AdminUserDashboardEditor({ userId, userLabel, onClose, onSaved }) {
  const [tab, setTab] = useState("profile");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [recompute, setRecompute] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const d = await adminUsers.getDetails(userId);
      setDoc(normalize(d));
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  async function save() {
    if (!doc) return;
    setSaving(true);
    setErr("");
    setInfo("");
    try {
      const fresh = await adminUsers.setDetails(userId, doc, { recompute: recompute ? 1 : 0 });
      setDoc(normalize(fresh));
      setInfo("Saved.");
      setTimeout(() => setInfo(""), 1800);
      onSaved?.();
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const update = (patch) => setDoc((d) => ({ ...(d || {}), ...patch }));
  const updateBilling = (patch) => setDoc((d) => ({ ...(d || {}), billing: { ...(d?.billing || {}), ...patch } }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-slate-900/60 p-2 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-auto flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 bg-white">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Editing dashboard for</div>
            <div className="font-semibold">{userLabel || userId}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={recompute} onChange={(e) => setRecompute(e.target.checked)} />
              Recompute billing
            </label>
            <button onClick={load} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">Reload</button>
            <button onClick={save} disabled={saving || loading} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 disabled:bg-blue-300">
              {saving ? "Saving…" : "Save all"}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">Close</button>
          </div>
        </header>

        {(err || info) && (
          <div className={`px-5 py-2 text-sm ${err ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"} border-b`}>
            {err || info}
          </div>
        )}

        <nav className="px-5 py-2 border-b bg-white overflow-x-auto">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === t.key ? "bg-blue-500 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          {loading && <div className="text-sm text-slate-500">Loading…</div>}
          {!loading && doc && (
            <>
              {tab === "profile"   && <ProfileTab doc={doc} update={update} />}
              {tab === "billing"   && <BillingTab doc={doc} updateBilling={updateBilling} />}
              {tab === "shipments" && <ShipmentsTab doc={doc} update={update} />}
              {tab === "addresses" && <AddressesTab doc={doc} update={update} />}
              {tab === "payments"  && <PaymentsTab doc={doc} update={update} />}
              {tab === "pickups"   && <PickupsTab doc={doc} update={update} />}
              {tab === "quotes"    && <QuotesTab doc={doc} update={update} />}
              {tab === "support"   && <SupportTab doc={doc} update={update} />}
              {tab === "notif"     && <NotifTab doc={doc} update={update} />}
              {tab === "raw"       && <RawJsonTab doc={doc} setDoc={setDoc} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Tab components
   ============================================================ */

function ProfileTab({ doc, update }) {
  const profile = doc.profile || {};
  return (
    <Section title="Profile">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Display name" value={doc.displayName || ""} onChange={(v) => update({ displayName: v })} />
        <Field label="Phone" value={doc.phone || ""} onChange={(v) => update({ phone: v })} />
        <Field label="Email" value={doc.email || ""} onChange={(v) => update({ email: v })} />
        <Field
          label="Roles (comma sep)"
          value={(doc.roles || []).join(", ")}
          onChange={(v) => update({ roles: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
        <Field label="Account type" type="select" value={profile.accountType || "individual"}
          options={[{ v: "individual", t: "Individual" }, { v: "business", t: "Business" }]}
          onChange={(v) => update({ profile: { ...profile, accountType: v } })} />
        <Field label="Company" value={profile.company || ""} onChange={(v) => update({ profile: { ...profile, company: v } })} />
        <Field label="Contact person" value={profile.contactPerson || ""} onChange={(v) => update({ profile: { ...profile, contactPerson: v } })} />
        <Field label="Business address" value={profile.businessAddress || ""} onChange={(v) => update({ profile: { ...profile, businessAddress: v } })} />
        <Field label="Loyalty tier" value={profile.loyaltyTier || ""} onChange={(v) => update({ profile: { ...profile, loyaltyTier: v } })} />
        <Field label="Referral code" value={profile.referralCode || ""} onChange={(v) => update({ profile: { ...profile, referralCode: v } })} />
      </div>
    </Section>
  );
}

function BillingTab({ doc, updateBilling }) {
  const b = doc.billing || {};
  const byMonth = b.byMonth || [];

  function setMonth(i, sum) {
    const next = byMonth.map((m, j) => (j === i ? { ...m, sum: Number(sum) || 0 } : m));
    updateBilling({ byMonth: next });
  }
  function setMonthYm(i, ym) {
    updateBilling({ byMonth: byMonth.map((x, j) => j === i ? { ...x, ym } : x) });
  }
  function addMonth() {
    const ym = new Date().toISOString().slice(0, 7);
    updateBilling({ byMonth: [...byMonth, { ym, sum: 0 }] });
  }
  function removeMonth(i) {
    updateBilling({ byMonth: byMonth.filter((_, j) => j !== i) });
  }

  return (
    <Section title="Billing">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Currency" value={b.currency || "EUR"} onChange={(v) => updateBilling({ currency: v })} />
        <Field label="Total spend" type="number" value={b.totalSpend ?? 0} onChange={(v) => updateBilling({ totalSpend: Number(v) || 0 })} />
        <Field label="Wallet balance" type="number" value={b.walletBalance ?? 0} onChange={(v) => updateBilling({ walletBalance: Number(v) || 0 })} />
        <Field label="Delivered count" type="number" value={b.deliveredCount ?? 0} onChange={(v) => updateBilling({ deliveredCount: Number(v) || 0 })} />
        <Field label="In-transit count" type="number" value={b.inTransitCount ?? 0} onChange={(v) => updateBilling({ inTransitCount: Number(v) || 0 })} />
        <Field label="Exception count" type="number" value={b.exceptionCount ?? 0} onChange={(v) => updateBilling({ exceptionCount: Number(v) || 0 })} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-sm">Monthly spend (last 6)</h4>
          <button onClick={addMonth} className="text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">+ Add month</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {byMonth.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={m.ym}
                onChange={(e) => setMonthYm(i, e.target.value)}
                className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                placeholder="YYYY-MM"
              />
              <input
                type="number"
                value={m.sum ?? 0}
                onChange={(e) => setMonth(i, e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <button onClick={() => removeMonth(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
            </div>
          ))}
          {byMonth.length === 0 && <div className="text-xs text-slate-500">No months. Click ‘+ Add month’.</div>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tip: turn off “Recompute billing” in the header if you want these numbers to stick exactly as you typed them.
        </p>
      </div>
    </Section>
  );
}

function ShipmentsTab({ doc, update }) {
  const ships = doc.shipments || [];
  function setShip(i, patch) {
    update({ shipments: ships.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }
  function addShip() {
    update({
      shipments: [
        {
          trackingNumber: "GE" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          service: "Standard",
          serviceType: "parcel",
          status: "Created",
          from: "",
          to: "",
          toName: "",
          pieces: 1,
          weightKg: 0,
          price: 0,
          currency: "EUR",
          createdAt: new Date().toISOString(),
        },
        ...ships,
      ],
    });
  }
  function delShip(i) { update({ shipments: ships.filter((_, j) => j !== i) }); }

  return (
    <Section
      title={`Shipments (${ships.length})`}
      action={<button onClick={addShip} className="btn-blue text-xs">+ Add shipment</button>}
    >
      {ships.length === 0 && <Empty msg="No shipments. Click ‘+ Add shipment’." />}
      <div className="space-y-2">
        {ships.map((s, i) => (
          <details key={i} className="rounded-xl border bg-white">
            <summary className="px-3 py-2 cursor-pointer flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.trackingNumber || "(no tracking)"} — {s.from || "?"} → {s.to || "?"} — {s.status}</span>
              <span className="text-xs text-slate-500">€{Number(s.price || 0).toFixed(2)}</span>
            </summary>
            <div className="p-3 grid sm:grid-cols-3 gap-2 border-t">
              <Field small label="Tracking" value={s.trackingNumber || ""} onChange={(v) => setShip(i, { trackingNumber: v })} />
              <Field small label="Service" type="select" value={s.service || "Standard"}
                options={["Standard", "Express", "Priority", "Freight"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setShip(i, { service: v })} />
              <Field small label="Service type" type="select" value={s.serviceType || "parcel"}
                options={[{ v: "parcel", t: "parcel" }, { v: "freight", t: "freight" }]}
                onChange={(v) => setShip(i, { serviceType: v })} />
              <Field small label="Status" type="select" value={s.status || "Created"}
                options={["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Exception", "Cancelled"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setShip(i, { status: v })} />
              <Field small label="From" value={s.from || ""} onChange={(v) => setShip(i, { from: v })} />
              <Field small label="To" value={s.to || ""} onChange={(v) => setShip(i, { to: v })} />
              <Field small label="To name" value={s.toName || ""} onChange={(v) => setShip(i, { toName: v })} />
              <Field small label="Pieces" type="number" value={s.pieces ?? 1} onChange={(v) => setShip(i, { pieces: Number(v) || 0 })} />
              <Field small label="Weight (kg)" type="number" value={s.weightKg ?? 0} onChange={(v) => setShip(i, { weightKg: Number(v) || 0 })} />
              <Field small label="Price" type="number" value={s.price ?? 0} onChange={(v) => setShip(i, { price: Number(v) || 0 })} />
              <Field small label="Currency" value={s.currency || "EUR"} onChange={(v) => setShip(i, { currency: v })} />
              <Field small label="Created at" value={s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 16) : ""} type="datetime-local"
                onChange={(v) => setShip(i, { createdAt: v ? new Date(v).toISOString() : new Date().toISOString() })} />
              <div className="sm:col-span-3 flex justify-end">
                <button onClick={() => delShip(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete shipment</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function AddressesTab({ doc, update }) {
  const list = doc.addresses || [];
  function setItem(i, patch) { update({ addresses: list.map((x, j) => j === i ? { ...x, ...patch } : x) }); }
  function add() {
    update({ addresses: [{ label: "New address", name: "", line1: "", city: "", country: "", isDefault: false }, ...list] });
  }
  function del(i) { update({ addresses: list.filter((_, j) => j !== i) }); }

  return (
    <Section title={`Addresses (${list.length})`} action={<button onClick={add} className="btn-blue text-xs">+ Add</button>}>
      {list.length === 0 && <Empty msg="No saved addresses." />}
      <div className="space-y-2">
        {list.map((a, i) => (
          <details key={i} className="rounded-xl border bg-white">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium">
              {a.label || a.name || "Address"} — {[a.city, a.country].filter(Boolean).join(", ")} {a.isDefault ? "★" : ""}
            </summary>
            <div className="p-3 grid sm:grid-cols-2 gap-2 border-t">
              <Field small label="Label" value={a.label || ""} onChange={(v) => setItem(i, { label: v })} />
              <Field small label="Name" value={a.name || ""} onChange={(v) => setItem(i, { name: v })} />
              <div className="sm:col-span-2"><Field small label="Line 1" value={a.line1 || ""} onChange={(v) => setItem(i, { line1: v })} /></div>
              <div className="sm:col-span-2"><Field small label="Line 2" value={a.line2 || ""} onChange={(v) => setItem(i, { line2: v })} /></div>
              <Field small label="City" value={a.city || ""} onChange={(v) => setItem(i, { city: v })} />
              <Field small label="State" value={a.state || ""} onChange={(v) => setItem(i, { state: v })} />
              <Field small label="Postal code" value={a.postalCode || ""} onChange={(v) => setItem(i, { postalCode: v })} />
              <Field small label="Country" value={a.country || ""} onChange={(v) => setItem(i, { country: v })} />
              <Field small label="Phone" value={a.phone || ""} onChange={(v) => setItem(i, { phone: v })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!a.isDefault} onChange={(e) => setItem(i, { isDefault: e.target.checked })} /> Default
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <button onClick={() => del(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function PaymentsTab({ doc, update }) {
  const list = doc.paymentMethods || [];
  function setItem(i, patch) { update({ paymentMethods: list.map((x, j) => j === i ? { ...x, ...patch } : x) }); }
  function add() {
    update({ paymentMethods: [{ label: "New card", brand: "visa", last4: "0000", expMonth: 12, expYear: 2030, default: false, status: "valid", provider: "mock" }, ...list] });
  }
  function del(i) { update({ paymentMethods: list.filter((_, j) => j !== i) }); }

  return (
    <Section title={`Payment methods (${list.length})`} action={<button onClick={add} className="btn-blue text-xs">+ Add</button>}>
      {list.length === 0 && <Empty msg="No payment methods." />}
      <div className="space-y-2">
        {list.map((p, i) => (
          <details key={i} className="rounded-xl border bg-white">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium">
              {(p.brand || "Card").toUpperCase()} •••• {p.last4 || "----"} — {p.label || "Card"} {p.default ? "★" : ""}
            </summary>
            <div className="p-3 grid sm:grid-cols-3 gap-2 border-t">
              <Field small label="Label" value={p.label || ""} onChange={(v) => setItem(i, { label: v })} />
              <Field small label="Brand" type="select" value={p.brand || "visa"}
                options={["visa", "mastercard", "amex", "verve", "discover"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { brand: v })} />
              <Field small label="Last 4" value={p.last4 || ""} onChange={(v) => setItem(i, { last4: v.replace(/\D/g, "").slice(-4) })} />
              <Field small label="Exp month" type="number" value={p.expMonth ?? 12} onChange={(v) => setItem(i, { expMonth: Number(v) || 1 })} />
              <Field small label="Exp year" type="number" value={p.expYear ?? 2030} onChange={(v) => setItem(i, { expYear: Number(v) || 2030 })} />
              <Field small label="Provider" type="select" value={p.provider || "mock"}
                options={["mock", "stripe", "paystack", "flutterwave"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { provider: v })} />
              <Field small label="Status" type="select" value={p.status || "valid"}
                options={["valid", "expired", "in_review", "inactive"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { status: v })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!p.default} onChange={(e) => setItem(i, { default: e.target.checked })} /> Default
              </label>
              <div className="sm:col-span-3 flex justify-end">
                <button onClick={() => del(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function PickupsTab({ doc, update }) {
  const list = doc.pickups || [];
  function setItem(i, patch) { update({ pickups: list.map((x, j) => j === i ? { ...x, ...patch } : x) }); }
  function add() {
    update({
      pickups: [{
        publicId: "PUP" + Math.random().toString(36).slice(2, 7).toUpperCase(),
        date: new Date().toISOString(),
        window: "13:00–17:00",
        addressText: "",
        recurring: false,
        frequency: "WEEKLY",
        status: "Requested",
        instructions: "",
      }, ...list],
    });
  }
  function del(i) { update({ pickups: list.filter((_, j) => j !== i) }); }

  return (
    <Section title={`Pickups (${list.length})`} action={<button onClick={add} className="btn-blue text-xs">+ Add</button>}>
      {list.length === 0 && <Empty msg="No pickups." />}
      <div className="space-y-2">
        {list.map((p, i) => (
          <details key={i} className="rounded-xl border bg-white">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium">
              {p.publicId || "(no id)"} — {new Date(p.date).toLocaleDateString()} {p.window} — {p.status}
            </summary>
            <div className="p-3 grid sm:grid-cols-3 gap-2 border-t">
              <Field small label="Public ID" value={p.publicId || ""} onChange={(v) => setItem(i, { publicId: v })} />
              <Field small label="Date" type="datetime-local" value={p.date ? new Date(p.date).toISOString().slice(0, 16) : ""}
                onChange={(v) => setItem(i, { date: v ? new Date(v).toISOString() : new Date().toISOString() })} />
              <Field small label="Window" type="select" value={p.window || "13:00–17:00"}
                options={["09:00–13:00", "13:00–17:00", "17:00–20:00"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { window: v })} />
              <div className="sm:col-span-3"><Field small label="Address text" value={p.addressText || ""} onChange={(v) => setItem(i, { addressText: v })} /></div>
              <Field small label="Status" type="select" value={p.status || "Requested"}
                options={["Requested", "Scheduled", "In Progress", "Completed", "Cancelled"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { status: v })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!p.recurring} onChange={(e) => setItem(i, { recurring: e.target.checked })} /> Recurring
              </label>
              <Field small label="Frequency" type="select" value={p.frequency || "WEEKLY"}
                options={["DAILY", "WEEKLY", "BIWEEKLY"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { frequency: v })} />
              <div className="sm:col-span-3"><Field small label="Instructions" value={p.instructions || ""} onChange={(v) => setItem(i, { instructions: v })} /></div>
              <div className="sm:col-span-3 flex justify-end">
                <button onClick={() => del(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function QuotesTab({ doc, update }) {
  const list = doc.quotes || [];
  function setItem(i, patch) { update({ quotes: list.map((x, j) => j === i ? { ...x, ...patch } : x) }); }
  function add() {
    update({
      quotes: [{
        publicId: "QT" + Math.random().toString(36).slice(2, 7).toUpperCase(),
        from: "", to: "", service: "Standard",
        weightKg: 0, pieces: 1, price: 0, currency: "EUR",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active", notes: "",
      }, ...list],
    });
  }
  function del(i) { update({ quotes: list.filter((_, j) => j !== i) }); }

  return (
    <Section title={`Quotes (${list.length})`} action={<button onClick={add} className="btn-blue text-xs">+ Add</button>}>
      {list.length === 0 && <Empty msg="No quotes." />}
      <div className="space-y-2">
        {list.map((q, i) => (
          <details key={i} className="rounded-xl border bg-white">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium">
              {q.publicId || "(no id)"} — {q.from || "?"} → {q.to || "?"} — €{Number(q.price || 0).toFixed(2)} ({q.status})
            </summary>
            <div className="p-3 grid sm:grid-cols-3 gap-2 border-t">
              <Field small label="Public ID" value={q.publicId || ""} onChange={(v) => setItem(i, { publicId: v })} />
              <Field small label="From" value={q.from || ""} onChange={(v) => setItem(i, { from: v })} />
              <Field small label="To" value={q.to || ""} onChange={(v) => setItem(i, { to: v })} />
              <Field small label="Service" type="select" value={q.service || "Standard"}
                options={["Standard", "Express", "Priority", "Freight"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { service: v })} />
              <Field small label="Weight (kg)" type="number" value={q.weightKg ?? 0} onChange={(v) => setItem(i, { weightKg: Number(v) || 0 })} />
              <Field small label="Pieces" type="number" value={q.pieces ?? 1} onChange={(v) => setItem(i, { pieces: Number(v) || 1 })} />
              <Field small label="Price" type="number" value={q.price ?? 0} onChange={(v) => setItem(i, { price: Number(v) || 0 })} />
              <Field small label="Currency" value={q.currency || "EUR"} onChange={(v) => setItem(i, { currency: v })} />
              <Field small label="Status" type="select" value={q.status || "active"}
                options={["active", "expired", "converted"].map((x) => ({ v: x, t: x }))}
                onChange={(v) => setItem(i, { status: v })} />
              <Field small label="Expires at" type="datetime-local" value={q.expiresAt ? new Date(q.expiresAt).toISOString().slice(0, 16) : ""}
                onChange={(v) => setItem(i, { expiresAt: v ? new Date(v).toISOString() : null })} />
              <div className="sm:col-span-3"><Field small label="Notes" value={q.notes || ""} onChange={(v) => setItem(i, { notes: v })} /></div>
              <div className="sm:col-span-3 flex justify-end">
                <button onClick={() => del(i)} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function SupportTab({ doc, update }) {
  const list = doc.supportTickets || [];

  function setItem(i, patch) { update({ supportTickets: list.map((x, j) => j === i ? { ...x, ...patch } : x) }); }
  function del(i) { update({ supportTickets: list.filter((_, j) => j !== i) }); }
  function addAdminMessage(i, text) {
    if (!text.trim()) return;
    const ticket = list[i];
    const messages = [...(ticket.messages || []), { sender: "admin", text: text.trim(), at: new Date().toISOString() }];
    setItem(i, { messages });
  }

  return (
    <Section title={`Support tickets (${list.length})`}>
      {list.length === 0 && <Empty msg="No tickets." />}
      <div className="space-y-2">
        {list.map((t, i) => (
          <TicketRow
            key={i}
            ticket={t}
            onChange={(patch) => setItem(i, patch)}
            onDelete={() => del(i)}
            onReply={(text) => addAdminMessage(i, text)}
          />
        ))}
      </div>
    </Section>
  );
}

function TicketRow({ ticket, onChange, onDelete, onReply }) {
  const [reply, setReply] = useState("");
  return (
    <details className="rounded-xl border bg-white">
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{ticket.publicId || "(no id)"} — {ticket.subject || "(no subject)"} — {ticket.status}</span>
        <span className="text-xs text-slate-500">{(ticket.messages || []).length} msgs</span>
      </summary>
      <div className="p-3 border-t space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Field small label="Public ID" value={ticket.publicId || ""} onChange={(v) => onChange({ publicId: v })} />
          <Field small label="Subject" value={ticket.subject || ""} onChange={(v) => onChange({ subject: v })} />
          <Field small label="Category" type="select" value={ticket.category || "general"}
            options={[
              { v: "delayed", t: "delayed" }, { v: "lost", t: "lost" }, { v: "damaged", t: "damaged" },
              { v: "wrong_address", t: "wrong_address" }, { v: "payment", t: "payment" },
              { v: "refund", t: "refund" }, { v: "general", t: "general" },
            ]}
            onChange={(v) => onChange({ category: v })} />
          <Field small label="Related tracking" value={ticket.relatedTracking || ""} onChange={(v) => onChange({ relatedTracking: v })} />
          <Field small label="Status" type="select" value={ticket.status || "open"}
            options={["open", "pending", "resolved", "closed"].map((x) => ({ v: x, t: x }))}
            onChange={(v) => onChange({ status: v })} />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">Messages</div>
          <div className="rounded-lg border bg-slate-50 p-2 max-h-60 overflow-y-auto space-y-1">
            {(ticket.messages || []).map((m, j) => (
              <div key={j} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-2 py-1 rounded-lg text-xs ${m.sender === "admin" ? "bg-blue-500 text-white" : "bg-white border"}`}>
                  <div className="text-[10px] uppercase font-bold opacity-70">{m.sender}</div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
            {(ticket.messages || []).length === 0 && <div className="text-xs text-slate-500">No messages.</div>}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply as admin (added on Save)…"
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            <button onClick={() => { onReply(reply); setReply(""); }} className="btn-blue text-xs">Add reply</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tip: replies stage locally — click ‘Save all’ in the header to persist.</p>
        </div>

        <div className="flex justify-end">
          <button onClick={onDelete} className="text-xs text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">Delete ticket</button>
        </div>
      </div>
    </details>
  );
}

function NotifTab({ doc, update }) {
  const p = doc.notificationPrefs || {};
  function setPref(key, val) { update({ notificationPrefs: { ...p, [key]: val } }); }
  return (
    <Section title="Notification preferences">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Toggle label="Email" value={p.email} onChange={(v) => setPref("email", v)} />
        <Toggle label="SMS" value={p.sms} onChange={(v) => setPref("sms", v)} />
        <Toggle label="WhatsApp" value={p.whatsapp} onChange={(v) => setPref("whatsapp", v)} />
        <Toggle label="Pickup confirmed" value={p.pickup} onChange={(v) => setPref("pickup", v)} />
        <Toggle label="In transit" value={p.transit} onChange={(v) => setPref("transit", v)} />
        <Toggle label="Delivered" value={p.delivered} onChange={(v) => setPref("delivered", v)} />
        <Toggle label="Delays / exceptions" value={p.delays} onChange={(v) => setPref("delays", v)} />
        <Toggle label="Promotions" value={p.promos} onChange={(v) => setPref("promos", v)} />
      </div>
    </Section>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="rounded border-slate-300" />
    </label>
  );
}

function RawJsonTab({ doc, setDoc }) {
  const [text, setText] = useState(() => JSON.stringify(doc || {}, null, 2));
  const [err, setErr] = useState("");

  useEffect(() => { setText(JSON.stringify(doc || {}, null, 2)); }, [doc]);

  function apply() {
    try {
      const parsed = JSON.parse(text);
      setDoc(parsed);
      setErr("");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }
  function pretty() {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setErr("");
    } catch (e) { setErr(String(e.message || e)); }
  }

  return (
    <Section title="Raw JSON" action={
      <div className="flex gap-2">
        <button onClick={pretty} className="text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">Format</button>
        <button onClick={apply} className="btn-blue text-xs">Apply to form</button>
      </div>
    }>
      {err && <div className="text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded mb-2">{err}</div>}
      <textarea
        className="w-full font-mono text-[12px] rounded-lg border border-slate-200 p-2"
        rows={24}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-2 text-xs text-slate-500">
        Click ‘Apply to form’ to load this JSON into all the other tabs, then ‘Save all’ in the header.
      </p>
    </Section>
  );
}

/* ============================================================
   Primitives
   ============================================================ */

function Section({ title, action, children }) {
  return (
    <section className="bg-white rounded-2xl border p-4 mb-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ msg }) {
  return <div className="text-sm text-slate-500 px-3 py-4 border rounded-lg bg-slate-50">{msg}</div>;
}

function Field({ label, value = "", onChange, type = "text", options, small }) {
  const base = "w-full rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white";
  const cls = small ? `${base} px-2 py-1 text-sm` : `${base} px-3 py-2 text-sm`;
  return (
    <label className="block">
      {label && <span className={`block ${small ? "text-[11px]" : "text-xs"} font-medium text-slate-600 mb-1`}>{label}</span>}
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          {(options || []).map((o) => (typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.v} value={o.v}>{o.t}</option>))}
        </select>
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function normalize(d) {
  const safe = { ...(d || {}) };
  safe.shipments       = Array.isArray(safe.shipments)      ? safe.shipments      : [];
  safe.addresses       = Array.isArray(safe.addresses)      ? safe.addresses      : [];
  safe.paymentMethods  = Array.isArray(safe.paymentMethods) ? safe.paymentMethods : [];
  safe.pickups         = Array.isArray(safe.pickups)        ? safe.pickups        : [];
  safe.quotes          = Array.isArray(safe.quotes)         ? safe.quotes         : [];
  safe.supportTickets  = Array.isArray(safe.supportTickets) ? safe.supportTickets : [];
  safe.notificationPrefs = safe.notificationPrefs || {};
  safe.profile         = safe.profile || {};
  safe.billing         = safe.billing || { currency: "EUR", totalSpend: 0, deliveredCount: 0, inTransitCount: 0, exceptionCount: 0, walletBalance: 0, byMonth: [] };
  if (!Array.isArray(safe.billing.byMonth)) safe.billing.byMonth = [];
  if (!Array.isArray(safe.roles)) safe.roles = [];
  return safe;
}

/* Inject lightweight button utility classes in case the app stylesheet
   doesn't define them. */
const _utilCss = `
.btn-blue { display:inline-flex; align-items:center; gap:.4rem; padding:.4rem .7rem; border-radius:.6rem; background:#3b82f6; color:white; font-weight:600; }
.btn-blue:hover { background:#2563eb; }
`;
if (typeof document !== "undefined" && !document.getElementById("admin-user-editor-utils")) {
  const s = document.createElement("style");
  s.id = "admin-user-editor-utils";
  s.textContent = _utilCss;
  document.head.appendChild(s);
}
