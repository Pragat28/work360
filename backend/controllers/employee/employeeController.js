const Project = require('../../models/Project');
const Subtask = require('../../models/Subtask');
const User = require('../../models/User');
const Rating = require('../../models/Rating');
const SubtaskSubmission = require('../../models/Submission');
const Comment = require('../../models/Comment'); // add this import at top of file
const PDFDocument = require('pdfkit');

const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select('-password');
};

// ─── Helper: a task is only "late" once its due day has fully ended ──────────
// Raw comparisons against dueDate (stored at midnight) made every task due
// "today" register as overdue from 12:00 AM onward. This pushes the cutoff
// to the end of the due date instead.
const isPastDueDay = (dueDate, referenceDate = new Date()) => {
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  return referenceDate > endOfDueDay;
};

// =============================================================================
// @desc    Get all projects assigned to the logged-in employee
// @route   GET /api/employee/projects
// @access  Employee only
// =============================================================================
exports.getMyProjects = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    const projects = await Project.find({
      assignedEmployees: currentUser._id,
      isDeleted: false,
    })
      .populate('assignedEmployees', 'name email')
      .populate('assignedManagers', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const projectsWithProgress = await Promise.all(
      projects.map(async (p) => {
        const subtasks = await Subtask.find({ project: p._id, isDeleted: false });
        const total = subtasks.length;
        const completed = subtasks.filter((s) => s.status === 'completed').length;
        const overdue = subtasks.filter(
          (s) => isPastDueDay(s.dueDate) && s.status !== 'completed'
        ).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          ...p.toObject(),
          progress,
          totalSubtasks: total,
          completedSubtasks: completed,
          overdueSubtasks: overdue,
        };
      })
    );

    res.status(200).json({
      message: '✅ Projects fetched successfully',
      count: projects.length,
      projects: projectsWithProgress,
    });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to fetch projects', error: error.message });
  }
};

// =============================================================================
// @desc    Get detail of a single project the employee is assigned to
// @route   GET /api/employee/projects/:projectId
// @access  Employee only
// =============================================================================
exports.getProjectDetail = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    const project = await Project.findOne({
      _id: req.params.projectId,
      assignedEmployees: currentUser._id,
      isDeleted: false,
    })
      .populate('assignedEmployees', 'name email')
      .populate('assignedManagers', 'name email')
      .populate('createdBy', 'name');

    if (!project) {
      return res
        .status(404)
        .json({ message: '❌ Project not found or you are not assigned to it' });
    }

    const subtasks = await Subtask.find({
      project: project._id,
      isDeleted: false,
    }).sort({ order: 1 });

    res.status(200).json({
      message: '✅ Project fetched successfully',
      project: { ...project.toObject(), subtasks },
    });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to fetch project', error: error.message });
  }
};

// =============================================================================
// @desc    Get all subtasks assigned to the logged-in employee (across projects)
// @route   GET /api/employee/subtasks
// @access  Employee only
// =============================================================================
exports.getMySubtasks = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    const projects = await Project.find({
      assignedEmployees: currentUser._id,
      isDeleted: false,
    }).select('_id title assignedManagers');

    const projectIds = projects.map((p) => p._id);
    const projectMap = {};
    projects.forEach((p) => { projectMap[p._id.toString()] = p; });

    const subtasks = await Subtask.find({
      project: { $in: projectIds },
      isDeleted: false,
    }).sort({ dueDate: 1 });

    const subtasksWithMeta = subtasks.map((s) => {
      const isLate = isPastDueDay(s.dueDate) && s.status !== 'completed';
      return {
        ...s.toObject(),
        isLate,
        isOverdue: isLate,
        projectId: s.project.toString(),
        projectTitle: projectMap[s.project.toString()]?.title || 'Unknown Project',
        projectManagers: projectMap[s.project.toString()]?.assignedManagers || [],
      };
    });

    res.status(200).json({
      message: '✅ Subtasks fetched successfully',
      count: subtasks.length,
      subtasks: subtasksWithMeta,
    });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to fetch subtasks', error: error.message });
  }
};

