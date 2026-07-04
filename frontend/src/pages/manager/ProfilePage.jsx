import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../../utils/api';

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
      toast.success('Name updated');
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
      toast.success('Password changed');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setLoadingPassword(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out');
    navigate('/login');
  };

  const roleTokens = {
    hr_admin: { accent: '#7C4DBB', label: 'HR Admin' },
    manager:  { accent: '#1F6FB2', label: 'Manager' },
    employee: { accent: '#1F9D66', label: 'Employee' },
  }[user.role] || { accent: '#5B6472', label: user.role };

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const EyeIcon = ({ show }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    <div className="profile-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

        .profile-page {
          --ink: #12172B;
          --slate: #5B6472;
          --paper: #F6F7FA;
          --panel: #FFFFFF;
          --line: #E3E7EE;
          --brand: #1F4E79;
          --brand-dim: #E9EFF5;
          --gold: #C9A227;
          --danger: #C1443B;
          --danger-dim: #FBEDEC;

          min-height: 100vh;
          background: var(--paper);
          padding: 40px 32px 64px;
          font-family: 'Inter', sans-serif;
          color: var(--ink);
        }
        .profile-page * { box-sizing: border-box; }

        .profile-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--slate);
        }
        .profile-heading {
          font-family: 'Sora', sans-serif;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .profile-shell {
          max-width: 920px;
          margin: 0 auto;
        }

        .profile-header { margin-bottom: 28px; }
        .profile-header h1 { font-size: 24px; margin: 6px 0 4px; }
        .profile-header p { font-size: 13.5px; color: var(--slate); margin: 0; }

        .profile-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 820px) {
          .profile-grid { grid-template-columns: 1fr; }
        }

        /* ── Signature element: the account badge, styled like a ledger stub ── */
        .badge {
          position: sticky;
          top: 32px;
          background: linear-gradient(165deg, var(--ink), #1C2340);
          color: #fff;
          border-radius: 18px;
          padding: 28px 24px 22px;
          clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%);
          box-shadow: 0 12px 30px -14px rgba(18, 23, 43, 0.45);
        }
        @media (max-width: 820px) { .badge { position: static; } }

        .badge-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 18px;
        }

        .badge-avatar {
          width: 56px; height: 56px; border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Sora', sans-serif;
          font-size: 19px; font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .badge-name {
          font-family: 'Sora', sans-serif;
          font-size: 18px; font-weight: 700;
          margin: 0 0 3px;
        }
        .badge-email {
          font-size: 12.5px;
          color: rgba(255,255,255,0.6);
          margin: 0 0 18px;
          word-break: break-word;
        }

        .badge-perforation {
          border-top: 1.5px dashed rgba(255,255,255,0.22);
          margin: 4px 0 16px;
        }

        .badge-footer { display: flex; gap: 20px; }
        .badge-stat-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-bottom: 4px;
        }
        .badge-stat-value {
          font-size: 12.5px; font-weight: 600;
        }
        .badge-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--role-color, #1F9D66); margin-right: 6px;
        }

        /* ── Right column cards ── */
        .stack { display: flex; flex-direction: column; gap: 18px; }
        .card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 22px 24px;
        }
        .card-title {
          font-family: 'Sora', sans-serif;
          font-size: 14.5px; font-weight: 700;
          margin: 0 0 18px;
        }
        .form-col { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 7px; }
        .field-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--slate);
        }
        .field-input-wrap { position: relative; display: flex; align-items: center; }
        .field-input {
          width: 100%;
          padding: 10px 2px;
          border: none;
          border-bottom: 1.5px solid var(--line);
          background: transparent;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .field-input:focus { border-bottom-color: var(--brand); }
        .field-input:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 3px; }
        .field-input.has-icon { padding-right: 30px; }

        .field-toggle {
          position: absolute; right: 2px;
          background: none; border: none; cursor: pointer;
          color: var(--slate); display: flex; padding: 4px;
        }
        .field-toggle:hover { color: var(--ink); }
        .field-toggle:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 6px; }

        .btn {
          align-self: flex-start;
          padding: 10px 22px;
          border-radius: 9px;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.05s ease;
        }
        .btn:active { transform: translateY(1px); }
        .btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
        .btn-primary { background: var(--brand); color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #193F63; }
        .btn-primary:disabled { background: #A9BCCB; cursor: not-allowed; }

        .card-danger { border-color: #F3D3D0; }
        .card-danger .card-title { color: var(--ink); }
        .card-danger p { font-size: 13px; color: var(--slate); margin: 0 0 16px; }
        .btn-danger {
          background: var(--danger-dim);
          color: var(--danger);
          border: 1.5px solid #F0C4C0;
        }
        .btn-danger:hover { background: #F8DEDC; }

        @media (prefers-reduced-motion: reduce) {
          .btn, .field-input { transition: none; }
        }
      `}</style>

      <div className="profile-shell">
        <div className="profile-header">
          <span className="profile-eyebrow">Account</span>
          <h1 className="profile-heading">Settings</h1>
          <p>Manage your identity and security on BFSI Edge</p>
        </div>

        <div className="profile-grid">
          {/* Signature: ledger-style account badge */}
          <div className="badge" style={{ '--role-color': roleTokens.accent }}>
            <div className="badge-eyebrow">Account · Portal ID</div>
            <div className="badge-avatar">{initials}</div>
            <div className="badge-name">{user.name}</div>
            <div className="badge-email">{user.email}</div>

            <div className="badge-perforation" />

            <div className="badge-footer">
              <div>
                <div className="badge-stat-label">Role</div>
                <div className="badge-stat-value">
                  <span className="badge-dot" />{roleTokens.label}
                </div>
              </div>
              <div>
                <div className="badge-stat-label">Status</div>
                <div className="badge-stat-value">Active</div>
              </div>
            </div>
          </div>

          <div className="stack">
            {/* Update name */}
            <div className="card">
              <div className="card-title">Update name</div>
              <form onSubmit={handleNameUpdate} className="form-col">
                <div className="field">
                  <label className="field-label">Full name</label>
                  <div className="field-input-wrap">
                    <input
                      type="text"
                      className="field-input"
                      value={nameForm.name}
                      onChange={e => setNameForm({ name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={loadingName} className="btn btn-primary">
                  {loadingName ? 'Saving…' : 'Save name'}
                </button>
              </form>
            </div>

            {/* Change password */}
            <div className="card">
              <div className="card-title">Change password</div>
              <form onSubmit={handlePasswordUpdate} className="form-col">
                {[
                  { label: 'Current password', key: 'currentPassword', show: showCurrent, toggle: () => setShowCurrent(p => !p) },
                  { label: 'New password',     key: 'newPassword',     show: showNew,     toggle: () => setShowNew(p => !p) },
                  { label: 'Confirm new password', key: 'confirmPassword', show: showConfirm, toggle: () => setShowConfirm(p => !p) },
                ].map(({ label, key, show, toggle }) => (
                  <div key={key} className="field">
                    <label className="field-label">{label}</label>
                    <div className="field-input-wrap">
                      <input
                        type={show ? 'text' : 'password'}
                        className="field-input has-icon"
                        value={passwordForm[key]}
                        onChange={e => setPasswordForm(p => ({ ...p, [key]: e.target.value }))}
                        required
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={toggle} className="field-toggle" aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
                        <EyeIcon show={show} />
                      </button>
                    </div>
                  </div>
                ))}
                <button type="submit" disabled={loadingPassword} className="btn btn-primary">
                  {loadingPassword ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>

            {/* Sign out */}
            <div className="card card-danger">
              <div className="card-title">Sign out</div>
              <p>Signed in as <strong style={{ color: 'var(--ink)' }}>{user.email}</strong></p>
              <button onClick={handleLogout} className="btn btn-danger">
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
