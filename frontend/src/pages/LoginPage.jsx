import { useState } from "react";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "admin@studentfeedback.in";

export default function LoginPage({ theme, toggleTheme }) {
  const [mode, setMode] = useState("student");
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  function resetMessages() { setError(""); setSuccess(""); }

  async function handleSubmit(e) {
    e.preventDefault(); resetMessages(); setLoading(true);
    try {
      if (forgotMode) {
        const email = mode === "admin" ? ADMIN_EMAIL : form.email.trim();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (resetError) throw resetError;
        setSuccess(`Password reset link sent to ${mode === "admin" ? "the authorized administrator email" : "your email address"} if an account exists.`);
        return;
      }
      if (mode === "admin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: form.password });
        if (signInError) throw new Error("Invalid administrator credentials.");
        return;
      }
      if (isSignup) {
        if (form.email.toLowerCase() === ADMIN_EMAIL) throw new Error("This email is reserved for the administrator.");
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
          options: {
            data: { name: form.name.trim(), role: "student" },
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;
        setSuccess("Student account created. Check your email if verification is enabled.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (signInError) throw signInError;
      }
    } catch (err) { setError(err.message || "Something went wrong."); }
    finally { setLoading(false); }
  }

  return <div className="login-bg">
    <div className="login-top"><span className="brand-mark">Student Feedback</span><button className="theme-btn" onClick={toggleTheme}>{theme === "light" ? "☾ Dark" : "☀ Light"}</button></div>
    <div className="login-card">
      <div className="login-header">
        <div className="login-icon" aria-hidden="true">💬</div>
        <p className="eyebrow">FEEDBACK INTELLIGENCE</p>
        <h1>{mode === "admin" ? "Administrator access" : "Welcome back"}</h1>
        <p>{mode === "admin" ? "Manage feedback and improvement priorities." : "Share your experience in your own words."}</p>
      </div>
      <div className="role-toggle">
        <button type="button" className={mode === "student" ? "toggle-btn active" : "toggle-btn"} onClick={() => { setMode("student"); setForgotMode(false); setIsSignup(false); resetMessages(); }}>Student</button>
        <button type="button" className={mode === "admin" ? "toggle-btn active faculty-active" : "toggle-btn"} onClick={() => { setMode("admin"); setForgotMode(false); setIsSignup(false); resetMessages(); }}>HOD / Admin</button>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        {mode === "student" && isSignup && <input className="login-input" placeholder="Full name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />}
        {mode === "admin" && !forgotMode ? <input className="login-input" value={ADMIN_EMAIL} readOnly /> :
          <input className="login-input" type="email" placeholder="Email address" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required />}
        {!forgotMode && <input className="login-input" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} required />}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <button className={`login-btn ${mode === "admin" ? "faculty-btn" : ""}`} disabled={loading}>
          {loading ? "Please wait…" : forgotMode ? "Send reset link" : mode === "admin" ? "Sign in as Admin" : isSignup ? "Create student account" : "Sign in"}
        </button>
      </form>
      <div className="login-links">
        {!forgotMode ? <button onClick={() => { setForgotMode(true); resetMessages(); }}>Forgot password?</button> :
          <button onClick={() => { setForgotMode(false); resetMessages(); }}>← Back to sign in</button>}
        {!forgotMode && mode === "student" && <button onClick={() => { setIsSignup(!isSignup); resetMessages(); }}>{isSignup ? "I already have an account" : "Create student account"}</button>}
      </div>
    </div>
  </div>;
}
