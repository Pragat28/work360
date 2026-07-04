import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const statusColor = {
  assigned:    { bg: "#dcfce7", color: "#16a34a", label: "Assigned" },
  completed: { bg: "#dbeafe", color: "#2563eb", label: "Completed" },
};

const avatarColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48", "#8b5cf6"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── User Search Hook (debounced) ─────────────────────────────────────────────
function useUserSearch(role) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await API.get("/projects/search-users", { params: { q: query, role } });
        setResults(data.users || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, role]);

  return { query, setQuery, results, searching };
}

// ─── User Picker (multi-select with search) ───────────────────────────────────
function UserPicker({ label, role, selected, onChange }) {
  const { query, setQuery, results, searching } = useUserSearch(role);
  const [open, setOpen] = useState(false);

  function toggle(user) {
    const already = selected.find(u => u._id === user._id);
    onChange(already ? selected.filter(u => u._id !== user._id) : [...selected, user]);
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={styles.label}>{label}</label>
      <div style={styles.pickerBox} onClick={() => setOpen(true)}>
        {selected.length === 0
          ? <span style={{ color: "#94a3b8", fontSize: 13 }}>Search and select…</span>
          : selected.map(u => (
            <span key={u._id} style={styles.pickerChip}>
              {u.name}
              <button style={styles.chipRemove} onClick={e => { e.stopPropagation(); toggle(u); }}>×</button>
            </span>
          ))
        }
      </div>
      {open && (
        <div style={styles.pickerDropdown}>
          <input
            autoFocus
            style={styles.pickerSearch}
            placeholder={`Search ${role}s…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
          <div style={styles.pickerList}>
            {searching && <div style={styles.pickerHint}>Searching…</div>}
            {!searching && results.length === 0 && query.trim() && (
              <div style={styles.pickerHint}>No {role}s found</div>
            )}
            {results.map(u => {
              const checked = !!selected.find(s => s._id === u._id);
              return (
                <div key={u._id} style={{ ...styles.pickerItem, background: checked ? "#eef2ff" : "#fff" }}
                  onClick={() => toggle(u)}>
                  <div style={{ ...styles.pickerAvatar, background: avatarColors[u.name.charCodeAt(0) % 6] }}>
                    {u.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email} · {u.department || u.role}</div>
                  </div>
                  {checked && <span style={{ marginLeft: "auto", color: "#6366f1", fontWeight: 700 }}>✓</span>}
                </div>
              );
            })}
          </div>
          <button style={styles.pickerDone} onClick={() => { setOpen(false); setQuery(""); }}>Done</button>
        </div>
      )}
    </div>
  );
}

// ─── Create Project Modal (HR: includes manager + employee assignment) ────────
function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: "", description: "", startDate: "", endDate: "", notificationDays: 4,
  });
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = form.title.trim() && form.startDate && form.endDate;

  async function handleCreate() {
    if (!valid) return;
    setLoading(true); setError("");
    try {
      const { data } = await API.post("/projects", {
        title: form.title,
        description: form.description,
        startDate: form.startDate,
        endDate: form.endDate,
        notificationDays: Number(form.notificationDays),
        assignedManagers: managers.map(m => m._id),
        assignedEmployees: employees.map(e => e._id),
      });
      onCreate(data.project);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>Create new project</h2>
            <p style={styles.modalSub}>You can assign managers and employees now or later.</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Project name *</label>
          <input style={styles.input} placeholder="e.g. Performance Management Q3"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} placeholder="Brief description of the project…"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start date *</label>
              <input style={styles.input} type="date" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>End date *</label>
              <input style={styles.input} type="date" value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <UserPicker label="Assign managers" role="manager" selected={managers} onChange={setManagers} />
          <UserPicker label="Assign employees" role="employee" selected={employees} onChange={setEmployees} />
          <div>
            <label style={styles.label}>Reminder (days before deadline)</label>
            <input style={{ ...styles.input, width: 80 }} type="number" min={1} max={30}
              value={form.notificationDays}
              onChange={e => setForm({ ...form, notificationDays: e.target.value })} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={!valid || loading}
            style={{ ...styles.submitBtn, opacity: (!valid || loading) ? 0.5 : 1, cursor: (!valid || loading) ? "not-allowed" : "pointer" }}>
            {loading ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Project Modal (HR: can also reassign managers) ──────────────────────
function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    title: project.title || "",
    description: project.description || "",
    startDate: project.startDate?.slice(0, 10) || "",
    endDate: project.endDate?.slice(0, 10) || "",
    status: project.status || "active",
    notificationDays: project.notificationDays || 4,
  });
  const [managers, setManagers] = useState(
    (project.assignedManagers || []).map(m =>
      typeof m === "object" ? { _id: m._id, name: m.name, email: m.email } : { _id: m, name: m }
    )
  );
  const [employees, setEmployees] = useState(
    (project.assignedEmployees || []).map(e =>
      typeof e === "object" ? { _id: e._id, name: e.name, email: e.email } : { _id: e, name: e }
    )
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const { data } = await API.patch(`/projects/${project._id}`, {
        ...form,
        notificationDays: Number(form.notificationDays),
        assignedManagers: managers.map(m => m._id),
        assignedEmployees: employees.map(e => e._id),
      });
      onSave(data.project);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>Edit project</h2>
            <p style={styles.modalSub}>Changes are saved immediately and logged in the timeline.</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Project name</label>
          <input style={styles.input} value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={styles.label}>Status</label>
            <select style={styles.input} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <UserPicker label="Assigned managers" role="manager" selected={managers} onChange={setManagers} />
          <UserPicker label="Assigned employees" role="employee" selected={employees} onChange={setEmployees} />
          <div>
            <label style={styles.label}>Reminder (days before deadline)</label>
            <input style={{ ...styles.input, width: 80 }} type="number" min={1} max={30}
              value={form.notificationDays}
              onChange={e => setForm({ ...form, notificationDays: e.target.value })} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={loading}
            style={{ ...styles.submitBtn, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ project, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true); setError("");
    try {
      await API.delete(`/projects/${project._id}`);
      onDeleted(project._id);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ ...styles.modalTitle, color: "#dc2626" }}>Delete project</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: 0 }}>
            Are you sure you want to delete <strong>"{project.title}"</strong>?
            This will also soft-delete all subtasks and archive all ratings.
            This action cannot be undone.
          </p>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleDelete} disabled={loading}
            style={{ ...styles.submitBtn, background: "#dc2626", opacity: loading ? 0.5 : 1 }}>
            {loading ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card (HR variant: shows delete button) ───────────────────────────
function ProjectCard({ project, onEdit, onView, onDelete }) {
  const sc = statusColor[project.status] || statusColor.active;
  const p = project.progress || {};
  const pct = p.percent ?? 0;
  const allMembers = [
    ...(project.assignedManagers || []).map(m => m.name || m),
    ...(project.assignedEmployees || []).map(e => e.name || e),
  ];
  const progColor = pct === 100 ? "#22c55e" : pct > 60 ? "#6366f1" : "#f59e0b";

  return (
    <div style={styles.card}>
      {/* Title row */}
      <div style={styles.cardTitleRow}>
        <h3 style={styles.cardTitle}>{project.title}</h3>
        <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color }}>{sc.label}</span>
      </div>

      <p style={styles.cardDesc}>{project.description || <em style={{ color: "#cbd5e1" }}>No description</em>}</p>

      {/* Created by */}
      {project.createdBy && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
          Created by <strong style={{ color: "#64748b" }}>{project.createdBy.name || project.createdBy}</strong>
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Progress</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{pct}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${pct}%`, background: progColor }} />
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {p.completed ?? 0}/{p.total ?? 0} subtasks completed
        </div>
      </div>

      {/* Dates */}
      <div style={styles.datesRow}>
        <span style={styles.datePill}>📅 {fmtDate(project.startDate)}</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>→</span>
        <span style={styles.datePill}>{fmtDate(project.endDate)}</span>
      </div>

      {/* Avg rating */}
      {project.avgRating != null && (
        <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>
          {"★".repeat(Math.round(project.avgRating))}{"☆".repeat(5 - Math.round(project.avgRating))}
          <span style={{ color: "#94a3b8", marginLeft: 4 }}>{project.avgRating}/5</span>
        </div>
      )}

      {/* Team */}
      <div style={styles.teamRow}>
        <div style={styles.avatarStack}>
          {allMembers.slice(0, 4).map((name, i) => (
            <div key={i} title={name} style={{
              ...styles.miniAvatar,
              background: avatarColors[i % avatarColors.length],
              marginLeft: i === 0 ? 0 : -8,
              zIndex: 10 - i,
            }}>{(name || "?")[0]}</div>
          ))}
          {allMembers.length > 4 && (
            <div style={{ ...styles.miniAvatar, background: "#e2e8f0", color: "#64748b", marginLeft: -8, zIndex: 5 }}>
              +{allMembers.length - 4}
            </div>
          )}
        </div>
        <span style={styles.teamLabel}>
          {(project.assignedManagers || []).length} mgr · {(project.assignedEmployees || []).length} emp
        </span>
      </div>

      {/* Actions */}
      <div style={styles.cardActions}>
        <button onClick={() => onView(project)} style={styles.viewBtn}>View →</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(project)} style={styles.editBtn}>✏️ Edit</button>
          <button onClick={() => onDelete(project)} style={styles.deleteBtn}>🗑</button>
        </div>
      </div>
    </div>
  );
}

