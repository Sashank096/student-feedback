import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import StudentPage from "./pages/StudentPage";
import FacultyPage from "./pages/FacultyPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("cfa-theme") || "light");
  const authRequest = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cfa-theme", theme);
  }, [theme]);

  useEffect(() => {
    async function applySession(nextSession) {
      const requestId = ++authRequest.current;
      setSession(nextSession);
      setRole(null);
      if (!nextSession) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchRole(nextSession.user.id, requestId);
    }

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId, requestId) {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (requestId !== authRequest.current) return;
    if (error) {
      setRole("student");
    } else {
      setRole(data?.role === "admin" ? "admin" : "student");
    }
    setLoading(false);
  }

  const toggleTheme = () => setTheme(v => v === "light" ? "dark" : "light");

  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordPage theme={theme} toggleTheme={toggleTheme} />;
  }
  if (loading) return <div className="loader-screen"><div className="spinner" /><p>Loading your workspace…</p></div>;
  if (!session) return <LoginPage theme={theme} toggleTheme={toggleTheme} />;
  if (role === "admin") return <FacultyPage session={session} theme={theme} toggleTheme={toggleTheme} />;
  return <StudentPage session={session} theme={theme} toggleTheme={toggleTheme} />;
}
