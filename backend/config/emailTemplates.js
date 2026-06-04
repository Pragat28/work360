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

module.exports = {
  welcomeEmail,
  verificationEmail,
  resetPasswordEmail,
  accountLockedEmail,
  roleChangedEmail,
  newUserPendingEmail
};