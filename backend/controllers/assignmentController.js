const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const {
  addedToProjectEmail,
  removedFromProjectEmail,
  managerAddedEmail,
  managerRemovedEmail,
} = require("../config/emailTemplates");

// ─── Helper: fetch project with access check ──────────────────────────────────
const getEditableProject = async (projectId, user) => {
  const filter = { _id: projectId, isDeleted: false };
  if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  return Project.findOne(filter);
};

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Add employees to a project
// @route   POST /api/projects/:id/employees
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.addEmployees = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { employeeIds } = req.body;

    if (!employeeIds?.length) {
      return res.status(400).json({ message: "employeeIds array is required" });
    }

    const project = await getEditableProject(req.params.id, currentUser);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Validate all provided IDs are active employees
    const employees = await User.find({
      _id: { $in: employeeIds },
      role: "employee",
    });

    if (employees.length !== employeeIds.length) {
      return res.status(400).json({
        message: "One or more IDs are not valid active employees",
      });
    }

    // Filter out employees already assigned
    const alreadyAssigned = project.assignedEmployees.map((id) => id.toString());
    const newEmployees = employees.filter(
      (emp) => !alreadyAssigned.includes(emp._id.toString())
    );

    if (!newEmployees.length) {
      return res.status(400).json({ message: "All provided employees are already assigned" });
    }

    project.assignedEmployees.push(...newEmployees.map((e) => e._id));
    await project.save();

    // ── Timeline events first, independently — so a notification failure
    // can never silently swallow a missing timeline entry ─────────────────────
    await Promise.all(
      newEmployees.map((emp) =>
        createTimelineEvent({
          project: project._id,
          actor: currentUser._id,
          eventType: "employee_added",
          description: `${currentUser.name} added ${emp.name} to project "${project.title}"`,
          metadata: { employeeId: emp._id, employeeName: emp.name },
        })
      )
    );

    // ── Notifications to each newly added employee — createNotification auto-CCs HR ─
    const notifPromises = newEmployees.map((emp) =>
      createNotification({
        recipient: emp._id,
        project: project._id,
        eventType: "employee_added",
        message: `You have been added to project "${project.title}". Starts ${new Date(project.startDate).toDateString()}, ends ${new Date(project.endDate).toDateString()}.`,
        hrMessage: `${currentUser.name} added ${emp.name} to project "${project.title}".`,
        metadata: { projectId: project._id, employeeId: emp._id, employeeName: emp.name },
      })
    );
    await Promise.all(notifPromises);

    // ── Notify the project's assigned managers ─────────────────────────────────
    const employeeNames = newEmployees.map((e) => e.name).join(", ");
    const managerNotifPromises = project.assignedManagers.map((mgrId) =>
      createNotification({
        recipient: mgrId,
        project: project._id,
        eventType: "employee_added",
        message: `${newEmployees.length} employee(s) added to project "${project.title}": ${employeeNames}.`,
        hrMessage: `${currentUser.name} added ${employeeNames} to project "${project.title}".`,
        metadata: {
          projectId: project._id,
          employeeIds: newEmployees.map((e) => e._id),
          employeeNames,
          actorId: currentUser._id,
        },
      })
    );
    await Promise.all(managerNotifPromises);

    // ── Emails to each newly added employee (fire-and-forget) ─────────────────
    newEmployees.forEach((emp) => {
      const { subject, html } = addedToProjectEmail(
        emp.name,
        project.title,
        project.startDate,
        project.endDate
      );
      transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
    });

    const populated = await Project.findById(project._id).populate(
      "assignedEmployees",
      "name email department"
    );

    return res.status(200).json({
      message: `${newEmployees.length} employee(s) added`,
      assignedEmployees: populated.assignedEmployees,
    });
  } catch (err) {
    console.error("addEmployees error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Remove an employee from a project
// @route   DELETE /api/projects/:id/employees/:userId
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.removeEmployee = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const project = await getEditableProject(req.params.id, currentUser);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const employeeId = req.params.userId;
    const wasAssigned = project.assignedEmployees
      .map((id) => id.toString())
      .includes(employeeId);

    if (!wasAssigned) {
      return res.status(400).json({ message: "Employee is not assigned to this project" });
    }

    project.assignedEmployees = project.assignedEmployees.filter(
      (id) => id.toString() !== employeeId
    );
    await project.save();

    const employee = await User.findById(employeeId).select("name email");

    // ── Timeline event first, independently ───────────────────────────────────
    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "employee_removed",
      description: `${currentUser.name} removed ${employee?.name || "an employee"} from project "${project.title}"`,
      metadata: { employeeId },
    });

    // ── Notification to removed employee — HR auto-CC'd inside createNotification ─
    await createNotification({
      recipient: employeeId,
      project: project._id,
      eventType: "employee_removed",
      message: `You have been removed from project "${project.title}".`,
      hrMessage: `${currentUser.name} removed ${employee?.name || "an employee"} from project "${project.title}".`,
      metadata: { projectId: project._id, employeeId, actorId: currentUser._id },
    });

    // ── Notify the project's assigned managers ─────────────────────────────────
    const managerNotifPromises = project.assignedManagers.map((mgrId) =>
      createNotification({
        recipient: mgrId,
        project: project._id,
        eventType: "employee_removed",
        message: `${employee?.name || "An employee"} was removed from project "${project.title}".`,
        hrMessage: `${currentUser.name} removed ${employee?.name || "an employee"} from project "${project.title}".`,
        metadata: { projectId: project._id, employeeId, actorId: currentUser._id },
      })
    );
    await Promise.all(managerNotifPromises);

    // ── Email the removed employee (fire-and-forget) ──────────────────────────
    if (employee?.email) {
      const { subject, html } = removedFromProjectEmail(employee.name, project.title);
      transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: employee.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${employee.email}:`, err.message));
    }

    return res.status(200).json({ message: "Employee removed from project" });
  } catch (err) {
    console.error("removeEmployee error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// addManagers and removeManager are unchanged

// =============================================================================
// @desc    Add managers to a project
// @route   POST /api/projects/:id/managers
// @access  HR Admin only
// =============================================================================

exports.addManagers = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    // Belt-and-suspenders guard in case middleware is misconfigured
    if (currentUser.role === "manager") {
      return res.status(403).json({ message: "Managers cannot assign other managers" });
    }

    const { managerIds } = req.body;

    if (!managerIds?.length) {
      return res.status(400).json({ message: "managerIds array is required" });
    }

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const managers = await User.find({
      _id: { $in: managerIds },
      role: { $in: ["manager", "hr_admin"] },
    });

    if (managers.length !== managerIds.length) {
      return res.status(400).json({
        message: "One or more IDs are not valid active managers",
      });
    }

    const alreadyAssigned = project.assignedManagers.map((id) => id.toString());
    const newManagers = managers.filter(
      (m) => !alreadyAssigned.includes(m._id.toString())
    );

    if (!newManagers.length) {
      return res.status(400).json({ message: "All provided managers are already assigned" });
    }

    project.assignedManagers.push(...newManagers.map((m) => m._id));
    await project.save();

    // ── Timeline events first, independently ──────────────────────────────────
    await Promise.all(
      newManagers.map((mgr) =>
        createTimelineEvent({
          project: project._id,
          actor: currentUser._id,
          eventType: "manager_added",
          description: `${currentUser.name} added ${mgr.name} as manager of "${project.title}"`,
          metadata: { managerId: mgr._id, managerName: mgr.name },
        })
      )
    );

    // ── Notifications — createNotification auto-CCs HR, no manual loop needed ─
    const notifPromises = newManagers.map((mgr) =>
      createNotification({
        recipient: mgr._id,
        project: project._id,
        eventType: "manager_added",
        message: `You have been assigned as manager of project "${project.title}".`,
        hrMessage: `${currentUser.name} added ${mgr.name} as manager of project "${project.title}".`,
        metadata: { projectId: project._id, managerId: mgr._id, managerName: mgr.name },
      })
    );
    await Promise.all(notifPromises);

    // ── Emails to each newly added manager (fire-and-forget) ──────────────────
    newManagers.forEach((mgr) => {
      const { subject, html } = managerAddedEmail(
        mgr.name,
        project.title,
        project.startDate,
        project.endDate
      );
      transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: mgr.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${mgr.email}:`, err.message));
    });

    const populated = await Project.findById(project._id).populate(
      "assignedManagers",
      "name email"
    );

    return res.status(200).json({
      message: `${newManagers.length} manager(s) added`,
      assignedManagers: populated.assignedManagers,
    });
  } catch (err) {
    console.error("addManagers error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Remove a manager from a project
// @route   DELETE /api/projects/:id/managers/:userId
// @access  HR Admin only
// =============================================================================

exports.removeManager = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    // Belt-and-suspenders guard in case middleware is misconfigured
    if (currentUser.role === "manager") {
      return res.status(403).json({ message: "Managers cannot remove other managers" });
    }

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const managerId = req.params.userId;
    const wasAssigned = project.assignedManagers
      .map((id) => id.toString())
      .includes(managerId);

    if (!wasAssigned) {
      return res.status(400).json({ message: "Manager is not assigned to this project" });
    }

    if (project.assignedManagers.length === 1) {
      return res.status(400).json({
        message: "Cannot remove the only manager. Assign another manager first.",
      });
    }

    project.assignedManagers = project.assignedManagers.filter(
      (id) => id.toString() !== managerId
    );
    await project.save();

    const manager = await User.findById(managerId).select("name email");

    // ── Timeline event first, independently ───────────────────────────────────
    await createTimelineEvent({
      project: project._id,
      actor: currentUser._id,
      eventType: "manager_removed",
      description: `${currentUser.name} removed ${manager?.name || "a manager"} from project "${project.title}"`,
      metadata: { managerId },
    });

    // ── Notification to removed manager — HR auto-CC'd inside createNotification ─
    await createNotification({
      recipient: managerId,
      project: project._id,
      eventType: "manager_removed",
      message: `You have been removed as manager of project "${project.title}".`,
      hrMessage: `${currentUser.name} removed ${manager?.name || "a manager"} as manager of project "${project.title}".`,
      metadata: { projectId: project._id, managerId, actorId: currentUser._id },
    });

    // ── Email the removed manager (fire-and-forget) ───────────────────────────
    if (manager?.email) {
      const { subject, html } = managerRemovedEmail(manager.name, project.title);
      transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: manager.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${manager.email}:`, err.message));
    }

    return res.status(200).json({ message: "Manager removed from project" });
  } catch (err) {
    console.error("removeManager error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
