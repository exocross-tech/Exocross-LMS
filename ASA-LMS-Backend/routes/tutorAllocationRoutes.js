const express = require("express");
const router = express.Router();
const {
  getTutorAllocation,
  getActiveBatches,
  assignBatch,
  updateTutorRole,
  deleteTutorAllocation,
} = require("../controllers/tutorAllocationController");
router.get("/getTutorAllocation", getTutorAllocation);
router.get("/getActiveBatches", getActiveBatches);
router.post("/assignBatch", assignBatch);
router.put(
  "/updateTutorRole",
  updateTutorRole
);
router.delete("/deleteTutorAllocation/:id?", deleteTutorAllocation);
router.delete("/:id?", deleteTutorAllocation);
router.post("/deleteTutorAllocation", deleteTutorAllocation);
module.exports = router;

