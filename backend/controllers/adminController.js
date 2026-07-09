const User = require('../models/User');
const transporter = require('../config/emailConfig');
const { welcomeEmail, roleChangedEmail, departmentChangedEmail, userDeletedEmail, userAddedEmail } = require('../config/emailTemplates');
const { createNotification, createTimelineEvent } = require("../utils/notifications");

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
    if (department) {
      user.department = department;
      // Starts the 3-month department review clock
      user.departmentUpdatedAt = new Date();
      user.departmentReminderSent = { sevenDay: false, threeDay: false, oneDay: false };
    }
    await user.save();

    // Send welcome email to user
    const { subject, html } = welcomeEmail(user.name, role);
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html
    });

    // Notify all managers that a new user has been approved and added.
    // This is the ONLY point managers hear about a new user — they were
    // deliberately not cc'd on newUserPendingEmail at registration time.
    try {
      const managers = await User.find({ role: 'manager' }).select('name email _id');

      // Exclude the user themself, covering the edge case where they were
      // just assigned the manager role
      const managerRecipients = managers.filter(
        mgr => mgr._id.toString() !== user._id.toString()
      );

      for (const manager of managerRecipients) {
        const { subject: mgrSubject, html: mgrHtml } = userAddedEmail(
          manager.name,
          user.name,
          role,
          req.user?.name
        );

        await createNotification({
          recipient: manager._id,
          eventType: 'user_added',
          message: `${user.name} has been added as ${role}${req.user?.name ? ` by ${req.user.name}` : ''}`,
          sendEmail: true,
          emailFn: () => transporter.sendMail({
            from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
            to: manager.email,
            subject: mgrSubject,
            html: mgrHtml
          }),
          ccHrAdmins: false, // HR already knows — they approved this user
        });
      }
    } catch (mgrNotifyErr) {
      console.error('❌ Manager new-user notification FAILED:', mgrNotifyErr.message);
    }

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

// Change role and/or department of any existing user
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
    const oldDepartment = user.department;

    const roleChanged = Boolean(role) && role !== oldRole;
    const departmentChanged = Boolean(department) && department !== oldDepartment;

    user.role = role;
    if (department) user.department = department;

    if (departmentChanged) {
      user.departmentUpdatedAt = new Date();
      user.departmentReminderSent = { sevenDay: false, threeDay: false, oneDay: false };
    }

    await user.save();

    // Send role changed email — only if role actually changed
    if (roleChanged) {
      const { subject, html } = roleChangedEmail(user.name, oldRole, role);
      await transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject,
        html
      });
    }

    // Send department changed email + in-app notification to employee, all managers,
    // and all HR admins — only if department actually changed
    if (departmentChanged) {
      const hrAdmins = await User.find({ role: 'hr_admin' }).select('name email _id');
      const managers = await User.find({ role: 'manager' }).select('name email _id');

      const recipients = [
        { _id: user._id, name: user.name, email: user.email },
        ...managers.map(mgr => ({ _id: mgr._id, name: mgr.name, email: mgr.email })),
        ...hrAdmins.map(hr => ({ _id: hr._id, name: hr.name, email: hr.email }))
      ];

      // Avoid duplicate sends if employee/manager/HR overlap (e.g. a manager also flagged as HR)
      const seenEmails = new Set();
      const uniqueRecipients = recipients.filter(r => {
        if (seenEmails.has(r.email)) return false;
        seenEmails.add(r.email);
        return true;
      });

      for (const recipient of uniqueRecipients) {
        const { subject, html } = departmentChangedEmail(
          recipient.name,
          user.name,
          oldDepartment,
          department,
          req.user?.name
        );

        const isTargetUser = recipient._id.toString() === user._id.toString();
        const message = isTargetUser
          ? `Your department has been changed from ${oldDepartment} to ${department}`
          : `${user.name}'s department has been changed from ${oldDepartment} to ${department}`;

        await createNotification({
          recipient: recipient._id,
          eventType: 'user_dept_changed',
          message,
          sendEmail: true,
          emailFn: () => transporter.sendMail({
            from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
            to: recipient.email,
            subject,
            html
          }),
          ccHrAdmins: false, // HR already included in the recipients list above
        });
      }
    }

    res.status(200).json({
      message: `✅ User updated — ${user.name}${roleChanged ? ` role changed from ${oldRole} to ${role}` : ''}${departmentChanged ? `${roleChanged ? ',' : ''} department changed from ${oldDepartment} to ${department}` : ''}`,
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

// Delete a user — notifies HR admins and managers via email + in-app notification
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: '❌ User not found — check the user ID'
      });
    }

    const hrAdmins = await User.find({ role: 'hr_admin' }).select('name email _id');
    const managers = await User.find({ role: 'manager' }).select('name email _id');

    // Combine HR + managers, dedupe by _id, and exclude the user being deleted
    // (covers the edge case where the deleted user was themselves HR/manager)
    const seen = new Set();
    const recipients = [...hrAdmins, ...managers].filter(r => {
      const key = r._id.toString();
      if (key === userId || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await User.findByIdAndDelete(userId);

    for (const recipient of recipients) {
      const { subject, html } = userDeletedEmail(recipient.name, user.name, user.role, req.user?.name);

      await createNotification({
        recipient: recipient._id,
        eventType: 'user_deleted',
        message: `${user.name} (${user.role}) has been removed from the system${req.user?.name ? ` by ${req.user.name}` : ''}`,
        sendEmail: true,
        emailFn: () => transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: recipient.email,
          subject,
          html
        }),
        ccHrAdmins: false, // HR admins are already included in the recipients list above
      });
    }

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