// =============================================================================
// @desc    Get employee dashboard stats
// @route   GET /api/employee/dashboard
// @access  Employee only
exports.getDashboard = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    const projects = await Project.find({
      assignedEmployees: currentUser._id,
      isDeleted: false,
    });

    const projectIds = projects.map((p) => p._id);

    const subtasks = await Subtask.find({
      project: { $in: projectIds },
      isDeleted: false,
    }).populate('project', 'title');

    const now = new Date();

    const totalProjects = projects.length;
    const activeProjects = projects.filter(
      (p) => p.status === 'in_progress' || p.status === 'assigned'
    ).length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;
    const overdueSubtasks = subtasks.filter(
      (s) => isPastDueDay(s.dueDate, now) && !s.isCompleted
    ).length;

    const totalTasks = subtasks.length;
    const completedTasks = subtasks.filter((s) => s.isCompleted).length;
    const overallPct =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Real average rating — ratings where this employee is in the employees array
    const ratingAgg = await Rating.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          employees: currentUser._id,
          isArchived: false,
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$stars' },
        },
      },
    ]);
    const avgRating =
      ratingAgg.length > 0
        ? Math.round(ratingAgg[0].avg * 10) / 10
        : 0;

    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = subtasks
      .filter((s) => !s.isCompleted && s.dueDate <= in14Days)
      .map((s) => {
        const daysLeft = Math.ceil(
          (new Date(s.dueDate) - now) / (1000 * 60 * 60 * 24)
        );
        return {
          _id: s._id,
          subtask: s.name,
          project: s.project?.title || 'Unknown',
          due: new Date(s.dueDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          }),
          daysLeft: daysLeft < 0 ? 0 : daysLeft,
          status: isPastDueDay(s.dueDate, now) ? 'overdue' : daysLeft <= 3 ? 'soon' : 'ok',
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);

    const recentSubtasks = await Subtask.find({
      project: { $in: projectIds },
      isDeleted: false,
      $or: [{ isCompleted: true }, { status: 'in_progress' }],
    })
      .populate('project', 'title')
      .sort({ updatedAt: -1 })
      .limit(5);

    const recentActivity = recentSubtasks.map((s) => ({
      _id: s._id,
      type: s.isCompleted ? 'completed' : 'started',
      subtask: s.name,
      project: s.project?.title || 'Unknown',
      time: timeAgo(s.updatedAt),
    }));

    res.status(200).json({
      message: '✅ Dashboard data fetched successfully',
      stats: { totalProjects, activeProjects, completedProjects, overdueSubtasks },
      progress: {
        tasksCompleted: completedTasks,
        totalTasks,
        overallPct,
        avgRating,
      },
      upcomingDeadlines,
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to fetch dashboard data',
      error: error.message,
    });
  }
};
// =============================================================================
// @desc    Get employee-scoped timeline events
// @route   GET /api/employee/timeline
// @access  Employee only
// =============================================================================
exports.getTimeline = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    const projects = await Project.find({
      assignedEmployees: currentUser._id,
      isDeleted: false,
    }).select('_id title createdAt');

    const projectIds = projects.map((p) => p._id);
    const projectMap = {};
    projects.forEach((p) => { projectMap[p._id.toString()] = p.title; });

    const subtasks = await Subtask.find({
      project: { $in: projectIds },
      isDeleted: false,
    }).sort({ updatedAt: -1 }).limit(50);

    const subtaskIds = subtasks.map((s) => s._id);
    const subtaskMap = {};
    subtasks.forEach((s) => { subtaskMap[s._id.toString()] = s; });

    // Fetch submissions, ratings, comments in parallel
    const [submissions, ratings, comments] = await Promise.all([
      SubtaskSubmission.find({
        subtask: { $in: subtaskIds },
        submittedBy: currentUser._id,
        isDeleted: false,
      }).select('subtask createdAt isLate files note'),

      Rating.find({
        subtask: { $in: subtaskIds },
        isArchived: false,
      }).select('subtask stars createdAt'),

      Comment
        ? Comment.find({
            subtask: { $in: subtaskIds },
            isDeleted: false,
          }).select('subtask text createdAt author').populate('author', 'name')
        : Promise.resolve([]),
    ]);

    const events = [];

    // Started / Completed / Overdue from subtasks
    subtasks.forEach((s) => {
      const projectTitle = projectMap[s.project.toString()] || 'Unknown';
      if (s.completedAt) {
        events.push({
          id: s._id + '_completed',
          type: 'completed',
          title: `Marked ${s.name} complete`,
          sub: projectTitle,
          date: s.completedAt,
        });
      }
      if (s.startedAt) {
        events.push({
          id: s._id + '_started',
          type: 'started',
          title: `Started ${s.name}`,
          sub: projectTitle,
          date: s.startedAt,
        });
      }
      if (isPastDueDay(s.dueDate) && s.status !== 'completed') {
        events.push({
          id: s._id + '_overdue',
          type: 'overdue',
          title: `${s.name} missed deadline`,
          sub: projectTitle,
          date: s.dueDate,
        });
      }
    });

    // Submitted events
    submissions.forEach((sub) => {
      const s = subtaskMap[sub.subtask.toString()];
      if (!s) return;
      events.push({
        id: sub._id + '_submitted',
        type: 'submitted',
        title: `Submitted work for ${s.name}${sub.isLate ? ' (late)' : ''}`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: sub.createdAt,
      });
    });

    // Rated events
    ratings.forEach((r) => {
      const s = subtaskMap[r.subtask.toString()];
      if (!s) return;
      events.push({
        id: r._id + '_rated',
        type: 'rated',
        title: `${s.name} was rated ${r.stars}/5`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: r.createdAt,
      });
    });

    // Comment events
    comments.forEach((c) => {
      const s = subtaskMap[c.subtask.toString()];
      if (!s) return;
      events.push({
        id: c._id + '_comment',
        type: 'comment',
        title: `${c.author?.name || 'Manager'} commented on ${s.name}`,
        sub: projectMap[s.project.toString()] || 'Unknown',
        date: c.createdAt,
      });
    });

    // Assigned events from projects
    projects.forEach((p) => {
      events.push({
        id: p._id + '_assigned',
        type: 'assigned',
        title: `Added to ${p.title}`,
        sub: 'Project assigned',
        date: p.createdAt,
      });
    });

    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    const grouped = {};
    events.forEach((ev) => {
      const dateKey = new Date(ev.date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({ id: ev.id, type: ev.type, title: ev.title, sub: ev.sub });
    });

    const timeline = Object.entries(grouped).map(([date, events]) => ({ date, events }));

    res.status(200).json({ message: '✅ Timeline fetched successfully', timeline });
  } catch (error) {
    res.status(500).json({ message: '❌ Failed to fetch timeline', error: error.message });
  }
};


