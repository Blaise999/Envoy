// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter } from "react-router-dom";

import Router from "./router.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import ScrollToTop from "./ScrollToTop.jsx"; // 👈 add this tiny helper
import "./index.css";
import "leaflet/dist/leaflet.css";

// ---- Global backend pre-warm ----
// Render free-tier goes to sleep after 15 min of idle. First request after
// idle takes 30-60s to wake the container, which blows up short client
// timeouts. We fire a silent health ping the moment the app loads, and
// again every 10 minutes while the tab is open, to keep it warm.
(function warmBackend() {
  try {
    const base =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "/api";
    const url = `${String(base).replace(/\/$/, "")}/health`;
    const ping = () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000);
      fetch(url, { signal: ctrl.signal, cache: "no-store" })
        .catch(() => {})
        .finally(() => clearTimeout(t));
    };
    ping();
    setInterval(ping, 10 * 60 * 1000); // every 10 min
  } catch {}
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />  {/* ensures each route change starts at the top */}
        <Router />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
