import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Auth pages (existing)
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

// Route guard
import ProtectedRoute from './components/ProtectedRoute';

//Manager pages
import ManagerDashboard from './pages/manager/DashboardPage';
import ManagerLayout from './pages/manager/LayoutPage';
import ManagerProjectsPage from './pages/manager/ProjectsPage';
import ManagerNotificationsPage from './pages/manager/NotificationsPage';
import ManagerTimelinePage from './pages/manager/TimelinePage';
import ProjectDetailPage from './pages/manager/ProjectDetailsPage';
import ManagerProfilePage from './pages/manager/ProfilePage';
import ManagerSubtaskPage from './pages/manager/SubtaskPage'


//hr pages
import HRDashboard from './pages/hr/DashboardPage';
import HRLayout from './pages/hr/LayoutPage';
import HRProjectsPage from './pages/hr/ProjectsPage';
import HRProjectDetailsPage from './pages/hr/ProjectDetailsPage';
import HRTimelinePage from './pages/hr/TimelinePage';
import HRNotificationsPage from './pages/hr/NotificationsPage';
import PeopleManagementPage from './pages/hr/PeopleManagementPage';
import PendingUsersPage from './pages/hr/PendingUsersPage';
import HRProfilePage from './pages/hr/ProfilePage';
import HRSubtaskPage from './pages/hr/SubtaskPage'

import EmployeeLayout from './pages/employee/LayoutPage';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeProjectsPage from './pages/employee/ProjectsPage';
import EmployeeNotificationsPage from './pages/employee/NotificationPage';
import EmployeeTimelinePage from './pages/employee/TimelinePage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Auth */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />

        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={['employee']}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard"     element={<EmployeeDashboard />} />
          <Route path="projects"      element={<EmployeeProjectsPage />} />
          <Route path="notifications" element={<EmployeeNotificationsPage />} />
          <Route path="timeline"      element={<EmployeeTimelinePage />} />
          <Route path="profile"       element={<ProfileSettingsPage />} />
        </Route>

        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard"     element={<ManagerDashboard />} />
          <Route path="projects"      element={<ManagerProjectsPage />} />
          <Route path="projects/:id"  element={<ProjectDetailPage />} />
          <Route path="subtasks"      element={<ManagerSubtaskPage/>}/>
          <Route path="notifications" element={<ManagerNotificationsPage />} />
          <Route path="timeline"      element={<ManagerTimelinePage />} />
          <Route path="profile"       element={<ManagerProfilePage />} />
        </Route>

        <Route
          path="/hr"
          element={
            <ProtectedRoute allowedRoles={['hr_admin']}>
              <HRLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard"     element={<HRDashboard />} />
          <Route path="projects"      element={<HRProjectsPage />} />
          <Route path="projects/:id"  element={<HRProjectDetailsPage />} />
          <Route path="subtasks"      element={<HRSubtaskPage/>}/>
          <Route path="notifications" element={<HRNotificationsPage />} />
          <Route path="timeline"      element={<HRTimelinePage />} />
          <Route path="people"        element={<PeopleManagementPage />} />
          <Route path="pending-users" element={<PendingUsersPage />} />
          <Route path="profile"       element={<HRProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
