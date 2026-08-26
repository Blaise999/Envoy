// /src/utils/api.js
//
// SUPABASE EDITION — the Express/Mongo backend is gone.
//
// Every export below has the SAME NAME and returns the SAME SHAPE as the old
// HTTP client, so the pages (AdminDashboard, CourierDashboard, TrackPage,
// BillingPage, …) did not have to change. What changed is the transport:
//
//   auth.*            -> Supabase Auth (signUp / verifyOtp / signInWithPassword)
//   shipments.*       -> RPC create_shipment / track_shipment + RLS-guarded selects
//   userDetails.*     -> public.user_details (jsonb arrays, index-addressed)
//   adminShipments.*  -> RPC admin_* + RLS-guarded selects
//   adminUsers.*      -> public.profiles + public.user_details
//   adminEmail.*      -> the `send-email` Edge Function (Resend lives there)
//   geocode.*         -> Nominatim directly (the server-side cache is gone)
//
// Row shapes are snake_case in Postgres and camelCase (+ `_id`) on the way out,
// which is what the components already expect.

import { supabase } from "../libs/supabaseClient";

/* ========================================================================== */
/* Token mirroring                                                            */
/* ========================================================================== */
// Supabase keeps its own session in localStorage, but ProtectedRoute and the
// AdminGuard both read a token synchronously, so we mirror the access token
// into the keys they already use.

const USER_TOKEN_KEY = "envoy_user_token";
const ADMIN_TOKEN_KEY = "envoy_admin_token";

export function getUserToken() {
  try { return localStorage.getItem(USER_TOKEN_KEY) || null; } catch { return null; }
}
export function setUserToken(token) {
  try {
    token ? localStorage.setItem(USER_TOKEN_KEY, token) : localStorage.removeItem(USER_TOKEN_KEY);
  } catch { /* storage blocked */ }
}
export function clearUserToken() { setUserToken(null); }

export function getAdminToken() {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY) || null; } catch { return null; }
}
export function setAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      if (!localStorage.getItem(ADMIN_TOKEN_KEY)) throw new Error("LocalStorage write failed");
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch (e) {
    console.error("[setAdminToken] persist failed:", e);
    throw e;
  }
}
export function clearAdminToken() { setAdminToken(null); }

export const getAuthToken = getUserToken;
export const setAuthToken = setUserToken;
export const clearAuthToken = clearUserToken;

export function getApiBase() {
  return import.meta.env.VITE_SUPABASE_URL || "supabase";
}

/* ========================================================================== */
/* Error normalisation                                                        */
/* ========================================================================== */
// Callers do `e?.data?.message || e?.message`, so keep both populated.

function fail(err, fallback = "Request failed") {
  const message =
    err?.message ||
    err?.error_description ||
    err?.error ||
    (typeof err === "string" ? err : "") ||
    fallback;
  const e = new Error(message);
  e.status = err?.status || err?.code || 0;
  e.data = { message };
  e.cause = err;
  return e;
}

function unwrap({ data, error }, fallback) {
  if (error) throw fail(error, fallback);
  return data;
}

/* ========================================================================== */
/* Row mappers                                                                */
/* ========================================================================== */

const arr = (v) => (Array.isArray(v) ? v : []);
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

