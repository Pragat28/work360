import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import API from '../../utils/api';

const PROJECT_STATUS = {
  in_progress: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8', bar: '#6366f1' },
  assigned:    { label: 'Assigned',    bg: '#f8fafc', color: '#475569', bar: '#94a3b8' },
  completed:   { label: 'Completed',   bg: '#f0fdf4', color: '#15803d', bar: '#22c55e' },
  overdue:     { label: 'Overdue',     bg: '#fef2f2', color: '#b91c1c', bar: '#ef4444' },
};

function norm(raw) { return (raw || '').trim().toLowerCase(); }

function isTaskDone(t) {
  return norm(t.status) === 'completed' || t.isCompleted === true;
}

function isLate(t) {
  if (isTaskDone(t)) return false;
  const due = new Date(t.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

function isCompletedLate(t) {
  if (!isTaskDone(t) || !t.completedAt) return false;
  const due = new Date(t.dueDate);
  due.setHours(23, 59, 59, 999);
  return new Date(t.completedAt) > due;
}

function isProjectDone(project, tasks) {
  if (norm(project.status) === 'completed') return true;
  if (tasks.length > 0 && tasks.every(isTaskDone)) return true;
  return false;
}

function getProgress(project, tasks) {
  if (isProjectDone(project, tasks)) return 100;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(isTaskDone).length / tasks.length) * 100);
}

function Stars({ value }) {
  if (!value) return <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Awaiting review</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: 12, color: i <= Math.round(value) ? '#f59e0b' : '#e2e8f0' }}>★</span>
      ))}
      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4, fontWeight: 600 }}>{Number(value).toFixed(1)}</span>
    </span>
  );
}

