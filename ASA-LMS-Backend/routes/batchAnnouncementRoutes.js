const express = require("express");
const router = express.Router();

const {
  getBatches,
  createAnnouncement,
  getAnnouncements,
} = require("../controllers/batchAnnouncementController");

router.get("/batches", getBatches);
router.post("/send", createAnnouncement);
router.get("/recent", getAnnouncements);

module.exports = router;                