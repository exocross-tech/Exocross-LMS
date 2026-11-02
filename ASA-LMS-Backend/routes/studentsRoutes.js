const express = require("express");
const router = express.Router();
const {
  getAllStudents,
  getAllSchools,
  updateStudentStatus,
} = require("../controllers/studentsController");

router.get("/", getAllStudents);
router.get("/schools", getAllSchools);
router.put("/:id/status", updateStudentStatus);

module.exports = router;