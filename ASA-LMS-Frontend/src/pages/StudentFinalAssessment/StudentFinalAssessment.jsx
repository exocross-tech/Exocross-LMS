import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Image as ImageIcon,
  Video,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  Award,
  BookOpen,
  FolderOpen,
  ShieldCheck,
  FileText,
  Play,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { finalAssessmentApi } from "../../services/apiService";
import "./StudentFinalAssessment.css";

const StudentFinalAssessment = ({ onBack, onNavigateToAssessment, onStartPracticeExam }) => {
  const navigate = useNavigate();

  // Loading & assessment state
  const [loading, setLoading] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [assessmentData, setAssessmentData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("PRACTICAL"); // 'THEORY' | 'PRACTICAL'

  // Practical Upload File state
  const [image1, setImage1] = useState(null);
  const [video1, setVideo1] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // File input refs
  const fileInputRef1 = useRef(null);
  const fileInputRefVid1 = useRef(null);

  const isFetched = useRef(false);
  const isSubmittingRef = useRef(false);

  // ----------------------------------------------------
  // IDENTIFY LOGGED-IN STUDENT (Matches AssignmentPage)
  // ----------------------------------------------------
  const getLoggedUser = () => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user") ||
        "{}";
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
    user?.id ||
    user?.userId;

  // ----------------------------------------------------
  // FETCH ASSIGNED FINAL ASSESSMENT
  // ----------------------------------------------------
  const fetchAssessment = async () => {
    if (!userId) {
      setLoading(false);
      setErrorMsg("Unable to identify logged-in student. Please log in again.");
      toast.error("Unable to identify logged-in student");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const response = await finalAssessmentApi.getStudentAssigned(userId);

      if (response?.data?.status === 1) {
        if (response.data.hasAssessment && response.data.data) {
          const data = response.data.data;
          setHasAssessment(true);
          setAssessmentData(data);

          // Select tab according to availability
          if (data.hasPractical && !data.hasTheory) {
            setActiveTab("PRACTICAL");
          } else if (data.hasTheory && !data.hasPractical) {
            setActiveTab("THEORY");
          } else if (data.hasPractical && data.hasTheory) {
            // Default to Practical or Theory depending on completion
            setActiveTab(data.practical?.isCompleted && !data.theory?.isCompleted ? "THEORY" : "PRACTICAL");
          }
        } else {
          setHasAssessment(false);
          setAssessmentData(null);
        }
      } else {
        setHasAssessment(false);
        setAssessmentData(null);
        setErrorMsg(response?.data?.message || "No assessment found");
      }
    } catch (error) {
      console.error("Fetch student final assessment error:", error);
      setHasAssessment(false);
      setAssessmentData(null);
      setErrorMsg(
        error?.response?.data?.message ||
        "An error occurred while fetching your Final Assessment."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchAssessment();
    }
  }, [userId]);

  // ----------------------------------------------------
  // START THEORY EXAM HANDLER
  // ----------------------------------------------------
  const handleStartTheoryExam = async () => {
    if (!assessmentData || !assessmentData.theory) {
      toast.error("No Theory Question Set assigned");
      return;
    }

    const isAttempted = assessmentData.theory.isAttempted;
    if (isAttempted) {
      toast.info("You have already completed the Theory Final Assessment.");
      return;
    }

    const confirmResult = await Swal.fire({
      title: "Start Theory Final Assessment",
      text: `Are you sure you want to start the Theory Final Assessment "${assessmentData.theory.SET_NAME || assessmentData.TITLE}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#00e5ff",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Start Assessment",
      cancelButtonText: "Cancel",
      background: "#0f172a",
      color: "#f8fafc",
    });

    if (!confirmResult.isConfirmed) return;

    const examPayload = {
      ASSIGNMENT_ID: assessmentData.theory?.ASSIGNMENT_ID || assessmentData.ASSIGNMENT_ID || assessmentData.ID,
      SET_ID: assessmentData.theory.SET_ID,
      MODULE_ID: assessmentData.theory.MODULE_ID || null,
      BATCH_ID: assessmentData.BATCH_ID,
      SET_NAME: assessmentData.theory.SET_NAME || assessmentData.TITLE,
      MODULE_NAME: assessmentData.theory.MODULE_NAME || "Final Assessment",
      HAS_QUESTION_SET: true,
      HAS_PROJECT_KIT: false,
      IS_FINAL_ASSESSMENT: true,
    };

    if (typeof onStartPracticeExam === "function") {
      onStartPracticeExam(examPayload);
    } else {
      navigate("/practice-exam", { state: examPayload });
    }
  };

  // ----------------------------------------------------
  // PRACTICAL FILE HANDLERS
  // ----------------------------------------------------
  const handleImageChange = (file) => {
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (
      !allowedTypes.includes(file.type.toLowerCase()) &&
      !file.name.match(/\.(jpg|jpeg|png|webp)$/i)
    ) {
      toast.error("Please upload a valid image file (JPG, JPEG, PNG, or WEBP).");
      return;
    }
    setImage1(file);
  };

  const handleVideoChange = (file) => {
    if (!file) return;
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-matroska",
    ];
    if (
      !allowedTypes.includes(file.type.toLowerCase()) &&
      !file.name.match(/\.(mp4|mov|webm|mkv)$/i)
    ) {
      toast.error("Please upload a valid video file (MP4, MOV, or WEBM).");
      return;
    }
    setVideo1(file);
  };

  const removeFile = (type) => {
    if (type === "image") {
      setImage1(null);
      if (fileInputRef1.current) fileInputRef1.current.value = "";
    } else if (type === "video") {
      setVideo1(null);
      if (fileInputRefVid1.current) fileInputRefVid1.current.value = "";
    }
  };

  const handleClearAll = () => {
    removeFile("image");
    removeFile("video");
    toast.info("Unsaved file selections cleared.");
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const savedImage = assessmentData?.practical?.IMAGE_1 || assessmentData?.submission?.IMAGE_1 || null;
  const savedVideo = assessmentData?.practical?.VIDEO_1 || assessmentData?.submission?.VIDEO_1 || null;
  const hasImage = Boolean(image1 || (savedImage && savedImage.trim()));
  const hasVideo = Boolean(video1 || (savedVideo && savedVideo.trim()));

  const practicalAssessmentId = assessmentData?.practical?.ID || null;

  const handleSubmitPractical = async (e) => {
    e.preventDefault();

    if (isSubmittingRef.current || submitting) return;

    if (!practicalAssessmentId) {
      toast.error("No active Final Assessment found to submit to.");
      return;
    }

    if (assessmentData?.practical?.isCompleted || (savedImage && savedVideo)) {
      toast.info("You have already completed this Final Assessment.");
      return;
    }

    if (!userId) {
      toast.error("Unable to identify logged-in student. Please re-login.");
      return;
    }

    if (!image1 && !video1) {
      toast.warning("Please choose a file (Image or Video) to upload.");
      return;
    }

    try {
      isSubmittingRef.current = true;
      setSubmitting(true);

      const formData = new FormData();
      formData.append("studentId", userId);
      formData.append("assessmentId", practicalAssessmentId);
      if (image1) formData.append("image1", image1);
      if (video1) formData.append("video1", video1);

      const response = await finalAssessmentApi.submitProject(formData);

      if (response?.data?.status === 1) {
        toast.success(
          response.data.message || "Final Assessment saved successfully."
        );
        removeFile("image");
        removeFile("video");
        fetchAssessment();
      } else {
        toast.error(
          response?.data?.message || "Failed to save Final Assessment."
        );
      }
    } catch (error) {
      console.error("Project submission error:", error);
      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        "An error occurred while submitting project files."
      );
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const hasBoth = Boolean(assessmentData?.hasTheory && assessmentData?.hasPractical);
  const currentView = hasBoth ? activeTab : (assessmentData?.hasTheory ? "THEORY" : "PRACTICAL");
  const isTheory = currentView === "THEORY";
  const isPracticalCompleted = Boolean(assessmentData?.practical?.isCompleted || (savedImage && savedVideo));

  return (
    <div className="student-assignment-page student-final-assessment-page">
      {/* 3-Level Standard Header matching Student Assessment Page */}
      <div className="assignment-page-header">
        <div className="assignment-section-label">
          <Award size={13} />
          <span>STUDENT FINAL ASSESSMENT</span>
        </div>
        <h1 className="final-assessment-main-heading">Final Assessment</h1>
        <p>Complete the final assessment assigned to your batch.</p>
      </div>

      {/* Tabs if both Theory and Practical exist */}
      {hasAssessment && hasBoth && (
        <div className="student-final-tabs-wrapper" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            type="button"
            className={`final-tab-btn ${activeTab === "PRACTICAL" ? "active" : ""}`}
            onClick={() => setActiveTab("PRACTICAL")}
            style={{
              padding: "10px 24px",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: activeTab === "PRACTICAL" ? "rgba(0, 229, 255, 0.18)" : "rgba(15, 23, 42, 0.6)",
              border: activeTab === "PRACTICAL" ? "1px solid #00e5ff" : "1px solid rgba(148, 163, 184, 0.2)",
              color: activeTab === "PRACTICAL" ? "#00e5ff" : "#94a3b8",
              transition: "all 0.2s ease",
            }}
          >
            <FolderOpen size={16} />
            <span>Practical Final Assessment</span>
            {assessmentData?.practical?.isCompleted && (
              <CheckCircle2 size={15} style={{ color: "#10b981", marginLeft: "4px" }} />
            )}
          </button>

          <button
            type="button"
            className={`final-tab-btn ${activeTab === "THEORY" ? "active" : ""}`}
            onClick={() => setActiveTab("THEORY")}
            style={{
              padding: "10px 24px",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: activeTab === "THEORY" ? "rgba(0, 229, 255, 0.18)" : "rgba(15, 23, 42, 0.6)",
              border: activeTab === "THEORY" ? "1px solid #00e5ff" : "1px solid rgba(148, 163, 184, 0.2)",
              color: activeTab === "THEORY" ? "#00e5ff" : "#94a3b8",
              transition: "all 0.2s ease",
            }}
          >
            <BookOpen size={16} />
            <span>Theory Final Assessment</span>
            {assessmentData?.theory?.isCompleted && (
              <CheckCircle2 size={15} style={{ color: "#10b981", marginLeft: "4px" }} />
            )}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="final-assessment-container">
        {loading ? (
          <div className="assignment-empty">
            <div className="assignment-spinner" />
            <strong>Loading Final Assessment...</strong>
            <span>Please wait while we load your final assessment details.</span>
          </div>
        ) : errorMsg && !hasAssessment ? (
          <div className="assignment-empty-wrapper">
            <div className="assignment-empty-card">
              <div className="assignment-empty-badge">
                <span className="assignment-badge-dot" />
                <Sparkles size={13} />
                <span>ATTENTION REQUIRED</span>
              </div>
              <div className="assignment-empty-icon-box">
                <div className="assignment-empty-icon-glow" />
                <div className="assignment-empty-icon-inner">
                  <AlertCircle size={34} className="assignment-empty-main-icon" />
                </div>
              </div>
              <h2 className="assignment-empty-title">
                Unable to Load Final Assessment
              </h2>
              <p className="assignment-empty-description">
                {errorMsg || "We couldn't load your final assessment right now. Please try again."}
              </p>
              <button
                type="button"
                className="assignment-empty-refresh-btn"
                onClick={fetchAssessment}
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        ) : !hasAssessment || !assessmentData ? (
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
                  <Award size={34} className="assignment-empty-main-icon" />
                </div>
                <div className="assignment-empty-check-badge">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <h2 className="assignment-empty-title">
                No Final Assessment Available
              </h2>
              <p className="assignment-empty-description">
                There is currently no final assessment assigned to your batch.
                Final assessments will appear here automatically once assigned by your instructor.
              </p>
              <button
                type="button"
                className="assignment-empty-refresh-btn"
                onClick={fetchAssessment}
              >
                <RefreshCw size={14} />
                <span>Check for Updates</span>
              </button>

              <div className="assignment-empty-tips-grid">
                <div
                  className="assignment-empty-tip-card"
                  onClick={onNavigateToAssessment || (() => navigate("/assignment-page"))}
                  style={{ cursor: "pointer" }}
                >
                  <div className="assignment-tip-icon">
                    <BookOpen size={18} />
                  </div>
                  <div className="assignment-tip-text">
                    <strong>My Assessments</strong>
                    <span>Complete regular module assessments</span>
                  </div>
                </div>
                <div className="assignment-empty-tip-card">
                  <div className="assignment-tip-icon">
                    <FolderOpen size={18} />
                  </div>
                  <div className="assignment-tip-text">
                    <strong>Theory & Practical</strong>
                    <span>Prepare for final course evaluation</span>
                  </div>
                </div>
                <div className="assignment-empty-tip-card">
                  <div className="assignment-tip-icon">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="assignment-tip-text">
                    <strong>Auto-Notifications</strong>
                    <span>Get alerted when tasks are published</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : isTheory ? (
          /* =========================================================
             THEORY FINAL ASSESSMENT CARD (Matches AssignmentPage)
             ========================================================= */
          <div className="student-final-card fa-theory-student-card">
            <div className="card-inner-header">
              <span className="fa-type-badge-pill">
                <BookOpen size={13} />
                <span>FINAL ASSESSMENT · {assessmentData.theory?.MODULE_NAME ? `${assessmentData.theory.MODULE_NAME.toUpperCase()} · ` : ""}THEORY</span>
              </span>
              <h2 className="card-inner-title">
                {assessmentData.theory?.SET_NAME || assessmentData.TITLE || "Theory Final Assessment"}
              </h2>
              <p className="card-inner-subtitle">
                {assessmentData.theory?.DESCRIPTION || assessmentData.DESCRIPTION || "Complete the theory final assessment questions."}
              </p>
            </div>

            <div className="form-section-divider" />

            {/* Assessment Details */}
            <div className="module-card-info-list" style={{ marginBottom: "24px" }}>
              <div className="module-info-row">
                <div className="module-info-icon">
                  <FileText size={18} />
                </div>
                <div className="module-info-text">
                  <span className="module-info-label">Questions</span>
                  <strong className="module-info-value">
                    {assessmentData.theory?.QUESTION_COUNT || 0} Questions
                  </strong>
                </div>
              </div>

              {assessmentData.theory?.isAttempted && (
                <div className="module-info-row">
                  <div className="module-info-icon" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981" }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="module-info-text">
                    <span className="module-info-label">Score / Status</span>
                    <strong className="module-info-value" style={{ color: "#10b981" }}>
                      Completed · {assessmentData.theory?.MARK_PERCENTAGE !== null ? `${assessmentData.theory?.MARK_PERCENTAGE}%` : "Attempted"}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section-divider" />

            {/* Actions: Start Assessment / Completed Badge */}
            <div className="fa-theory-footer-actions">
              {assessmentData.theory?.isAttempted ? (
                <button
                  type="button"
                  className="module-completed-btn-final"
                  disabled
                >
                  <span>Already Completed the Assessment</span>
                  <CheckCircle2 size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-start-theory-exam"
                  onClick={handleStartTheoryExam}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Start Theory Final Assessment</span>
                </button>
              )}
            </div>
          </div>
        ) : isPracticalCompleted ? (
          /* =========================================================
             PRACTICAL COMPLETED STATE
             ========================================================= */
          <div className="student-final-card completed-state-card">
            <div className="card-inner-header">
              <h2 className="card-inner-title">Assessment Information</h2>
              <p className="card-inner-subtitle">Assessment Completed</p>
            </div>

            <div className="form-section-divider" />

            <div className="assessment-field-group">
              <span className="assessment-field-label-bold">TITLE</span>
              <div className="assessment-title-text">
                {assessmentData.practical?.TITLE || "Practical Final Assessment"}
              </div>
            </div>

            <div className="form-section-divider" />

            <div className="assessment-field-group">
              <span className="assessment-field-label-bold">DESCRIPTION</span>
              <div className="assessment-desc-text">
                {assessmentData.practical?.DESCRIPTION ||
                  "Complete the practical final assessment and submit the required evidence."}
              </div>
            </div>

            <div className="form-section-divider" />

            <div className="assessment-completed-footer">
              <button
                type="button"
                className="module-completed-btn-final"
                disabled
              >
                <span>Already Completed the Assessment</span>
                <CheckCircle2 size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================
             PRACTICAL SUBMISSION FORM (UNCHANGED)
             ========================================================= */
          <form onSubmit={handleSubmitPractical} className="student-final-card">
            <div className="card-inner-header">
              <h2 className="card-inner-title">Assessment Information</h2>
              <p className="card-inner-subtitle">
                Submit the required images and videos for your final assessment.
              </p>
            </div>

            <div className="form-section-divider" />

            <div className="assessment-field-group">
              <span className="assessment-field-label-bold">TITLE</span>
              <div className="assessment-title-text">
                {assessmentData.practical?.TITLE || "Practical Final Assessment"}
              </div>
            </div>

            <div className="form-section-divider" />

            <div className="assessment-field-group">
              <span className="assessment-field-label-bold">DESCRIPTION</span>
              <div className="assessment-desc-text">
                {assessmentData.practical?.DESCRIPTION ||
                  "Complete the practical final assessment and submit the required evidence."}
              </div>
            </div>

            <div className="form-section-divider" />

            <div className="project-evidence-section-header">
              <h3 className="project-evidence-title">PROJECT EVIDENCE</h3>
              <p className="project-evidence-subtitle">
                Upload 1 project image and 1 demonstration video below. You can save partially and return anytime.
              </p>
            </div>

            <div className="project-evidence-grid">
              {/* Image */}
              <div className="project-evidence-card">
                <div className="evidence-card-header">
                  <label className="evidence-label">
                    Image <span className="req-star">*</span>
                  </label>
                  <span className="evidence-helper-text">
                    {savedImage && !image1 ? "Existing image uploaded (Saved)" : "Upload your project image"}
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef1}
                  style={{ display: "none" }}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => handleImageChange(e.target.files[0])}
                />

                {image1 ? (
                  <div className="evidence-file-selected-box">
                    <div className="selected-file-left">
                      <div className="selected-check-circle">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="selected-file-details">
                        <span className="selected-filename" title={image1.name}>
                          {image1.name}
                        </span>
                        <span className="selected-filesize">
                          {formatFileSize(image1.size)} · (Ready to save)
                        </span>
                      </div>
                    </div>

                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="btn-change-file"
                        onClick={() =>
                          fileInputRef1.current && fileInputRef1.current.click()
                        }
                      >
                        Change file
                      </button>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => removeFile("image")}
                        title="Remove file"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ) : savedImage ? (
                  <div className="evidence-file-selected-box">
                    <div className="selected-file-left">
                      <div className="selected-check-circle">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="selected-file-details">
                        <span className="selected-filename" title="Uploaded Image">
                          Image Uploaded
                        </span>
                        <span className="selected-filesize" style={{ color: "#38bdf8" }}>
                          Saved in submission
                        </span>
                      </div>
                    </div>

                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="btn-change-file"
                        onClick={() =>
                          fileInputRef1.current && fileInputRef1.current.click()
                        }
                      >
                        Replace image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="evidence-upload-dropzone"
                    onClick={() =>
                      fileInputRef1.current && fileInputRef1.current.click()
                    }
                  >
                    <div className="dropzone-icon-box">
                      <ImageIcon size={26} />
                    </div>
                    <span className="dropzone-main-text">Click to upload image</span>
                    <span className="dropzone-sub-formats">JPG • PNG • WEBP</span>
                  </div>
                )}
              </div>

              {/* Video */}
              <div className="project-evidence-card">
                <div className="evidence-card-header">
                  <label className="evidence-label">
                    Video <span className="req-star">*</span>
                  </label>
                  <span className="evidence-helper-text">
                    {savedVideo && !video1 ? "Existing video uploaded (Saved)" : "Upload your project video"}
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRefVid1}
                  style={{ display: "none" }}
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                  onChange={(e) => handleVideoChange(e.target.files[0])}
                />

                {video1 ? (
                  <div className="evidence-file-selected-box video-variant">
                    <div className="selected-file-left">
                      <div className="selected-check-circle">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="selected-file-details">
                        <span className="selected-filename" title={video1.name}>
                          {video1.name}
                        </span>
                        <span className="selected-filesize">
                          {formatFileSize(video1.size)} · (Ready to save)
                        </span>
                      </div>
                    </div>

                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="btn-change-file"
                        onClick={() =>
                          fileInputRefVid1.current &&
                          fileInputRefVid1.current.click()
                        }
                      >
                        Change video
                      </button>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={() => removeFile("video")}
                        title="Remove video"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ) : savedVideo ? (
                  <div className="evidence-file-selected-box video-variant">
                    <div className="selected-file-left">
                      <div className="selected-check-circle">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="selected-file-details">
                        <span className="selected-filename" title="Uploaded Video">
                          Video Uploaded
                        </span>
                        <span className="selected-filesize" style={{ color: "#38bdf8" }}>
                          Saved in submission
                        </span>
                      </div>
                    </div>

                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="btn-change-file"
                        onClick={() =>
                          fileInputRefVid1.current &&
                          fileInputRefVid1.current.click()
                        }
                      >
                        Replace video
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="evidence-upload-dropzone"
                    onClick={() =>
                      fileInputRefVid1.current &&
                      fileInputRefVid1.current.click()
                    }
                  >
                    <div className="dropzone-icon-box">
                      <Video size={26} />
                    </div>
                    <span className="dropzone-main-text">Click to upload video</span>
                    <span className="dropzone-sub-formats">MP4 • MOV • WEBM</span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-section-divider" />

            {/* Actions: Clear & Submit */}
            <div className="form-button-row">
              {(image1 || video1) && (
                <button
                  type="button"
                  className="btn-form-clear"
                  onClick={handleClearAll}
                  disabled={submitting}
                >
                  Clear Selection
                </button>
              )}

              <button
                type="submit"
                className="btn-form-submit"
                disabled={submitting || (!image1 && !video1)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="btn-action-spinner" size={17} />
                    <span>Saving...</span>
                  </>
                ) : hasImage && hasVideo ? (
                  <>
                    <Upload size={17} />
                    <span>Complete & Submit</span>
                  </>
                ) : (
                  <>
                    <Upload size={17} />
                    <span>Save Progress</span>
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

export default StudentFinalAssessment;
