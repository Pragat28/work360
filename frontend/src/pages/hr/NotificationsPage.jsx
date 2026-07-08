import { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ─── API helpers ──────────────────────────────────────────────────────────────

const fetchNotifications = async ({ unreadOnly = false, project = "all", eventType = "all", page = 1, limit = 30 } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (unreadOnly) params.set("unreadOnly", "true");
  if (project && project !== "all") params.set("project", project);
  if (eventType && eventType !== "all") params.set("eventType", eventType);

  const res = await fetch(`${BASE_URL}/notifications?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
};

const fetchNotificationStats = async (project = "all") => {
  const params = new URLSearchParams();
  if (project && project !== "all") params.set("project", project);

  const res = await fetch(`${BASE_URL}/notifications/stats?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notification stats");
  return res.json(); // { total, unread, overdue, ratings }
};

const markOneRead = async (id) => {
  const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark as read");
  return res.json();
};

const markAllReadAPI = async () => {
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark all as read");
  return res.json();
};

// ─── Config ───────────────────────────────────────────────────────────────────
const typeConfig = {
  subtask_created:        { bg: "#e0f2fe", color: "#0284c7", icon: "📝", label: "Created" },
  subtask_assigned:    { bg: "#e0e7ff", color: "#4f46e5", icon: "📌", label: "Assigned" },
  subtask_started:     { bg: "#dbeafe", color: "#2563eb", icon: "▶",  label: "Started" },
  subtask_submission:  { bg: "#e0e7ff", color: "#4f46e5", icon: "📤", label: "Submission" },
  subtask_completed:   { bg: "#dcfce7", color: "#16a34a", icon: "✓",  label: "Completed" },
  subtask_overdue:     { bg: "#fef2f2", color: "#ef4444", icon: "⚠️", label: "Overdue" },
  subtask_edited:        { bg: "#fef3c7", color: "#b45309", icon: "✏️", label: "Edited" },

  project_created:     { bg: "#ecfdf5", color: "#059669", icon: "🆕", label: "Project created" },
  project_edited:      { bg: "#f1f5f9", color: "#475569", icon: "✏️", label: "Project edited" },
  project_completed:   { bg: "#f3e8ff", color: "#7c3aed", icon: "🏁", label: "Project done" },
  project_deleted:     { bg: "#fef2f2", color: "#b91c1c", icon: "🗑",  label: "Project deleted" },
  project_assigned:      { bg: "#dbeafe", color: "#2563eb", icon: "📂", label: "Project assigned" },

  employee_added:      { bg: "#dcfce7", color: "#16a34a", icon: "➕", label: "Employee added" },
  employee_removed:    { bg: "#fef2f2", color: "#ef4444", icon: "➖", label: "Employee removed" },
  manager_added:       { bg: "#dcfce7", color: "#16a34a", icon: "➕", label: "Manager added" },
  manager_removed:     { bg: "#fef2f2", color: "#ef4444", icon: "➖", label: "Manager removed" },

  rating_submitted:    { bg: "#fff7ed", color: "#ea580c", icon: "⭐", label: "Rating" },
  comment_posted:      { bg: "#fef9c3", color: "#ca8a04", icon: "💬", label: "Comment" },

  user_deleted:         { bg: "#fee2e2", color: "#b91c1c", icon: "🗑️", label: "User deleted" },
  user_dept_changed:    { bg: "#e0f2fe", color: "#0284c7", icon: "🔄", label: "Department change" },

  role_assigned:       { bg: "#ede9fe", color: "#7c3aed", icon: "🔑", label: "Role assigned" },
  role_changed:        { bg: "#ede9fe", color: "#7c3aed", icon: "🔑", label: "Role changed" },
  account_locked:      { bg: "#fef2f2", color: "#b91c1c", icon: "🔒", label: "Account locked" },
  password_reset:      { bg: "#f1f5f9", color: "#475569", icon: "🔐", label: "Password reset" },
};

const FALLBACK_TYPE = { bg: "#f1f5f9", color: "#64748b", icon: "🔔", label: "Event" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Project filter dropdown ───────────────────────────────────────────────────

function ProjectFilterDropdown({ projectsSummary, projectFilter, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const anyUnread   = projectsSummary.some((p) => p.unread > 0);
  const selected    = projectsSummary.find((p) => p._id === projectFilter);
  const hasUnread   = projectFilter === "all" ? anyUnread : selected?.unread > 0;
  const triggerLabel = projectFilter === "all" ? "All projects" : (selected?.title || "Project");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={styles.dropdownBtn}>
        📁 {triggerLabel}
        {hasUnread && <span style={styles.dropdownDot} />}
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={styles.dropdownMenu}>
          <div
            onClick={() => { onSelect("all"); setOpen(false); }}
            style={{ ...styles.dropdownItem, ...(projectFilter === "all" ? styles.dropdownItemActive : {}) }}
          >
            <span>All projects</span>
            {anyUnread && <span style={styles.menuDot} />}
          </div>

          {projectsSummary.length === 0 && (
            <div style={{ ...styles.dropdownItem, color: "#94a3b8", cursor: "default" }}>
              No projects yet
            </div>
          )}

          {projectsSummary.map((p) => (
            <div
              key={p._id}
              onClick={() => { onSelect(p._id); setOpen(false); }}
              style={{ ...styles.dropdownItem, ...(projectFilter === p._id ? styles.dropdownItemActive : {}) }}
            >
              <span>{p.title}</span>
              {p.unread > 0 && <span style={styles.menuDot} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({ notif, onMarkRead }) {
  const tc = typeConfig[notif.eventType] ?? FALLBACK_TYPE;

  return (
    <div
      onClick={() => !notif.isRead && onMarkRead(notif._id)}
      style={{
        ...styles.notifCard,
        ...(notif.isRead ? styles.notifRead : styles.notifUnread),
        cursor: notif.isRead ? "default" : "pointer",
      }}
    >
      {!notif.isRead && <div style={styles.unreadDot} />}

      <div style={{ ...styles.notifIcon, background: tc.bg, color: tc.color }}>
        {tc.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.notifHeader}>
          <span style={{ ...styles.notifTitle, fontWeight: notif.isRead ? 500 : 700 }}>
            {tc.label}
          </span>
          <span style={styles.notifTime}>{timeAgo(notif.createdAt)}</span>
        </div>

        <p style={styles.notifMessage}>{notif.message}</p>

        <div style={styles.notifMeta}>
          <span style={{ ...styles.typePill, background: tc.bg, color: tc.color }}>
            {tc.label}
          </span>
          {notif.project?.title && (
            <span style={styles.metaTag}>📁 {notif.project.title}</span>
          )}
          {notif.subtask?.name && (
            <span style={styles.metaTag}>📋 {notif.subtask.name}</span>
          )}
        </div>
      </div>

      {!notif.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(notif._id); }}
          style={styles.readBtn}
          title="Mark as read"
        >
          ✓
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HRNotificationsPage() {
  const [notifications, setNotifications]     = useState([]);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [pagination, setPagination]           = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]                 = useState(true);
  const [loadingMore, setLoadingMore]         = useState(false);
  const [pageError, setPageError]             = useState("");

  const [readFilter, setReadFilter]           = useState("all");
  const [typeFilter, setTypeFilter]           = useState("all");
  const [projectFilter, setProjectFilter]     = useState("all");
  const [projectsSummary, setProjectsSummary] = useState([]);

  const [stats, setStats]               = useState({ total: 0, unread: 0, overdue: 0, ratings: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const currentPage = useRef(1);

  // ── Load notifications list ─────────────────────────────────────────────────
  const load = useCallback(async (page = 1, replace = true) => {
    page === 1 ? setLoading(true) : setLoadingMore(true);
    setPageError("");
    try {
      const unreadOnly = readFilter === "unread";
      const data = await fetchNotifications({ unreadOnly, project: projectFilter, eventType: typeFilter, page, limit: 30 });
      setNotifications((prev) => replace ? data.notifications : [...prev, ...data.notifications]);
      setUnreadCount(data.unreadCount);
      setPagination(data.pagination);
      setProjectsSummary(data.projectsSummary || []);
      currentPage.current = page;
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [readFilter, projectFilter, typeFilter]);

  // Re-fetch the list whenever readFilter/projectFilter/typeFilter change
  useEffect(() => { load(1, true); }, [load]);

  // ── Load stats (org-wide totals, independent of pagination/readFilter) ─────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchNotificationStats(projectFilter);
      setStats(data);
    } catch {
      // silently keep previous stats on failure
    } finally {
      setStatsLoading(false);
    }
  }, [projectFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Mark one read ──────────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    setProjectsSummary((prev) => {
      const notif = notifications.find((n) => n._id === id);
      const projId = notif?.project?._id;
      if (!projId) return prev;
      return prev.map((p) => p._id === projId ? { ...p, unread: Math.max(0, p.unread - 1) } : p);
    });
    try {
      await markOneRead(id);
    } catch {
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: false } : n));
      setUnreadCount((c) => c + 1);
      setStats((prev) => ({ ...prev, unread: prev.unread + 1 }));
      load(currentPage.current, true);
    }
  }, [notifications, load]);

  // ── Mark all read ──────────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setStats((prev) => ({ ...prev, unread: 0 }));
    setProjectsSummary((prev) => prev.map((p) => ({ ...p, unread: 0 })));
    try {
      await markAllReadAPI();
    } catch {
      load(1, true);
      loadStats();
    }
  }, [load, loadStats]);

  const handleLoadMore = () => load(currentPage.current + 1, false);

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.page}>
        <main style={{ ...styles.main, alignItems: "center", justifyContent: "center" }}>
          <div style={styles.spinner} />
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 14 }}>Loading notifications…</p>
        </main>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={styles.page}>
        <main style={{ ...styles.main, alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <p style={{ fontSize: 14, color: "#ef4444", marginTop: 8 }}>{pageError}</p>
            <button onClick={() => load(1, true)} style={styles.actionBtn}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <main style={styles.main}>

        {/* Header */}
        <div style={styles.topbar}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={styles.pageTitle}>Notifications</h1>
              {unreadCount > 0 && (
                <span style={styles.unreadBadge}>{unreadCount} unread</span>
              )}
            </div>
            <p style={styles.pageSub}>Your activity inbox — all projects across the organisation</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
              ✓ Mark all as read
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div style={styles.statsBar}>
          <div style={styles.statChip}>
            <span style={{ ...styles.statVal, color: "#6366f1" }}>{statsLoading ? "…" : stats.total}</span>
            <span style={styles.statLbl}>Total</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statChip}>
            <span style={{ ...styles.statVal, color: "#ef4444" }}>{statsLoading ? "…" : stats.unread}</span>
            <span style={styles.statLbl}>Unread</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statChip}>
            <span style={{ ...styles.statVal, color: "#b91c1c" }}>{statsLoading ? "…" : stats.overdue}</span>
            <span style={styles.statLbl}>Overdue</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statChip}>
            <span style={{ ...styles.statVal, color: "#ea580c" }}>{statsLoading ? "…" : stats.ratings}</span>
            <span style={styles.statLbl}>Ratings</span>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          <div style={styles.filterTabs}>
            {["all", "unread", "read"].map((f) => (
              <button
                key={f}
                onClick={() => setReadFilter(f)}
                style={{ ...styles.filterTab, ...(readFilter === f ? styles.filterTabActive : {}) }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "unread" && unreadCount > 0 && (
                  <span style={styles.filterBadge}>{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          <ProjectFilterDropdown
            projectsSummary={projectsSummary}
            projectFilter={projectFilter}
            onSelect={setProjectFilter}
          />

          <select
            style={styles.select}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <optgroup label="Subtasks">
              <option value="subtask_created">Created</option>
              <option value="subtask_started">Started</option>
              <option value="subtask_submission">Submission</option>
              <option value="subtask_completed">Completed</option>
              <option value="subtask_overdue">Overdue</option>
              <option value="subtask_assigned">Assigned</option>
              <option value="subtask_edited">Edited</option>
            </optgroup>
            <optgroup label="Projects">
              <option value="project_created">Project created</option>
              <option value="project_assigned">Project assigned</option>
              <option value="project_edited">Project edited</option>
              <option value="project_completed">Project done</option>
              <option value="project_deleted">Project deleted</option>
            </optgroup>
            <optgroup label="Team">
              <option value="employee_added">Employee added</option>
              <option value="employee_removed">Employee removed</option>
              <option value="manager_added">Manager added</option>
              <option value="manager_removed">Manager removed</option>
              <option value="user_deleted">User deleted</option>
              <option value="user_dept_changed">Department change</option>
            </optgroup>
            <optgroup label="Feedback">
              <option value="rating_submitted">Ratings</option>
              <option value="comment_posted">Comments</option>
            </optgroup>
          </select>
        </div>

        {/* Notification list */}
        <div style={styles.list}>
          {notifications.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No notifications</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                {readFilter === "unread" ? "You're all caught up!" : "Nothing matches your filters."}
              </div>
            </div>
          ) : (
            notifications.map((notif) => (
              <NotifCard key={notif._id} notif={notif} onMarkRead={handleMarkRead} />
            ))
          )}
        </div>

        {/* Load more */}
        {pagination.page < pagination.pages && (
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{ ...styles.markAllBtn, opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    display: "flex", minHeight: "100vh",
    fontFamily: "'DM Sans', sans-serif", background: "#f8fafc",
  },
  main: {
    flex: 1, padding: "32px 36px",
    display: "flex", flexDirection: "column", gap: 18, maxWidth: 860,
  },
  spinner: {
    width: 36, height: 36, border: "3px solid #e2e8f0",
    borderTop: "3px solid #6366f1", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  topbar: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", flexWrap: "wrap", gap: 12,
  },
  pageTitle:   { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSub:     { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  unreadBadge: {
    fontSize: 12, fontWeight: 600,
    background: "#fef2f2", color: "#ef4444",
    padding: "3px 10px", borderRadius: 20,
  },
  markAllBtn: {
    padding: "8px 14px", background: "#f0fdf4", color: "#16a34a",
    border: "1px solid #bbf7d0", borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  actionBtn: {
    marginTop: 10, padding: "8px 16px", background: "#6366f1", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },

  statsBar: {
    display: "flex", alignItems: "center", gap: 0,
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 12, padding: "14px 20px",
  },
  statChip: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 },
  statVal:  { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  statLbl:  { fontSize: 11, color: "#94a3b8", fontWeight: 500 },
  statDivider: { width: 1, height: 32, background: "#e2e8f0", flexShrink: 0 },

  filters: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  filterTabs: {
    display: "flex", gap: 2,
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 8, padding: 4,
  },
  filterTab: {
    padding: "6px 14px", borderRadius: 6, border: "none",
    background: "transparent", cursor: "pointer",
    fontSize: 13, color: "#64748b",
    display: "flex", alignItems: "center", gap: 5,
  },
  filterTabActive: { background: "#6366f1", color: "#fff" },
  filterBadge: {
    background: "#ef4444", color: "#fff",
    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10,
  },
  select: {
    padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, background: "#fff",
    outline: "none", cursor: "pointer",
  },

  dropdownBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, background: "#fff",
    cursor: "pointer", color: "#374151", fontFamily: "inherit",
  },
  dropdownDot: { width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0 },
  dropdownMenu: {
    position: "absolute", top: "calc(100% + 6px)", left: 0,
    minWidth: 200, background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    padding: 6, zIndex: 20, maxHeight: 280, overflowY: "auto",
  },
  dropdownItem: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, padding: "8px 10px", borderRadius: 7,
    fontSize: 13, color: "#374151", cursor: "pointer",
  },
  dropdownItemActive: { background: "#eef2ff", color: "#4f46e5", fontWeight: 600 },
  menuDot: { width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0 },

  list:  { display: "flex", flexDirection: "column", gap: 10 },
  empty: {
    background: "#fff", border: "1px solid #f1f5f9",
    borderRadius: 12, padding: "60px 20px", textAlign: "center",
  },

  notifCard: {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "16px 18px", borderRadius: 12, border: "1px solid",
    position: "relative", transition: "box-shadow 0.15s",
  },
  notifUnread: { background: "#fefefe", borderColor: "#c7d2fe" },
  notifRead:   { background: "#fff",    borderColor: "#f1f5f9" },
  unreadDot: {
    position: "absolute", top: 18, left: 8,
    width: 7, height: 7, borderRadius: "50%", background: "#6366f1",
  },
  notifIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, flexShrink: 0,
  },
  notifHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: 10, marginBottom: 4,
  },
  notifTitle: { fontSize: 14, color: "#0f172a", lineHeight: 1.4 },
  notifTime:  { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 },

  notifMessage: { fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 8px" },
  notifMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typePill: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10 },
  metaTag: {
    fontSize: 11, color: "#64748b", background: "#f8fafc",
    padding: "2px 8px", borderRadius: 8, border: "1px solid #e2e8f0",
  },
  readBtn: {
    background: "#f0fdf4", color: "#16a34a",
    border: "1px solid #bbf7d0", borderRadius: 6,
    padding: "4px 8px", fontSize: 12,
    cursor: "pointer", flexShrink: 0, alignSelf: "flex-start",
  },
};
