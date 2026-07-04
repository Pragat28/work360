import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../utils/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtFileSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const fmtDayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusConfig = {
  pending:     { label: "Pending",     bg: "#fef9c3", color: "#ca8a04", dot: "#ca8a04" },
  in_progress: { label: "In Progress", bg: "#dbeafe", color: "#2563eb", dot: "#2563eb" },
  completed:   { label: "Completed",   bg: "#dcfce7", color: "#16a34a", dot: "#16a34a" },
};

const avatarColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48", "#8b5cf6"];

const EVENT_META = {
  project_created:   { icon: "🎉", color: "#8b5cf6", bg: "#f3e8ff" },
  project_edited:    { icon: "✏️", color: "#6366f1", bg: "#eef2ff" },
  project_deleted:   { icon: "🗑️", color: "#ef4444", bg: "#fef2f2" },
  project_completed: { icon: "🏁", color: "#16a34a", bg: "#dcfce7" },
  subtask_created:   { icon: "📋", color: "#0ea5e9", bg: "#e0f2fe" },
  subtask_edited:    { icon: "✏️", color: "#6366f1", bg: "#eef2ff" },
  subtask_started:   { icon: "▶️", color: "#2563eb", bg: "#dbeafe" },
  subtask_completed: { icon: "✅", color: "#16a34a", bg: "#dcfce7" },
  subtask_deleted:   { icon: "🗑️", color: "#ef4444", bg: "#fef2f2" },
  subtask_assigned:  { icon: "👤", color: "#f59e0b", bg: "#fef9c3" },
  subtask_submission:{ icon: "📤", color: "#0ea5e9", bg: "#e0f2fe" },
  employee_added:    { icon: "➕", color: "#16a34a", bg: "#dcfce7" },
  employee_removed:  { icon: "➖", color: "#ef4444", bg: "#fef2f2" },
  manager_added:     { icon: "➕", color: "#16a34a", bg: "#dcfce7" },
  manager_removed:   { icon: "➖", color: "#ef4444", bg: "#fef2f2" },
};
const DEFAULT_EVENT_META = { icon: "📌", color: "#64748b", bg: "#f1f5f9" };

const FILE_ICONS = {
  "application/pdf": "📄",
  "image/": "🖼️",
  "video/": "🎬",
  "audio/": "🎵",
  "application/zip": "🗜️",
  "application/msword": "📝",
  "application/vnd.openxmlformats": "📝",
  "text/": "📃",
};

function getFileIcon(mimeType = "") {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(key)) return icon;
  }
  return "📎";
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ score, editable = false, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={() => editable && onChange && onChange(s)}
          onMouseEnter={() => editable && setHover(s)}
          onMouseLeave={() => editable && setHover(0)}
          style={{ fontSize: 16, cursor: editable ? "pointer" : "default", color: (hover || score) >= s ? "#f59e0b" : "#e2e8f0", userSelect: "none" }}>★</span>
      ))}
    </div>
  );
}

