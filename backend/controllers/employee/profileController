const User = require('../../models/User');
const bcrypt = require('bcryptjs');

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select('-password');
};

// =============================================================================
// @desc    Get logged-in employee's profile
// @route   GET /api/employee/profile
// @access  Employee only
// =============================================================================
exports.getProfile = async (req, res) => {
  try {
    const user = await getFullUser(req.user);
    if (!user) return res.status(401).json({ message: '❌ User not found' });

    return res.status(200).json({
      message: '✅ Profile fetched',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: '❌ Server error', error: err.message });
  }
};

// =============================================================================
// @desc    Update employee's name
// @route   PATCH /api/employee/profile/update
// @access  Employee only
// =============================================================================
exports.updateProfile = async (req, res) => {
  try {
    const user = await getFullUser(req.user);
    if (!user) return res.status(401).json({ message: '❌ User not found' });

    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: '❌ Name must be at least 2 characters' });
    }

    user.name = name.trim();
    await user.save();

    return res.status(200).json({
      message: '✅ Name updated successfully',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: '❌ Server error', error: err.message });
  }
};

// =============================================================================
// @desc    Change employee's password
// @route   PATCH /api/employee/profile/change-password
// @access  Employee only
// =============================================================================
exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // need password field here
    if (!user) return res.status(401).json({ message: '❌ User not found' });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '❌ Both current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: '❌ New password must be at least 8 characters' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: '❌ New password must be different from current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ message: '✅ Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ message: '❌ Server error', error: err.message });
  }
};
