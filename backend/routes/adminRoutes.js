const express = require('express');
const router = express.Router();
const auth = require('../middleware/Auth');
const checkRole = require('../middleware/roleMiddleware');
const {
  getPendingUsers,
  assignRole,
  changeRole,
  getAllUsers,
  deleteUser
} = require('../controllers/adminController');

// All routes below require login + hr_admin role
router.get('/pending-users', auth, checkRole('hr_admin'), getPendingUsers);
router.patch('/assign-role/:userId', auth, checkRole('hr_admin'), assignRole);
router.patch('/change-role/:userId', auth, checkRole('hr_admin'), changeRole);
router.get('/users', auth, checkRole('hr_admin'), getAllUsers);
router.delete('/users/:userId', auth, checkRole('hr_admin'), deleteUser);

module.exports = router;