// src/pages/CourierDashboard.jsx
//
// Full sidebar-based shipping dashboard.
// Sections:
//   1. Overview
//   2. My Shipments
//   3. Create Shipment (links to /services/express?type=parcel#quote)
//   4. Address Book
//   5. Tracking Center
//   6. Wallet / Payments
//   7. Quotes
//   8. Pickup Requests
//   9. Support / Claims
//  10. Profile & Notifications
//
// Data is loaded once from GET /api/users/me/details and mutations call
// the dedicated /api/users/me/* endpoints (see utils/api.js -> userDetails).
//

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Logo from "../assets/envoy.png";
import { useAuth } from "../auth/AuthContext";
import {
  shipments as ShipAPI,
  userDetails as UserDetailsAPI,
} from "../utils/api";

/* ============================================================
   Section keys (used by sidebar + main panel)
   ============================================================ */
const SECTIONS = [
  { key: "overview",   label: "Overview",         icon: "📊" },
  { key: "shipments",  label: "My Shipments",     icon: "📦" },
  { key: "create",     label: "Create Shipment",  icon: "✚" },
  { key: "tracking",   label: "Tracking Center",  icon: "🛰" },
  { key: "addresses",  label: "Address Book",     icon: "🏠" },
  { key: "pickups",    label: "Pickup Requests",  icon: "🚚" },
  { key: "payments",   label: "Wallet & Payments", icon: "💳" },
  { key: "quotes",     label: "Quotes",           icon: "📋" },
  { key: "support",    label: "Support",          icon: "💬" },
  { key: "profile",    label: "Profile",          icon: "⚙" },
];

