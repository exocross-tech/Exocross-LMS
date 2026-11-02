const express = require("express");
const {
  getTutorBatches,
  getTheoryTemplatesList,
  getPracticalKitsList,
  assignFinalAssessment,
  createTheoryAssessment,
  getTutorTheoryAssessments,
  getTheoryAssessmentById,
  updateTheoryAssessment,
  updateTheoryAssessmentStatus,
  deleteTheoryAssessment,
  createPracticalAssessment,
  getTutorPracticalAssessments,
  updatePracticalAssessment,
  updatePracticalAssessmentStatus,
  deletePracticalAssessment,
  getAllFinalAssessments,
  getStudentAssignedFinalAssessment,
  uploadFinalAssessmentFiles,
  submitFinalAssessmentProject,
  getTutorBatchSubmissions,
  getSubmissionPreview,
  submitEvaluation,
  getStudentCertificate,
  getPublishStudents,
  publishCertificates,
} = require("../controllers/finalAssessmentController");

const router = express.Router();

// =====================================================
// BATCHES, TEMPLATES & PROJECT KITS
// =====================================================
router.get("/tutor/:userId/batches", getTutorBatches);
router.get("/theory-templates", getTheoryTemplatesList);
router.get("/practical-kits", getPracticalKitsList);
router.post("/assign", assignFinalAssessment);

// =====================================================
// THEORY (FINAL_ASSESSMENT in QUESTION_TEMPLATES)
// =====================================================
router.post("/theory/create", createTheoryAssessment);
router.get("/theory/tutor/:userId", getTutorTheoryAssessments);
router.put("/theory/status", updateTheoryAssessmentStatus);
router.get("/theory/:id", getTheoryAssessmentById);
router.put("/theory/:id", updateTheoryAssessment);
router.delete("/theory/:id", deleteTheoryAssessment);

// =====================================================
// PRACTICAL (FINAL_ASSESSMENTS)
// =====================================================
router.post("/practical/create", createPracticalAssessment);
router.get("/practical/tutor/:userId", getTutorPracticalAssessments);
router.put("/practical/status", updatePracticalAssessmentStatus);
router.put("/practical/:id", updatePracticalAssessment);
router.delete("/practical/:id", deletePracticalAssessment);

// =====================================================
// UNIFIED ALL LIST (FOR MAIN FINAL ASSESSMENT PAGE)
// =====================================================
router.get("/all/tutor/:userId", getAllFinalAssessments);

// =====================================================
// STUDENT: FINAL ASSESSMENT & SUBMISSION
// =====================================================
router.get("/student/:studentId", getStudentAssignedFinalAssessment);
router.post(
  "/submission",
  uploadFinalAssessmentFiles,
  submitFinalAssessmentProject
);
router.get("/student/:studentId/certificate", getStudentCertificate);
router.get("/certificate/:studentId", getStudentCertificate);

// =====================================================
// TUTOR: ASSESSMENT EVALUATION & PUBLISH CERTIFICATES
// =====================================================
router.get("/evaluation/batch/:batchId", getTutorBatchSubmissions);
router.get("/evaluation/submission/:submissionId", getSubmissionPreview);
router.post("/evaluation/submit", submitEvaluation);
router.get("/publish-students/:batchId", getPublishStudents);
router.post("/publish-certificates", publishCertificates);

module.exports = router;

