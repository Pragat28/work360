const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/emailConfig');
const {
  verificationEmail,
  welcomeEmail,
  resetPasswordEmail,
  accountLockedEmail,
  newUserPendingEmail
} = require('../config/emailTemplates');

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: '❌ User already exists with this email'
      });
    }

    // Password must be at least 8 characters and include a number
    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message: '❌ Password must be at least 8 characters and include a number'
      });
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verificationToken,
      role: 'pending',
      isVerified: false
    });

    // Send verification email to user
    const { subject, html } = verificationEmail(name, verificationToken);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html
    });

    // Notify all HR Admins about new pending user
    const hrAdmins = await User.find({ role: 'hr_admin' });
    for (const admin of hrAdmins) {
      const { subject, html } = newUserPendingEmail(admin.name, name, email);
      await transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: admin.email,
        subject,
        html
      });
    }

    res.status(201).json({
      message: '✅ Registration successful! Please check your email to verify your account.'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Registration failed',
      error: error.message
    });
  }
};

// VERIFY EMAIL
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({
        message: '❌ Invalid or expired verification link'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({
      message: '✅ Email verified successfully! Please wait for HR Admin to assign your role.'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Email verification failed',
      error: error.message
    });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: '❌ No account found with this email address'
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(400).json({
        message: '❌ Please verify your email first — check your inbox'
      });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(400).json({
        message: `❌ Account is locked. Try again in ${minutesLeft} minutes`
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed attempts
      user.failedLoginAttempts += 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        // Send account locked email
        const { subject, html } = accountLockedEmail(user.name);
        await transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject,
          html
        });

        return res.status(400).json({
          message: '❌ Account locked for 15 minutes due to 5 failed attempts — check your email'
        });
      }

      await user.save();
      return res.status(400).json({
        message: `❌ Wrong password — ${5 - user.failedLoginAttempts} attempts remaining before account lock`
      });
    }

    // Check if role is still pending
    if (user.role === 'pending') {
      return res.status(400).json({
        message: '❌ Your account is pending — HR Admin has not assigned your role yet'
      });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE_IN || '8h' }
    );

    res.status(200).json({
      message: '✅ Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Login failed',
      error: error.message
    });
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: '❌ No account found with this email address'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    const { subject, html } = resetPasswordEmail(user.name, resetToken);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html
    });

    res.status(200).json({
      message: '✅ Password reset link sent to your email — expires in 1 hour'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to send reset email',
      error: error.message
    });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: '❌ Reset link is invalid or has expired — request a new one'
      });
    }

    // Password must be at least 8 characters and include a number
    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message: '❌ Password must be at least 8 characters and include a number'
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.status(200).json({
      message: '✅ Password reset successful — you can now login with your new password'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Password reset failed',
      error: error.message
    });
  }
};
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    await User.findByIdAndUpdate(req.user.id, { name });
    res.status(200).json({ message: '✅ Name updated successfully' });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to update name', error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Current password is incorrect' });
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      return res.status(400).json({
        message: '❌ Password must be at least 8 characters and include a number'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: '✅ Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to change password', error: error.message });
  }
};

module.exports = { register, verifyEmail, login, forgotPassword, resetPassword, updateProfile, changePassword };