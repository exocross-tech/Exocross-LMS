const express = require("express");
const router = express.Router();

const {
  createClassSchedule,
  getUpcomingClasses,
  getLiveClasses,
  updateClassSchedule,
  getTutorBatches,
  getCalendarSchedule,
} = require("../controllers/classScheduleController");

router.post("/create", createClassSchedule);
router.get("/upcoming", getUpcomingClasses);
router.get(
  "/live/upcoming", getLiveClasses
);
router.get("/calendar", getCalendarSchedule);
router.put("/update/:id", updateClassSchedule);
router.post("/update", updateClassSchedule);
router.get("/tutor/:userId/batches", getTutorBatches);

module.exports = router;