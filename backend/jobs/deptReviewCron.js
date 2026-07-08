const User = require('../models/User');
const transporter = require('../config/emailConfig');
const { departmentReviewReminderEmail } = require('../config/emailTemplates');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const REVIEW_CYCLE_DAYS = 90; // ~3 months

const departmentReviewCron = async () => {
  try {
    const employees = await User.find({
      role: { $in: ['employee', 'manager'] },
      departmentUpdatedAt: { $exists: true }
    });

    const hrAdmins = await User.find({ role: 'hr_admin' }).select('name email');
    if (!hrAdmins.length) return;

    const now = new Date();

    for (const employee of employees) {
      const dueDate = new Date(employee.departmentUpdatedAt.getTime() + REVIEW_CYCLE_DAYS * MS_PER_DAY);
      const daysLeft = Math.ceil((dueDate - now) / MS_PER_DAY);

      let stage = null;
      if (daysLeft === 7 && !employee.departmentReminderSent?.sevenDay) stage = 'sevenDay';
      else if (daysLeft === 3 && !employee.departmentReminderSent?.threeDay) stage = 'threeDay';
      else if (daysLeft === 1 && !employee.departmentReminderSent?.oneDay) stage = 'oneDay';

      if (!stage) continue;

      for (const hr of hrAdmins) {
        const { subject, html } = departmentReviewReminderEmail(
          hr.name,
          employee.name,
          employee.department,
          daysLeft,
          dueDate.toDateString()
        );
        await transporter.sendMail({
          from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
          to: hr.email,
          subject,
          html
        });
      }

      employee.departmentReminderSent[stage] = true;
      await employee.save();
    }
  } catch (error) {
    console.error('❌ Department review reminder job failed:', error.message);
  }
};

module.exports = departmentReviewCron;
