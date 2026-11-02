import React, { useEffect, useState, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Award,
  Eye,
  X,
  FileQuestion,
  HelpCircle,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  Package,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import { studentAssignmentApi } from "../../services/apiService";
import "./AssessmentResults.css";

const AssessmentResults = ({ onNavigateToAssessments }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const isFetched = useRef(false);

  const getLoggedUser = () => {
    try {
      const storageKeys = ["ASA_LMSUser", "LMSUser", "user"];
      for (const key of storageKeys) {
        const sessionVal = sessionStorage.getItem(key);
        if (sessionVal) {
          const parsed = JSON.parse(sessionVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
        const localVal = localStorage.getItem(key);
        if (localVal) {
          const parsed = JSON.parse(localVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
      }
      return {};
    } catch (e) {
      console.error("Failed to read user data:", e);
      return {};
    }
  };

  const user = getLoggedUser();
  const studentId =
    user?.USER_ID || user?.ID || user?.STUDENT_ID || user?.id;

  useEffect(() => {
    if (studentId) {
      if (!isFetched.current) {
        isFetched.current = true;
        fetchResults();
      }
    } else {
      setLoading(false);
      toast.error("Unable to identify logged-in student");
    }
  }, [studentId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await studentAssignmentApi.getAssessmentResults(studentId);
      if (res.data?.status === 1) {
        setResults(Array.isArray(res.data?.data) ? res.data.data : []);
      } else {
        setResults([]);
        toast.error(res.data?.message || "Failed to load assessment results");
      }
    } catch (err) {
      console.error("Fetch assessment results error:", err);
      setResults([]);
      toast.error(
        err?.response?.data?.message || "Failed to load assessment results"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  const cleanHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, "").trim();
  };

  const resolveImageUrl = (imagePath) => {
    if (!imagePath || typeof imagePath !== "string" || !imagePath.trim()) return "";
    const trimmed = imagePath.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:")
    ) {
      return trimmed;
    }
    const apiBase = (import.meta.env.VITE_API_BASE_URL || "")
      .replace(/\/api\/?$/, "")
      .replace(/\/+$/, "");
    const cleanPath = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");

    const encodedPath = cleanPath
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");

    return apiBase ? `${apiBase}/${encodedPath}` : `/${encodedPath}`;
  };

  const isAnswerCorrect = (q) => {
    const givenMark = Number(q.GIVEN_MARK || 0);
    const mark = Number(q.MARK || 0);
    if (givenMark > 0 && mark > 0 && givenMark >= mark) {
      return true;
    }
    if (givenMark > 0 && mark === 0) {
      return true;
    }
    const cleanAns = cleanHtml(String(q.STUDENT_ANSWER || "")).trim().toLowerCase();
    const cleanCorrect = cleanHtml(String(q.CORRECT_ANSWER || "")).trim().toLowerCase();
    if (cleanAns && cleanCorrect && cleanAns === cleanCorrect) {
      return true;
    }
    return false;
  };

  return (
    <div className="assessment-results-page">
      {/* PAGE HEADER */}
      <div className="results-page-header">
        <div className="results-section-label">
          <Award size={14} />
          <span>PERFORMANCE OVERSIGHT</span>
        </div>
        <h1>Assessment Results</h1>
        <p>
          Review your completed assessment attempts, scores, and question
          performance.
        </p>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="results-state-container">
          <div className="results-loading-spinner"></div>
          <p className="results-state-text">Loading your assessment results...</p>
        </div>
      ) : results.length === 0 ? (
        /* EMPTY STATE */
        <div className="results-state-container">
          <div className="results-empty-icon-box">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="results-empty-title">No Assessment Results Found</h3>
          <p className="results-empty-desc">
            You haven't completed any assessments yet. Take your first practice
            exam or formal assessment to view your results and performance metrics
            here.
          </p>
          {onNavigateToAssessments && (
            <button
              type="button"
              className="results-empty-btn"
              onClick={onNavigateToAssessments}
            >
              <span>Go to Assessments</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        /* RESULTS GRID (2 CARDS PER ROW) */
        <div className="assessment-results-grid">
          {results.map((result) => {
            const isTheoryOnly = result.ASSESSMENT_KIND === "THEORY_ONLY" || (!result.HAS_PROJECT_KIT && result.HAS_THEORY);
            const isKitOnly = result.ASSESSMENT_KIND === "PROJECT_KIT_ONLY" || (result.HAS_PROJECT_KIT && !result.HAS_THEORY);
            const isCombined = result.ASSESSMENT_KIND === "THEORY_AND_PROJECT_KIT" || (result.HAS_PROJECT_KIT && result.HAS_THEORY);
            const isEvaluated = result.IS_PROJECT_KIT_EVALUATED || isTheoryOnly;

            const answeredDisplay = `${result.STUDENT_ANSWERED}/${result.TOTAL_QUESTIONS}`;
            const pct = isEvaluated && result.FINAL_SCORE !== null
              ? Number(result.FINAL_SCORE).toFixed(0)
              : (result.PROJECT_KIT_MARK !== null && isKitOnly
                  ? Number(result.PROJECT_KIT_MARK).toFixed(0)
                  : Number(result.MARK_PERCENTAGE || 0).toFixed(0));

            return (
              <div className="assessment-result-card" key={result.ID}>
                <div>
                  {/* TOP HEADER */}
                  <div className="card-top-header">
                    <div className="card-title-group">
                      <h3 className="card-assessment-name">
                        {isKitOnly
                          ? (result.PROJECT_KIT_NAME || result.ASSESSMENT_NAME)
                          : result.ASSESSMENT_NAME}
                      </h3>
                      <div className="card-tag-row">
                        {result.MODULE_NAME && (
                          <span className="card-module-tag">
                            <BookOpen size={11} />
                            {result.MODULE_NAME}
                          </span>
                        )}
                        {!isKitOnly && result.PROJECT_KIT_NAME && (
                          <span className="card-kit-tag">
                            <Package size={11} />
                            {result.PROJECT_KIT_NAME}
                          </span>
                        )}
                      </div>
                    </div>
                    {isEvaluated ? (
                      <div className="card-score-badge">
                        <span className="score-badge-pct">{pct}%</span>
                        <span className="score-badge-label">
                          {isCombined ? "Final Score" : "Score"}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="card-score-badge"
                        style={{
                          background: "rgba(245, 158, 11, 0.12)",
                          borderColor: "rgba(245, 158, 11, 0.35)",
                        }}
                      >
                        <span
                          className="score-badge-pct"
                          style={{ color: "#f59e0b", fontSize: "13px", fontWeight: 700 }}
                        >
                          Pending
                        </span>
                        <span className="score-badge-label" style={{ color: "#fbbf24" }}>
                          Evaluation
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ATTEMPT DATE */}
                  <div className="card-attempt-date" style={{ marginBottom: "14px" }}>
                    <Calendar size={13} color="#00e5ff" />
                    <span>Attempted on {formatDate(result.CREATED_ON)}</span>
                  </div>

                  {/* 4-METRIC GRID */}
                  {isKitOnly ? (
                    <div className="card-metrics-grid">
                      <div className="metric-item">
                        <span className="metric-value answered">1</span>
                        <span className="metric-label">Answered</span>
                      </div>

                      <div className="metric-item">
                        <span className="metric-value">1</span>
                        <span className="metric-label">Total Kit</span>
                      </div>

                      <div className="metric-item">
                        <span className="metric-value unanswered">0</span>
                        <span className="metric-label">Unanswered</span>
                      </div>

                      <div className="metric-item">
                        <span className="metric-value unvisited">0</span>
                        <span className="metric-label">Unvisited</span>
                      </div>
                    </div>
                  ) : (
                    result.HAS_THEORY !== false && result.TOTAL_QUESTIONS > 0 && (
                      <div className="card-metrics-grid">
                        <div className="metric-item">
                          <span className="metric-value answered">
                            {answeredDisplay}
                          </span>
                          <span className="metric-label">Answered</span>
                        </div>

                        <div className="metric-item">
                          <span className="metric-value">
                            {result.TOTAL_QUESTIONS}
                          </span>
                          <span className="metric-label">Total Qs</span>
                        </div>

                        <div className="metric-item">
                          <span className="metric-value unanswered">
                            {result.UNANSWERED}
                          </span>
                          <span className="metric-label">Unanswered</span>
                        </div>

                        <div className="metric-item">
                          <span className="metric-value unvisited">
                            {result.UNVISITED}
                          </span>
                          <span className="metric-label">Unvisited</span>
                        </div>
                      </div>
                    )
                  )}

                  {/* MARKS / WEIGHTAGE BREAKDOWN */}
                  <div className="card-marks-row" style={{ flexWrap: "wrap", gap: "8px" }}>
                    {isCombined ? (
                      <>
                        <div className="marks-obtained">
                          Theory (75%):{" "}
                          <span>
                            {result.THEORY_WEIGHTED_SCORE !== null
                              ? `${result.THEORY_WEIGHTED_SCORE} / 75`
                              : `${result.STUDENT_MARK}`}
                          </span>
                        </div>
                        <div className="marks-obtained">
                          Project Kit (25%):{" "}
                          <span>
                            {result.IS_PROJECT_KIT_EVALUATED && result.PROJECT_KIT_WEIGHTED_SCORE !== null
                              ? `${result.PROJECT_KIT_WEIGHTED_SCORE} / 25 (${result.PROJECT_KIT_MARK}/100)`
                              : "Pending Evaluation"}
                          </span>
                        </div>
                        {result.IS_PROJECT_KIT_EVALUATED && result.FINAL_SCORE !== null && (
                          <div className="marks-obtained" style={{ width: "100%" }}>
                            Total Mark:{" "}
                            <span style={{ color: "#00e5ff", fontWeight: 700 }}>
                              {result.FINAL_SCORE} / 100
                            </span>
                          </div>
                        )}
                      </>
                    ) : isKitOnly ? (
                      <>
                        <div className="marks-obtained">
                          Project Kit Mark:{" "}
                          <span>
                            {result.IS_PROJECT_KIT_EVALUATED && result.PROJECT_KIT_MARK !== null && result.PROJECT_KIT_MARK !== undefined
                              ? `${result.PROJECT_KIT_MARK} / 100`
                              : "Pending Evaluation"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="marks-obtained">
                          Marks Obtained: <span>{result.STUDENT_MARK}</span>
                        </div>
                        <div className="marks-obtained">
                          Accuracy: <span>{pct}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* FOOTER ACTION (VIEW BUTTON) */}
                <div className="card-footer-action">
                  <button
                    type="button"
                    className="result-view-btn"
                    onClick={() => setSelectedAttempt(result)}
                    title="View Attempt Details"
                  >
                    <Eye size={14} />
                    <span>View</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW ATTEMPT DETAILS MODAL */}
      {selectedAttempt && (() => {
        const isTheoryOnlyModal = selectedAttempt.ASSESSMENT_KIND === "THEORY_ONLY" || (!selectedAttempt.HAS_PROJECT_KIT && selectedAttempt.HAS_THEORY);
        const isKitOnlyModal = selectedAttempt.ASSESSMENT_KIND === "PROJECT_KIT_ONLY" || (selectedAttempt.HAS_PROJECT_KIT && !selectedAttempt.HAS_THEORY);
        const isCombinedModal = selectedAttempt.ASSESSMENT_KIND === "THEORY_AND_PROJECT_KIT" || (selectedAttempt.HAS_PROJECT_KIT && selectedAttempt.HAS_THEORY);

        return (
          <div
            className="result-modal-overlay"
            onClick={() => setSelectedAttempt(null)}
          >
            <div
              className="result-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER */}
              <div className="result-modal-header">
                <div>
                  <h2 className="result-modal-title">
                    {isKitOnlyModal
                      ? (selectedAttempt.PROJECT_KIT_NAME || selectedAttempt.ASSESSMENT_NAME)
                      : selectedAttempt.ASSESSMENT_NAME}
                  </h2>
                  <p className="result-modal-subtitle">
                    Attempted on {formatDate(selectedAttempt.CREATED_ON)}
                    {selectedAttempt.MODULE_NAME
                      ? ` · ${selectedAttempt.MODULE_NAME}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="result-modal-close"
                  onClick={() => setSelectedAttempt(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="result-modal-body">
                {/* SUMMARY GRID */}
                <div className="modal-summary-grid">
                  {isKitOnlyModal ? (
                    <>
                      <div className="modal-summary-item">
                        <span className="label">Answered</span>
                        <span className="val" style={{ color: "#10b981" }}>1</span>
                      </div>
                      <div className="modal-summary-item">
                        <span className="label">Total Kit</span>
                        <span className="val">1</span>
                      </div>
                      <div className="modal-summary-item">
                        <span className="label">Unanswered</span>
                        <span className="val" style={{ color: "#f59e0b" }}>0</span>
                      </div>
                      <div className="modal-summary-item">
                        <span className="label">Unvisited</span>
                        <span className="val" style={{ color: "#64748b" }}>0</span>
                      </div>
                      <div className="modal-summary-item">
                        <span className="label">Project Kit Mark</span>
                        <span
                          className="val"
                          style={{
                            color: selectedAttempt.IS_PROJECT_KIT_EVALUATED ? "#00e5ff" : "#f59e0b",
                          }}
                        >
                          {selectedAttempt.IS_PROJECT_KIT_EVALUATED && selectedAttempt.PROJECT_KIT_MARK !== null && selectedAttempt.PROJECT_KIT_MARK !== undefined
                            ? `${selectedAttempt.PROJECT_KIT_MARK} / 100`
                            : "Pending Evaluation"}
                        </span>
                      </div>
                      <div className="modal-summary-item">
                        <span className="label">Status</span>
                        <span
                          className="val"
                          style={{
                            color: selectedAttempt.IS_PROJECT_KIT_EVALUATED ? "#10b981" : "#f59e0b",
                          }}
                        >
                          {selectedAttempt.IS_PROJECT_KIT_EVALUATED ? "Reviewed" : "Pending Evaluation"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {selectedAttempt.TOTAL_QUESTIONS > 0 && (
                        <>
                          <div className="modal-summary-item">
                            <span className="label">Answered</span>
                            <span className="val" style={{ color: "#10b981" }}>
                              {selectedAttempt.STUDENT_ANSWERED}/
                              {selectedAttempt.TOTAL_QUESTIONS}
                            </span>
                          </div>
                          <div className="modal-summary-item">
                            <span className="label">Unanswered</span>
                            <span className="val" style={{ color: "#f59e0b" }}>
                              {selectedAttempt.UNANSWERED}
                            </span>
                          </div>
                        </>
                      )}

                      {/* MARK BREAKDOWN IN MODAL */}
                      {isCombinedModal ? (
                        <>
                          <div className="modal-summary-item">
                            <span className="label">Theory (75% Weight)</span>
                            <span className="val" style={{ color: "#00e5ff" }}>
                              {selectedAttempt.THEORY_WEIGHTED_SCORE !== null
                                ? `${selectedAttempt.THEORY_WEIGHTED_SCORE} / 75`
                                : `${selectedAttempt.STUDENT_MARK}`}
                            </span>
                          </div>
                          <div className="modal-summary-item">
                            <span className="label">Project Kit (25% Weight)</span>
                            <span
                              className="val"
                              style={{
                                color: selectedAttempt.IS_PROJECT_KIT_EVALUATED
                                  ? "#10b981"
                                  : "#f59e0b",
                              }}
                            >
                              {selectedAttempt.IS_PROJECT_KIT_EVALUATED && selectedAttempt.PROJECT_KIT_WEIGHTED_SCORE !== null
                                ? `${selectedAttempt.PROJECT_KIT_WEIGHTED_SCORE} / 25 (${selectedAttempt.PROJECT_KIT_MARK}/100)`
                                : "Pending Evaluation"}
                            </span>
                          </div>
                          <div className="modal-summary-item">
                            <span className="label">Final Weighted Total</span>
                            <span
                              className="val"
                              style={{
                                color: selectedAttempt.IS_PROJECT_KIT_EVALUATED ? "#00e5ff" : "#f59e0b",
                                fontWeight: 700,
                              }}
                            >
                              {selectedAttempt.IS_PROJECT_KIT_EVALUATED && selectedAttempt.FINAL_SCORE !== null
                                ? `${selectedAttempt.FINAL_SCORE} / 100`
                                : "Pending"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="modal-summary-item">
                            <span className="label">Student Mark</span>
                            <span className="val" style={{ color: "#00e5ff" }}>
                              {selectedAttempt.STUDENT_MARK}
                            </span>
                          </div>
                          <div className="modal-summary-item">
                            <span className="label">Score</span>
                            <span className="val" style={{ color: "#00e5ff" }}>
                              {Number(selectedAttempt.MARK_PERCENTAGE || 0).toFixed(0)}%
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

              {/* PROJECT KIT SECTION */}
              {(selectedAttempt.PROJECT_KIT_NAME ||
                selectedAttempt.PROJECT_KIT_ID ||
                selectedAttempt.PROJECT_KIT_IMAGE ||
                selectedAttempt.STUDENT_PROJECT_KIT_IMAGE) && (() => {
                const rawImg =
                  selectedAttempt.PROJECT_KIT_IMAGE ||
                  selectedAttempt.STUDENT_PROJECT_KIT_IMAGE ||
                  selectedAttempt.PROJECT_KIT_IMAGE_URL;
                const fullImgUrl = resolveImageUrl(rawImg);

                return (
                  <div className="modal-project-kit-section">
                    <div className="modal-kit-header">
                      <div className="modal-kit-badge">
                        <Package size={13} />
                        <span>PROJECT KIT SUBMISSION</span>
                      </div>
                      <h4 className="modal-kit-title">
                        {selectedAttempt.PROJECT_KIT_NAME ||
                          `Project Kit #${selectedAttempt.PROJECT_KIT_ID}`}
                      </h4>
                    </div>

                    <div className="modal-kit-content">
                      {fullImgUrl ? (
                        <div className="modal-kit-img-box">
                          <label className="modal-kit-img-label">
                            Submitted Kit Photo:
                          </label>
                          <div
                            className="modal-kit-img-link"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({
                                url: fullImgUrl,
                                title:
                                  selectedAttempt.PROJECT_KIT_NAME ||
                                  "Project Kit Submission",
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                setPreviewImage({
                                  url: fullImgUrl,
                                  title:
                                    selectedAttempt.PROJECT_KIT_NAME ||
                                    "Project Kit Submission",
                                });
                              }
                            }}
                            title="Click to preview full resolution image"
                          >
                            <img
                              src={fullImgUrl}
                              alt={
                                selectedAttempt.PROJECT_KIT_NAME ||
                                "Project Kit"
                              }
                              className="modal-kit-img"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallbackEl = document.getElementById(
                                  `kit-img-fallback-${selectedAttempt.ID}`
                                );
                                if (fallbackEl) {
                                  fallbackEl.style.display = "flex";
                                }
                              }}
                            />
                            <div className="modal-kit-zoom-hint">
                              <Eye size={13} />
                              <span>Click to Preview Image</span>
                            </div>
                          </div>
                          <div
                            id={`kit-img-fallback-${selectedAttempt.ID}`}
                            className="modal-kit-empty-photo"
                            style={{ display: "none", marginTop: "8px" }}
                          >
                            <ImageIcon size={24} color="#64748b" />
                            <span>
                              Image could not be loaded from server.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="modal-kit-empty-photo">
                          <ImageIcon size={24} color="#64748b" />
                          <span>
                            No build photo was attached with this submission.
                          </span>
                        </div>
                      )}

                      {/* TUTOR FEEDBACK IF AVAILABLE */}
                      {selectedAttempt.PROJECT_KIT_COMMENT && (
                        <div style={{ marginTop: "14px", padding: "12px", background: "rgba(15, 23, 42, 0.7)", borderRadius: "8px", border: "1px solid #334155" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#00e5ff", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                            Tutor Feedback & Observations:
                          </span>
                          <p style={{ margin: 0, fontSize: "13px", color: "#f8fafc", lineHeight: 1.4 }}>
                            {selectedAttempt.PROJECT_KIT_COMMENT}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* QUESTIONS LIST (FOR ASSESSMENTS WITH QUESTIONS) */}
              {!isKitOnlyModal && (
                <>
                  <h4 className="modal-questions-title">Questions & Responses</h4>

                  {Array.isArray(selectedAttempt.STUDENT_ANSWER) &&
                  selectedAttempt.STUDENT_ANSWER.length > 0 ? (
                    selectedAttempt.STUDENT_ANSWER.map((q, idx) => {
                      const studentAns = q.STUDENT_ANSWER;
                      const isAnswered =
                        studentAns !== null &&
                        studentAns !== undefined &&
                        String(studentAns).trim() !== "";
                      const isCorrect = isAnswerCorrect(q);
                      const marksTotal = q.MARK !== undefined ? Number(q.MARK) : 0;
                      const marksGiven =
                        q.GIVEN_MARK !== undefined ? Number(q.GIVEN_MARK) : 0;

                      return (
                        <div
                          className={`modal-question-item ${
                            isCorrect
                              ? "correct"
                              : isAnswered
                              ? "incorrect"
                              : "unanswered"
                          }`}
                          key={q.QUESTION_ID || idx}
                        >
                          <div className="modal-q-header">
                            <div className="modal-q-meta">
                              <span className="modal-q-num">Question #{idx + 1}</span>
                              {q.QUESTION_TYPE && (
                                <span className="modal-q-type">
                                  {q.QUESTION_TYPE}
                                </span>
                              )}
                              <span
                                className={`modal-status-badge ${
                                  isCorrect
                                    ? "correct"
                                    : isAnswered
                                    ? "incorrect"
                                    : "unanswered"
                                }`}
                              >
                                {isCorrect
                                  ? "Correct"
                                  : isAnswered
                                  ? "Incorrect"
                                  : "Unanswered"}
                              </span>
                            </div>

                            <div className="modal-q-marks">
                              <span className="awarded-mark">{marksGiven}</span>
                              <span className="total-mark">/{marksTotal} Marks</span>
                            </div>
                          </div>

                          <div
                            className="modal-q-text"
                            dangerouslySetInnerHTML={{
                              __html: q.QUESTION || "No question content",
                            }}
                          />

                          <div className="modal-answers-comparison">
                            {/* YOUR ANSWER */}
                            <div
                              className={`modal-answer-box your-answer ${
                                isCorrect ? "success" : isAnswered ? "error" : "empty"
                              }`}
                            >
                              <div className="modal-answer-header">
                                <span className="modal-answer-label">
                                  Your Answer:
                                </span>
                                {isCorrect ? (
                                  <span className="badge-inline-correct">
                                    <CheckCircle2 size={12} /> Correct
                                  </span>
                                ) : isAnswered ? (
                                  <span className="badge-inline-incorrect">
                                    <XCircle size={12} /> Incorrect
                                  </span>
                                ) : (
                                  <span className="badge-inline-empty">
                                    Not Answered
                                  </span>
                                )}
                              </div>
                              <div className="modal-answer-content">
                                {isAnswered
                                  ? cleanHtml(String(studentAns)) || String(studentAns)
                                  : "Not Answered"}
                              </div>
                            </div>

                            {/* CORRECT ANSWER */}
                            <div className="modal-answer-box correct-answer">
                              <div className="modal-answer-header">
                                <span className="modal-answer-label">
                                  Correct Answer:
                                </span>
                                <span className="badge-inline-correct">
                                  <CheckCircle2 size={12} /> Correct Key
                                </span>
                              </div>
                              <div className="modal-answer-content correct-text">
                                {q.CORRECT_ANSWER
                                  ? cleanHtml(String(q.CORRECT_ANSWER)) ||
                                    String(q.CORRECT_ANSWER)
                                  : "Not specified"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "20px",
                        color: "#94a3b8",
                        fontSize: "13px",
                      }}
                    >
                      Detailed question responses were not recorded for this attempt.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="result-modal-footer">
              <button
                type="button"
                className="modal-btn-close"
                onClick={() => setSelectedAttempt(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {/* FULL-RESOLUTION PROJECT KIT IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div
          className="kit-preview-lightbox-overlay"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="kit-preview-lightbox-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kit-preview-lightbox-header">
              <div className="kit-preview-lightbox-title-wrap">
                <Package size={16} color="#00e5ff" />
                <span className="kit-preview-lightbox-title">
                  {previewImage.title || "Project Kit Preview"}
                </span>
              </div>
              <button
                type="button"
                className="kit-preview-lightbox-close"
                onClick={() => setPreviewImage(null)}
                title="Close Preview"
                aria-label="Close Preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="kit-preview-lightbox-body">
              <img
                src={previewImage.url}
                alt={previewImage.title || "Project Kit Preview"}
                className="kit-preview-lightbox-img"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentResults;
