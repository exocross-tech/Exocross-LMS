const express = require("express");

const router = express.Router();

const {
  createSessionReview,
  getSessionReviewsByStudent,
  getSessionReviewBatches,
  getStudentsReviews,
} = require("../controllers/sessionReviewController");

/* =====================================================
   GET BATCHES FOR REVIEWS (ADMIN / TUTOR)
===================================================== */

router.get("/batches", getSessionReviewBatches);

/* =====================================================
   GET STUDENT REVIEWS LIST (ADMIN / TUTOR)
===================================================== */

router.get("/", getStudentsReviews);

/* =====================================================
   CREATE SESSION REVIEW
===================================================== */

router.post(
  "/",
  createSessionReview
);

/* =====================================================
   GET REVIEWS BY STUDENT
===================================================== */

router.get(
  "/student/:studentId",
  getSessionReviewsByStudent
);

module.exports = router;