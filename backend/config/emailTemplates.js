const welcomeEmail = (name, role) => ({
  subject: 'Welcome to BFSI Edge — Your Account is Ready',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Welcome to BFSI Edge, ${name}!</h2>
      <p>Your account has been activated. Here are your details:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Role:</strong> ${role}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/login" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login to Your Account</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

const verificationEmail = (name, token) => ({
  subject: 'BFSI Edge — Verify Your Email Address',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Verify Your Email, ${name}!</h2>
      <p>Click the button below to verify your email address and activate your account.</p>
      <a href="${process.env.FRONTEND_URL}/verify-email/${token}" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Verify Email</a>
      <p style="color: #999; margin-top: 20px;">This link expires in 24 hours.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

const resetPasswordEmail = (name, token) => ({
  subject: 'BFSI Edge — Reset Your Password',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Reset Your Password, ${name}!</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${process.env.FRONTEND_URL}/reset-password/${token}" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password</a>
      <p style="color: #999; margin-top: 20px;">If you did not request this, ignore this email.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// NOTE: two versions of this template existed (yours vs Pragati's).
// Kept your version — the terser, more urgent phrasing. Swap in the
// commented block below if you'd rather use hers instead.
const accountLockedEmail = (name) => ({
  subject: 'BFSI Edge — Account Temporarily Locked',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #e53935;">Account Locked, ${name}!</h2>
      <p>Your account has been temporarily locked for <strong>15 minutes</strong> due to 5 consecutive failed login attempts.</p>
      <p>If this was not you, please reset your password immediately.</p>
      <a href="${process.env.FRONTEND_URL}/forgot-password" style="background: #e53935; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

/* Pragati's version (alternate — softer, optional reset link):
const accountLockedEmail = (name) => ({
  subject: 'BFSI Edge — Account Temporarily Locked',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #e53935;">Account Temporarily Locked, ${name}!</h2>
      <p>Your account has been locked for <strong>15 minutes</strong> because of 5 consecutive failed login attempts.</p>
      <p>Please wait 15 minutes and try logging in again with your correct password.</p>
      <p style="color: #999; margin-top: 20px;">If this was not you and you suspect someone is trying to access your account, you can reset your password as a precaution.</p>
      <a href="${process.env.FRONTEND_URL}/forgot-password" style="background: #e53935; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password (optional)</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});
*/

const roleChangedEmail = (name, oldRole, newRole) => ({
  subject: 'BFSI Edge — Your Role Has Been Updated',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Role Updated, ${name}!</h2>
      <p>Your role in BFSI Edge has been updated:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Previous Role:</strong> ${oldRole}</p>
        <p><strong>New Role:</strong> ${newRole}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/login" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login Now</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

const newUserPendingEmail = (adminName, userName, userEmail) => ({
  subject: 'BFSI Edge — New User Pending Role Assignment',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">New User Pending, ${adminName}!</h2>
      <p>A new user has registered and is waiting for role assignment:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Name:</strong> ${userName}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/pending-users" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Assign Role Now</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Project assigned to an employee ────────────────────────────────────────────
const projectAssignedEmail = (name, projectTitle, startDate, endDate) => ({
  subject: `BFSI Edge — You've Been Assigned to "${projectTitle}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">New Project Assigned, ${name}!</h2>
      <p>You have been assigned to a new project:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Starts:</strong> ${new Date(startDate).toDateString()}</p>
        <p><strong>Ends:</strong> ${new Date(endDate).toDateString()}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/projects" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Project</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Added to an existing project mid-way ───────────────────────────────────────
const addedToProjectEmail = (name, projectTitle, startDate, endDate) => ({
  subject: `BFSI Edge — You've Been Added to "${projectTitle}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Added to a Project, ${name}!</h2>
      <p>You have been added to an existing project:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Starts:</strong> ${new Date(startDate).toDateString()}</p>
        <p><strong>Ends:</strong> ${new Date(endDate).toDateString()}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/projects" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Project</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Removed from a project ─────────────────────────────────────────────────────
const removedFromProjectEmail = (name, projectTitle) => ({
  subject: `BFSI Edge — You've Been Removed from "${projectTitle}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #475569;">Removed from a Project, ${name}</h2>
      <p>You have been removed from the following project:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Project:</strong> ${projectTitle}</p>
      </div>
      <p>If you believe this was a mistake, please reach out to your manager or HR Admin.</p>
      <a href="${process.env.FRONTEND_URL}/employee/projects" style="background: #475569; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View My Projects</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Assigned as manager of a project ───────────────────────────────────────────
const managerAddedEmail = (name, projectTitle, startDate, endDate) => ({
  subject: `BFSI Edge — You're Now Managing "${projectTitle}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4338ca;">You're a Project Manager Now, ${name}!</h2>
      <p>You have been assigned as a manager on the following project:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Starts:</strong> ${new Date(startDate).toDateString()}</p>
        <p><strong>Ends:</strong> ${new Date(endDate).toDateString()}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/manager/projects" style="background: #4338ca; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Project</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Removed as manager of a project ────────────────────────────────────────────
const managerRemovedEmail = (name, projectTitle) => ({
  subject: `BFSI Edge — You've Been Removed as Manager of "${projectTitle}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #475569;">Manager Role Removed, ${name}</h2>
      <p>You are no longer a manager on the following project:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Project:</strong> ${projectTitle}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/manager/projects" style="background: #475569; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View My Projects</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Assigned to a subtask ───────────────────────────────────────────────────────
const subtaskAssignedEmail = (name, subtaskName, projectTitle, dueDate) => ({
  subject: `BFSI Edge — You've Been Assigned "${subtaskName}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #6d28d9;">New Subtask Assigned, ${name}!</h2>
      <p>You have been assigned a new subtask:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Subtask:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Due:</strong> ${new Date(dueDate).toDateString()}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/my-tasks" style="background: #6d28d9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Task</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Subtask deadline reminder ──────────────────────────────────────────────────
const subtaskReminderEmail = (name, subtaskName, projectTitle, daysLeft, dueDate) => {
  const dayLabel = daysLeft === 0 ? "today" : daysLeft === 1 ? "in 1 day" : `in ${daysLeft} days`;
  return {
    subject: `BFSI Edge — Reminder: "${subtaskName}" is due ${dayLabel}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #f59e0b;">Deadline Reminder, ${name}!</h2>
        <p>This is a reminder about an upcoming deadline:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p><strong>Subtask:</strong> ${subtaskName}</p>
          <p><strong>Project:</strong> ${projectTitle}</p>
          <p><strong>Due:</strong> ${new Date(dueDate).toDateString()} (${dayLabel})</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/employee/my-tasks" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Task</a>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
      </div>
    `
  };
};

// ── Subtask is now overdue ──────────────────────────────────────────────────────
const subtaskOverdueEmail = (name, subtaskName, projectTitle, dueDate) => ({
  subject: `BFSI Edge — "${subtaskName}" is Now Overdue`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #e53935;">Subtask Overdue, ${name}!</h2>
      <p>A subtask has passed its deadline with no action taken:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Subtask:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Was due:</strong> ${new Date(dueDate).toDateString()}</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/my-tasks" style="background: #e53935; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Update Now</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Manager posted a remark on employee's subtask ──────────────────────────────
const remarkPostedEmail = (employeeName, managerName, subtaskName, remarkText) => ({
  subject: `BFSI Edge — New Remark on "${subtaskName}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">New Remark, ${employeeName}!</h2>
      <p><strong>${managerName}</strong> has left a remark on your subtask:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Subtask:</strong> ${subtaskName}</p>
        <p><strong>Remark:</strong> "${remarkText}"</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/my-tasks" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Remark</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Subtask rated by manager/HR Admin ───────────────────────────────────────────
const ratingSubmittedEmail = (employeeName, raterName, subtaskName, stars, remark) => ({
  subject: `BFSI Edge — Your Work on "${subtaskName}" Has Been Rated`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #f59e0b;">You've Been Rated, ${employeeName}!</h2>
      <p>${raterName} has rated your completed subtask:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Subtask:</strong> ${subtaskName}</p>
        <p><strong>Rating:</strong> ${stars}/5 ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</p>
        ${remark ? `<p><strong>Remark:</strong> "${remark}"</p>` : ''}
      </div>
      <a href="${process.env.FRONTEND_URL}/employee/my-tasks" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Rating</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Manager notified a file was submitted ───────────────────────────────────────
const fileSubmittedEmail = (managerName, employeeName, subtaskName, projectTitle, note) => ({
  subject: `BFSI Edge — New submission on "${subtaskName}"`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px;">
      <h2 style="color:#4f46e5;">New File Submission, ${managerName}!</h2>
      <p><strong>${employeeName}</strong> submitted work on a subtask:</p>
      <div style="background:#f5f5f5;padding:15px;border-radius:6px;margin:20px 0;">
        <p><strong>Subtask:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        ${note ? `<p><strong>Note:</strong> "${note}"</p>` : ""}
      </div>
      <a href="${process.env.FRONTEND_URL}/manager/projects" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Review Submission</a>
      <p style="color:#999;font-size:12px;margin-top:30px;">BFSI Edge · Project Management Portal</p>
    </div>
  `
});

// ── Task started (shared / identical between both versions) ────────────────────
const subtaskStartedEmail = (recipientName, employeeName, subtaskName, projectTitle, isLate) => ({
  subject: `BFSI Edge — "${subtaskName}" has been started`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8;">Task Started</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${employeeName}</strong> has started working on a task.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Task:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        ${isLate ? '<p style="color: #e53935;"><strong>Note:</strong> This task was started after its due date.</p>' : ''}
      </div>
      <a href="${process.env.FRONTEND_URL}/login" style="background: #1a73e8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View in Dashboard</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Task completed (shared / identical between both versions) ──────────────────
const subtaskCompletedEmail = (recipientName, employeeName, subtaskName, projectTitle, isLate) => ({
  subject: `BFSI Edge — "${subtaskName}" has been completed`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #16a34a;">Task Completed</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${employeeName}</strong> has marked a task as complete.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Task:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        ${isLate ? '<p style="color: #e53935;"><strong>Note:</strong> This was completed after the due date.</p>' : ''}
      </div>
      <a href="${process.env.FRONTEND_URL}/login" style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Review & Rate</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

// ── Work submitted (shared / identical between both versions) ──────────────────
const subtaskSubmissionEmail = (recipientName, employeeName, subtaskName, projectTitle, fileCount, isLate) => ({
  subject: `BFSI Edge — Work submitted for "${subtaskName}"`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #7c3aed;">Work Submitted</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${employeeName}</strong> has submitted work for review.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Task:</strong> ${subtaskName}</p>
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Files attached:</strong> ${fileCount}</p>
        ${isLate ? '<p style="color: #e53935;"><strong>Note:</strong> This was submitted after the due date.</p>' : ''}
      </div>
      <a href="${process.env.FRONTEND_URL}/login" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Submission</a>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | <a href="${process.env.FRONTEND_URL}/profile">Manage Notifications</a></p>
    </div>
  `
});

module.exports = {
  welcomeEmail,
  verificationEmail,
  resetPasswordEmail,
  accountLockedEmail,
  roleChangedEmail,
  newUserPendingEmail,
  projectAssignedEmail,
  addedToProjectEmail,
  removedFromProjectEmail,
  managerAddedEmail,
  managerRemovedEmail,
  subtaskAssignedEmail,
  subtaskReminderEmail,
  subtaskOverdueEmail,
  remarkPostedEmail,
  ratingSubmittedEmail,
  fileSubmittedEmail,
  subtaskStartedEmail,
  subtaskCompletedEmail,
  subtaskSubmissionEmail
};
