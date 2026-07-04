const express = require('express');
const router = express.Router();
const auth = require('../../middleware/Auth');
const checkRole = require('../../middleware/roleMiddleware');
const { upload } = require('../../config/cloudinary');
const {
  createSubmission,
  getMySubmissions,
  deleteSubmission,
} = require('../../controllers/employee/submissionController');

router.post('/subtasks/:id/submissions', auth, checkRole('employee'), upload.array('files'), createSubmission);
router.get('/subtasks/:id/submissions', auth, checkRole('employee'), getMySubmissions);
router.delete('/submissions/:id', auth, checkRole('employee'), deleteSubmission);

module.exports = router;
