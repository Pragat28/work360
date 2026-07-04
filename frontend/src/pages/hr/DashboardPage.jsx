import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ─── API base – adjust if your backend runs on a different port ───────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ─── Fetch helper that attaches the JWT token from localStorage ───────────────
const apiFetch = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(opts.headers || {}),
    },
  }).then((r) => r.json());

const activityConfig = {
  subtask_completed: { icon: "✓", bg: "#dcfce7", color: "#16a34a", verb: "marked", suffix: "as done" },
  subtask_started:   { icon: "▶", bg: "#dbeafe", color: "#2563eb", verb: "started working on", suffix: "" },
  comment:           { icon: "💬", bg: "#f3e8ff", color: "#7c3aed", verb: "left a comment on", suffix: "" },
  rating:            { icon: "★", bg: "#fef9c3", color: "#ca8a04", verb: "rated", suffix: "" },
  project_created:   { icon: "+", bg: "#ffedd5", color: "#ea580c", verb: "created project", suffix: "" },
  subtask_created:   { icon: "📝", bg: "#fce7f3", color: "#be185d", verb: "created subtask", suffix: "" },
  project_edited:    { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", verb: "edited project", suffix: "" },
  project_deleted:   { icon: "🗑", bg: "#fee2e2", color: "#b91c1c", verb: "deleted project", suffix: "" },
  subtask_deleted:   { icon: "🗑", bg: "#fee2e2", color: "#b91c1c", verb: "deleted subtask", suffix: "" },
  project_assigned:  { icon: "👤", bg: "#ede9fe", color: "#6d28d9", verb: "was assigned to project", suffix: "" },
  project_completed: { icon: "🎉", bg: "#dcfce7", color: "#15803d", verb: "completed project", suffix: "" },
  role_assigned:     { icon: "🏷", bg: "#e0e7ff", color: "#4338ca", verb: "was assigned the role of", suffix: "" },
  user_registered:   { icon: "🆕", bg: "#fef3c7", color: "#b45309", verb: "registered and is pending role assignment", suffix: "" },
};

// ─── Map a project's progress % to a status label ────────────────────────────
const statusFromProgress = (percent) => {
  if (percent >= 90) return "Near completion";
  if (percent >= 50) return "On track";
  if (percent >= 20) return "In progress";
  return "Just started";
};

// ─── Palette of project accent colours (cycles if >6 projects) ───────────────
const PROJECT_COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#f43f5e", "#0ea5e9", "#a855f7"];

// ─── Friendly relative-time formatter ─────────────────────────────────────────
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

// ─────────────────────────────────────────────────────────────────────────────
export default function HRAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // ── 1. Fetch ALL projects org-wide ──
        const projectsRes = await apiFetch("/projects");
        if (!projectsRes.projects) throw new Error(projectsRes.message || "Failed to load projects");

        const projects = projectsRes.projects;

        // ── 2. Aggregate baseline totals from top-level project data ──
        let totalSubtasks = 0;
        let subtasksCompleted = 0;

        for (const p of projects) {
          totalSubtasks     += p.progress?.total     ?? 0;
          subtasksCompleted += p.progress?.completed ?? 0;
        }

        // ── 3. Parallel Fetches using the functional project detail route ──
        const [pendingRes, timelineRes, peopleRes, detailResults] = await Promise.all([
          apiFetch("/admin/pending-users"),
          apiFetch("/timeline?limit=6&page=1"),
          apiFetch("/admin/users"),
          Promise.all(projects.map((p) => apiFetch(`/projects/${p._id}`))),
        ]);

        const pendingUsers = pendingRes.users || [];
        const allUsers = (peopleRes.users || []).filter((u) => u.isVerified);

        // Map timeline events → activity items
        const recentActivity = (timelineRes.events || []).map((ev, i) => ({
          id: ev._id || i,
          type: ev.eventType || "comment",
          user: ev.actor?.name || "Someone",
          project: ev.project?.title || "",
          subtask: ev.subtask?.name || ev.metadata?.title || "",
          time: timeAgo(ev.createdAt),
        }));

        let subtasksPending = 0;
        let subtasksInProgress = 0;
        let subtasksOverdue = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        // ── 4. Aggregate subtask specifics securely from the working project detail payload ──
        for (const res of detailResults) {
          const subtasks = res.project?.subtasks || [];
          for (const st of subtasks) {
            if (st.status === "pending")     subtasksPending    += 1;
            if (st.status === "in_progress") subtasksInProgress += 1;
            if (st.status === "overdue")     subtasksOverdue    += 1;   
            if (st.rating?.stars) {
              ratingSum += st.rating.stars;
              ratingCount += 1;
            }
          }
        }

        const orgAvgRating = ratingCount === 0 ? null : (ratingSum / ratingCount).toFixed(1);

        // ── 5. Shape projects for the dashboard UI ───────────────────────
        const shapedProjects = projects.slice(0, 6).map((p, i) => ({
          id: p._id,
          name: p.title,
          progress: p.progress?.percent ?? 0,
          members: (p.assignedEmployees?.length || 0) + (p.assignedManagers?.length || 0),
          status: statusFromProgress(p.progress?.percent ?? 0),
          color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        }));

        const stillToFinish = totalSubtasks - subtasksCompleted;
        const completionPct = totalSubtasks === 0 ? 0 : Math.round((subtasksCompleted / totalSubtasks) * 100);

        const employeeCount = allUsers.filter((u) => u.role === "employee").length;
        const managerCount  = allUsers.filter((u) => u.role === "manager").length;

        if (!cancelled) {
          setData({
            totalProjects: projects.length,
            totalSubtasks,
            subtasksCompleted,
            stillToFinish,
            subtasksPending,
            subtasksInProgress,
            overdueCount: subtasksOverdue, // Safely extracted from verified project data
            completionPct,
            orgAvgRating,
            pendingUsers,
            employeeCount,
            managerCount,
            totalPeople: allUsers.length,
            recentActivity,
            projects: shapedProjects,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <main style={styles.main}>
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: "#94a3b8", marginTop: 12 }}>Loading dashboard…</p>
      </div>
    </main>
  );

  if (error) return (
    <main style={styles.main}>
      <div style={styles.center}>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>Failed to load dashboard</p>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{error}</p>
      </div>
    </main>
  );

  const {
    totalProjects, totalSubtasks, subtasksCompleted,
    subtasksPending, subtasksInProgress, overdueCount, completionPct,
    orgAvgRating, pendingUsers, employeeCount, managerCount, totalPeople,
    recentActivity, projects,
  } = data;

  return (
    <main style={styles.main}>
      {/* Header */}
      <div>
        <h1 style={styles.pageTitle}>HR Admin Dashboard</h1>
        <p style={styles.pageSubtitle}>Org-wide visibility across every team, project, and rating</p>
      </div>

      {/* Pending Users banner */}
      {pendingUsers.length > 0 && (
        <div style={styles.pendingBanner}>
          <div style={styles.pendingBannerLeft}>
            <span style={{ fontSize: 20 }}>🆕</span>
            <div>
              <div style={styles.pendingBannerTitle}>
                {pendingUsers.length} user{pendingUsers.length > 1 ? "s" : ""} waiting for role assignment
              </div>
              <div style={styles.pendingBannerSub}>
                {pendingUsers.slice(0, 3).map((u) => u.name).join(", ")}
                {pendingUsers.length > 3 && ` +${pendingUsers.length - 3} more`}
              </div>
            </div>
          </div>
          <button style={styles.pendingBannerBtn}>Review now →</button>
        </div>
      )}

      {/* Overdue Alert Banner */}
      {overdueCount > 0 && (
        <div style={styles.overdueBanner}>
          <div style={styles.overdueBannerLeft}>
            <span style={styles.overdueBannerIcon}>⚠️</span>
            <div>
              <div style={styles.overdueBannerTitle}>
                {overdueCount} subtask{overdueCount !== 1 ? "s are" : " is"} overdue org-wide
              </div>
              <div style={styles.overdueBannerSub}>
                Check the Timeline page and use the "Overdue" filter to see exactly what's late.
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/hr/timeline')} style={styles.overdueBannerBtn}>
            View overdue tasks →
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {[
          {
            label: "Total projects",
            value: totalProjects,
            sub: "across the whole org",
            icon: "📁",
            accent: "#6366f1",
            fill: Math.min(totalProjects * 8, 100),
          },
          {
            label: "Total people",
            value: totalPeople,
            sub: `${employeeCount} employees · ${managerCount} managers`,
            icon: "🏢",
            accent: "#0ea5e9",
            fill: 100,
          },
          {
            label: "Subtasks completed",
            value: subtasksCompleted,
            sub: `${completionPct}% of total`,
            icon: "✅",
            accent: "#22c55e",
            fill: completionPct,
          },
          {
            label: "Org average rating",
            value: orgAvgRating ?? "—",
            sub: orgAvgRating ? "out of 5 stars" : "no ratings yet",
            icon: "★",
            accent: "#ca8a04",
            fill: orgAvgRating ? (orgAvgRating / 5) * 100 : 0,
          },
        ].map((card) => (
          <div key={card.label} style={styles.statCard}>
            <div style={styles.statTop}>
              <span style={styles.statLabel}>{card.label}</span>
              <span style={{ fontSize: 18 }}>{card.icon}</span>
            </div>
            <div style={{ ...styles.statValue, color: card.accent }}>{card.value}</div>
            <div style={styles.statSub}>{card.sub}</div>
            <div style={{ ...styles.statBar, background: card.accent + "22" }}>
              <div style={{ ...styles.statBarFill, background: card.accent, width: `${card.fill}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Two Columns: Projects + Activity */}
      <div style={styles.twoCol}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Project progress — all teams</h3>
            <button onClick={() => navigate('/hr/projects')} style={styles.linkBtn}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {projects.length === 0 && (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>No projects in the system yet.</p>
            )}
            {projects.map((project) => (
              <div key={project.id}>
                <div style={styles.projectRow}>
                  <div style={{ ...styles.projectDot, background: project.color }} />
                  <span style={styles.projectName}>{project.name}</span>
                  <span style={styles.projectPct}>{project.progress}%</span>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${project.progress}%`, background: project.color }} />
                </div>
                <div style={styles.projectMeta}>{project.members} members · {project.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Recent activity — org-wide</h3>
            <span style={styles.badge}>{recentActivity.length} events</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentActivity.length === 0 && (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>No recent activity.</p>
            )}
            {recentActivity.map((item) => {
              const cfg = activityConfig[item.type] || activityConfig.comment;
              return (
                <div key={item.id} style={styles.activityItem}>
                  <div style={{ ...styles.activityIcon, background: cfg.bg, color: cfg.color }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.activityText}>
                      <span style={{ fontWeight: 600 }}>{item.user}</span>
                      {" "}{cfg.verb}{" "}
                      {item.subtask && <span style={{ color: "#6366f1" }}>{item.subtask}</span>}
                      {cfg.suffix && ` ${cfg.suffix}`}
                    </div>
                    <div style={styles.activityMeta}>{item.project}{item.project && " · "}{item.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subtask Section Grid */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Subtask overview — org-wide</h3>
        </div>
        <div style={styles.subtaskGrid}>
          {[
            { label: "Not yet started", desc: "Waiting to be picked up",  value: subtasksPending,   color: "#b45309", bg: "#fef9c3" },
            { label: "In progress",     desc: "Actively being worked on", value: subtasksInProgress, color: "#1d4ed8", bg: "#dbeafe" },
            { label: "Completed",       desc: "Done and signed off",       value: subtasksCompleted,  color: "#15803d", bg: "#dcfce7" },
            { label: "Overdue",         desc: "Past their deadline",       value: overdueCount,       color: "#b91c1c", bg: "#fee2e2" },
          ].map((s) => (
            <div key={s.label} style={{ ...styles.subtaskCard, background: s.bg }}>
              <div style={{ ...styles.subtaskValue, color: s.color }}>{s.value}</div>
              <div style={{ ...styles.subtaskLabel, color: s.color }}>{s.label}</div>
              <div style={{ ...styles.subtaskDesc,  color: s.color }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  main: { flex: 1, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" },
  center: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 },
  spinner: { width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  pendingBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", gap: 16, flexWrap: "wrap" },
  pendingBannerLeft: { display: "flex", alignItems: "center", gap: 12 },
  pendingBannerTitle: { fontSize: 14, fontWeight: 700, color: "#92400e" },
  pendingBannerSub: { fontSize: 12, color: "#b45309", marginTop: 2 },
  pendingBannerBtn: { padding: "8px 16px", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },

  // ── Overdue banner (matches manager dashboard styling) ─────────────────────
  overdueBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 16, background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 12, padding: "14px 18px", flexWrap: "wrap",
  },
  overdueBannerLeft: { display: "flex", alignItems: "flex-start", gap: 12 },
  overdueBannerIcon: { fontSize: 20, lineHeight: 1.4 },
  overdueBannerTitle: { fontSize: 14, fontWeight: 700, color: "#991b1b" },
  overdueBannerSub: { fontSize: 12.5, color: "#b91c1c", marginTop: 2 },
  overdueBannerBtn: {
    padding: "8px 16px", background: "#dc2626", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
  },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 },
  statCard: { background: "#fff", borderRadius: 12, padding: "18px 16px", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 6 },
  statTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  statLabel: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  statValue: { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  statSub: { fontSize: 11, color: "#94a3b8" },
  statBar: { height: 4, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  statBarFill: { height: "100%", borderRadius: 4 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card: { background: "#fff", borderRadius: 12, padding: "20px 22px", border: "1px solid #f1f5f9" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 },
  linkBtn: { fontSize: 13, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 500 },
  badge: { fontSize: 11, background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 20 },
  projectRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  projectDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  projectName: { flex: 1, fontSize: 13, fontWeight: 500, color: "#1e293b" },
  projectPct: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  progressTrack: { height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  projectMeta: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  activityItem: { display: "flex", alignItems: "flex-start", gap: 10 },
  activityIcon: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 },
  activityText: { fontSize: 13, color: "#334155", lineHeight: 1.5 },
  activityMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  subtaskGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 },
  subtaskCard: { borderRadius: 10, padding: "20px", textAlign: "center" },
  subtaskValue: { fontSize: 32, fontWeight: 700, lineHeight: 1 },
  subtaskLabel: { fontSize: 13, fontWeight: 500, marginTop: 4 },
  subtaskDesc: { fontSize: 11, marginTop: 3, opacity: 0.75 },
};
