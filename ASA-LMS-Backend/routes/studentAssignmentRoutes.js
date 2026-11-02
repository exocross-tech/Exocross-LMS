const express = require("express");
const uploadStudentProjectKit = require("../middleware/uploadStudentProjectKit");

const {
  getStudentAssignments,
  getAssignmentExam,
  savePracticeExamAttempt,
  getStudentAssessmentResults,
} = require("../controllers/studentAssignmentController");

const router = express.Router();

router.post(
  "/save-attempt",
  uploadStudentProjectKit.single("projectKitImage"),
  savePracticeExamAttempt
);

router.get("/student/:userId", getStudentAssignments);
router.get(
  "/practice-exam/assignment-exam",
  getAssignmentExam
);
router.get("/results/:userId", getStudentAssessmentResults);
router.get("/assessment-results/:userId", getStudentAssessmentResults);

module.exports = router;
