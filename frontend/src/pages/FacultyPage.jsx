import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const COLORS = { positive: "#16a34a", neutral: "#d97706", negative: "#dc2626" };

export default function FacultyPage({ session, theme, toggleTheme }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [actions, setActions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    load();
    const channel = supabase.channel("feedback-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const [feedbackResult, actionResult, profileResult] = await Promise.all([
      supabase.from("feedbacks").select("*").order("created_at", { ascending: false }),
      supabase.from("actions").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", session.user.id).single()
    ]);
    const failed = [feedbackResult.error, actionResult.error, profileResult.error].find(Boolean);
    if (failed) {
      setLoadError("Admin data could not be loaded. Check that the Supabase schema is installed and your account has admin access.");
      return;
    }
    setLoadError("");
    setFeedbacks(feedbackResult.data || []);
    setActions(actionResult.data || []);
    setProfile(profileResult.data);
  }

  async function saveAction(fb) {
    if (!action?.note?.trim()) return;
    await supabase.from("actions").insert({
      feedback_id: fb.id, admin_id: session.user.id,
      admin_name: profile?.name || "Administrator", action_note: action.note.trim(), status: action.status
    });
    setAction(null); load();
  }

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const pos = feedbacks.filter(x=>x.sentiment==="positive").length;
    const neu = feedbacks.filter(x=>x.sentiment==="neutral").length;
    const neg = feedbacks.filter(x=>x.sentiment==="negative").length;
    const high = feedbacks.filter(x=>x.priority==="High").length;
    const medium = feedbacks.filter(x=>x.priority==="Medium").length;
    const low = feedbacks.filter(x=>x.priority==="Low").length;
    return { total, pos, neu, neg, high, medium, low, positivePct: total?Math.round(pos/total*100):0, negativePct: total?Math.round(neg/total*100):0 };
  }, [feedbacks]);

  const topics = useMemo(() => {
    const map = {};
    feedbacks.forEach(f => { const k=f.detected_aspect || f.aspect || "General"; map[k] ??= {topic:k,total:0,negative:0,positive:0}; map[k].total++; if(f.sentiment==="negative")map[k].negative++; if(f.sentiment==="positive")map[k].positive++; });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [feedbacks]);

  const pie = [{name:"Positive",value:stats.pos},{name:"Neutral",value:stats.neu},{name:"Negative",value:stats.neg}];
  const priorityPie = [{name:"High",value:stats.high},{name:"Medium",value:stats.medium},{name:"Low",value:stats.low}];
  const trend = useMemo(() => {
    const m={}; feedbacks.slice().reverse().forEach(f=>{const d=new Date(f.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"});m[d]=(m[d]||0)+1;});
    return Object.entries(m).slice(-14).map(([date,count])=>({date,count}));
  },[feedbacks]);

  const filtered = feedbacks.filter(f => (filter==="all" || f.sentiment===filter || f.priority===filter) && (!query || `${f.text} ${f.student_name} ${f.detected_aspect}`.toLowerCase().includes(query.toLowerCase())));
  const tabs = [["overview","Overview"],["feedbacks","All feedback"],["priorities","Priority queue"],["insights","Topics & trends"],["actions","Actions"]];

  return <div className="app-shell">
    <nav className="navbar admin-nav">
      <div className="brand-mark"><span>Student Feedback</span></div>
      <div className="nav-right"><button className="theme-btn" onClick={toggleTheme}>{theme==="light"?"☾":"☀"}</button><span className="nav-badge admin-badge">HOD / Admin</span><span className="nav-name">{profile?.name || session.user.email}</span><button className="logout-btn" onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </nav>
    <main className="admin-container">
      <div className="admin-welcome"><div><p className="eyebrow">CONTROL CENTER</p><h1>Feedback overview</h1><p>See what students are experiencing and turn recurring concerns into actions.</p></div><button className="outline-btn" onClick={load}>↻ Refresh</button></div>
      {loadError && <div className="alert alert-error">⚠ {loadError}</div>}
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
          <div className="chart-card"><h3 className="chart-title">Priority distribution</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={priorityPie} dataKey="value" nameKey="name" outerRadius={82} label>{priorityPie.map((item,i)=><Cell key={item.name} fill={["#dc2626","#d97706","#16a34a"][i]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
        </div>
        <section className="card"><div className="section-head"><div><h2>Recent feedback</h2><p>Original messages received most recently.</p></div><button className="outline-btn" onClick={()=>setTab("feedbacks")}>View all →</button></div>{feedbacks.length===0?<div className="empty-state">No feedback data available yet.</div>:<div className="feedback-list">{feedbacks.slice(0,5).map(f=><article className="feedback-item" key={f.id}><div className="fb-header"><span className="fb-date">{new Date(f.created_at).toLocaleString()}</span><span className="fb-sentiment" style={{color:COLORS[f.sentiment]||"var(--muted)",background:`${COLORS[f.sentiment]||"#64748b"}18`}}>{f.sentiment || "pending"}</span><span className="fb-priority">{f.priority || "Pending"}</span></div><p className="fb-text">{f.text}</p></article>)}</div>}</section>
        <section className="card"><div className="section-head"><div><h2>What students are talking about</h2><p>Topics are discovered from the wording of submitted feedback.</p></div><button className="outline-btn" onClick={()=>setTab("insights")}>View insights →</button></div><div className="topic-grid">{topics.slice(0,6).map(t=><div className="topic-card" key={t.topic}><strong>{t.topic}</strong><span>{t.total} messages</span><small>{t.negative} need attention</small></div>)}{topics.length===0&&<div className="empty-state">No feedback has been submitted yet.</div>}</div></section>
      </>}

      {tab==="feedbacks" && <FeedbackList items={filtered} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />}
      {tab==="priorities" && <FeedbackList items={filtered.filter(f=>f.priority==="High")} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} priorityOnly />}
      {tab === "insights" && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Topics & trends</h2>
              <p>Patterns inferred from the words students use.</p>
            </div>
          </div>
          <div className="charts-grid">
            <div className="chart-card">
              <h3 className="chart-title">Messages by topic</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topics.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="topic" width={110} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#4f46e5" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="insight-stack">
              {topics.map(t => (
                <div className="insight-row" key={t.topic}>
                  <div>
                    <strong>{t.topic}</strong>
                    <span>{t.total} total · {t.positive} positive · {t.negative} negative</span>
                  </div>
                  <div className="mini-progress">
                    <i style={{ width: `${t.total ? Math.round(t.negative / t.total * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {tab==="actions" && <section className="card"><div className="section-head"><div><h2>Action tracking</h2><p>Record what was done in response to a priority message.</p></div></div>{actions.length===0?<div className="empty-state">No actions recorded yet. Use “Take action” from the Priority queue.</div>:<div className="feedback-list">{actions.map(a=><div className="feedback-item" key={a.id}><div className="fb-header"><span className={`status-tag status-${a.status.toLowerCase().replace(" ","-")}`}>{a.status}</span><span className="fb-date">{new Date(a.created_at).toLocaleString()}</span></div><p className="fb-text">{a.action_note}</p></div>)}</div>}</section>}
    </main>
  </div>;

  function FeedbackList({items,filter,setFilter,query,setQuery,priorityOnly=false}) {
    return <section className="card"><div className="section-head"><div><h2>{priorityOnly?"Priority queue":"All student feedback"}</h2><p>Review original messages and their automatically assigned priority.</p></div></div><div className="filter-bar"><input className="search-input" placeholder="Search feedback…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="filter-btns">{["all","positive","neutral","negative","High"].map(f=><button key={f} className={`filter-btn ${filter===f?"filter-active":""}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><div className="feedback-list">{items.map(f=><article className="feedback-item" key={f.id}><div className="fb-header"><span className="fb-student">Student #{String(f.student_id).slice(0,6)}</span>{f.detected_aspect&&<span className="subtle-tag">{f.detected_aspect}</span>}<span className="fb-sentiment" style={{color:COLORS[f.sentiment]||"var(--muted)",background:`${COLORS[f.sentiment]||"#64748b"}18`}}>{f.sentiment}</span><span className="fb-priority" style={{color:f.priority==="High"?"var(--danger)":f.priority==="Medium"?"var(--warning)":"var(--success)"}}>{f.priority || "Pending"} priority</span></div><p className="fb-text">{f.text}</p><div className="fb-footer"><span className="fb-date">{new Date(f.created_at).toLocaleString()}</span>{f.priority==="High"&&<button className="take-action-btn" onClick={()=>setAction({feedback:f,note:"",status:"Assigned"})}>Take action</button>}</div>{action?.feedback?.id===f.id&&<div className="action-form"><select className="action-select" value={action.status} onChange={e=>setAction({...action,status:e.target.value})}><option>Assigned</option><option>In Progress</option><option>Resolved</option></select><input className="action-input" placeholder="Describe the action taken…" value={action.note} onChange={e=>setAction({...action,note:e.target.value})}/><div className="action-btns"><button className="action-save-btn" onClick={()=>saveAction(f)}>Save action</button><button className="action-cancel-btn" onClick={()=>setAction(null)}>Cancel</button></div></div>}</article>)}{items.length===0&&<div className="empty-state">No matching feedback found.</div>}</div></section>;
  }
}
