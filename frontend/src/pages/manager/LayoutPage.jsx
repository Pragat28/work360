import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const navItems = [
  { icon: 'home',   label: 'Dashboard',     path: '/manager/dashboard' },
  { icon: 'folder', label: 'Projects',      path: '/manager/projects' },
  { icon: 'clock',  label: 'Timeline',      path: '/manager/timeline' },
  { icon: 'bell',   label: 'Notifications', path: '/manager/notifications' },
  { icon : 'user',  label: 'Profile',       path: '/manager/profile' }
];

const icons = {
  home:   <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  tasks:  <><path d="M9 11l2 2 4-4" /><rect x="3" y="4" width="18" height="16" rx="2" /></>,
  clock:  <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  bell:   <><path d="M6 9a6 6 0 1 1 12 0c0 3 1 4.5 1.5 5.5H4.5C5 13.5 6 12 6 9Z" /><path d="M9.5 18a2.5 2.5 0 0 0 5 0" /></>,
  user :   <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
};

export default function ManagerLayout({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = user || JSON.parse(localStorage.getItem('user')) || {};
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // light poll every 30s
    return () => clearInterval(interval);
  }, [location.pathname]);

  async function fetchUnread() {
    try {
      const res = await fetch(`${API_BASE}/notifications?unreadOnly=true&limit=1`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then((r) => r.json());
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // silent — notifications are non-critical to layout
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoBlock}>
          <div style={styles.logoMark}>
            <span style={styles.logoMarkText}>B</span>
          </div>
          <div>
            <div style={styles.logoName}>BFSI Edge</div>
            <div style={styles.logoTagline}>Manager Platform</div>
          </div>
        </div>

        <div style={styles.divider} />

        <nav style={styles.nav}>
          <p style={styles.navSection}>Main</p>
          {navItems.map((item) => {
            const isNotif = item.path === '/manager/notifications';
            const showDot = isNotif && unreadCount > 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                })}
              >
                <span style={styles.navIconWrap}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {icons[item.icon]}
                  </svg>
                  {showDot && <span style={styles.navDot} />}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {showDot && <span style={styles.navBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.divider} />

          <div style={styles.userChip}>
            <div style={styles.avatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.userName}>{currentUser?.name ?? 'Unknown'}</div>
              <div style={styles.userRole}>Manager</div>
            </div>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log out
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet context={{ refreshUnread: fetchUnread }} />
      </main>
    </div>
  );
}

const styles = {
  page:          { display: 'flex', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#f8fafc' },
  sidebar:       { width: 234, background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)', display: 'flex', flexDirection: 'column', padding: '24px 0 0', position: 'sticky', top: 0, height: '100vh', flexShrink: 0, borderRight: '1px solid #1e293b' },
  logoBlock:     { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px' },
  logoMark:      { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px -2px rgba(99,102,241,0.5)' },
  logoMarkText:  { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-1px' },
  logoName:      { fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2 },
  logoTagline:   { fontSize: 10, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 1 },
  divider:       { height: '1px', background: '#1e293b', margin: '0 16px 16px' },
  nav:           { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', overflowY: 'auto' },
  navSection:    { fontSize: 10, fontWeight: 600, color: '#334155', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '0 10px', margin: '4px 0 6px' },
  navItem:       { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 14, textDecoration: 'none', transition: 'background 0.15s, color 0.15s' },
  navItemActive: { background: '#1e293b', color: '#fff' },
  navIconWrap:   { position: 'relative', width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  navDot:        { position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #0f172a' },
  navBadge:      { fontSize: 10, fontWeight: 700, color: '#fff', background: '#ef4444', borderRadius: 20, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  sidebarFooter: { padding: '0 0 16px' },
  userChip:      { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' },
  avatar:        { width: 34, height: 34, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userName:      { fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole:      { fontSize: 11, color: '#64748b', marginTop: 1 },
  logoutBtn:     { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 12px 0', padding: '9px 12px', width: 'calc(100% - 24px)', background: '#1e293b', border: 'none', borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  main:          { flex: 1, overflowY: 'auto', minWidth: 0 },
};
