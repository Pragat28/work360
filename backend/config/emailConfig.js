const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Test the connection
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email service failed:', error.message);
  } else {
    console.log('✅ Email service is ready');
  }
});

module.exports = transporter;