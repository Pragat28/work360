const Submission = require('../models/Submission');
const Rating = require('../models/Rating');

// Manager reviews a submission — Accept, Reject, or Request Changes
const reviewSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { status, managerRemark } = req.body;

    // Check if status is valid
    const allowedStatuses = ['accepted', 'rejected', 'changes_requested'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: '❌ Invalid status — must be accepted, rejected, or changes_requested'
      });
    }

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        message: '❌ Submission not found — check the submission ID'
      });
    }

    // Only submitted work can be reviewed
    if (submission.status !== 'submitted') {
      return res.status(400).json({
        message: '❌ Cannot review — employee has not marked this as done yet'
      });
    }

    submission.status = status;
    submission.managerRemark = managerRemark || '';
    await submission.save();

    res.status(200).json({
      message: `✅ Submission ${status} successfully`,
      submission
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to review submission',
      error: error.message
    });
  }
};

// Manager rates a submission after accepting it
const rateSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { quality, timeliness, communication } = req.body;

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        message: '❌ Submission not found — check the submission ID'
      });
    }

    // Can only rate accepted submissions
    if (submission.status !== 'accepted') {
      return res.status(400).json({
        message: '❌ Cannot rate — submission must be accepted first'
      });
    }

    // Check if already rated
    const existingRating = await Rating.findOne({ submission: submissionId });
    if (existingRating) {
      return res.status(400).json({
        message: '❌ Already rated this submission'
      });
    }

    // Validate rating values
    if (!quality || !timeliness || !communication) {
      return res.status(400).json({
        message: '❌ All three ratings are required — quality, timeliness, communication'
      });
    }

    if (
      quality < 1 || quality > 5 ||
      timeliness < 1 || timeliness > 5 ||
      communication < 1 || communication > 5
    ) {
      return res.status(400).json({
        message: '❌ Each rating must be between 1 and 5'
      });
    }

    const rating = await Rating.create({
      submission: submissionId,
      employee: submission.employee,
      ratedBy: req.user.id,
      quality,
      timeliness,
      communication
    });

    res.status(201).json({
      message: '✅ Rating submitted successfully',
      rating
    });

  } catch (error) {
    res.status(500).json({
      message: '❌ Failed to submit rating',
      error: error.message
    });
  }
};

module.exports = { reviewSubmission, rateSubmission };