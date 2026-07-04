import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx"; // Ensure you run 'npm install xlsx' in your terminal

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const apiFetch = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(opts.headers || {}),
    },
  }).then((r) => r.json());

// ─── Event type config — covers every eventType in the TimelineEvent schema ──
const eventConfig = {
  project_created:    { icon: "+",  bg: "#ffedd5", color: "#ea580c", label: "Project created" },
  project_edited:     { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", label: "Project edited" },
  project_deleted:     { icon: "🗑",  bg: "#fee2e2", color: "#b91c1c", label: "Project deleted" },
  project_completed:   { icon: "🏁", bg: "#dcfce7", color: "#15803d", label: "Project completed" },

  subtask_created:     { icon: "📝", bg: "#fce7f3", color: "#be185d", label: "Subtask created" },
  subtask_edited:      { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", label: "Subtask edited" },
  subtask_assigned:    { icon: "👤", bg: "#ede9fe", color: "#6d28d9", label: "Assigned" },
  subtask_started:     { icon: "▶",  bg: "#dbeafe", color: "#2563eb", label: "Started" },
  subtask_completed:   { icon: "✓",  bg: "#dcfce7", color: "#16a34a", label: "Completed" },
  subtask_overdue:      { icon: "⚠️", bg: "#fee2e2", color: "#b91c1c", label: "Overdue" },
  subtask_deleted:      { icon: "🗑",  bg: "#fee2e2", color: "#b91c1c", label: "Subtask deleted" },
  subtask_submission:   { icon: "📤", bg: "#e0e7ff", color: "#4f46e5", label: "Submission" },

  rating_submitted:    { icon: "★",  bg: "#fef9c3", color: "#ca8a04", label: "Rating submitted" },
  rating_updated:       { icon: "★",  bg: "#fef3c7", color: "#b45309", label: "Rating updated" },

  comment_posted:       { icon: "💬", bg: "#f3e8ff", color: "#7c3aed", label: "Comment" },
  comment_deleted:       { icon: "🗑",  bg: "#f3e8ff", color: "#7c3aed", label: "Comment deleted" },

  employee_added:       { icon: "➕", bg: "#dcfce7", color: "#15803d", label: "Employee added" },
  employee_removed:      { icon: "➖", bg: "#fee2e2", color: "#b91c1c", label: "Employee removed" },
  manager_added:         { icon: "➕", bg: "#e0e7ff", color: "#4338ca", label: "Manager added" },
  manager_removed:       { icon: "➖", bg: "#fee2e2", color: "#b91c1c", label: "Manager removed" },

  status_changed:        { icon: "🔄", bg: "#f1f5f9", color: "#475569", label: "Status changed" },
};

const FALLBACK = { icon: "🔔", bg: "#f1f5f9", color: "#64748b", label: "Event" };

// ─── Role display config ──────────────────────────────────────────────────────
const roleConfig = {
  employee: { label: "Employee", color: "#2563eb", bg: "#dbeafe" },
  manager:  { label: "Manager",  color: "#7c3aed", bg: "#ede9fe" },
  hr_admin: { label: "HR Admin", color: "#be185d", bg: "#fce7f3" },
};

const isLateEvent = (ev) =>
  ev.subtask?.status === "overdue" ||
  (ev.eventType === "subtask_completed" && ev.metadata?.isLate === true);

// ─── Time helpers ─────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const dayLabel = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const daysOverdueCount = (dueDateIso) => {
  if (!dueDateIso) return null;
  const diff = Date.now() - new Date(dueDateIso).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

// =============================================================================
export default function HRTimelinePage() {
  const [events, setEvents]           = useState([]);
  const [projects, setProjects]       = useState([]);
  const [users, setUsers]             = useState([]);
  const [pagination, setPagination]   = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);

  const [stats, setStats] = useState({
    totalSubtasks: 0,
    completedSubtasks: 0,
    overdueSubtasks: 0,
    avgRating: null,
    ratingCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [overdueSubtasks, setOverdueSubtasks] = useState([]);
  const [overdueLoading, setOverdueLoading]   = useState(false);
  const [overdueError, setOverdueError]       = useState(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter]     = useState("all");
  const [roleFilter, setRoleFilter]           = useState("all");

  const [exporting, setExporting] = useState(false);

  const isOverdueView = eventTypeFilter === "subtask_overdue";
  const currentPage = useRef(1);

  // ── Fetch projects + users for filter dropdowns ───────────────────────────
  useEffect(() => {
    apiFetch("/projects").then((res) => setProjects(res.projects || [])).catch(() => {});
    apiFetch("/users").then((res) => setUsers(res.users || [])).catch(() => {});
  }, []);

  // ── Load timeline ──
  const load = useCallback(async (page = 1, replace = true) => {
    page === 1 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
      if (projectFilter !== "all")   params.set("projectId", projectFilter);
      if (roleFilter !== "all")      params.set("actorRole", roleFilter);

      const res = await apiFetch(`/timeline?${params}`);
      if (!res.events) throw new Error(res.message || "Failed to load timeline");

      setEvents((prev) => (replace ? res.events : [...prev, ...res.events]));
      setPagination(res.pagination);
      currentPage.current = page;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventTypeFilter, projectFilter, roleFilter]);

  useEffect(() => {
    if (!isOverdueView) load(1, true);
  }, [load, isOverdueView]);

  // ── Load live stats ──
  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (projectFilter !== "all") params.set("projectId", projectFilter);

    apiFetch(`/timeline/stats?${params}`)
      .then((res) => { if (active) setStats(res); })
      .catch(() => {})
      .finally(() => { if (active) setStatsLoading(false); });

    return () => { active = false; };
  }, [projectFilter]);

  // ── Load live overdue subtasks ──
  useEffect(() => {
    if (!isOverdueView) return;
    let active = true;
    setOverdueLoading(true);
    setOverdueError(null);

    const params = new URLSearchParams({ status: "overdue" });
    if (projectFilter !== "all") params.set("projectId", projectFilter);

    apiFetch(`/subtasks?${params}`)
      .then((res) => {
        if (!active) return;
        if (!res.subtasks) throw new Error(res.message || "Failed to load overdue subtasks");
        setOverdueSubtasks(res.subtasks);
      })
      .catch((err) => { if (active) setOverdueError(err.message); })
      .finally(() => { if (active) setOverdueLoading(false); });

    return () => { active = false; };
  }, [isOverdueView, projectFilter]);

  const handleLoadMore = () => load(currentPage.current + 1, false);

  // ── Excel Export Handler — backed by GET /timeline/export ─────────────────
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ mode: isOverdueView ? "overdue" : "activity" });
      if (projectFilter !== "all") params.set("projectId", projectFilter);

      const res = await apiFetch(`/timeline/export?${params}`);
      if (!res.rows || res.rows.length === 0) {
        alert("No data available under the current configurations to export.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(res.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Timeline Export");

      worksheet["!cols"] = [
        { wch: 25 }, // Project Name
        { wch: 30 }, // Subtask Name
        { wch: 25 }, // Assigned Employee
        { wch: 25 }, // Assigned Manager
        { wch: 16 }, // Starting Date
        { wch: 16 }, // Due Date
        { wch: 14 }, // Status
        { wch: 18 }, // Completion Date
        { wch: 12 }, // Rating
      ];

      const modeLabel = isOverdueView ? "overdue_tasks" : "activity_log";
      XLSX.writeFile(workbook, `org_${modeLabel}_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("Failed to export: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Group by day ──────────────────────────────────────────────────────────
  const grouped = events.reduce((acc, ev) => {
    const key = dayLabel(ev.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const activeFilterCount =
    (eventTypeFilter !== "all" ? 1 : 0) +
    (projectFilter !== "all" ? 1 : 0) +
    (roleFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setEventTypeFilter("all");
    setProjectFilter("all");
    setRoleFilter("all");
  };

  const selectedProjectTitle =
    projectFilter !== "all" ? projects.find((p) => p._id === projectFilter)?.title : null;

  if (loading && !isOverdueView) {
    return (
      <main style={styles.main}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: "#94a3b8", marginTop: 12 }}>Loading timeline…</p>
        </div>
      </main>
    );
  }

  if (error && !isOverdueView) {
    return (
      <main style={styles.main}>
        <div style={styles.center}>
          <p style={{ color: "#ef4444", fontWeight: 600 }}>Failed to load timeline</p>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{error}</p>
          <button onClick={() => load(1, true)} style={styles.retryBtn}>Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      {/* Header Container */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={styles.pageTitle}>Organisation Timeline</h1>
          <p style={styles.pageSubtitle}>
            {selectedProjectTitle
              ? `Live stats + activity for "${selectedProjectTitle}"`
              : "Global activity log — all projects, all roles"}
          </p>
        </div>

        {/* Export Button */}
        <button onClick={exportToExcel} disabled={exporting} style={{ ...styles.exportExcelBtn, opacity: exporting ? 0.6 : 1 }}>
          {exporting ? "Exporting…" : "📊 Export to Excel"}
        </button>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <StatCard label="Total Tasks" value={statsLoading ? "…" : stats.totalSubtasks} icon="📊" color="#6366f1" />
        <StatCard label="Completions" value={statsLoading ? "…" : stats.completedSubtasks} icon="✓" color="#16a34a" />
        <StatCard label="Overdue Now" value={statsLoading ? "…" : stats.overdueSubtasks} icon="⚠️" color="#b91c1c" />
        <StatCard label="Avg Rating" value={statsLoading ? "…" : stats.avgRating !== null ? `${stats.avgRating}★` : "—"} sublabel={!statsLoading && stats.ratingCount > 0 ? `${stats.ratingCount} rated` : null} icon="★" color="#ca8a04" />
      </div>

      {/* Filters Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Project</label>
          <select style={styles.select} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Role</label>
          <select style={styles.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} disabled={isOverdueView}>
            <option value="all">All roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="hr_admin">HR Admin</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Event type</label>
          <select style={styles.select} value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
            <option value="all">All event types</option>
            <optgroup label="Subtasks">
              <option value="subtask_created">Created</option>
              <option value="subtask_assigned">Assigned</option>
              <option value="subtask_started">Started</option>
              <option value="subtask_completed">Completed</option>
              <option value="subtask_overdue">Overdue</option>
              <option value="subtask_edited">Edited</option>
              <option value="subtask_deleted">Deleted</option>
              <option value="subtask_submission">Submission</option>
            </optgroup>
            <optgroup label="Projects">
              <option value="project_created">Project created</option>
              <option value="project_edited">Project edited</option>
              <option value="project_completed">Project completed</option>
              <option value="project_deleted">Project deleted</option>
            </optgroup>
            <optgroup label="People">
              <option value="employee_added">Employee added</option>
              <option value="employee_removed">Employee removed</option>
              <option value="manager_added">Manager added</option>
              <option value="manager_removed">Manager removed</option>
            </optgroup>
            <optgroup label="Other">
              <option value="rating_submitted">Rating submitted</option>
              <option value="rating_updated">Rating updated</option>
              <option value="comment_posted">Comment posted</option>
              <option value="comment_deleted">Comment deleted</option>
            </optgroup>
          </select>
        </div>

        {activeFilterCount > 0 && (
          <button onClick={resetFilters} style={styles.clearBtn}>
            Clear filters ({activeFilterCount})
          </button>
        )}

        <span style={styles.countBadge}>
          {isOverdueView
            ? `${overdueSubtasks.length} overdue task${overdueSubtasks.length !== 1 ? "s" : ""}`
            : `${pagination.total} event${pagination.total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Main Stream Window */}
      {isOverdueView ? (
        overdueLoading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={{ color: "#94a3b8", marginTop: 12 }}>Loading overdue subtasks…</p>
          </div>
        ) : overdueError ? (
          <div style={styles.center}>
            <p style={{ color: "#ef4444", fontWeight: 600 }}>Failed to load overdue subtasks</p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{overdueError}</p>
            <button onClick={() => setProjectFilter((p) => p)} style={styles.retryBtn}>Retry</button>
          </div>
        ) : overdueSubtasks.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 36 }}>🎉</div>
            <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
              No overdue subtasks{selectedProjectTitle ? ` in "${selectedProjectTitle}"` : ""}.
            </div>
          </div>
        ) : (
          <div style={styles.overdueList}>
            {overdueSubtasks.map((st) => {
              const cfg = eventConfig.subtask_overdue;
              const days = daysOverdueCount(st.dueDate);
              return (
                <div key={st._id} style={{ ...styles.eventCard, ...styles.eventCardLate, marginBottom: 0 }}>
                  <div style={styles.eventCardHeader}>
                    <span style={{ ...styles.eventTypePill, background: cfg.bg, color: cfg.color }}>
                      {cfg.icon} Overdue
                    </span>
                    {days !== null && (
                      <span style={styles.eventTime}>{days === 0 ? "Due today" : `${days}d overdue`}</span>
                    )}
                  </div>
                  <p style={styles.eventDescription}>{st.name}</p>
                  <div style={styles.eventMeta}>
                    {st.project?.title && <span style={styles.metaTag}>📁 {st.project.title}</span>}
                    {(st.assignedTo || []).map((emp) => (
                      <span key={emp._id || emp} style={styles.metaTag}>👤 {emp.name || emp}</span>
                    ))}
                    {st.dueDate && <span style={styles.metaTag}>📅 Due {formatDate(st.dueDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : events.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 36 }}>📅</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>No events match your filters.</div>
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} style={{ ...styles.retryBtn, marginTop: 14 }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={styles.timelineWrap}>
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day} style={styles.daySection}>
              <div style={styles.dayHeader}>
                <span style={styles.dayLabel}>{day}</span>
                <span style={styles.dayCount}>{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}</span>
                <div style={styles.dayLine} />
              </div>

              <div style={styles.dayEvents}>
                {dayEvents.map((ev) => {
                  const cfg = eventConfig[ev.eventType] || FALLBACK;
                  const actorRole = ev.actor?.role;
                  const roleCfg = roleConfig[actorRole] || null;
                  const late = isLateEvent(ev);

                  return (
                    <div key={ev._id} style={styles.eventRow}>
                      <div style={styles.eventRail}>
                        <div style={{ ...styles.eventDot, background: cfg.bg, color: cfg.color }}>
                          {cfg.icon}
                        </div>
                        <div style={styles.eventRailLine} />
                      </div>

                      <div style={{ ...styles.eventCard, ...(late ? styles.eventCardLate : null) }}>
                        <div style={styles.eventCardHeader}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...styles.eventTypePill, background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            {roleCfg && (
                              <span style={{ ...styles.rolePill, background: roleCfg.bg, color: roleCfg.color }}>
                                {roleCfg.label}
                              </span>
                            )}
                          </div>
                          <span style={styles.eventTime}>{timeAgo(ev.createdAt)}</span>
                        </div>

                        <p style={styles.eventDescription}>{ev.description}</p>

                        <div style={styles.eventMeta}>
                          {late && <span style={styles.lateTag}>⏰ Late</span>}
                          {ev.actor?.name && <span style={styles.metaTag}>👤 {ev.actor.name}</span>}
                          {ev.project?.title && <span style={styles.metaTag}>📁 {ev.project.title}</span>}
                          {ev.subtask?.name && <span style={styles.metaTag}>📋 {ev.subtask.name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Trigger */}
      {!isOverdueView && pagination.page < pagination.pages && (
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <button onClick={handleLoadMore} disabled={loadingMore} style={{ ...styles.loadMoreBtn, opacity: loadingMore ? 0.6 : 1 }}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </main>
  );
}

// ─── Stat card sub-component ──────────────────────────────────────────────────
function StatCard({ label, value, sublabel, icon, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIconWrap, background: `${color}14` }}>
        <div style={{ ...styles.statIcon, color }}>{icon}</div>
      </div>
      <div>
        <div style={{ ...styles.statValue, color }}>{value}</div>
        <div style={styles.statLabel}>
          {label}{sublabel && <span style={styles.statSublabel}> · {sublabel}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  main: { flex: 1, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 22, overflowY: "auto", maxWidth: 920 },
  center: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 },
  spinner: { width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" },
  retryBtn: { marginTop: 10, padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },

  exportExcelBtn: {
    padding: "8px 16px", background: "#10b981", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", transition: "background 0.2s ease"
  },

  // Stats bar
  statsBar: { display: "flex", gap: 12, flexWrap: "wrap" },
  statCard: { flex: "1 1 180px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, minWidth: 160 },
  statIconWrap: { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#94a3b8", marginTop: 3, fontWeight: 500 },
  statSublabel: { color: "#cbd5e1" },

  // Filters
  filterBar: { display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px" },
  filterGroup: { display: "flex", flexDirection: "column", gap: 5 },
  filterLabel: { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" },
  select: { padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#f8fafc", outline: "none", cursor: "pointer", minWidth: 150, color: "#1e293b" },
  clearBtn: { padding: "8px 14px", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 12.5, fontWeight: 600, cursor: "pointer", height: 37 },
  countBadge: { fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "7px 12px", borderRadius: 20, marginLeft: "auto", height: 22, display: "flex", alignItems: "center" },

  empty: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 50, textAlign: "center" },

  // Timeline UI Layout
  timelineWrap: { display: "flex", flexDirection: "column", gap: 28 },
  daySection: { display: "flex", flexDirection: "column", gap: 14 },
  dayHeader: { display: "flex", alignItems: "center", gap: 10 },
  dayLabel: { fontSize: 13, fontWeight: 700, color: "#6366f1", whiteSpace: "nowrap" },
  dayCount: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" },
  dayLine: { flex: 1, height: 1, background: "#e2e8f0" },
  dayEvents: { display: "flex", flexDirection: "column" },
  eventRow: { display: "flex", gap: 14 },
  eventRail: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  eventDot: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 },
  eventRailLine: { width: 2, flex: 1, background: "#f1f5f9", marginTop: 4, minHeight: 16 },

  overdueList: { display: "flex", flexDirection: "column", gap: 12 },

  eventCard: { flex: 1, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "14px 16px", marginBottom: 14 },
  eventCardLate: { background: "#fefce8", border: "1px solid #fde68a" },
  eventCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  eventTypePill: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 },
  rolePill: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20 },
  eventTime: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" },
  eventDescription: { fontSize: 13.5, color: "#1e293b", lineHeight: 1.5, margin: "0 0 10px" },
  eventMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaTag: { fontSize: 11.5, color: "#64748b", background: "#f8fafc", padding: "3px 10px", borderRadius: 8, border: "1px solid #e2e8f0" },
  lateTag: { fontSize: 11, fontWeight: 700, color: "#a16207", background: "#fef9c3", padding: "3px 10px", borderRadius: 8, border: "1px solid #fde68a" },
  loadMoreBtn: { padding: "9px 20px", background: "#fff", color: "#6366f1", border: "1px solid #e0e7ff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
};

if (typeof document !== "undefined" && !document.getElementById("hr-detail-spin")) {
  const s = document.createElement("style"); s.id = "hr-detail-spin";
  s.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(s);
}