export default function CourierDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  /* read ?section=foo + ?userId override */
  const params = new URLSearchParams(location.search);
  const initialSection =
    SECTIONS.find((s) => s.key === params.get("section"))?.key || "overview";
  const overrideUserId = params.get("userId");
  const isAdminView = params.get("mode") === "admin";

  const [section, setSection] = useState(initialSection);
  function goSection(key) {
    setSection(key);
    const sp = new URLSearchParams(location.search);
    sp.set("section", key);
    navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
  }

  /* ---------- Data ---------- */
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Optional list of canonical shipments (in addition to embedded ones)
  const [serverShipments, setServerShipments] = useState([]);

  async function reloadDetails() {
    try {
      setErr("");
      const d = await UserDetailsAPI.get();
      setDetails(d || emptyDashboard());
    } catch (e) {
      console.warn("[dashboard] /users/me/details failed:", e);
      // fall back to empty so the UI still renders
      setDetails(emptyDashboard());
      if (e?.status !== 404) {
        setErr(e?.data?.message || e?.message || "");
      }
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await reloadDetails();

      try {
        const list = await ShipAPI.listMine();
        if (mounted) setServerShipments(Array.isArray(list) ? list : []);
      } catch {
        if (mounted) setServerShipments([]);
      }

      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Toast ---------- */
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Display name ---------- */
  const displayName =
    details?.displayName ||
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.email ? user.email.split("@")[0] : "Customer");
  const displayEmail = details?.email || user?.email || "you@company.com";

  /* ---------- Merged shipments (embedded + canonical) ---------- */
  const allShipments = useMemo(() => {
    const embedded = (details?.shipments || []).map((s) => ({
      _kind: "embedded",
      tracking: s.trackingNumber,
      service: s.service || "Standard",
      status: s.status || "Created",
      from: s.from || "—",
      to: s.to || "—",
      toName: s.toName || "",
      pieces: Number(s.pieces || 1),
      weight: Number(s.weightKg || 0),
      price: Number(s.price || 0),
      currency: s.currency || "EUR",
      date: s.createdAt,
    }));
    const canonical = serverShipments.map((s) => ({
      _kind: "server",
      _id: s._id,
      tracking: s.trackingNumber,
      service:
        s.serviceType === "freight"
          ? "Freight"
          : (s.parcel?.level || "standard").replace(/^\w/, (c) => c.toUpperCase()),
      status: toTitleStatus(s.status),
      from: s.from || "—",
      to: s.to || "—",
      toName: s.recipientEmail ? s.recipientEmail.split("@")[0] : "",
      pieces: s.serviceType === "freight" ? s.freight?.pallets || 1 : 1,
      weight: s.serviceType === "freight" ? s.freight?.weight || 0 : s.parcel?.weight || 0,
      price: Number(s.price || 0),
      currency: s.currency || "EUR",
      date: s.createdAt,
    }));
    // de-dup by tracking
    const seen = new Set();
    return [...embedded, ...canonical].filter((s) => {
      if (!s.tracking) return true;
      if (seen.has(s.tracking)) return false;
      seen.add(s.tracking);
      return true;
    });
  }, [details, serverShipments]);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/40 via-white to-slate-50">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={Logo} alt="Envoy" className="h-9 w-auto object-contain" />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/services/express?type=parcel#quote"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 active:scale-[0.98]"
              >
                + New Shipment
              </Link>
              <button
                onClick={() => { logout(); navigate("/"); }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Logout
              </button>
              <ProfilePill name={displayName} email={displayEmail} />
              {isAdminView && overrideUserId && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  viewing as {overrideUserId.slice(0, 6)}…
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 self-start">
          <nav className="rounded-2xl border bg-white p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => goSection(s.key)}
                className={`whitespace-nowrap text-left px-3 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                  section === s.key
                    ? "bg-blue-500 text-white"
                    : "text-slate-700 hover:bg-blue-50"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="hidden lg:block mt-3 text-xs text-slate-500 px-2">
            {loading ? "Loading…" : err ? <span className="text-rose-600">{err}</span> : "All systems normal."}
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-6 min-w-0">
          {section === "overview"  && <OverviewSection details={details} shipments={allShipments} goSection={goSection} />}
          {section === "shipments" && <ShipmentsSection shipments={allShipments} />}
          {section === "create"    && <CreateShipmentSection />}
          {section === "tracking"  && <TrackingSection shipments={allShipments} />}
          {section === "addresses" && <AddressBookSection details={details} reload={reloadDetails} setToast={setToast} />}
          {section === "pickups"   && <PickupsSection details={details} reload={reloadDetails} setToast={setToast} />}
          {section === "payments"  && <PaymentsSection details={details} reload={reloadDetails} setToast={setToast} />}
          {section === "quotes"    && <QuotesSection details={details} reload={reloadDetails} setToast={setToast} />}
          {section === "support"   && <SupportSection details={details} reload={reloadDetails} setToast={setToast} />}
          {section === "profile"   && <ProfileSection details={details} reload={reloadDetails} setToast={setToast} user={user} />}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*                          1. OVERVIEW                                       */
/* ========================================================================== */
function OverviewSection({ details, shipments, goSection }) {
  const billing = details?.billing || {};
  const active = shipments.filter((s) => ["Created", "Picked Up", "In Transit", "Out for Delivery"].includes(s.status)).length;
  const delivered = shipments.filter((s) => s.status === "Delivered").length;
  const pendingPickups = (details?.pickups || []).filter((p) => p.status === "Requested" || p.status === "Scheduled").length;
  const totalSpend = Number(billing.totalSpend || 0);
  const wallet = Number(billing.walletBalance || 0);

  const latest = shipments[0];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-blue-400 text-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {details?.displayName || "there"} 👋</h1>
            <p className="mt-1 text-white/85 text-sm">
              Now shipping is easier, faster, cheaper, and trackable from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/services/express?type=parcel#quote" className="px-3 py-2 rounded-xl bg-white text-blue-600 text-sm font-semibold hover:bg-white/90">+ Create Shipment</Link>
            <button onClick={() => goSection("tracking")} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Track</button>
            <button onClick={() => goSection("pickups")} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Request Pickup</button>
            <button onClick={() => goSection("quotes")} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Get Quote</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Active shipments" value={active} hint="In motion right now" />
        <KpiCard label="Delivered" value={delivered} hint="All-time" />
        <KpiCard label="Pending pickups" value={pendingPickups} hint="Scheduled or requested" />
        <KpiCard label="Total spent" value={`€${formatMoney(totalSpend)}`} hint="All-time" />
        <KpiCard label="Wallet balance" value={`€${formatMoney(wallet)}`} hint="Available credit" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Latest shipment</h3>
            <button onClick={() => goSection("shipments")} className="text-sm text-blue-500 hover:underline">View all</button>
          </div>
          {latest ? (
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-slate-500">{latest.tracking}</div>
                <div className="font-semibold">{latest.from} → {latest.to}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {latest.pieces} pc • {latest.weight} kg • €{formatMoney(latest.price)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={latest.status} />
                <div className="text-xs text-slate-500">{formatDate(latest.date)}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No shipments yet. Create your first one to see it here.</div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold mb-3">Why an account is worth it</h3>
          <ul className="text-sm text-slate-700 space-y-2">
            <li>✓ Saved sender/receiver details</li>
            <li>✓ Shipment history & receipts</li>
            <li>✓ Faster repeat bookings</li>
            <li>✓ All tracking in one place</li>
            <li>✓ Registered-user discounts</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*                          2. MY SHIPMENTS                                   */
/* ========================================================================== */
function ShipmentsSection({ shipments }) {
  const [q, setQ] = useState("");
  const [fService, setFService] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (fService !== "all" && s.service !== fService) return false;
      if (fStatus !== "all" && s.status !== fStatus) return false;
      if (q) {
        const t = q.toLowerCase();
        const blob = `${s.tracking} ${s.to} ${s.toName} ${s.from} ${s.service}`.toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [shipments, fService, fStatus, q]);

  function exportCSV() {
    const headers = ["Date", "Tracking", "Service", "Status", "From", "To", "Recipient", "Pieces", "Weight(kg)", "Cost"];
    const rows = filtered.map((s) => [s.date, s.tracking, s.service, s.status, s.from, s.to, s.toName || "", s.pieces, s.weight, s.price]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipments_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <SectionHeader
        title="My Shipments"
        sub="Every parcel you've sent — searchable, exportable, repeatable."
        action={
          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn-secondary">Export CSV</button>
            <Link to="/services/express?type=parcel#quote" className="btn-primary">+ New</Link>
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-3 mt-3">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tracking, recipient, destination…" />
        <Select label="Service" value={fService} onChange={(e) => setFService(e.target.value)}
          options={[{ v: "all", t: "All services" }, "Standard", "Express", "Priority", "Freight"].map((x) => typeof x === "string" ? { v: x, t: x } : x)} />
        <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}
          options={[{ v: "all", t: "All statuses" }, "Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Exception", "Cancelled"].map((x) => typeof x === "string" ? { v: x, t: x } : x)} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-white text-slate-700">
            <tr>
              <Th>Date</Th><Th>Tracking</Th><Th>Service</Th><Th>Status</Th><Th>To</Th>
              <Th>Pcs</Th><Th>Weight</Th><Th>Cost</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((s, i) => (
              <Tr key={`${s.tracking}-${i}`}>
                <Td>{formatDate(s.date)}</Td>
                <Td>
                  <div className="font-medium">{s.tracking}</div>
                  <div className="text-xs text-slate-500">{s.from} → {s.to}</div>
                </Td>
                <Td><Tag color="blue">{s.service}</Tag></Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td>
                  <div className="font-medium">{s.toName || "-"}</div>
                  <div className="text-xs text-slate-500">{s.to}</div>
                </Td>
                <Td>{s.pieces}</Td>
                <Td>{s.weight} kg</Td>
                <Td>€{formatMoney(s.price)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Link to={`/services/express?type=parcel#quote`} className="btn-ghost text-xs" title="Send again">↻ Send again</Link>
                    <Link to={`/track?tn=${encodeURIComponent(s.tracking || "")}`} className="btn-ghost text-xs">Track</Link>
                  </div>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No shipments match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*                          3. CREATE SHIPMENT                                */
/* ========================================================================== */
function CreateShipmentSection() {
  return (
    <section>
      <SectionHeader title="Create Shipment" sub="Pick a flow — your saved details auto-fill." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
        <CreateCard
          title="Express parcel"
          desc="Single parcel, fastest route. Best for documents, samples, ecommerce orders."
          to="/services/express?type=parcel#quote"
          color="from-blue-500 to-blue-400"
        />
        <CreateCard
          title="Freight"
          desc="Pallet-based shipments. Air, sea, or road. Ideal for B2B."
          to="/services/freight"
          color="from-slate-700 to-slate-600"
        />
        <CreateCard
          title="Domestic"
          desc="Same-day or next-day inside one country. Faster cut-off times."
          to="/services/domestic"
          color="from-emerald-500 to-emerald-400"
        />
        <CreateCard
          title="E-commerce"
          desc="Connect your store. Bulk labels, returns, tracking."
          to="/services/ecommerce"
          color="from-violet-500 to-violet-400"
        />
        <CreateCard
          title="Customs"
          desc="Cross-border? Get duties handled. Customs clearance in 30+ countries."
          to="/services/customs"
          color="from-amber-500 to-amber-400"
        />
        <CreateCard
          title="Warehousing"
          desc="Store, pick, pack and ship from our facilities."
          to="/services/warehousing"
          color="from-rose-500 to-rose-400"
        />
      </div>
    </section>
  );
}

function CreateCard({ title, desc, to, color }) {
  return (
    <Link to={to} className="block group rounded-2xl border bg-white p-5 hover:shadow-md transition">
      <div className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${color}`}>
        {title}
      </div>
      <p className="mt-3 text-sm text-slate-700">{desc}</p>
      <div className="mt-3 text-sm font-semibold text-blue-500 group-hover:underline">Start →</div>
    </Link>
  );
}

/* ========================================================================== */
/*                          4. TRACKING CENTER                                */
/* ========================================================================== */
function TrackingSection({ shipments }) {
  const [tn, setTn] = useState("");
  const navigate = useNavigate();

  const active = shipments.filter((s) => ["Created", "Picked Up", "In Transit", "Out for Delivery"].includes(s.status));

  return (
    <section>
      <SectionHeader title="Tracking Center" sub="All your active parcels in one place." />

      <div className="mt-3 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <Input label="Track a single parcel" value={tn} onChange={(e) => setTn(e.target.value)} placeholder="Enter tracking number" />
          </div>
          <button
            className="btn-primary"
            onClick={() => tn.trim() && navigate(`/track?tn=${encodeURIComponent(tn.trim())}`)}
          >
            Track
          </button>
        </div>
      </div>

      <h3 className="mt-6 font-semibold">Active shipments ({active.length})</h3>
      <div className="mt-3 grid gap-3">
        {active.length === 0 && <div className="text-sm text-slate-500">Nothing in motion right now.</div>}
        {active.map((s, i) => (
          <div key={`${s.tracking}-${i}`} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-slate-500">{s.tracking}</div>
                <div className="font-semibold">{s.from} → {s.to}</div>
                <div className="text-xs text-slate-500">{s.service} • {s.pieces} pc • {s.weight} kg</div>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <Timeline status={s.status} />
            <div className="mt-3">
              <Link to={`/track?tn=${encodeURIComponent(s.tracking || "")}`} className="text-sm font-semibold text-blue-500 hover:underline">
                Open full tracking →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline({ status }) {
  const steps = ["Created", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];
  const i = Math.max(0, steps.indexOf(status));
  return (
    <div className="mt-3">
      <div className="flex items-center">
        {steps.map((s, idx) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-3 h-3 rounded-full ${idx <= i ? "bg-blue-500" : "bg-slate-300"}`} />
              <div className={`mt-1 text-[10px] font-medium ${idx <= i ? "text-slate-900" : "text-slate-400"}`}>{s}</div>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${idx < i ? "bg-blue-500" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          5. ADDRESS BOOK                                   */
/* ========================================================================== */
function AddressBookSection({ details, reload, setToast }) {
  const addresses = details?.addresses || [];
  const [editing, setEditing] = useState(null); // index or "new" or null
  const empty = { label: "", name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "", phone: "", isDefault: false };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function startNew() { setEditing("new"); setForm(empty); }
  function startEdit(i) { setEditing(i); setForm({ ...empty, ...addresses[i] }); }
  function cancel() { setEditing(null); setForm(empty); }

  async function save(e) {
    e.preventDefault();
    if (!form.line1 || !form.city || !form.country) {
      setToast("Address line 1, city and country are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await UserDetailsAPI.addAddress(form);
        setToast("Address saved.");
      } else {
        await UserDetailsAPI.updateAddress(editing, form);
        setToast("Address updated.");
      }
      cancel();
      await reload();
    } catch (e) {
      setToast(e?.data?.message || e?.message || "Failed.");
    } finally { setSaving(false); }
  }

  async function remove(i) {
    if (!confirm("Remove this address?")) return;
    try {
      await UserDetailsAPI.deleteAddress(i);
      setToast("Removed.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  return (
    <section>
      <SectionHeader
        title="Address Book"
        sub="Save senders, recipients, warehouses — book without re-typing."
        action={<button className="btn-primary" onClick={startNew}>+ Add address</button>}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        {addresses.map((a, i) => (
          <div key={i} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{a.label || a.name || "Address"}</div>
              {a.isDefault && <Tag color="blue">Default</Tag>}
            </div>
            <div className="mt-1 text-sm text-slate-700">{a.name}</div>
            <div className="mt-1 text-sm text-slate-700">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
            <div className="text-sm text-slate-700">{[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}</div>
            <div className="text-sm text-slate-700">{a.country}</div>
            {a.phone && <div className="text-xs text-slate-500 mt-1">📞 {a.phone}</div>}
            <div className="mt-3 flex gap-2">
              <Link to="/services/express?type=parcel#quote" className="btn-ghost text-xs">Send parcel here</Link>
              <button onClick={() => startEdit(i)} className="btn-ghost text-xs">Edit</button>
              <button onClick={() => remove(i)} className="btn-ghost text-xs text-rose-600">Delete</button>
            </div>
          </div>
        ))}
        {addresses.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3 text-center">
            No saved addresses yet. Add one to ship faster next time.
          </div>
        )}
      </div>

      {editing !== null && (
        <Modal title={editing === "new" ? "Add address" : "Edit address"} onClose={cancel}>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={save}>
            <Input label="Label (HQ, Warehouse…)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <Input label="Contact name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="sm:col-span-2"><Input label="Line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required /></div>
            <div className="sm:col-span-2"><Input label="Line 2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></div>
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            <Input label="State / Region" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input label="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Default address
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={cancel} className="btn-ghost">Cancel</button>
              <button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/* ========================================================================== */
/*                          6. PICKUPS                                        */
/* ========================================================================== */
function PickupsSection({ details, reload, setToast }) {
  const pickups = details?.pickups || [];
  const addresses = details?.addresses || [];
  const [open, setOpen] = useState(false);
  const empty = { date: "", window: "13:00–17:00", addressText: "", recurring: false, frequency: "WEEKLY", instructions: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.date) { setToast("Pick a date."); return; }
    setSaving(true);
    try {
      await UserDetailsAPI.addPickup(form);
      setOpen(false); setForm(empty);
      setToast("Pickup requested.");
      await reload();
    } catch (e) {
      setToast(e?.data?.message || e?.message || "Failed.");
    } finally { setSaving(false); }
  }

  async function cancelPickup(i) {
    if (!confirm("Cancel this pickup?")) return;
    try {
      await UserDetailsAPI.deletePickup(i);
      setToast("Pickup cancelled.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  return (
    <section>
      <SectionHeader
        title="Pickup Requests"
        sub="Book a courier pickup — once or recurring."
        action={<button onClick={() => setOpen(true)} className="btn-primary">+ Request pickup</button>}
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-white">
            <tr>
              <Th>ID</Th><Th>Date</Th><Th>Window</Th><Th>Address</Th><Th>Recurring</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pickups.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No pickups yet. Click “Request pickup”.</td></tr>
            )}
            {pickups.map((p, i) => (
              <Tr key={p.publicId || i}>
                <Td>{p.publicId || "—"}</Td>
                <Td>{formatDate(p.date)}</Td>
                <Td>{p.window}</Td>
                <Td className="max-w-[260px] truncate">{p.addressText || "—"}</Td>
                <Td>{p.recurring ? p.frequency : "No"}</Td>
                <Td><StatusBadge status={p.status || "Requested"} /></Td>
                <Td>
                  {p.status !== "Cancelled" && p.status !== "Completed" && (
                    <button onClick={() => cancelPickup(i)} className="btn-ghost text-xs text-rose-600">Cancel</button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="Request a pickup" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <Select label="Time window" value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })}
              options={[{ v: "09:00–13:00", t: "09:00–13:00" }, { v: "13:00–17:00", t: "13:00–17:00" }, { v: "17:00–20:00", t: "17:00–20:00" }]} />
            <Select label="Pickup address" value={form.addressText} onChange={(e) => setForm({ ...form, addressText: e.target.value })}
              options={[{ v: "", t: "Pick a saved address or type below" }, ...addresses.map((a) => ({ v: `${a.label || a.name || "Address"} — ${[a.line1, a.city].filter(Boolean).join(", ")}`, t: `${a.label || a.name || "Address"} — ${[a.line1, a.city].filter(Boolean).join(", ")}` }))]} />
            <Input label="Or type address" value={form.addressText} onChange={(e) => setForm({ ...form, addressText: e.target.value })} placeholder="22 Bishopsgate, London" />
            <Textarea label="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Gate code, loading dock, contact name…" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
              Recurring pickup
              {form.recurring && (
                <select className="ml-2 rounded-lg border px-2 py-1 text-sm" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                </select>
              )}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              <button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Submit request"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/* ========================================================================== */
/*                          7. PAYMENTS / WALLET                              */
/* ========================================================================== */
function PaymentsSection({ details, reload, setToast }) {
  const cards = details?.paymentMethods || [];
  const billing = details?.billing || {};
  const [open, setOpen] = useState(false);
  const empty = { label: "", brand: "visa", last4: "", expMonth: "", expYear: "", default: false };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function addCard(e) {
    e.preventDefault();
    if (!form.last4 || !form.expMonth || !form.expYear) { setToast("Fill in card last 4 + expiry."); return; }
    setSaving(true);
    try {
      await UserDetailsAPI.addPayment({ ...form, expMonth: Number(form.expMonth), expYear: Number(form.expYear) });
      setOpen(false); setForm(empty);
      setToast("Card added.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
    finally { setSaving(false); }
  }

  async function remove(i) {
    if (!confirm("Remove this card?")) return;
    try {
      await UserDetailsAPI.deletePayment(i);
      setToast("Removed.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  return (
    <section>
      <SectionHeader title="Wallet & Payments" sub="Wallet balance, saved cards, recent statements." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 text-white p-5">
          <div className="text-sm text-white/80">Wallet balance</div>
          <div className="mt-1 text-3xl font-bold">€{formatMoney(billing.walletBalance || 0)}</div>
          <button onClick={() => setToast("Wallet top-up coming soon.")} className="mt-3 px-3 py-1.5 rounded-xl bg-white text-blue-600 text-xs font-semibold">Fund wallet</button>
        </div>
        <KpiCard label="Total spend" value={`€${formatMoney(billing.totalSpend || 0)}`} hint="All-time" />
        <KpiCard label="Delivered" value={billing.deliveredCount || 0} hint="Shipments" />
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5">
        <h3 className="font-semibold">Last 6 months spend</h3>
        <MiniBarChart series={(billing.byMonth || []).map((m) => m.sum || 0)} labels={(billing.byMonth || []).map((m) => m.ym || "")} />
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Saved cards</h3>
            <button onClick={() => setOpen(true)} className="btn-secondary text-xs">+ Add card</button>
          </div>
          <ul className="mt-3 space-y-2">
            {cards.length === 0 && <li className="text-sm text-slate-500">No cards saved.</li>}
            {cards.map((p, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <div className="font-medium">{(p.brand || "Card").toUpperCase()} •••• {p.last4}</div>
                  <div className="text-xs text-slate-500">Exp {String(p.expMonth || "").padStart(2, "0")}/{String(p.expYear || "")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.default && <Tag color="blue">Default</Tag>}
                  <button onClick={() => remove(i)} className="btn-ghost text-xs text-rose-600">Remove</button>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-slate-500">
            Nigerian users: Paystack and bank transfer also supported at checkout. Pay-on-pickup available where allowed.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <h3 className="font-semibold">Statements</h3>
          <table className="min-w-full text-sm mt-3">
            <thead className="text-slate-700"><tr><Th>Month</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y">
              {(billing.byMonth || []).map((m) => (
                <tr key={m.ym}><Td>{m.ym}</Td><Td>€{formatMoney(m.sum || 0)}</Td><Td><StatusBadge status="Posted" /></Td></tr>
              ))}
              {(!billing.byMonth || billing.byMonth.length === 0) && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No statements yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title="Add card" onClose={() => setOpen(false)}>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={addCard}>
            <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Corporate Visa" />
            <Select label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
              options={["visa", "mastercard", "amex", "verve", "discover"].map((x) => ({ v: x, t: x }))} />
            <Input label="Last 4 digits" value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} required />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Exp month (MM)" value={form.expMonth} onChange={(e) => setForm({ ...form, expMonth: e.target.value })} placeholder="12" />
              <Input label="Exp year (YYYY)" value={form.expYear} onChange={(e) => setForm({ ...form, expYear: e.target.value })} placeholder="2027" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.default} onChange={(e) => setForm({ ...form, default: e.target.checked })} /> Make default
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              <button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Add card"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/* ========================================================================== */
/*                          8. QUOTES                                         */
/* ========================================================================== */
function QuotesSection({ details, reload, setToast }) {
  const quotes = details?.quotes || [];
  const [open, setOpen] = useState(false);
  const empty = { from: "", to: "", service: "Standard", weightKg: "", pieces: 1, price: "", currency: "EUR", notes: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await UserDetailsAPI.addQuote({
        ...form,
        weightKg: Number(form.weightKg || 0),
        pieces: Number(form.pieces || 1),
        price: Number(form.price || 0),
      });
      setOpen(false); setForm(empty);
      setToast("Quote saved.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
    finally { setSaving(false); }
  }

  async function remove(i) {
    if (!confirm("Delete this quote?")) return;
    try {
      await UserDetailsAPI.deleteQuote(i);
      setToast("Deleted.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  return (
    <section>
      <SectionHeader
        title="Saved Quotes"
        sub="Save quotes before paying. Compare prices, convert when ready."
        action={<button onClick={() => setOpen(true)} className="btn-primary">+ Save a quote</button>}
      />

      <div className="mt-3 grid gap-3">
        {quotes.length === 0 && <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">No saved quotes yet.</div>}
        {quotes.map((q, i) => (
          <div key={q.publicId || i} className="rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-4 justify-between">
            <div>
              <div className="text-xs text-slate-500">{q.publicId}</div>
              <div className="font-semibold">{q.from} → {q.to}</div>
              <div className="text-xs text-slate-500">{q.service} • {q.pieces} pc • {q.weightKg} kg</div>
              {q.notes && <div className="text-xs text-slate-500 mt-1">📝 {q.notes}</div>}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">€{formatMoney(q.price || 0)}</div>
              <div className="text-xs text-slate-500">Expires {formatDate(q.expiresAt)}</div>
              <div className="mt-2 flex gap-1 justify-end">
                <Link to="/services/express?type=parcel#quote" className="btn-ghost text-xs">Convert →</Link>
                <button onClick={() => remove(i)} className="btn-ghost text-xs text-rose-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title="Save a quote" onClose={() => setOpen(false)}>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={save}>
            <Input label="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="Lagos, Nigeria" />
            <Input label="To" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="London, UK" />
            <Select label="Service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}
              options={["Standard", "Express", "Priority", "Freight"].map((x) => ({ v: x, t: x }))} />
            <Input label="Weight (kg)" type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            <Input label="Pieces" type="number" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} />
            <Input label="Quoted price (EUR)" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <div className="sm:col-span-2"><Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              <button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save quote"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/* ========================================================================== */
/*                          9. SUPPORT / CLAIMS                               */
/* ========================================================================== */
function SupportSection({ details, reload, setToast }) {
  const tickets = details?.supportTickets || [];
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);
  const empty = { subject: "", category: "general", relatedTracking: "", message: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!form.subject || !form.message) { setToast("Fill in subject and message."); return; }
    setSaving(true);
    try {
      await UserDetailsAPI.openTicket(form);
      setOpen(false); setForm(empty);
      setToast("Ticket opened.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
    finally { setSaving(false); }
  }

  async function sendReply(i) {
    if (!reply.trim()) return;
    try {
      await UserDetailsAPI.replyTicket(i, reply.trim());
      setReply("");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  async function closeTicket(i) {
    if (!confirm("Close this ticket?")) return;
    try {
      await UserDetailsAPI.closeTicket(i);
      setToast("Closed.");
      setOpenIdx(null);
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
  }

  return (
    <section>
      <SectionHeader
        title="Support & Claims"
        sub="Open a ticket for delays, lost or damaged items, payment issues, or anything else."
        action={<button onClick={() => setOpen(true)} className="btn-primary">+ New ticket</button>}
      />

      <div className="mt-3 grid gap-3">
        {tickets.length === 0 && <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">No tickets yet — that's a good thing.</div>}
        {tickets.map((t, i) => (
          <button key={t.publicId || i} onClick={() => setOpenIdx(i)} className="text-left rounded-2xl border bg-white p-4 hover:shadow-sm transition">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-slate-500">{t.publicId} • {t.category}</div>
                <div className="font-semibold">{t.subject}</div>
                {t.relatedTracking && <div className="text-xs text-slate-500 mt-0.5">Related: {t.relatedTracking}</div>}
              </div>
              <StatusBadge status={t.status === "open" ? "Open" : t.status === "resolved" ? "Resolved" : t.status === "pending" ? "Pending" : "Closed"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {t.messages?.length || 0} message{(t.messages?.length || 0) === 1 ? "" : "s"} • Opened {formatDate(t.createdAt)}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <Modal title="New support ticket" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="Short summary…" />
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[
                { v: "delayed", t: "Delayed shipment" },
                { v: "lost", t: "Lost item" },
                { v: "damaged", t: "Damaged item" },
                { v: "wrong_address", t: "Wrong address" },
                { v: "payment", t: "Payment issue" },
                { v: "refund", t: "Refund request" },
                { v: "general", t: "General question" },
              ]} />
            <Input label="Related tracking (optional)" value={form.relatedTracking} onChange={(e) => setForm({ ...form, relatedTracking: e.target.value })} />
            <Textarea label="Describe the issue" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
              <button disabled={saving} className="btn-primary">{saving ? "Submitting…" : "Submit ticket"}</button>
            </div>
          </form>
        </Modal>
      )}

      {openIdx !== null && tickets[openIdx] && (
        <Modal title={`${tickets[openIdx].publicId} — ${tickets[openIdx].subject}`} onClose={() => setOpenIdx(null)}>
          <div className="space-y-3">
            <div className="text-xs text-slate-500">
              {tickets[openIdx].category} • Opened {formatDate(tickets[openIdx].createdAt)}
            </div>
            <div className="rounded-xl border p-3 max-h-72 overflow-y-auto bg-slate-50 space-y-2">
              {(tickets[openIdx].messages || []).map((m, j) => (
                <div key={j} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === "user" ? "bg-blue-500 text-white" : "bg-white border"}`}>
                    <div className="text-[10px] uppercase font-bold mb-0.5 opacity-70">{m.sender === "user" ? "You" : "Support"}</div>
                    <div className="whitespace-pre-wrap text-[13px]">{m.text}</div>
                    <div className="text-[10px] mt-1 opacity-60">{formatDateTime(m.at)}</div>
                  </div>
                </div>
              ))}
            </div>

            {tickets[openIdx].status !== "closed" ? (
              <>
                <Textarea label="Reply" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="flex justify-between gap-2">
                  <button onClick={() => closeTicket(openIdx)} className="btn-ghost text-rose-600">Close ticket</button>
                  <button onClick={() => sendReply(openIdx)} className="btn-primary">Send reply</button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">This ticket is closed. Open a new one if needed.</div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ========================================================================== */
/*                          10. PROFILE & NOTIFICATIONS                       */
/* ========================================================================== */
function ProfileSection({ details, reload, setToast, user }) {
  const profile = details?.profile || {};
  const prefs = details?.notificationPrefs || {};
  const [form, setForm] = useState({
    displayName: details?.displayName || user?.name || "",
    phone: details?.phone || "",
    accountType: profile.accountType || "individual",
    company: profile.company || "",
    contactPerson: profile.contactPerson || "",
    businessAddress: profile.businessAddress || "",
    referral: profile.referral || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [notif, setNotif] = useState({
    email: prefs.email ?? true,
    sms: prefs.sms ?? false,
    whatsapp: prefs.whatsapp ?? false,
    pickup: prefs.pickup ?? true,
    transit: prefs.transit ?? true,
    delivered: prefs.delivered ?? true,
    delays: prefs.delays ?? true,
    promos: prefs.promos ?? false,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // sync when details reload
  useEffect(() => {
    setForm({
      displayName: details?.displayName || user?.name || "",
      phone: details?.phone || "",
      accountType: profile.accountType || "individual",
      company: profile.company || "",
      contactPerson: profile.contactPerson || "",
      businessAddress: profile.businessAddress || "",
      referral: profile.referral || "",
    });
    setNotif({
      email: prefs.email ?? true,
      sms: prefs.sms ?? false,
      whatsapp: prefs.whatsapp ?? false,
      pickup: prefs.pickup ?? true,
      transit: prefs.transit ?? true,
      delivered: prefs.delivered ?? true,
      delays: prefs.delays ?? true,
      promos: prefs.promos ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await UserDetailsAPI.saveProfile({
        displayName: form.displayName,
        phone: form.phone,
        profile: {
          accountType: form.accountType,
          company: form.company,
          contactPerson: form.contactPerson,
          businessAddress: form.businessAddress,
          referral: form.referral,
        },
      });
      setToast("Profile saved.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
    finally { setSavingProfile(false); }
  }

  async function saveNotif() {
    setSavingNotif(true);
    try {
      await UserDetailsAPI.setNotifications(notif);
      setToast("Notification preferences saved.");
      await reload();
    } catch (e) { setToast(e?.data?.message || e?.message || "Failed."); }
    finally { setSavingNotif(false); }
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Profile" sub="Your details, business info, and notification preferences." />

      {/* Profile form */}
      <form onSubmit={saveProfile} className="rounded-2xl border bg-white p-5 grid sm:grid-cols-2 gap-3">
        <Input label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email (read-only)" value={user?.email || details?.email || ""} readOnly />
        <Select label="Account type" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}
          options={[{ v: "individual", t: "Individual" }, { v: "business", t: "Business" }]} />
        {form.accountType === "business" && (
          <>
            <Input label="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input label="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            <div className="sm:col-span-2"><Input label="Business address" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} /></div>
          </>
        )}
        <Input label="Referral source" value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} />
        <div className="sm:col-span-2 flex justify-end pt-1">
          <button disabled={savingProfile} className="btn-primary">{savingProfile ? "Saving…" : "Save profile"}</button>
        </div>
      </form>

      {/* Notification prefs */}
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Notification preferences</h3>
            <p className="text-xs text-slate-500">Pick the channels and the events you want to be told about.</p>
          </div>
          <button onClick={saveNotif} disabled={savingNotif} className="btn-primary">{savingNotif ? "Saving…" : "Save"}</button>
        </div>

        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PrefBox title="Channels">
            <PrefRow label="Email" value={notif.email} onChange={(v) => setNotif({ ...notif, email: v })} />
            <PrefRow label="SMS" value={notif.sms} onChange={(v) => setNotif({ ...notif, sms: v })} />
            <PrefRow label="WhatsApp" value={notif.whatsapp} onChange={(v) => setNotif({ ...notif, whatsapp: v })} />
          </PrefBox>
          <PrefBox title="Events">
            <PrefRow label="Pickup confirmed" value={notif.pickup} onChange={(v) => setNotif({ ...notif, pickup: v })} />
            <PrefRow label="In transit" value={notif.transit} onChange={(v) => setNotif({ ...notif, transit: v })} />
            <PrefRow label="Delivered" value={notif.delivered} onChange={(v) => setNotif({ ...notif, delivered: v })} />
            <PrefRow label="Delays / exceptions" value={notif.delays} onChange={(v) => setNotif({ ...notif, delays: v })} />
          </PrefBox>
          <PrefBox title="Marketing">
            <PrefRow label="Promotions & news" value={notif.promos} onChange={(v) => setNotif({ ...notif, promos: v })} />
          </PrefBox>
          <PrefBox title="Loyalty">
            <div className="text-sm">
              <div className="text-slate-500 text-xs">Current tier</div>
              <div className="font-semibold">{profile.loyaltyTier || "Bronze"}</div>
            </div>
            <div className="mt-2 text-sm">
              <div className="text-slate-500 text-xs">Referral code</div>
              <div className="font-mono">{profile.referralCode || "—"}</div>
            </div>
          </PrefBox>
        </div>
      </div>
    </section>
  );
}

function PrefBox({ title, children }) {
  return (
    <div className="rounded-xl border p-3 bg-slate-50">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function PrefRow({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="rounded border-slate-300" />
    </label>
  );
}

/* ========================================================================== */
/*                          UI primitives                                     */
/* ========================================================================== */
function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Created":          "bg-slate-100 text-slate-700",
    "Picked Up":        "bg-blue-100 text-blue-700",
    "In Transit":       "bg-blue-100 text-blue-700",
    "Out for Delivery": "bg-indigo-100 text-indigo-700",
    "Delivered":        "bg-emerald-100 text-emerald-700",
    "Exception":        "bg-rose-100 text-rose-700",
    "Cancelled":        "bg-slate-100 text-slate-500",
    "Posted":           "bg-emerald-100 text-emerald-700",
    "Open":             "bg-amber-100 text-amber-700",
    "Pending":          "bg-amber-100 text-amber-700",
    "Resolved":         "bg-emerald-100 text-emerald-700",
    "Closed":           "bg-slate-100 text-slate-500",
    "Requested":        "bg-amber-100 text-amber-700",
    "Scheduled":        "bg-blue-100 text-blue-700",
    "In Progress":      "bg-indigo-100 text-indigo-700",
    "Completed":        "bg-emerald-100 text-emerald-700",
  };
  const cls = map[status] || "bg-slate-100 text-slate-700";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{status || "—"}</span>;
}

function Tag({ color = "slate", children }) {
  const map = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    red: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[color] || map.slate}`}>{children}</span>;
}

function Input({ label, ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>}
      <input {...rest} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
    </label>
  );
}
function Textarea({ label, ...rest }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>}
      <textarea {...rest} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 min-h-[100px]" />
    </label>
  );
}
function Select({ label, options = [], ...rest }) {
  const opts = options.map((o) => (typeof o === "string" ? { v: o, t: o } : o));
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>}
      <select {...rest} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
        {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  );
}

function Th({ children }) { return <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{children}</th>; }
function Tr({ children, ...p }) { return <tr {...p}>{children}</tr>; }
function Td({ children, ...p }) { return <td {...p} className={`px-4 py-3 text-sm ${p.className || ""}`}>{children}</td>; }

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onEsc(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ProfilePill({ name, email }) {
  const initials = (name || email || "U").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200">
      <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold grid place-items-center">{initials || "U"}</div>
      <div className="leading-tight">
        <div className="text-xs font-semibold">{name}</div>
        <div className="text-[10px] text-slate-500">{email}</div>
      </div>
    </div>
  );
}

function MiniBarChart({ series = [], labels = [] }) {
  const max = Math.max(1, ...series.map((s) => Number(s) || 0));
  return (
    <div className="mt-3">
      <div className="flex items-end gap-1 h-28">
        {series.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-300"
              style={{ height: `${Math.max(2, ((Number(s) || 0) / max) * 100)}%` }}
              title={`€${formatMoney(s)}`}
            />
            <div className="text-[10px] text-slate-500">{labels[i] || ""}</div>
          </div>
        ))}
        {series.length === 0 && <div className="text-sm text-slate-500">No data yet.</div>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*                          Helpers                                           */
/* ========================================================================== */

function emptyDashboard() {
  return {
    shipments: [], addresses: [], paymentMethods: [], pickups: [],
    quotes: [], supportTickets: [],
    notificationPrefs: { email: true, sms: false, whatsapp: false, pickup: true, transit: true, delivered: true, delays: true, promos: false },
    profile: {},
    billing: { currency: "EUR", totalSpend: 0, deliveredCount: 0, inTransitCount: 0, exceptionCount: 0, walletBalance: 0, byMonth: [] },
    adminOverlay: { active: false },
  };
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString();
  } catch { return "—"; }
}
function formatDateTime(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleString();
  } catch { return "—"; }
}
function formatMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleStatus(s) {
  return ({
    CREATED: "Created",
    PICKED_UP: "Picked Up",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    EXCEPTION: "Exception",
    CANCELLED: "Cancelled",
  }[String(s || "").toUpperCase()]) || s || "Created";
}

/* tailwind helper classes — used inline above */
/* btn-primary, btn-secondary, btn-ghost are ad-hoc utility names; we
   emulate them with concrete classes below so the page still works
   even if the project's global stylesheet doesn't define them. */
const _utilCss = `
.btn-primary { display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .9rem; border-radius:.75rem; background:#3b82f6; color:white; font-size:.875rem; font-weight:600; }
.btn-primary:hover { background:#2563eb; }
.btn-primary:disabled { background:#93c5fd; cursor:not-allowed; }
.btn-secondary { display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .9rem; border-radius:.75rem; background:white; color:#0f172a; font-size:.875rem; font-weight:600; border:1px solid #e2e8f0; }
.btn-secondary:hover { background:#f1f5f9; }
.btn-ghost { display:inline-flex; align-items:center; gap:.4rem; padding:.4rem .7rem; border-radius:.65rem; font-size:.8rem; font-weight:600; color:#0f172a; }
.btn-ghost:hover { background:#f1f5f9; }
`;
if (typeof document !== "undefined" && !document.getElementById("courier-dashboard-utils")) {
  const s = document.createElement("style");
  s.id = "courier-dashboard-utils";
  s.textContent = _utilCss;
  document.head.appendChild(s);
}
