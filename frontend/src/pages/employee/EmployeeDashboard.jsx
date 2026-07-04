import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployeeDashboard } from '../../utils/api';
import toast from 'react-hot-toast';

const activityMeta = {
  started:   { bg: '#ede9fe', color: '#6d28d9', icon: '▶', verb: 'Started' },
  completed: { bg: '#dcfce7', color: '#16a34a', icon: '✓', verb: 'Completed' },
  rated:     { bg: '#fef9c3', color: '#b45309', icon: '★', verb: 'Rated by manager —' },
  remark:    { bg: '#dbeafe', color: '#1d4ed8', icon: '✉', verb: 'Manager added remark on' },
};

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getEmployeeDashboard();
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={s.page}>
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: 80 }}>Loading dashboard...</p>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentActivity, upcomingDeadlines, progress } = data;

  const deadlineChip = (d) => {
    if (d.status === 'overdue') return { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' };
    if (d.status === 'soon')    return { label: `${d.daysLeft}d`, bg: '#fef9c3', color: '#b45309' };
    return { label: `${d.daysLeft}d`, bg: '#dbeafe', color: '#1d4ed8' };
  };

  return (
    <div style={s.page}>
      <div style={s.pageHead}>
        <div>
          <h1 style={s.pageTitle}>Dashboard</h1>
          <p style={s.pageSub}>Your work at a glance</p>
        </div>
        <button onClick={handleLogout} style={s.logoutBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>

      {/* Stat cards */}
      <div style={s.statsGrid}>
        {[
          { label: 'Projects assigned', value: stats.totalProjects,     sub: `${stats.activeProjects} active, ${stats.completedProjects} complete`, accent: '#6d28d9' },
          { label: 'Active projects',   value: stats.activeProjects,    sub: 'In progress now',      accent: '#2563eb' },
          { label: 'Completed',         value: stats.completedProjects, sub: 'Fully wrapped up',     accent: '#16a34a' },
          { label: 'Overdue subtasks',  value: stats.overdueSubtasks,   sub: 'Needs your attention', accent: '#dc2626' },
        ].map((c) => (
          <div key={c.label} style={s.statCard}>
            <span style={s.statLabel}>{c.label}</span>
            <span style={{ ...s.statValue, color: c.accent }}>{c.value}</span>
            <span style={s.statSub}>{c.sub}</span>
            <div style={{ ...s.statBar, background: c.accent + '22' }}>
              <div style={{ ...s.statBarFill, background: c.accent, width: `${Math.min((c.value / 5) * 100, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Activity + Deadlines */}
      <div style={s.twoCol}>
        <div style={s.card}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>Recent activity</h3>
            <span style={s.badge}>{recentActivity.length} events</span>
          </div>
          {recentActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No recent activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentActivity.map((item) => {
                const meta = activityMeta[item.type] || activityMeta.remark;
                return (
                  <div key={item._id} style={s.actRow}>
                    <div style={{ ...s.actIcon, background: meta.bg, color: meta.color }}>{meta.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.actText}>
                        {meta.verb}{' '}
                        <strong style={{ color: '#0f172a' }}>{item.subtask}</strong>
                      </div>
                      <div style={s.actMeta}>{item.project} · {item.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={s.card}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>Upcoming deadlines</h3>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No upcoming deadlines</p>
          ) : (
            <>
              <div style={s.tableHead}>
                <span>Subtask</span><span>Project</span><span>Due</span><span>Days left</span>
              </div>
              {upcomingDeadlines.map((d) => {
                const chip = deadlineChip(d);
                return (
                  <div key={d._id} style={s.tableRow}>
                    <span style={s.tableCell}>{d.subtask}</span>
                    <span style={{ ...s.tableCell, color: '#64748b' }}>{d.project}</span>
                    <span style={{ ...s.tableCell, color: '#64748b' }}>{d.due}</span>
                    <span style={{ ...s.chip, background: chip.bg, color: chip.color }}>{chip.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Progress summary */}
      <div style={s.card}>
        <div style={s.cardHead}><h3 style={s.cardTitle}>Progress summary</h3></div>
                {[
          { label: 'Tasks completed', pct: progress.totalTasks > 0 ? (progress.tasksCompleted / progress.totalTasks) * 100 : 0, display: `${progress.tasksCompleted} / ${progress.totalTasks}`, color: '#6d28d9' },
          { label: 'Overall progress', pct: progress.overallPct, display: `${progress.overallPct}%`, color: '#6d28d9' },
          { label: 'Average rating received', pct: progress.avgRating > 0 ? (progress.avgRating / 5) * 100 : 0, display: progress.avgRating > 0 ? `${progress.avgRating} / 5` : '—', color: '#f59e0b' },
        ].map((p) => (
          <div key={p.label} style={s.progRow}>
            <span style={s.progLabel}>{p.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 360 }}>
              <div style={s.progTrack}>
                <div style={{ ...s.progFill, width: `${p.pct}%`, background: p.color }} />
              </div>
              <span style={s.progVal}>{p.display}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  page:       { padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'DM Sans', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  pageHead:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  pageTitle:  { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.4px' },
  pageSub:    { fontSize: 13, color: '#64748b', margin: '3px 0 0 0' },
  logoutBtn:  { display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#dc2626', cursor: 'pointer' },
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  statCard:   { background: '#fff', borderRadius: 12, border: '0.5px solid #e2e8f0', padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 5 },
  statLabel:  { fontSize: 11, color: '#64748b', fontWeight: 500 },
  statValue:  { fontSize: 26, fontWeight: 700, lineHeight: 1 },
  statSub:    { fontSize: 11, color: '#94a3b8' },
  statBar:    { height: 3, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  statBarFill:{ height: '100%', borderRadius: 3 },
  twoCol:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  card:       { background: '#fff', borderRadius: 12, border: '0.5px solid #e2e8f0', padding: '18px 20px' },
  cardHead:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:  { fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0 },
  badge:      { fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 9px', borderRadius: 20 },
  actRow:     { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '0.5px solid #f1f5f9' },
  actIcon:    { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 1 },
  actText:    { fontSize: 13, color: '#334155', lineHeight: 1.5 },
  actMeta:    { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  tableHead:  { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.7fr', gap: 8, padding: '0 0 8px', borderBottom: '0.5px solid #e2e8f0', fontSize: 11, color: '#94a3b8', fontWeight: 600 },
  tableRow:   { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.7fr', gap: 8, padding: '9px 0', borderBottom: '0.5px solid #f1f5f9', alignItems: 'center' },
  tableCell:  { fontSize: 12, color: '#1e293b', fontWeight: 500 },
  chip:       { fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 500, display: 'inline-block', textAlign: 'center' },
  progRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #f1f5f9', gap: 16 },
  progLabel:  { fontSize: 13, color: '#64748b', minWidth: 180 },
  progTrack:  { flex: 1, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progFill:   { height: '100%', borderRadius: 4 },
  progVal:    { fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 50, textAlign: 'right' },
};

