const express = require("express");

const router = express.Router();

const {
  getStudentClassDetails,
} = require("../controllers/classDetailsController");

router.get(
  "/student/:studentId",
  getStudentClassDetails
);

module.exports = router;