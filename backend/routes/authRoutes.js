// routes/auth.routes.js — NO CHANGES NEEDED, already correct
const express = require('express');
const router = express.Router();
const auth = require('../middleware/Auth');
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// updateProfile and changePassword moved to employee/profile.routes.js
module.exports = router;
