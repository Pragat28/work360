const cron = require('node-cron');
const User = require('../models/User');
const Project = require('../models/Project');
const Subtask = require('../models/Subtask');
const transporter = require('../config/emailConfig');
const generateTimelinePdf = require('../utils/generateTimelinePdf');

const isPastDueDay = (dueDate, referenceDate = new Date()) => {
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  return referenceDate > endOfDueDay;
};

// ── Build timeline for an employee (last 3 months) ──
const buildTimeline = async (employee) => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const projects = await Project.find({
    assignedEmployees: employee._id,
    isDeleted: false,
  }).select('_id title createdAt');

  const projectIds = projects.map(p => p._id);
  const projectMap = {};
  projects.forEach(p => { projectMap[p._id.toString()] = p.title; });

  const subtasks = await Subtask.find({
    project: { $in: projectIds },
    isDeleted: false,
    updatedAt: { $gte: threeMonthsAgo }
  }).sort({ updatedAt: -1 });

  const events = [];

  subtasks.forEach(s => {
    if (s.completedAt && new Date(s.completedAt) >= threeMonthsAgo) {
      events.push({
        type: 'completed',
        title: s.completedLate ? `Marked ${s.name} complete (late)` : `Marked ${s.name} complete`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: s.completedAt,
      });
    }
    if (s.startedAt && new Date(s.startedAt) >= threeMonthsAgo) {
      events.push({
        type: 'started',
        title: `Started ${s.name}`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: s.startedAt,
      });
    }
    if (isPastDueDay(s.dueDate) && s.status !== 'completed' && new Date(s.dueDate) >= threeMonthsAgo) {
      events.push({
        type: 'overdue',
        title: `${s.name} missed deadline`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: s.dueDate,
      });
    }
  });

  projects.forEach(p => {
    if (new Date(p.createdAt) >= threeMonthsAgo) {
      events.push({
        type: 'assigned',
        title: `Added to ${p.title}`,
        sub: 'Project assigned',
        date: p.createdAt,
      });
    }
  });

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Group by date
  const grouped = {};
  events.forEach(ev => {
    const dateKey = new Date(ev.date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push({ type: ev.type, title: ev.title, sub: ev.sub });
  });

  return Object.entries(grouped).map(([date, evs]) => ({ date, events: evs }));
};

// ── Send report to all HR admins ──
const sendReportToHR = async (employee, pdfBuffer) => {
  const hrAdmins = await User.find({ role: 'hr_admin' });

  for (const hr of hrAdmins) {
    await transporter.sendMail({
      from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
      to: hr.email,
      subject: `BFSI Edge — 3-Month Timeline Report: ${employee.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #1a73e8;">3-Month Timeline Report</h2>
          <p>Hi ${hr.name},</p>
          <p>Please find attached the 3-month activity timeline report for:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>Employee:</strong> ${employee.name}</p>
            <p><strong>Email:</strong> ${employee.email}</p>
            <p><strong>Department:</strong> ${employee.department || 'N/A'}</p>
            <p><strong>Account created:</strong> ${new Date(employee.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">BFSI Edge | Auto-generated report</p>
        </div>
      `,
      attachments: [
        {
          filename: `timeline_${employee.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }
      ]
    });
    console.log(`✅ Timeline report sent to HR: ${hr.email} for employee: ${employee.name}`);
  }
};

// ── Main job ──
const runTimelineReportJob = async () => {
  try {
    console.log('🕐 Running 3-month timeline report job...');

    const now = new Date();
    const employees = await User.find({
      role: 'employee',
      isVerified: true,
      reportSentAt: { $exists: false }  // not yet sent
    });

    for (const employee of employees) {
      const createdAt = new Date(employee.createdAt);
      const threeMonthsAfterCreation = new Date(createdAt);
      threeMonthsAfterCreation.setMonth(threeMonthsAfterCreation.getMonth() + 3);

      // Check if 3 months have passed since account creation
      if (now >= threeMonthsAfterCreation) {
        console.log(`📄 Generating report for: ${employee.name}`);

        try {
          const timeline = await buildTimeline(employee);
          const pdfBuffer = await generateTimelinePdf(employee, timeline);
          await sendReportToHR(employee, pdfBuffer);

          // ✅ Mark report as sent so it doesn't send again
          employee.reportSentAt = now;
          await employee.save();

          console.log(`✅ Report sent for: ${employee.name}`);
        } catch (empErr) {
          console.error(`❌ Failed for ${employee.name}:`, empErr.message);
        }
      }
    }

    console.log('✅ Timeline report job complete.');
  } catch (err) {
    console.error('❌ Timeline report job crashed:', err.message);
  }
};

// ── Schedule: runs every day at 8:00 AM ──
const startTimelineReportJob = () => {
  cron.schedule('0 8 * * *', () => {
    runTimelineReportJob();
  });
  console.log('✅ Timeline report job scheduled (daily at 8 AM)');
};

module.exports = { startTimelineReportJob, runTimelineReportJob };
