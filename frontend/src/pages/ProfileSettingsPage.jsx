import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!user) { navigate('/login'); return null; }

  // employees hit /api/employee/profile/...
  // hr_admin and manager hit /api/profile/...
  const profileBase = user.role === 'employee' ? '/employee/profile' : '/profile';

  const handleNameUpdate = async (e) => {
    e.preventDefault();
    setLoadingName(true);
    try {
      await API.patch(`${profileBase}/update`, { name: nameForm.name });
      const updatedUser = { ...user, name: nameForm.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Name updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally { setLoadingName(false); }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match'); return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setLoadingPassword(true);
    try {
      await API.patch(`${profileBase}/change-password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Password changed!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setLoadingPassword(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out');
    navigate('/login');
  };

  const roleColor = {
    hr_admin: { bg: '#f3e8ff', color: '#7c3aed', label: 'HR Admin' },
    manager:  { bg: '#e0f2fe', color: '#0369a1', label: 'Manager' },
    employee: { bg: '#dcfce7', color: '#16a34a', label: 'Employee' },
  }[user.role] || { bg: '#f1f5f9', color: '#475569', label: user.role };

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const EyeIcon = ({ show }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {show ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </>
      )}
    </svg>
  );

  return (
    <div style={{ padding: '32px 36px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.4px' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Manage your account details and security</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>

        {/* Profile card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: `linear-gradient(135deg, ${roleColor.color}, ${roleColor.color}cc)`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, flexShrink: 0, letterSpacing: '-0.5px'
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{user.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{user.email}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: roleColor.bg, color: roleColor.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {roleColor.label}
              </span>
            </div>
          </div>
        </div>

        {/* Update name */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 18 }}>Update name</div>
          <form onSubmit={handleNameUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Full name</label>
              <input
                type="text"
                value={nameForm.name}
                onChange={e => setNameForm({ name: e.target.value })}
                required
                style={{ padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
            <button
              type="submit"
              disabled={loadingName}
              style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 10, border: 'none', background: loadingName ? '#a5b4fc' : '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loadingName ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              {loadingName ? 'Saving...' : 'Save name'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 18 }}>Change password</div>
          <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Current password',     key: 'currentPassword', show: showCurrent, toggle: () => setShowCurrent(p => !p) },
              { label: 'New password',          key: 'newPassword',     show: showNew,     toggle: () => setShowNew(p => !p) },
              { label: 'Confirm new password',  key: 'confirmPassword', show: showConfirm, toggle: () => setShowConfirm(p => !p) },
            ].map(({ label, key, show, toggle }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={show ? 'text' : 'password'}
                    value={passwordForm[key]}
                    onChange={e => setPasswordForm(p => ({ ...p, [key]: e.target.value }))}
                    required
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '10px 40px 10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <button type="button" onClick={toggle} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                    <EyeIcon show={show} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={loadingPassword}
              style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 10, border: 'none', background: loadingPassword ? '#a5b4fc' : '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loadingPassword ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              {loadingPassword ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #fee2e2', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sign out</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
            Signed in as <strong style={{ color: '#0f172a' }}>{user.email}</strong>
          </p>
          <button
            onClick={handleLogout}
            style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Log out
          </button>
        </div>

      </div>
    </div>
  );
}
