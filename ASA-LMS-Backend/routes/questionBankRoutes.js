const express = require("express");
const router = express.Router();
const questionsController = require("../controllers/QuestionBankController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer storage configuration
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//       const dir = path.join(__dirname, '../../techno_images'); // adjust path
//       if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//       cb(null, dir);
//     },
//     filename: function (req, file, cb) {
//       const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
//       cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     },
//   });

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create
router.post("/createQuestion", questionsController.createQuestion);

// Read all
router.post("/getQuestions", questionsController.getQuestions);

// Update
router.put("/updateQuestion/:id", questionsController.updateQuestion);

// Delete
router.delete("/deleteQuestion", questionsController.deleteQuestion);

// Update Status
router.post("/updateQuestionStatus", questionsController.updateQuestionStatus);

// Upload Image
router.post("/uploadImage", questionsController.uploadImage);

//delete image
router.post("/deleteCkeditorImage", questionsController.deleteCkeditorImage);

// Delete Bulk Question
router.post("/deleteBulkQuestion", questionsController.deleteBulkQuestion);

module.exports = router;
