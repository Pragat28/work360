import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAllUsers, deleteUser, changeRole } from '../../utils/api';

export default function PeopleManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ── Filters ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

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

  // ── Toast-based confirmation (replaces window.confirm) ─────────────────
  const confirmToast = (message) =>
    new Promise((resolve) => {
      const id = toast.custom(
        (t) => (
          <div style={{ ...styles.confirmToast, opacity: t.visible ? 1 : 0 }}>
            <p style={styles.confirmMessage}>{message}</p>
            <div style={styles.confirmActions}>
              <button
                style={styles.confirmCancelBtn}
                onClick={() => {
                  toast.dismiss(id);
                  resolve(false);
                }}
              >
                Cancel
              </button>
              <button
                style={styles.confirmDeleteBtn}
                onClick={() => {
                  toast.dismiss(id);
                  resolve(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ),
        { duration: 10000 }
      );
    });

  const handleDelete = async (userId, userName) => {
    const confirmed = await confirmToast(`Delete ${userName}? This can't be undone.`);
    if (!confirmed) return;

    setDeletingId(userId);
    try {
      await deleteUser(userId);
      toast.success(`${userName} deleted`);
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
      toast.success('Role updated — user notified by email');
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

  const roleLabel = (role) => {
    if (role === 'hr_admin') return 'HR Admin';
    if (role === 'manager') return 'Manager';
    if (role === 'employee') return 'Employee';
    return role;
  };

  // ── Derived data: department options + filtered/searched list ──────────
  const departmentOptions = useMemo(() => {
    const depts = new Set();
    users.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (departmentFilter !== 'all' && u.department !== departmentFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [users, roleFilter, departmentFilter, search]);

  const hasActiveFilters = roleFilter !== 'all' || departmentFilter !== 'all' || search.trim() !== '';

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setDepartmentFilter('all');
  };

  // ── Summary counts for the stat strip ───────────────────────────────────
  const counts = useMemo(() => {
    const c = { total: users.length, employee: 0, manager: 0, hr_admin: 0 };
    users.forEach((u) => {
      if (c[u.role] !== undefined) c[u.role] += 1;
    });
    return c;
  }, [users]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>People Management</h1>
          <p style={styles.subtitle}>{users.length} total users in the system</p>
        </div>

        <div style={styles.statStrip}>
          <div style={styles.statPill}>
            <span style={{ ...styles.statDot, background: '#16a34a' }} />
            {counts.employee} Employees
          </div>
          <div style={styles.statPill}>
            <span style={{ ...styles.statDot, background: '#0891b2' }} />
            {counts.manager} Managers
          </div>
          <div style={styles.statPill}>
            <span style={{ ...styles.statDot, background: '#7c3aed' }} />
            {counts.hr_admin} HR Admins
          </div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="hr_admin">HR Admin</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Department</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All departments</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button onClick={resetFilters} style={styles.clearBtn}>
            Clear filters
          </button>
        )}
      </div>

      <div style={styles.tableWrapper}>
        {filteredUsers.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No users match these filters</p>
            <p style={styles.emptySubtitle}>Try adjusting the search or filters above.</p>
            {hasActiveFilters && (
              <button onClick={resetFilters} style={styles.emptyResetBtn}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '180px' }} />
              </colgroup>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Verified</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
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
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          style={styles.select}
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="hr_admin">HR Admin</option>
                        </select>
                      ) : (
                        <span style={{
                          ...styles.badge,
                          background: roleBadgeColor(user.role) + '1a',
                          color: roleBadgeColor(user.role)
                        }}>
                          {roleLabel(user.role)}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {editingId === user._id ? (
                        <input
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          style={styles.input}
                          placeholder="Department"
                        />
                      ) : (
                        user.department || <span style={styles.dash}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={user.isVerified ? styles.verified : styles.unverified}>
                        {user.isVerified ? '✓ Verified' : '✕ Unverified'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {editingId === user._id ? (
                        <div style={styles.actionRow}>
                          <button onClick={() => handleRoleChange(user._id)} style={styles.saveBtn}>
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>
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
                            {deletingId === user._id ? '…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredUsers.length > 0 && (
        <p style={styles.resultCount}>
          Showing {filteredUsers.length} of {users.length} users
        </p>
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
    maxWidth: '1100px',
    margin: '0 auto 24px auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '16px'
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
  statStrip: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151'
  },
  statDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  toolbar: {
    maxWidth: '1100px',
    margin: '0 auto 16px auto',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end'
  },
  searchWrap: {
    position: 'relative',
    flex: '1 1 220px',
    minWidth: '220px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    fontSize: '15px',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 32px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff',
    boxSizing: 'border-box'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  filterLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  },
  filterSelect: {
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    background: '#ffffff',
    minWidth: '150px',
    cursor: 'pointer'
  },
  clearBtn: {
    background: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    height: '38px'
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '100px',
    gap: '12px'
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#0891b2',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '14px'
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
  tableScroll: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed'
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
    borderBottom: '1px solid #e5e7eb',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6'
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  dash: {
    color: '#9ca3af'
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
    color: '#16a34a',
    fontWeight: '500'
  },
  unverified: {
    fontSize: '13px',
    color: '#dc2626',
    fontWeight: '500'
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
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
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    background: '#ffffff',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box'
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box'
  },
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 4px 0'
  },
  emptySubtitle: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '0 0 16px 0'
  },
  emptyResetBtn: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  resultCount: {
    maxWidth: '1100px',
    margin: '12px auto 0 auto',
    fontSize: '13px',
    color: '#9ca3af'
  },
  confirmToast: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    minWidth: '280px',
    transition: 'opacity 0.15s ease'
  },
  confirmMessage: {
    fontSize: '14px',
    color: '#111827',
    margin: '0 0 12px 0'
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  confirmCancelBtn: {
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  confirmDeleteBtn: {
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};
