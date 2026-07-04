import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../utils/api';
import toast from 'react-hot-toast';

const tagMeta = {
  project_assigned:   { tag: 'Project',  tagBg: '#ede9fe', tagColor: '#6d28d9' },
  subtask_assigned:   { tag: 'Task',     tagBg: '#ede9fe', tagColor: '#6d28d9' },
  subtask_reminder:   { tag: 'Reminder', tagBg: '#fef9c3', tagColor: '#92400e' },
  comment_posted:     { tag: 'Remark',   tagBg: '#dbeafe', tagColor: '#1e40af' },
  rating_submitted:   { tag: 'Rating',   tagBg: '#fef9c3', tagColor: '#92400e' },
  subtask_overdue:    { tag: 'Alert',    tagBg: '#fee2e2', tagColor: '#b91c1c' },
  subtask_completed:  { tag: 'Update',   tagBg: '#dcfce7', tagColor: '#166534' },
  project_completed:  { tag: 'Project',  tagBg: '#dcfce7', tagColor: '#166534' },
  role_assigned:      { tag: 'Account',  tagBg: '#f1f5f9', tagColor: '#475569' },
  role_changed:       { tag: 'Account',  tagBg: '#f1f5f9', tagColor: '#475569' },
};

function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Fallback logic to grab the project name context from strings if backend mapping is absent
function extractProjectName(n) {
  if (n.project?.title) return n.project.title;
  
  const msg = n.message || '';
  const match = msg.match(/in project "([^"]+)"/i);
  if (match && match[1]) return match[1];

  // Try matching common shorthand words near start of fields if structured fields are missing
  if (n.subtask?.name) return 'General Tasks';
  return 'General Updates';
}

function groupByProject(notificationsList) {
  const map = {};
  notificationsList.forEach((n) => {
    const key = extractProjectName(n);
    if (!map[key]) {
      map[key] = { projectTitle: key, list: [] };
    }
    map[key].list.push(n);
  });
  return Object.values(map);
}

export default function EmployeeNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openProjects, setOpenProjects] = useState({}); // Tracking dropdown visibility state per project

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications || []);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  }

  async function markOneRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      toast.error('Failed to update notification');
    }
  }

  function toggleProjectDropdown(projectTitle) {
    setOpenProjects((prev) => ({ ...prev, [projectTitle]: !prev[projectTitle] }));
  }

  if (loading) {
    return (
      <div style={s.page}>
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: 80 }}>Loading notifications...</p>
      </div>
    );
  }

  const groupedNotifications = groupByProject(notifications);

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={s.pageTitle}>Notifications</h1>
          <p style={s.pageSub}>
            {unreadCount > 0 ? `${unreadCount} unread items pending` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button style={s.markAllBtn} onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {groupedNotifications.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🔔</p>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>No notifications yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groupedNotifications.map((group) => {
            const isOpen = !!openProjects[group.projectTitle];
            const groupUnreadCount = group.list.filter(n => !n.isRead).length;

            return (
              <div key={group.projectTitle} style={s.projectBlock}>
                {/* Project Outer Bar Header Row */}
                <div style={s.projectHeader} onClick={() => toggleProjectDropdown(group.projectTitle)}>
                  <div style={s.projectLeft}>
                    <span style={{ ...s.chevron, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span style={s.projectIcon}>📁</span>
                    <span style={s.projectName}>{group.projectTitle}</span>
                    {groupUnreadCount > 0 && (
                      <span style={s.unreadBadge}>{groupUnreadCount} new</span>
                    )}
                  </div>
                  <div style={s.toggleLabel}>
                    {isOpen ? 'Hide Logs ▲' : 'View Reviews & Tasks ▼'}
                  </div>
                </div>

                {/* Dropdown Container Content containing project logs */}
                {isOpen && (
                  <div style={s.dropdownContent}>
                    {group.list.map((n, i) => {
                      const meta = tagMeta[n.eventType] || { tag: 'Update', tagBg: '#f1f5f9', tagColor: '#475569' };
                      return (
                        <div
                          key={n._id}
                          style={{
                            ...s.notifItem,
                            borderBottom: i < group.list.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: !n.isRead ? '#fafaf9' : 'transparent',
                          }}
                          onClick={() => !n.isRead && markOneRead(n._id)}
                        >
                          <div
                            style={{
                              ...s.dot,
                              background: !n.isRead ? '#6d28d9' : 'transparent',
                              border: !n.isRead ? 'none' : '0.5px solid #cbd5e1',
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ ...s.notifTitle, fontWeight: !n.isRead ? 700 : 500 }}>
                                {n.subtask?.name || 'Review Update'}
                              </span>
                              <span style={{ ...s.tag, background: meta.tagBg, color: meta.tagColor }}>{meta.tag}</span>
                            </div>
                            <p style={s.notifBody}>{n.message}</p>
                            <span style={s.notifTime}>{timeAgo(n.createdAt)}</span>
                          </div>
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

const s = {
  page:           { padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'DM Sans', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  pageTitle:      { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.4px' },
  pageSub:        { fontSize: 13, color: '#64748b', margin: '3px 0 0' },
  markAllBtn:     { fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '0.5px solid #e2e8f0', background: '#fff', color: '#0f172a', cursor: 'pointer', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  
  projectBlock:   { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' },
  projectHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', background: '#ffffff', transition: 'background 0.2s', userSelect: 'none' },
  projectLeft:    { display: 'flex', alignItems: 'center', gap: 12 },
  projectIcon:    { fontSize: 15 },
  projectName:    { fontSize: 14, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.3px' },
  chevron:        { fontSize: 9, color: '#94a3b8', transition: 'transform 0.15s', display: 'inline-block' },
  unreadBadge:    { background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  toggleLabel:    { fontSize: 12, color: '#6d28d9', fontWeight: 600 },
  
  dropdownContent:{ borderTop: '1px solid #f1f5f9', background: '#fafafa' },
  notifItem:      { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', cursor: 'pointer', transition: 'background 0.1s' },
  dot:            { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6 },
  notifTitle:     { fontSize: 13, color: '#0f172a', margin: 0 },
  tag:            { fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' },
  notifBody:      { fontSize: 13, color: '#475569', margin: '0 0 4px', lineHeight: 1.5 },
  notifTime:      { fontSize: 11, color: '#94a3b8' },
  emptyBox:       { background: '#fff', borderRadius: 12, border: '0.5px solid #e2e8f0', padding: '60px', textAlign: 'center' },
};
