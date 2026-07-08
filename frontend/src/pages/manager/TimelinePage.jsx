import { useState, useEffect, useCallback, useRef } from "react";

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

// ─── Event type config — now covers every eventType in the TimelineEvent schema ──
const eventConfig = {
  project_created:   { icon: "+",  bg: "#ffedd5", color: "#ea580c", label: "Project created" },
  project_edited:    { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", label: "Project edited" },
  project_deleted:   { icon: "🗑",  bg: "#fee2e2", color: "#b91c1c", label: "Project deleted" },
  project_completed: { icon: "🏁", bg: "#dcfce7", color: "#15803d", label: "Project completed" },
  project_assigned:    { icon: "📂", bg: "#dbeafe", color: "#2563eb", label: "Project assigned" },

  subtask_created:   { icon: "📝", bg: "#fce7f3", color: "#be185d", label: "Subtask created" },
  subtask_edited:    { icon: "✏️", bg: "#e0f2fe", color: "#0369a1", label: "Subtask edited" },
  subtask_assigned:  { icon: "👤", bg: "#ede9fe", color: "#6d28d9", label: "Assigned" },
  subtask_started:   { icon: "▶",  bg: "#dbeafe", color: "#2563eb", label: "Started" },
  subtask_completed: { icon: "✓",  bg: "#dcfce7", color: "#16a34a", label: "Completed" },
  subtask_overdue:   { icon: "⚠️", bg: "#fee2e2", color: "#b91c1c", label: "Overdue" },
  subtask_submission: { icon: "📤", bg: "#e0e7ff", color: "#4f46e5", label: "Submission" },
  subtask_deleted:    { icon: "🗑",  bg: "#f3e8ff", color: "#7c3aed", label: "Subtask deleted" },

  rating_submitted:  { icon: "★",  bg: "#fef9c3", color: "#ca8a04", label: "Rating submitted" },
  rating_updated:    { icon: "★",  bg: "#fef3c7", color: "#b45309", label: "Rating updated" },

  comment_posted:    { icon: "💬", bg: "#f3e8ff", color: "#7c3aed", label: "Comment" },
  comment_deleted:   { icon: "🗑",  bg: "#f3e8ff", color: "#7c3aed", label: "Comment deleted" },

  employee_added:    { icon: "➕", bg: "#dcfce7", color: "#15803d", label: "Employee added" },
  employee_removed:  { icon: "➖", bg: "#fee2e2", color: "#b91c1c", label: "Employee removed" },
  manager_added:     { icon: "➕", bg: "#e0e7ff", color: "#4338ca", label: "Manager added" },
  manager_removed:   { icon: "➖", bg: "#fee2e2", color: "#b91c1c", label: "Manager removed" },

  status_changed:    { icon: "🔄", bg: "#f1f5f9", color: "#475569", label: "Status changed" },
};

const FALLBACK = { icon: "🔔", bg: "#f1f5f9", color: "#64748b", label: "Event" };

// ─── A "late" timeline event: either inherently overdue, or a completion that
//     happened after the deadline (flagged via metadata.isLate) ───────────────
const isLateEvent = (ev) =>
  ev.eventType === "subtask_overdue" ||
  (ev.eventType === "subtask_completed" && ev.metadata?.isLate === true);

// ─── Friendly date + relative-time formatting ─────────────────────────────────
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

// ─── Overdue subtask helpers/card ──────────────────────────────────────────────
const daysOverdue = (dueDate) =>
  Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));

