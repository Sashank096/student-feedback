import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage({ theme, toggleTheme }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) setSessionReady(true);
      else setError("This reset link is invalid or has expired. Request a new one.");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === "PASSWORD_RECOVERY" || session)) {
        setError("");
        setSessionReady(true);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault(); setError(""); setMsg("");
    if (!sessionReady) return setError("This reset link is invalid or has expired. Request a new one.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setMsg("Password updated. You can now sign in.");
  }

  return <div className="login-bg">
    <div className="login-top"><span className="brand-mark">Student Feedback</span><button className="theme-btn" onClick={toggleTheme}>{theme === "light" ? "☾ Dark" : "☀ Light"}</button></div>
    <div className="login-card">
      <div className="login-header"><div className="login-icon">🔑</div><p className="eyebrow">ACCOUNT SECURITY</p><h1>Set a new password</h1><p>Choose a new password for your account.</p></div>
      <form onSubmit={submit} className="login-form">
        <input className="login-input" type="password" minLength={8} placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} disabled={!sessionReady} required />
        <input className="login-input" type="password" minLength={8} placeholder="Confirm new password" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!sessionReady} required />
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <button className="login-btn" disabled={!sessionReady}>{sessionReady ? "Update password" : "Checking reset link…"}</button>
      </form>
      <p className="security-note">Use the reset link from the email you requested. It works for both student and administrator accounts.</p>
    </div>
  </div>;
}
