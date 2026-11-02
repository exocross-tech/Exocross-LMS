import React, { useEffect, useState } from "react";
import {
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";

import "./SessionReview.css";
import {
  classDetailsApi,
  sessionReviewApi,
} from "../../services/apiService";

const FEEDBACK_QUESTIONS = [
  {
    id: 1,
    title: "1. How would you rate your overall experience with the program?",
    type: "star",
  },
  {
    id: 2,
    title: "2. How interesting and engaging were the classes?",
    type: "star",
  },
  {
    id: 3,
    title: "3. How clearly were the aerospace concepts explained?",
    type: "star",
  },
  {
    id: 4,
    title: "4. How would you rate the hands-on activities and practical learning?",
    type: "star",
  },
  {
    id: 5,
    title: "5. How useful was the aerospace kit for your learning?",
    type: "star",
  },
  {
    id: 6,
    title: "6. How would you rate the trainer's teaching and support?",
    type: "star",
  },
  {
    id: 7,
    title: "7. How well did the program improve your understanding of aerospace and technology?",
    type: "star",
  },
  {
    id: 8,
    title: "8. How would you rate the LMS learning experience?",
    type: "star",
  },
  {
    id: 9,
    title: "9. Would you recommend this program to your friends?",
    type: "recommendation",
    options: ["Yes", "Maybe", "No"],
  },
  {
    id: 10,
    title: "10. What did you like most about the program, and what can we improve?",
    type: "text",
    subtitle: "Your Comments: Please share any suggestions, memorable experiences, or feedback about your learning journey.",
  },
];

const SessionReview = () => {
  // Questions 1–8 ratings (1–5)
  const [ratings, setRatings] = useState({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
  });

  // Question 9: "Yes" | "Maybe" | "No"
  const [recommendation, setRecommendation] = useState("");

  // Question 10: Comments
  const [comments, setComments] = useState("");

  const [studentId, setStudentId] = useState(null);
  const [tutorId, setTutorId] = useState(null);
  const [batchId, setBatchId] = useState(null);

  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const isFetched = React.useRef(false);

  /* =====================================================
     GET STORED USER INFO
  ===================================================== */

  const getStoredUser = () => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      if (!storedUser) return null;
      return JSON.parse(storedUser);
    } catch (error) {
      console.error("Failed to read user information from session/storage:", error);
      return null;
    }
  };

  /* =====================================================
     FETCH EXISTING SESSION REVIEW (RUNS EXACTLY ONCE)
  ===================================================== */

  const loadSessionReviewData = async () => {
    const user = getStoredUser();

    if (!user) {
      toast.error("Student login information not found.");
      setLoadingDetails(false);
      return;
    }

    const currentStudentId = Number(
      user?.STUDENT_ID ||
      user?.studentId ||
      user?.ID ||
      user?.USER_ID ||
      user?.id
    );

    if (!currentStudentId) {
      toast.error("Student ID not found.");
      setLoadingDetails(false);
      return;
    }

    setStudentId(currentStudentId);

    // Extract any pre-stored batch or tutor ID if present in user session
    if (user?.BATCH_ID || user?.batchId) {
      setBatchId(Number(user.BATCH_ID || user.batchId));
    }
    if (user?.TUTOR_ID || user?.tutorId) {
      setTutorId(Number(user.TUTOR_ID || user.tutorId));
    }

    try {
      setLoadingDetails(true);
      const reviewRes = await sessionReviewApi.getByStudentId(currentStudentId);

      if (
        reviewRes?.data?.status === 1 &&
        Array.isArray(reviewRes.data.data) &&
        reviewRes.data.data.length > 0
      ) {
        setAlreadySubmitted(true);
      }
    } catch (err) {
      console.warn("Error fetching student session review status:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  /* =====================================================
     INITIAL LOAD - EXECUTES ONLY ONCE PER MOUNT
  ===================================================== */

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      loadSessionReviewData();
    }
  }, []);

  /* =====================================================
     HANDLER: UPDATE STAR RATING
  ===================================================== */

  const handleRatingChange = (qId, value) => {
    setRatings((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  /* =====================================================
     VALIDATION CHECK
  ===================================================== */

  const isFormValid = () => {
    for (let i = 1; i <= 8; i++) {
      if (!ratings[i] || ratings[i] < 1 || ratings[i] > 5) {
        return false;
      }
    }
    if (!recommendation || !["Yes", "Maybe", "No"].includes(recommendation)) {
      return false;
    }
    return Boolean(studentId);
  };

  /* =====================================================
     SUBMIT REVIEW
  ===================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!studentId) {
      toast.error("Student information not found.");
      return;
    }

    // Validate Questions 1–8
    for (let i = 1; i <= 8; i++) {
      if (!ratings[i] || ratings[i] < 1 || ratings[i] > 5) {
        toast.error(`Please answer Question ${i} with a rating of 1 to 5 stars.`);
        return;
      }
    }

    // Validate Question 9
    if (!recommendation || !["Yes", "Maybe", "No"].includes(recommendation)) {
      toast.error("Please answer Question 9 (Would you recommend this program?).");
      return;
    }

    setSubmitting(true);

    try {
      // Build 10-answer array
      const feedback = [
        ratings[1],
        ratings[2],
        ratings[3],
        ratings[4],
        ratings[5],
        ratings[6],
        ratings[7],
        ratings[8],
        recommendation,
        comments.trim() || null,
      ];

      const payload = {
        STUDENT_ID: Number(studentId),
        FEEDBACK: feedback,
        ...(tutorId ? { TUTOR_ID: Number(tutorId) } : {}),
        ...(batchId ? { BATCH_ID: Number(batchId) } : {}),
      };

      const response = await sessionReviewApi.create(payload);

      if (response?.data?.status === 1) {
        toast.success(
          response?.data?.message || "Course feedback submitted successfully!",
          {
            position: "top-right",
            autoClose: 3500,
          }
        );
        setAlreadySubmitted(true);
      } else {
        toast.error(
          response?.data?.message || "Failed to submit feedback.",
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
      }
    } catch (error) {
      console.error(
        "Submit session review error:",
        error?.response?.data || error
      );

      if (error?.response?.status === 409) {
        toast.error(
          error?.response?.data?.message ||
            "You have already submitted a review for this program.",
          {
            position: "top-right",
            autoClose: 4000,
          }
        );
        setAlreadySubmitted(true);
        return;
      }

      toast.error(
        error?.response?.data?.message || "Failed to submit feedback.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="session-review-container">
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="session-review-header">
        <div className="session-review-breadcrumb">
          END OF PROGRAM
        </div>

        <h1 className="session-review-title">
          Student Course Feedback
        </h1>

        <div className="session-review-appreciation">
          <h2 className="session-review-heading-primary">
            Thank you for completing the Aerospace Intensive Certificate Program!
          </h2>
          <p className="session-review-subtitle">
            Please take a few minutes to share your experience. Your feedback helps us improve the program.
          </p>
        </div>
      </div>

      {/* =================================================
          REVIEW CARD
      ================================================= */}

      <div className="session-review-card">
        <div className="session-review-card-header">
          <div className="session-review-heading">
            <MessageSquare size={21} />
            <h2>Feedback Questions</h2>
          </div>
        </div>

        {/* =================================================
            LOADING / ALREADY SUBMITTED / FORM
        ================================================= */}

        {loadingDetails ? (
          <div className="session-review-loading">
            Loading course details...
          </div>
        ) : alreadySubmitted ? (
          <div className="session-review-completed-card">
            <CheckCircle2 size={54} color="#00e5ff" />
            <h3>Feedback Submitted</h3>
            <p>
              Thank you for sharing your valuable feedback! Your response has been recorded.
            </p>
          </div>
        ) : (
          <form
            className="session-review-form"
            onSubmit={handleSubmit}
          >
            {/* 10 QUESTIONS */}
            {FEEDBACK_QUESTIONS.map((q) => {
              if (q.type === "star") {
                const currentRating = ratings[q.id] || 0;
                return (
                  <div key={q.id} className="review-question-block">
                    <div className="question-header">
                      <span className="question-title">{q.title}</span>
                      <span className="required-star">*</span>
                    </div>

                    <div className="review-rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`rating-star ${
                            star <= currentRating ? "selected" : ""
                          }`}
                          onClick={() => handleRatingChange(q.id, star)}
                          disabled={submitting}
                          aria-label={`Rate ${star} out of 5 for question ${q.id}`}
                        >
                          <Star
                            size={32}
                            fill={
                              star <= currentRating
                                ? "currentColor"
                                : "none"
                            }
                            strokeWidth={1.8}
                          />
                        </button>
                      ))}
                      {currentRating > 0 && (
                        <span className="rating-value-badge">
                          {currentRating} / 5
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (q.type === "recommendation") {
                return (
                  <div key={q.id} className="review-question-block">
                    <div className="question-header">
                      <span className="question-title">{q.title}</span>
                      <span className="required-star">*</span>
                    </div>

                    <div className="recommendation-options-group">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className={`recommendation-radio-card ${
                            recommendation === opt ? "selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="program-recommendation"
                            value={opt}
                            checked={recommendation === opt}
                            onChange={() => setRecommendation(opt)}
                            disabled={submitting}
                          />
                          <span className="custom-radio-dot" />
                          <span className="radio-label-text">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              if (q.type === "text") {
                return (
                  <div key={q.id} className="review-question-block text-question">
                    <div className="question-header">
                      <span className="question-title">{q.title}</span>
                    </div>

                    {q.subtitle && (
                      <p className="question-subtitle-text">{q.subtitle}</p>
                    )}

                    <div className="review-form-group">
                      <textarea
                        id="review-comments"
                        value={comments}
                        onChange={(e) => {
                          if (e.target.value.length <= 1000) {
                            setComments(e.target.value);
                          }
                        }}
                        placeholder="Please share any suggestions, memorable experiences, or feedback about your learning journey..."
                        maxLength={1000}
                        disabled={submitting}
                      />
                      <div className="review-character-count">
                        {comments.length} / 1000
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}

            {/* SUBMIT BUTTON */}
            <div className="submit-section-wrap">
              <button
                type="submit"
                className="submit-review-btn"
                disabled={submitting || !isFormValid()}
              >
                {submitting ? (
                  <>
                    <span className="review-spinner"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SessionReview;