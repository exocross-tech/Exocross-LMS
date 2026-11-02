const express = require("express");
const router = express.Router();

const {
  getInitialAttendanceData,
  submitAttendance,
  getStudentAttendance,
  getBatchAttendanceByDate,
} = require("../controllers/attendanceController");

router.get("/initial-data", getInitialAttendanceData);
router.get("/batch-date-attendance", getBatchAttendanceByDate);
router.post("/submit", submitAttendance);
router.get("/get-student-attendance/:userId", getStudentAttendance);
router.get("/student/:userId", getStudentAttendance);
router.get("/student/:userId/batch/:batchId", getStudentAttendance);

module.exports = router;
