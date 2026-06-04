const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');

const {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.patch('/update-profile', auth, updateProfile);
router.patch('/change-password', auth, changePassword);

module.exports = router;