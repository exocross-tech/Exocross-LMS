const express = require("express");
const router = express.Router();

const {
  getTutorBatches,
  getBatchStudents,
  getStudentAssessments,
  sendAssessmentReminder,
} = require("../controllers/practiceTestAnalysisController");

// Tutor batches list (HOST & SUPPORT)
router.get("/batches", getTutorBatches);

// Students of selected batch with assessment stats
router.get("/batch/:batchId/students", getBatchStudents);

// Assigned assessments for student in batch
router.get("/student/:studentId/assessments", getStudentAssessments);

// Send reminder notification for pending assessment
router.post("/send-reminder", sendAssessmentReminder);

module.exports = router;
