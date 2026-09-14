import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const COLORS = { positive: "#16a34a", neutral: "#d97706", negative: "#dc2626" };
const SEMESTERS = ["Semester 1", "Semester 2"];

function getTopic(feedback) {
  return feedback.detected_aspect || feedback.aspect || "General";
}

function getSentiment(feedback) {
  return String(feedback.sentiment || "").toLowerCase();
}

function getSemester(feedback) {
  if (feedback.semester) {
    if (String(feedback.semester).endsWith("-1") || feedback.semester === "Semester 1") return "Semester 1";
    if (String(feedback.semester).endsWith("-2") || feedback.semester === "Semester 2") return "Semester 2";
  }
  return new Date(feedback.created_at).getMonth() < 6 ? "Semester 1" : "Semester 2";
}

function getSuggestion(topic, department) {
  const text = `${topic} ${department}`.toLowerCase();
  if (/wifi|technical|computer|portal|website|login|it support/.test(text)) {
    return "Audit connectivity and technical support, then publish a clear incident-resolution timeline.";
  }
  if (/canteen|food|operations/.test(text)) {
    return "Review food quality, hygiene, pricing, and peak-hour queues with the operations team.";
  }
  if (/teaching|academic|faculty|teacher|course|exam|grade/.test(text)) {
    return "Review teaching or assessment feedback with the department and schedule a student follow-up.";
  }
  if (/library|book/.test(text)) {
    return "Check library seating, book availability, and operating hours against student demand.";
  }
  if (/hostel|facility|water|transport|bus/.test(text)) {
    return "Inspect the reported facility or service and assign a department owner with a target date.";
  }
  return "Review this recurring concern with the responsible department and publish a measurable improvement plan.";
}

function routeDepartment(feedback) {
  const text = `${feedback.detected_aspect || ""} ${feedback.aspect || ""} ${feedback.text || ""}`.toLowerCase();
  if (/fee|payment|scholarship|refund|finance/.test(text)) return "Finance";
  if (/exam|mark|grade|curriculum|class|faculty|teacher|course/.test(text)) return "Academic";
  if (/hostel|canteen|food|bus|transport|clean|water|facility/.test(text)) return "Operations";
  if (/wifi|portal|website|login|app|technical|computer/.test(text)) return "IT Support";
  if (/library|book/.test(text)) return "Library";
  return "Student Affairs";
}

function getPriority(feedback) {
  const storedPriority = String(feedback.priority || "").toLowerCase();
  if (storedPriority === "high") return "High";
  if (storedPriority === "medium") return "Medium";
  if (storedPriority === "low") return "Low";
  const text = String(feedback.text || "").toLowerCase();
  const urgent = ["urgent", "unsafe", "danger", "broken", "not working", "serious", "emergency", "harassment", "blocked", "failed", "unacceptable"]
    .some(term => text.includes(term));
  if (feedback.sentiment === "negative" && (urgent || Number(feedback.confidence) >= 0.8)) return "High";
  if (feedback.sentiment === "negative" || urgent) return "Medium";
  return "Low";
}

