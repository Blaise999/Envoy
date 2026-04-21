// src/router.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";

import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";

import ExpressPage from "./pages/services/Expresspage.jsx";
import FreightPage from "./pages/services/FreightPage.jsx";
import EcommercePage from "./pages/services/EcommercePage.jsx";
import CustomsPage from "./pages/services/CustomsPage.jsx";
import DomesticPage from "./pages/services/DomesticPage.jsx";
import WarehousingPage from "./pages/services/WarehousingPage.jsx";
import ServicesOverviewPage from "./pages/services/ServicesOverviewPage.jsx";

import TrackPage from "./pages/track/TrackPage.jsx";
import BillingPage from "./pages/billing/BillingPage.jsx";
import ReceiptPage from "./pages/billing/ReceiptPage.jsx";

import CourierDashboard from "./pages/CourierDashboard.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";

import AboutPage from "./pages/info/AboutPage.jsx";
import ContactPage from "./pages/info/ContactPage.jsx";
import FAQPage from "./pages/info/FAQPage.jsx";
import NotFound from "./pages/NotFound.jsx";

import CareersPage from "./pages/company/CareersPage.jsx";
import NewsPage from "./pages/company/NewsPage.jsx";

import StatusPage from "./pages/resources/StatusPage.jsx";
import SitemapPage from "./pages/resources/SitemapPage.jsx";

import PrivacyPage from "./pages/legal/PrivacyPage.jsx";
import TermsPage from "./pages/legal/TermsPage.jsx";
import SecurityPage from "./pages/legal/SecurityPage.jsx";

import DiagnosticPage from "./pages/DiagnosticPage.jsx";

import { getAdminToken } from "./utils/api.js";

function AdminGuard({ children }) {
  const token = getAdminToken();
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function Router() {
  return (
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
  );
}
