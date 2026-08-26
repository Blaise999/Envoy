// src/router.jsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Eagerly loaded: tiny guards / utilities needed synchronously.
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import { getAdminToken } from "./utils/api.js";

// Route-level code splitting. Each page becomes its own chunk and is only
// downloaded when the user actually navigates to it. This keeps the initial
// bundle small instead of compiling every page into one giant chunk.
const App = lazy(() => import("./App.jsx"));

const LoginPage = lazy(() => import("./pages/auth/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage.jsx"));

const ExpressPage = lazy(() => import("./pages/services/Expresspage.jsx"));
const FreightPage = lazy(() => import("./pages/services/FreightPage.jsx"));
const EcommercePage = lazy(() => import("./pages/services/EcommercePage.jsx"));
const CustomsPage = lazy(() => import("./pages/services/CustomsPage.jsx"));
const DomesticPage = lazy(() => import("./pages/services/DomesticPage.jsx"));
const WarehousingPage = lazy(() => import("./pages/services/WarehousingPage.jsx"));
const ServicesOverviewPage = lazy(() => import("./pages/services/ServicesOverviewPage.jsx"));

const TrackPage = lazy(() => import("./pages/track/TrackPage.jsx"));
const BillingPage = lazy(() => import("./pages/billing/BillingPage.jsx"));
const ReceiptPage = lazy(() => import("./pages/billing/ReceiptPage.jsx"));

const CourierDashboard = lazy(() => import("./pages/CourierDashboard.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));

const AboutPage = lazy(() => import("./pages/info/AboutPage.jsx"));
const ContactPage = lazy(() => import("./pages/info/ContactPage.jsx"));
const FAQPage = lazy(() => import("./pages/info/FAQPage.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

const CareersPage = lazy(() => import("./pages/company/CareersPage.jsx"));
const NewsPage = lazy(() => import("./pages/company/NewsPage.jsx"));

const StatusPage = lazy(() => import("./pages/resources/StatusPage.jsx"));
const SitemapPage = lazy(() => import("./pages/resources/SitemapPage.jsx"));

const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage.jsx"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage.jsx"));
const SecurityPage = lazy(() => import("./pages/legal/SecurityPage.jsx"));

const DiagnosticPage = lazy(() => import("./pages/DiagnosticPage.jsx"));

function AdminGuard({ children }) {
  const token = getAdminToken();
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}

export default function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/create" element={<ExpressPage />} />
        <Route path="/services" element={<ServicesOverviewPage />} />
        <Route path="/services/express" element={<ExpressPage />} />
        <Route path="/services/freight" element={<FreightPage />} />
        <Route path="/services/ecommerce" element={<EcommercePage />} />
        <Route path="/services/customs" element={<CustomsPage />} />
        <Route path="/services/domestic" element={<DomesticPage />} />
        <Route path="/services/warehousing" element={<WarehousingPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/receipt/:id" element={<ReceiptPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<CourierDashboard />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="/diagnostic" element={<DiagnosticPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
