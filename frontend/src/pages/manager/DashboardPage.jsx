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

// ─── Maps every eventType in the TimelineEvent schema to a visual treatment ──
// NOTE: keys must match the schema's `eventType` enum exactly. "project_assigned"
// and "project_completed" were previously here but aren't in that enum — the
// schema can never actually produce them, so they were dead code. Removed,
// and added the missing "subtask_assigned" (a very common real event that
// was silently falling through to the fallback below).
const activityConfig = {
  project_created:    { icon: "+",  bg: "#ffedd5", color: "#ea580c", verb: "created project", suffix: "" },
  project_edited:     { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", verb: "edited project", suffix: "" },
  project_deleted:    { icon: "🗑", bg: "#fee2e2", color: "#b91c1c", verb: "deleted project", suffix: "" },

  subtask_created:    { icon: "📝", bg: "#fce7f3", color: "#be185d", verb: "created subtask", suffix: "" },
  subtask_assigned:   { icon: "👤", bg: "#ede9fe", color: "#6d28d9", verb: "was assigned", suffix: "" },
  subtask_started:    { icon: "▶",  bg: "#dbeafe", color: "#2563eb", verb: "started working on", suffix: "" },
  subtask_completed:  { icon: "✓",  bg: "#dcfce7", color: "#16a34a", verb: "marked", suffix: "as done" },
  subtask_overdue:    { icon: "⚠️", bg: "#fef2f2", color: "#dc2626", verb: "missed the deadline for", suffix: "" },
  subtask_edited:     { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", verb: "edited subtask", suffix: "" },
  subtask_deleted:    { icon: "🗑", bg: "#fee2e2", color: "#b91c1c", verb: "deleted subtask", suffix: "" },
  subtask_submission: { icon: "📤", bg: "#e0f2fe", color: "#0284c7", verb: "submitted work for", suffix: "" },

  rating_submitted:   { icon: "★", bg: "#fef9c3", color: "#ca8a04", verb: "rated", suffix: "" },
  rating_updated:      { icon: "★", bg: "#fef9c3", color: "#ca8a04", verb: "updated the rating on", suffix: "" },

  comment_posted:     { icon: "💬", bg: "#f3e8ff", color: "#7c3aed", verb: "left a comment on", suffix: "" },
  comment_deleted:    { icon: "🗑", bg: "#fee2e2", color: "#b91c1c", verb: "deleted a comment on", suffix: "" },

  employee_added:      { icon: "➕", bg: "#dcfce7", color: "#15803d", verb: "added an employee to project", suffix: "" },
  employee_removed:    { icon: "➖", bg: "#fee2e2", color: "#b91c1c", verb: "removed an employee from project", suffix: "" },
  manager_added:        { icon: "➕", bg: "#e0e7ff", color: "#4338ca", verb: "added a manager to project", suffix: "" },
  manager_removed:      { icon: "➖", bg: "#fee2e2", color: "#b91c1c", verb: "removed a manager from project", suffix: "" },

  status_changed:      { icon: "🔄", bg: "#f1f5f9", color: "#475569", verb: "changed the status of", suffix: "" },
};

// ─── Fallback for any eventType not yet mapped above ─────────────────────────
const DEFAULT_ACTIVITY_CFG = { icon: "•", bg: "#f1f5f9", color: "#64748b", verb: "made a change to", suffix: "" };

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
export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // ── 1. Fetch all projects (role-scoped by backend) ─────────────────
        const projectsRes = await apiFetch("/projects");
        if (!projectsRes.projects) throw new Error(projectsRes.message || "Failed to load projects");

        const projects = projectsRes.projects;

        // ── 2. Aggregate subtask stats from progress maps embedded in projects
        let totalSubtasks = 0;
        let subtasksCompleted = 0;

        for (const p of projects) {
          totalSubtasks   += p.progress?.total     ?? 0;
          subtasksCompleted += p.progress?.completed ?? 0;
        }

        // ── 3. Single scoped timeline call + per-project detail + live overdue
        //       count, in parallel. /subtasks?status=overdue uses the same
        //       live-fallback query as the Timeline page's Overdue filter, so
        //       this can't go stale the way a cron-dependent count could. ────
        const [timelineRes, detailResults, overdueRes] = await Promise.all([
          apiFetch("/timeline?limit=5&page=1"),
          Promise.all(projects.map((p) => apiFetch(`/projects/${p._id}`))),
          apiFetch("/subtasks?status=overdue"),
        ]);

        // Map timeline events → activity items expected by the UI
        const recentActivity = (timelineRes.events || []).map((ev, i) => ({
          id: ev._id || i,
          type: ev.eventType || "comment_posted",
          user: ev.actor?.name || "Someone",
          project: ev.project?.title || "",
          subtask:
            ev.subtask?.name ||
            ev.metadata?.employeeName ||
            ev.metadata?.managerName ||
            ev.metadata?.title ||
            "",
          time: timeAgo(ev.createdAt),
        }));

        let subtasksPending = 0;
        let subtasksInProgress = 0;

        for (const res of detailResults) {
          const subtasks = res.project?.subtasks || [];
          for (const st of subtasks) {
            if (st.status === "pending")     subtasksPending   += 1;
            if (st.status === "in_progress") subtasksInProgress += 1;
          }
        }

        const overdueCount = overdueRes.subtasks?.length ?? 0;

        // ── 5. Shape projects for the progress card ───────────────────────
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

        if (!cancelled) {
          setData({
            assignedProjects: projects.length,
            totalSubtasks,
            subtasksCompleted,
            stillToFinish,
            subtasksPending,
            subtasksInProgress,
            overdueCount,
            completionPct,
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
    assignedProjects, totalSubtasks, subtasksCompleted, stillToFinish,
    subtasksPending, subtasksInProgress, overdueCount, completionPct,
    recentActivity, projects,
  } = data;

  return (
    <main style={styles.main}>
      {/* Header */}
      <div>
        <h1 style={styles.pageTitle}>Dashboard</h1>
        <p style={styles.pageSubtitle}>Your team's activity and project progress</p>
      </div>

      {/* Overdue alert banner — only shown when there's something to flag */}
      {overdueCount > 0 && (
        <div style={styles.overdueBanner}>
          <div style={styles.overdueBannerLeft}>
            <span style={styles.overdueBannerIcon}>⚠️</span>
            <div>
              <div style={styles.overdueBannerTitle}>
                {overdueCount} subtask{overdueCount !== 1 ? "s are" : " is"} overdue
              </div>
              <div style={styles.overdueBannerSub}>
                Check the Timeline page and use the "Overdue" filter to see exactly what's late.
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/manager/timeline')} style={styles.overdueBannerBtn}>
            View overdue tasks →
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {[
          {
            label: "Assigned projects",
            value: assignedProjects,
            sub: "across all teams",
            icon: "📁",
            accent: "#6366f1",
            fill: Math.min(assignedProjects * 10, 100),
          },
          {
            label: "Total subtasks",
            value: totalSubtasks,
            sub: "across all projects",
            icon: "📋",
            accent: "#8b5cf6",
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
            label: "Still to finish",
            value: stillToFinish,
            sub: "in progress or not started",
            icon: "⏳",
            accent: "#f59e0b",
            fill: totalSubtasks === 0 ? 0 : Math.round((stillToFinish / totalSubtasks) * 100),
          },
          {
            label: "Overdue",
            value: overdueCount,
            sub: overdueCount > 0 ? "needs attention" : "all caught up",
            icon: "⚠️",
            accent: "#dc2626",
            fill: totalSubtasks === 0 ? 0 : Math.round((overdueCount / totalSubtasks) * 100),
          },
        ].map((card) => (
          <div key={card.label} style={styles.statCard}>
            <div>
              <div style={styles.statTop}>
                <span style={styles.statLabel}>{card.label}</span>
                <span style={{ fontSize: 18 }}>{card.icon}</span>
              </div>
              <div style={{ ...styles.statValue, color: card.accent }}>{card.value}</div>
              <div style={styles.statSub}>{card.sub}</div>
            </div>
            <div style={{ ...styles.statBar, background: card.accent + "22" }}>
              <div style={{ ...styles.statBarFill, background: card.accent, width: `${card.fill}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Projects + Activity */}
      <div style={styles.twoCol}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Project progress</h3>
            <button onClick={() => navigate('/manager/projects')} style={styles.linkBtn}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {projects.length === 0 && (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>No projects assigned yet.</p>
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
            <h3 style={styles.cardTitle}>Recent activity</h3>
            <span style={styles.badge}>{recentActivity.length} events</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentActivity.length === 0 && (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>No recent activity.</p>
            )}
            {recentActivity.map((item) => {
              const cfg = activityConfig[item.type] || DEFAULT_ACTIVITY_CFG;
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

      {/* Subtask Overview */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Subtask overview — all projects</h3>
        </div>
        <div style={styles.subtaskGrid}>
          {[
            { label: "Not yet started", desc: "Waiting to be picked up",  value: subtasksPending,    color: "#b45309", bg: "#fef9c3" },
            { label: "In progress",     desc: "Actively being worked on", value: subtasksInProgress, color: "#1d4ed8", bg: "#dbeafe" },
            { label: "Completed",       desc: "Done and signed off",       value: subtasksCompleted,  color: "#15803d", bg: "#dcfce7" },
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

// ─── Styles (identical to original template) ─────────────────────────────────
const styles = {
  main: {
    flex: 1, padding: "32px 36px", display: "flex",
    flexDirection: "column", gap: 24, overflowY: "auto",
  },
  center: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 60,
  },
  spinner: {
    width: 32, height: 32, borderRadius: "50%",
    border: "3px solid #e2e8f0", borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  pageTitle:    { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },

  // ── Overdue banner ────────────────────────────────────────────────────────
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

  statsGrid:    { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, alignItems: "stretch" },
  // ── Fixed height + space-between so the progress bar always sits at the
  //    same vertical position regardless of how many lines `sub` wraps to.
  statCard: {
    background: "#fff", borderRadius: 12, padding: "18px 16px",
    border: "1px solid #f1f5f9", display: "flex", flexDirection: "column",
    justifyContent: "space-between", minHeight: 132, boxSizing: "border-box",
  },
  statTop:     { display: "flex", alignItems: "center", justifyContent: "space-between" },
  statLabel:   { fontSize: 12, color: "#64748b", fontWeight: 500 },
  statValue:   { fontSize: 28, fontWeight: 700, lineHeight: 1, marginTop: 6 },
  // Reserves consistent vertical space (~2 lines) whether the sub text
  // wraps to one line or two, so cards line up regardless of copy length.
  statSub:     { fontSize: 11, color: "#94a3b8", marginTop: 4, minHeight: 28, lineHeight: "14px" },
  statBar:     { height: 4, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  statBarFill: { height: "100%", borderRadius: 4 },
  twoCol:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card:        { background: "#fff", borderRadius: 12, padding: "20px 22px", border: "1px solid #f1f5f9" },
  cardHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitle:   { fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 },
  linkBtn:     { fontSize: 13, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 500 },
  badge:       { fontSize: 11, background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 20 },
  projectRow:  { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  projectDot:  { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  projectName: { flex: 1, fontSize: 13, fontWeight: 500, color: "#1e293b" },
  projectPct:  { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  progressTrack: { height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  projectMeta:   { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  activityItem:  { display: "flex", alignItems: "flex-start", gap: 10 },
  activityIcon:  { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 },
  activityText:  { fontSize: 13, color: "#334155", lineHeight: 1.5 },
  activityMeta:  { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  subtaskGrid:   { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  subtaskCard:   { borderRadius: 10, padding: "20px", textAlign: "center" },
  subtaskValue:  { fontSize: 32, fontWeight: 700, lineHeight: 1 },
  subtaskLabel:  { fontSize: 13, fontWeight: 500, marginTop: 4 },
  subtaskDesc:   { fontSize: 11, marginTop: 3, opacity: 0.75 },
};
