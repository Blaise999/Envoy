// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../libs/supabaseClient";
import { setUserToken, clearUserToken } from "../utils/api";

const AuthCtx = createContext(null);

/**
 * Auth state is now backed by the Supabase session.
 *
 * The old version kept the user in memory only, which forced a fresh login on
 * every page load. Supabase already persists (and silently refreshes) the
 * session, so we hydrate from it and mirror the access token into the
 * localStorage key ProtectedRoute reads.
 *
 * To go back to "log in every time", set `persistSession: false` in
 * src/libs/supabaseClient.ts — no changes needed here.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { id, name, email, role, token }
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function hydrate(session) {
      if (!alive) return;

      if (!session?.user) {
        clearUserToken();
        setUser(null);
        setReady(true);
        return;
      }

      setUserToken(session.access_token);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      setUser({
        id: session.user.id,
        name: profile?.name || session.user.user_metadata?.name || "",
        email: profile?.email || session.user.email || "",
        role: profile?.role || "user",
        token: session.access_token,
      });
      setReady(true);
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data?.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  function login(payload) {
    // callers already have the profile from auth.login(); keep it optimistic
    setUser(payload || null);
  }

  async function logout() {
    clearUserToken();
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
