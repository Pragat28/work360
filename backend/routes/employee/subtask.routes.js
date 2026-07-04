// routes/employee/subtask.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/Auth');
const checkRole = require('../../middleware/roleMiddleware');
const { startSubtask, completeSubtask } = require('../../controllers/employee/subtaskController');
const { getComments } = require('../../controllers/employee/commentController'); // ← employee one

router.patch('/subtasks/:id/start', auth, checkRole('employee'), startSubtask);
router.patch('/subtasks/:id/complete', auth, checkRole('employee'), completeSubtask);
router.get('/subtasks/:id/comments', auth, checkRole('employee'), getComments);

module.exports = router;
