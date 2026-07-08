const Rating = require("../models/Rating");
const Subtask = require("../models/Subtask");
const Project = require("../models/Project");
const User = require("../models/User");
const { createNotification, createTimelineEvent } = require("../utils/notifications");
const transporter = require("../config/emailConfig");
const { ratingSubmittedEmail } = require("../config/emailTemplates");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// ─── Helper: verify manager/admin can access this project ────────────────────
const getEditableProject = async (projectId, user) => {
  const filter = { _id: projectId, isDeleted: false };
  if (user.role === "manager") {
    filter.assignedManagers = user._id;
  }
  return Project.findOne(filter);
};

// =============================================================================
// @desc    Submit a rating for a completed subtask (shared across all assignees)
// @route   POST /api/subtasks/:id/rating
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.submitRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { stars, remark } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ message: "stars must be a number between 1 and 5" });
    }

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    if (subtask.status !== "completed" && !subtask.isCompleted) {
      return res.status(400).json({
        message: "Subtask must be completed before it can be rated",
      });
    }

    const existing = await Rating.findOne({ subtask: subtask._id });
    if (existing) {
      return res.status(400).json({
        message: "This subtask has already been rated. Use PATCH to update it.",
      });
    }

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to rate this subtask" });
    }

    if (!subtask.assignedTo || subtask.assignedTo.length === 0) {
      return res.status(400).json({
        message: "Cannot determine which employees were assigned to this subtask",
      });
    }

    const rating = await Rating.create({
      subtask: subtask._id,
      project: project._id,
      employees: subtask.assignedTo,
      ratedBy: currentUser._id,
      ratedByRole: currentUser.role,
      stars: parseInt(stars),
      remark: remark?.trim() || "",
    });

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "rating_submitted",
      description: `${currentUser.name} rated "${subtask.name}" ${stars}/5`,
      metadata: { stars, remark: remark || "" },
    });

    // Fetch employees to get their emails
    const employees = await User.find({
      _id: { $in: subtask.assignedTo },
    }).select("name email");

    // NOTE: createNotification auto-CCs all HR admins on every call —
    // do not add a manual HR notify loop here, it will double-notify HR.
    // message is first-person ("Your team's work...") for the employee;
    // hrMessage gives HR a third-person, named version instead.
    const notifPromises = employees.map((emp) =>
      createNotification({
        recipient: emp._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "rating_submitted",
        message: `Your team's work on "${subtask.name}" has been rated ${stars}/5 by ${currentUser.name}.${remark ? ` Remarks: "${remark}"` : ""}`,
        hrMessage: `${currentUser.name} rated ${emp.name}'s work on "${subtask.name}" in project "${project.title}" ${stars}/5.${remark ? ` Remarks: "${remark}"` : ""}`,
        metadata: {
          stars,
          remark: remark || "",
          ratedByName: currentUser.name,
          subtaskName: subtask.name,
        },
      })
    );
    await Promise.all(notifPromises);

    // ── Notify project managers too — createNotification only auto-CCs HR,
    // not managers, so without this loop managers never hear about ratings
    // they didn't personally submit (e.g. HR rated it, or a co-manager did).
    const populatedProject = await Project.findById(project._id).populate("assignedManagers", "name email");
    const managersToNotify = populatedProject.assignedManagers.filter(
      (mgr) => mgr._id.toString() !== currentUser._id.toString()
    );

    const managerNotifPromises = managersToNotify.map((mgr) =>
      createNotification({
        recipient: mgr._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "rating_submitted",
        message: `${currentUser.name} rated "${subtask.name}" ${stars}/5.${remark ? ` Remarks: "${remark}"` : ""}`,
        metadata: {
          stars,
          remark: remark || "",
          ratedByName: currentUser.name,
          subtaskName: subtask.name,
        },
        sendEmail: false, // email is going to employees only; managers get in-app only
        ccHrAdmins: false, // HR already covered by the employee notification loop above
      })
    );
    await Promise.all(managerNotifPromises);

    employees.forEach((emp) => {
      const { subject, html } = ratingSubmittedEmail(
        emp.name,
        currentUser.name,
        subtask.name,
        parseInt(stars),
        remark?.trim() || ""
      );
      transporter.sendMail({
        from: `"Work360" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
    });

    const populated = await Rating.findById(rating._id)
      .populate("ratedBy", "name")
      .populate("employees", "name");

    return res.status(201).json({ message: "Rating submitted", rating: populated });
  } catch (err) {
    console.error("submitRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Update an existing rating
// @route   PATCH /api/subtasks/:id/rating
// @access  Manager (own projects), HR Admin
// =============================================================================

exports.updateRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { stars, remark } = req.body;

    if (stars !== undefined && (stars < 1 || stars > 5)) {
      return res.status(400).json({ message: "stars must be a number between 1 and 5" });
    }

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const project = await getEditableProject(subtask.project, currentUser);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to update this rating" });
    }

    const rating = await Rating.findOne({
      subtask: subtask._id,
      isArchived: false,
    });
    if (!rating) {
      return res.status(404).json({
        message: "No rating found for this subtask. Use POST to submit one.",
      });
    }

    const previousStars = rating.stars;

    if (stars !== undefined) {
      rating.previousStars = previousStars;
      rating.stars = parseInt(stars);
    }
    if (remark !== undefined) {
      rating.remark = remark.trim();
    }
    rating.updatedCount += 1;

    await rating.save();

    await createTimelineEvent({
      project: project._id,
      subtask: subtask._id,
      actor: currentUser._id,
      eventType: "rating_updated",
      description: `${currentUser.name} updated rating on "${subtask.name}" from ${previousStars}/5 to ${rating.stars}/5`,
      metadata: { previousStars, newStars: rating.stars, remark: remark || "" },
    });

    // Notify every assigned employee on the rating — it's shared
    // Fetch employees to get their emails
    const employees = await User.find({
      _id: { $in: rating.employees },
    }).select("name email");

    // NOTE: createNotification auto-CCs all HR admins on every call —
    // do not add a manual HR notify loop here, it will double-notify HR.
    // message is first-person ("Your team's rating...") for the employee;
    // hrMessage gives HR a third-person, named version instead.
    const notifPromises = employees.map((emp) =>
      createNotification({
        recipient: emp._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "rating_submitted",
        message: `Your team's rating on "${subtask.name}" has been updated to ${rating.stars}/5 by ${currentUser.name}.${rating.remark ? ` Remarks: "${rating.remark}"` : ""}`,
        hrMessage: `${currentUser.name} updated the rating on ${emp.name}'s work for "${subtask.name}" in project "${project.title}" from ${previousStars}/5 to ${rating.stars}/5.`,
        metadata: {
          stars: rating.stars,
          previousStars,
          ratedByName: currentUser.name,
        },
      })
    );
    await Promise.all(notifPromises);

    // ── Notify project managers too — createNotification only auto-CCs HR,
    // not managers, so without this loop managers never hear about rating
    // updates they didn't personally make (e.g. HR updated it, or a
    // co-manager did).
    const populatedProject = await Project.findById(project._id).populate("assignedManagers", "name email");
    const managersToNotify = populatedProject.assignedManagers.filter(
      (mgr) => mgr._id.toString() !== currentUser._id.toString()
    );

    const managerNotifPromises = managersToNotify.map((mgr) =>
      createNotification({
        recipient: mgr._id,
        project: project._id,
        subtask: subtask._id,
        eventType: "rating_submitted",
        message: `${currentUser.name} updated the rating on "${subtask.name}" from ${previousStars}/5 to ${rating.stars}/5.`,
        metadata: {
          stars: rating.stars,
          previousStars,
          ratedByName: currentUser.name,
        },
        sendEmail: false, // email is going to employees only; managers get in-app only
        ccHrAdmins: false, // HR already covered by the employee notification loop above
      })
    );
    await Promise.all(managerNotifPromises);

    employees.forEach((emp) => {
      const { subject, html } = ratingSubmittedEmail(
        emp.name,
        currentUser.name,
        subtask.name,
        rating.stars,
        rating.remark || ""
      );
      transporter.sendMail({
        from: `"BFSI Edge" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject,
        html,
      }).catch((err) => console.error(`Email failed for ${emp.email}:`, err.message));
    });

    const populated = await Rating.findById(rating._id)
      .populate("ratedBy", "name")
      .populate("employees", "name");

    return res.status(200).json({ message: "Rating updated", rating: populated });
  } catch (err) {
    console.error("updateRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get the rating for a subtask
// @route   GET /api/subtasks/:id/rating
// @access  All roles (scoped — must be on the project)
// =============================================================================

exports.getRating = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const subtask = await Subtask.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const scopeFilter = { _id: subtask.project, isDeleted: false };
    if (currentUser.role === "employee") {
      scopeFilter.assignedEmployees = currentUser._id;
    } else if (currentUser.role === "manager") {
      scopeFilter.assignedManagers = currentUser._id;
    }

    const project = await Project.findOne(scopeFilter);
    if (!project) {
      return res.status(403).json({ message: "Not authorised to view this rating" });
    }

    const rating = await Rating.findOne({
      subtask: subtask._id,
      isArchived: false,
    })
      .populate("ratedBy", "name")
      .populate("employees", "name");

    return res.status(200).json({ rating: rating || null });
  } catch (err) {
    console.error("getRating error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
