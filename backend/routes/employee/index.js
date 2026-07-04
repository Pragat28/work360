// routes/employee/index.js — mounts all employee routes under /api/employee
const express = require('express');
const router = express.Router();
 
router.use('/', require('./project.routes'));
router.use('/', require('./subtask.routes'));
router.use('/', require('./comment.routes'));
router.use('/', require('./rating.routes'));
router.use('/', require('./submission.routes'));
 
// Mounted at /profile so URLs become:
//   GET    /api/employee/profile
//   PATCH  /api/employee/profile/update
//   PATCH  /api/employee/profile/change-password
router.use('/profile', require('./profile.routes'));
 
module.exports = router;
 
