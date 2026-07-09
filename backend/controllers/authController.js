const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/emailConfig');
const {
  verificationEmail,
  welcomeEmail,
  resetPasswordEmail,
  newUserPendingEmail
} = require('../config/emailTemplates');

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log('📩 Register attempt for:', email);

    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message: '❌ Password must be at least 8 characters and include a number'
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({
          message: '❌ An active account already exists with this email'
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      existingUser.name = name;
      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.verificationToken = verificationToken;
      existingUser.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await existingUser.save();

      const { subject, html } = verificationEmail(name, verificationToken);
      await transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html
      });

      return res.status(200).json({
        message: '✅ A new verification link has been sent to your email'
      });
    }

    console.log('👤 Creating new user...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpire: new Date(Date.now() + 24 * 60 * 60 * 1000),
      role: 'pending',
      isVerified: false
    });
    console.log('✅ User created in DB:', user._id);

    // ✅ Send verification email to employee
    console.log('📧 Sending verification email to:', email);
    try {
      const { subject, html } = verificationEmail(name, verificationToken);
      const info = await transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html
      });
      console.log('✅ Verification email sent:', info.messageId);
    } catch (empEmailErr) {
      console.error('❌ Verification email FAILED:', empEmailErr.message);
    }

    // ✅ Send pending notification to all HR admins
    // Note: Managers are intentionally NOT notified at this stage.
    // They're notified via userAddedEmail once HR approves/assigns a role
    // (see assignRole in userController.js).
    console.log('📧 Sending HR notifications...');
    try {
      const hrAdmins = await User.find({ role: 'hr_admin' });
      console.log('👥 HR admins found:', hrAdmins.length);
      for (const admin of hrAdmins) {
        const { subject, html } = newUserPendingEmail(admin.name, name, email);
        await transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: admin.email,
          subject,
          html
        });
        console.log('✅ HR email sent to:', admin.email);
      }
    } catch (hrErr) {
      console.error('❌ HR email FAILED:', hrErr.message);
    }

    console.log('✅ Registration complete for:', email);
    res.status(201).json({
      message: '✅ Registration successful! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('❌ Registration crashed:', error.message);
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
        message: '❌ Verification link is invalid — please register again or request a new link'
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

// RESEND VERIFICATION EMAIL
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: '❌ No account found with this email address'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: '❌ This account is already verified — please login'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const { subject, html } = verificationEmail(user.name, verificationToken);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html
    });

    res.status(200).json({
      message: '✅ Verification email resent — please check your inbox'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to resend verification email',
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

    if (!user.isVerified) {
      return res.status(400).json({
        message: '❌ Please verify your email first — check your inbox'
      });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(400).json({
        message: `❌ Account is locked. Try again in ${minutesLeft} minutes`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        // ── Auto-lock: 15-minute block, no email, no reset-password link.
        //    The lock expires on its own via lockUntil — we don't want to
        //    hand the user (or an attacker) a password-reset path as a
        //    way to interact with the account during the lock window. ──
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        return res.status(400).json({
          message: '❌ Account locked for 15 minutes due to 5 failed attempts. Please try again later.'
        });
      }

      await user.save();
      return res.status(400).json({
        message: `❌ Wrong password — ${5 - user.failedLoginAttempts} attempts remaining before account lock`
      });
    }

    if (user.role === 'pending') {
      return res.status(400).json({
        message: '❌ Your account is pending — HR Admin has not assigned your role yet'
      });
    }

    if (!user.lockUntil || user.lockUntil < Date.now()) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

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
        role: user.role,
        department: user.department || null  // ✅ ADDED
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

    // ── Block reset requests while the account is auto-locked. Since the
    //    lockout itself no longer emails a reset link, this closes the
    //    other door too — a locked-out user (or attacker) can't route
    //    around the 15-minute block by requesting one manually either. ──
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(400).json({
        message: `❌ Account is locked due to failed login attempts. Try again in ${minutesLeft} minutes`
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

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

    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message: '❌ Password must be at least 8 characters and include a number'
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.failedLoginAttempts = 0;
    await user.save();

    res.status(200).json({
      message: '✅ Password reset successful — please wait for your lock to expire before logging in'
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Password reset failed',
      error: error.message
    });
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    await User.findByIdAndUpdate(req.user.id, { name });
    res.status(200).json({ message: '✅ Name updated successfully' });
  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to update name',
      error: error.message
    });
  }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: '❌ Current password is incorrect'
      });
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
    res.status(500).json({
      message: '❌ Failed to change password',
      error: error.message
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword
};
