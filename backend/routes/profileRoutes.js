const express = require('express');
const router = express.Router();
const auth = require('../middleware/Auth');
const {
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/profileController');
 
// No checkRole here — profile is shared by employee, manager, and hr_admin
router.get('/',                auth, getProfile);
router.patch('/update',        auth, updateProfile);
router.patch('/change-password', auth, changePassword);
 
module.exports = router;
