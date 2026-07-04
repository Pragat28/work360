const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const { getGlobalTimeline, getProjectTimeline, getTimelineStats, getExportData } = require("../controllers/timelineController");

router.get("/stats", auth, getTimelineStats);  // add BEFORE any "/:id" routes, so "stats" isn't swallowed as an :id param
router.get("/export", auth, getExportData);
router.get("/", auth, getGlobalTimeline);

module.exports = router;
