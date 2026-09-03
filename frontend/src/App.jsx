import { useEffect, useState } from "react";
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
  const [accessError, setAccessError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("cfa-theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cfa-theme", theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setLoading(true);
        setTimeout(() => fetchRole(nextSession.user.id), 0);
      }
      else { setRole(null); setAccessError(""); setLoading(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId) {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (error || !["student", "admin"].includes(data?.role)) {
      setRole(null);
      setAccessError("Your account is not authorized. Please contact an administrator.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    setAccessError("");
    setRole(data.role);
    setLoading(false);
  }

  const toggleTheme = () => setTheme(v => v === "light" ? "dark" : "light");

  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordPage theme={theme} toggleTheme={toggleTheme} />;
  }
  if (loading) return <div className="loader-screen"><div className="spinner" /><p>Loading your workspace…</p></div>;
  if (accessError) return <div className="loader-screen"><p>{accessError}</p><button className="outline-btn" onClick={() => setAccessError("")}>Return to sign in</button></div>;
  if (!session) return <LoginPage theme={theme} toggleTheme={toggleTheme} />;
  if (role === "admin") return <FacultyPage session={session} theme={theme} toggleTheme={toggleTheme} />;
  return <StudentPage session={session} theme={theme} toggleTheme={toggleTheme} />;
}