// ─── User Picker ──────────────────────────────────────────────────────────────
function UserPicker({ label, role, selected, onChange, projectId, projectEmployees = [] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await API.get(`/projects/search-users`, { params: { q: query, role: "employee" } });
        const selectedIds = selected.map(u => u._id);
        const pool = projectEmployees.length
          ? (data.users || []).filter(u => projectEmployees.some(e => e._id === u._id))
          : (data.users || []);
        setResults(pool.filter(u => !selectedIds.includes(u._id)));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected]);

  function addUser(user) { onChange([...selected, user]); setQuery(""); setResults([]); }
  function removeUser(id) { onChange(selected.filter(u => u._id !== id)); }

  return (
    <div>
      <label style={styles.label}>{label}</label>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((u, i) => (
            <div key={u._id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#ede9fe", borderRadius: 20, padding: "3px 10px 3px 6px", fontSize: 12 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: avatarColors[i % avatarColors.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>
                {(u.name || "?")[0]}
              </div>
              <span style={{ color: "#4f46e5", fontWeight: 500 }}>{u.name}</span>
              <button onClick={() => removeUser(u._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input style={styles.input} placeholder={`Search ${role}s by name…`} value={query} onChange={e => setQuery(e.target.value)} />
      {(searching || results.length > 0) && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 4, overflow: "hidden", maxHeight: 180, overflowY: "auto" }}>
          {searching && <div style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>Searching…</div>}
          {!searching && results.length === 0 && query.trim() && (
            <div style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>No users found</div>
          )}
          {results.map((u, i) => (
            <div key={u._id} onClick={() => addUser(u)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: "#fff", borderBottom: "1px solid #f8fafc" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColors[i % avatarColors.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>
                {(u.name || "?")[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}{u.department ? ` · ${u.department}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submissions Panel ────────────────────────────────────────────────────────
function SubmissionsPanel({ subtask, currentUser, projectEmployees }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef();

  const isEmployee = currentUser?.role === "employee";
  const isAssigned = subtask.assignedTo?.some(u =>
    (u._id || u) === currentUser?._id || (u._id || u)?.toString() === currentUser?._id?.toString()
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await API.get(`/subtasks/${subtask._id}/submissions`);
        if (active) setSubmissions(data.submissions || []);
      } catch { if (active) setSubmissions([]); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [subtask._id]);

  async function submitWork() {
    if (!files.length && !note.trim()) { setError("Please attach a file or write a note"); return; }
    setUploading(true); setError(""); setSuccess("");
    try {
      const fd = new FormData();
      if (note.trim()) fd.append("note", note);
      files.forEach(f => fd.append("files", f));
      const { data } = await API.post(`/subtasks/${subtask._id}/submissions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmissions(prev => [data.submission, ...prev]);
      setNote(""); setFiles([]);
      setSuccess("Work submitted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setUploading(false); }
  }

  async function deleteSubmission(id) {
    try {
      await API.delete(`/submissions/${id}`);
      setSubmissions(prev => prev.filter(s => s._id !== id));
    } catch (e) { setError(e.response?.data?.message || e.message); }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
        📤 Work Submissions ({submissions.length})
      </div>
      {isEmployee && isAssigned && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Submit your work</div>
          {error && <div style={{ ...styles.errorBanner, marginBottom: 8 }}>{error}</div>}
          {success && <div style={{ background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#16a34a", marginBottom: 8 }}>{success}</div>}
          <textarea style={{ ...styles.textarea, minHeight: 56, marginBottom: 8 }}
            placeholder="Add a note or description…" value={note} onChange={e => setNote(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => fileRef.current?.click()} style={{ ...styles.cancelBtn, fontSize: 12 }}>📎 Attach Files</button>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => setFiles(Array.from(e.target.files))} />
            {files.length > 0 && (
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {files.length} file{files.length > 1 ? "s" : ""} selected
                <button onClick={() => setFiles([])} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", marginLeft: 4 }}>✕</button>
              </span>
            )}
            <button onClick={submitWork} disabled={uploading}
              style={{ ...styles.submitBtn, fontSize: 12, marginLeft: "auto", opacity: uploading ? 0.6 : 1 }}>
              {uploading ? "Uploading…" : "Submit"}
            </button>
          </div>
          {files.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                  <span>{getFileIcon(f.type)}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ color: "#94a3b8" }}>{fmtFileSize(f.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {loading && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Loading submissions…</div>}
      {!loading && submissions.length === 0 && (
        <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No submissions yet.</div>
      )}
      {submissions.map((sub) => (
        <div key={sub._id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>
                {(sub.submittedBy?.name || "?")[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{sub.submittedBy?.name || "Unknown"}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDateTime(sub.createdAt)}</div>
              </div>
            </div>
            {(currentUser?.role === "hr_admin" || sub.submittedBy?._id === currentUser?._id) && (
              <button onClick={() => deleteSubmission(sub._id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}>🗑</button>
            )}
          </div>
          {sub.note && (
            <p style={{ fontSize: 13, color: "#374151", margin: "0 0 10px", lineHeight: 1.6, background: "#f8fafc", borderRadius: 6, padding: "8px 10px" }}>
              {sub.note}
            </p>
          )}
          {sub.files?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sub.files.map((file, i) => (
                <a key={i} href={file.cloudinaryUrl} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, textDecoration: "none" }}>
                  <span style={{ fontSize: 16 }}>{getFileIcon(file.fileType)}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.originalName}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{fmtFileSize(file.fileSize)}</span>
                  <span style={{ fontSize: 11, color: "#0369a1", fontWeight: 600, flexShrink: 0 }}>↓ Download</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Add Subtask Modal ────────────────────────────────────────────────────────
function AddSubtaskModal({ projectId, projectEmployees, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", startDate: "", dueDate: "" });
  const [assignedTo, setAssignedTo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const valid = form.name.trim() && form.startDate && form.dueDate;

  async function submit() {
    if (!valid) return;
    setLoading(true); setError("");
    try {
      const { data } = await API.post(`/projects/${projectId}/subtasks`, {
        name: form.name, description: form.description,
        startDate: form.startDate, dueDate: form.dueDate,
        assignedTo: assignedTo.map(u => u._id),
      });
      onCreated(data.subtask);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Add Subtask</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Subtask Name *</label>
          <input style={styles.input} placeholder="e.g. Write API Documentation" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} placeholder="Optional details..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start Date *</label>
              <input style={styles.input} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Due Date *</label>
              <input style={styles.input} type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <UserPicker label="Assign To (optional)" role="employee" selected={assignedTo} onChange={setAssignedTo} projectId={projectId} projectEmployees={projectEmployees} />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={!valid || loading} style={{ ...styles.submitBtn, opacity: (!valid || loading) ? 0.5 : 1, cursor: (!valid || loading) ? "not-allowed" : "pointer" }}>
            {loading ? "Creating…" : "Create Subtask"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Subtask Modal ───────────────────────────────────────────────────────
function EditSubtaskModal({ subtask, projectId, projectEmployees, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: subtask.name || "", description: subtask.description || "",
    startDate: fmtDate(subtask.startDate), dueDate: fmtDate(subtask.dueDate),
  });
  const [assignedTo, setAssignedTo] = useState(subtask.assignedTo || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true); setError("");
    try {
      const { data } = await API.patch(`/subtasks/${subtask._id}`, {
        ...form, assignedTo: assignedTo.map(u => u._id),
      });
      onSaved(data.subtask);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Edit Subtask</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Name</label>
          <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start Date</label>
              <input style={styles.input} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Due Date</label>
              <input style={styles.input} type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <UserPicker label="Assigned To" role="employee" selected={assignedTo} onChange={setAssignedTo} projectId={projectId} projectEmployees={projectEmployees} />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rating Modal ─────────────────────────────────────────────────────────────
function RatingModal({ subtask, existingRating, onClose, onSubmitted }) {
  const [ratingInput, setRatingInput] = useState({
    stars: existingRating?.stars || 0,
    remark: existingRating?.remark || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!ratingInput.stars) { setError("Please select a star rating"); return; }
    setLoading(true); setError("");
    try {
      const payload = { stars: ratingInput.stars, remark: ratingInput.remark };
      const { data } = existingRating
        ? await API.patch(`/subtasks/${subtask._id}/rating`, payload)
        : await API.post(`/subtasks/${subtask._id}/rating`, payload);
      onSubmitted(subtask._id, data.rating);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: 400 }}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{existingRating ? "Update Rating" : "Rate Subtask"}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <div style={{ fontSize: 14, color: "#374151", marginBottom: 4, fontWeight: 500 }}>{subtask.name}</div>
          <label style={styles.label}>Score</label>
          <StarRating score={ratingInput.stars} editable onChange={s => setRatingInput(p => ({ ...p, stars: s }))} />
          <label style={{ ...styles.label, marginTop: 12 }}>Remark</label>
          <textarea style={styles.textarea} placeholder="Feedback for the employee..."
            value={ratingInput.remark} onChange={e => setRatingInput(p => ({ ...p, remark: e.target.value }))} />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Submitting…" : existingRating ? "Update Rating" : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ type, projectId, currentIds, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const role = type === "manager" ? "manager" : "employee";
        const { data } = await API.get(`/projects/search-users`, { params: { q: query, role } });
        setResults((data.users || []).filter(u => !currentIds.includes(u._id)));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function addUser(user) {
    setLoading(true); setError("");
    try {
      const field = type === "manager" ? "assignedManagers" : "assignedEmployees";
      const newIds = [...currentIds, user._id];
      const { data } = await API.patch(`/projects/${projectId}`, { [field]: newIds });
      const updated = type === "manager" ? data.project.assignedManagers : data.project.assignedEmployees;
      onAdded(updated);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: 400 }}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Add {type === "manager" ? "Manager" : "Employee"}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <label style={styles.label}>Search user</label>
          <input style={styles.input} placeholder="Type a name or email..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
            {searching && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Searching…</div>}
            {!searching && query.trim() && results.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>No users found</div>}
            {!searching && !query.trim() && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Start typing to search…</div>}
            {results.map((u, i) => (
              <div key={u._id} style={styles.userPickRow}>
                <div style={{ ...styles.miniAvatar, background: avatarColors[i % avatarColors.length] }}>{(u.name || "?")[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.email}</div>
                </div>
                <button onClick={() => addUser(u)} disabled={loading} style={styles.addMemberBtn}>+ Add</button>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}
// ─── Lateness helpers — mirror the employee-side logic ───────────────────────
function isOverdueNow(st) {
  if (st.status === "completed" || st.isCompleted) return false;
  const due = new Date(st.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

function isCompletedLate(st) {
  const done = st.status === "completed" || st.isCompleted;
  if (!done || !st.completedAt) return false;
  const due = new Date(st.dueDate);
  due.setHours(23, 59, 59, 999);
  return new Date(st.completedAt) > due;
}

// ─── Subtask Card ─────────────────────────────────────────────────────────────
function SubtaskCard({
  subtask, index, total, projectId, projectEmployees,
  onEdit, onRequestDelete, onRequestRate, onReorder, currentUser,
}) {
  const [expanded, setExpanded]       = useState(false);
  const [activeSection, setActiveSection] = useState("comments");
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [localSubtask, setLocalSubtask] = useState(subtask);
  const [editingDue, setEditingDue]   = useState(false);
  const [dueVal, setDueVal]           = useState(fmtDate(subtask.dueDate));
  const [savingDue, setSavingDue]     = useState(false);
  const [comments, setComments]       = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [rating, setRating]           = useState(null);
  const [loadingRating, setLoadingRating] = useState(false);

  const isManagerOrAdmin = currentUser?.role === "manager" || currentUser?.role === "hr_admin";

  useEffect(() => {
    setLocalSubtask(subtask);
    setDueVal(fmtDate(subtask.dueDate));
  }, [subtask]);

  useEffect(() => {
    if (!expanded || activeSection !== "comments") return;
    let active = true;
    setLoadingComments(true);
    API.get(`/subtasks/${localSubtask._id}/comments`)
      .then(({ data }) => { if (active) setComments(data.comments || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingComments(false); });
    return () => { active = false; };
  }, [expanded, activeSection, localSubtask._id]);

  // Fetch rating as soon as the subtask is completed — not gated on expand,
  // so the collapsed row shows the correct "Re-rate" state and stars.
  useEffect(() => {
    if (localSubtask.status !== "completed") { setRating(null); return; }
    let active = true;
    setLoadingRating(true);
    API.get(`/subtasks/${localSubtask._id}/rating`)
      .then(({ data }) => { if (active) setRating(data.rating || null); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingRating(false); });
    return () => { active = false; };
  }, [localSubtask._id, localSubtask.status]);

  // Sync instantly when the parent pushes a fresh rating after submit/update,
  // instead of relying on a broken ref callback.
  useEffect(() => {
    if (subtask.rating !== undefined) setRating(subtask.rating);
  }, [subtask.rating]);

  async function postComment() {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const { data } = await API.post(`/subtasks/${localSubtask._id}/comments`, { text: commentText });
      setComments(prev => [...prev, data.comment]);
      setCommentText("");
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally { setPostingComment(false); }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await API.delete(`/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  }

  async function saveDueDate() {
    if (dueVal === fmtDate(localSubtask.dueDate)) { setEditingDue(false); return; }
    setSavingDue(true);
    try {
      const { data } = await API.patch(`/subtasks/${localSubtask._id}`, { dueDate: dueVal });
      setLocalSubtask(prev => ({ ...prev, ...data.subtask }));
      setEditingDue(false);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally { setSavingDue(false); }
  }

  function handleRateClick(e) {
    e.stopPropagation();
    onRequestRate(localSubtask, rating);
  }

  const sc = statusConfig[localSubtask.status] || statusConfig.pending;
  const assignedUsers = localSubtask.assignedTo || [];

  // ── Lateness: either still open and past due, or completed after the deadline ──
  const overdueNow = isOverdueNow(localSubtask);
  const completedLate = isCompletedLate(localSubtask);
  const isLate = overdueNow || completedLate;

  return (
    <div
      style={{
        ...styles.subtaskCard,
        ...(expanded ? styles.subtaskCardExpanded : {}),
        ...(isLate ? styles.subtaskCardLate : {}),
      }}
    >
      <div style={styles.subtaskRow} onClick={() => setExpanded(!expanded)}>
        <div style={styles.subtaskLeft}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 2 }} onClick={e => e.stopPropagation()}>
            <button disabled={index === 0} onClick={() => onReorder(index, -1)}
              style={{ ...styles.reorderBtn, opacity: index === 0 ? 0.3 : 1 }}>▲</button>
            <button disabled={index === total - 1} onClick={() => onReorder(index, 1)}
              style={{ ...styles.reorderBtn, opacity: index === total - 1 ? 0.3 : 1 }}>▼</button>
          </div>
          <div style={{ ...styles.statusDot, background: sc.dot }} />
          <div style={{ minWidth: 0 }}>
            <div style={styles.subtaskName}>{localSubtask.name}</div>
            <div style={styles.subtaskMeta}>
              📅 {fmtDate(localSubtask.startDate)} →{" "}
              {editingDue ? (
                <span onClick={e => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input type="date" value={dueVal} onChange={e => setDueVal(e.target.value)}
                    style={{ border: "1px solid #e2e8f0", borderRadius: 5, padding: "1px 6px", fontSize: 11, outline: "none" }} />
                  <button onClick={saveDueDate} disabled={savingDue}
                    style={{ ...styles.submitBtn, padding: "2px 8px", fontSize: 11 }}>{savingDue ? "…" : "✓"}</button>
                  <button onClick={() => { setDueVal(fmtDate(localSubtask.dueDate)); setEditingDue(false); }}
                    style={{ ...styles.cancelBtn, padding: "2px 8px", fontSize: 11 }}>✕</button>
                </span>
              ) : (
                <span onClick={e => { e.stopPropagation(); setEditingDue(true); }}
                  title="Click to change deadline"
                  style={{ cursor: "pointer", color: "#6366f1", borderBottom: "1px dashed #6366f1" }}>
                  {fmtDate(localSubtask.dueDate)} ✎
                </span>
              )}
            </div>
            {assignedUsers.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {assignedUsers.map((u, i) => (
                  <span key={u._id || i} style={{ fontSize: 10, background: "#ede9fe", color: "#4f46e5", borderRadius: 20, padding: "2px 8px", fontWeight: 500 }}>
                    👤 {u.name || "User"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.subtaskRight}>
          {isLate && (
            <span style={styles.lateBadge}>
              ⏰ {overdueNow ? "Overdue" : "Late"}
            </span>
          )}

          {!loadingRating && rating && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <StarRating score={rating.stars} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{rating.stars}/5</span>
            </div>
          )}
          <span style={{ ...styles.statusPill, background: sc.bg, color: sc.color }}>{sc.label}</span>

          {localSubtask.status === "completed" && isManagerOrAdmin && (
            <button onClick={handleRateClick}
              style={{ ...styles.actionBtn, background: "#fef9c3", color: "#ca8a04" }}>
              {rating ? "✏️ Re-rate" : "⭐ Rate"}
            </button>
          )}

          <button onClick={e => { e.stopPropagation(); onEdit(localSubtask); }} style={styles.iconBtn}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onRequestDelete(localSubtask); }} style={{ ...styles.iconBtn, color: "#ef4444" }}>🗑</button>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Persistent rating + remark — visible whether or not the card is expanded */}
      {!loadingRating && rating && (
        <div style={styles.ratingBanner}>
          <StarRating score={rating.stars} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>{rating.stars}/5</span>
          {rating.remark && <span style={styles.ratingComment}>"{rating.remark}"</span>}
        </div>
      )}

      {expanded && (
        <div style={styles.commentsSection}>
          <div style={styles.commentsDivider} />
          {localSubtask.description && (
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>{localSubtask.description}</p>
          )}
          <div style={{ display: "flex", gap: 2, marginBottom: 14, background: "#f8fafc", borderRadius: 8, padding: 3, alignSelf: "flex-start", width: "fit-content" }}>
            {["comments", "submissions"].map(sec => (
              <button key={sec} onClick={() => setActiveSection(sec)}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  background: activeSection === sec ? "#6366f1" : "transparent",
                  color: activeSection === sec ? "#fff" : "#64748b" }}>
                {sec === "comments" ? "💬 Comments" : "📤 Submissions"}
              </button>
            ))}
          </div>

          {activeSection === "comments" && (
            <>
              {loadingComments && <div style={styles.emptyComments}>Loading comments…</div>}
              {!loadingComments && comments.length === 0 && <div style={styles.emptyComments}>No comments yet.</div>}
              {comments.map((c, i) => (
                <div key={c._id || i} style={styles.commentItem}>
                  <div style={{ ...styles.commentAvatar, background: avatarColors[i % avatarColors.length] }}>
                    {(c.author?.name || c.actor?.name || "?")[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.commentMeta}>
                      <span style={styles.commentAuthor}>{c.author?.name || c.actor?.name || "Unknown"}</span>
                      <span style={styles.commentRole}>{c.authorRole || c.actor?.role || ""}</span>
                      <span style={styles.commentTime}>{fmtDateTime(c.createdAt || c.time)}</span>
                    </div>
                    <div style={styles.commentText}>{c.text || c.description}</div>
                  </div>
                  {(currentUser?.role === "hr_admin" || c.author?._id === currentUser?._id) && (
                    <button onClick={() => deleteComment(c._id)}
                      style={{ ...styles.iconBtn, color: "#ef4444", alignSelf: "flex-start", marginLeft: 6 }}
                      title="Delete comment">🗑</button>
                  )}
                </div>
              ))}
              {isManagerOrAdmin && (
                <div style={styles.commentInput}>
                  <input style={styles.commentBox} placeholder="Write a comment…"
                    value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && postComment()} />
                  <button onClick={postComment} disabled={postingComment} style={styles.postBtn}>
                    {postingComment ? "…" : "Send"}
                  </button>
                </div>
              )}
            </>
          )}

          {activeSection === "submissions" && (
            <SubmissionsPanel subtask={localSubtask} currentUser={currentUser} projectEmployees={projectEmployees} />
          )}
        </div>
      )}
    </div>
  );
}
// ─── Gantt Timeline ───────────────────────────────────────────────────────────

const GANTT_COLORS = {
  assigned:  { color: "#3b82f6", label: "Assigned" },
  progress:  { color: "#eab308", label: "In Progress" },
  completed: { color: "#22c55e", label: "Completed" },
  overdue:   { color: "#ef4444", label: "Overdue" },
  late:      { color: "#f97316", label: "Completed Late" },
};

function getBarStatus(s) {
  const now = new Date();
  const due = s.dueDate ? new Date(s.dueDate) : null;

  if (s.status === "completed") {
    if (s.completedAt && due && !isNaN(due) && new Date(s.completedAt) > due) {
      return GANTT_COLORS.late;
    }
    return GANTT_COLORS.completed;
  }

  if (due && !isNaN(due) && due < now) {
    return GANTT_COLORS.overdue;
  }

  if (s.status === "in_progress") {
    return GANTT_COLORS.progress;
  }

  return GANTT_COLORS.assigned;
}

function GanttTimeline({ subtasks = [], projectStart, projectEnd }) {
  const start = new Date(projectStart);
  const end = new Date(projectEnd);

  const months = [];
  if (!isNaN(start) && !isNaN(end)) {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      months.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  const totalDays = Math.max(1, (end - start) / 86400000 || 1);

  // Mini inline formatter for metadata dates inside the chart
  const fmtGanttDate = (d) => d && !isNaN(new Date(d)) ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

  const getBarLayout = (st) => {
    const sDate = new Date(st.startDate);
    const dDate = new Date(st.dueDate);

    const datesValid = !isNaN(sDate) && !isNaN(dDate);
    const invalidRange = datesValid && dDate < sDate;

    const rawDuration = datesValid ? Math.round((dDate - sDate) / 86400000) : 1;
    const durationDays = Math.max(1, rawDuration || 1);

    const startOffset = datesValid ? Math.max(0, (sDate - start) / 86400000) : 0;

    const leftPercent = Math.min((startOffset / totalDays) * 100, 98);
    const rawWidthPercent = Math.max((durationDays / totalDays) * 100, 1.5);
    // Clamp so the bar never extends past the right edge of the track
    const widthPercent = Math.min(rawWidthPercent, 100 - leftPercent);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      daysCount: durationDays,
      datesValid,
      invalidRange,
    };
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.cardTitle}>Project Timeline</h3>
          <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>Visual task distribution across deadlines</p>
        </div>
        <span style={styles.chip}>Gantt View</span>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "12px", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
        {Object.values(GANTT_COLORS).map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: item.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "11.5px", color: "#475569", fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginTop: "16px" }}>
        <div style={{ minWidth: 700, position: "relative" }}>

          <div style={styles.ganttHeader}>
            <div style={{ width: "180px", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
              {months.map((m, i) => (
                <div key={i} style={styles.ganttMonth}>
                  {m.toLocaleString("en-IN", { month: "short", year: "2-digit" })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            {subtasks.map((s) => {
              const barStatus = getBarStatus(s);
              const layout = getBarLayout(s);
              const firstName = (s.assignedTo?.[0]?.name || "").split(" ")[0] || "Unassigned";

              return (
                <div key={s._id} style={{ ...styles.ganttRow, height: "54px" }}>
                  <div style={styles.ganttLabelArea} title={s.name}>
                    <span style={styles.ganttTaskName}>{s.name}</span>
                  </div>

                  <div style={styles.ganttBarTrack}>
                    <div style={styles.backgroundGrid}>
                      {months.map((_, idx) => (
                        <div key={idx} style={styles.gridColumn} />
                      ))}
                    </div>

                    <div
                      style={{
                        ...styles.ganttBar,
                        left: layout.left,
                        width: layout.width,
                        backgroundColor: barStatus.color,
                        boxShadow: `0 2px 4px ${barStatus.color}33`,
                        ...(layout.invalidRange ? { border: "2px dashed #dc2626" } : {}),
                      }}
                      title={layout.invalidRange ? "⚠ Due date is before start date — check this task's dates" : undefined}
                    >
                      <div style={{ ...styles.floatingMetaLabel, flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={styles.assigneeBadge}>{firstName}</span>
                          {layout.invalidRange && <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: 700 }}>⚠ Invalid dates</span>}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500 }}>
                          {fmtGanttDate(s.startDate)} – {fmtGanttDate(s.dueDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {subtasks.length === 0 && (
              <div style={styles.emptyState}>📁 No subtasks scheduled for this execution window.</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
// ─── Activity Timeline (redesigned) ───────────────────────────────────────────
function ActivityTimeline({ events }) {
  const [filter, setFilter] = useState("all");

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "subtask_completed", label: "Completions" },
    { key: "subtask_assigned", label: "Assignments" },
    { key: "subtask_submission", label: "Submissions" },
  ];

  const filtered = filter === "all" ? events : events.filter(ev => ev.eventType === filter);

  // group by day
  const groups = [];
  filtered.forEach(ev => {
    const dayKey = new Date(ev.createdAt).toDateString();
    let group = groups.find(g => g.key === dayKey);
    if (!group) { group = { key: dayKey, label: fmtDayLabel(ev.createdAt), events: [] }; groups.push(group); }
    group.events.push(ev);
  });

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>Activity Log</h3>
        <span style={styles.chip}>{events.length} event{events.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: "5px 13px", borderRadius: 20, border: "1px solid",
              borderColor: filter === f.key ? "#6366f1" : "#e2e8f0",
              background: filter === f.key ? "#eef2ff" : "#fff",
              color: filter === f.key ? "#4f46e5" : "#64748b",
              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>No activity to show.</div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        {groups.map((group, gi) => (
          <div key={group.key} style={{ marginBottom: gi < groups.length - 1 ? 22 : 0 }}>
            <div style={styles.timelineDayLabel}>{group.label}</div>
            <div style={{ position: "relative" }}>
              {group.events.length > 1 && (
                <div style={styles.timelineRail} />
              )}
              {group.events.map((ev, i) => {
                const meta = EVENT_META[ev.eventType] || DEFAULT_EVENT_META;
                return (
                  <div key={ev._id || i} style={styles.timelineRow}>
                    <div style={{ ...styles.timelineDot, background: meta.bg, color: meta.color, border: `2px solid ${meta.color}33` }}>
                      {meta.icon}
                    </div>
                    <div style={styles.timelineContent}>
                      <div style={styles.timelineDescription}>{ev.description}</div>
                      <div style={styles.timelineTime}>
                        {new Date(ev.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────
function EditProjectInline({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: project.title || "", description: project.description || "",
    startDate: fmtDate(project.startDate), endDate: fmtDate(project.endDate),
    notificationDays: project.notificationDays ?? 4,
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try { await onSaved(form); } finally { setLoading(false); }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Edit Project</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <label style={styles.label}>Project name</label>
          <input style={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <label style={styles.label}>Notification days before due</label>
          <input style={styles.input} type="number" min={1} max={30} value={form.notificationDays} onChange={e => setForm({ ...form, notificationDays: e.target.value })} />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.5 : 1 }}>
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Detail Page ──────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const onBack = () => navigate("/manager/projects");

  const [project, setProject]     = useState(null);
  const [subtasks, setSubtasks]   = useState([]);
  const [timeline, setTimeline]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [activeTab, setActiveTab] = useState("subtasks");
  const [modal, setModal]         = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  });

  const cardRatingRefs = useRef({});

  const loadProject = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await API.get(`/projects/${projectId}`);
      const proj = data.project;
      setProject(proj);
      setSubtasks((proj.subtasks || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  }, [projectId]);

  const loadTimeline = useCallback(async () => {
    try {
      const { data } = await API.get(`/projects/${projectId}/timeline`);
      setTimeline(data.events || []);
    } catch { }
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { if (activeTab === "timeline_preview") loadTimeline(); }, [activeTab, loadTimeline]);

  async function handleReorder(index, dir) {
    const list = [...subtasks];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    [list[index], list[swapIdx]] = [list[swapIdx], list[index]];
    const updated = list.map((st, i) => ({ ...st, order: i }));
    setSubtasks(updated);
    try {
      await Promise.all(updated.map(st => API.patch(`/subtasks/${st._id}`, { order: st.order })));
    } catch { loadProject(); }
  }

  async function handleDeleteSubtask(subtask) {
    try {
      await API.delete(`/subtasks/${subtask._id}`);
      setSubtasks(prev => prev.filter(s => s._id !== subtask._id));
      setDeleteConfirm(null);
    } catch (e) { alert(e.response?.data?.message || e.message); }
  }

  function handleRated(subtaskId, newRating) {
  setSubtasks(prev => prev.map(s => s._id === subtaskId ? { ...s, rating: newRating } : s));
  setModal(null);
}

  function handleRequestRate(subtask, currentRating) {
    setModal({ type: "rate", subtask, existingRating: currentRating });
  }

  function handleSubtaskCreated(subtask) { setSubtasks(prev => [...prev, subtask]); setModal(null); }
  function handleSubtaskSaved(updated) {
    setSubtasks(prev => prev.map(s => s._id === updated._id ? { ...s, ...updated } : s));
    setModal(null);
  }

  async function handleProjectSaved(form) {
    try {
      const { data } = await API.patch(`/projects/${projectId}`, form);
      setProject(prev => ({ ...prev, ...data.project }));
      setModal(null);
    } catch (e) { alert(e.response?.data?.message || e.message); }
  }

  function handleManagerAdded(managers) { setProject(prev => ({ ...prev, assignedManagers: managers })); setModal(null); }
  function handleEmployeeAdded(employees) { setProject(prev => ({ ...prev, assignedEmployees: employees })); setModal(null); }

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc" }}>
      <div style={styles.spinner} />
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f8fafc", gap: 12 }}>
      <p style={{ color: "#dc2626" }}>{error}</p>
      <button onClick={onBack} style={styles.createBtn}>← Back to projects</button>
    </div>
  );

  const managers  = project.assignedManagers  || [];
  const employees = project.assignedEmployees || [];
  const completedCount = subtasks.filter(s => s.status === "completed").length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const sc = { active: "#dcfce7 #16a34a", completed: "#dbeafe #2563eb", on_hold: "#fef9c3 #ca8a04" }[project.status]?.split(" ") || ["#dcfce7", "#16a34a"];

  return (
    <main style={styles.main}>
      <div style={styles.breadcrumb}>
        <span style={styles.breadcrumbLink} onClick={onBack}>Projects</span>
        <span style={{ color: "#94a3b8" }}>/</span>
        <span style={{ color: "#0f172a", fontWeight: 500 }}>{project.title}</span>
      </div>

      <div style={styles.projectHeader}>
        <div style={styles.projectHeaderLeft}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={styles.projectTitle}>{project.title}</h1>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sc[0], color: sc[1] }}>
              {project.status?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          <p style={styles.projectDesc}>{project.description || <em style={{ color: "#cbd5e1" }}>No description</em>}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span style={styles.metaChip}>📅 {fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
            <span style={styles.metaChip}>📋 {subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}</span>
            <span style={styles.metaChip}>👥 {managers.length + employees.length} members</span>
            {project.avgRating != null && (
              <span style={{ ...styles.metaChip, color: "#f59e0b" }}>{"★".repeat(Math.round(project.avgRating))} {project.avgRating}/5 avg</span>
            )}
          </div>
        </div>
        <div style={styles.projectHeaderRight}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#6366f1" }}>{progress}%</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>complete</div>
            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${progress}%` }} /></div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{completedCount}/{subtasks.length} subtasks</div>
          </div>
          <button onClick={() => setModal("edit-project")} style={styles.editBtn}>✏️ Edit</button>
        </div>
      </div>

      <div style={styles.tabs}>
        {["subtasks", "team", "timeline_preview"].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}>
            {tab === "subtasks" ? "📋 Subtasks" : tab === "team" ? "👥 Team" : "📅 Timeline"}
          </button>
        ))}
      </div>

      {activeTab === "subtasks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setModal("add-subtask")} style={styles.createBtn}>+ Add Subtask</button>
          </div>
          {subtasks.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>📋</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>No subtasks yet. Add the first one!</div>
            </div>
          )}
          {subtasks.map((subtask, index) => (
            <SubtaskCard
              key={subtask._id}
              subtask={subtask}
              index={index}
              total={subtasks.length}
              projectId={projectId}
              projectEmployees={employees}
              currentUser={currentUser}
              onEdit={s => setModal({ type: "edit-subtask", subtask: s })}
              onRequestDelete={setDeleteConfirm}
              onRequestRate={handleRequestRate}
              onReorder={handleReorder}
              ref={el => {
                if (el) cardRatingRefs.current[subtask._id] = el;
                else delete cardRatingRefs.current[subtask._id];
              }}
            />
          ))}
        </div>
      )}

      {activeTab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Managers</h3>  
            </div>
            <div style={styles.memberGrid}>
              {managers.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>No managers assigned</div>}
              {managers.map((m, i) => (
                <div key={m._id} style={styles.memberCard}>
                  <div style={{ ...styles.memberAvatar, background: avatarColors[i % avatarColors.length] }}>{(m.name || "?")[0]}</div>
                  <div><div style={styles.memberName}>{m.name}</div><div style={styles.memberEmail}>{m.email}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Employees</h3>
              <button onClick={() => setModal({ type: "add-member", memberType: "employee" })} style={styles.addMemberBtn}>+ Add Employee</button>
            </div>
            <div style={styles.memberGrid}>
              {employees.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>No employees assigned</div>}
              {employees.map((e, i) => (
                <div key={e._id} style={styles.memberCard}>
                  <div style={{ ...styles.memberAvatar, background: avatarColors[(i + 2) % avatarColors.length] }}>{(e.name || "?")[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.memberName}>{e.name}</div>
                    <div style={styles.memberEmail}>{e.email}{e.department ? ` · ${e.department}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "timeline_preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <GanttTimeline subtasks={subtasks} projectStart={project.startDate} projectEnd={project.endDate} />
          <ActivityTimeline events={timeline} />
        </div>
      )}

      {modal === "add-subtask" && (
        <AddSubtaskModal projectId={projectId} projectEmployees={employees} onClose={() => setModal(null)} onCreated={handleSubtaskCreated} />
      )}
      {modal?.type === "edit-subtask" && (
        <EditSubtaskModal subtask={modal.subtask} projectId={projectId} projectEmployees={employees} onClose={() => setModal(null)} onSaved={handleSubtaskSaved} />
      )}
      {modal?.type === "rate" && (
        <RatingModal
          subtask={modal.subtask}
          existingRating={modal.existingRating}
          onClose={() => setModal(null)}
          onSubmitted={handleRated}
        />
      )}
      {modal?.type === "add-member" && (
        <AddMemberModal
          type={modal.memberType}
          projectId={projectId}
          currentIds={(modal.memberType === "manager" ? managers : employees).map(m => m._id)}
          onClose={() => setModal(null)}
          onAdded={modal.memberType === "manager" ? handleManagerAdded : handleEmployeeAdded}
        />
      )}
      {modal === "edit-project" && (
        <EditProjectInline project={project} onClose={() => setModal(null)} onSaved={handleProjectSaved} />
      )}

      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 400 }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Delete subtask?</h2>
              <button onClick={() => setDeleteConfirm(null)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will archive its rating.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setDeleteConfirm(null)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={() => handleDeleteSubtask(deleteConfirm)} style={{ ...styles.submitBtn, background: "#dc2626" }}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
const styles = {
  main: { flex: 1, padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" },
  breadcrumb: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#64748b" },
  breadcrumbLink: { color: "#6366f1", cursor: "pointer", fontWeight: 500 },
  projectHeader: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "22px 24px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" },
  projectHeaderLeft: { flex: 1, minWidth: 260 },
  projectTitle: { fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 },
  projectDesc: { fontSize: 14, color: "#64748b", margin: "6px 0 0", lineHeight: 1.6 },
  metaChip: { fontSize: 12, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px" },
  projectHeaderRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, minWidth: 160 },
  progressTrack: { height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", width: 140 },
  progressFill: { height: "100%", borderRadius: 4, background: "#6366f1", transition: "width 0.5s ease" },
  editBtn: { padding: "7px 14px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, cursor: "pointer" },
  tabs: { display: "flex", gap: 2, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 10, padding: 4, alignSelf: "flex-start" },
  tab: { padding: "7px 18px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#64748b", fontWeight: 500, fontFamily: "inherit" },
  tabActive: { background: "#6366f1", color: "#fff" },
  createBtn: { padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  subtaskCard: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, overflow: "hidden" },
  subtaskCardExpanded: { border: "1px solid #e0e7ff" },
  subtaskRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", gap: 10 },
  subtaskLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  statusDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  subtaskName: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  subtaskMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  subtaskRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  statusPill: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 },
  actionBtn: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 4px", fontFamily: "inherit" },
  reorderBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 9, padding: "1px 3px", color: "#94a3b8", lineHeight: 1, fontFamily: "inherit" },
  commentsSection: { padding: "0 16px 16px" },
  commentsDivider: { height: 1, background: "#f1f5f9", margin: "0 0 12px" },
  emptyComments: { fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginBottom: 12 },
  commentItem: { display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  commentAvatar: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 },
  commentMeta: { display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" },
  commentAuthor: { fontSize: 12, fontWeight: 600, color: "#0f172a" },
  commentRole: { fontSize: 10, color: "#94a3b8", background: "#f1f5f9", padding: "1px 6px", borderRadius: 10 },
  commentTime: { fontSize: 11, color: "#94a3b8" },
  commentText: { fontSize: 13, color: "#374151", lineHeight: 1.5 },
  commentInput: { display: "flex", gap: 8, marginTop: 8 },
  commentBox: { flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" },
  postBtn: { padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  ratingBanner: { display: "flex", alignItems: "center", gap: 8, padding: "0 16px 14px 40px" },
  ratingDisplay: { display: "flex", alignItems: "center", gap: 10, marginTop: 12, background: "#fffbeb", borderRadius: 8, padding: "8px 12px" },
  ratingComment: { fontSize: 12, color: "#92400e", fontStyle: "italic" },
  card: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "18px 20px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#0f172a", margin: 0 },
  chip: { fontSize: 11, background: "#f1f5f9", color: "#64748b", padding: "3px 10px", borderRadius: 20 },
  addMemberBtn: { padding: "5px 12px", background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500, fontFamily: "inherit" },
  memberGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 },
  memberCard: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #f1f5f9", borderRadius: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 },
  memberName: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  memberEmail: { fontSize: 11, color: "#94a3b8" },
  miniAvatar: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 },

  // ── Redesigned Gantt Timeline UI styles ──
  ganttHeader: { display: "flex", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: "8px" },
  ganttMonth: { flex: 1, fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", textAlign: "left", paddingLeft: "8px" },
  ganttRow: { display: "flex", alignItems: "center", height: "44px", borderBottom: "1px solid #f8fafc" },
  ganttLabelArea: { width: "180px", flexShrink: 0, paddingRight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  ganttTaskName: { fontSize: "13px", fontWeight: 500, color: "#334155" },
  ganttBarTrack: { flex: 1, height: "100%", position: "relative", display: "flex", alignItems: "center" },
  backgroundGrid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", pointerEvents: "none" },
  gridColumn: { flex: 1, height: "100%", borderLeft: "1px dashed #f1f5f9" },
  ganttBar: { position: "absolute", height: "10px", borderRadius: "20px", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" },
  floatingMetaLabel: { position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" },
  assigneeBadge: { fontSize: "11px", fontWeight: 600, color: "#1e293b", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" },
  durationText: { fontSize: "11px", color: "#94a3b8" },
  emptyState: { padding: "32px 0", fontSize: "13px", color: "#94a3b8", textAlign: "center" },

  userPickRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 },
  spinner: { width: 32, height: 32, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" },
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4, display: "block" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  textarea: { width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", minHeight: 70, boxSizing: "border-box", fontFamily: "inherit" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "0 24px 20px" },
  cancelBtn: { padding: "9px 18px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  submitBtn: { padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },

  // ── Activity Timeline ──────────────────────────────────────────────────────
  timelineDayLabel: { fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 },
  timelineRail: { position: "absolute", left: 15, top: 32, bottom: 8, width: 2, background: "#f1f5f9" },
  timelineRow: { display: "flex", gap: 14, position: "relative", paddingBottom: 18 },
  timelineDot: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1, background: "#fff" },
  timelineContent: { flex: 1, paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  timelineDescription: { fontSize: 13, color: "#374151", lineHeight: 1.5, flex: 1, minWidth: 180 },
  timelineTime: { fontSize: 11, color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" },
  subtaskCardLate: {
    background: "#fefce8",
    border: "1px solid #fde68a",
  },
  lateBadge: {
    fontSize: 11, fontWeight: 700, color: "#a16207",
    background: "#fef9c3", padding: "3px 10px", borderRadius: 20,
    border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 4,
  },
};

if (typeof document !== "undefined" && !document.getElementById("detail-spin")) {
  const s = document.createElement("style"); s.id = "detail-spin";
  s.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(s);
}
