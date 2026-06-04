import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../utils/api';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleNameUpdate = async (e) => {
    e.preventDefault();
    setLoadingName(true);
    try {
      await API.patch('/auth/update-profile', { name: nameForm.name });
      const updatedUser = { ...user, name: nameForm.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Name updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name');
    } finally {
      setLoadingName(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoadingPassword(true);
    try {
      await API.patch('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const roleBadgeColor = (role) => {
    if (role === 'hr_admin') return { bg: '#f3e8ff', color: '#7c3aed' };
    if (role === 'manager') return { bg: '#e0f2fe', color: '#0369a1' };
    return { bg: '#dcfce7', color: '#16a34a' };
  };

  const roleColors = roleBadgeColor(user.role);

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <h1 style={styles.pageTitle}>Profile Settings</h1>

        {/* Profile Info Card */}
        <div style={styles.card}>
          <div style={styles.profileRow}>
            <div style={{...styles.bigAvatar, background: roleColors.color}}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={styles.userName}>{user.name}</h2>
              <p style={styles.userEmail}>{user.email}</p>
              <span style={{
                ...styles.roleBadge,
                background: roleColors.bg,
                color: roleColors.color
              }}>
                {user.role.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Update Name */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Update Name</h3>
          <form onSubmit={handleNameUpdate} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Full name</label>
              <input
                type="text"
                value={nameForm.name}
                onChange={(e) => setNameForm({ name: e.target.value })}
                required
                style={styles.input}
              />
            </div>
            <button
              type="submit"
              disabled={loadingName}
              style={loadingName ? {...styles.button, opacity: 0.7} : styles.button}
            >
              {loadingName ? 'Saving...' : 'Save name'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Change Password</h3>
          <form onSubmit={handlePasswordUpdate} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Current password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({
                  ...passwordForm, currentPassword: e.target.value
                })}
                required
                style={styles.input}
                placeholder="••••••••"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>New password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({
                  ...passwordForm, newPassword: e.target.value
                })}
                required
                style={styles.input}
                placeholder="Min 8 characters with a number"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm new password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({
                  ...passwordForm, confirmPassword: e.target.value
                })}
                required
                style={styles.input}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loadingPassword}
              style={loadingPassword ? {...styles.button, opacity: 0.7} : styles.button}
            >
              {loadingPassword ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Session</h3>
          <p style={styles.logoutText}>
            You are currently logged in as <strong>{user.email}</strong>
          </p>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '40px 20px'
  },
  wrapper: {
    maxWidth: '600px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '28px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  bigAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    fontWeight: '700',
    flexShrink: 0
  },
  userName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 4px 0'
  },
  userEmail: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 8px 0'
  },
  roleBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 20px 0'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff'
  },
  button: {
    background: '#1a73e8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  logoutText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0'
  },
  logoutBtn: {
    background: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};