function fileColor(name) {
  const e = (name || '').split('.').pop().toLowerCase();
  return { pdf:'#ef4444', doc:'#2563eb', docx:'#2563eb', xls:'#16a34a', xlsx:'#16a34a', png:'#7c3aed', jpg:'#7c3aed', jpeg:'#7c3aed', zip:'#d97706' }[e] || '#64748b';
}
function fmtSize(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

function UploadZone({ taskId, files, onFiles, onRemove }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = Array.from(e.dataTransfer.files); if (f.length) onFiles(taskId, f); }}
        style={{
          border: `1.5px dashed ${drag ? '#4f46e5' : '#c7d2fe'}`,
          borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
          background: drag ? '#eef2ff' : '#f5f3ff',
          display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>↑</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#3730a3' }}>Click to upload or drag & drop</div>
          <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>PDF, DOCX, XLSX, images, ZIP — up to 50MB each</div>
        </div>
        <input ref={ref} type="file" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files.length) onFiles(taskId, Array.from(e.target.files)); }} />
      </div>
      {files.map((f, i) => {
        const c = fileColor(f.name);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#fff', borderRadius: 8, border: `1px solid #e2e8f0` }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: c + '15', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>
              {f.name.split('.').pop().toUpperCase().slice(0,4)}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{fmtSize(f.size)}</span>
            <button onClick={() => onRemove(taskId, i)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [openProject, setOpenProject] = useState({});
  const [showComments, setShowComments] = useState({});
  const [showUpload, setShowUpload] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [noteText, setNoteText] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [pRes, tRes] = await Promise.all([
        API.get('/employee/projects'),
        API.get('/employee/subtasks'),
      ]);
      setProjects(pRes.data.projects);
      const grouped = {};
      tRes.data.subtasks.forEach(t => {
        if (!grouped[t.projectId]) grouped[t.projectId] = [];
        grouped[t.projectId].push(t);
      });
      setTasksByProject(grouped);
      const rMap = {};
      const cMap = {};
      await Promise.all(tRes.data.subtasks.map(async t => {
        try { const r = await API.get(`/employee/subtasks/${t._id}/rating`); if (r.data.rating) rMap[t._id] = r.data.rating; } catch {}
        try { const c = await API.get(`/employee/subtasks/${t._id}/comments`); cMap[t._id] = c.data.comments || []; } catch { cMap[t._id] = []; }
      }));
      setRatings(rMap);
      setComments(cMap);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }

  async function handleStart(e, id) {
    e.stopPropagation();
    setActionLoading(id + '_start');
    try {
      await API.patch(`/employee/subtasks/${id}/start`);
      toast.success('Task started');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  }

  async function handleComplete(e, id) {
    e.stopPropagation();
    setActionLoading(id + '_complete');
    try {
      await API.patch(`/employee/subtasks/${id}/complete`);
      toast.success('Marked complete');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  }

  async function handleSubmit(taskId) {
    const files = uploadedFiles[taskId] || [];
    const note = noteText[taskId] || '';
    if (!files.length && !note.trim()) { toast.error('Add a file or note first'); return; }
    setSubmitting(taskId);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      fd.append('note', note);
      await API.post(`/employee/subtasks/${taskId}/submissions`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Work submitted');
      setUploadedFiles(p => ({ ...p, [taskId]: [] }));
      setNoteText(p => ({ ...p, [taskId]: '' }));
      setShowUpload(p => ({ ...p, [taskId]: false }));
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Submit failed'); }
    finally { setSubmitting(null); }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ width: 28, height: 28, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: '32px 36px 64px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ph:hover { background: #fafafa !important; }
        .tr:hover { background: #fafafa !important; }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.3px' }}>My Projects</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{projects.length} project{projects.length !== 1 ? 's' : ''} assigned to you</p>
      </div>

      {projects.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0', padding: '64px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>No projects yet</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Your manager will assign you to a project soon.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => {
            const tasks = tasksByProject[p._id] || [];
            const doneTasks = tasks.filter(isTaskDone).length;
            const lateTasks = tasks.filter(isLate);
            const projectDone = isProjectDone(p, tasks);
            const pct = getProgress(p, tasks);
            const hasOverdue = lateTasks.length > 0 && !projectDone;
            const hasStarted = tasks.some(t => norm(t.status) === 'in_progress' || !!t.startedAt);

            const effectiveStatus = projectDone
              ? 'completed'
              : hasOverdue
                ? 'overdue'
                : hasStarted
                  ? 'in_progress'
                  : norm(p.status) || 'assigned';

            const st = PROJECT_STATUS[effectiveStatus] || PROJECT_STATUS.assigned;
            const isOpen = !!openProject[p._id];

            return (
              <div
                key={p._id}
                style={{
                  borderRadius: 12, background: '#fff',
                  border: `1px solid ${hasOverdue ? '#fecaca' : '#e2e8f0'}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="ph"
                  onClick={() => setOpenProject(prev => ({ ...prev, [p._id]: !prev[p._id] }))}
                  style={{ padding: '18px 22px', cursor: 'pointer', transition: 'background 0.1s', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{p.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {hasOverdue && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                          {lateTasks.length} overdue
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{doneTasks}/{tasks.length} tasks</span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    {p.assignedManagers?.length > 0 && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Manager: {p.assignedManagers.map(m => m.name).join(', ')}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {new Date(p.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(p.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {p.avgRating ? <Stars value={p.avgRating} /> : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: st.bar, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                  </div>
                </div>

                {isOpen && (
                  <div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2fr 72px 1.4fr 80px 130px',
                      padding: '7px 22px', background: '#f8fafc',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 10, fontWeight: 700, color: '#94a3b8',
                      textTransform: 'uppercase', letterSpacing: '0.5px', gap: 8,
                    }}>
                      <span>Task</span><span>Due</span><span>Review</span><span>Comments</span><span>Action</span>
                    </div>

                    {tasks.length === 0 ? (
                      <p style={{ padding: '28px 22px', textAlign: 'center', color: '#94a3b8', fontSize: 13, margin: 0 }}>
                        {projectDone ? 'Project completed.' : 'No tasks assigned yet.'}
                      </p>
                    ) : tasks.map((t, idx) => {
                      const taskDone = isTaskDone(t);
                      const status = norm(t.status);
                      const late = isLate(t);
                      const completedLate = isCompletedLate(t);
                      const rating = ratings[t._id];
                      const taskComments = comments[t._id] || [];
                      const files = uploadedFiles[t._id] || [];
                      const uploadOpen = !!showUpload[t._id];
                      const commentsOpen = !!showComments[t._id];
                      const rowBg = late ? '#fffbf5' : completedLate ? '#fffdf0' : '#fff';
                      const canStart = !taskDone && (status === 'pending' || (status === 'overdue' && !t.startedAt));
                      const canComplete = !taskDone && (status === 'in_progress' || (status === 'overdue' && !!t.startedAt));

                      return (
                        <div key={t._id} style={{ borderBottom: idx < tasks.length - 1 ? '1px solid #f8fafc' : 'none' }}>

                          {late && (
                            <div style={{ padding: '5px 22px', background: '#fff7ed', borderLeft: '3px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Overdue · due {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span style={{ fontSize: 11, color: '#ea580c' }}>Action required</span>
                            </div>
                          )}

                          {completedLate && (
                            <div style={{ padding: '5px 22px', background: '#fefce8', borderLeft: '3px solid #eab308', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Late completion · was due {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <span style={{ fontSize: 11, color: '#ca8a04' }}>
                                Submitted {new Date(t.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          )}

                          <div
                            className="tr"
                            style={{ display: 'grid', gridTemplateColumns: '2fr 72px 1.4fr 80px 130px', padding: '12px 22px', alignItems: 'center', gap: 8, background: rowBg, transition: 'background 0.1s' }}
                          >
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>{t.name}</p>
                              {t.description && <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{t.description}</p>}
                            </div>

                            <span style={{ fontSize: 12, fontWeight: (late || completedLate) ? 600 : 400, color: late ? '#c2410c' : completedLate ? '#a16207' : '#64748b' }}>
                              {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>

                            <div>
                              {rating ? (
                                <>
                                  <Stars value={rating.stars} />
                                  {rating.remark && (
                                    <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>
                                      "{rating.remark.length > 40 ? rating.remark.slice(0, 40) + '…' : rating.remark}"
                                    </p>
                                  )}
                                </>
                              ) : taskDone
                                ? <span style={{ fontSize: 11, color: '#d97706' }}>Awaiting review</span>
                                : <span style={{ color: '#e2e8f0', fontSize: 13 }}>—</span>
                              }
                            </div>

                            <div>
                              {taskComments.length > 0 ? (
                                <button
                                  onClick={() => setShowComments(prev => ({ ...prev, [t._id]: !prev[t._id] }))}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', border: `1px solid ${commentsOpen ? '#c7d2fe' : '#e2e8f0'}`, background: commentsOpen ? '#eef2ff' : '#fff', color: commentsOpen ? '#4338ca' : '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                                >
                                  💬 {taskComments.length}
                                </button>
                              ) : <span style={{ color: '#e2e8f0', fontSize: 13 }}>—</span>}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {canStart && (
                                <button disabled={actionLoading === t._id + '_start'} onClick={e => handleStart(e, t._id)}
                                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {actionLoading === t._id + '_start' ? '···' : 'Start'}
                                </button>
                              )}
                              {canComplete && (
                                <button disabled={actionLoading === t._id + '_complete'} onClick={e => handleComplete(e, t._id)}
                                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {actionLoading === t._id + '_complete' ? '···' : 'Mark done'}
                                </button>
                              )}
                              {taskDone && completedLate && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#a16207', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 14 }}>✓</span> Late
                                </span>
                              )}
                              {taskDone && !completedLate && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 14 }}>✓</span> Done
                                </span>
                              )}
                              <button
                                onClick={() => setShowUpload(prev => ({ ...prev, [t._id]: !prev[t._id] }))}
                                title="Submit work"
                                style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${uploadOpen ? '#4f46e5' : '#e2e8f0'}`, background: uploadOpen ? '#eef2ff' : '#fff', color: uploadOpen ? '#4f46e5' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                              >📎</button>
                            </div>
                          </div>

                          {commentsOpen && taskComments.length > 0 && (
                            <div style={{ margin: '0 22px 12px', border: '1px solid #e0e7ff', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ padding: '8px 14px', background: '#eef2ff', borderBottom: '1px solid #e0e7ff' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Manager Comments</span>
                              </div>
                              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fafbff' }}>
                                {taskComments.map(c => (
                                  <div key={c._id} style={{ display: 'flex', gap: 9 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                      {(c.author?.name || 'M').charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, background: '#fff', border: '1px solid #e0e7ff', borderRadius: 8, padding: '8px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{c.author?.name || 'Manager'}</span>
                                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>
                                          {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: 12.5, color: '#334155', margin: 0, lineHeight: 1.55 }}>{c.text}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {uploadOpen && (
                            <div style={{ margin: '0 22px 14px', border: '1px solid #e0e7ff', borderRadius: 10, padding: '14px', background: '#fafbff' }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 12px' }}>Submit Work</p>
                              <UploadZone
                                taskId={t._id} files={files}
                                onFiles={(id, f) => setUploadedFiles(p => ({ ...p, [id]: [...(p[id] || []), ...f] }))}
                                onRemove={(id, i) => setUploadedFiles(p => { const u = [...(p[id] || [])]; u.splice(i, 1); return { ...p, [id]: u }; })}
                              />
                              <textarea
                                placeholder="Add a note for your manager (optional)..."
                                value={noteText[t._id] || ''}
                                onChange={e => setNoteText(p => ({ ...p, [t._id]: e.target.value }))}
                                style={{ width: '100%', minHeight: 60, borderRadius: 8, border: '1px solid #e0e7ff', padding: '9px 12px', fontSize: 12, fontFamily: "'DM Sans',sans-serif", color: '#1e293b', resize: 'vertical', boxSizing: 'border-box', outline: 'none', background: '#fff', marginTop: 8 }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 7 }}>
                                <button onClick={() => setShowUpload(p => ({ ...p, [t._id]: false }))}
                                  style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  Cancel
                                </button>
                                <button disabled={submitting === t._id} onClick={() => handleSubmit(t._id)}
                                  style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: submitting === t._id ? '#a5b4fc' : '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: submitting === t._id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                  {submitting === t._id ? 'Submitting...' : 'Submit'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
