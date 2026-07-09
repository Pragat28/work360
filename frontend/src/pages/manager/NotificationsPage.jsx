import { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = "http://localhost:5000/api";

const getToken = () => localStorage.getItem("token");
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ─── API helpers ──────────────────────────────────────────────────────────────

const fetchNotifications = async ({ unreadOnly = false, project = "all", page = 1, limit = 30 } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (unreadOnly) params.set("unreadOnly", "true");
  if (project && project !== "all") params.set("project", project);

  const res = await fetch(`${BASE_URL}/notifications?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json(); // { notifications, unreadCount, pagination, projectsSummary }
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

const typeColors = {
  subtask_completed: { bg: "#dcfce7", color: "#16a34a" },
  subtask_started:   { bg: "#dbeafe", color: "#2563eb" },
  comment_posted:    { bg: "#fef9c3", color: "#ca8a04" },
  subtask_overdue:           { bg: "#fef2f2", color: "#ef4444" },
  subtask_deleted : { bg: "#fee2e2", color: "#b91c1c" },
  project_completed: { bg: "#f3e8ff", color: "#7c3aed" },
  rating_submitted:  { bg: "#fff7ed", color: "#ea580c" },
  subtask_submission: { bg: "#e0e7ff", color: "#4f46e5" },
  subtask_overdue: { bg: "#fef2f2", color: "#ef4444" },
  subtask_assigned: { bg: "#e0f2fe", color: "#0284c7" },
  subtask_edited: { bg: "#fef3c7", color: "#b45309" },
  employee_added: { bg: "#d1fae5", color: "#059669" },
  employee_removed: { bg: "#fee2e2", color: "#b91c1c" },
  project_created: { bg: "#ede9fe", color: "#7c3aed" },
  project_edited: { bg: "#fef3c7", color: "#b45309" },
  project_assigned: { bg: "#dbeafe", color: "#2563eb" },
  user_deleted : { bg: "#fee2e2", color: "#b91c1c" },
  user_dept_changed : { bg: "#e0f2fe", color: "#0284c7" },
  project_assigned: { bg: "#dbeafe", color: "#2563eb" },
  manager_added: { bg: "#dbeafe", color: "#2563eb" },
  manager_removed: { bg: "#fee2e2", color: "#b91c1c" },
  subtask_created: { bg: "#e0f2fe", color: "#0284c7" },
};

const typeIcons = {
  subtask_completed: "✓",
  subtask_started:   "▶",
  comment_posted:    "💬",
  subtask_overdue:           "⚠️",
  project_completed: "🏁",
  rating_submitted:  "⭐",
  subtask_submission: "📤",
  employee_added: "➕",
  employee_removed: "➖",
  subtask_assigned: "👤",
  subtask_edited: "✏️",
  project_created: "📁",
  project_edited: "✏️",
  project_assigned: "📂",
  user_deleted : "🗑️",
  user_role_changed : "🔄",
  user_dept_changed : "🔄",
  project_assigned: "📂",
  manager_added: "➕",
  manager_removed: "➖",
  subtask_created: "📝",
  project_deleted: "🗑️",
  subtask_deleted: "🗑️",
};

const typeLabels = {
  subtask_completed: "Completed",
  subtask_started:   "Started",
  comment_posted:    "Comment",
  subtask_overdue:           "Overdue",
  project_completed: "Project done",
  rating_submitted:  "Rating",
  subtask_submission: "Submission",
  subtask_overdue: "Overdue",
  employee_added: "Employee added",
  employee_removed: "Employee removed",
  subtask_assigned: "Subtask assigned",
  subtask_edited: "Subtask edited",
  manager_added: "Manager added",
  manager_removed: "Manager removed",
  project_created: "Project created",
  project_edited: "Project edited",
  project_assigned: "Project assigned",
  user_deleted : "User deleted",
  user_dept_changed : "Department change",
  project_assigned: "Project assigned",
  subtask_created: "Created",
  project_deleted: "Project deleted",
  subtask_deleted: "Deleted",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Derive a consistent colour from a role string
const actorColor = {
  hr_admin: "#6366f1",
  manager:  "#0ea5e9",
  employee: "#10b981",
};

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({ notif, onMarkRead }) {
  const tc    = typeColors[notif.eventType] ?? { bg: "#f1f5f9", color: "#64748b" };
  const icon  = typeIcons[notif.eventType]  ?? "🔔";
  const label = typeLabels[notif.eventType] ?? notif.eventType;

  return (
    <div
      onClick={() => !notif.isRead && onMarkRead(notif._id)}
      style={{
        ...styles.notifCard,
        ...(notif.isRead ? styles.notifRead : styles.notifUnread),
        cursor: notif.isRead ? "default" : "pointer",
      }}
    >
      {/* Unread dot */}
      {!notif.isRead && <div style={styles.unreadDot} />}

      {/* Type icon */}
      <div style={{ ...styles.notifIcon, background: tc.bg, color: tc.color }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.notifHeader}>
          <span style={{ ...styles.notifTitle, fontWeight: notif.isRead ? 500 : 700 }}>
            {label}
          </span>
          <span style={styles.notifTime}>{timeAgo(notif.createdAt)}</span>
        </div>
        <p style={styles.notifMessage}>{notif.message}</p>
        <div style={styles.notifMeta}>
          <span style={{ ...styles.typePill, background: tc.bg, color: tc.color }}>
            {label}
          </span>
          {notif.project?.title && (
            <span style={styles.metaTag}>📁 {notif.project.title}</span>
          )}
          {notif.subtask?.name && (
            <span style={styles.metaTag}>📋 {notif.subtask.name}</span>
          )}
        </div>
      </div>

      {/* Mark read button */}
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

// ─── Project filter dropdown ───────────────────────────────────────────────────

function ProjectFilterDropdown({ projectsSummary, projectFilter, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const anyUnread = projectsSummary.some((p) => p.unread > 0);
  const selected = projectsSummary.find((p) => p._id === projectFilter);
  const triggerHasUnread = projectFilter === "all" ? anyUnread : (selected?.unread > 0);
  const triggerLabel = projectFilter === "all" ? "All projects" : (selected?.title || "Project");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={styles.projectDropdownBtn}>
        📁 {triggerLabel}
        {triggerHasUnread && <span style={styles.dropdownDot} />}
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={styles.projectMenu}>
          <div
            onClick={() => { onSelect("all"); setOpen(false); }}
            style={{ ...styles.projectMenuItem, ...(projectFilter === "all" ? styles.projectMenuItemActive : {}) }}
          >
            <span>All projects</span>
            {anyUnread && <span style={styles.menuDot} />}
          </div>

          {projectsSummary.length === 0 && (
            <div style={{ ...styles.projectMenuItem, color: "#94a3b8", cursor: "default" }}>
              No projects yet
            </div>
          )}

          {projectsSummary.map((p) => (
            <div
              key={p._id}
              onClick={() => { onSelect(p._id); setOpen(false); }}
              style={{ ...styles.projectMenuItem, ...(projectFilter === p._id ? styles.projectMenuItemActive : {}) }}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [pagination, setPagination]       = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [pageError, setPageError]         = useState("");

  const [readFilter, setReadFilter]       = useState("all");
  const [typeFilter, setTypeFilter]       = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [projectsSummary, setProjectsSummary] = useState([]);

  // Ref to avoid stale-closure issues in load function
  const currentPage = useRef(1);

  // ── Load / reload ──────────────────────────────────────────────────────────
  const load = useCallback(async (page = 1, replace = true) => {
    page === 1 ? setLoading(true) : setLoadingMore(true);
    setPageError("");
    try {
      const unreadOnly = readFilter === "unread";
      const data = await fetchNotifications({ unreadOnly, project: projectFilter, page, limit: 30 });
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
  }, [readFilter, projectFilter]);

  // Reload when read filter or project filter changes
  useEffect(() => { load(1, true); }, [load]);

  // ── Mark single read ───────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => n._id === id ? { ...n, isRead: true } : n)
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setProjectsSummary((prev) => {
      const notif = notifications.find((n) => n._id === id);
      const projId = notif?.project?._id;
      if (!projId) return prev;
      return prev.map((p) => p._id === projId ? { ...p, unread: Math.max(0, p.unread - 1) } : p);
    });

    try {
      await markOneRead(id);
    } catch {
      // Roll back on failure
      setNotifications((prev) =>
        prev.map((n) => n._id === id ? { ...n, isRead: false } : n)
      );
      setUnreadCount((c) => c + 1);
      load(currentPage.current, true);
    }
  }, [notifications, load]);

  // ── Mark all read ──────────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setProjectsSummary((prev) => prev.map((p) => ({ ...p, unread: 0 })));

    try {
      await markAllReadAPI();
    } catch {
      // Reload to correct state on failure
      load(1, true);
    }
  }, [load]);

  // ── Load more ──────────────────────────────────────────────────────────────
  const handleLoadMore = () => load(currentPage.current + 1, false);

  // ── Client-side type filter (applied on top of server read/project filter) ─
  const filtered = notifications.filter(
    (n) => typeFilter === "all" || n.eventType === typeFilter
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center" }}>
        <div style={styles.spinner} />
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 14 }}>Loading notifications…</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <p style={{ fontSize: 14, color: "#ef4444", marginTop: 8 }}>{pageError}</p>
          <button onClick={() => load(1, true)} style={styles.markAllBtn}>Retry</button>
        </div>
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
            <p style={styles.pageSub}>Activity from your team and projects</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
              ✓ Mark all as read
            </button>
          )}
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
              <option value="subtask_assigned">Assigned</option>
              <option value="subtask_started">Started</option>
              <option value="subtask_submission">Submission</option>
              <option value="subtask_completed">Completed</option>
              <option value="subtask_edited">Edited</option>
              <option value="subtask_overdue">Overdue</option>
              <option value="subtask_deleted">Deleted</option>
            </optgroup>
            <optgroup label="Projects">
              <option value="project_assigned">Assigned</option>
              <option value="project_edited">Edited</option>
              <option value="project_completed">Completed</option>
              <option value="project_deleted">Deleted</option>
            </optgroup>
            <optgroup label="People">
              <option value="employee_added">Employee added</option>
              <option value="employee_removed">Employee removed</option>
              <option value="manager_added">Manager added</option>
              <option value="manager_removed">Manager removed</option>
            </optgroup>
            <optgroup label="Other">
              <option value="comment_posted">Comments</option>
              <option value="rating_submitted">Ratings</option>
            </optgroup>
            <optgroup label="Account">
              <option value="user_dept_changed">Department changed</option>
              <option value="user_deleted">User deleted</option>
            </optgroup>
          </select>
        </div>

        {/* List */}
        <div style={styles.list}>
          {filtered.length === 0 && (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No notifications</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>You're all caught up!</div>
            </div>
          )}

          {filtered.map((notif) => (
            <NotifCard key={notif._id} notif={notif} onMarkRead={handleMarkRead} />
          ))}
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
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'DM Sans', sans-serif",
    background: "#f8fafc",
  },
  main: {
    flex: 1,
    padding: "32px 36px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 820,
  },
  spinner: {
    width: 36, height: 36,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  topbar: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", flexWrap: "wrap", gap: 12,
  },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSub:   { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  unreadBadge: {
    fontSize: 12, fontWeight: 600,
    background: "#fef2f2", color: "#ef4444",
    padding: "3px 10px", borderRadius: 20,
  },
  markAllBtn: {
    padding: "8px 14px",
    background: "#f0fdf4", color: "#16a34a",
    border: "1px solid #bbf7d0",
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
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
    fontSize: 9, fontWeight: 700,
    padding: "1px 5px", borderRadius: 10,
  },
  select: {
    padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13,
    background: "#fff", outline: "none", cursor: "pointer",
  },
  // ── Project dropdown ─────────────────────────────────────────────────────
  projectDropdownBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, background: "#fff",
    cursor: "pointer", color: "#374151", fontFamily: "inherit",
  },
  dropdownDot: {
    width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
  },
  projectMenu: {
    position: "absolute", top: "calc(100% + 6px)", left: 0,
    minWidth: 200, background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    padding: 6, zIndex: 20, maxHeight: 280, overflowY: "auto",
  },
  projectMenuItem: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8, padding: "8px 10px", borderRadius: 7,
    fontSize: 13, color: "#374151", cursor: "pointer",
  },
  projectMenuItemActive: { background: "#eef2ff", color: "#4f46e5", fontWeight: 600 },
  menuDot: { width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: {
    background: "#fff", border: "1px solid #f1f5f9",
    borderRadius: 12, padding: "60px 20px", textAlign: "center",
  },
  notifCard: {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "16px 18px", borderRadius: 12,
    border: "1px solid", position: "relative",
    transition: "box-shadow 0.15s",
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
  notifTitle:   { fontSize: 14, color: "#0f172a", lineHeight: 1.4 },
  notifTime:    { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 },
  notifMessage: { fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 8px" },
  notifMeta:    { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typePill: {
    fontSize: 10, fontWeight: 600,
    padding: "2px 8px", borderRadius: 10,
  },
  metaTag: {
    fontSize: 11, color: "#64748b",
    background: "#f8fafc", padding: "2px 8px",
    borderRadius: 8, border: "1px solid #e2e8f0",
  },
  readBtn: {
    background: "#f0fdf4", color: "#16a34a",
    border: "1px solid #bbf7d0", borderRadius: 6,
    padding: "4px 8px", fontSize: 12,
    cursor: "pointer", flexShrink: 0, alignSelf: "flex-start",
  },
};
