import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAllUsers, deleteUser, changeRole } from '../utils/api';

export default function PeopleManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'hr_admin') {
      toast.error('Access denied — HR Admin only');
      navigate('/login');
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getAllUsers();
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}?`)) return;
    setDeletingId(userId);
    try {
      await deleteUser(userId);
      toast.success(`${userName} deleted successfully`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRoleChange = async (userId) => {
    try {
      await changeRole(userId, {
        role: editForm.role,
        department: editForm.department || ''
      });
      toast.success('Role updated successfully — user notified by email!');
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const roleBadgeColor = (role) => {
    if (role === 'hr_admin') return '#7c3aed';
    if (role === 'manager') return '#0891b2';
    if (role === 'employee') return '#16a34a';
    return '#9ca3af';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading users...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>People Management</h1>
        <p style={styles.subtitle}>{users.length} total users in the system</p>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Department</th>
              <th style={styles.th}>Verified</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.userCell}>
                    <div style={{
                      ...styles.avatar,
                      background: roleBadgeColor(user.role)
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={styles.userName}>{user.name}</span>
                  </div>
                </td>
                <td style={styles.td}>{user.email}</td>
                <td style={styles.td}>
                  {editingId === user._id ? (
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                      style={styles.select}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr_admin">HR Admin</option>
                    </select>
                  ) : (
                    <span style={{
                      ...styles.badge,
                      background: roleBadgeColor(user.role) + '20',
                      color: roleBadgeColor(user.role)
                    }}>
                      {user.role}
                    </span>
                  )}
                </td>
                <td style={styles.td}>
                  {editingId === user._id ? (
                    <input
                      value={editForm.department}
                      onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                      style={styles.input}
                      placeholder="Department"
                    />
                  ) : (
                    user.department || '—'
                  )}
                </td>
                <td style={styles.td}>
                  <span style={user.isVerified ? styles.verified : styles.unverified}>
                    {user.isVerified ? '✅ Yes' : '❌ No'}
                  </span>
                </td>
                <td style={styles.td}>
                  {editingId === user._id ? (
                    <div style={styles.actionRow}>
                      <button
                        onClick={() => handleRoleChange(user._id)}
                        style={styles.saveBtn}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={styles.cancelBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={styles.actionRow}>
                      <button
                        onClick={() => {
                          setEditingId(user._id);
                          setEditForm({
                            role: user.role,
                            department: user.department || ''
                          });
                        }}
                        style={styles.editBtn}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user._id, user.name)}
                        disabled={deletingId === user._id}
                        style={styles.deleteBtn}
                      >
                        {deletingId === user._id ? '...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  header: {
    maxWidth: '1100px',
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
  tableWrapper: {
    maxWidth: '1100px',
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  thead: {
    background: '#f9fafb'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6'
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#374151'
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: '600',
    flexShrink: 0
  },
  userName: {
    fontWeight: '500',
    color: '#111827'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600'
  },
  verified: {
    fontSize: '13px',
    color: '#16a34a'
  },
  unverified: {
    fontSize: '13px',
    color: '#dc2626'
  },
  actionRow: {
    display: 'flex',
    gap: '8px'
  },
  editBtn: {
    background: '#e0f2fe',
    color: '#0369a1',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  deleteBtn: {
    background: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  saveBtn: {
    background: '#dcfce7',
    color: '#16a34a',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  cancelBtn: {
    background: '#f3f4f6',
    color: '#6b7280',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    background: '#ffffff'
  },
  input: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    width: '120px'
  }
};