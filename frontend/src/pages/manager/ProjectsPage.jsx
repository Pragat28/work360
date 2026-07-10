import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const statusColor = {
  assigned:  { bg: "#dcfce7", color: "#16a34a", label: "Assigned" },
  completed: { bg: "#dbeafe", color: "#2563eb", label: "Completed" },
  on_hold:   { bg: "#fef9c3", color: "#ca8a04", label: "On Hold" },
};

const avatarColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48", "#8b5cf6"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function idOf(ref) {
  if (!ref) return null;
  return typeof ref === "object" ? ref._id : ref;
}

// ─── Create Project Modal ─────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "" });
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
      });
      onCreate(data.project);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Create new project</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Project name *</label>
          <input style={styles.input} placeholder="e.g. Performance Management"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} placeholder="Brief description of the project..."
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

// ─── Edit Project Modal ───────────────────────────────────────────────────────
function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    title: project.title || "",
    description: project.description || "",
    startDate: project.startDate?.slice(0, 10) || "",
    endDate: project.endDate?.slice(0, 10) || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const { data } = await API.patch(`/projects/${project._id}`, form);
      onSave(data.project);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Edit project</h2>
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

// ─── Local (client-side) single-select filter — no API call, just filters a given list ──
function LocalUserFilter({ label, options, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = query.trim()
    ? options.filter(u => (u.name || "").toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function pick(user) {
    onChange(user);
    setOpen(false);
    setQuery("");
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={styles.sideLabel}>{label}</div>
      {value ? (
        <div style={styles.filterChipRow}>
          <span style={styles.filterChip}>
            {value.name}
            <button style={styles.chipRemove} onClick={() => onChange(null)}>×</button>
          </span>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            style={styles.sideInput}
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && (
            <div style={styles.sideDropdown}>
              {results.length === 0 && <div style={styles.pickerHint}>No matches</div>}
              {results.map(u => (
                <div key={u._id} style={styles.pickerItem} onMouseDown={() => pick(u)}>
                  <div style={{ ...styles.pickerAvatar, background: avatarColors[(u.name || "?").charCodeAt(0) % 6] }}>
                    {(u.name || "?")[0]}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "#0f172a" }}>{u.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date range mini-filter ────────────────────────────────────────────────────
function DateRangeFilter({ label, from, to, onFrom, onTo }) {
  return (
    <div>
      <div style={styles.sideLabel}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input type="date" style={styles.sideInput} value={from} onChange={e => onFrom(e.target.value)} />
        <input type="date" style={styles.sideInput} value={to} onChange={e => onTo(e.target.value)} />
      </div>
    </div>
  );
}

// ─── Project Row (record/list variant) ─────────────────────────────────────────
function ProjectRow({ project, onEdit, onView }) {
  const sc = statusColor[project.status] || statusColor.assigned;
  const p = project.progress || {};
  const pct = p.percent ?? 0;
  const employees = project.assignedEmployees || [];
  const managers = project.assignedManagers || [];
  const allMembers = [...managers.map(m => m.name || m), ...employees.map(e => e.name || e)];
  const progColor = pct === 100 ? "#22c55e" : pct > 60 ? "#6366f1" : "#f59e0b";

  return (
    <div style={styles.row}>
      <div style={{ ...styles.rowRail, background: sc.color }} />

      <div style={styles.rowMain}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={styles.rowTitle}>{project.title}</span>
          <span style={{ ...styles.statusBadge, background: sc.bg, color: sc.color }}>{sc.label}</span>
        </div>
        <div style={styles.rowDesc}>
          {project.description || <em style={{ color: "#cbd5e1" }}>No description</em>}
        </div>
      </div>

      <div style={styles.rowCol}>
        <div style={styles.rowColLabel}>Timeline</div>
        <div style={styles.datesRow}>
          <span style={styles.datePill}>{fmtDate(project.startDate)}</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>→</span>
          <span style={styles.datePill}>{fmtDate(project.endDate)}</span>
        </div>
      </div>

      <div style={{ ...styles.rowCol, minWidth: 130 }}>
        <div style={styles.rowColLabel}>Progress</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.completed ?? 0}/{p.total ?? 0} subtasks</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#0f172a" }}>{pct}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${pct}%`, background: progColor }} />
        </div>
        {project.avgRating != null && (
          <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
            {"★".repeat(Math.round(project.avgRating))}{"☆".repeat(5 - Math.round(project.avgRating))}
          </div>
        )}
      </div>

      <div style={styles.rowCol}>
        <div style={styles.rowColLabel}>Team</div>
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
          <span style={styles.teamLabel}>{managers.length} mgr · {employees.length} emp</span>
        </div>
      </div>

      <div style={styles.rowActions}>
        <button onClick={() => onView(project)} style={styles.viewBtn}>View project →</button>
        <button onClick={() => onEdit(project)} style={styles.editBtn}>✏️ Edit</button>
      </div>
    </div>
  );
}

// ─── Projects Page ────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState(null);

  // ── Sidebar filter state ──
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [startFrom, setStartFrom] = useState("");
  const [startTo, setStartTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── Pagination ──
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await API.get("/projects", { params });
      setProjects(data.projects || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Deduplicated employee list across all of this manager's projects, for the Employee filter.
  const allEmployees = useMemo(() => {
    const map = new Map();
    projects.forEach(p => {
      (p.assignedEmployees || []).forEach(e => {
        const id = idOf(e);
        if (id && !map.has(id)) map.set(id, typeof e === "object" ? e : { _id: id, name: id });
      });
    });
    return Array.from(map.values());
  }, [projects]);

  function handleCreated(p) {
    setProjects(prev => [p, ...prev]);
    setShowCreate(false);
  }
  function handleEdited(p) {
    setProjects(prev => prev.map(x => x._id === p._id ? { ...x, ...p } : x));
    setEditProject(null);
  }

  function clearFilters() {
    setStatusFilter("all");
    setEmployeeFilter(null);
    setStartFrom(""); setStartTo("");
    setDueFrom(""); setDueTo("");
  }

  const activeFilterCount = [
    statusFilter !== "all",
    !!employeeFilter,
    !!startFrom, !!startTo, !!dueFrom, !!dueTo,
  ].filter(Boolean).length;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, employeeFilter, startFrom, startTo, dueFrom, dueTo, search]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      if (employeeFilter) {
        const ids = (p.assignedEmployees || []).map(idOf);
        if (!ids.includes(employeeFilter._id)) return false;
      }

      if (startFrom && p.startDate && p.startDate.slice(0, 10) < startFrom) return false;
      if (startTo && p.startDate && p.startDate.slice(0, 10) > startTo) return false;
      if (dueFrom && p.endDate && p.endDate.slice(0, 10) < dueFrom) return false;
      if (dueTo && p.endDate && p.endDate.slice(0, 10) > dueTo) return false;

      return true;
    });
  }, [projects, statusFilter, employeeFilter, startFrom, startTo, dueFrom, dueTo]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pagedProjects = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, page]);

  const counts = {
    assigned:  projects.filter(p => p.status === "assigned").length,
    completed: projects.filter(p => p.status === "completed").length,
    on_hold:   projects.filter(p => p.status === "on_hold").length,
  };

  return (
    <div style={styles.page}>
      {/* ── Main content ── */}
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Projects</h1>
            <p style={styles.pageSub}>
              {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""} assigned to you
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={styles.createBtn}>+ New project</button>
        </div>

        <input
          style={styles.searchInput}
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

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
          <div style={styles.list}>
            {pagedProjects.map(project => (
              <ProjectRow
                key={project._id}
                project={project}
                onView={(p) => navigate(`/manager/projects/${p._id}`)}
                onEdit={setEditProject}
              />
            ))}
            {filteredProjects.length === 0 && (
              <div style={styles.empty}>
                <div style={{ fontSize: 36 }}>📁</div>
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
                  {projects.length === 0
                    ? "No projects yet. Create one!"
                    : "No projects match the current filters."}
                </div>
                {activeFilterCount > 0 && projects.length > 0 && (
                  <button onClick={clearFilters} style={{ ...styles.createBtn, marginTop: 12 }}>Clear filters</button>
                )}
              </div>
            )}

            {filteredProjects.length > 0 && totalPages > 1 && (
              <div style={styles.paginator}>
                <span style={styles.paginatorInfo}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProjects.length)} of {filteredProjects.length}
                </span>
                <div style={styles.paginatorControls}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ ...styles.pageBtn, ...(page === 1 ? styles.pageBtnDisabled : {}) }}
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                    .reduce((acc, n, i, arr) => {
                      if (i > 0 && n - arr[i - 1] > 1) acc.push("…");
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((n, i) =>
                      n === "…" ? (
                        <span key={`gap-${i}`} style={styles.pageEllipsis}>…</span>
                      ) : (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          style={{ ...styles.pageBtn, ...(n === page ? styles.pageBtnActive : {}) }}
                        >
                          {n}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ ...styles.pageBtn, ...(page === totalPages ? styles.pageBtnDisabled : {}) }}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Filters sidebar (right side, retractable) ── */}
      {filtersOpen ? (
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>Filters</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={styles.clearBtn}>Clear ({activeFilterCount})</button>
              )}
              <button onClick={() => setFiltersOpen(false)} style={styles.collapseBtn} title="Hide filters">›</button>
            </div>
          </div>

          <div style={styles.sideSection}>
            <div style={styles.sideLabel}>Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["all", "assigned", "completed", "on_hold"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{ ...styles.statusOption, ...(statusFilter === s ? styles.statusOptionActive : {}) }}
                >
                  <span>{s === "all" ? "All statuses" : statusColor[s]?.label ?? s}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>
                    {s === "all" ? projects.length : counts[s] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.sideSection}>
            <LocalUserFilter label="Employee" options={allEmployees} value={employeeFilter} onChange={setEmployeeFilter} />
          </div>

          <div style={styles.sideSection}>
            <DateRangeFilter label="Start date between" from={startFrom} to={startTo} onFrom={setStartFrom} onTo={setStartTo} />
          </div>

          <div style={styles.sideSection}>
            <DateRangeFilter label="Due date between" from={dueFrom} to={dueTo} onFrom={setDueFrom} onTo={setDueTo} />
          </div>
        </aside>
      ) : (
        <button onClick={() => setFiltersOpen(true)} style={styles.expandBtn} title="Show filters">
          <span style={{ fontSize: 14 }}>‹</span>
          <span style={styles.expandBtnLabel}>Filters</span>
          {activeFilterCount > 0 && <span style={styles.expandBadge}>{activeFilterCount}</span>}
        </button>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
      {editProject && <EditProjectModal project={editProject} onClose={() => setEditProject(null)} onSave={handleEdited} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f8fafc" },

  // Sidebar
  sidebar: { width: 260, flexShrink: 0, background: "#fff", borderLeft: "1px solid #f1f5f9", padding: "24px 18px", display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  sidebarHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  clearBtn: { fontSize: 11, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 },
  collapseBtn: { width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 6, cursor: "pointer", fontSize: 14, color: "#64748b", lineHeight: 1, flexShrink: 0 },
  expandBtn: { flexShrink: 0, width: 40, alignSelf: "flex-start", position: "sticky", top: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 10, padding: "12px 0", cursor: "pointer", marginTop: 32 },
  expandBtnLabel: { fontSize: 11, fontWeight: 600, color: "#64748b", writingMode: "vertical-rl", textOrientation: "mixed" },
  expandBadge: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#6366f1", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  sideSection: { borderTop: "1px solid #f1f5f9", paddingTop: 16 },
  sideLabel: { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 },
  sideInput: { width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" },
  sideDropdown: { position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginTop: 4, maxHeight: 220, overflowY: "auto" },
  statusOption: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 7, border: "1px solid transparent", background: "transparent", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" },
  statusOptionActive: { background: "#eef2ff", borderColor: "#c7d2fe", color: "#4338ca", fontWeight: 600 },
  filterChipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  filterChip: { display: "flex", alignItems: "center", gap: 4, background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 500, borderRadius: 20, padding: "3px 8px" },
  chipRemove: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6366f1", padding: 0, lineHeight: 1 },
  pickerItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" },
  pickerHint: { padding: "10px 12px", fontSize: 12.5, color: "#94a3b8", textAlign: "center" },
  pickerAvatar: { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 },

  // Main
  main: { flex: 1, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" },
  pageSub: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  createBtn: { padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  searchInput: { padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#fff", width: 320, outline: "none" },

  // List / record rows
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 40, textAlign: "center" },

  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "14px 18px", position: "relative" },
  rowRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderRadius: "12px 0 0 12px" },
  rowMain: { flex: "1 1 220px", minWidth: 160, paddingLeft: 8 },
  rowTitle: { fontSize: 15, fontWeight: 600, color: "#0f172a" },
  rowDesc: { fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginTop: 3, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  rowCol: { flex: "0 0 auto", minWidth: 140, display: "flex", flexDirection: "column", justifyContent: "center" },
  rowColLabel: { fontSize: 10.5, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 },
  rowActions: { flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" },

  statusBadge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0 },
  progressTrack: { height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", width: 130 },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.5s ease" },
  datesRow: { display: "flex", alignItems: "center", gap: 6 },
  datePill: { fontSize: 11, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" },
  teamRow: { display: "flex", alignItems: "center", gap: 8 },
  avatarStack: { display: "flex", alignItems: "center" },
  miniAvatar: { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#fff", border: "2px solid #fff" },
  teamLabel: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" },

  viewBtn: { fontSize: 12.5, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: "6px 4px" },
  editBtn: { fontSize: 12, fontWeight: 500, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 12px", cursor: "pointer" },

  spinner: { width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" },

  paginator: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 6, padding: "10px 4px" },
  paginatorInfo: { fontSize: 12.5, color: "#94a3b8" },
  paginatorControls: { display: "flex", alignItems: "center", gap: 4 },
  pageBtn: { minWidth: 30, height: 30, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 7, fontSize: 12.5, color: "#374151", cursor: "pointer" },
  pageBtnActive: { background: "#6366f1", borderColor: "#6366f1", color: "#fff", fontWeight: 600 },
  pageBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  pageEllipsis: { padding: "0 4px", fontSize: 12.5, color: "#94a3b8" },

  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" },
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 },
  label: { fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  textarea: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box", fontFamily: "inherit" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "0 24px 20px" },
  cancelBtn: { padding: "9px 18px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  submitBtn: { padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
};

if (typeof document !== "undefined" && !document.getElementById("proj-spin")) {
  const s = document.createElement("style");
  s.id = "proj-spin";
  s.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(s);
}