export function shipmentToDoc(r) {
  if (!r) return null;
  return {
    _id: r.id,
    id: r.id,
    userId: r.user_id || null,
    assignedAdminId: r.assigned_admin_id || null,
    routingCode: r.routing_code || "",

    serviceType: r.service_type,
    from: r.from_location || "",
    to: r.to_location || "",

    shipperContact: r.shipper_contact || {},
    recipientContact: r.recipient_contact || {},
    shipperName: r.shipper_name || "",
    shipperEmail: r.shipper_email || "",
    shipperPhone: r.shipper_phone || "",
    recipientName: r.recipient_name || "",
    recipientPhone: r.recipient_phone || "",
    recipientEmail: r.recipient_email || "",
    recipientAddress: r.recipient_address || "",

    parcel: r.parcel || undefined,
    freight: r.freight || undefined,

    currency: r.currency || "EUR",
    listPrice: Number(r.list_price || 0),
    discountAmount: Number(r.discount_amount || 0),
    price: Number(r.price || 0),
    eta: r.eta || "",
    etaAt: r.eta_at || null,
    billable: Number(r.billable || 0),

    trackingNumber: r.tracking_number || "",
    status: r.status || "CREATED",
    lastLocation: r.last_location || "",
    timeline: arr(r.timeline),

    labelUrls: arr(r.label_urls),
    proofUrls: arr(r.proof_urls),
    goodsPhotos: arr(r.goods_photos),
    goodsPhotosMeta: arr(r.goods_photos_meta),
    goodsVideos: arr(r.goods_videos),
    goodsVideosMeta: arr(r.goods_videos_meta),

    shipmentKey: r.shipment_key || "",
    paymentMethod: r.payment_method || "",
    paymentStatus: r.payment_status || "",
    promoCode: r.promo_code || "",
    testBooking: !!r.test_booking,

    idempotencyKey: r.idempotency_key || null,
    meta: r.meta || {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function profileToUser(r) {
  if (!r) return null;
  return {
    _id: r.id,
    id: r.id,
    name: r.name || "",
    email: r.email || "",
    phone: r.phone || "",
    address: r.address || "",
    role: r.role || "user",
    adminScope: r.admin_scope || "assigned",
    isVerified: !!r.is_verified,
    lastLogin: r.last_login || null,
    meta: r.meta || {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function detailsRowToDoc(r) {
  if (!r) return null;
  return {
    user: r.user_id,
    displayName: r.display_name || "",
    email: r.email || "",
    phone: r.phone || "",
    roles: arr(r.roles),
    shipments: arr(r.shipments),
    addresses: arr(r.addresses),
    paymentMethods: arr(r.payment_methods),
    pickups: arr(r.pickups),
    quotes: arr(r.quotes),
    supportTickets: arr(r.support_tickets),
    notificationPrefs: r.notification_prefs || {},
    profile: r.profile || {},
    billing: r.billing || {},
    adminOverlay: r.admin_overlay || { active: false },
    meta: r.meta || { source: "user" },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const DETAILS_COLUMNS = {
  displayName: "display_name",
  email: "email",
  phone: "phone",
  roles: "roles",
  shipments: "shipments",
  addresses: "addresses",
  paymentMethods: "payment_methods",
  pickups: "pickups",
  quotes: "quotes",
  supportTickets: "support_tickets",
  notificationPrefs: "notification_prefs",
  profile: "profile",
  billing: "billing",
  adminOverlay: "admin_overlay",
  meta: "meta",
};

/* ========================================================================== */
/* Billing / dashboard view (ported from userDetails.model.js)                 */
/* ========================================================================== */

function ymKey(date) {
  const d = new Date(date || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function computeBilling(list, currency = "EUR", monthsBack = 6, walletBalance = 0) {
  const rows = arr(list);
  const now = new Date();
  const keys = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    keys.push(ymKey(d));
  }
  const sums = Object.fromEntries(keys.map((k) => [k, 0]));
  let total = 0;
  for (const s of rows) {
    const price = Number(s?.price) || 0;
    total += price;
    const k = ymKey(s?.createdAt);
    if (k in sums) sums[k] += price;
  }

  return {
    currency,
    totalSpend: round2(total),
    deliveredCount: rows.filter((s) => s?.status === "Delivered").length,
    inTransitCount: rows.filter((s) => s?.status === "In Transit").length,
    exceptionCount: rows.filter((s) => s?.status === "Exception").length,
    byMonth: keys.map((k) => ({ ym: k, sum: round2(sums[k]) })),
    lastComputedAt: new Date().toISOString(),
    walletBalance: round2(walletBalance),
  };
}

const STATUS_TO_LABEL = {
  CREATED: "Created",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  CANCELLED: "Cancelled",
};

/** Real shipment rows -> the denormalised "ShipmentLite" rows the dashboard renders. */
function shipmentsToLite(rows, currency = "EUR") {
  return arr(rows).map((s) => ({
    trackingNumber: s.tracking_number,
    service: s.service_type === "freight" ? "Freight" : cap(s.parcel?.level || "standard"),
    serviceType: s.service_type || "parcel",
    status: STATUS_TO_LABEL[String(s.status || "").toUpperCase()] || "Created",
    from: s.from_location || "—",
    to: s.to_location || "—",
    toName: s.recipient_name || (s.recipient_email ? String(s.recipient_email).split("@")[0] : ""),
    pieces: s.service_type === "freight" ? Number(s.freight?.pallets || 1) : 1,
    weightKg:
      s.service_type === "freight"
        ? Number(s.freight?.weight || 0)
        : Number(s.parcel?.weight || 0),
    price: Number(s.price || 0),
    currency: s.currency || currency,
    shipmentRef: s.id,
    createdAt: s.created_at,
  }));
}

/** Port of UserDetails.toDashboardView() — real data wins, overlay fills gaps. */
export function toDashboardView(doc) {
  if (!doc) return null;
  const overlay = doc.adminOverlay || {};
  const useOverlay = !!overlay.active;
  const snap = overlay.bundleSnapshot || {};

  const pick = (real, fallbackArr) =>
    arr(real).length ? arr(real) : useOverlay ? arr(fallbackArr) : [];

  const base = doc.billing || {};
  const nums = useOverlay ? overlay.numbers || {} : {};

  return {
    user: doc.user,
    displayName: doc.displayName,
    email: doc.email,
    phone: doc.phone,
    roles: doc.roles,

    shipments: pick(doc.shipments, snap.shipments),
    addresses: pick(doc.addresses, snap.addresses),
    paymentMethods: pick(doc.paymentMethods, snap.paymentMethods),
    pickups: pick(doc.pickups, snap.pickups),
    quotes: arr(doc.quotes),
    supportTickets: arr(doc.supportTickets),
    notificationPrefs: doc.notificationPrefs || {},
    profile: doc.profile || {},

    billing: {
      currency: base.currency || "EUR",
      totalSpend: Number(nums.totalSpend ?? base.totalSpend ?? 0),
      deliveredCount: Number(nums.deliveredCount ?? base.deliveredCount ?? 0),
      inTransitCount: Number(nums.inTransitCount ?? base.inTransitCount ?? 0),
      exceptionCount: Number(nums.exceptionCount ?? base.exceptionCount ?? 0),
      walletBalance: Number(nums.walletBalance ?? base.walletBalance ?? 0),
      byMonth: arr(base.byMonth),
      lastComputedAt: base.lastComputedAt || new Date().toISOString(),
    },

    adminOverlay: {
      active: useOverlay,
      appliedBy: overlay.appliedBy || null,
      appliedAt: overlay.appliedAt || null,
      text: overlay.text || {},
    },
    meta: doc.meta || { source: "user" },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ========================================================================== */
/* Session helpers                                                            */
/* ========================================================================== */

async function requireUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw fail({ message: "Not signed in", status: 401 });
  return id;
}

async function currentProfile() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return data || null;
}

/** Ensure the user_details row exists, then return it. */
async function loadOwnDetailsRow() {
  const uid = await requireUserId();

  const found = await supabase.from("user_details").select("*").eq("user_id", uid).maybeSingle();
  if (found.error) throw fail(found.error, "Failed to load your dashboard");
  if (found.data) return found.data;

  const { data: sess } = await supabase.auth.getSession();
  const u = sess?.session?.user;

  const created = await supabase
    .from("user_details")
    .insert({
      user_id: uid,
      display_name: u?.user_metadata?.name || "",
      email: u?.email || null,
      phone: u?.user_metadata?.phone || "",
    })
    .select("*")
    .single();

  return unwrap(created, "Failed to create your dashboard record");
}

/** Read-modify-write one jsonb array column on the caller's own row. */
async function mutateOwnArray(key, mutator) {
  const row = await loadOwnDetailsRow();
  const column = DETAILS_COLUMNS[key];
  const next = mutator(arr(row[column]));

  const updated = await supabase
    .from("user_details")
    .update({ [column]: next })
    .eq("user_id", row.user_id)
    .select("*")
    .single();

  return detailsRowToDoc(unwrap(updated, `Failed to save ${key}`))[key];
}

/* ========================================================================== */
/* Public / User auth                                                         */
/* ========================================================================== */

/**
 * Auth.
 *
 * Supabase Auth holds identity (so auth.uid() and every RLS policy keep
 * working) but sends NO email. "Confirm email" is off in the project settings;
 * codes are issued, stored hashed and emailed by the `otp` Edge Function
 * through Resend, from your own address.
 */
async function callOtp(body) {
  const { data, error } = await supabase.functions.invoke("otp", { body });
  if (error) {
    let detail = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) detail = parsed.error;
    } catch { /* keep the generic message */ }
    throw fail({ message: detail }, "Could not send the code");
  }
  if (data?.error) throw fail({ message: data.error }, "Could not send the code");
  return data || {};
}

export const auth = {
  /**
   * Creates the account, then emails OUR code. Supabase confirms the address
   * itself (confirmations are off), so `profiles.is_verified` is what actually
   * records that the person proved they own the inbox.
   */
  async register({ name, email, password, phone }) {
    const addr = String(email || "").trim();

    // Account creation goes through our own function, which uses the admin API
    // with email_confirm already set. Supabase's mailer is never invoked, so
    // this can't hit "email rate limit exceeded" — and it doesn't matter what
    // the Confirm email toggle in the dashboard is set to.
    const res = await callOtp({
      action: "signup",
      email: addr,
      password,
      name: name || "",
      phone: phone || "",
    });

    // Sign in straight away so there's a live session behind the OTP screen.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: addr,
      password,
    });
    if (!error && data?.session?.access_token) {
      setUserToken(data.session.access_token);
    }

    return {
      message: res?.codeSent
        ? "Account created. Check your email for the 6-digit code."
        : "Account created, but we couldn't email your code. Tap Resend code.",
      userId: res?.userId || data?.user?.id || null,
      otpRequired: true,
      codeSent: !!res?.codeSent,
      session: data?.session || null,
    };
  },

  async verifyOtp({ email, otp, code, purpose = "signup" }) {
    const addr = String(email || "").trim();
    const submitted = String(otp || code || "").trim();

    await callOtp({ action: "verify", email: addr, code: submitted, purpose });

    // Verified. Make sure there's a live session — signUp already created one,
    // but a returning user verifying on another device won't have it.
    let { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      const stored = getUserToken();
      if (!stored) {
        return { message: "Verified", token: null, user: { email: addr, role: "user" } };
      }
    }

    const token = sess?.session?.access_token || getUserToken();
    if (token) setUserToken(token);

    const profile = await currentProfile();
    return {
      message: "Verified",
      token,
      user: {
        id: profile?.id || sess?.session?.user?.id,
        name: profile?.name || "",
        email: profile?.email || addr,
        role: profile?.role || "user",
      },
    };
  },

  async resendOtp({ email, purpose = "signup" }) {
    await callOtp({ action: "request", email: String(email || "").trim(), purpose });
    return { message: "Code resent" };
  },

  async login({ email, password }) {
    const addr = String(email || "").trim();
    const { data, error } = await supabase.auth.signInWithPassword({ email: addr, password });
    if (error) throw fail(error, "Invalid email or password");

    const session = data?.session;
    setUserToken(session?.access_token || null);

    const profile = await currentProfile();

    // Account exists but the address was never proved — send a fresh code and
    // let the login page switch to its OTP step.
    if (profile && profile.is_verified === false) {
      try {
        await callOtp({ action: "request", email: addr, purpose: "signup" });
      } catch { /* the screen offers Resend code */ }
      return {
        otpRequired: true,
        next: "otp",
        message: "Please confirm your email. We just sent you a new code.",
        token: session?.access_token || null,
      };
    }

    return {
      message: "Logged in",
      token: session?.access_token || null,
      user: {
        id: data?.user?.id,
        name: profile?.name || data?.user?.user_metadata?.name || "",
        email: data?.user?.email || addr,
        role: profile?.role || "user",
      },
    };
  },

  /** Password reset, also on our own codes. */
  async requestPasswordReset({ email }) {
    await callOtp({
      action: "request",
      email: String(email || "").trim(),
      purpose: "password_reset",
    });
    return { message: "If that address has an account, a code is on its way." };
  },

  async me() {
    const profile = await currentProfile();
    if (!profile) throw fail({ message: "User not found", status: 404 });
    const u = profileToUser(profile);
    return { id: u.id, name: u.name, email: u.email, role: u.role, isVerified: u.isVerified };
  },

  async logout() {
    clearUserToken();
    await supabase.auth.signOut().catch(() => {});
    return { message: "Logged out" };
  },
};

/* ========================================================================== */
/* Shipments                                                                  */
/* ========================================================================== */

/** Presentation-layer formatting, ported from the old trackByTrackingId(). */
const TRACK_ORDER = ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
const TRACK_LABELS = {
  CREATED: "Ordered",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
  CANCELLED: "Cancelled",
};

function formatTracking(t) {
  const currentCode = String(t.status || "CREATED").toUpperCase();
  const currentIdx = TRACK_ORDER.indexOf(currentCode);
  const rawTimeline = arr(t.timeline);

  const timeline = TRACK_ORDER.map((code, i) => {
    const hit = rawTimeline.find((x) => String(x.status).toUpperCase() === code);
    const when = hit?.at ? new Date(hit.at) : null;
    return {
      label: TRACK_LABELS[code] || code,
      time: when
        ? when.toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })
        : "—",
      done: currentIdx >= 0 ? i <= currentIdx : !!hit,
      current: currentIdx >= 0 && i === currentIdx,
      status: code,
    };
  });

  const updates = rawTimeline
    .slice()
    .reverse()
    .map((x) => {
      const when = x.at ? new Date(x.at) : null;
      return {
        date: when
          ? when.toLocaleString(undefined, {
              month: "short", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : "",
        note: x.note || `Status: ${TRACK_LABELS[String(x.status).toUpperCase()] || x.status}`,
      };
    });

  let estimatedDelivery = t.eta || "";
  if (t.etaAt) {
    const d = new Date(t.etaAt);
    if (!isNaN(d.getTime())) {
      estimatedDelivery = d.toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
    }
  }

  const weightKg =
    t.serviceType === "freight"
      ? Number(t.freight?.weight || 0) * Number(t.freight?.pallets || 1)
      : Number(t.parcel?.weight || 0);

  const shipper = {
    name: t.shipperName || t.shipperContact?.name || "",
    email: t.shipperEmail || t.shipperContact?.email || "",
    phone: t.shipperPhone || t.shipperContact?.phone || "",
  };
  const recipient = {
    name: t.recipientName || t.recipientContact?.name || "",
    email: t.recipientEmail || t.recipientContact?.email || "",
    phone: t.recipientPhone || t.recipientContact?.phone || "",
    address: t.recipientAddress || "",
  };

  return {
    trackingNumber: t.trackingNumber,
    id: t.id,

    status: String(t.status || "CREATED").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    statusCode: currentCode,

    eta: t.eta,
    estimatedDelivery,
    lastLocation: t.lastLocation || null,

    from: t.from || null,
    to: t.to || null,

    serviceType: t.serviceType,
    service:
      t.serviceType === "freight"
        ? `Freight (${t.freight?.mode || "air"})`
        : cap(t.parcel?.level || "standard"),

    weight: weightKg ? `${weightKg} kg` : "",
    parcel: t.parcel || null,
    freight: t.freight || null,

    timeline,
    rawTimeline,
    updates,

    price: Number(t.price || 0),
    listPrice: Number(t.listPrice || 0),
    discountAmount: Number(t.discountAmount || 0),
    currency: t.currency,
    billable: Number(t.billable || 0),

    recipientEmail: recipient.email,
    recipientAddress: recipient.address,
    recipientName: recipient.name,
    recipientPhone: recipient.phone,
    shipperName: shipper.name,
    shipperEmail: shipper.email,
    shipperPhone: shipper.phone,
    shipper,
    recipient,
    contact: {
      shipperName: shipper.name,
      shipperEmail: shipper.email,
      shipperPhone: shipper.phone,
      recipientName: recipient.name,
      recipientPhone: recipient.phone,
      recipientEmail: recipient.email,
      recipientAddress: recipient.address,
    },

    goodsPhotos: arr(t.goodsPhotos),
    goodsVideos: arr(t.goodsVideos),
    shipmentKey: t.shipmentKey || "",

    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export const shipments = {
  /** Server-side quote. Pricing lives in Postgres so it can't be forged. */
  async quote({ origin, destination, parcel, parcels, freight, serviceLevel = "standard" } = {}) {
    const first = parcel ?? (Array.isArray(parcels) ? parcels[0] : null);
    const payload = {
      origin: origin ?? "",
      destination: destination ?? "",
      serviceLevel,
      ...(freight ? { freight } : {}),
      ...(first ? { parcel: first } : {}),
    };
    return unwrap(
      await supabase.rpc("quote_shipment", { payload }),
      "Failed to calculate quote"
    );
  },

  /** Guest OR signed-in booking — create_shipment() reads auth.uid() itself. */
  async create(payload) {
    const data = unwrap(
      await supabase.rpc("create_shipment", { payload: payload || {} }),
      "Could not create shipment"
    );
    return shipmentToDoc(Array.isArray(data) ? data[0] : data);
  },

  async listMine() {
    const uid = await requireUserId();
    const data = unwrap(
      await supabase
        .from("shipments")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(500),
      "Failed to list shipments"
    );
    return arr(data).map(shipmentToDoc);
  },

  async getOne(id) {
    const data = unwrap(
      await supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
      "Failed to fetch shipment"
    );
    if (!data) throw fail({ message: "Shipment not found", status: 404 });
    return shipmentToDoc(data);
  },

  async track(trackingNumber) {
    const data = unwrap(
      await supabase.rpc("track_shipment", { p_tracking: String(trackingNumber || "") }),
      "Failed to fetch tracking"
    );
    if (!data) throw fail({ message: "Tracking ID not found", status: 404 });
    return formatTracking(data);
  },

  /**
   * Checkout promo/routing code check. Returns:
   *   { valid, code, percentOff, amountOff, unlocksPayInPerson, testBooking }
   * "blaise" routes the booking to the Blaise admin console.
   */
  async validatePromo(code) {
    const data = unwrap(
      await supabase.rpc("validate_discount_code", { p_code: String(code || "") }),
      "Could not check that code"
    );
    return data || { valid: false, reason: "not_found" };
  },
};

/* ========================================================================== */
/* USER: dashboard / details / address book / payments / pickups / …          */
/* ========================================================================== */

const randId = (prefix) => prefix + Math.random().toString(36).slice(2, 7).toUpperCase();

export const userDetails = {
  /**
   * Full merged dashboard payload. Real shipments are re-synced from the
   * shipments table on every load (the old refreshFromShipmentCollection()).
   */
  async get() {
    const row = await loadOwnDetailsRow();
    const doc = detailsRowToDoc(row);

    const { data: realRows } = await supabase
      .from("shipments")
      .select(
        "id, tracking_number, service_type, parcel, freight, status, from_location, to_location, recipient_name, recipient_email, price, currency, created_at"
      )
      .eq("user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(500);

    const lite = shipmentsToLite(realRows, doc.billing?.currency || "EUR");

    if (lite.length) {
      doc.shipments = lite;
      doc.billing = computeBilling(
        lite,
        doc.billing?.currency || "EUR",
        6,
        doc.billing?.walletBalance || 0
      );
      // best-effort write-back; never block the dashboard on it
      supabase
        .from("user_details")
        .update({ shipments: lite, billing: doc.billing })
        .eq("user_id", row.user_id)
        .then(() => {}, () => {});
    }

    return toDashboardView(doc);
  },

  async save(body) {
    const row = await loadOwnDetailsRow();
    const allowed = [
      "displayName", "phone", "addresses", "paymentMethods", "pickups",
      "quotes", "supportTickets", "notificationPrefs", "profile",
    ];
    const patch = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body || {}, k)) patch[DETAILS_COLUMNS[k]] = body[k];
    }
    const updated = unwrap(
      await supabase.from("user_details").update(patch).eq("user_id", row.user_id).select("*").single(),
      "Failed to save"
    );
    return toDashboardView(detailsRowToDoc(updated));
  },

  /* ------------------------------ addresses ------------------------------ */
  addAddress(body) {
    const a = body || {};
    return mutateOwnArray("addresses", (list) => {
      const next = a.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : [...list];
      next.push({
        label: a.label || a.name || "Address",
        name: a.name || "",
        line1: a.line1 || "",
        line2: a.line2 || "",
        city: a.city || "",
        state: a.state || "",
        postalCode: a.postalCode || "",
        country: a.country || "",
        phone: a.phone || "",
        isDefault: !!a.isDefault,
      });
      return next;
    });
  },

  updateAddress(idx, body) {
    const i = Number(idx);
    const patch = body || {};
    return mutateOwnArray("addresses", (list) => {
      if (!list[i]) throw fail({ message: "Address not found", status: 404 });
      const next = patch.isDefault
        ? list.map((x, j) => (j === i ? x : { ...x, isDefault: false }))
        : [...list];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  },

  deleteAddress(idx) {
    const i = Number(idx);
    return mutateOwnArray("addresses", (list) => {
      if (!list[i]) throw fail({ message: "Address not found", status: 404 });
      return list.filter((_, j) => j !== i);
    });
  },

  /* --------------------------- payment methods --------------------------- */
  addPayment(body) {
    const p = body || {};
    return mutateOwnArray("paymentMethods", (list) => {
      const next = p.default ? list.map((x) => ({ ...x, default: false })) : [...list];
      next.push({
        label: p.label || p.brand || "Card",
        brand: p.brand || "",
        last4: String(p.last4 ?? "").replace(/\D/g, "").slice(-4),
        expMonth: p.expMonth,
        expYear: p.expYear,
        default: !!p.default,
        provider: p.provider || "mock",
        status: "valid",
      });
      return next;
    });
  },

  deletePayment(idx) {
    const i = Number(idx);
    return mutateOwnArray("paymentMethods", (list) => {
      if (!list[i]) throw fail({ message: "Payment method not found", status: 404 });
      return list.filter((_, j) => j !== i);
    });
  },

  /* ------------------------------- pickups ------------------------------- */
  addPickup(body) {
    const p = body || {};
    return mutateOwnArray("pickups", (list) => [
      ...list,
      {
        publicId: randId("PUP"),
        date: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
        window: p.window || "13:00–17:00",
        addressText: p.addressText || "",
        recurring: !!p.recurring,
        frequency: p.frequency || "WEEKLY",
        status: "Requested",
        instructions: p.instructions || "",
      },
    ]);
  },

  updatePickup(idx, body) {
    const i = Number(idx);
    const patch = { ...(body || {}) };
    if (patch.date) patch.date = new Date(patch.date).toISOString();
    return mutateOwnArray("pickups", (list) => {
      if (!list[i]) throw fail({ message: "Pickup not found", status: 404 });
      const next = [...list];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  },

  deletePickup(idx) {
    const i = Number(idx);
    return mutateOwnArray("pickups", (list) => {
      if (!list[i]) throw fail({ message: "Pickup not found", status: 404 });
      return list.filter((_, j) => j !== i);
    });
  },

  /* -------------------------------- quotes ------------------------------- */
  addQuote(body) {
    const q = body || {};
    return mutateOwnArray("quotes", (list) => [
      ...list,
      {
        publicId: randId("QT"),
        from: q.from || "",
        to: q.to || "",
        service: q.service || "Standard",
        weightKg: Number(q.weightKg || 0),
        pieces: Number(q.pieces || 1),
        price: Number(q.price || 0),
        currency: q.currency || "EUR",
        expiresAt: q.expiresAt
          ? new Date(q.expiresAt).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        notes: q.notes || "",
      },
    ]);
  },

  deleteQuote(idx) {
    const i = Number(idx);
    return mutateOwnArray("quotes", (list) => {
      if (!list[i]) throw fail({ message: "Quote not found", status: 404 });
      return list.filter((_, j) => j !== i);
    });
  },

  /* --------------------------- support tickets --------------------------- */
  openTicket(body) {
    const t = body || {};
    return mutateOwnArray("supportTickets", (list) => [
      ...list,
      {
        publicId: randId("TK"),
        subject: t.subject || "Support request",
        category: t.category || "general",
        relatedTracking: t.relatedTracking || "",
        status: "open",
        messages: [{ sender: "user", text: t.message || t.text || "", at: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
      },
    ]);
  },

  async replyTicket(idx, message) {
    const i = Number(idx);
    const text = String(message || "").trim();
    if (!text) throw fail({ message: "Message required", status: 400 });
    const list = await mutateOwnArray("supportTickets", (tickets) => {
      if (!tickets[i]) throw fail({ message: "Ticket not found", status: 404 });
      const next = [...tickets];
      const t = { ...next[i] };
      t.messages = [...arr(t.messages), { sender: "user", text, at: new Date().toISOString() }];
      if (t.status === "resolved") t.status = "open";
      next[i] = t;
      return next;
    });
    return list[i];
  },

  async closeTicket(idx) {
    const i = Number(idx);
    const list = await mutateOwnArray("supportTickets", (tickets) => {
      if (!tickets[i]) throw fail({ message: "Ticket not found", status: 404 });
      const next = [...tickets];
      next[i] = { ...next[i], status: "closed" };
      return next;
    });
    return list[i];
  },

  /* ----------------------- notifications & profile ----------------------- */
  async setNotifications(prefs) {
    const row = await loadOwnDetailsRow();
    const merged = { ...(row.notification_prefs || {}), ...(prefs || {}) };
    const updated = unwrap(
      await supabase
        .from("user_details")
        .update({ notification_prefs: merged })
        .eq("user_id", row.user_id)
        .select("notification_prefs")
        .single(),
      "Failed to save notification preferences"
    );
    return updated.notification_prefs;
  },

  async saveProfile(body) {
    const row = await loadOwnDetailsRow();
    const b = body || {};

    const patch = { profile: { ...(row.profile || {}), ...(b.profile || {}) } };
    if (b.displayName !== undefined) patch.display_name = b.displayName;
    if (b.phone !== undefined) patch.phone = b.phone;

    const updated = unwrap(
      await supabase
        .from("user_details")
        .update(patch)
        .eq("user_id", row.user_id)
        .select("display_name, phone, profile")
        .single(),
      "Failed to save profile"
    );

    // mirror onto the canonical profile row, like the old controller did
    const mirror = {};
    if (b.displayName) mirror.name = b.displayName;
    if (b.phone) mirror.phone = b.phone;
    if (Object.keys(mirror).length) {
      await supabase.from("profiles").update(mirror).eq("id", row.user_id);
    }

    return { displayName: updated.display_name, phone: updated.phone, profile: updated.profile };
  },
};

/* ========================================================================== */
/* Admin auth                                                                 */
/* ========================================================================== */

export const adminAuth = {
  /** Create the account, then claim the invite code (checked server-side). */
  async register({ name, email, password, inviteCode }) {
    const addr = String(email || "").trim();

    // Same path as customer signup: the admin API creates the account so
    // Supabase's rate-limited mailer is never involved.
    await callOtp({ action: "signup", email: addr, password, name: name || "" });

    const signIn = await supabase.auth.signInWithPassword({ email: addr, password });
    if (signIn.error) throw fail(signIn.error, "Account created, but sign-in failed");

    unwrap(
      await supabase.rpc("claim_admin_invite", { p_code: String(inviteCode || "") }),
      "Invalid invite code"
    );

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || null;
    setAdminToken(token);

    const profile = await currentProfile();
    return { message: "Admin created", token, admin: profileToUser(profile) };
  },

  async login({ email, password }) {
    const addr = String(email || "").trim();
    const { data, error } = await supabase.auth.signInWithPassword({ email: addr, password });
    if (error) throw fail(error, "Invalid credentials");

    const profile = await currentProfile();
    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut().catch(() => {});
      clearAdminToken();
      throw fail({ message: "Not an admin account", status: 403 });
    }

    const token = data?.session?.access_token || null;
    setAdminToken(token);

    return { message: "Admin logged in", token, admin: profileToUser(profile) };
  },

  async me() {
    const profile = await currentProfile();
    if (!profile) throw fail({ message: "Admin not found", status: 404 });
    if (profile.role !== "admin") throw fail({ message: "Forbidden", status: 403 });
    return profileToUser(profile);
  },

  async logout() {
    clearAdminToken();
    await supabase.auth.signOut().catch(() => {});
    return { message: "Admin logged out" };
  },
};

/* ========================================================================== */
/* Admin: shipments                                                           */
/* ========================================================================== */
// RLS already limits a scoped admin (Blaise) to shipments routed to him, so
// these are plain selects — no extra filtering needed on the client.

function summariseChange(before, after) {
  if (!before || !after) return "";
  const out = [];
  if (before.status !== after.status) out.push(`Status → ${after.status}`);
  if (before.lastLocation !== after.lastLocation && after.lastLocation) {
    out.push(`Now in ${after.lastLocation}`);
  }
  if (before.from !== after.from) out.push(`Origin updated: ${after.from}`);
  if (before.to !== after.to) out.push(`Destination updated: ${after.to}`);
  if (before.eta !== after.eta && after.eta) out.push(`ETA: ${after.eta}`);
  return out.join(" · ");
}

export const adminShipments = {
  async list(params = {}) {
    const { status, q, page, limit, flat } = params;
    const wantPaging = page !== undefined || limit !== undefined;
    const pageNum = Math.max(parseInt(page || "1", 10), 1);
    const perPage = Math.min(Math.max(parseInt(limit || "20", 10), 1), 100);

    let query = supabase
      .from("shipments")
      .select("*", wantPaging ? { count: "exact" } : undefined)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", String(status).trim().toUpperCase().replace(/[\s-]+/g, "_"));
    }

    if (q && String(q).trim()) {
      const term = String(q).trim().replace(/[%,()]/g, "");
      query = query.or(
        [
          `tracking_number.ilike.%${term}%`,
          `from_location.ilike.%${term}%`,
          `to_location.ilike.%${term}%`,
          `recipient_email.ilike.%${term}%`,
          `last_location.ilike.%${term}%`,
        ].join(",")
      );
    }

    if (wantPaging) {
      const from = (pageNum - 1) * perPage;
      query = query.range(from, from + perPage - 1);
    } else {
      query = query.limit(500);
    }

    const { data, error, count } = await query;
    if (error) throw fail(error, "Failed to list shipments");

    const items = arr(data).map(shipmentToDoc);
    if (flat || !wantPaging) return items;
    return { items, total: count ?? items.length, page: pageNum, limit: perPage };
  },

  async getOne(id) {
    const data = unwrap(
      await supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
      "Failed to fetch shipment"
    );
    if (!data) throw fail({ message: "Shipment not found", status: 404 });
    return shipmentToDoc(data);
  },

  /**
   * Status / location / ETA / route edits. Mirrors the old auto-notify:
   * when something meaningful changed and there is a recipient email, the
   * Edge Function fires a branded update email.
   */
  async update(id, patch) {
    const res = unwrap(
      await supabase.rpc("admin_update_shipment", { p_id: id, p_patch: patch || {} }),
      "Failed to update shipment"
    );

    const shipment = shipmentToDoc(res?.shipment);
    const changed = !!res?.changed;

    let notified = false;
    const wantsNotify = patch?.notifyNow || patch?.notify;

    if ((changed || wantsNotify) && shipment?.recipientEmail) {
      try {
        await callSendEmail({
          mode: "notify",
          shipmentId: id,
          message: patch?.message || patch?.note || "",
          subject: patch?.subject || "",
          changeSummary: summariseChange(res?.before, res?.after),
        });
        notified = true;
      } catch (e) {
        console.warn("[adminShipments.update] notify failed:", e?.message || e);
      }
    }

    return { message: "Shipment updated", shipment, changed, notified };
  },

  /** notify(id, payload) or notify(id) — the second arg used to be a token. */
  async notify(id, payloadOrToken) {
    const body =
      typeof payloadOrToken === "object" && payloadOrToken !== null ? payloadOrToken : {};
    const res = await callSendEmail({ mode: "notify", shipmentId: id, ...body });
    return { message: "Notification sent", ...res };
  },

  async create(body) {
    const data = unwrap(
      await supabase.rpc("admin_create_shipment", { payload: body || {} }),
      "Failed to add shipment"
    );
    return shipmentToDoc(Array.isArray(data) ? data[0] : data);
  },
};

/* ========================================================================== */
/* Admin: users                                                               */
/* ========================================================================== */

export const adminUsers = {
  async list(params = {}) {
    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Number(params.limit) || 1000);

    if (params.role) query = query.eq("role", params.role);
    if (params.q) {
      const term = String(params.q).trim().replace(/[%,()]/g, "");
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const data = unwrap(await query, "Failed to load users");
    return arr(data).map(profileToUser);
  },

  async getOne(id) {
    const data = unwrap(
      await supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      "Failed to load user"
    );
    if (!data) throw fail({ message: "User not found", status: 404 });
    return profileToUser(data);
  },

  async update(id, patch) {
    const allowed = {
      name: "name", email: "email", phone: "phone", address: "address",
      role: "role", isVerified: "is_verified", adminScope: "admin_scope",
    };
    const body = {};
    for (const [k, col] of Object.entries(allowed)) {
      if (patch?.[k] !== undefined) body[col] = patch[k];
    }
    const data = unwrap(
      await supabase.from("profiles").update(body).eq("id", id).select("*").single(),
      "Failed to update user"
    );
    return { message: "User updated", user: profileToUser(data) };
  },

  /** Full UserDetails doc for the admin editor (creates an empty one if missing). */
  async getDetails(userId) {
    const found = await supabase
      .from("user_details").select("*").eq("user_id", userId).maybeSingle();
    if (found.error) throw fail(found.error, "Failed to load details");

    let row = found.data;
    if (!row) {
      const profile = await supabase
        .from("profiles").select("name, email, phone").eq("id", userId).maybeSingle();
      row = unwrap(
        await supabase
          .from("user_details")
          .insert({
            user_id: userId,
            display_name: profile.data?.name || "",
            email: profile.data?.email || null,
            phone: profile.data?.phone || "",
          })
          .select("*")
          .single(),
        "Failed to create details"
      );
    }

    return toDashboardView(detailsRowToDoc(row));
  },

  async setDetails(userId, body, { recompute = 1 } = {}) {
    const patch = {};
    for (const [k, col] of Object.entries(DETAILS_COLUMNS)) {
      if (Object.prototype.hasOwnProperty.call(body || {}, k)) patch[col] = body[k];
    }

    if (recompute) {
      patch.billing = computeBilling(
        arr(body?.shipments),
        body?.billing?.currency || "EUR",
        6,
        body?.billing?.walletBalance || 0
      );
    }

    // ensure the row exists, then patch it
    await supabase
      .from("user_details")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const data = unwrap(
      await supabase.from("user_details").update(patch).eq("user_id", userId).select("*").single(),
      "Failed to save details"
    );
    return toDashboardView(detailsRowToDoc(data));
  },

  async remove(id) {
    unwrap(await supabase.from("profiles").delete().eq("id", id), "Failed to delete user");
    return { message: "User deleted" };
  },
};

/* ========================================================================== */
/* Admin: mock overlay (was the in-memory mockStore)                          */
/* ========================================================================== */

const EMPTY_BUNDLE = {
  shipments: [], addresses: [], packages: [], payments: [], pickups: [],
  userStats: { totalShipments: 0, totalSpend: 0 },
};

export const adminMock = {
  async get(userId) {
    const data = unwrap(
      await supabase
        .from("admin_mock_overlays").select("bundle").eq("user_id", userId).maybeSingle(),
      "Failed to load overlay"
    );
    return { data: data?.bundle || EMPTY_BUNDLE };
  },

  async inject(userId, body = {}) {
    const incoming = body.bundle || body.data || body;
    const bundle = { ...EMPTY_BUNDLE, ...incoming };

    if (body.replace === false) {
      const prev = (await adminMock.get(userId)).data;
      for (const key of ["shipments", "addresses", "packages", "payments", "pickups"]) {
        bundle[key] = [...arr(bundle[key]), ...arr(prev[key])];
      }
      bundle.userStats = { ...(prev.userStats || {}), ...(bundle.userStats || {}) };
    }

    unwrap(
      await supabase
        .from("admin_mock_overlays")
        .upsert({ user_id: userId, bundle }, { onConflict: "user_id" }),
      "Failed to store overlay"
    );
    return { message: "Mock overlay stored", data: bundle };
  },

  async clear(userId) {
    unwrap(
      await supabase.from("admin_mock_overlays").delete().eq("user_id", userId),
      "Failed to clear overlay"
    );
    return { message: "Mock overlay cleared" };
  },
};

/* ========================================================================== */
/* Admin: email (Edge Function)                                               */
/* ========================================================================== */

async function callSendEmail(body) {
  const { data, error } = await supabase.functions.invoke("send-email", { body });
  if (error) {
    // surface the function's own JSON error message when there is one
    let detail = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) detail = parsed.error;
    } catch { /* keep the generic message */ }
    throw fail({ message: detail }, "Failed to send email");
  }
  if (data?.error) throw fail({ message: data.error }, "Failed to send email");
  return data || {};
}

export const adminEmail = {
  send({ to, subject, body, html, shipmentId, message }) {
    if (shipmentId) {
      return callSendEmail({ mode: "notify", shipmentId, to, subject, message: message || body });
    }
    return callSendEmail({ mode: "raw", to, subject, html: html ?? body });
  },
};

/* ========================================================================== */
/* Geocode — straight to Nominatim now that the proxy is gone                 */
/* ========================================================================== */

const GEO_CACHE = new Map();

export const geocode = {
  async search(q, { signal } = {}) {
    const key = String(q || "").trim().toLowerCase();
    if (!key) return { lat: null, lon: null, display: null };
    if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);

    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
        encodeURIComponent(q);
      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!res.ok) return { lat: null, lon: null, display: null };

      const list = await res.json();
      const best = Array.isArray(list) && list[0] ? list[0] : null;
      const out = best
        ? { lat: Number(best.lat), lon: Number(best.lon), display: best.display_name || q }
        : { lat: null, lon: null, display: null };

      GEO_CACHE.set(key, out);
      return out;
    } catch {
      return { lat: null, lon: null, display: null };
    }
  },

  async resolve(place, opts) {
    const r = await geocode.search(place, opts);
    return { lat: r?.lat ?? null, lon: r?.lon ?? null };
  },
};

/* ========================================================================== */
/* Lightweight direct helpers (kept for backwards compatibility)              */
/* ========================================================================== */
// These used to accept an arbitrary REST path. There is no REST server any
// more, so they proxy to Supabase RPCs instead: apiPost("/rpc/foo", args).

function rpcNameFrom(path) {
  const m = String(path || "").match(/\/?rpc\/([\w-]+)/);
  return m ? m[1] : null;
}

export async function apiGet(path) {
  const name = rpcNameFrom(path);
  if (name) return unwrap(await supabase.rpc(name), "RPC failed");
  throw fail({ message: `apiGet("${path}") is not supported without a REST backend.` });
}

export async function apiPost(path, body) {
  const name = rpcNameFrom(path);
  if (name) return unwrap(await supabase.rpc(name, body || {}), "RPC failed");
  throw fail({ message: `apiPost("${path}") is not supported without a REST backend.` });
}

export const apiPatch = apiPost;
export const apiPut = apiPost;

/* ---------- Book from draft (helper) ---------- */
export async function bookFromDraft(draft) {
  return shipments.create(draft);
}

/* ---- Back-compat module aliases ---- */
export const AuthAPI = auth;
export const ShipAPI = shipments;
export const GeoAPI = geocode;
export const AdminAPI = adminShipments;
