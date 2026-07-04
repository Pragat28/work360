// routes/employee/rating.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/Auth');
const checkRole = require('../../middleware/roleMiddleware');
const {
  getMyRating,
  getAllMyRatings,
} = require('../../controllers/employee/ratingController');

// Employee can only VIEW ratings, never submit or update
router.get('/ratings', auth, checkRole('employee'), getAllMyRatings);
router.get('/subtasks/:id/rating', auth, checkRole('employee'), getMyRating);

module.exports = router;
