const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const cron = require("node-cron");
const checkOverdueSubtasks = require("./jobs/overdueChecker");
const subtaskReminder = require("./jobs/reminderCron");
const { startTimelineReportJob } = require('./jobs/timelineReportJob');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
connectDB();

// Schedule the overdue subtask check to run every day at midnight
cron.schedule("0 * * * *", checkOverdueSubtasks);
cron.schedule("0 8 * * *", subtaskReminder); // Run reminder job daily at 08:00
startTimelineReportJob();

const { subtaskRouter, submissionRouter } = require('./routes/submissionRoutes');

// Routes
const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

app.use('/api/auth', authRoutes);

app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/subtasks", require("./routes/subtaskRoutes"));

app.use('/api/employee', require('./routes/employee/index'));

// add this — nests under subtask routes with mergeParams
app.use('/api/subtasks/:id/submissions', subtaskRouter);

app.use("/api/comments", require("./routes/commentRoutes"));
app.use("/api/timeline", require("./routes/timelineRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));   // ← add this line

// Test route
app.get('/', (req, res) => {
  res.send('WorkFlow360 backend is running!');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unexpected error:', err);

  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
