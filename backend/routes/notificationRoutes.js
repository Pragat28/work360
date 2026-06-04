const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

// ── Notifications ─────────────────────────────────────────────────────────────
router.get("/", auth, getNotifications);
router.patch("/read-all", auth, markAllAsRead);  // must be before /:id/read
router.patch("/:id/read", auth, markAsRead);

module.exports = router;