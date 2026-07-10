import { useState, useEffect, useCallback, useMemo } from "react";
import API from "../../utils/api"; // ⚠️ adjust to match your project's API client path

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const toISODate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const fmtFileSize = (bytes) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// ⚠️ Adjust to match your actual Subtask status enum
const statusConfig = {
  pending: { label: "Pending", bg: "#fef9c3", color: "#ca8a04", dot: "#ca8a04" },
  in_progress: { label: "In Progress", bg: "#dbeafe", color: "#2563eb", dot: "#2563eb" },
  completed: { label: "Completed", bg: "#dcfce7", color: "#16a34a", dot: "#16a34a" },
};

const avatarColors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48", "#8b5cf6"];

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

// Normalizes a populated-or-raw-id field (e.g. subtask.project, a user ref) to its id string
function idOf(ref) {
  if (!ref) return null;
  return typeof ref === "object" ? ref._id : ref;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ score, editable = false, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => editable && onChange && onChange(s)}
          onMouseEnter={() => editable && setHover(s)}
          onMouseLeave={() => editable && setHover(0)}
          style={{
            fontSize: 16,
            cursor: editable ? "pointer" : "default",
            color: (hover || score) >= s ? "#f59e0b" : "#e2e8f0",
            userSelect: "none",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── User Picker (searches employees on this manager's own projects) ─────────
// ⚠️ Adjust the endpoint below if your manager-scoped user search route differs.
function UserPicker({ label, role, selected, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await API.get(`/project/search-users`, { params: { q: query, role } });
        const selectedIds = selected.map((u) => u._id);
        setResults((data.users || []).filter((u) => !selectedIds.includes(u._id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected, role]);

  function addUser(user) {
    onChange([...selected, user]);
    setQuery("");
    setResults([]);
  }
  function removeUser(id) {
    onChange(selected.filter((u) => u._id !== id));
  }

  return (
    <div>
      <label style={styles.label}>{label}</label>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((u, i) => (
            <div
              key={u._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "#ede9fe",
                borderRadius: 20,
                padding: "3px 10px 3px 6px",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: avatarColors[i % avatarColors.length],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {(u.name || "?")[0]}
              </div>
              <span style={{ color: "#4f46e5", fontWeight: 500 }}>{u.name}</span>
              <button
                onClick={() => removeUser(u._id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 12, padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        style={styles.input}
        placeholder={`Search ${role}s by name…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(searching || results.length > 0) && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 4, overflow: "hidden", maxHeight: 180, overflowY: "auto" }}>
          {searching && <div style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>Searching…</div>}
          {!searching && results.length === 0 && query.trim() && (
            <div style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>No users found</div>
          )}
          {results.map((u, i) => (
            <div
              key={u._id}
              onClick={() => addUser(u)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", background: "#fff", borderBottom: "1px solid #f8fafc" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: avatarColors[i % avatarColors.length],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {(u.name || "?")[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submissions Panel ────────────────────────────────────────────────────────
function SubmissionsPanel({ subtask }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await API.get(`/subtasks/${subtask._id}/submissions`);
        if (active) setSubmissions(data.submissions || []);
      } catch {
        if (active) setSubmissions([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [subtask._id]);

  async function deleteSubmission(id) {
    try {
      await API.delete(`/submissions/${id}`);
      setSubmissions((prev) => prev.filter((s) => s._id !== id));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
        📤 Work Submissions ({submissions.length})
      </div>
      {error && <div style={{ ...styles.errorBanner, marginBottom: 8 }}>{error}</div>}
      {loading && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>Loading submissions…</div>}
      {!loading && submissions.length === 0 && (
        <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>No submissions yet.</div>
      )}
      {submissions.map((sub) => (
        <div key={sub._id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {(sub.submittedBy?.name || "?")[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{sub.submittedBy?.name || "Unknown"}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDateTime(sub.createdAt)}</div>
              </div>
            </div>
            <button
              onClick={() => deleteSubmission(sub._id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13 }}
            >
              🗑
            </button>
          </div>
          {sub.note && (
            <p style={{ fontSize: 13, color: "#374151", margin: "0 0 10px", lineHeight: 1.6, background: "#f8fafc", borderRadius: 6, padding: "8px 10px" }}>
              {sub.note}
            </p>
          )}
          {sub.files?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sub.files.map((file, i) => (
                <a
                  key={i}
                  href={file.cloudinaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, textDecoration: "none" }}
                >
                  <span style={{ fontSize: 16 }}>{getFileIcon(file.fileType)}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.originalName}
                  </span>
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

// ─── Add Subtask Modal (only usable when a single project is selected) ───────
function AddSubtaskModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", startDate: "", dueDate: "" });
  const [assignedTo, setAssignedTo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const valid = form.name.trim() && form.startDate && form.dueDate;

  async function submit() {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await API.post(`/projects/${projectId}/subtasks`, {
        name: form.name,
        description: form.description,
        startDate: form.startDate,
        dueDate: form.dueDate,
        assignedTo: assignedTo.map((u) => u._id),
      });
      onCreated(data.subtask);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
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
          <input style={styles.input} placeholder="e.g. Write API Documentation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} placeholder="Optional details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start Date *</label>
              <input style={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Due Date *</label>
              <input style={styles.input} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <UserPicker label="Assign To (optional)" role="employee" selected={assignedTo} onChange={setAssignedTo} />
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!valid || loading}
            style={{ ...styles.submitBtn, opacity: !valid || loading ? 0.5 : 1, cursor: !valid || loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Creating…" : "Create Subtask"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Subtask Modal ───────────────────────────────────────────────────────
function EditSubtaskModal({ subtask, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: subtask.name || "",
    description: subtask.description || "",
    startDate: fmtDate(subtask.startDate),
    dueDate: fmtDate(subtask.dueDate),
  });
  const [assignedTo, setAssignedTo] = useState(subtask.assignedTo || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const { data } = await API.patch(`/subtasks/${subtask._id}`, { ...form, assignedTo: assignedTo.map((u) => u._id) });
      onSaved(data.subtask);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
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
          <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={styles.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Start Date</label>
              <input style={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Due Date</label>
              <input style={styles.input} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <UserPicker label="Assigned To" role="employee" selected={assignedTo} onChange={setAssignedTo} />
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
  const [ratingInput, setRatingInput] = useState({ stars: existingRating?.stars || 0, remark: existingRating?.remark || "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!ratingInput.stars) {
      setError("Please select a star rating");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = { stars: ratingInput.stars, remark: ratingInput.remark };
      const { data } = existingRating
        ? await API.patch(`/subtasks/${subtask._id}/rating`, payload)
        : await API.post(`/subtasks/${subtask._id}/rating`, payload);
      onSubmitted(subtask._id, data.rating);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
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
          <StarRating score={ratingInput.stars} editable onChange={(s) => setRatingInput((p) => ({ ...p, stars: s }))} />
          <label style={{ ...styles.label, marginTop: 12 }}>Remark</label>
          <textarea
            style={styles.textarea}
            placeholder="Feedback for the employee..."
            value={ratingInput.remark}
            onChange={(e) => setRatingInput((p) => ({ ...p, remark: e.target.value }))}
          />
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

// ─── Subtask Accordion Card ────────────────────────────────────────────────────
function SubtaskAccordionCard({ subtask, project, onEdit, onRequestDelete, onRequestRate }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("comments");
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [localSubtask, setLocalSubtask] = useState(subtask);
  const [editingDue, setEditingDue] = useState(false);
  const [dueVal, setDueVal] = useState(fmtDate(subtask.dueDate));
  const [savingDue, setSavingDue] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [rating, setRating] = useState(null);
  const [loadingRating, setLoadingRating] = useState(false);

  useEffect(() => {
    setLocalSubtask(subtask);
    setDueVal(fmtDate(subtask.dueDate));
  }, [subtask]);

  useEffect(() => {
    if (!expanded || activeSection !== "comments") return;
    let active = true;
    setLoadingComments(true);
    API.get(`/subtasks/${localSubtask._id}/comments`)
      .then(({ data }) => {
        if (active) setComments(data.comments || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingComments(false);
      });
    return () => {
      active = false;
    };
  }, [expanded, activeSection, localSubtask._id]);

  useEffect(() => {
    if (localSubtask.status !== "completed") {
      setRating(null);
      return;
    }
    let active = true;
    setLoadingRating(true);
    API.get(`/subtasks/${localSubtask._id}/rating`)
      .then(({ data }) => {
        if (active) setRating(data.rating || null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingRating(false);
      });
    return () => {
      active = false;
    };
  }, [localSubtask._id, localSubtask.status]);

  useEffect(() => {
    if (subtask.rating !== undefined) setRating(subtask.rating);
  }, [subtask.rating]);

  async function postComment() {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const { data } = await API.post(`/subtasks/${localSubtask._id}/comments`, { text: commentText });
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await API.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  }

  async function saveDueDate() {
    if (dueVal === fmtDate(localSubtask.dueDate)) {
      setEditingDue(false);
      return;
    }
    setSavingDue(true);
    try {
      const { data } = await API.patch(`/subtasks/${localSubtask._id}`, { dueDate: dueVal });
      setLocalSubtask((prev) => ({ ...prev, ...data.subtask }));
      setEditingDue(false);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setSavingDue(false);
    }
  }

  const sc = statusConfig[localSubtask.status] || statusConfig.pending;
  const assignedUsers = localSubtask.assignedTo || [];
  const isOverdue = localSubtask.status !== "completed" && !!localSubtask.dueDate && new Date(localSubtask.dueDate) < new Date();
  const isLate =
    localSubtask.status === "completed" &&
    !!localSubtask.dueDate &&
    !!localSubtask.completedAt &&
    new Date(localSubtask.completedAt) > new Date(localSubtask.dueDate);
  const flagged = isOverdue || isLate;

  const projectTitle = localSubtask.project?.title || project?.title;

  return (
    <div
      style={{
        ...styles.subtaskCard,
        ...(expanded ? styles.subtaskCardExpanded : {}),
        ...(flagged ? { background: "#fefce8", border: "1px solid #fde68a" } : {}),
      }}
    >
      <div style={styles.subtaskRow} onClick={() => setExpanded(!expanded)}>
        <div style={styles.subtaskLeft}>
          <div style={{ ...styles.statusDot, background: flagged ? "#ca8a04" : sc.dot }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={styles.subtaskName}>{localSubtask.name}</div>
              {projectTitle && <span style={styles.projectChip}>📁 {projectTitle}</span>}
            </div>
            <div style={styles.subtaskMeta}>
              📅 {fmtDate(localSubtask.startDate)} →{" "}
              {editingDue ? (
                <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input type="date" value={dueVal} onChange={(e) => setDueVal(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 5, padding: "1px 6px", fontSize: 11, outline: "none" }} />
                  <button onClick={saveDueDate} disabled={savingDue} style={{ ...styles.submitBtn, padding: "2px 8px", fontSize: 11 }}>
                    {savingDue ? "…" : "✓"}
                  </button>
                  <button
                    onClick={() => {
                      setDueVal(fmtDate(localSubtask.dueDate));
                      setEditingDue(false);
                    }}
                    style={{ ...styles.cancelBtn, padding: "2px 8px", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDue(true);
                  }}
                  title="Click to change deadline"
                  style={{ cursor: "pointer", color: flagged ? "#ca8a04" : "#6366f1", fontWeight: flagged ? 600 : 400, borderBottom: `1px dashed ${flagged ? "#ca8a04" : "#6366f1"}` }}
                >
                  {fmtDate(localSubtask.dueDate)} ✎
                </span>
              )}
              {isOverdue && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#a16207", background: "#fef9c3", padding: "2px 8px", borderRadius: 8, border: "1px solid #fde68a" }}>
                  ⏰ Overdue
                </span>
              )}
              {isLate && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#a16207", background: "#fef9c3", padding: "2px 8px", borderRadius: 8, border: "1px solid #fde68a" }}>
                  ⏰ Completed late
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
          <span style={{ ...styles.statusPill, background: sc.bg, color: sc.color }}>{sc.label}</span>
          {localSubtask.status === "completed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestRate(localSubtask, rating);
              }}
              style={{ ...styles.actionBtn, background: "#fef9c3", color: "#ca8a04" }}
            >
              {rating ? "✏️ Re-rate" : "⭐ Rate"}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(localSubtask);
            }}
            style={styles.iconBtn}
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(localSubtask);
            }}
            style={{ ...styles.iconBtn, color: "#ef4444" }}
          >
            🗑
          </button>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

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
          {localSubtask.description && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>{localSubtask.description}</p>}
          <div style={{ display: "flex", gap: 2, marginBottom: 14, background: "#f8fafc", borderRadius: 8, padding: 3, alignSelf: "flex-start", width: "fit-content" }}>
            {["comments", "submissions"].map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: activeSection === sec ? "#6366f1" : "transparent",
                  color: activeSection === sec ? "#fff" : "#64748b",
                }}
              >
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
                  <div style={{ ...styles.commentAvatar, background: avatarColors[i % avatarColors.length] }}>{(c.author?.name || c.actor?.name || "?")[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.commentMeta}>
                      <span style={styles.commentAuthor}>{c.author?.name || c.actor?.name || "Unknown"}</span>
                      <span style={styles.commentRole}>{c.authorRole || c.actor?.role || ""}</span>
                      <span style={styles.commentTime}>{fmtDateTime(c.createdAt || c.time)}</span>
                    </div>
                    <div style={styles.commentText}>{c.text || c.description}</div>
                  </div>
                  <button onClick={() => deleteComment(c._id)} style={{ ...styles.iconBtn, color: "#ef4444", alignSelf: "flex-start", marginLeft: 6 }} title="Delete comment">
                    🗑
                  </button>
                </div>
              ))}
              <div style={styles.commentInput}>
                <input
                  style={styles.commentBox}
                  placeholder="Write a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && postComment()}
                />
                <button onClick={postComment} disabled={postingComment} style={styles.postBtn}>
                  {postingComment ? "…" : "Send"}
                </button>
              </div>
            </>
          )}

          {activeSection === "submissions" && <SubmissionsPanel subtask={localSubtask} />}
        </div>
      )}
    </div>
  );
}

// ─── Filters ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = "#0f172a" }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color: accent }}>{value}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label style={styles.filterLabel}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.filterSelect}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Manager Subtask Overview Page ─────────────────────────────────────────────
export default function SubtaskPage() {
  const [subtasks, setSubtasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [filters, setFilters] = useState({
    status: "all",
    employeeId: "all",
    projectId: "all",
    startDate: "",
    endDate: "",
  });

  // ── Pagination ──
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);

  // Load this manager's own projects once — the backend is expected to scope
  // this to the logged-in manager (same pattern as ManagerTimelinePage /
  // MyTasksPage). Employees are derived from these projects' assignedEmployees,
  // same as the HR page derives them, just without the manager layer.
  // ⚠️ Adjust "/manager/projects" if your manager-scoped route differs.
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await API.get("/projects");
        setProjects(data.projects || data || []);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    }
    loadProjects();
  }, []);

  // Deduplicated employee list, built from this manager's own projects'
  // assignedEmployees. Falls back gracefully if a project only has raw ids.
  const allEmployees = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      (p.assignedEmployees || []).forEach((e) => {
        const id = idOf(e);
        if (id && !map.has(id)) map.set(id, typeof e === "object" ? e : { _id: id, name: id });
      });
    });
    return Array.from(map.values());
  }, [projects]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Fetch the full subtask list once, scoped to this manager's projects.
  // All filtering below happens client-side, same as the HR page — the
  // backend doesn't reliably support filtering by employeeId/projectId directly.
  // ⚠️ Adjust "/manager/subtasks" if your manager-scoped route differs.
  const fetchSubtasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/subtasks");
      setSubtasks(res.data.subtasks || []);
    } catch (err) {
      console.error("Failed to load subtasks:", err);
      setError("Couldn't load subtasks. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const projectsById = useMemo(() => {
    const map = {};
    projects.forEach((p) => { map[p._id] = p; });
    return map;
  }, [projects]);

  // All filtering — status, project, employee (via the subtask's own
  // assignedTo list), and due-date range — computed here.
  const filteredSubtasks = useMemo(() => {
    return subtasks.filter((s) => {
      if (filters.status !== "all") {
        if (filters.status === "overdue") {
          const overdue = s.status !== "completed" && s.dueDate && new Date(s.dueDate) < new Date();
          if (!overdue) return false;
        } else if (s.status !== filters.status) {
          return false;
        }
      }

      const projectId = idOf(s.project);

      if (filters.projectId !== "all" && projectId !== filters.projectId) return false;

      if (filters.employeeId !== "all") {
        const assignedIds = (s.assignedTo || []).map(idOf);
        if (!assignedIds.includes(filters.employeeId)) return false;
      }

      const due = toISODate(s.dueDate);
      if (filters.startDate && due && due < filters.startDate) return false;
      if (filters.endDate && due && due > filters.endDate) return false;

      return true;
    });
  }, [subtasks, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredSubtasks.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pagedSubtasks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSubtasks.slice(start, start + PAGE_SIZE);
  }, [filteredSubtasks, page]);

  const stats = useMemo(() => {
    const total = filteredSubtasks.length;
    const overdue = filteredSubtasks.filter((s) => s.status !== "completed" && s.dueDate && new Date(s.dueDate) < new Date()).length;
    const completed = filteredSubtasks.filter((s) => s.status === "completed").length;
    const inProgress = filteredSubtasks.filter((s) => s.status === "in_progress").length;
    return { total, overdue, completed, inProgress };
  }, [filteredSubtasks]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () =>
    setFilters({ status: "all", employeeId: "all", projectId: "all", startDate: "", endDate: "" });

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.employeeId !== "all" ||
    filters.projectId !== "all" ||
    filters.startDate ||
    filters.endDate;

  function handleSubtaskCreated(subtask) {
    setSubtasks((prev) => [subtask, ...prev]);
    setModal(null);
  }
  function handleSubtaskSaved(updated) {
    setSubtasks((prev) => prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s)));
    setModal(null);
  }
  function handleRated(subtaskId, newRating) {
    setSubtasks((prev) => prev.map((s) => (s._id === subtaskId ? { ...s, rating: newRating } : s)));
    setModal(null);
  }
  async function handleDeleteSubtask(subtask) {
    try {
      await API.delete(`/subtasks/${subtask._id}`);
      setSubtasks((prev) => prev.filter((s) => s._id !== subtask._id));
      setDeleteConfirm(null);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  }

  return (
    <main style={styles.main}>
      <header style={{ marginBottom: 4 }}>
        <h1 style={styles.pageTitle}>Subtasks</h1>
        <p style={styles.pageSubtitle}>Track subtask progress across your projects and team.</p>
      </header>

      <div style={styles.statGrid}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Overdue" value={stats.overdue} accent="#dc2626" />
        <StatCard label="In progress" value={stats.inProgress} accent="#2563eb" />
        <StatCard label="Completed" value={stats.completed} accent="#16a34a" />
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => updateFilter("status", v)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "overdue", label: "Overdue" },
            ]}
          />
          <FilterSelect
            label="Employee"
            value={filters.employeeId}
            onChange={(v) => updateFilter("employeeId", v)}
            options={[{ value: "all", label: "All employees" }, ...allEmployees.map((e) => ({ value: e._id, label: e.name }))]}
          />
          <FilterSelect
            label="Project"
            value={filters.projectId}
            onChange={(v) => updateFilter("projectId", v)}
            options={[{ value: "all", label: "All projects" }, ...projects.map((p) => ({ value: p._id, label: p.title }))]}
          />
          <div>
            <label style={styles.filterLabel}>Due from</label>
            <input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} style={styles.filterSelect} />
          </div>
          <div>
            <label style={styles.filterLabel}>Due until</label>
            <input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} style={styles.filterSelect} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          {hasActiveFilters ? (
            <button onClick={clearFilters} style={styles.clearFiltersBtn}>Clear filters</button>
          ) : (
            <span />
          )}
          {filters.projectId !== "all" && (
            <button onClick={() => setModal("add-subtask")} style={styles.createBtn}>+ Add Subtask</button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && <div style={styles.emptyState}>Loading subtasks…</div>}
        {!loading && error && <div style={styles.errorBanner}>{error}</div>}
        {!loading && !error && filteredSubtasks.length === 0 && <div style={styles.emptyState}>📋 No subtasks match these filters.</div>}
        {!loading &&
          !error &&
          pagedSubtasks.map((subtask) => (
            <SubtaskAccordionCard
              key={subtask._id}
              subtask={subtask}
              project={projectsById[idOf(subtask.project)]}
              onEdit={(s) => setModal({ type: "edit-subtask", subtask: s })}
              onRequestDelete={setDeleteConfirm}
              onRequestRate={(s, r) => setModal({ type: "rate", subtask: s, existingRating: r })}
            />
          ))}

        {!loading && !error && filteredSubtasks.length > 0 && totalPages > 1 && (
          <div style={styles.paginator}>
            <span style={styles.paginatorInfo}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSubtasks.length)} of {filteredSubtasks.length}
            </span>
            <div style={styles.paginatorControls}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...styles.pageBtn, ...(page === 1 ? styles.pageBtnDisabled : {}) }}
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...styles.pageBtn, ...(page === totalPages ? styles.pageBtnDisabled : {}) }}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {modal === "add-subtask" && <AddSubtaskModal projectId={filters.projectId} onClose={() => setModal(null)} onCreated={handleSubtaskCreated} />}
      {modal?.type === "edit-subtask" && <EditSubtaskModal subtask={modal.subtask} onClose={() => setModal(null)} onSaved={handleSubtaskSaved} />}
      {modal?.type === "rate" && (
        <RatingModal subtask={modal.subtask} existingRating={modal.existingRating} onClose={() => setModal(null)} onSubmitted={handleRated} />
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
              <button onClick={() => handleDeleteSubtask(deleteConfirm)} style={{ ...styles.submitBtn, background: "#dc2626" }}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  main: { flex: 1, padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" },
  pageTitle: { fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 },
  pageSubtitle: { fontSize: 14, color: "#64748b", margin: "4px 0 0" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 },
  statCard: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "14px 16px" },
  statLabel: { fontSize: 11, fontWeight: 600, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" },
  statValue: { fontSize: 26, fontWeight: 700, margin: "4px 0 0" },
  filterCard: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "16px 18px" },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  filterLabel: { display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" },
  filterSelect: { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#334155", background: "#fff", fontFamily: "inherit", boxSizing: "border-box" },
  clearFiltersBtn: { background: "none", border: "none", color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 0 },
  createBtn: { padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  emptyState: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 40, textAlign: "center", fontSize: 14, color: "#94a3b8" },
  projectChip: { fontSize: 10, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", borderRadius: 20, padding: "2px 8px" },
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
  ratingBanner: { display: "flex", alignItems: "center", gap: 8, padding: "0 16px 14px 36px" },
  ratingComment: { fontSize: 12, color: "#92400e", fontStyle: "italic" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" },
  paginator: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 6, padding: "10px 4px" },
  paginatorInfo: { fontSize: 12.5, color: "#94a3b8" },
  paginatorControls: { display: "flex", alignItems: "center", gap: 4 },
  pageBtn: { minWidth: 30, height: 30, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 7, fontSize: 12.5, color: "#374151", cursor: "pointer", fontFamily: "inherit" },
  pageBtnActive: { background: "#6366f1", borderColor: "#6366f1", color: "#fff", fontWeight: 600 },
  pageBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  pageEllipsis: { padding: "0 4px", fontSize: 12.5, color: "#94a3b8" },
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
};
