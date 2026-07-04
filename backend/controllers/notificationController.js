const Notification = require("../models/Notification");
const User = require("../models/User");

// ─── Helper: fetch full user from decoded JWT ─────────────────────────────────
const getFullUser = async (decoded) => {
  return User.findById(decoded.id).select("-password");
};

// =============================================================================
// @desc    Get all notifications for the logged-in user
// @route   GET /api/notifications
// @access  All roles
// =============================================================================

exports.getNotifications = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { unreadOnly, project, eventType, limit = 30, page = 1 } = req.query;

    const filter = { recipient: currentUser._id };
    if (unreadOnly === "true") filter.isRead = false;
    if (project && project !== "all") filter.project = project;
    if (eventType && eventType !== "all") filter.eventType = eventType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount, projectRows] = await Promise.all([
      Notification.find(filter)
        .populate("project", "title")
        .populate("subtask", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: currentUser._id, isRead: false }),
      // All of this user's project-linked notifications — used to build the
      // project dropdown with accurate unread dots, independent of the
      // current page/filters above.
      Notification.find({ recipient: currentUser._id, project: { $ne: null } })
        .select("project isRead")
        .populate("project", "title"),
    ]);

    const projectMap = new Map();
    for (const row of projectRows) {
      if (!row.project) continue;
      const key = row.project._id.toString();
      if (!projectMap.has(key)) {
        projectMap.set(key, { _id: key, title: row.project.title, total: 0, unread: 0 });
      }
      const entry = projectMap.get(key);
      entry.total += 1;
      if (!row.isRead) entry.unread += 1;
    }
    const projectsSummary = Array.from(projectMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    return res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
      projectsSummary,
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  All roles (own notifications only)
// =============================================================================

exports.markAsRead = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: currentUser._id, // ensure users can only mark their own
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.isRead) {
      return res.status(200).json({ message: "Already marked as read", notification });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({ message: "Marked as read", notification });
  } catch (err) {
    console.error("markAsRead error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  All roles
// =============================================================================

exports.markAllAsRead = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const result = await Notification.updateMany(
      { recipient: currentUser._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      message: "All notifications marked as read",
      updated: result.modifiedCount,
    });
  } catch (err) {
    console.error("markAllAsRead error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =============================================================================
// @desc    Get notification stats for the logged-in user
// @route   GET /api/notifications/stats
// @access  All roles
// =============================================================================

exports.getNotificationStats = async (req, res) => {
  try {
    const currentUser = await getFullUser(req.user);
    if (!currentUser) return res.status(401).json({ message: "User not found" });

    const { project } = req.query;

    const filter = { recipient: currentUser._id };
    if (project && project !== "all") filter.project = project;

    const [total, unread, overdue, ratings] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
      Notification.countDocuments({ ...filter, eventType: "subtask_overdue" }),
      Notification.countDocuments({ ...filter, eventType: "rating_submitted" }),
    ]);

    return res.status(200).json({ total, unread, overdue, ratings });
  } catch (err) {
    console.error("getNotificationStats error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
