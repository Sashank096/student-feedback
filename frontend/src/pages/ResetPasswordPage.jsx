import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage({ theme, toggleTheme }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (mounted) {
            setError(exchangeError.message);
            setCheckingSession(false);
          }
          return;
        }
      } else if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery"
        });
        if (verifyError) {
          if (mounted) {
            setError(verifyError.message);
            setCheckingSession(false);
          }
          return;
        }
      } else {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (sessionError) {
            if (mounted) {
              setError(sessionError.message);
              setCheckingSession(false);
            }
            return;
          }
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    }

    prepareRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault(); setError(""); setMsg("");
    if (!hasSession) return setError("This reset link is expired or invalid. Please request a new one.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setMsg("Password updated. You can now sign in.");
  }

  return <div className="login-bg">
    <div className="login-top"><span className="brand-mark"><span className="brand-icon">✦</span> Campus Feedback</span><button className="theme-btn" onClick={toggleTheme}>{theme === "light" ? "☾ Dark" : "☀ Light"}</button></div>
    <div className="login-card">
      <div className="login-header"><div className="login-icon">🔑</div><p className="eyebrow">ACCOUNT SECURITY</p><h1>Set a new password</h1><p>Choose a new password for your account.</p></div>
      {checkingSession ? <div className="loader-screen"><div className="spinner" /><p>Verifying reset link…</p></div> : <form onSubmit={submit} className="login-form">
        <input className="login-input" type="password" minLength={8} placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <input className="login-input" type="password" minLength={8} placeholder="Confirm new password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <button className="login-btn">Update password</button>
      </form>}
      <p className="security-note">Use the reset link from the email you requested. It works for both student and administrator accounts.</p>
    </div>
  </div>;
}
