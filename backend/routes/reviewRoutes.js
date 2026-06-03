const express = require('express');
const router = express.Router();
const auth = require('../middleware/Auth');
const {
  reviewSubmission,
  rateSubmission
} = require('../controllers/reviewController');

// Manager reviews a submission (accept / reject / request changes)
router.patch('/review/:submissionId', auth, reviewSubmission);

// Manager rates a submission
router.post('/rate/:submissionId', auth, rateSubmission);

module.exports = router;