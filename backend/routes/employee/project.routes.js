// routes/employee/project.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/Auth');
const checkRole = require('../../middleware/roleMiddleware');
const {
  getDashboard,
  getMyProjects,
  getProjectDetail,
  getMySubtasks,
  getTimeline,
  downloadTimelineReport,
} = require('../../controllers/employee/employeeController');

router.get('/dashboard', auth, checkRole('employee'), getDashboard);
router.get('/projects', auth, checkRole('employee'), getMyProjects);
router.get('/projects/:projectId', auth, checkRole('employee'), getProjectDetail);
router.get('/subtasks', auth, checkRole('employee'), getMySubtasks);
router.get('/timeline', auth, checkRole('employee'), getTimeline);
router.get('/timeline/report', auth, checkRole('employee'), downloadTimelineReport); // ← new
module.exports = router;
