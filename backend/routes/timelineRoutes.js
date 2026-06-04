const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const { getGlobalTimeline } = require("../controllers/timelineController");

// ── Global timeline (HR Admin only) ───────────────────────────────────────────
router.get("/", auth, getGlobalTimeline);

module.exports = router;