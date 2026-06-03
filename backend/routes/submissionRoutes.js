const express = require('express');
const router = express.Router();

const auth = require('../middleware/Auth');

const {
  createSubmission,
  markAsDone,
  getSubmissionsByTask
} = require('../controllers/submissionController');

router.post('/create', auth, createSubmission);

router.patch('/mark-done/:submissionId', auth, markAsDone);

router.get('/task/:taskId', auth, getSubmissionsByTask);

module.exports = router;