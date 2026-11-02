const express = require("express");
const router = express.Router();

const {
  getTutors,
  addTutor,
  updateTutor,
  updateTutorStatus,
} = require("../controllers/tutorController");

router.get("/", getTutors);
router.post("/", addTutor);
router.put("/:id", updateTutor);
router.put("/:id/status", updateTutorStatus);

module.exports = router;
