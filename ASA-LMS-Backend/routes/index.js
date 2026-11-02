const express = require("express");
const router = express.Router();
const loginRoutes = require("./loginRoutes");
const bulkUserRoutes = require("./bulkUserRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const reportsRoutes = require("./reportsRoutes");
const uploadRoutes = require("./uploadRoutes");
const batchesRoutes = require("./batchesRoutes");
const userManagementRoutes = require("./userManagementRoutes");
const notificationRoutes = require("./notificationRoutes");
const tutorRoutes = require("./tutorRoutes");
const tutorAllocationRoutes = require("./tutorAllocationRoutes");
const studentAllocationRoutes = require("./studentAllocationRoutes");
const studentsRoutes = require("./studentsRoutes");
const courseMaterialRoutes = require("./courseMaterialRoutes");
const batchAnnouncementRoutes = require("./batchAnnouncementRoutes");
const chatRoomRoutes = require("./chatRoomRoutes");
const classScheduleRoutes = require("./classScheduleRoutes");
const classDetailsRoutes = require("./classDetailsRoutes");
const sessionReviewRoutes = require("./sessionReviewRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const googleRoutes = require("./googleRoutes");
const googleMeetRoutes = require("./googleMeetRoutes");
const questionsRoutes = require("./questionBankRoutes");
const questionsetsRoutes = require("./QuestionsetsRoutes");
const moduleRoutes = require("./moduleRoutes");
const assignmentAlertRoutes =
  require("./assignmentAlertRoutes");
const studentAssignmentRoutes =
  require("./studentAssignmentRoutes");
const finalAssessmentRoutes =
  require("./finalAssessmentRoutes");
const projectKitRoutes =
  require("./projectKitRoutes");
const projectKitEvaluationRoutes =
  require("./projectKitEvaluationRoutes");
const practiceTestAnalysisRoutes =
  require("./practiceTestAnalysisRoutes");

router.use("/google", googleRoutes);
router.use("/auth/google", googleRoutes);
router.use("/google-meet", googleMeetRoutes);
router.use("/chat-rooms", chatRoomRoutes);
router.use("/tutors", tutorRoutes);
router.use("/course-material", courseMaterialRoutes);
router.use("/tutorAllocation", tutorAllocationRoutes);
router.use("/student-allocation", studentAllocationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/students", studentsRoutes);
router.use("/users", userManagementRoutes);
router.use("/profile", userManagementRoutes);
router.use("/batch-announcements", batchAnnouncementRoutes);
router.use("/login", loginRoutes);
router.use("/bulkUser", bulkUserRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);
router.use("/upload", uploadRoutes);
router.use("/batches", batchesRoutes);
router.use("/class-schedules", classScheduleRoutes);
router.use("/class-details", classDetailsRoutes);
router.use("/session-reviews", sessionReviewRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/questions", questionsRoutes);
router.use("/question", questionsetsRoutes);
router.use("/modules", moduleRoutes);
router.use("/project-kits", projectKitRoutes);
router.use(
  "/assignment-alert",
  assignmentAlertRoutes
);
router.use(
  "/student-assignment",
  studentAssignmentRoutes
);
router.use(
  "/final-assessment",
  finalAssessmentRoutes
);
router.use(
  "/project-kit-evaluation",
  projectKitEvaluationRoutes
);
router.use(
  "/practice-test-analysis",
  practiceTestAnalysisRoutes
);
module.exports = router;
