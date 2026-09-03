import { useState, useEffect } from "react";
import { supabase, ML_API_URL } from "../lib/supabase";

export default function StudentPage({ session, theme, toggleTheme }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("write");

  useEffect(() => { fetchProfile(); fetchMyFeedbacks(); }, [session.user.id]);

  async function fetchProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data);
  }

  async function fetchMyFeedbacks() {
    const { data } = await supabase.from("feedbacks").select("*")
      .eq("student_id", session.user.id).order("created_at", { ascending: false });
    if (!error) setMyFeedbacks(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = text.trim();
    if (clean.length < 5) return setError("Please write a little more so your feedback is meaningful.");
    setSubmitting(true); setError("");
    try {
      const mlRes = await fetch(`${ML_API_URL}/analyze`, {
        method: "POST", headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ text: clean })
      });
      if (!mlRes.ok) throw new Error("Feedback service is unavailable. Please try again.");
      const result = await mlRes.json();

      const { error: dbError } = await supabase.from("feedbacks").insert({
        student_id: session.user.id,
        student_name: profile?.name || "Student",
        text: clean,
        aspect: result.aspect || null,
        detected_aspect: result.aspect || null,
        sentiment: result.sentiment || "pending",
        confidence: result.confidence ?? null,
        sentiment_scores: result.scores ?? null,
        priority: result.priority ?? "Medium",
        ml_pipeline_stages: result.pipeline_stages ?? null
      });
      if (dbError) throw dbError;

      setText(""); setSubmitted(true);
      await fetchMyFeedbacks();
      setTimeout(() => setSubmitted(false), 4500);
    } catch (err) {
      setError(err.message || "Could not submit feedback.");
    } finally { setSubmitting(false); }
  }

  const priorityColor = { High: "var(--danger)", Medium: "var(--warning)", Low: "var(--success)" };
  const sentimentColor = { positive: "var(--success)", neutral: "var(--warning)", negative: "var(--danger)", pending: "var(--muted)" };

  return <div className="app-shell">
    <nav className="navbar">
      <div className="brand-mark"><span>Student Feedback</span></div>
      <div className="nav-right">
        <button className="theme-btn" onClick={toggleTheme} title="Toggle theme">{theme === "light" ? "☾" : "☀"}</button>
        <span className="nav-badge student-badge">Student</span>
        <span className="nav-name">{profile?.name || session.user.email}</span>
        <button className="logout-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </nav>

    <main className="student-container">
      <section className="hero-card">
        <div>
          <p className="eyebrow">YOUR VOICE MATTERS</p>
          <h1>Make the experience better.</h1>
          <p>Share what is working, what is not, or what you would like to see improved. Write naturally in English or Telugu.</p>
        </div>
        <div className="hero-stat"><strong>{myFeedbacks.length}</strong><span>feedback submitted</span></div>
      </section>

      <div className="student-tabs">
        <button className={view === "write" ? "tab-active" : ""} onClick={() => setView("write")}>✎ Write feedback</button>
        <button className={view === "history" ? "tab-active" : ""} onClick={() => setView("history")}>◷ My feedback</button>
      </div>

      {view === "write" ? <section className="card feedback-compose">
        <div className="card-heading">
          <div><h2>Tell us what you think</h2><p>Your message is enough. No rating or category is required.</p></div>
          <span className="privacy-chip">🔒 Private</span>
        </div>
        <form onSubmit={handleSubmit} className="feedback-form">
          <textarea className="feedback-textarea large-textarea"
            placeholder="Start typing your feedback…&#10;&#10;Example: The staff are helpful, but the waiting time has become difficult during busy hours."
            value={text} onChange={e => setText(e.target.value)} rows={9} maxLength={2000} required />
          <div className="composer-footer">
            <span>{text.length}/2000 characters · English or Telugu</span>
            <button className="submit-btn" type="submit" disabled={submitting || text.trim().length < 5}>
              {submitting ? "Submitting…" : "Submit feedback →"}
            </button>
          </div>
          {error && <div className="alert alert-error">⚠ {error}</div>}
          {submitted && <div className="alert alert-success">✓ Feedback submitted successfully.</div>}
        </form>
      </section> : <section className="card">
        <div className="card-heading"><div><h2>My feedback</h2><p>Only feedback submitted from this account appears here.</p></div></div>
        {myFeedbacks.length === 0 ? <div className="empty-state"><div className="empty-icon">✎</div><strong>No feedback yet</strong><span>Once you submit your first message, it will appear here.</span><button className="submit-btn compact" onClick={() => setView("write")}>Write my first feedback</button></div> :
          <div className="feedback-list">{myFeedbacks.map(fb => <article key={fb.id} className="feedback-item">
            <div className="fb-header">
              <span className="fb-date">{new Date(fb.created_at).toLocaleString()}</span>
              {fb.priority && <span className="fb-priority" style={{ color: priorityColor[fb.priority], background: `${priorityColor[fb.priority]}18` }}>{fb.priority}</span>}
              {fb.sentiment && <span className="fb-sentiment" style={{ color: sentimentColor[fb.sentiment], background: `${sentimentColor[fb.sentiment]}18` }}>{fb.sentiment}</span>}
            </div>
            <p className="fb-text">{fb.text}</p>
            {fb.detected_aspect && <span className="subtle-tag">Topic detected: {fb.detected_aspect}</span>}
          </article>)}</div>}
      </section>}

      <footer className="simple-footer">Your feedback helps teams understand real experiences and prioritize improvements.</footer>
    </main>
  </div>;
}
