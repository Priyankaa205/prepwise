import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from "firebase/firestore";

const PLACEMENT_DATE = new Date("2025-11-01");

const COMPANIES = [
  { name: "TCS",       cutoff: 40, icon: "🏢" },
  { name: "Infosys",   cutoff: 50, icon: "💼" },
  { name: "Wipro",     cutoff: 45, icon: "🔷" },
  { name: "Cognizant", cutoff: 55, icon: "🌐" },
  { name: "Accenture", cutoff: 60, icon: "⚡" },
  { name: "Amazon",    cutoff: 80, icon: "📦" },
  { name: "Microsoft", cutoff: 85, icon: "🪟" },
  { name: "Google",    cutoff: 90, icon: "🎯" },
];

// ── HELPERS ──
function calcScore(data, goals) {
  if (!data.length) return { score: 0, level: "Not Started", breakdown: {}, totals: { coding: 0, aptitude: 0, interviews: 0, studyHours: 0 }, days: 0 };
  const days = data.length;
  const totals = data.reduce(
    (a, d) => ({ coding: a.coding + d.coding, aptitude: a.aptitude + d.aptitude, interviews: a.interviews + d.interviews, studyHours: a.studyHours + d.studyHours }),
    { coding: 0, aptitude: 0, interviews: 0, studyHours: 0 }
  );
  const avg = { coding: totals.coding / days, aptitude: totals.aptitude / days, interviews: totals.interviews / days, studyHours: totals.studyHours / days };
  const score = Math.min(100, Math.round(
    (avg.coding / goals.coding) * 40 + (avg.aptitude / goals.aptitude) * 20 +
    (avg.interviews / goals.interviews) * 30 + (avg.studyHours / goals.studyHours) * 10
  ));
  const level = score >= 80 ? "Placement Ready 🎉" : score >= 60 ? "Almost There 💪" : score >= 40 ? "Keep Going 📈" : "Just Started 🌱";
  return { score, level, breakdown: avg, totals, days };
}

function calcStreak(data) {
  if (!data.length) return 0;
  const sorted = [...data].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  let streak = 0, current = new Date(); current.setHours(0, 0, 0, 0);
  for (const d of sorted) {
    const dDate = new Date(d.date || d.createdAt); dDate.setHours(0, 0, 0, 0);
    const diff = Math.round((current - dDate) / 86400000);
    if (diff === 0 || diff === 1) { streak++; current = dDate; } else break;
  }
  return streak;
}

function getBadges(totals, streak, score) {
  return [
    { id: "first", icon: "🎖️", label: "First Step",     desc: "Log your first activity",  earned: totals.coding + totals.aptitude + totals.interviews + totals.studyHours > 0 },
    { id: "s3",    icon: "🔥", label: "On Fire",         desc: "3-day streak",              earned: streak >= 3 },
    { id: "s7",    icon: "⚡", label: "Unstoppable",     desc: "7-day streak",              earned: streak >= 7 },
    { id: "coder", icon: "💻", label: "Code Warrior",    desc: "50+ coding problems",       earned: totals.coding >= 50 },
    { id: "mock",  icon: "🎤", label: "Interview Pro",   desc: "10+ mock interviews",       earned: totals.interviews >= 10 },
    { id: "study", icon: "📚", label: "Scholar",         desc: "100+ study hours",          earned: totals.studyHours >= 100 },
    { id: "r60",   icon: "🎯", label: "Getting Serious", desc: "Score above 60%",           earned: score >= 60 },
    { id: "r80",   icon: "🏆", label: "Placement Ready", desc: "Score above 80%",           earned: score >= 80 },
  ];
}

function getRecommendations(score, breakdown) {
  const r = [];
  if (!breakdown.coding     || breakdown.coding < 2)      r.push({ priority: "HIGH", label: "Coding",     action: "Solve at least 2 coding problems daily",     delta: "+12%", color: "#34D399" });
  if (!breakdown.interviews || breakdown.interviews < 0.5) r.push({ priority: "HIGH", label: "Interviews", action: "Practice 1 mock interview every 2 days",       delta: "+10%", color: "#C084FC" });
  if (!breakdown.aptitude   || breakdown.aptitude < 1)     r.push({ priority: "MED",  label: "Aptitude",   action: "Attempt 1 aptitude test daily",               delta: "+6%",  color: "#FB923C" });
  if (!breakdown.studyHours || breakdown.studyHours < 2)   r.push({ priority: "MED",  label: "Study",      action: "Study for at least 2 focused hours each day", delta: "+5%",  color: "#38BDF8" });
  if (score >= 70) r.push({ priority: "LOW", label: "Advanced", action: "Focus on advanced DSA — Graphs & DP", delta: "+8%", color: "#F472B6" });
  if (!r.length) r.push({ priority: "LOW", label: "Maintain", action: "Keep up the excellent work!", delta: "💪", color: "#34D399" });
  return r.slice(0, 4);
}

function buildHeatmap(data) {
  const map = {};
  data.forEach(d => { const key = d.date || (d.createdAt || "").slice(0, 10); if (key) map[key] = (map[key] || 0) + d.coding + d.aptitude + d.interviews + d.studyHours; });
  const cells = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 83; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); const key = d.toISOString().slice(0, 10); cells.push({ date: key, value: map[key] || 0 }); }
  return cells;
}

