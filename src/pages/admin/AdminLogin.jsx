// src/pages/admin/AdminLogin.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../assets/envoy.png";
import { adminAuth, setAdminToken, getApiBase } from "../../utils/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [diag, setDiag] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setDiag(""); setLoading(true);
    const apiBase = getApiBase();
    const startedAt = Date.now();
    try {
      const data = await adminAuth.login(
        { email: form.email.trim(), password: form.password },
        { timeoutMs: 15000, retryOnNetworkError: true }
      );
      if (!data?.token) throw new Error("Missing token in response");
      setAdminToken(data.token);
      if (data?.admin) localStorage.setItem("adminProfile", JSON.stringify(data.admin));
      await Promise.resolve();
      if (!localStorage.getItem("envoy_admin_token")) {
        throw new Error("Could not persist admin session (storage blocked or different host).");
      }
      navigate("/admin/dashboard", { replace: true });
    } catch (e) {
      const dur = Date.now() - startedAt;
      setErr(e?.message || "Sign-in failed");
      setDiag(
        [
          `API base: ${apiBase}`,
          `Elapsed: ${dur}ms`,
          e?.status ? `HTTP ${e.status}` : "No HTTP status (network/CORS/timeout?)",
          e?.details ? `Details: ${e.details}` : "",
        ].filter(Boolean).join(" • ")
      );
      console.error("[AdminLogin] login error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — branded panel */}
      <div className="hidden lg:flex relative bg-slate-950 text-white overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-30">
          <WorldDotBg />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.2),transparent_60%)]" />
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 grid place-items-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                <path d="M2 10l20-7-7 20-3-9z" />
              </svg>
            </div>
            <span className="text-2xl font-black">Envoy</span>
          </Link>
          <div className="mt-12 max-w-md">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">Operations Console</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight leading-tight">
              Every shipment. Every scan. One window.
            </h1>
            <p className="mt-4 text-slate-300">
              The internal console for Envoy operations staff. Sign in with your work credentials.
            </p>
          </div>
        </div>
        <div className="relative z-10 text-xs text-slate-500">
          Restricted access · All actions logged and audited
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center justify-center mb-6">
            <img src={Logo} alt="Envoy" className="h-12" />
          </Link>
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight">Welcome back.</h2>
            <p className="mt-2 text-slate-500">Sign in to the operations console.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label className="block text-sm font-semibold mb-2">Work email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition"
                placeholder="you@shipenvoy.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-slate-700 text-sm font-medium"
                  aria-label={showPwd ? "Hide" : "Show"}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {err && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <div className="font-semibold">{err}</div>
                {diag && <div className="mt-1 text-xs text-rose-600">{diag}</div>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition shadow-md ${
                loading ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98]"
              }`}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
            Not Envoy staff? <Link to="/auth/login" className="text-emerald-600 font-semibold hover:text-emerald-700">Customer sign-in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorldDotBg() {
  const continents = [
    [0.18, 0.42, 0.12, 0.22],
    [0.27, 0.72, 0.06, 0.18],
    [0.47, 0.38, 0.09, 0.14],
    [0.52, 0.66, 0.07, 0.15],
    [0.70, 0.46, 0.17, 0.20],
    [0.84, 0.78, 0.07, 0.10],
  ];
  const dots = [];
  const rows = 26, cols = 52;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c / (cols - 1), y = r / (rows - 1);
      const inLand = continents.some(([cx, cy, rx, ry]) => {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        return dx * dx + dy * dy < 1;
      });
      if (inLand && Math.random() > 0.2) dots.push({ x, y, k: `${r}-${c}` });
    }
  }
  return (
    <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      {dots.map(({ x, y, k }) => (
        <circle key={k} cx={x * 1000} cy={y * 500} r={1.5} fill="#34d399" opacity="0.6" />
      ))}
    </svg>
  );
}
