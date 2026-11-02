const express = require("express");

const router = express.Router();

const upload =
  require("../middleware/uploadCourseMaterial");

const {
  uploadCourseMaterial,
  getCourseMaterials,
  getCourseMaterialById,
  getStudentCourseMaterials,
  updateCourseMaterial,
  deleteCourseMaterialFile,
  deleteCourseMaterial,
  downloadCourseMaterialZip,
} = require("../controllers/courseMaterialController");

/* =====================================================
   ADMIN
===================================================== */

// POST - Create
router.post(
  "/",
  upload.array("files", 10),
  uploadCourseMaterial
);

// GET - All
router.get(
  "/",
  getCourseMaterials
);

/* =====================================================
   STUDENT
===================================================== */

// GET student materials (must come before /:id)
router.get(
  "/student",
  getStudentCourseMaterials
);

// DOWNLOAD ZIP
router.get(
  "/:id/download",
  downloadCourseMaterialZip
);

// GET single course material by ID (for Admin & Student)
router.get(
  "/:id",
  getCourseMaterialById
);

// PUT - Update
router.put(
  "/:id",
  upload.array("files", 10),
  updateCourseMaterial
);

// DELETE - Single PDF
router.delete(
  "/:id/file",
  deleteCourseMaterialFile
);

// DELETE - Entire material
router.delete(
  "/:id",
  deleteCourseMaterial
);

module.exports = router;