// ── GLOBAL STYLES ──
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@300;400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0E0C1E; --surface: rgba(255,255,255,0.04); --surface2: rgba(255,255,255,0.07);
    --glass-border: rgba(255,255,255,0.10); --text: #EEE9FF; --muted: rgba(238,233,255,0.45);
    --hint: rgba(238,233,255,0.22); --c1: #C084FC; --c2: #38BDF8; --c3: #34D399; --c4: #FB923C; --c5: #F472B6;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Cabinet Grotesk', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .page-enter { animation: fadeUp 0.38s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes cardIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .card-anim { animation: cardIn 0.45s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes glowPulse { 0%,100% { filter: drop-shadow(0 0 8px rgba(192,132,252,0.5)); } 50% { filter: drop-shadow(0 0 20px rgba(56,189,248,0.7)); } }
  .gauge-glow { animation: glowPulse 3s ease-in-out infinite; }
  .nav-btn { display: flex; align-items: center; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid transparent; background: none; cursor: pointer; color: var(--muted); font-size: 13px; font-family: 'Cabinet Grotesk', sans-serif; font-weight: 500; margin-bottom: 3px; text-align: left; transition: all 0.22s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
  .nav-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.1); transform: translateX(2px); }
  .nav-btn.active { color: var(--c1); border-color: rgba(192,132,252,0.3); background: rgba(192,132,252,0.08); }
  .gc { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); position: relative; overflow: hidden; transition: border-color 0.22s, transform 0.22s; }
  .gc:hover { border-color: rgba(255,255,255,0.16); }
  .stat-card { transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.22s, box-shadow 0.22s; cursor: default; }
  .stat-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2) !important; }
  .co-card { transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s, border-color 0.22s; cursor: default; }
  .co-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 20px 48px rgba(0,0,0,0.35); }
  .badge-card { transition: transform 0.22s, box-shadow 0.22s, opacity 0.3s; }
  .badge-card:hover { transform: translateY(-3px) scale(1.03); }
  .f-inp { transition: border-color 0.2s, box-shadow 0.2s; }
  .f-inp:focus { border-color: rgba(192,132,252,0.6) !important; box-shadow: 0 0 0 3px rgba(192,132,252,0.10); outline: none; }
  .save-btn { transition: transform 0.18s, box-shadow 0.18s; }
  .save-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(192,132,252,0.35) !important; }
  .save-btn:active { transform: translateY(0); }
  .hm-cell { transition: transform 0.1s; border-radius: 4px; cursor: default; }
  .hm-cell:hover { transform: scale(1.5); }
  .co-tab { padding: 7px 16px; border-radius: 22px; font-size: 11px; font-family: 'DM Mono', monospace; cursor: pointer; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); color: var(--muted); transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
  .co-tab:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
  .co-tab.active { border-color: rgba(192,132,252,0.4); background: rgba(192,132,252,0.10); color: var(--c1); }
  .view-btn { padding: 6px 16px; border-radius: 20px; font-size: 11px; font-family: 'DM Mono', monospace; cursor: pointer; transition: all 0.2s; }
  .view-btn.active { border: 1px solid var(--c3) !important; background: rgba(52,211,153,0.10) !important; color: var(--c3) !important; }
  .view-btn.inactive { border: 1px solid rgba(255,255,255,0.10) !important; background: transparent !important; color: var(--muted) !important; }
  .signout-btn { transition: all 0.2s; }
  .signout-btn:hover { background: rgba(244,114,182,0.12) !important; border-color: rgba(244,114,182,0.4) !important; }
  .hist-row { transition: background 0.15s; }
  .hist-row:hover { background: rgba(255,255,255,0.035) !important; }
`;

// ── ANIMATED BAR ──
function AnimatedBar({ value, color, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 120 + delay); return () => clearTimeout(t); }, [value, delay]);
  return (
    <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 6, height: 7, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 6, background: `linear-gradient(90deg, ${color}, ${color}BB)`, width: `${w}%`, transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 10px ${color}44` }} />
    </div>
  );
}

// ── READINESS GAUGE ──
function ReadinessGauge({ score }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let s = 0;
    const step = () => { s += 1; setD(s); if (s < score) requestAnimationFrame(step); };
    const t = setTimeout(() => requestAnimationFrame(step), 500);
    return () => clearTimeout(t);
  }, [score]);
  const r = 72, cx = 95, cy = 95, circ = 2 * Math.PI * r, off = circ - (d / 100) * circ * 0.75;
  const col = d < 40 ? "#F472B6" : d < 65 ? "#FB923C" : "#34D399";
  return (
    <svg viewBox="0 0 190 175" style={{ width: "100%", maxWidth: 210 }}>
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="13"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="13"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeDashoffset={off}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
        className="gauge-glow"
        style={{ transition: "stroke-dashoffset 0.05s linear", filter: `drop-shadow(0 0 12px ${col}90)` }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#EEE9FF" fontSize="34" fontWeight="700" fontFamily="Syne,sans-serif">{d}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(238,233,255,0.35)" fontSize="10" fontFamily="DM Mono,monospace">READINESS</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill={col} fontSize="9.5" fontFamily="DM Mono,monospace">
        {d < 40 ? "NEEDS WORK" : d < 65 ? "DEVELOPING" : "PLACEMENT READY"}
      </text>
    </svg>
  );
}

