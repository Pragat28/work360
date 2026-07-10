import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import API from '../../utils/api';

const PROJECT_STATUS = {
  in_progress: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8', bar: '#6366f1' },
  assigned:    { label: 'Assigned',    bg: '#f8fafc', color: '#475569', bar: '#94a3b8' },
  completed:   { label: 'Completed',   bg: '#f0fdf4', color: '#15803d', bar: '#22c55e' },
  overdue:     { label: 'Overdue',     bg: '#fef2f2', color: '#b91c1c', bar: '#ef4444' },
};

const STATUS_FILTERS = [
  { value: 'all',         label: 'All Statuses'  },
  { value: 'assigned',    label: 'Assigned'      },
  { value: 'in_progress', label: 'In Progress'   },
  { value: 'overdue',     label: 'Overdue'       },
  { value: 'completed',   label: 'Completed'     },
];

function norm(raw) { return (raw || '').trim().toLowerCase(); }
function isTaskDone(t) { return norm(t.status) === 'completed' || t.isCompleted === true; }
function isLate(t) {
  if (isTaskDone(t)) return false;
  const due = new Date(t.dueDate); due.setHours(23,59,59,999);
  return due < new Date();
}
function isCompletedLate(t) {
  if (!isTaskDone(t) || !t.completedAt) return false;
  const due = new Date(t.dueDate); due.setHours(23,59,59,999);
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
function getTaskBucket(t) {
  if (isTaskDone(t)) return 'completed';
  if (isLate(t)) return 'overdue';
  if (t.startedAt || norm(t.status) === 'in_progress') return 'in_progress';
  return 'not_started';
}
function getProjectMeta(project, tasks) {
  const doneTasks   = tasks.filter(isTaskDone).length;
  const lateTasks   = tasks.filter(isLate);
  const projectDone = isProjectDone(project, tasks);
  const pct         = getProgress(project, tasks);
  const hasOverdue  = lateTasks.length > 0 && !projectDone;
  const hasStarted  = tasks.some(t => norm(t.status) === 'in_progress' || !!t.startedAt);
  const hasNotStarted = tasks.some(t => getTaskBucket(t) === 'not_started');
  const effectiveStatus = projectDone ? 'completed' : hasOverdue ? 'overdue' : hasStarted ? 'in_progress' : norm(project.status) || 'assigned';
  return { doneTasks, lateTasks, projectDone, pct, hasOverdue, hasStarted, hasNotStarted, effectiveStatus };
}

// ── Status filter is evaluated against the project's SUBTASKS, not an
//    aggregated project-level status. A project matches a given status filter
//    if ANY of its subtasks falls into that bucket. ──
function matchesStatusFilter(filter, tasks) {
  if (filter === 'all') return true;
  if (filter === 'assigned') return tasks.some(t => norm(t.status) === 'assigned');
  return tasks.some(t => getTaskBucket(t) === filter);
}

// ── Due-date filter, evaluated per subtask: a project matches if it has ANY
//    subtask that is either (a) overdue — always shown, regardless of the
//    selected date, since it's already late — or (b) still pending/in-progress
//    with a due date on or before the selected date (i.e. expected to be
//    completed by then). Completed subtasks are excluded since they're no
//    longer part of the upcoming workload this filter is meant to surface.
function matchesDueDateFilter(filterDueDate, tasks) {
  if (!filterDueDate) return true;
  return tasks.some(t => {
    if (isTaskDone(t)) return false;
    if (isLate(t)) return true;
    const due = new Date(t.dueDate); due.setHours(23, 59, 59, 999);
    return due <= new Date(filterDueDate + 'T23:59:59');
  });
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
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
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

// ─── Custom calendar date picker (dropdown month-grid, not the native input) ──
function CalendarDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value + 'T00:00:00') : new Date()));
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (value) setViewDate(new Date(value + 'T00:00:00'));
  }, [value]);

  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday   = new Date(year, month, 1).getDay();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ day: d, current: false, dateObj: new Date(year, month - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, dateObj: new Date(year, month, d) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, current: false, dateObj: new Date(year, month + 1, nextDay) });
    nextDay++;
  }

  const todayISO    = toISO(new Date());
  const selectedISO = value || null;

  function pick(dateObj) {
    onChange(toISO(dateObj));
    setOpen(false);
  }

  const monthLabel   = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const displayLabel = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Select date';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', borderRadius: 8, border: `1px solid ${open ? '#a5b4fc' : '#e2e8f0'}`,
          background: '#fff', fontSize: 13, fontFamily: 'inherit', color: value ? '#0f172a' : '#94a3b8',
          cursor: 'pointer', boxSizing: 'border-box',
        }}
      >
        <span>{displayLabel}</span>
        <span style={{ fontSize: 13 }}>📅</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: '100%', left: 0, marginTop: 6,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 12px 28px rgba(15,23,42,0.14)', padding: 12, width: 236,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', padding: '2px 6px', fontFamily: 'inherit' }}>‹</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{monthLabel}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', padding: '2px 6px', fontFamily: 'inherit' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textAlign: 'center', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((c, i) => {
              const iso = toISO(c.dateObj);
              const isSelected = selectedISO === iso;
              const isToday = todayISO === iso;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(c.dateObj)}
                  style={{
                    width: '100%', aspectRatio: '1', border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'inherit',
                    background: isSelected ? '#6366f1' : 'transparent',
                    color: isSelected ? '#fff' : c.current ? '#0f172a' : '#cbd5e1',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    boxShadow: isToday && !isSelected ? 'inset 0 0 0 1px #c7d2fe' : 'none',
                  }}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontFamily: 'inherit' }}>
              Clear
            </button>
            <button type="button" onClick={() => pick(new Date())}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6366f1', fontWeight: 600, fontFamily: 'inherit' }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vertical filter sidebar ─────────────────────────────────────────────────
