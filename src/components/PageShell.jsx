// src/components/PageShell.jsx
// Shared header + footer for simple content pages.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../assets/envoy.png";
import { ChatWidget } from "./support/ChatWidget";
import { useAuth } from "../auth/AuthContext";

export default function PageShell({ title, subtitle, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Track", to: "/track" },
    { label: "Services", to: "/services/express" },
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/80 bg-white/90 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={Logo} alt="Envoy" className="h-12 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            {navLinks.map((n) => (
              <Link key={n.label} to={n.to} className="hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth area */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Logout
                </button>
                <Link
                  to="/services/express"
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition"
                >
                  Get a Quote
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth/register"
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold hover:border-slate-400 hover:bg-slate-50 transition"
                >
                  Sign up
                </Link>
                <Link
                  to="/services/express"
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition"
                >
                  Get a Quote
                </Link>
              </>
            )}
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {navLinks.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg hover:bg-slate-50 font-medium"
              >
                {n.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="text-center px-3 py-2 rounded-lg bg-slate-100 font-medium"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); logout(); navigate("/"); }}
                    className="text-center px-3 py-2 rounded-lg bg-slate-100 font-medium"
                  >
                    Logout
                  </button>
                  <Link
                    to="/services/express"
                    onClick={() => setMobileOpen(false)}
                    className="text-center px-3 py-2 rounded-lg bg-blue-500 text-white font-semibold"
                  >
                    Get a Quote
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Link
                      to="/auth/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-100 font-medium"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/auth/register"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                    >
                      Sign up
                    </Link>
                  </div>
                  <Link
                    to="/services/express"
                    onClick={() => setMobileOpen(false)}
                    className="text-center px-3 py-2 rounded-lg bg-blue-500 text-white font-semibold"
                  >
                    Get a Quote
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero band */}
      <section className="bg-gradient-to-b from-blue-50 to-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl">{subtitle}</p>
          )}
        </div>
      </section>

      {/* Body */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                    <path d="M2 10l20-7-7 20-3-9z" />
                  </svg>
                </div>
                <span className="font-bold text-white">Envoy</span>
              </div>
              <p className="text-sm text-slate-400 max-w-xs">Ship anywhere. Track everything. 220+ destinations with transparent rates.</p>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Company</div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link to="/news" className="hover:text-white">News</Link></li>
                <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Resources</div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/developers" className="hover:text-white">Developers</Link></li>
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link to="/status" className="hover:text-white">API Status</Link></li>
                <li><Link to="/faq" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Legal</div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-white">Terms</Link></li>
                <li><Link to="/cookies" className="hover:text-white">Cookies</Link></li>
                <li><Link to="/security" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>© {new Date().getFullYear()} Envoy Logistics Ltd.</div>
            <div className="flex gap-4">
              <Link to="/sitemap" className="hover:text-white">Sitemap</Link>
              <Link to="/status" className="hover:text-white">Status</Link>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
