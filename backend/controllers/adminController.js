const User = require('../models/User');
const transporter = require('../config/emailConfig');
const { welcomeEmail, roleChangedEmail } = require('../config/emailTemplates');

// Get all pending users (not yet assigned a role)
const getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      role: 'pending',
      isVerified: true
    }).select('-password');

    res.status(200).json({
      message: '✅ Pending users fetched successfully',
      count: pendingUsers.length,
      users: pendingUsers
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to fetch pending users',
      error: error.message
    });
  }
};

// Assign role to a pending user
const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, department } = req.body;

    const allowedRoles = ['employee', 'manager', 'hr_admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: '❌ Invalid role — must be employee, manager, or hr_admin'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: '❌ User not found — check the user ID'
      });
    }

    if (user.role !== 'pending') {
      return res.status(400).json({
        message: '❌ User already has a role assigned'
      });
    }

    user.role = role;
    if (department) user.department = department;
    await user.save();

    // Send welcome email to user
    const { subject, html } = welcomeEmail(user.name, role);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html
    });

    res.status(200).json({
      message: `✅ Role assigned successfully — ${user.name} is now ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to assign role',
      error: error.message
    });
  }
};

// Change role of any existing user
const changeRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, department } = req.body;

    const allowedRoles = ['employee', 'manager', 'hr_admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: '❌ Invalid role — must be employee, manager, or hr_admin'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: '❌ User not found — check the user ID'
      });
    }

    const oldRole = user.role;
    user.role = role;
    if (department) user.department = department;
    await user.save();

    // Send role changed email
    const { subject, html } = roleChangedEmail(user.name, oldRole, role);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html
    });

    res.status(200).json({
      message: `✅ Role updated — ${user.name} changed from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to change role',
      error: error.message
    });
  }
};

// Get all users (for People Management page)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      message: '✅ Users fetched successfully',
      count: users.length,
      users
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to fetch users',
      error: error.message
    });
  }
};

// Delete a user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: '❌ User not found — check the user ID'
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: `✅ User ${user.name} deleted successfully`
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to delete user',
      error: error.message
    });
  }
};

module.exports = {
  getPendingUsers,
  assignRole,
  changeRole,
  getAllUsers,
  deleteUser
};