const express = require("express");

const {
  getModulesForAssignment,
  getAvailableProjectKits,
  getTutorBatch,
  createAssignmentAlert,
  getTutorAssignmentAlerts,
} = require("../controllers/assignmentAlertController");

const router = express.Router();

// =========================================================
// GET MODULES + QUESTION SETS + QUESTIONS
// =========================================================
router.get(
  "/modules",
  getModulesForAssignment
);

// =========================================================
// GET AVAILABLE PROJECT KITS (NOT YET ASSIGNED)
// =========================================================
router.get(
  "/available-project-kits",
  getAvailableProjectKits
);

// =========================================================
// GET TUTOR HOST BATCHES
//
// Example:
// GET /api/assignment-alert/tutor/12/batch
//
// Returns batches where tutor 12 has role = 1 (HOST)
// =========================================================
router.get(
  "/tutor/:userId/batch",
  getTutorBatch
);

// =========================================================
// CREATE ASSIGNMENT ALERT
//
// Example:
// POST /api/assignment-alert/create
// =========================================================
router.post(
  "/create",
  createAssignmentAlert
);

// =========================================================
// GET TUTOR ASSIGNMENT ALERTS
//
// Example:
// GET /api/assignment-alert/tutor/12
//
// Returns assignments for batches assigned to tutor 12
// =========================================================
router.get(
  "/tutor/:userId",
  getTutorAssignmentAlerts
);

module.exports = router;
