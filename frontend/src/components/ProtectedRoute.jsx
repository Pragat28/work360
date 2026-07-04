import { Navigate } from 'react-router-dom';

// Where to send a logged-in user if they try to access a section
// that isn't theirs (e.g. an employee hitting /hr/dashboard directly).
const ROLE_HOME = {
  hr_admin: '/hr/dashboard',
  manager: '/manager/dashboard',
  employee: '/employee/dashboard',
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

/**
 * Wrap a route element with this to enforce auth + role checks.
 *
 * Usage:
 *   <Route path="/hr" element={
 *     <ProtectedRoute allowedRoles={['hr_admin']}>
 *       <HRLayout />
 *     </ProtectedRoute>
 *   }>
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const token = localStorage.getItem('token');
  const user = getStoredUser();

  // Not logged in at all — send to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in, but wrong role for this section — bounce to their own home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return children;
}
