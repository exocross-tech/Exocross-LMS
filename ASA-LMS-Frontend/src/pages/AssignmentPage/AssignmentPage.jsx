import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Award,
  Play,
  Sparkles,
  RefreshCw,
  FolderOpen,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Package,
} from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { studentAssignmentApi } from "../../services/apiService";
import "./AssignmentPage.css";

const AssignmentPage = ({ onStartPracticeExam, onStartFinalAssessment }) => {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFetched = useRef(false);

  const getLoggedUser = () => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") || "{}";

      return JSON.parse(storedUser);
    } catch (error) {
      console.error("Get logged user error:", error);
      return {};
    }
  };

  const user = getLoggedUser();

  const userId =
    user?.USER_ID ||
    user?.ID ||
    user?.USERID ||
    user?.id;

  useEffect(() => {
    if (userId) {
      if (!isFetched.current) {
        isFetched.current = true;
        fetchAssignments();
      }
    } else {
      setLoading(false);

      toast.error(
        "Unable to identify logged-in student"
      );
    }
  }, [userId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);

      const response =
        await studentAssignmentApi.getStudentAssignments(
          userId
        );

      console.log(
        "Student Assessment response:",
        response.data
      );

      if (response.data?.status === 1) {
        const data = Array.isArray(
          response.data?.data
        )
          ? response.data.data.filter(
              (m) =>
                !m.IS_FINAL_ASSESSMENT &&
                (m.ASSESSMENT_TYPE || "").toUpperCase() !== "FINAL_ASSESSMENT"
            )
          : [];

        setModules(data);
      } else {
        setModules([]);

        toast.error(
          response.data?.message ||
          "Failed to load Assessments"
        );
      }
    } catch (error) {
      console.error(
        "Get student Assessments error:",
        error
      );

      setModules([]);

      toast.error(
        error?.response?.data?.message ||
        "Failed to load Assessments"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // START MODULE / ASSESSMENT
  // =====================================================

  const handleStartAssignment = async (module) => {
    console.log("Starting module:", module);

    if (!module?.sets?.length) {
      toast.error("No assessment component available for this module");
      return;
    }

    const selectedSet = module.sets[0];

    if (
      selectedSet?.isShowExamButton !== undefined &&
      Number(selectedSet.isShowExamButton) === 0
    ) {
      toast.info("You have already completed this assessment");
      return;
    }

    const confirmResult = await Swal.fire({
      title: "Start Assessment Confirmation",
      text: `Are you sure you want to start the assessment for "${module.MODULE_NAME || "this assessment"}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#00bcd4",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Start Assessment",
      cancelButtonText: "Cancel",
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    const assignment = {
      SET_ID: selectedSet.SET_ID || null,
      MODULE_ID: selectedSet.MODULE_ID || null,
      ASSIGNMENT_ID: selectedSet.ASSIGNMENT_ID,
      BATCH_ID: selectedSet.BATCH_ID,
      SET_NAME: selectedSet.SET_NAME,
      MODULE_NAME: module.MODULE_NAME,
      PROJECT_KIT_ID: selectedSet.PROJECT_KIT_ID || module.PROJECT_KIT_ID || null,
      PROJECT_KIT_NAME: selectedSet.PROJECT_KIT_NAME || module.PROJECT_KIT_NAME || null,
      PROJECT_KIT_IMAGE_URL: selectedSet.PROJECT_KIT_IMAGE_URL || module.PROJECT_KIT_IMAGE_URL || null,
      HAS_PROJECT_KIT: selectedSet.HAS_PROJECT_KIT || module.HAS_PROJECT_KIT || false,
      HAS_QUESTION_SET: selectedSet.HAS_QUESTION_SET !== false,
    };

    console.log("Sending assignment to PracticeExam:", assignment);

    if (typeof onStartPracticeExam === "function") {
      onStartPracticeExam(assignment);
    }
  };

  // =====================================================
  // GET MODULE TOTALS
  // =====================================================

  const getModuleStats = (module) => {
    const sets = Array.isArray(module?.sets)
      ? module.sets
      : [];

    const questionCount = sets.reduce(
      (total, set) => {
        const questions = Array.isArray(
          set?.questions
        )
          ? set.questions
          : [];

        return total + questions.length;
      },
      0
    );

    const totalMarks = sets.reduce(
      (total, set) => {
        const questions = Array.isArray(
          set?.questions
        )
          ? set.questions
          : [];

        const setMarks = questions.reduce(
          (markTotal, question) =>
            markTotal +
            (Number(question?.MARK) || 0),
          0
        );

        return total + setMarks;
      },
      0
    );

    return {
      questionCount,
      totalMarks,
    };
  };

  const getKitImageUrl = (imgUrl) => {
    if (!imgUrl) return "";
    if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
      return imgUrl;
    }
    const cleanPath = imgUrl.startsWith("/") ? imgUrl.substring(1) : imgUrl;
    return `http://127.0.0.1:5000/${cleanPath}`;
  };

  return (
    <div className="student-assignment-page">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="assignment-page-header">

        <div className="assignment-section-label">
          <Bell size={14} />
          <span>STUDENT ASSESSMENT</span>
        </div>

        <h1>My Assessments</h1>

        <p>
          Complete the module assessments and project kits assigned to your chapter.
        </p>

      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (
        <div className="assignment-empty">
          <div className="assignment-spinner" />
          <strong>Loading Assessments...</strong>
          <span>Please wait while we load your modules.</span>
        </div>
      )}

      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!loading && modules.length === 0 && (
        <div className="assignment-empty-wrapper">
          <div className="assignment-empty-card">
            <div className="assignment-empty-badge">
              <span className="assignment-badge-dot" />
              <Sparkles size={13} />
              <span>ALL CAUGHT UP</span>
            </div>

            <div className="assignment-empty-icon-box">
              <div className="assignment-empty-icon-glow" />
              <div className="assignment-empty-icon-inner">
                <BookOpen size={34} className="assignment-empty-main-icon" />
              </div>
              <div className="assignment-empty-check-badge">
                <CheckCircle2 size={16} />
              </div>
            </div>

            <h2 className="assignment-empty-title">
              No Assessments Available
            </h2>

            <p className="assignment-empty-description">
              There are currently no active assignment modules assigned to your batch.
              New practice modules and tests will appear here automatically once published by your instructor.
            </p>

            <button
              type="button"
              className="assignment-empty-refresh-btn"
              onClick={fetchAssignments}
            >
              <RefreshCw size={14} />
              <span>Check for Updates</span>
            </button>

            <div className="assignment-empty-tips-grid">
              <div className="assignment-empty-tip-card">
                <div className="assignment-tip-icon">
                  <FolderOpen size={18} />
                </div>
                <div className="assignment-tip-text">
                  <strong>Course Materials</strong>
                  <span>Access notes & study resources anytime</span>
                </div>
              </div>

              <div className="assignment-empty-tip-card">
                <div className="assignment-tip-icon">
                  <MessageSquare size={18} />
                </div>
                <div className="assignment-tip-text">
                  <strong>Batch Chatroom</strong>
                  <span>Ask questions & collaborate with peers</span>
                </div>
              </div>

              <div className="assignment-empty-tip-card">
                <div className="assignment-tip-icon">
                  <ShieldCheck size={18} />
                </div>
                <div className="assignment-tip-text">
                  <strong>Auto-Notifications</strong>
                  <span>Get alerted when new tasks are published</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =================================================
          MODULE CARDS
      ================================================= */}

      {!loading &&
        modules.length > 0 && (
          <div className="module-card-grid">
            {modules.map((module, index) => {
              const { questionCount, totalMarks } = getModuleStats(module);

              const firstSet = module.sets?.[0];
              const isShowExamButton =
                firstSet?.isShowExamButton !== undefined
                  ? Number(firstSet.isShowExamButton) === 1
                  : module.sets?.some((s) => Number(s.isShowExamButton) === 1);

              const rawType = (module.ASSESSMENT_TYPE || "").toUpperCase();

              const hasProjectKit = Boolean(
                module.HAS_PROJECT_KIT ||
                module.PROJECT_KIT_ID ||
                firstSet?.PROJECT_KIT_ID
              );

              const hasQuestionSet = Boolean(
                module.HAS_QUESTION_SET !== false &&
                (module.SET_COUNT > 0 || (firstSet && firstSet.SET_ID))
              );

              const kitName = module.PROJECT_KIT_NAME || firstSet?.PROJECT_KIT_NAME;
              const kitImg = module.PROJECT_KIT_IMAGE_URL || firstSet?.PROJECT_KIT_IMAGE_URL;

              const displayTitle = module.TITLE || module.MODULE_NAME || "Untitled Assessment";
              const displayDesc = module.DESCRIPTION || "";

              return (
                <article
                  className={`module-assignment-card ${hasProjectKit ? "includes-kit-card" : ""}`}
                  key={module.MODULE_ID || module.ID || index}
                >
                  {/* CARD HEADER: TITLE & BADGES */}
                  <div className="module-card-top">
                    {/* Project Kit Badge if applicable */}
                    {hasProjectKit && (
                      <div className="assessment-kit-badge">
                        <Package size={13} />
                        <span>INCLUDES PROJECT KIT</span>
                      </div>
                    )}

                    <h2 className="module-card-title" title={displayTitle}>
                      {displayTitle}
                    </h2>
                    {displayDesc && (
                      <p className="module-card-desc" title={displayDesc}>
                        {displayDesc}
                      </p>
                    )}
                  </div>

                  <div className="module-card-divider" />

                  {/* PROJECT KIT PREVIEW IF ATTACHED */}
                  {hasProjectKit && (
                    <div className="assessment-kit-preview-box">
                      {kitImg ? (
                        <img
                          src={getKitImageUrl(kitImg)}
                          alt={kitName || "Project Kit"}
                          className="assessment-kit-thumb"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="assessment-kit-thumb-fallback">
                          <Package size={22} />
                        </div>
                      )}
                      <div className="assessment-kit-preview-info">
                        <span className="kit-preview-label">Assigned Kit:</span>
                        <strong className="kit-preview-name">{kitName || "Project Kit"}</strong>
                      </div>
                    </div>
                  )}

                  {/* CARD DETAILS: INFORMATION ROWS */}
                  <div className="module-card-info-list">
                    {/* QUESTIONS (ONLY IF HAS QUESTIONS) */}
                    {hasQuestionSet && (
                      <div className="module-info-row">
                        <div className="module-info-icon">
                          <FileText size={18} />
                        </div>
                        <div className="module-info-text">
                          <span className="module-info-label">Questions</span>
                          <strong className="module-info-value">
                            {questionCount || module.QUESTION_COUNT || 1} Questions
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* MARKS (ONLY IF HAS QUESTIONS) */}
                    {hasQuestionSet && (
                      <div className="module-info-row">
                        <div className="module-info-icon">
                          <Award size={18} />
                        </div>
                        <div className="module-info-text">
                          <span className="module-info-label">Marks</span>
                          <strong className="module-info-value">
                            {totalMarks || module.TOTAL_MARKS || 10} Marks
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* PROJECT KIT REQUIREMENT ROW */}
                    {hasProjectKit && (
                      <div className="module-info-row">
                        <div className="module-info-icon kit-icon-wrapper">
                          <Package size={18} />
                        </div>
                        <div className="module-info-text">
                          <span className="module-info-label">Project Submission</span>
                          <strong className="module-info-value">
                            Photo Upload Required
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="module-card-divider" />

                  {/* START / COMPLETED BUTTON */}
                  <div className="module-card-footer">
                    {isShowExamButton ? (
                      <button
                        type="button"
                        className="module-start-btn"
                        onClick={() => handleStartAssignment(module)}
                      >
                        <span>Start Assessment</span>
                        <Play size={15} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="module-start-btn module-completed-btn"
                        disabled
                      >
                        <span>Already Completed the Assessment</span>
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

    </div>
  );
};

export default AssignmentPage;
