const Submission = require('../models/Submission');

// Employee creates a new submission (like Google Classroom "Add work")
const createSubmission = async (req, res) => {
  try {
    const { taskId, description, fileUrls } = req.body;

    // Find if any previous submissions exist for this task by this employee
    const previousSubmissions = await Submission.find({
      task: taskId,
      employee: req.user.id
    });

    // Version number = how many submissions already exist + 1
    const versionNumber = previousSubmissions.length + 1;

    const submission = await Submission.create({
      task: taskId,
      employee: req.user.id,
      versionNumber,
      description,
      fileUrls: fileUrls || [],
      status: 'draft'
    });

    res.status(201).json({
      message: '✅ Submission created successfully',
      submission
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to create submission',
      error: error.message
    });
  }
};

// Employee clicks "Mark as Done" — like Google Classroom
const markAsDone = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        message: '❌ Submission not found — check the submission ID'
      });
    }

    // Only the employee who created it can mark it as done
    if (submission.employee.toString() !== req.user.id) {
      return res.status(403).json({
        message: '❌ You are not allowed to mark this submission as done'
      });
    }

    // Already submitted check
    if (submission.status === 'submitted') {
      return res.status(400).json({
        message: '❌ Already marked as done — waiting for manager review'
      });
    }

    submission.status = 'submitted';
    await submission.save();

    res.status(200).json({
      message: '✅ Marked as done — manager will be notified',
      submission
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to mark as done',
      error: error.message
    });
  }
};

// Get all submissions for a task (manager sees all versions)
const getSubmissionsByTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const submissions = await Submission.find({ task: taskId })
      .populate('employee', 'name email')
      .sort({ versionNumber: 1 });

    if (submissions.length === 0) {
      return res.status(404).json({
        message: '❌ No submissions found for this task'
      });
    }

    res.status(200).json({
      message: '✅ Submissions fetched successfully',
      submissions
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to fetch submissions',
      error: error.message
    });
  }
};

module.exports = { createSubmission, markAsDone, getSubmissionsByTask };