// ── SCORE CIRCLE ──
function ScoreCircle({ pct, size = 110, stroke = 10 }) {
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(pct), 300); return () => clearTimeout(t); }, [pct]);
  const r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r, fill = (p / 100) * circ;
  const col = p >= 80 ? "#34D399" : p >= 60 ? "#FB923C" : p >= 40 ? "#C084FC" : "#F472B6";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 10px ${col}80)` }} />
    </svg>
  );
}

// ════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════
export default function App({ user }) {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState([]);
  const [form, setForm] = useState({ coding: "", aptitude: "", interviews: "", studyHours: "", date: new Date().toISOString().split("T")[0] });
  const [goals, setGoals] = useState({ coding: 3, aptitude: 2, interviews: 1, studyHours: 4 });
  const [msg, setMsg] = useState("");
  const [view, setView] = useState("weekly");
  const [selCo, setSelCo] = useState("Google");
  const [pageKey, setPageKey] = useState(0);

  // ✅ ML STATES
  const [mlScore, setMlScore] = useState(null);
  const [mlRecs, setMlRecs] = useState([]);

  // ── ML: Get score from Flask ──
  const fetchMLScore = async (activities) => {
    if (!activities.length) return;
    try {
      const totals = activities.reduce(
        (a, d) => ({
          coding: a.coding + d.coding,
          aptitude: a.aptitude + d.aptitude,
          interviews: a.interviews + d.interviews,
          studyHours: a.studyHours + d.studyHours,
        }),
        { coding: 0, aptitude: 0, interviews: 0, studyHours: 0 }
      );
      const res = await axios.post("http://localhost:8000/predict", {
        total_coding: totals.coding,
        total_aptitude: totals.aptitude,
        total_interviews: totals.interviews,
        total_study_hrs: totals.studyHours,
      });
      setMlScore(res.data.readiness_score);
      setMlRecs(res.data.recommendations);
    } catch (e) {
      console.log("ML error (Flask not running?):", e);
    }
  };

  // ── FIRESTORE: Fetch activities ──
  const fetchData = async () => {
    try {
      const q = query(
        collection(db, "activities"),
        where("uid", "==", auth.currentUser?.uid),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      setData(list);
      fetchMLScore(list); // ✅ ML call after Firestore fetch
    } catch (e) {
      console.log("Fetch error:", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const switchTab = (id) => { setTab(id); setPageKey(k => k + 1); };

  // ── FIRESTORE: Save activity ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "activities"), {
        uid: auth.currentUser?.uid,
        coding: Number(form.coding),
        aptitude: Number(form.aptitude),
        interviews: Number(form.interviews),
        studyHours: Number(form.studyHours),
        date: form.date,
        createdAt: new Date().toISOString(),
      });
      setMsg("saved");
      setForm({ coding: "", aptitude: "", interviews: "", studyHours: "", date: new Date().toISOString().split("T")[0] });
      fetchData();
      setTimeout(() => setMsg(""), 3500);
    } catch (e) {
      console.log("Save error:", e);
      setMsg("error");
    }
  };

  // ── FIRESTORE: Delete activity ──
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "activities", id));
    fetchData();
  };

  const sd = calcScore(data, goals);
  const streak = calcStreak(data);
  const badges = getBadges(sd.totals, streak, sd.score);
  const recs = getRecommendations(sd.score, sd.breakdown || {});
  const heatmap = buildHeatmap(data);
  const daysLeft = Math.max(0, Math.ceil((PLACEMENT_DATE - new Date()) / 86400000));
  const sorted = [...data].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  const chartData = (view === "weekly" ? sorted.slice(-7) : sorted.slice(-30)).map((d, i) => ({
    name: d.date ? d.date.slice(5) : `D${i + 1}`,
    Coding: d.coding, Aptitude: d.aptitude, Interviews: d.interviews, "Study Hrs": d.studyHours,
  }));

  // Score to use everywhere — ML if available, else formula
  const displayScore = mlScore !== null ? mlScore : sd.score;

  const navItems = [
    { id: "dashboard", label: "Dashboard",    icon: "◈" },
    { id: "log",       label: "Log Activity", icon: "＋" },
    { id: "score",     label: "AI Score",     icon: "◎" },
    { id: "gaps",      label: "Gap Analysis", icon: "△" },
    { id: "badges",    label: "Badges",       icon: "⬡" },
    { id: "heatmap",   label: "Heatmap",      icon: "▦" },
    { id: "history",   label: "History",      icon: "☰" },
    { id: "goals",     label: "Goals",        icon: "◉" },
  ];

  const heatColor = v => {
    if (v === 0) return "rgba(255,255,255,0.06)";
    if (v < 5)   return "rgba(52,211,153,0.25)";
    if (v < 10)  return "rgba(52,211,153,0.5)";
    if (v < 20)  return "rgba(52,211,153,0.75)";
    return "#34D399";
  };

  const gc = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: "22px 24px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", position: "relative", overflow: "hidden" };
  const inp = { width: "100%", padding: "12px 15px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#EEE9FF", fontSize: 14, fontFamily: "'Cabinet Grotesk',sans-serif", outline: "none" };
  const mono = { fontFamily: "'DM Mono',monospace" };
  const syne = { fontFamily: "'Syne',sans-serif" };

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* AMBIENT ORBS */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", background: "rgba(192,132,252,0.12)", filter: "blur(110px)", top: -120, left: -160 }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", background: "rgba(56,189,248,0.10)", filter: "blur(100px)", top: "35%", right: -130 }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(52,211,153,0.08)", filter: "blur(90px)", bottom: -80, left: "28%" }} />
      </div>

      <div style={{ minHeight: "100vh", display: "flex", position: "relative", zIndex: 1 }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", padding: "28px 14px", background: "rgba(255,255,255,0.025)", borderRight: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
          <div style={{ padding: "0 10px 26px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#C084FC,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: "#fff", boxShadow: "0 8px 24px rgba(192,132,252,0.35)", ...syne }}>P</div>
              <div>
                <div style={{ ...syne, fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>PrepWise</div>
                <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", letterSpacing: "1px", marginTop: 2 }}>PLACEMENT AI</div>
              </div>
            </div>
          </div>

          <div style={{ margin: "0 4px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, padding: "10px 13px" }}>
            <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", letterSpacing: "0.5px" }}>LOGGED IN AS</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: "#EEE9FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
          </div>

          {streak > 0 && (
            <div style={{ margin: "0 4px 14px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 11, padding: "12px 14px" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🔥</div>
              <div style={{ ...syne, fontSize: 26, fontWeight: 800, color: "#FB923C", lineHeight: 1 }}>{streak}</div>
              <div style={{ ...mono, fontSize: 9, color: "rgba(251,146,60,0.5)", marginTop: 3 }}>DAY STREAK</div>
            </div>
          )}

          <nav style={{ flex: 1 }}>
            {navItems.map(item => (
              <button key={item.id} className={`nav-btn${tab === item.id ? " active" : ""}`} onClick={() => switchTab(item.id)}>
                <span style={{ fontSize: 14, marginRight: 10 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 11, padding: "11px 14px", textAlign: "center" }}>
              <div style={{ ...syne, fontSize: 28, fontWeight: 800, color: daysLeft < 30 ? "#F472B6" : "#34D399", lineHeight: 1 }}>{daysLeft}</div>
              <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginTop: 3 }}>DAYS TO PLACEMENT</div>
            </div>
            <button className="signout-btn" onClick={() => signOut(auth)} style={{ width: "100%", padding: "9px", borderRadius: 10, border: "1px solid rgba(244,114,182,0.2)", background: "rgba(244,114,182,0.05)", color: "#F472B6", cursor: "pointer", fontSize: 12, ...mono }}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ marginLeft: 230, flex: 1, padding: "36px 40px", minHeight: "100vh" }}>
          <div key={pageKey} className="page-enter">

            {/* ══ DASHBOARD ══ */}
            {tab === "dashboard" && (
              <div>
                <div style={{ marginBottom: 30 }}>
                  <div style={{ ...syne, fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>Dashboard 👋</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>{new Date().toDateString().toUpperCase()} · {daysLeft} DAYS REMAINING</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
                  {[
                    { label: "Coding Problems", value: sd.totals.coding,     color: "#34D399", icon: "💻", pct: Math.min(100, (sd.totals.coding / (goals.coding * 30)) * 100) },
                    { label: "Aptitude Tests",  value: sd.totals.aptitude,   color: "#FB923C", icon: "🧠", pct: Math.min(100, (sd.totals.aptitude / (goals.aptitude * 30)) * 100) },
                    { label: "Mock Interviews", value: sd.totals.interviews, color: "#C084FC", icon: "🎤", pct: Math.min(100, (sd.totals.interviews / (goals.interviews * 30)) * 100) },
                    { label: "Study Hours",     value: sd.totals.studyHours, color: "#38BDF8", icon: "📚", pct: Math.min(100, (sd.totals.studyHours / (goals.studyHours * 30)) * 100) },
                  ].map((s, i) => (
                    <div key={s.label} className="gc stat-card card-anim" style={{ ...gc, padding: "20px 20px", animationDelay: `${i * 80}ms`, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.color, filter: "blur(32px)", opacity: 0.3, pointerEvents: "none" }} />
                      <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 10, letterSpacing: "0.5px" }}>{s.label.toUpperCase()}</div>
                      <div style={{ ...syne, fontSize: 38, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
                      <AnimatedBar value={s.pct} color={s.color} delay={i * 100} />
                      <div style={{ fontSize: 11, color: "rgba(238,233,255,0.3)", marginTop: 7 }}>{s.icon} total logged</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, marginBottom: 18 }}>
                  <div className="gc" style={{ ...gc, display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 18px" }}>
                    <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 10, letterSpacing: "0.5px", alignSelf: "flex-start" }}>ML READINESS</div>
                    {/* ✅ ML Score in Gauge */}
                    <ReadinessGauge score={displayScore} />
                    <div style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.3)", marginTop: 6, textAlign: "center" }}>{sd.level}</div>
                    <div style={{ ...mono, fontSize: 9, color: mlScore !== null ? "#34D399" : "rgba(238,233,255,0.2)", marginTop: 3 }}>
                      {mlScore !== null ? "scikit-learn · live ✅" : "formula based"}
                    </div>
                  </div>
                  <div className="gc" style={gc}>
                    <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 18, letterSpacing: "0.5px" }}>SKILL OVERVIEW</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {[
                        { label: "Coding",     value: Math.min(100, Math.round((sd.breakdown.coding     || 0) / goals.coding     * 100)), color: "#34D399", icon: "💻" },
                        { label: "Aptitude",   value: Math.min(100, Math.round((sd.breakdown.aptitude   || 0) / goals.aptitude   * 100)), color: "#FB923C", icon: "🧠" },
                        { label: "Interviews", value: Math.min(100, Math.round((sd.breakdown.interviews || 0) / goals.interviews * 100)), color: "#C084FC", icon: "🎤" },
                        { label: "Study Hrs",  value: Math.min(100, Math.round((sd.breakdown.studyHours || 0) / goals.studyHours * 100)), color: "#38BDF8", icon: "📚" },
                      ].map((s, i) => (
                        <div key={s.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: "rgba(238,233,255,0.7)" }}>{s.icon} {s.label}</span>
                            <span style={{ ...mono, fontSize: 12, color: s.color, fontWeight: 500 }}>{s.value}%</span>
                          </div>
                          <AnimatedBar value={s.value} color={s.color} delay={i * 110} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ✅ ML Recommendations from Flask */}
                {mlRecs.length > 0 && (
                  <div className="gc" style={{ ...gc, marginBottom: 18, border: "1px solid rgba(192,132,252,0.2)" }}>
                    <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 14, letterSpacing: "0.5px" }}>🤖 ML RECOMMENDATIONS · scikit-learn</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {mlRecs.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", borderLeft: "3px solid #C084FC", transition: "background 0.18s" }}
                          onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                          onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                          <div style={{ ...mono, fontSize: 9, color: r.priority === "HIGH" ? "#F472B6" : "#FB923C", background: r.priority === "HIGH" ? "rgba(244,114,182,0.12)" : "rgba(251,146,60,0.12)", padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" }}>{r.priority}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#C084FC", textTransform: "capitalize" }}>{r.skill}</div>
                            <div style={{ fontSize: 12, color: "rgba(238,233,255,0.5)", marginTop: 1 }}>{r.action}</div>
                          </div>
                          <div style={{ ...mono, fontSize: 12, color: "#34D399" }}>{r.delta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback Recommendations */}
                {mlRecs.length === 0 && data.length > 0 && (
                  <div className="gc" style={{ ...gc, marginBottom: 18 }}>
                    <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 14, letterSpacing: "0.5px" }}>AI RECOMMENDATIONS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {recs.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${r.color}`, transition: "background 0.18s" }}
                          onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                          onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                          <div style={{ ...mono, fontSize: 9, color: r.priority === "HIGH" ? "#F472B6" : r.priority === "MED" ? "#FB923C" : "#38BDF8", background: r.priority === "HIGH" ? "rgba(244,114,182,0.12)" : r.priority === "MED" ? "rgba(251,146,60,0.12)" : "rgba(56,189,248,0.12)", padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" }}>{r.priority}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.label}</div>
                            <div style={{ fontSize: 12, color: "rgba(238,233,255,0.5)", marginTop: 1 }}>{r.action}</div>
                          </div>
                          <div style={{ ...mono, fontSize: 12, color: "#34D399" }}>{r.delta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.length > 0 ? (
                  <div className="gc" style={gc}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", letterSpacing: "0.5px" }}>ACTIVITY OVERVIEW · {data.length} ENTRIES</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["weekly", "monthly"].map(v => (
                          <button key={v} className={`view-btn ${view === v ? "active" : "inactive"}`} onClick={() => setView(v)}>
                            {v === "weekly" ? "7 Days" : "30 Days"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(238,233,255,0.25)" fontSize={10} tickLine={false} />
                        <YAxis stroke="rgba(238,233,255,0.25)" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: "rgba(14,12,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#EEE9FF", fontSize: "0.82rem" }} />
                        <Legend wrapperStyle={{ fontSize: "0.76rem", color: "rgba(238,233,255,0.45)" }} />
                        <Bar dataKey="Coding"     fill="#34D399" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="Aptitude"   fill="#FB923C" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="Interviews" fill="#C084FC" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="Study Hrs"  fill="#38BDF8" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="gc" style={{ ...gc, textAlign: "center", padding: "3.5rem" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📊</div>
                    <div style={{ ...syne, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No activities yet</div>
                    <div style={{ fontSize: 13, color: "rgba(238,233,255,0.4)", marginBottom: 20 }}>Start logging to see your dashboard come alive</div>
                    <button className="save-btn" onClick={() => switchTab("log")} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#C084FC,#38BDF8)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, ...syne, boxShadow: "0 8px 24px rgba(192,132,252,0.3)" }}>
                      Log First Activity →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══ LOG ACTIVITY ══ */}
            {tab === "log" && (
              <div style={{ maxWidth: 520 }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700, letterSpacing: "-0.4px" }}>Log Activity</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>TRACK YOUR DAILY PREPARATION</div>
                </div>
                {msg === "saved" ? (
                  <div className="gc" style={{ ...gc, textAlign: "center", padding: "44px", border: "1px solid rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.04)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,rgba(52,211,153,0.2),rgba(56,189,248,0.2))", border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
                    <div style={{ ...syne, fontSize: 20, fontWeight: 700, color: "#34D399" }}>Activity Saved to Firestore!</div>
                    <div style={{ fontSize: 13, color: "rgba(238,233,255,0.45)", marginTop: 8 }}>Your readiness score has been updated.</div>
                    <button onClick={() => setMsg("")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(238,233,255,0.6)", cursor: "pointer", fontSize: 13, fontFamily: "'Cabinet Grotesk',sans-serif" }}>
                      Log Another
                    </button>
                  </div>
                ) : (
                  <div className="gc" style={gc}>
                    <form onSubmit={handleSubmit}>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.35)", marginBottom: 8, letterSpacing: "0.5px" }}>DATE</div>
                        <input className="f-inp" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} />
                      </div>
                      {[
                        { key: "coding",     label: "Coding Problems Solved", color: "#34D399", icon: "💻" },
                        { key: "aptitude",   label: "Aptitude Questions",     color: "#FB923C", icon: "🧠" },
                        { key: "interviews", label: "Mock Interviews",         color: "#C084FC", icon: "🎤" },
                        { key: "studyHours", label: "Study Hours",             color: "#38BDF8", icon: "📚" },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom: 18 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 9, color: "rgba(238,233,255,0.35)", marginBottom: 8, letterSpacing: "0.5px" }}>
                            <span>{f.icon} {f.label.toUpperCase()}</span>
                            <span style={{ color: f.color }}>GOAL: {goals[f.key]}/day</span>
                          </div>
                          <input className="f-inp" type="number" min="0" required placeholder="0" value={form[f.key]}
                            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                            style={{ ...inp, borderColor: form[f.key] ? f.color + "50" : "rgba(255,255,255,0.10)" }} />
                        </div>
                      ))}
                      <button type="submit" className="save-btn" style={{ width: "100%", padding: "13px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#C084FC,#38BDF8)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", ...syne, boxShadow: "0 8px 24px rgba(192,132,252,0.28)" }}>
                        Save to Firestore →
                      </button>
                      {msg === "error" && <div style={{ textAlign: "center", color: "#F472B6", marginTop: 12, fontSize: 13 }}>✗ Something went wrong. Check console.</div>}
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ══ AI SCORE ══ */}
            {tab === "score" && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700, letterSpacing: "-0.4px" }}>AI Score</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>PLACEMENT READINESS · scikit-learn ML MODEL</div>
                </div>
                {data.length === 0 ? (
                  <div className="gc" style={{ ...gc, textAlign: "center", padding: "3.5rem" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎯</div>
                    <div style={{ ...syne, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No data yet</div>
                    <button className="save-btn" onClick={() => switchTab("log")} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#C084FC,#38BDF8)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, ...syne }}>
                      Start Logging →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="gc" style={{ ...gc, marginBottom: 18, border: "1px solid rgba(52,211,153,0.2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
                        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
                          <ScoreCircle pct={displayScore} />
                          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                            <div style={{ ...syne, fontSize: "1.5rem", fontWeight: 900, color: displayScore >= 80 ? "#34D399" : displayScore >= 60 ? "#FB923C" : "#C084FC" }}>{displayScore}%</div>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.35)", marginBottom: 6, letterSpacing: "0.5px" }}>OVERALL READINESS</div>
                          <div style={{ ...syne, fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>{sd.level}</div>
                          <div style={{ fontSize: 13, color: "rgba(238,233,255,0.4)" }}>Based on <strong style={{ color: "#EEE9FF" }}>{sd.days}</strong> days of activity</div>
                          <div style={{ ...mono, fontSize: 10, color: mlScore !== null ? "#34D399" : "rgba(238,233,255,0.3)", marginTop: 6 }}>
                            {mlScore !== null ? "🤖 scikit-learn ML · live" : "⚡ formula based · start Flask for ML"}
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {[
                            { label: "Coding",     value: sd.breakdown.coding?.toFixed(1),     color: "#34D399", icon: "💻" },
                            { label: "Aptitude",   value: sd.breakdown.aptitude?.toFixed(1),   color: "#FB923C", icon: "🧠" },
                            { label: "Interviews", value: sd.breakdown.interviews?.toFixed(1), color: "#C084FC", icon: "🎤" },
                            { label: "Study Hrs",  value: sd.breakdown.studyHours?.toFixed(1), color: "#38BDF8", icon: "📚" },
                          ].map(b => (
                            <div key={b.label} style={{ background: "rgba(255,255,255,0.05)", padding: "11px 14px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 4 }}>{b.icon} {b.label.toUpperCase()}</div>
                              <div style={{ ...mono, fontSize: "1rem", fontWeight: 700, color: b.color }}>{b.value}/day</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="gc" style={gc}>
                      <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 18, letterSpacing: "0.5px" }}>COMPANY READINESS</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                        {COMPANIES.map((c, i) => {
                          const ready = displayScore >= c.cutoff, pct = Math.min(100, Math.round((displayScore / c.cutoff) * 100));
                          return (
                            <div key={c.name} className="co-card card-anim" style={{ background: ready ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.03)", borderRadius: 13, padding: "18px 20px", border: `1px solid ${ready ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`, animationDelay: `${i * 60}ms`, position: "relative", overflow: "hidden" }}>
                              <div style={{ position: "absolute", top: -16, right: -16, width: 60, height: 60, borderRadius: "50%", background: ready ? "#34D399" : "#C084FC", filter: "blur(28px)", opacity: 0.18, pointerEvents: "none" }} />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                                  <div>
                                    <div style={{ ...syne, fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                                    <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.35)", marginTop: 1 }}>Cutoff: {c.cutoff}%</div>
                                  </div>
                                </div>
                                <span style={{ ...mono, fontSize: 10, padding: "4px 11px", borderRadius: 20, fontWeight: 600, background: ready ? "rgba(52,211,153,0.15)" : "rgba(244,114,182,0.12)", color: ready ? "#34D399" : "#F472B6" }}>
                                  {ready ? "✓ READY" : "✗ NOT YET"}
                                </span>
                              </div>
                              <AnimatedBar value={pct} color={ready ? "#34D399" : "#C084FC"} delay={i * 60} />
                              <div style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.3)", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                                <span>Yours: <span style={{ color: ready ? "#34D399" : "#F472B6", fontWeight: 600 }}>{displayScore}%</span></span>
                                <span>Need: {c.cutoff}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ GAP ANALYSIS ══ */}
            {tab === "gaps" && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700 }}>Gap Analysis</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>COMPANY-SPECIFIC READINESS</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
                  {COMPANIES.map(c => (
                    <button key={c.name} className={`co-tab${selCo === c.name ? " active" : ""}`} onClick={() => setSelCo(c.name)}>
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
                {(() => {
                  const co = COMPANIES.find(c => c.name === selCo);
                  const ready = displayScore >= co.cutoff, gap = Math.max(0, co.cutoff - displayScore);
                  return (
                    <>
                      <div className="gc" style={{ ...gc, marginBottom: 16, border: `1px solid ${ready ? "rgba(52,211,153,0.25)" : "rgba(244,114,182,0.2)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                          <div>
                            <div style={{ ...syne, fontSize: 22, fontWeight: 700 }}>{co.icon} {co.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.35)", marginTop: 4 }}>MINIMUM SCORE: {co.cutoff}%</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ ...syne, fontSize: 30, fontWeight: 800, color: ready ? "#34D399" : "#F472B6" }}>{ready ? "✓ Ready!" : `−${gap}%`}</div>
                            <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.35)" }}>{ready ? "YOU QUALIFY" : "GAP REMAINING"}</div>
                          </div>
                        </div>
                        <AnimatedBar value={Math.min(100, Math.round((displayScore / co.cutoff) * 100))} color={ready ? "#34D399" : "#F472B6"} />
                        <div style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.3)", marginTop: 8 }}>Your score: {displayScore}% · Required: {co.cutoff}%</div>
                      </div>
                      <div className="gc" style={gc}>
                        <div style={{ ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", marginBottom: 14, letterSpacing: "0.5px" }}>AI RECOMMENDATIONS FOR {selCo.toUpperCase()}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                          {(mlRecs.length > 0 ? mlRecs : recs).map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${r.color || "#C084FC"}`, transition: "background 0.18s" }}
                              onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                              onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                              <div style={{ ...mono, fontSize: 9, color: r.priority === "HIGH" ? "#F472B6" : "#FB923C", background: r.priority === "HIGH" ? "rgba(244,114,182,0.12)" : "rgba(251,146,60,0.12)", padding: "3px 9px", borderRadius: 5 }}>{r.priority}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{r.skill || r.label}</div>
                                <div style={{ fontSize: 12, color: "rgba(238,233,255,0.5)", marginTop: 2 }}>{r.action}</div>
                              </div>
                              <div style={{ ...mono, fontSize: 12, color: "#34D399" }}>{r.delta}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ══ BADGES ══ */}
            {tab === "badges" && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700 }}>Badges</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>{badges.filter(b => b.earned).length}/{badges.length} EARNED · {streak > 0 ? `🔥 ${streak} DAY STREAK` : "NO STREAK YET"}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
                  {badges.map((b, i) => (
                    <div key={b.id} className="gc badge-card card-anim" style={{ ...gc, textAlign: "center", padding: "28px 20px", opacity: b.earned ? 1 : 0.35, border: b.earned ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.07)", animationDelay: `${i * 60}ms` }}>
                      {b.earned && <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 60, height: 60, borderRadius: "50%", background: "#34D399", filter: "blur(24px)", opacity: 0.25 }} />}
                      <div style={{ fontSize: "2.2rem", marginBottom: 12, filter: b.earned ? "none" : "grayscale(100%)" }}>{b.icon}</div>
                      <div style={{ ...syne, fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{b.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(238,233,255,0.4)" }}>{b.desc}</div>
                      {b.earned && <div style={{ ...mono, fontSize: 10, color: "#34D399", marginTop: 12 }}>✓ EARNED</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ HEATMAP ══ */}
            {tab === "heatmap" && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700 }}>Activity Heatmap</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>LAST 12 WEEKS · GITHUB STYLE</div>
                </div>
                <div className="gc" style={{ ...gc }}>
                  <div style={{ overflowX: "auto", paddingBottom: 8 }}>
                    <div style={{ display: "flex", gap: 5, paddingBottom: 6 }}>
                      {Array.from({ length: 12 }).map((_, wi) => (
                        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {heatmap.slice(wi * 7, wi * 7 + 7).map((cell, di) => (
                            <div key={di} className="hm-cell" title={`${cell.date}: ${cell.value} activities`}
                              style={{ width: 16, height: 16, background: heatColor(cell.value) }} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                    <span style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.3)" }}>Less</span>
                    {[0, 3, 8, 15, 25].map(v => <div key={v} style={{ width: 14, height: 14, borderRadius: 3, background: heatColor(v) }} />)}
                    <span style={{ ...mono, fontSize: 10, color: "rgba(238,233,255,0.3)" }}>More</span>
                  </div>
                </div>
              </div>
            )}

            {/* ══ HISTORY ══ */}
            {tab === "history" && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700 }}>History</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>{data.length} ENTRIES LOGGED</div>
                </div>
                {data.length === 0 ? (
                  <div className="gc" style={{ ...gc, textAlign: "center", padding: "3.5rem" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📋</div>
                    <div style={{ ...syne, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>No history yet</div>
                    <button className="save-btn" onClick={() => switchTab("log")} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#C084FC,#38BDF8)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, ...syne }}>
                      Log Activity →
                    </button>
                  </div>
                ) : (
                  <div className="gc" style={gc}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Date", "💻 Coding", "🧠 Aptitude", "🎤 Interviews", "📚 Study Hrs", ""].map(h => (
                              <th key={h} style={{ padding: "10px 16px", textAlign: "left", ...mono, fontSize: 9, color: "rgba(238,233,255,0.3)", letterSpacing: "0.5px" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...data].reverse().map(d => (
                            <tr key={d._id} className="hist-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "12px 16px", color: "rgba(238,233,255,0.4)", ...mono, fontSize: 11 }}>{d.date || d.createdAt?.slice(0, 10)}</td>
                              <td style={{ padding: "12px 16px", color: "#34D399", fontWeight: 700, ...mono }}>{d.coding}</td>
                              <td style={{ padding: "12px 16px", color: "#FB923C", fontWeight: 700, ...mono }}>{d.aptitude}</td>
                              <td style={{ padding: "12px 16px", color: "#C084FC", fontWeight: 700, ...mono }}>{d.interviews}</td>
                              <td style={{ padding: "12px 16px", color: "#38BDF8", fontWeight: 700, ...mono }}>{d.studyHours}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <button onClick={() => handleDelete(d._id)} style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.2)", color: "#F472B6", cursor: "pointer", fontSize: 11, padding: "5px 12px", borderRadius: 7, fontWeight: 600 }}
                                  onMouseOver={e => e.currentTarget.style.background = "rgba(244,114,182,0.2)"}
                                  onMouseOut={e => e.currentTarget.style.background = "rgba(244,114,182,0.1)"}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ GOALS ══ */}
            {tab === "goals" && (
              <div style={{ maxWidth: 500 }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...syne, fontSize: 26, fontWeight: 700 }}>Daily Goals</div>
                  <div style={{ ...mono, color: "rgba(238,233,255,0.35)", fontSize: 11, marginTop: 5, letterSpacing: "0.5px" }}>SET YOUR TARGETS · AFFECTS AI SCORE</div>
                </div>
                <div className="gc" style={gc}>
                  {[
                    { key: "coding",     label: "Coding Problems", color: "#34D399", icon: "💻", max: 15 },
                    { key: "aptitude",   label: "Aptitude Tests",  color: "#FB923C", icon: "🧠", max: 10 },
                    { key: "interviews", label: "Mock Interviews",  color: "#C084FC", icon: "🎤", max: 5  },
                    { key: "studyHours", label: "Study Hours",     color: "#38BDF8", icon: "📚", max: 12 },
                  ].map((f, i) => (
                    <div key={f.key} style={{ marginBottom: i < 3 ? 28 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</span>
                        <span style={{ marginLeft: "auto", ...mono, fontSize: 20, fontWeight: 700, color: f.color }}>{goals[f.key]}</span>
                      </div>
                      <input type="range" min="0" max={f.max} value={goals[f.key]}
                        onChange={e => setGoals({ ...goals, [f.key]: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: f.color, cursor: "pointer" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 9, color: "rgba(238,233,255,0.25)", marginTop: 4 }}>
                        <span>0</span><span>{Math.floor(f.max / 2)}</span><span>{f.max}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "13px 16px", background: "rgba(192,132,252,0.06)", borderRadius: 10, border: "1px solid rgba(192,132,252,0.15)", marginTop: 24 }}>
                    <div style={{ ...mono, fontSize: 11, color: "rgba(238,233,255,0.45)" }}>⚡ Goals affect your AI readiness score and all progress bars.</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}