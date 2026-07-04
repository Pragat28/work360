import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import API from '../../utils/api';

// Matches actual backend `type` values from timeline API
const EVENT_CONFIG = {
  started:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '▶', label: 'Started' },
  completed:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓', label: 'Completed' },
  submitted:  { color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: '↑', label: 'Submitted' },
  overdue:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '!', label: 'Overdue' },
  rated:      { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '★', label: 'Rated' },
  comment:    { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: '💬', label: 'Comment' },
  assigned:   { color: '#6d28d9', bg: '#faf5ff', border: '#ddd6fe', icon: '📋', label: 'Assigned' },
  created:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: '+',  label: 'Created' },
  edited:     { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', icon: '✎',  label: 'Edited' },
  deleted:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '✕',  label: 'Deleted' },
  fallback:   { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: '·',  label: 'Activity' },
};

// Backend already sends clean titles — just return as-is
function friendlyDescription(type, title) {
  return (title || '').trim() || 'Activity';
}

// Match actual backend type values
const FILTER_KEYS = ['started', 'completed', 'submitted', 'overdue', 'rated', 'comment', 'assigned'];

function cfg(type) { return EVENT_CONFIG[type] || EVENT_CONFIG.fallback; }

function formatDate(str) {
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return str; }
}

export default function EmployeeTimeline() {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchTimeline(); }, []);

  async function fetchTimeline() {
    try {
      const res = await API.get('/employee/timeline');
      // Backend returns { timeline: [{ date, events: [{id, type, title, sub}] }] }
      setTimelineData(res.data.timeline || []);
    } catch {
      toast.error('Failed to load timeline');
    } finally { setLoading(false); }
  }

  const filtered = filter === 'all'
    ? timelineData
    : timelineData
        .map(day => ({ ...day, events: day.events.filter(ev => ev.type === filter) }))
        .filter(day => day.events.length > 0);

  const totalEvents = timelineData.reduce((n, d) => n + d.events.length, 0);

  return (
    <div style={{ padding: '32px 36px 64px', fontFamily: "'DM Sans', -apple-system, sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .tl-row:hover { background: #fff !important; }
        .tl-row:hover .tl-title { color: #4f46e5 !important; }
        .tl-filter:hover { border-color: #cbd5e1 !important; }
      `}</style>

     {/* Header */}
<div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
  <div>
    <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.3px' }}>Timeline</h1>
    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
      {loading ? 'Loading...' : `${totalEvents} events across ${timelineData.length} days`}
    </p>
  </div>
  <button
    onClick={async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/employee/timeline/report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BFSI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Failed to generate report');
      }
    }}
    style={{
      padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
      background: '#fff', color: '#0f172a', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
      flexShrink: 0,
    }}
  >
    ↓ Download Report
  </button>
</div>

      {/* Filters */}
      {!loading && totalEvents > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          <button className="tl-filter" onClick={() => setFilter('all')} style={{ padding: '5px 14px', borderRadius: 8, fontFamily: 'inherit', border: `1px solid ${filter === 'all' ? '#0f172a' : '#e2e8f0'}`, background: filter === 'all' ? '#0f172a' : 'transparent', color: filter === 'all' ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            All
          </button>
          {FILTER_KEYS.map(key => {
            const c = cfg(key);
            const active = filter === key;
            return (
              <button key={key} className="tl-filter" onClick={() => setFilter(active ? 'all' : key)} style={{ padding: '5px 14px', borderRadius: 8, fontFamily: 'inherit', border: `1px solid ${active ? c.border : '#e2e8f0'}`, background: active ? c.bg : 'transparent', color: active ? c.color : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#94a3b8', fontSize: 13, paddingTop: 48 }}>
          <div style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Loading...
        </div>

      ) : filtered.length === 0 ? (
        <div style={{ paddingTop: 80, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
            {filter === 'all' ? 'No activity yet' : `No "${cfg(filter).label}" events`}
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>
            {filter === 'all' ? 'Start a task or submit work to see it here.' : 'Try a different filter.'}
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear filter
            </button>
          )}
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {filtered.map((day) => (
            <div key={day.date} style={{ marginBottom: 28 }}>

              {/* Date row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px', flexShrink: 0 }}>
                  {formatDate(day.date)}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500, flexShrink: 0 }}>
                  {day.events.length} event{day.events.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {day.events.map((ev, ei) => {
                  const type = ev.type || ev.eventType;
                  const c = cfg(type);
                  const message = friendlyDescription(ev.type, ev.title || ev.description);

                  return (
                    <div key={ev._id || ev.id || ei} className="tl-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, cursor: 'default', transition: 'background 0.1s' }}>

                      {/* Icon */}
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: c.color, fontWeight: 700 }}>
                        {c.icon}
                      </div>

                      {/* Message */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="tl-title" style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.1s' }}>
                          {message}
                        </p>
                        {ev.sub && (
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.sub}
                          </p>
                        )}
                      </div>

                      {/* Badge */}
                      <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, padding: '3px 9px', borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                        {c.label}
                      </span>

                      {/* Time */}
                      {ev.time && (
                        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500, flexShrink: 0, minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {ev.time}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

