import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getUserToken } from "../utils/api";

export default function ProtectedRoute() {
  const { user, ready } = useAuth();
  const token = getUserToken();
  const location = useLocation();

  // Wait for the Supabase session to resolve before deciding — otherwise the
  // first paint after a reload always bounces the user to /auth/login.
  if (!ready) {
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

  if (!user || !token) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