export default function FacultyPage({ session, theme, toggleTheme }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [trendTopic, setTrendTopic] = useState("all");
  const [trendSemester, setTrendSemester] = useState("all");
  const [trendSentiment, setTrendSentiment] = useState("negative");

  useEffect(() => {
    load();
    const channel = supabase.channel("feedback-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const [feedbackResult, profileResult] = await Promise.all([
      supabase.from("feedbacks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", session.user.id).single()
    ]);
    const error = feedbackResult.error || profileResult.error;
    if (error) {
      window.alert(`Could not load dashboard data: ${error.message}`);
      return;
    }
    setFeedbacks(feedbackResult.data || []);
    setProfile(profileResult.data);
  }

  const routedFeedbacks = useMemo(() => feedbacks.map(f => ({ ...f, department: f.department || routeDepartment(f), priority: getPriority(f) })), [feedbacks]);

  const stats = useMemo(() => {
    const total = routedFeedbacks.length;
    const pos = routedFeedbacks.filter(x=>x.sentiment==="positive").length;
    const neu = routedFeedbacks.filter(x=>x.sentiment==="neutral").length;
    const neg = routedFeedbacks.filter(x=>x.sentiment==="negative").length;
    const high = routedFeedbacks.filter(x=>x.priority==="High").length;
    return { total, pos, neu, neg, high, positivePct: total?Math.round(pos/total*100):0, negativePct: total?Math.round(neg/total*100):0 };
  }, [routedFeedbacks]);

  const topics = useMemo(() => {
    const map = {};
    feedbacks.forEach(f => { const k=f.detected_aspect || f.aspect || "General"; map[k] ??= {topic:k,total:0,negative:0,positive:0}; map[k].total++; if(f.sentiment==="negative")map[k].negative++; if(f.sentiment==="positive")map[k].positive++; });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [feedbacks]);

  const suggestions = useMemo(() => {
    const map = {};
    routedFeedbacks.forEach(feedback => {
      const topic = getTopic(feedback);
      if (getSentiment(feedback) !== "negative") return;
      const key = `${topic}|${feedback.department}`;
      map[key] ??= { topic, department: feedback.department, count: 0, high: 0 };
      map[key].count++;
      if (feedback.priority === "High") map[key].high++;
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count || b.high - a.high)
      .map(item => ({
        ...item,
        suggestion: getSuggestion(item.topic, item.department),
        urgency: item.high > 0 ? "High attention" : "Review recommended"
      }));
  }, [routedFeedbacks]);

  const pie = [{name:"Positive",value:stats.pos},{name:"Neutral",value:stats.neu},{name:"Negative",value:stats.neg}];
  const trend = useMemo(() => {
    const m={}; feedbacks.slice().reverse().forEach(f=>{const d=new Date(f.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"});m[d]=(m[d]||0)+1;});
    return Object.entries(m).slice(-14).map(([date,count])=>({date,count}));
  },[feedbacks]);

  const semesterTrend = useMemo(() => {
    const map = {};
    feedbacks.forEach(f => {
      const key = getSemester(f);
      map[key] ??= { semester: key, positive: 0, neutral: 0, negative: 0 };
      if (f.sentiment === "positive") map[key].positive++;
      if (f.sentiment === "neutral") map[key].neutral++;
      if (f.sentiment === "negative") map[key].negative++;
    });
    return Object.values(map).sort((a, b) => a.semester.localeCompare(b.semester));
  }, [feedbacks]);

  const recurringTopics = useMemo(() => {
    const map = {};
    feedbacks.forEach(f => {
      const semester = getSemester(f);
      const topic = getTopic(f);
      map[topic] ??= {};
      if (getSentiment(f) === "negative") {
        map[topic][semester] = (map[topic][semester] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([topic, counts]) => ({ topic, counts, semesters: Object.keys(counts).length }))
      .sort((a, b) => b.semesters - a.semesters || a.topic.localeCompare(b.topic));
  }, [feedbacks]);

  const trendTopics = useMemo(() => Array.from(new Set(feedbacks.map(getTopic))).sort(), [feedbacks]);
  const trendSemesters = useMemo(() => Array.from(new Set(feedbacks.map(getSemester))).sort(), [feedbacks]);
  const selectedTrendTopic = trendTopic === "all" ? (recurringTopics[0]?.topic || trendTopics[0] || "General") : trendTopic;
  const problemTrend = useMemo(() => {
    const semesters = trendSemester === "all" ? trendSemesters : [trendSemester];
    const counts = semesters.map(semester => ({
      semester,
      feedback: feedbacks.filter(f => getTopic(f) === selectedTrendTopic && getSemester(f) === semester && getSentiment(f) === trendSentiment).length
    }));
    const nonZero = counts.filter(item => item.feedback > 0);
    const first = nonZero[0]?.feedback || 0;
    const last = nonZero[nonZero.length - 1]?.feedback || 0;
    const tolerance = Math.max(1, first * 0.2);
    const direction = nonZero.length < 2 ? "Newly Emerging" : last < first - tolerance ? "Improving" : last > first + tolerance ? "Worsening" : "Continuing / Persistent";
    return { counts, direction, recurring: nonZero.length > 1, first, last };
  }, [feedbacks, selectedTrendTopic, trendSemester, trendSemesters, trendSentiment]);

  const filtered = routedFeedbacks.filter(f => (filter==="all" || f.sentiment===filter || f.priority===filter) && (!query || `${f.text} ${f.student_name} ${f.detected_aspect} ${f.department}`.toLowerCase().includes(query.toLowerCase())));
  const tabs = [["overview","Overview"],["feedbacks","All feedback"],["insights","Topics & trends"],["suggestions","Suggestions"]];

  return <div className="app-shell">
    <nav className="navbar admin-nav">
      <div className="brand-mark"><span className="brand-icon">✦</span><span>Campus Feedback</span></div>
      <div className="nav-right"><button className="theme-btn" onClick={toggleTheme}>{theme==="light"?"☾":"☀"}</button><span className="nav-badge admin-badge">HOD / Admin</span><span className="nav-name">{profile?.name || session.user.email}</span><button className="logout-btn" onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </nav>
    <main className="admin-container">
      <div className="admin-welcome"><div><p className="eyebrow">CONTROL CENTER</p><h1>Feedback overview</h1><p>See what students are experiencing and turn recurring concerns into actions.</p></div><button className="outline-btn" onClick={load}>↻ Refresh</button></div>
      <div className="tab-bar">{tabs.map(([k,l])=><button key={k} className={`tab-btn ${tab===k?"tab-active":""}`} onClick={()=>setTab(k)}>{l}</button>)}</div>

      {tab==="overview" && <>
        <div className="kpi-grid">
          <div className="kpi-card"><span className="kpi-label">Total feedback</span><strong className="kpi-value">{stats.total}</strong><span className="kpi-note">All submitted messages</span></div>
          <div className="kpi-card"><span className="kpi-label">Positive</span><strong className="kpi-value positive-text">{stats.positivePct}%</strong><span className="kpi-note">{stats.pos} messages</span></div>
          <div className="kpi-card"><span className="kpi-label">Needs attention</span><strong className="kpi-value danger-text">{stats.negativePct}%</strong><span className="kpi-note">{stats.neg} negative messages</span></div>
          <div className="kpi-card"><span className="kpi-label">Priority queue</span><strong className="kpi-value warning-text">{stats.high}</strong><span className="kpi-note">High-priority messages</span></div>
        </div>
        <div className="charts-grid">
          <div className="chart-card"><h3 className="chart-title">Overall tone</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={82} label>{pie.map((_,i)=><Cell key={i} fill={Object.values(COLORS)[i]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
          <div className="chart-card"><h3 className="chart-title">Feedback volume</h3><ResponsiveContainer width="100%" height={240}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
        </div>
        <section className="card"><div className="section-head"><div><h2>Semester sentiment trends</h2><p>Compare positive, neutral, and negative feedback across semesters.</p></div></div><ResponsiveContainer width="100%" height={240}><BarChart data={semesterTrend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="semester"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="positive" name="Positive" fill="#16a34a"/><Bar dataKey="neutral" name="Neutral" fill="#d97706"/><Bar dataKey="negative" name="Negative" fill="#dc2626"/></BarChart></ResponsiveContainer></section>
        <section className="card"><div className="section-head"><div><h2>What students are talking about</h2><p>Topics are discovered from the wording of submitted feedback.</p></div><button className="outline-btn" onClick={()=>setTab("insights")}>View insights →</button></div><div className="topic-grid">{topics.slice(0,6).map(t=><div className="topic-card" key={t.topic}><strong>{t.topic}</strong><span>{t.total} messages</span><small>{t.negative} need attention</small></div>)}{topics.length===0&&<div className="empty-state">No feedback has been submitted yet.</div>}</div></section>
      </>}

      {tab==="feedbacks" && <FeedbackList items={filtered} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />}
      {tab==="insights" && <section className="card"><div className="section-head"><div><h2>Topics & trends</h2><p>Patterns inferred from the words students use.</p></div></div><div className="charts-grid"><div className="chart-card"><h3 className="chart-title">Messages by topic</h3><ResponsiveContainer width="100%" height={320}><BarChart data={topics.slice(0,10)} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis type="category" dataKey="topic" width={110}/><Tooltip/><Bar dataKey="total" fill="#4f46e5" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div><div className="insight-stack">{topics.map(t=><div className="insight-row" key={t.topic}><div><strong>{t.topic}</strong><span>{t.total} total · {t.positive} positive · {t.negative} negative</span></div><div className="mini-progress"><i style={{width:`${t.total?Math.round(t.negative/t.total*100):0}%`}}/></div></div>)}</div></div><section className="card"><div className="section-head"><div><h2>Recurring problem trend tracking</h2><p>{trendSentiment[0].toUpperCase() + trendSentiment.slice(1)} feedback is grouped by topic and academic semester.</p></div><span className="subtle-tag">{problemTrend.recurring ? "Recurring issue" : "Newly emerging"}</span></div><div className="filter-bar"><select className="action-select" value={trendTopic} onChange={e=>setTrendTopic(e.target.value)}><option value="all">Select problem</option>{trendTopics.map(topic=><option key={topic} value={topic}>{topic}</option>)}</select><select className="action-select" value={trendSemester} onChange={e=>setTrendSemester(e.target.value)}><option value="all">All semesters</option>{[...new Set([...SEMESTERS, ...trendSemesters])].map(semester=><option key={semester} value={semester}>{semester}</option>)}</select><select className="action-select" value={trendSentiment} onChange={e=>setTrendSentiment(e.target.value)}><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></div><ResponsiveContainer width="100%" height={280}><LineChart data={problemTrend.counts}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="semester"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="feedback" name={`${trendSentiment[0].toUpperCase() + trendSentiment.slice(1)} feedback`} stroke={COLORS[trendSentiment]} strokeWidth={3} connectNulls/></LineChart></ResponsiveContainer><div className="insight-row"><div><strong>{selectedTrendTopic}</strong><span>{problemTrend.first} → {problemTrend.last} {trendSentiment} feedback · {problemTrend.recurring ? "appears across multiple semesters" : "appears in one semester"}</span></div><strong>{problemTrend.direction}</strong></div></section></section>}
      {tab==="suggestions" && <section className="card"><div className="section-head"><div><h2>Recommended improvements</h2><p>Suggestions generated from negative feedback, detected topics, departments, and priority.</p></div></div>{suggestions.length===0?<div className="empty-state">No negative feedback yet. Suggestions will appear as students report issues.</div>:<div className="feedback-list">{suggestions.map(item=><article className="feedback-item" key={`${item.topic}-${item.department}`}><div className="fb-header"><strong>{item.topic}</strong><span className="subtle-tag">{item.department}</span><span className="fb-priority">{item.count} negative reports</span><span className="subtle-tag">{item.urgency}</span></div><p className="fb-text">{item.suggestion}</p><span className="fb-date">Based on live feedback patterns</span></article>)}</div>}</section>}
    </main>
  </div>;

  function FeedbackList({items,filter,setFilter,query,setQuery}) {
    const visibleItems = items.filter(f => !query || `${f.text} ${f.student_name} ${f.detected_aspect} ${f.aspect} ${routeDepartment(f)}`.toLowerCase().includes(query.toLowerCase()));
    return <section className="card"><div className="section-head"><div><h2>All student feedback</h2><p>Review original messages and their automatically assigned priority.</p></div></div><div className="filter-bar"><input className="search-input" placeholder="Search feedback…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="filter-btns">{["all","positive","neutral","negative","High"].map(f=><button key={f} className={`filter-btn ${filter===f?"filter-active":""}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="feedback-list">{visibleItems.map(f=><article className="feedback-item" key={f.id}><div className="fb-header"><span className="fb-student">Student #{String(f.student_id).slice(0,6)}</span><span className="subtle-tag">→ {routeDepartment(f)}</span>{f.detected_aspect&&<span className="subtle-tag">{f.detected_aspect}</span>}<span className="fb-sentiment" style={{color:COLORS[f.sentiment]||"var(--muted)",background:`${COLORS[f.sentiment]||"#64748b"}18`}}>{f.sentiment}</span><span className="fb-priority" style={{color:f.priority==="High"?"var(--danger)":f.priority==="Medium"?"var(--warning)":"var(--success)"}}>{f.priority || "Pending"} priority</span></div><p className="fb-text">{f.text}</p><div className="fb-footer"><span className="fb-date">{new Date(f.created_at).toLocaleString()}</span></div></article>)}{visibleItems.length===0&&<div className="empty-state">No matching feedback found.</div>}</div></section>;
  }
}
