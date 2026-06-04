import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPendingUsers, assignRole } from '../utils/api';

export default function PendingUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [form, setForm] = useState({});

  // Check if logged in user is hr_admin
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'hr_admin') {
      toast.error('Access denied — HR Admin only');
      navigate('/login');
      return;
    }
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const res = await getPendingUsers();
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to fetch pending users');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (userId, field, value) => {
    setForm((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value }
    }));
  };

  const handleAssign = async (userId) => {
    const userForm = form[userId];
    if (!userForm?.role) {
      toast.error('Please select a role first');
      return;
    }

    setAssigning(userId);
    try {
      await assignRole(userId, {
        role: userForm.role,
        department: userForm.department || ''
      });
      toast.success('Role assigned successfully — welcome email sent!');
      fetchPendingUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign role');
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading pending users...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pending Users</h1>
        <p style={styles.subtitle}>
          {users.length} user{users.length !== 1 ? 's' : ''} waiting for role assignment
        </p>
      </div>

      {users.length === 0 ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyIcon}>🎉</p>
          <p style={styles.emptyText}>No pending users — all caught up!</p>
        </div>
      ) : (
        <div style={styles.list}>
          {users.map((user) => (
            <div key={user._id} style={styles.card}>
              <div style={styles.userInfo}>
                <div style={styles.avatar}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={styles.userName}>{user.name}</p>
                  <p style={styles.userEmail}>{user.email}</p>
                  <p style={styles.userDate}>
                    Registered: {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div style={styles.assignRow}>
                <select
                  value={form[user._id]?.role || ''}
                  onChange={(e) => handleFormChange(user._id, 'role', e.target.value)}
                  style={styles.select}
                >
                  <option value="">Select role</option>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr_admin">HR Admin</option>
                </select>

                <input
                  type="text"
                  placeholder="Department (optional)"
                  value={form[user._id]?.department || ''}
                  onChange={(e) => handleFormChange(user._id, 'department', e.target.value)}
                  style={styles.input}
                />

                <button
                  onClick={() => handleAssign(user._id)}
                  disabled={assigning === user._id}
                  style={assigning === user._id
                    ? {...styles.button, opacity: 0.7}
                    : styles.button}
                >
                  {assigning === user._id ? 'Assigning...' : 'Assign Role'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '40px 20px'
  },
  header: {
    maxWidth: '800px',
    margin: '0 auto 32px auto'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 4px 0'
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    margin: 0
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: '100px'
  },
  list: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px'
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#1a73e8',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '600',
    flexShrink: 0
  },
  userName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 2px 0'
  },
  userEmail: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 2px 0'
  },
  userDate: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0
  },
  assignRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  select: {
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff',
    cursor: 'pointer'
  },
  input: {
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    flex: 1,
    minWidth: '150px'
  },
  button: {
    background: '#1a73e8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  emptyCard: {
    maxWidth: '800px',
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '60px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    margin: '0 0 16px 0'
  },
  emptyText: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0
  }
};