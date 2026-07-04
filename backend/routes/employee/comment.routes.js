// routes/employee/comment.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/Auth');
const checkRole = require('../../middleware/roleMiddleware');
const {
  getComments,
} = require('../../controllers/employee/commentController');

// Employee can only READ comments, never post
router.get('/:id/comments', auth, checkRole('employee'), getComments);

module.exports = router;
