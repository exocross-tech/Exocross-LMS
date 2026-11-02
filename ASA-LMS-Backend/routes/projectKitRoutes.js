const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadProjectKit");

const {
  getProjectKits,
  getAvailableProjectKits,
  getProjectKitById,
  createProjectKit,
  updateProjectKit,
  deleteProjectKit,
} = require("../controllers/projectKitController");

// GET all project kits
router.get("/", getProjectKits);

// GET available (unassigned) project kits for Tutor
router.get("/available", getAvailableProjectKits);

// GET single project kit by ID
router.get("/:id", getProjectKitById);

// POST create project kit
router.post("/", upload.single("image"), createProjectKit);

// PUT update project kit
router.put("/:id", upload.single("image"), updateProjectKit);

// DELETE project kit
router.delete("/:id", deleteProjectKit);

module.exports = router;
