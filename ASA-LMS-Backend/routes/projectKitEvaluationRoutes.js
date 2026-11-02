const express = require("express");
const {
  getTutorBatches,
  getSubmissions,
  getSubmissionPreview,
  submitEvaluation,
} = require("../controllers/projectKitEvaluationController");

const router = express.Router();

router.get("/tutor/:userId/batches", getTutorBatches);
router.get("/submissions", getSubmissions);
router.get("/submission/:submissionId", getSubmissionPreview);
router.post("/evaluate", submitEvaluation);

module.exports = router;

