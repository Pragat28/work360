import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Automatically attach token to every request if logged in
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const registerUser = (data) => API.post('/auth/register', data);
export const loginUser = (data) => API.post('/auth/login', data);
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const resetPassword = (token, data) => API.post(`/auth/reset-password/${token}`, data);
export const verifyEmail = (token) => API.get(`/auth/verify-email/${token}`);

export const getPendingUsers = () => API.get('/admin/pending-users');
export const assignRole = (userId, data) => API.patch(`/admin/assign-role/${userId}`, data);
export const changeRole = (userId, data) => API.patch(`/admin/change-role/${userId}`, data);
export const getAllUsers = () => API.get('/admin/users');
export const deleteUser = (userId) => API.delete(`/admin/users/${userId}`);
// Employee APIs
export const getEmployeeDashboard = () => API.get('/employee/dashboard');

export const getEmployeeProjects = () => API.get('/employee/projects');
export const getEmployeeProjectDetail = (projectId) => API.get(`/employee/projects/${projectId}`);
export const getEmployeeSubtasks = () => API.get('/employee/subtasks');
// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const getUnreadNotifications = () => API.get('/notifications', { params: { unreadOnly: true } });
export const markNotificationRead = (id) => API.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => API.patch('/notifications/read-all');
export default API;