function FilterSidebar({ visible, filterStatus, setFilterStatus, filterDueDate, setFilterDueDate, onClear, hasActive, matchCount, totalCount }) {
  if (!visible) return null;

  const label = txt => (
    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
      {txt}
    </span>
  );

  const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: 13,
    fontFamily: 'inherit', color: '#0f172a',
    background: '#fff', boxSizing: 'border-box',
    cursor: 'pointer', outline: 'none',
    appearance: 'auto',
  };

  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 14, padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 22,
      alignSelf: 'flex-start', position: 'sticky', top: 24,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>🔽 Filters for Tasks</span>
        {hasActive && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#6366f1', padding: 0 }}>
            Clear all
          </button>
        )}
      </div>

      {/* Match count pill */}
      {hasActive && (
        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', border: '1px solid #bfdbfe' }}>
          <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
            {matchCount} of {totalCount} match
          </span>
        </div>
      )}

      {/* Status — dropdown (now filters by subtask status, not project status) */}
      <div>
        {label('Status (by task)')}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Due date — custom calendar dropdown */}
      <div>
        {label('Tasks Due Before')}
        <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>
          
        </span>
        <CalendarDatePicker value={filterDueDate} onChange={setFilterDueDate} />
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [projects, setProjects]           = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [ratings, setRatings]             = useState({});
  const [comments, setComments]           = useState({});
  const [loading, setLoading]             = useState(true);
  const [openProject, setOpenProject]     = useState({});
  const [showComments, setShowComments]   = useState({});
  const [showUpload, setShowUpload]       = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [noteText, setNoteText]           = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [submitting, setSubmitting]       = useState(null);
  const [showFilters, setShowFilters]     = useState(true);

  const [filterStatus,     setFilterStatus]     = useState('all');
  const [filterDueDate,    setFilterDueDate]     = useState('');

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
      const rMap = {}, cMap = {};
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
    try { await API.patch(`/employee/subtasks/${id}/start`); toast.success('Task started'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  }

  async function handleComplete(e, id) {
    e.stopPropagation();
    setActionLoading(id + '_complete');
    try { await API.patch(`/employee/subtasks/${id}/complete`); toast.success('Marked complete'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  }

  async function handleSubmit(taskId) {
    const files = uploadedFiles[taskId] || [];
    const note  = noteText[taskId] || '';
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

  const hasActiveFilters = filterStatus !== 'all' || !!filterDueDate;

  const sortedProjects = useMemo(() => {
    const withMeta = projects.map((p, idx) => {
      const tasks = tasksByProject[p._id] || [];
      const meta  = getProjectMeta(p, tasks);

      // ── Status now matches on the project's SUBTASKS, not the aggregated
      // project-level status. ──
      let matches = matchesStatusFilter(filterStatus, tasks);

      // ── Due-date filter: project matches if it has a pending/in-progress
      // subtask due on or before the selected date, or any overdue subtask. ──
      if (matches) matches = matchesDueDateFilter(filterDueDate, tasks);

      return { p, idx, meta, matches };
    });

    if (!hasActiveFilters) return withMeta;
    return withMeta.slice().sort((a, b) => {
      if (a.matches === b.matches) return a.idx - b.idx;
      return a.matches ? -1 : 1;
    });
  }, [projects, tasksByProject, filterStatus, filterDueDate, hasActiveFilters]);

  const matchCount  = hasActiveFilters ? sortedProjects.filter(x => x.matches).length : projects.length;
  const activeCount = [filterStatus !== 'all', !!filterDueDate].filter(Boolean).length;

  const handleClear = () => {
    setFilterStatus('all');
    setFilterDueDate('');
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ width: 28, height: 28, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: '28px 28px 64px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ph:hover { background: #fafafa !important; }
        .tr:hover { background: #fafafa !important; }
      `}</style>

      {/* ── Top bar: title + subtitle + filter toggle — all left aligned ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 2px', letterSpacing: '-0.3px' }}>My Projects</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{projects.length} project{projects.length !== 1 ? 's' : ''} assigned to you</p>
        </div>

        {/* Toggle lives right next to the title */}
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${showFilters ? '#a5b4fc' : '#e2e8f0'}`,
            background: showFilters ? '#eef2ff' : '#fff',
            color: showFilters ? '#4338ca' : '#64748b',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            transition: 'all 0.15s', marginTop: 2,
          }}
        >
          <span style={{ fontSize: 13 }}>⚙</span>
          Filters
          {activeCount > 0 && (
            <span style={{ background: '#6366f1', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Body: sidebar + list side by side ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        <FilterSidebar
          visible={showFilters}
          filterStatus={filterStatus}           setFilterStatus={setFilterStatus}
          filterDueDate={filterDueDate}         setFilterDueDate={setFilterDueDate}
          onClear={handleClear}
          hasActive={hasActiveFilters}
          matchCount={matchCount}
          totalCount={projects.length}
        />

        {/* ── Project cards ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0', padding: '64px 40px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>No projects yet</p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Your manager will assign you to a project soon.</p>
            </div>
          ) : sortedProjects.map(({ p, meta, matches }) => {
            const tasks = tasksByProject[p._id] || [];
            const { doneTasks, lateTasks, projectDone, pct, hasOverdue, effectiveStatus } = meta;
            const st     = PROJECT_STATUS[effectiveStatus] || PROJECT_STATUS.assigned;
            const isOpen = !!openProject[p._id];
            const dimmed = hasActiveFilters && !matches;

            return (
              <div
                key={p._id}
                style={{
                  borderRadius: 12, background: '#fff',
                  border: `1px solid ${hasOverdue ? '#fecaca' : '#e2e8f0'}`,
                  overflow: 'hidden',
                  opacity: dimmed ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div
                  className="ph"
                  onClick={() => setOpenProject(prev => ({ ...prev, [p._id]: !prev[p._id] }))}
                  style={{ padding: '18px 22px', cursor: 'pointer', transition: 'background 0.1s', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{p.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                      {hasOverdue && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                          {lateTasks.length} overdue
                        </span>
                      )}
                      {hasActiveFilters && matches && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fffbeb', color: '#b45309' }}>✓ Matches</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{doneTasks}/{tasks.length} tasks</span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.assignedManagers?.length > 0 && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Manager: {p.assignedManagers.map(m => m.name).join(', ')}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      📅 {new Date(p.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(p.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                      padding: '7px 22px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
                      fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', gap: 8,
                    }}>
                      <span>Task</span><span>Due</span><span>Review</span><span>Comments</span><span>Action</span>
                    </div>

                    {tasks.length === 0 ? (
                      <p style={{ padding: '28px 22px', textAlign: 'center', color: '#94a3b8', fontSize: 13, margin: 0 }}>
                        {projectDone ? 'Project completed.' : 'No tasks assigned yet.'}
                      </p>
                    ) : tasks.map((t, idx) => {
                      const taskDone      = isTaskDone(t);
                      const status        = norm(t.status);
                      const late          = isLate(t);
                      const completedLate = isCompletedLate(t);
                      const rating        = ratings[t._id];
                      const taskComments  = comments[t._id] || [];
                      const files         = uploadedFiles[t._id] || [];
                      const uploadOpen    = !!showUpload[t._id];
                      const commentsOpen  = !!showComments[t._id];
                      const rowBg         = late ? '#fffbf5' : completedLate ? '#fffdf0' : '#fff';
                      const canStart      = !taskDone && (status === 'pending' || (status === 'overdue' && !t.startedAt));
                      const canComplete   = !taskDone && (status === 'in_progress' || (status === 'overdue' && !!t.startedAt));

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

                          <div className="tr" style={{ display: 'grid', gridTemplateColumns: '2fr 72px 1.4fr 80px 130px', padding: '12px 22px', alignItems: 'center', gap: 8, background: rowBg, transition: 'background 0.1s' }}>
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
      </div>
    </div>
  );
}