function OverdueSubtaskCard({ subtask }) {
  const days = daysOverdue(subtask.dueDate);
  const assignedNames = (subtask.assignedTo || []).map((u) => u.name).join(", ") || "Unassigned";

  return (
    <div style={{ ...styles.eventCard, ...styles.eventCardLate }}>
      <div style={styles.eventCardHeader}>
        <span style={{ ...styles.eventTypePill, background: "#fee2e2", color: "#b91c1c" }}>
          ⚠️ Overdue
        </span>
        <span style={styles.eventTime}>
          {days === 0 ? "Due today" : `${days}d overdue`}
        </span>
      </div>

      <p style={styles.eventDescription}>{subtask.name}</p>

      <div style={styles.eventMeta}>
        {subtask.project?.title && (
          <span style={styles.metaTag}>📁 {subtask.project.title}</span>
        )}
        <span style={styles.metaTag}>👤 {assignedNames}</span>
        <span style={styles.metaTag}>
          📅 Due {new Date(subtask.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ManagerTimelinePage() {
  const [events, setEvents]         = useState([]);
  const [overdueSubtasks, setOverdueSubtasks] = useState([]);
  const [projects, setProjects]     = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState(null);

  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter]     = useState("all");

  const currentPage = useRef(1);

  // ── Load manager's own projects once, to populate the project filter dropdown ──
  useEffect(() => {
    apiFetch("/projects")
      .then((res) => setProjects(res.projects || []))
      .catch(() => {});
  }, []);

  // ── Load timeline events (re-runs when filters change) ─────────────────────
  const load = useCallback(async (page = 1, replace = true) => {
    page === 1 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      if (eventTypeFilter === "subtask_overdue") {
        // ── Live overdue subtasks — query /subtasks directly instead of
        // /timeline. getSubtasks' live-fallback OR condition catches subtasks
        // whose dueDate has passed even if the cron hasn't flipped their
        // stored status to "overdue" yet, so this can't go stale the way a
        // logged subtask_overdue timeline event can. Same fix pattern as
        // HRTimelinePage's Overdue filter. ─────────────────────────────────
        const params = new URLSearchParams({ status: "overdue" });
        if (projectFilter !== "all") params.set("projectId", projectFilter);

        const res = await apiFetch(`/subtasks?${params}`);
        if (!res.subtasks) throw new Error(res.message || "Failed to load overdue subtasks");

        setOverdueSubtasks(res.subtasks);
        setEvents([]);
        setPagination({ total: res.subtasks.length, page: 1, pages: 1 }); // no pagination on this endpoint
        currentPage.current = 1;
      } else {
        const params = new URLSearchParams({ page, limit: 25 });
        if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
        if (projectFilter !== "all") params.set("projectId", projectFilter);

        const res = await apiFetch(`/timeline?${params}`);
        if (!res.events) throw new Error(res.message || "Failed to load timeline");

        setEvents((prev) => (replace ? res.events : [...prev, ...res.events]));
        setOverdueSubtasks([]);
        setPagination(res.pagination);
        currentPage.current = page;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventTypeFilter, projectFilter]);

  useEffect(() => { load(1, true); }, [load]);

  const handleLoadMore = () => load(currentPage.current + 1, false);

  // ── Group events by calendar day for the timeline rail ─────────────────────
  const grouped = events.reduce((acc, ev) => {
    const key = dayLabel(ev.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: "#94a3b8", marginTop: 12 }}>Loading timeline…</p>
        </div>
      </main>
    );
  }

  if (error) {
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
      {/* Header */}
      <div>
        <h1 style={styles.pageTitle}>Timeline</h1>
        <p style={styles.pageSubtitle}>Chronological activity across all your projects</p>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select
          style={styles.select}
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.title}</option>
          ))}
        </select>

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
            </optgroup>
          </select>
        </div>

        <span style={styles.countBadge}>{pagination.total} event{pagination.total !== 1 ? "s" : ""}</span>
      </div>

      {/* Timeline / Overdue subtasks */}
      {eventTypeFilter === "subtask_overdue" ? (
        overdueSubtasks.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>Nothing overdue right now.</div>
          </div>
        ) : (
          <div style={styles.dayEvents}>
            {overdueSubtasks.map((st) => (
              <div key={st._id} style={styles.eventRow}>
                <div style={styles.eventRail}>
                  <div style={{ ...styles.eventDot, background: "#fee2e2", color: "#b91c1c" }}>⚠️</div>
                  <div style={styles.eventRailLine} />
                </div>
                <OverdueSubtaskCard subtask={st} />
              </div>
            ))}
          </div>
        )
      ) : events.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 36 }}>📅</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>No events match your filters.</div>
        </div>
      ) : (
        <div style={styles.timelineWrap}>
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day} style={styles.daySection}>
              <div style={styles.dayHeader}>
                <span style={styles.dayLabel}>{day}</span>
                <div style={styles.dayLine} />
              </div>

              <div style={styles.dayEvents}>
                {dayEvents.map((ev) => {
                  const cfg = eventConfig[ev.eventType] || FALLBACK;
                  const late = isLateEvent(ev);
                  return (
                    <div key={ev._id} style={styles.eventRow}>
                      <div style={styles.eventRail}>
                        <div style={{ ...styles.eventDot, background: cfg.bg, color: cfg.color }}>
                          {cfg.icon}
                        </div>
                        <div style={styles.eventRailLine} />
                      </div>

                      <div
                        style={{
                          ...styles.eventCard,
                          ...(late ? styles.eventCardLate : null),
                        }}
                      >
                        <div style={styles.eventCardHeader}>
                          <span style={{ ...styles.eventTypePill, background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <span style={styles.eventTime}>{timeAgo(ev.createdAt)}</span>
                        </div>

                        <p style={styles.eventDescription}>{ev.description}</p>

                        <div style={styles.eventMeta}>
                          {late && (
                            <span style={styles.lateTag}>⏰ Late</span>
                          )}
                          {ev.actor?.name && (
                            <span style={styles.metaTag}>
                              👤 {ev.actor.name}
                              {ev.actor.role && (
                                <span style={styles.roleBadge}>{ev.actor.role.replace("_", " ")}</span>
                              )}
                            </span>
                          )}
                          {ev.project?.title && (
                            <span style={styles.metaTag}>📁 {ev.project.title}</span>
                          )}
                          {ev.subtask?.name && (
                            <span style={styles.metaTag}>📋 {ev.subtask.name}</span>
                          )}
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

      {/* Load more — hidden in overdue mode since /subtasks isn't paginated */}
      {eventTypeFilter !== "subtask_overdue" && pagination.page < pagination.pages && (
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{ ...styles.loadMoreBtn, opacity: loadingMore ? 0.6 : 1 }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  main: {
    flex: 1, padding: "32px 36px", display: "flex",
    flexDirection: "column", gap: 22, overflowY: "auto", maxWidth: 880,
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
  retryBtn: {
    marginTop: 10, padding: "8px 16px", background: "#6366f1", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  pageTitle:    { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSubtitle: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },

  filters: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 13, background: "#fff", outline: "none", cursor: "pointer",
  },
  countBadge: {
    fontSize: 12, color: "#64748b", background: "#f1f5f9",
    padding: "5px 12px", borderRadius: 20, marginLeft: "auto",
  },

  empty: {
    background: "#fff", border: "1px solid #f1f5f9",
    borderRadius: 12, padding: 50, textAlign: "center",
  },

  timelineWrap: { display: "flex", flexDirection: "column", gap: 28 },
  daySection: { display: "flex", flexDirection: "column", gap: 14 },
  dayHeader: { display: "flex", alignItems: "center", gap: 10 },
  dayLabel: { fontSize: 13, fontWeight: 700, color: "#6366f1", whiteSpace: "nowrap" },
  dayLine: { flex: 1, height: 1, background: "#e2e8f0" },

  dayEvents: { display: "flex", flexDirection: "column" },
  eventRow: { display: "flex", gap: 14 },
  eventRail: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  eventDot: {
    width: 32, height: 32, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, flexShrink: 0,
  },
  eventRailLine: { width: 2, flex: 1, background: "#f1f5f9", marginTop: 4, minHeight: 16 },

  eventCard: {
    flex: 1, background: "#fff", border: "1px solid #f1f5f9",
    borderRadius: 12, padding: "14px 16px", marginBottom: 14,
  },
  eventCardLate: {
    background: "#fefce8",
    border: "1px solid #fde68a",
  },
  eventCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  eventTypePill: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 },
  eventTime: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" },
  eventDescription: { fontSize: 13.5, color: "#1e293b", lineHeight: 1.5, margin: "0 0 10px" },
  eventMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaTag: {
    fontSize: 11.5, color: "#64748b", background: "#f8fafc",
    padding: "3px 10px", borderRadius: 8, border: "1px solid #e2e8f0",
    display: "flex", alignItems: "center", gap: 6,
  },
  lateTag: {
    fontSize: 11, fontWeight: 700, color: "#a16207",
    background: "#fef9c3", padding: "3px 10px", borderRadius: 8,
    border: "1px solid #fde68a",
  },
  roleBadge: {
    fontSize: 10, color: "#94a3b8", background: "#f1f5f9",
    padding: "1px 6px", borderRadius: 10, textTransform: "capitalize",
  },

  loadMoreBtn: {
    padding: "9px 20px", background: "#fff", color: "#6366f1",
    border: "1px solid #e0e7ff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  filterGroup: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    color: "#64748b",
    whiteSpace: "nowrap",
  },
};