// ─── HR Projects Page ─────────────────────────────────────────────────────────
export default function HRProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await API.get("/projects", { params });
      setProjects(data.projects || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(p) {
    setProjects(prev => [p, ...prev]);
    setShowCreate(false);
  }
  function handleEdited(p) {
    setProjects(prev => prev.map(x => x._id === p._id ? { ...x, ...p } : x));
    setEditProject(null);
  }
  function handleDeleted(id) {
    setProjects(prev => prev.filter(x => x._id !== id));
    setDeleteProject(null);
  }

  const counts = {
    active:    projects.filter(p => p.status === "assigned").length,
    completed: projects.filter(p => p.status === "completed").length,
  };

  return (
    <div style={styles.page}>
      <main style={styles.main}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <div style={styles.hrBadge}>HR Admin</div>
            <h1 style={styles.pageTitle}>All Projects</h1>
            <p style={styles.pageSub}>
              {projects.length} project{projects.length !== 1 ? "s" : ""} across the organisation
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={styles.createBtn}>+ New project</button>
        </div>

        {/* ── Summary strip ── */}
        <div style={styles.summaryStrip}>
          {[
            { label: "Active", count: counts.active, color: "#16a34a", bg: "#dcfce7" },
            { label: "Completed", count: counts.completed, color: "#2563eb", bg: "#dbeafe" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ ...styles.summaryCard, borderColor: bg }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={styles.filters}>
          <input style={styles.searchInput} placeholder="Search by title…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={styles.filterTabs}>
            {["all", "assigned", "completed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ ...styles.filterTab, ...(statusFilter === s ? styles.filterTabActive : {}) }}>
                {s === "all" ? "All" : s === "on_hold" ? "On hold" : (statusColor[s]?.label ?? s)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div style={styles.spinner} />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>
            <button onClick={load} style={styles.createBtn}>Retry</button>
          </div>
        ) : (
          <div style={styles.grid}>
            {projects.map(project => (
              <ProjectCard
                key={project._id}
                project={project}
                onView={p => navigate(`/hr/projects/${p._id}`)}
                onEdit={setEditProject}
                onDelete={setDeleteProject}
              />
            ))}
            {projects.length === 0 && (
              <div style={styles.empty}>
                <div style={{ fontSize: 36 }}>📁</div>
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
                  {search ? "No projects match your search." : "No projects yet. Create one to get started."}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
      {editProject && (
        <EditProjectModal project={editProject} onClose={() => setEditProject(null)} onSave={handleEdited} />
      )}
      {deleteProject && (
        <DeleteModal project={deleteProject} onClose={() => setDeleteProject(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f8fafc" },
  main: { flex: 1, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 20 },

  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  hrBadge: { display: "inline-block", fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#ede9fe", borderRadius: 20, padding: "2px 10px", marginBottom: 6, letterSpacing: "0.3px" },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSub: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  createBtn: { padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },

  summaryStrip: { display: "flex", gap: 12 },
  summaryCard: { flex: 1, background: "#fff", border: "2px solid #f1f5f9", borderRadius: 10, padding: "12px 16px", textAlign: "center" },

  filters: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  searchInput: { padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#fff", width: 260, outline: "none" },
  filterTabs: { display: "flex", gap: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4 },
  filterTab: { padding: "5px 14px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#64748b" },
  filterTabActive: { background: "#6366f1", color: "#fff" },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 },
  empty: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 40, textAlign: "center", gridColumn: "1 / -1" },

  card: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "20px 20px 16px", display: "flex", flexDirection: "column" },
  cardTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: 600, color: "#0f172a", margin: 0 },
  statusBadge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0 },
  cardDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 6px" },
  progressTrack: { height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.5s ease" },
  datesRow: { display: "flex", alignItems: "center", gap: 6, margin: "6px 0 10px" },
  datePill: { fontSize: 11, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px" },
  teamRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  avatarStack: { display: "flex", alignItems: "center" },
  miniAvatar: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", border: "2px solid #fff" },
  teamLabel: { fontSize: 12, color: "#94a3b8" },
  cardActions: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: "auto" },
  viewBtn: { fontSize: 13, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 },
  editBtn: { fontSize: 12, fontWeight: 500, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 12px", cursor: "pointer" },
  deleteBtn: { fontSize: 12, fontWeight: 500, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 10px", cursor: "pointer" },

  spinner: { width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" },

  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 0" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
  modalSub: { fontSize: 12, color: "#94a3b8", margin: "4px 0 0" },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8", flexShrink: 0 },
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 },
  label: { fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  textarea: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box", fontFamily: "inherit" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "0 24px 20px" },
  cancelBtn: { padding: "9px 18px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  submitBtn: { padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },

  // User picker
  pickerBox: { minHeight: 42, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", flexWrap: "wrap", gap: 6, cursor: "pointer", background: "#fff", alignItems: "center" },
  pickerChip: { display: "flex", alignItems: "center", gap: 4, background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 500, borderRadius: 20, padding: "2px 8px" },
  chipRemove: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6366f1", padding: 0, lineHeight: 1 },
  pickerDropdown: { position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginTop: 4 },
  pickerSearch: { width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid #f1f5f9", borderRadius: "10px 10px 0 0", fontSize: 13, outline: "none", boxSizing: "border-box" },
  pickerList: { maxHeight: 200, overflowY: "auto" },
  pickerItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" },
  pickerHint: { padding: "12px 14px", fontSize: 13, color: "#94a3b8", textAlign: "center" },
  pickerAvatar: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 },
  pickerDone: { width: "100%", padding: "9px", border: "none", borderTop: "1px solid #f1f5f9", borderRadius: "0 0 10px 10px", background: "#f8fafc", fontSize: 13, fontWeight: 500, color: "#6366f1", cursor: "pointer" },
};

if (typeof document !== "undefined" && !document.getElementById("hr-proj-spin")) {
  const s = document.createElement("style");
  s.id = "hr-proj-spin";
  s.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(s);
}