// ─── PDF star rendering ─────────────────────────────────────────────────────
// PDFKit's standard core fonts (Helvetica, Helvetica-Bold, etc.) don't include
// the ★ / ☆ glyphs (U+2605 / U+2606) — they silently substitute a fallback
// character, which is why ratings were showing up as "&&&&&" in the exported
// PDF. Drawing stars as vector polygons instead sidesteps font encoding
// entirely, so they render identically no matter what font is active.
const drawStarShape = (doc, cx, cy, r, color) => {
  const spikes = 5;
  const step = Math.PI / spikes;
  const rot = -Math.PI / 2; // point straight up
  const points = [];

  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : r / 2.5;
    const angle = rot + i * step;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }

  doc.polygon(...points).fill(color);
};

const drawStars = (doc, x, y, rating, size = 7) => {
  const filledColor = '#f59e0b';
  const emptyColor = '#e2e8f0';
  const spacing = size * 2.4;

  for (let i = 0; i < 5; i++) {
    const cx = x + i * spacing + size;
    const cy = y + size;
    const filled = i < Math.round(rating || 0);
    drawStarShape(doc, cx, cy, size, filled ? filledColor : emptyColor);
  }
};

// =============================================================================
// @desc    Generate and stream a PDF timeline report for the employee
// @route   GET /api/employee/timeline/report
// @access  Employee only
// =============================================================================
exports.downloadTimelineReport = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: '❌ User not found' });

    // ── Fetch all projects ──
    const projects = await Project.find({
      assignedEmployees: currentUser._id,
      isDeleted: false,
    })
      .populate('assignedManagers', 'name')
      .sort({ createdAt: -1 });

    const projectIds = projects.map((p) => p._id);

    // ── Fetch all subtasks ──
    const subtasks = await Subtask.find({
      project: { $in: projectIds },
      isDeleted: false,
    }).sort({ createdAt: 1 });

    const subtaskIds = subtasks.map((s) => s._id);

    // ── Fetch submissions and ratings in parallel ──
    const [submissions, ratings] = await Promise.all([
      SubtaskSubmission.find({ subtask: { $in: subtaskIds }, submittedBy: currentUser._id, isDeleted: false })
        .select('subtask createdAt isLate'),
      Rating.find({ subtask: { $in: subtaskIds }, isArchived: false })
        .select('subtask stars remark'),
    ]);

    // Build lookup maps
    const submissionMap = {};
    submissions.forEach((s) => { submissionMap[s.subtask.toString()] = s; });

    const ratingMap = {};
    ratings.forEach((r) => { ratingMap[r.subtask.toString()] = r; });

    // Group subtasks by project
    const subtasksByProject = {};
    subtasks.forEach((s) => {
      const pid = s.project.toString();
      if (!subtasksByProject[pid]) subtasksByProject[pid] = [];
      subtasksByProject[pid].push(s);
    });

    // ── Build PDF ──
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="BFSI_Report_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`
    );
    doc.pipe(res);

    const BLUE = '#1a73e8';
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const LIGHT = '#94a3b8';
    const GREEN = '#16a34a';
    const RED = '#dc2626';
    const AMBER = '#d97706';
    const PURPLE = '#7c3aed';

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    // ── Cover header ──
    doc.rect(0, 0, 595, 90).fill(BLUE);
    doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold').text('BFSI Edge', 50, 28);
    doc.fillColor('#ffffff99').fontSize(11).font('Helvetica').text('Employee Activity Report', 50, 56);
    doc.fillColor('#fff').fontSize(11).text(`Generated: ${fmt(new Date())}`, 350, 56, { align: 'right', width: 195 });

    // ── Employee info block ──
    doc.rect(50, 108, 495, 72).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text(currentUser.name, 64, 118);
    doc.fillColor(GRAY).fontSize(10).font('Helvetica')
      .text(`Email: ${currentUser.email}`, 64, 134)
      .text(`Department: ${currentUser.department || 'N/A'}`, 64, 148)
      .text(`Role: Employee`, 64, 162);
    doc.fillColor(GRAY).fontSize(10)
      .text(`Total Projects: ${projects.length}`, 350, 134)
      .text(`Total Tasks: ${subtasks.length}`, 350, 148)
      .text(`Completed: ${subtasks.filter(s => s.isCompleted).length}`, 350, 162);

    let y = 200;

    const checkPage = (needed = 80) => {
      if (y + needed > 780) { doc.addPage(); y = 50; }
    };

    // ── Per-project sections ──
    projects.forEach((p, pi) => {
      const pTasks = subtasksByProject[p._id.toString()] || [];

      checkPage(60);

      // Project header bar
      doc.rect(50, y, 495, 28).fill('#0f172a');
      doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold')
        .text(`${pi + 1}. ${p.title}`, 60, y + 8, { width: 300 });
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
        .text(`${fmt(p.startDate)} – ${fmt(p.endDate)}`, 370, y + 10, { width: 165, align: 'right' });

      y += 32;

      // Project meta row
      const managerNames = p.assignedManagers?.map((m) => m.name).join(', ') || '—';
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
        .text(`Manager: ${managerNames}`, 60, y)
        .text(`Status: ${p.status?.replace('_', ' ') || '—'}`, 300, y);
      y += 18;

      if (pTasks.length === 0) {
        doc.fillColor(LIGHT).fontSize(9).text('No tasks assigned.', 60, y);
        y += 20;
      } else {
        // Task table header
        checkPage(24);
        doc.rect(50, y, 495, 18).fill('#f1f5f9');
        doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
          .text('TASK', 58, y + 5)
          .text('ASSIGNED', 210, y + 5)
          .text('DUE', 275, y + 5)
          .text('STATUS', 330, y + 5)
          .text('SUBMITTED', 390, y + 5)
          .text('RATING', 460, y + 5);
        y += 20;

        pTasks.forEach((t, ti) => {
          checkPage(36);

          const sub = submissionMap[t._id.toString()];
          const rat = ratingMap[t._id.toString()];

          const statusColor = {
            completed: GREEN,
            in_progress: BLUE,
            pending: AMBER,
            overdue: RED,
          }[t.status] || GRAY;

          // Alternating row bg
          if (ti % 2 === 0) doc.rect(50, y, 495, 32).fill('#fafafa');

          doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
            .text(t.name, 58, y + 4, { width: 148, ellipsis: true });
          doc.fillColor(GRAY).fontSize(8).font('Helvetica')
            .text(t.description ? t.description.slice(0, 30) + (t.description.length > 30 ? '…' : '') : '', 58, y + 16, { width: 148 });

          doc.fillColor(GRAY).fontSize(8)
            .text(fmt(t.startDate), 210, y + 10)
            .text(fmt(t.dueDate), 275, y + 10);

          doc.fillColor(statusColor).fontSize(8).font('Helvetica-Bold')
            .text(t.status?.replace('_', ' ').toUpperCase() || '—', 330, y + 10, { width: 55 });

          doc.fillColor(sub ? (sub.isLate ? AMBER : GREEN) : LIGHT).fontSize(8).font('Helvetica')
            .text(sub ? fmt(sub.createdAt) : '—', 390, y + 10, { width: 65 });

          if (rat) {
            // Vector-drawn stars — see drawStars() above. Replaces the old
            // '★'.repeat(...) text approach that rendered as "&&&&&" because
            // Helvetica-Bold has no glyph for U+2605/U+2606.
            drawStars(doc, 460, y + 3, rat.stars, 6);
            doc.fillColor(GRAY).fontSize(7).font('Helvetica')
              .text(`${rat.stars}/5${rat.remark ? ' · ' + rat.remark.slice(0, 18) : ''}`, 460, y + 17, { width: 75 });
          } else {
            doc.fillColor(LIGHT).fontSize(8).text('—', 460, y + 10);
          }

          y += 34;
        });
      }

      y += 14; // gap between projects
    });

    // ── Footer ──
    checkPage(30);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    doc.fillColor(LIGHT).fontSize(8).font('Helvetica')
      .text('This report was self-generated by the employee via BFSI Edge. For HR submission only.', 50, y + 8, { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('downloadTimelineReport error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: '❌ Failed to generate report', error: err.message });
    }
  }
};
// ─── Helper ───────────────────────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
