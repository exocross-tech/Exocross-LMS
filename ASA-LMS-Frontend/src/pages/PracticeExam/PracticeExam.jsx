import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { practiceExamApi } from "../../services/apiService";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Save,
  XCircle,
  Play,
  Trophy,
  Star,
  Award,
  Sparkles,
  X,
  FileQuestion,
  Package,
  Upload,
  Image as ImageIcon,
  Trash2,
  Camera,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import confetti from "canvas-confetti";
import Swal from "sweetalert2";
import { normalizeCKEditorImages } from "../../utils/imageUtils";
import ExamTimer from "../../components/ExamTimer/ExamTimer";
import TrueORFalse from "../../components/Exam/TrueORFalse/TrueORFalse";
import PictureMatching from "../../components/Exam/PictureMatch/PictureMatching";
import Matching from "../../components/Exam/Matching/Matching";
import "./PracticeExam.css";

const PracticeExam = ({ assignment, onBack }) => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [btnLoading, setBtnLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [scorePercentage, setScorePercentage] = useState(0);
  const [showReview, setShowReview] = useState(false);
  // const [startTime] = useState(Date.now());
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Project Kit State
  const [projectKit, setProjectKit] = useState(
    assignment?.PROJECT_KIT_ID
      ? {
          ID: assignment.PROJECT_KIT_ID,
          KIT_NAME: assignment.PROJECT_KIT_NAME,
          IMAGE_PATH: assignment.PROJECT_KIT_IMAGE_URL,
        }
      : null
  );
  const [kitImageFile, setKitImageFile] = useState(null);
  const [kitImagePreview, setKitImagePreview] = useState(null);

  const getLoggedInUser = () => {
    try {
      // Check the actual LMS storage key first
      const storageKeys = [
        "ASA_LMSUser",
        "LMSUser",
      ];

      for (const key of storageKeys) {
        const sessionValue = sessionStorage.getItem(key);

        if (sessionValue) {
          const parsed = JSON.parse(sessionValue);

          if (parsed && Object.keys(parsed).length > 0) {
            console.log(`User found in sessionStorage: ${key}`);
            return parsed;
          }
        }

        const localValue = localStorage.getItem(key);

        if (localValue) {
          const parsed = JSON.parse(localValue);

          if (parsed && Object.keys(parsed).length > 0) {
            console.log(`User found in localStorage: ${key}`);
            return parsed;
          }
        }
      }

      console.warn("No logged-in user found in storage.");
      return {};
    } catch (error) {
      console.error("Failed to read LMS user:", error);
      return {};
    }
  };

  const userData = getLoggedInUser();

  const studentId = Number(
    userData?.USER_ID ??
    userData?.ID ??
    userData?.STUDENT_ID ??
    userData?.id
  );
  console.log("Logged-in user:", userData);
  console.log("Student ID:", studentId);

  const isFetched = useRef(false);
  const navigateBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  useEffect(() => {
    if (!assignment?.SET_ID && !assignment?.PROJECT_KIT_ID && !assignment?.ASSIGNMENT_ID) {
      toast.error("Invalid assignment");
      navigateBack();
      return;
    }

    if (!isFetched.current) {
      isFetched.current = true;
      fetchExam();
    }
  }, [assignment]);

  useEffect(() => {
    const q = questions[currentIndex];
    if (
      q &&
      [
        "IMAGE IDENTIFICATION",
        "SHORT ESSAY"
      ].includes(q.QUESTION_TYPE)
    ) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentIndex, questions]);

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const normalizeQuestionHTML = (html, removeEmptyLines = false) => {
    if (!html) return "";
    let output = normalizeCKEditorImages(html);
    if (removeEmptyLines) {
      output = output.replace(/<p>(\s|&nbsp;)*<\/p>/gi, "");
    }
    return output;
  };

  const safeJSONParse = (data, fallback) => {
    if (!data || data === "null") return fallback;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("JSON parse error:", e, "Data:", data);
      return fallback;
    }
  };

  const handleKitImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload a valid image file (JPG, PNG, WebP)");
        return;
      }
      setKitImageFile(file);
      setKitImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveKitImage = () => {
    setKitImageFile(null);
    if (kitImagePreview) {
      URL.revokeObjectURL(kitImagePreview);
    }
    setKitImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchExam = async () => {
    try {
      setLoading(true);

      const response = await practiceExamApi.getAssignmentExam({
        ASSIGNMENT_ID: assignment?.ASSIGNMENT_ID,
        SET_ID: assignment?.SET_ID,
      });

      console.log("Assignment exam response:", response.data);

      if (response.data.status === 1) {
        if (response.data.projectKit) {
          setProjectKit(response.data.projectKit);
        }

        const ques = response.data.data || response.data.questions || [];

        const allQuestions = ques.map((q) => ({
          ...q,

          LEFT_ITEMS: safeJSONParse(q.LEFT_ITEMS, {
            heading: "",
            items: [],
          }),

          RIGHT_ITEMS: safeJSONParse(q.RIGHT_ITEMS, {
            heading: "",
            items: [],
          }),

          CORRECT_MATCHES: safeJSONParse(q.CORRECT_MATCHES, {}),

          MULTIPLE_RESPONSE_OPTIONS: safeJSONParse(
            q.MULTIPLE_RESPONSE_OPTIONS,
            [],
          ),

          FILLBLANK_ANSWER: safeJSONParse(q.FILLBLANK_ANSWER, []),

          SEQUENCE_ANSWER: safeJSONParse(q.SEQUENCE_ANSWER, []),

          LABELLING_ANSWER: safeJSONParse(q.LABELLING_ANSWER, []),

          MULTIPLE_RESPONSE_ANSWER: safeJSONParse(
            q.MULTIPLE_RESPONSE_ANSWER,
            [],
          ),

          studentAnswer: "",
          givenMark: "",
          status: "not-visited",
        }));

        const shuffledQuestions = shuffleArray(allQuestions);

        if (shuffledQuestions.length > 0) {
          shuffledQuestions[0].status = "not-answered";
        }

        setQuestions(shuffledQuestions);
      } else {
        toast.error(
          response.data.message || "Failed to load assignment",
        );

        navigateBack();
      }
    } catch (error) {
      console.error("Assignment exam fetch error:", error);

      toast.error("Error fetching assignment");
      navigateBack();
    } finally {
      setLoading(false);
    }
  };
  const handleAnswerUpdate = (questionIndex, studentAnswer, givenMark) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === questionIndex
          ? { ...q, studentAnswer, status: "answered", givenMark }
          : q,
      ),
    );
  };

  const handleOptionSelect = (index, label) => {
    handleAnswerUpdate(
      index,
      label,
      questions[index].CORRECT_ANSWER === label
        ? Number(questions[index].MARK || 0)
        : 0,
    );
  };

  const handleFillBlankAnswer = (index, value) => {
    const q = questions[index];
    const correctAnswers = q.FILLBLANK_ANSWER || [];
    const studentValue = value.trim();
    let isCorrect =
      q.IS_CASE_SENSITIVE === "True"
        ? correctAnswers.some((ans) => ans.trim() === studentValue)
        : correctAnswers.some(
          (ans) => ans.trim().toLowerCase() === studentValue.toLowerCase(),
        );

    handleAnswerUpdate(index, value, isCorrect ? Number(q.MARK || 0) : 0);
  };

  const handleEssayAnswer = (index, value) => {
    const q = questions[index];
    const keywords = q.FILLBLANK_ANSWER || [];
    const answerText = value.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) =>
      answerText.includes(keyword.trim().toLowerCase()),
    ).length;
    const totalMark = Number(q.MARK || 0);
    const perKeywordMark =
      keywords.length > 0 ? totalMark / keywords.length : 0;
    const givenMark = Number(
      Math.min(matchedKeywords * perKeywordMark, totalMark).toFixed(2),
    );

    handleAnswerUpdate(index, value, givenMark);
  };

  const updateStatusBeforeMove = (index) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (
        !updated[index].studentAnswer ||
        (Array.isArray(updated[index].studentAnswer) &&
          updated[index].studentAnswer.length === 0)
      ) {
        updated[index].status = "not-answered";
      } else {
        updated[index].status = "answered";
      }
      return updated;
    });
  };

  const markNextQuestionVisited = (index) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[index].status === "not-visited") {
        updated[index].status = "not-answered";
      }
      return updated;
    });
  };

  const goToNext = () => {
    updateStatusBeforeMove(currentIndex);
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      markNextQuestionVisited(nextIndex);
      setCurrentIndex(nextIndex);
    }
  };

  const goToPrev = () => {
    updateStatusBeforeMove(currentIndex);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const jumpToQuestion = (index) => {
    updateStatusBeforeMove(currentIndex);
    markNextQuestionVisited(index);
    setCurrentIndex(index);
  };

  const calculateSequenceMark = (correct, student, totalMark) => {
    if (!Array.isArray(correct) || !Array.isArray(student)) return 0;
    let mark = 0;
    const perStepMark = totalMark / correct.length;
    for (let i = 0; i < correct.length; i++) {
      if (student[i] === correct[i]) mark += perStepMark;
      else break;
    }
    return mark;
  };

  const calculateLabellingMark = (correct, student, totalMark) => {
    if (!Array.isArray(correct) || !Array.isArray(student)) return 0;
    const correctSet = new Set(correct);
    const perLabelMark = totalMark / correct.length;
    let mark = 0;
    student.forEach((label) => {
      if (correctSet.has(label)) {
        mark += perLabelMark;
        correctSet.delete(label);
      }
    });
    return mark;
  };

  const submitExam = async (type) => {
    const pk = projectKit || (assignment?.PROJECT_KIT_ID ? { ID: assignment.PROJECT_KIT_ID, KIT_NAME: assignment.PROJECT_KIT_NAME } : null);

    if (questions.length === 0 && pk) {
      if (!kitImageFile) {
        toast.error("Please upload a photo of your completed Project Kit before submitting.");
        return;
      }
    }

    if (type === "submit") {
      let promptTitle = "Are you sure you want to submit the assessment?";
      let promptText = "";

      if (pk && !kitImageFile && questions.length > 0) {
        promptTitle = "Submit without Project Kit photo?";
        promptText = "You have not attached a photo for the assigned Project Kit. You can still submit your question answers.";
      }

      const result = await Swal.fire({
        title: promptTitle,
        text: promptText,
        icon: pk && !kitImageFile && questions.length > 0 ? "warning" : "question",
        showCancelButton: true,
        confirmButtonColor: "#00bcd4",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Yes, submit",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setBtnLoading(true);

      const totalEarnedMark = questions.reduce(
        (sum, q) => sum + Number(q.givenMark || 0),
        0,
      );
      const totalPossibleMark = questions.reduce(
        (sum, q) => sum + Number(q.MARK || 0),
        0,
      );
      const localPercentage =
        totalPossibleMark > 0
          ? (totalEarnedMark / totalPossibleMark) * 100
          : questions.length === 0 && pk
          ? 100
          : 0;

      const totalQuestions = questions.length > 0 ? questions.length : (pk ? 1 : 0);
      const unansweredCount = questions.length > 0
        ? questions.filter(
            (q) =>
              !q.studentAnswer ||
              (Array.isArray(q.studentAnswer) && q.studentAnswer.length === 0),
          ).length
        : (!kitImageFile ? 1 : 0);

      const unvisitedCount = questions.length > 0
        ? questions.filter((q) => q.status === "not-visited").length
        : 0;

      const studentAnsweredCount = questions.length > 0
        ? questions.filter(
            (q) =>
              q.studentAnswer &&
              (!Array.isArray(q.studentAnswer) || q.studentAnswer.length > 0),
          ).length
        : (kitImageFile ? 1 : 0);

      const studentAnswerData = questions.map((q) => ({
        QUESTION_ID: q.ID,
        QUESTION: q.QUESTION,
        QUESTION_TYPE: q.QUESTION_TYPE,
        STUDENT_ANSWER: q.studentAnswer,
        CORRECT_ANSWER: q.CORRECT_ANSWER,
        MARK: Number(q.MARK || 0),
        GIVEN_MARK: Number(q.givenMark || 0),
      }));

      const assessmentId = Number(
        assignment?.ASSIGNMENT_ID
      );

      console.log("========== SAVE ATTEMPT ==========");
      console.log("Student ID:", studentId);
      console.log("Assessment ID:", assessmentId);
      console.log("Assignment:", assignment);
      console.log("User:", userData);
      console.log("Project Kit:", pk);
      console.log("Kit Image Attached:", !!kitImageFile);
      console.log("==================================");

      if (!Number.isInteger(studentId) || studentId <= 0) {
        toast.error("Logged-in student ID was not found. Please login again.");
        return;
      }

      if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
        toast.error("Invalid assignment ID.");
        return;
      }

      const formData = new FormData();
      formData.append("STUDENT_ID", studentId);
      formData.append("ASSESMENT_ID", assessmentId);
      formData.append("TOTAL_QUESTIONS", totalQuestions);
      formData.append("STUDENT_ANSWERED", studentAnsweredCount);
      formData.append("UNANSWERED", unansweredCount);
      formData.append("UNVISITED", unvisitedCount);
      formData.append("STUDENT_MARK", Number(totalEarnedMark.toFixed(2)));
      formData.append("MARK_PERCENTAGE", Number(localPercentage.toFixed(2)));
      formData.append("STUDENT_ANSWER", JSON.stringify(studentAnswerData));

      if (pk?.ID) {
        formData.append("PROJECT_KIT_ID", pk.ID);
      }
      if (kitImageFile) {
        formData.append("projectKitImage", kitImageFile);
      }

      const saveResponse = await practiceExamApi.savePracticeExamAttempt(formData);

      console.log(
        "Save attempt response:",
        saveResponse.data
      );

      if (saveResponse.data.status === 1) {
        setScorePercentage(
          saveResponse.data.SCORE_PERCENTAGE || localPercentage,
        );
      } else {
        setScorePercentage(localPercentage);
      }

      setScore(totalEarnedMark || 0);
      const finalPercentage =
        saveResponse.data.status === 1
          ? saveResponse.data.SCORE_PERCENTAGE || localPercentage
          : localPercentage;
      setScorePercentage(finalPercentage);
      setShowResults(true);

      // 🎉 High-Fidelity Party Pops Celebration
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 1100,
      };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      // Multiple localized bursts
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 40 * (timeLeft / duration);

        // Top bursts (similar to screenshot)
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.4), y: Math.random() - 0.2 },
          colors: ["#3b82f6", "#10b981", "#fbbf24", "#06b6d4"],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.6, 0.9), y: Math.random() - 0.2 },
          colors: ["#3b82f6", "#10b981", "#fbbf24", "#06b6d4"],
        });
      }, 250);

      // One big burst from the center bottom
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#fbbf24", "#f59e0b", "#fb923c", "#ffffff"],
        });
      }, 600);

      // Side cannons
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: ["#3b82f6", "#06b6d4"],
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: ["#10b981", "#059669"],
        });
      }, 1000);
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Error submitting assessment");
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="exam-loading-screen">
        <div className="loader-spinner"></div>
        <p>Preparing your assessment...</p>
      </div>
    );
  }

  if (showResults) {
    const totalPoints = questions.reduce(
      (sum, q) => sum + Number(q.MARK || 0),
      0,
    );
    const starsEarned = Math.round((scorePercentage / 100) * 5);

    return (
      <div className="results-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="results-card"
        >
          <div className="res-decorative-bg">
            <div className="res-blob-1" />
            <div className="res-blob-2" />
          </div>

          <div className="results-content">
            {/* Trophy Animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.6,
                type: "spring",
                stiffness: 200,
              }}
              className="trophy-wrapper"
            >
              <div className="trophy-glow" />
              <div className="trophy-icon-container">
                <Trophy className="trophy-icon" strokeWidth={2} />
              </div>
              <motion.div
                animate={{ y: [-5, 5, -5], rotate: [0, 10, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="res-sparkle"
              >
                <Sparkles className="sparkle-icon" fill="currentColor" />
              </motion.div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="results-title"
            >
              {assignment?.MODULE_NAME ||
                state?.MODULE_NAME ||
                state?.CHAPTER_NAME ||
                assignment?.SET_NAME ||
                "Assessment"}{" "}
              has been submitted
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="results-subtitle"
            >
              You've completed your assessment
            </motion.p>

            {/* Achievement Badges */}
            <div className="achievement-badges">
              {scorePercentage >= 80 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.4, type: "spring" }}
                  className="badge-item"
                >
                  <div className="badge-icon high-scorer">
                    <Award size={24} />
                  </div>
                  <span className="badge-text">High Scorer</span>
                </motion.div>
              )}
              {starsEarned >= 4 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.5, type: "spring" }}
                  className="badge-item"
                >
                  <div className="badge-icon star-student">
                    <Star size={24} fill="currentColor" />
                  </div>
                  <span className="badge-text">Star Student</span>
                </motion.div>
              )}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.6, type: "spring" }}
                className="badge-item"
              >
                <div className="badge-icon completed">
                  <Trophy size={24} />
                </div>
                <span className="badge-text">Completed</span>
              </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="results-actions">
              <button
                onClick={() => navigate("/dashboard")}
                className="btn-Results-primary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </motion.div>

        {/* Review Modal */}
        <AnimatePresence>
          {showReview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="review-modal-overlay"
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="review-modal-content"
              >
                <div className="review-header">
                  <div className="review-header-left">
                    <h2>Assessment Review</h2>
                    <span className="review-stats">
                      {
                        questions.filter(
                          (q) => Number(q.givenMark) === Number(q.MARK),
                        ).length
                      }{" "}
                      / {questions.length} Correct
                    </span>
                  </div>
                  <button
                    className="review-close-btn"
                    onClick={() => setShowReview(false)}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="review-body">
                  {questions.map((q, index) => {
                    const isCorrect = Number(q.givenMark) === Number(q.MARK);
                    const isPartial = !isCorrect && Number(q.givenMark) > 0;

                    const getFormattedAnswer = (type, answer, question) => {
                      if (
                        !answer ||
                        (Array.isArray(answer) && answer.length === 0)
                      )
                        return "Not Answered";

                      if (type === "MATCHING") {
                        const rightItems = question.RIGHT_ITEMS?.items || [];
                        if (Array.isArray(answer)) {
                          return answer
                            .map((idx) => rightItems[idx])
                            .join(", ");
                        }
                      } else if (type === "MULTIPLE RESPONSE") {
                        const options =
                          question.MULTIPLE_RESPONSE_OPTIONS || [];
                        if (Array.isArray(answer)) {
                          return answer.map((i) => options[i]).join(", ");
                        }
                      } else if (Array.isArray(answer)) {
                        return answer.join(", ");
                      }
                      return answer;
                    };

                    const getCorrectAnswer = (question) => {
                      const type = question.QUESTION_TYPE;
                      if (type === "FILL IN THE BLANKS")
                        return (question.FILLBLANK_ANSWER || []).join(", ");
                      if (type === "SEQUENCE")
                        return (question.SEQUENCE_ANSWER || []).join(" → ");
                      if (type === "PICTURE LABELLING")
                        return (question.LABELLING_ANSWER || []).join(", ");
                      if (type === "MATCHING") {
                        const rightItems = question.RIGHT_ITEMS?.items || [];
                        return Object.entries(question.CORRECT_MATCHES || {})
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([_, rightIndex]) => rightItems[rightIndex])
                          .join(", ");
                      }
                      if (type === "MULTIPLE RESPONSE") {
                        const options =
                          question.MULTIPLE_RESPONSE_OPTIONS || [];
                        return (question.MULTIPLE_RESPONSE_ANSWER || [])
                          .map((i) => options[i])
                          .join(", ");
                      }
                      return question.CORRECT_ANSWER;
                    };

                    return (
                      <div
                        key={q.ID}
                        className={`review-item ${isCorrect ? "correct" : isPartial ? "partial" : "incorrect"}`}
                      >
                        <div className="review-item-header">
                          <span className="review-q-number">
                            Question {index + 1}
                          </span>
                          <span
                            className={`review-status-badge ${isCorrect ? "correct" : isPartial ? "partial" : "incorrect"}`}
                          >
                            {isCorrect ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                            {isCorrect
                              ? "Correct"
                              : isPartial
                                ? "Partial"
                                : "Incorrect"}
                          </span>
                        </div>

                        <div
                          className="review-q-text"
                          dangerouslySetInnerHTML={{
                            __html: normalizeQuestionHTML(q.QUESTION),
                          }}
                        />

                        <div className="review-answers-grid">
                          <div className="review-answer-block student">
                            <label>Your Answer</label>
                            <div className="answer-content">
                              {getFormattedAnswer(
                                q.QUESTION_TYPE,
                                q.studentAnswer,
                                q,
                              )}
                            </div>
                          </div>
                          <div className="review-answer-block correct">
                            <label>Correct Answer</label>
                            <div className="answer-content">
                              {getCorrectAnswer(q)}
                            </div>
                          </div>
                        </div>

                        <div className="review-item-footer">
                          <span className="review-mark">
                            Points: {Number(q.givenMark).toFixed(1)} /{" "}
                            {Number(q.MARK).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const q = questions[currentIndex];
  const answeredCount = questions.filter((q) => q.status === "answered").length;

  const progress =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="exam-page">
      <header className="exam-header">
        <div className="max-w-[1400px] mx-auto px-10 container">
          <div className="exam-header-content">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="header-center"
            >
              <h1>
                {assignment?.MODULE_NAME || state?.MODULE_NAME || state?.CHAPTER_NAME || (projectKit?.KIT_NAME ? `Project Kit: ${projectKit.KIT_NAME}` : "Assessment")}
              </h1>
              <p>
                {assignment?.SET_NAME ? `${assignment.SET_NAME}` : ""}
                {projectKit?.KIT_NAME ? (assignment?.SET_NAME ? ` • Kit: ${projectKit.KIT_NAME}` : `Project Kit Assessment`) : ""}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="header-right"
            >
              {questions.length > 0 && (
                <>
                  {/* <div className="status-badge time">
                    <Clock size={16} />
                    <ExamTimer
                      duration={30}
                      marks={questions.reduce(
                        (sum, item) => sum + Number(item.MARK || 0),
                        0,
                      )}
                      onTimeUp={() => submitExam("auto")}
                      hideIcon={true}
                    />
                  </div> */}
                  <div className="status-badge marks">
                    <Trophy size={16} />
                    <span>
                      {questions.reduce(
                        (sum, item) => sum + Number(item.MARK || 0),
                        0,
                      )}{" "}
                      Marks
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Progress Section */}
          {questions.length > 0 && (
            <div className="progress-section">
              <div className="progress-container">
                <motion.div
                  className="progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="answered-stats"
              >
                {answeredCount} of {questions.length} questions answered
              </motion.p>
            </div>
          )}
        </div>
      </header>
      {questions.length > 0 ? (
        <div className="exam-content-container">
          <div className="question-navigation-sidebar">
            <h3>Questions</h3>
            <div className="question-grid">
              {questions.map((q, i) => (
                <button
                  key={i}
                  className={`q-nav-dot ${currentIndex === i ? "active" : ""} ${q.status}`}
                  onClick={() => jumpToQuestion(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <div className="legend">
              <div className="legend-item">
                <span className="legend-box answered"></span> Answered
              </div>
              <div className="legend-item">
                <span className="legend-box not-answered"></span> Not Answered
              </div>
              <div className="legend-item">
                <span className="legend-box active-question"></span> Active
                Question
              </div>
              <div className="legend-item">
                <span className="legend-box not-visited"></span> Not Visited
              </div>
            </div>
          </div>

          <div className="question-viewer">
            {projectKit && (
              <div className="exam-project-kit-panel">
                <div className="kit-panel-header">
                  <div className="kit-panel-badge">
                    <Package size={14} />
                    <span>ASSIGNED PROJECT KIT</span>
                  </div>
                  <h4 className="kit-panel-title">{projectKit.KIT_NAME}</h4>
                </div>
                
                <div className="kit-panel-body">
                  {projectKit.IMAGE_PATH && (
                    <div className="kit-panel-ref-img-wrapper">
                      <img
                        src={projectKit.IMAGE_PATH}
                        alt={projectKit.KIT_NAME}
                        className="kit-panel-ref-img"
                      />
                      <span className="kit-ref-label">Reference Kit Model</span>
                    </div>
                  )}
                  
                  <div className="kit-upload-section">
                    <p className="kit-upload-instructions">
                      Complete your kit build and attach a verification photo:
                    </p>
                    
                    {kitImagePreview ? (
                      <div className="kit-preview-box">
                        <img
                          src={kitImagePreview}
                          alt="Student kit upload"
                          className="kit-student-preview-img"
                        />
                        <div className="kit-preview-overlay">
                          <span className="kit-attached-tag">
                            <Check size={13} /> Photo Attached
                          </span>
                          <button
                            type="button"
                            className="kit-remove-btn"
                            onClick={handleRemoveKitImage}
                            title="Remove photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="kit-upload-dropzone"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera size={20} className="upload-icon" />
                        <span className="upload-text">Upload Completed Kit Photo</span>
                        <span className="upload-subtext">JPG, PNG, or WebP</span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: "none" }}
                          accept="image/*"
                          onChange={handleKitImageChange}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="question-card"
              >
                <div className="q-badge">
                  <span>
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="q-mark-badge">
                    {q?.MARK} {Number(q?.MARK) === 1 ? "Mark" : "Marks"}
                  </span>
                </div>
                <div
                  className="question-text"
                  dangerouslySetInnerHTML={{
                    __html: normalizeQuestionHTML(q?.QUESTION, true),
                  }}
                />

                <div className="question-body">
                  {q?.QUESTION_TYPE === "TRUE/FALSE" && (
                    <TrueORFalse
                      questionId={q.ID}
                      selected={q.studentAnswer}
                      onAnswerSelect={(qid, ans) =>
                        handleAnswerUpdate(
                          currentIndex,
                          ans,
                          ans.toLowerCase() === q.CORRECT_ANSWER.toLowerCase()
                            ? Number(q.MARK || 0)
                            : 0,
                        )
                      }
                    />
                  )}

                  {q?.QUESTION_TYPE === "MULTIPLE CHOICE" && (
                    <div className="options-container">
                      {["A", "B", "C", "D"].map((label) => {
                        const text = q[`OPTION_${label}`];
                        if (!text) return null;
                        return (
                          <button
                            key={label}
                            className={`option-button ${q.studentAnswer === label ? "selected" : ""}`}
                            onClick={() =>
                              handleOptionSelect(currentIndex, label)
                            }
                          >
                            <div className="option-letter">{label}</div>
                            <div
                              className="option-text"
                              dangerouslySetInnerHTML={{ __html: text }}
                            />
                            {q.studentAnswer === label && (
                              <div className="ms-auto">
                                <CheckCircle2 size={24} color="#00e5ff" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q?.QUESTION_TYPE === "MATCHING" && (
                    <Matching
                      questions={q.LEFT_ITEMS?.items || []}
                      initialAnswers={q.RIGHT_ITEMS?.items || []}
                      studentAnswer={q.studentAnswer || []}
                      leftSideHeading={q.LEFT_ITEMS?.heading || ""}
                      rightSideHeading={q.RIGHT_ITEMS?.heading || ""}
                      onMatchComplete={(studentOrder) => {
                        const correct = q.CORRECT_MATCHES || {};
                        const singleMark =
                          (Number(q.MARK) || 0) /
                          (q.LEFT_ITEMS?.items?.length || 1);
                        let correctCount = 0;
                        studentOrder.forEach((val, idx) => {
                          if (val === correct[idx]) correctCount++;
                        });
                        handleAnswerUpdate(
                          currentIndex,
                          studentOrder,
                          singleMark * correctCount,
                        );
                      }}
                    />
                  )}

                  {(q?.QUESTION_TYPE === "IMAGE IDENTIFICATION" ||
                    q?.QUESTION_TYPE === "FILL IN THE BLANKS") && (
                      <div className="input-answer-container">
                        <label>Your Answer:</label>
                        <input
                          type="text"
                          className="form-control"
                          value={q.studentAnswer || ""}
                          onChange={(e) =>
                            handleFillBlankAnswer(currentIndex, e.target.value)
                          }
                          ref={inputRef}
                          autoComplete="off"
                        />
                      </div>
                    )}

                  {(q?.QUESTION_TYPE === "SHORT ESSAY" ||
                    q?.QUESTION_TYPE === "LONG ESSAY") && (
                      <div className="input-answer-container">
                        <label>Your Answer:</label>
                        <textarea
                          className="form-control"
                          rows={q.QUESTION_TYPE === "SHORT ESSAY" ? 3 : 6}
                          value={q.studentAnswer || ""}
                          onChange={(e) =>
                            handleEssayAnswer(currentIndex, e.target.value)
                          }
                          ref={inputRef}
                        />
                      </div>
                    )}

                  {(q?.QUESTION_TYPE === "MISSING LETTERS" ||
                    q?.QUESTION_TYPE === "JUMBLE WORD") && (
                      <div className="input-answer-container">
                        <label>Your Answer:</label>
                        <input
                          type="text"
                          className="form-control"
                          value={q.studentAnswer || ""}
                          onChange={(e) =>
                            handleAnswerUpdate(
                              currentIndex,
                              e.target.value,
                              e.target.value.toLowerCase() ===
                                q.CORRECT_ANSWER.toLowerCase()
                                ? Number(q.MARK || 0)
                                : 0,
                            )
                          }
                          ref={inputRef}
                        />
                      </div>
                    )}

                  {q?.QUESTION_TYPE === "MULTIPLE RESPONSE" && (
                    <div className="options-container">
                      {(q.MULTIPLE_RESPONSE_OPTIONS || []).map((opt, idx) => (
                        <button
                          key={idx}
                          className={`option-button ${(q.studentAnswer || []).includes(idx) ? "selected" : ""}`}
                          onClick={() => {
                            const selected = q.studentAnswer || [];
                            const updated = selected.includes(idx)
                              ? selected.filter((i) => i !== idx)
                              : [...selected, idx];
                            const correctIndexes =
                              q.MULTIPLE_RESPONSE_ANSWER || [];
                            const singleMark =
                              Number(q.MARK || 0) /
                              (correctIndexes.length || 1);
                            const correctCount = updated.filter((i) =>
                              correctIndexes.includes(i),
                            ).length;
                            handleAnswerUpdate(
                              currentIndex,
                              updated,
                              correctCount * singleMark,
                            );
                          }}
                        >
                          <div className="option-letter">
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <div
                            className="option-text"
                            dangerouslySetInnerHTML={{ __html: opt }}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {(q?.QUESTION_TYPE === "PICTURE LABELLING" ||
                    q?.QUESTION_TYPE === "SEQUENCE") && (
                      <PictureMatching
                        answers={
                          q.QUESTION_TYPE === "SEQUENCE"
                            ? q.SEQUENCE_ANSWER
                            : q.LABELLING_ANSWER
                        }
                        studentAnswer={q.studentAnswer || []}
                        onSequenceSelect={(orderedArray) => {
                          const correct =
                            q.QUESTION_TYPE === "SEQUENCE"
                              ? q.SEQUENCE_ANSWER
                              : q.LABELLING_ANSWER;
                          const mark =
                            q.QUESTION_TYPE === "SEQUENCE"
                              ? calculateSequenceMark(
                                correct,
                                orderedArray,
                                Number(q.MARK || 0),
                              )
                              : calculateLabellingMark(
                                correct,
                                orderedArray,
                                Number(q.MARK || 0),
                              );
                          handleAnswerUpdate(currentIndex, orderedArray, mark);
                        }}
                      />
                    )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="exam-footer-controls">
              <button
                className="btn-nav-outline"
                disabled={currentIndex === 0}
                onClick={goToPrev}
              >
                <ChevronLeft size={20} /> Previous
              </button>
              {currentIndex === questions.length - 1 ? (
                <button
                  className="btn-nav-primary"
                  onClick={() => submitExam("submit")}
                  disabled={btnLoading}
                >
                  {btnLoading ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Save size={20} /> Submit Assessment
                    </>
                  )}
                </button>
              ) : (
                <button className="btn-nav-primary" onClick={goToNext}>
                  <span className="btn-text">Next</span>
                  <span className="btn-icon">
                    <ChevronRight size={18} />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : projectKit ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="kit-only-exam-container"
        >
          <div className="kit-only-card">
            <div className="kit-only-header">
              <div className="kit-only-tag">
                <Package size={16} />
                <span>PROJECT KIT ASSESSMENT</span>
              </div>
              <h2>{projectKit.KIT_NAME}</h2>
              <p>Complete this hands-on project kit and upload a clear photo of your finished work to submit your assessment.</p>
            </div>

            <div className="kit-only-content-grid">
              {projectKit.IMAGE_PATH && (
                <div className="kit-only-reference-box">
                  <h4>Reference Kit Model</h4>
                  <div className="kit-only-img-wrapper">
                    <img src={projectKit.IMAGE_PATH} alt={projectKit.KIT_NAME} />
                  </div>
                </div>
              )}

              <div className="kit-only-submission-box">
                <h4>Your Completed Work</h4>
                {kitImagePreview ? (
                  <div className="kit-only-preview-card">
                    <img src={kitImagePreview} alt="Your Submission" />
                    <div className="kit-only-preview-footer">
                      <span className="kit-upload-success-badge">
                        <Check size={14} /> Ready to Submit
                      </span>
                      <button
                        type="button"
                        className="kit-only-btn-remove"
                        onClick={handleRemoveKitImage}
                      >
                        <Trash2 size={14} /> Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="kit-only-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={36} className="dropzone-icon" />
                    <h5>Click or Drag to Upload Photo</h5>
                    <p>Supports PNG, JPG, JPEG, WebP</p>
                    <button type="button" className="kit-only-upload-btn">
                      <Camera size={16} /> Select Photo
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept="image/*"
                      onChange={handleKitImageChange}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="kit-only-footer">
              <button
                type="button"
                className="btn-kit-submit"
                onClick={() => submitExam("submit")}
                disabled={btnLoading || !kitImageFile}
              >
                {btnLoading ? "Submitting Assessment..." : "Submit Project Kit Assessment"}
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="no-questions-container"
        >
          <div className="empty-state-visual">
            <div className="decorative-circle orange"></div>
            <div className="decorative-circle purple"></div>
            <div className="main-visual-circle">
              <FileQuestion size={48} className="empty-icon" />
            </div>
          </div>
          <h3 className="no-questions-title">No questions added yet</h3>
          <p className="no-questions-desc">
            Get started by adding at least <strong>20 questions</strong> to
            create your assessment. Build a comprehensive test to help
            students learn effectively.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default PracticeExam;
