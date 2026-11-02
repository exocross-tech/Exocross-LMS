import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  X as CloseIcon,
  Award,
  BookOpen,
  User,
  GraduationCap,
  Calendar,
  Image as ImageIcon,
  Video as VideoIcon,
  MessageSquare,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import "./AssessmentEvaluation.css";
import { finalAssessmentApi } from "../../services/apiService";
import { formatStudentRollNo } from "../../utils/formatRollNo";

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    height: "44px",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    border: state.isFocused ? "1px solid #00e5ff" : "1px solid #334155",
    borderRadius: "10px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 229, 255, 0.12)" : "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#f8fafc",
    fontSize: "0.875rem",
    fontWeight: "500",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b",
    fontSize: "0.875rem",
  }),
  input: (base) => ({
    ...base,
    color: "#fff",
    fontSize: "0.875rem",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#00e5ff" : "#94a3b8",
    transition: "color 0.2s ease",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 999999,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    overflow: "hidden",
    zIndex: 999999,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.6)",
  }),
  menuList: (base) => ({
    ...base,
    padding: "6px",
    backgroundColor: "#0f172a",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "rgba(0, 240, 255, 0.2)"
      : state.isFocused
      ? "rgba(0, 229, 255, 0.1)"
      : "transparent",
    color: state.isSelected ? "#00f0ff" : "#f8fafc",
    borderRadius: "6px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: state.isSelected ? "600" : "400",
    transition: "all 0.15s ease",
  }),
};

const statusOptions = [
  { value: "ALL", label: "All Submissions" },
  { value: "Pending", label: "Pending" },
  { value: "Submitted", label: "Submitted" },
];

const AssessmentEvaluation = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [assessmentType, setAssessmentType] = useState("THEORY"); // "THEORY" | "PRACTICAL"
  const [submissions, setSubmissions] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal / Preview state
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [evalMarks, setEvalMarks] = useState(""); // Overall mark: 0 to 100
  const [evalComment, setEvalComment] = useState("");
  const [submittingEval, setSubmittingEval] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  // Publish Modal state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishStudents, setPublishStudents] = useState([]);
  const [selectedPublishStudentIds, setSelectedPublishStudentIds] = useState(new Set());
  const [isPublishing, setIsPublishing] = useState(false);

  // Get current logged-in user with robust storage check
  const getStoredUser = () => {
    try {
      const storageKeys = [
        "ASA_LMSUser",
        "LMSUser",
        "user",
        "currentUser",
        "authUser",
      ];
      for (const key of storageKeys) {
        const sessionVal = sessionStorage.getItem(key);
        if (sessionVal) {
          try {
            const parsed = JSON.parse(sessionVal);
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              return parsed;
            }
          } catch (_) {}
        }
        const localVal = localStorage.getItem(key);
        if (localVal) {
          try {
            const parsed = JSON.parse(localVal);
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              return parsed;
            }
          } catch (_) {}
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to read stored user:", e);
      return null;
    }
  };

  const user = getStoredUser();
  const userId =
    user?.USER_ID ||
    user?.userId ||
    user?.ID ||
    user?.id ||
    user?.TUTOR_ID ||
    user?.USERID;

  const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "";
    if (baseUrl) {
      const normalizedBase = baseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
      return `${normalizedBase}/${cleanPath}`;
    }
    return `/${cleanPath}`;
  };

  // Fetch batches hosted by this tutor
  const fetchBatches = async () => {
    if (!userId) {
      setLoadingBatches(false);
      return;
    }

    setLoadingBatches(true);
    try {
      const res = await finalAssessmentApi.getTutorBatches(userId);
      if (res.data && res.data.status === 1) {
        const batchList = Array.isArray(res.data.data) ? res.data.data : [];
        const formatted = batchList.map((b) => ({
          value: Number(b.BATCH_ID || b.ID),
          label: b.BATCH_CODE,
          raw: b,
        }));
        setBatches(formatted);
        if (formatted.length > 0) {
          setSelectedBatch(formatted[0]);
        }
      } else {
        setBatches([]);
        toast.warn(res.data?.message || "No assigned batches found.");
      }
    } catch (err) {
      console.error("fetchBatches error:", err);
      toast.error("Failed to load tutor batches.");
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Fetch student submissions for the selected batch and assessment type
  const fetchSubmissions = async (batchId, type = assessmentType) => {
    if (!batchId) {
      setSubmissions([]);
      return;
    }
    setLoadingSubmissions(true);
    try {
      const res = await finalAssessmentApi.getEvaluationSubmissions(
        batchId,
        userId,
        type
      );
      if (res.data && res.data.status === 1) {
        setSubmissions(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setSubmissions([]);
      }
    } catch (err) {
      console.error("fetchSubmissions error:", err);
      toast.error("Failed to load student submissions.");
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [userId]);

  useEffect(() => {
    if (selectedBatch?.value) {
      fetchSubmissions(selectedBatch.value, assessmentType);
    } else {
      setSubmissions([]);
    }
  }, [selectedBatch, assessmentType]);

  // Filtered and Sorted submissions
  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.STATUS === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          (s.STUDENT_NAME && s.STUDENT_NAME.toLowerCase().includes(term)) ||
          (s.STUDENT_EMAIL && s.STUDENT_EMAIL.toLowerCase().includes(term)) ||
          (s.STUDENT_ROLL_NO && String(s.STUDENT_ROLL_NO).toLowerCase().includes(term)) ||
          (s.ASSESSMENT_TITLE && s.ASSESSMENT_TITLE.toLowerCase().includes(term))
      );
    }

    // Sort order: Submitted first, Pending after
    list.sort((a, b) => {
      const isSubmittedA = a.STATUS === "Submitted" ? 0 : 1;
      const isSubmittedB = b.STATUS === "Submitted" ? 0 : 1;
      if (isSubmittedA !== isSubmittedB) return isSubmittedA - isSubmittedB;
      return new Date(b.SUBMITTED_AT || 0) - new Date(a.SUBMITTED_AT || 0);
    });

    return list;
  }, [submissions, statusFilter, searchTerm]);

  // Open preview modal
  const handleOpenPreview = async (submission) => {
    setActiveSubmission(submission);
    setPreviewLoading(true);
    setEvalMarks(
      submission.GIVEN_MARKS !== null &&
      submission.GIVEN_MARKS !== undefined &&
      submission.GIVEN_MARKS !== ""
        ? String(submission.GIVEN_MARKS)
        : ""
    );
    setEvalComment(submission.COMMENT || "");

    try {
      const res = await finalAssessmentApi.getSubmissionPreview(
        submission.SUBMISSION_ID,
        userId,
        assessmentType,
        submission.STUDENT_ID
      );
      if (res.data && res.data.status === 1) {
        const pData = res.data.data;
        setPreviewData(pData);
        if (
          pData.GIVEN_MARKS !== null &&
          pData.GIVEN_MARKS !== undefined &&
          pData.GIVEN_MARKS !== ""
        ) {
          setEvalMarks(String(pData.GIVEN_MARKS));
        }
        if (pData.COMMENT) {
          setEvalComment(pData.COMMENT);
        }
      } else {
        toast.error(res.data?.message || "Failed to load submission details");
      }
    } catch (err) {
      console.error("handleOpenPreview error:", err);
      toast.error("Failed to fetch full preview details.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setActiveSubmission(null);
    setPreviewData(null);
    setEvalMarks("");
    setEvalComment("");
  };

  // Submit evaluation (0 to 100 mark + feedback)
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!activeSubmission) return;

    if (
      evalMarks === "" ||
      evalMarks === null ||
      evalMarks === undefined ||
      isNaN(Number(evalMarks))
    ) {
      toast.warn("Please enter a mark between 0 and 100.");
      return;
    }

    const marksNum = Number(evalMarks);
    if (marksNum < 0 || marksNum > 100) {
      toast.warn("Mark must be between 0 and 100.");
      return;
    }

    setSubmittingEval(true);
    try {
      const payload = {
        submissionId: activeSubmission.SUBMISSION_ID,
        studentId: activeSubmission.STUDENT_ID,
        batchId: selectedBatch?.value,
        assessmentType: assessmentType,
        type: assessmentType,
        givenMarks: marksNum,
        comment: evalComment.trim(),
        tutorId: userId,
      };

      const res = await finalAssessmentApi.submitEvaluation(payload);
      if (res.data && res.data.status === 1) {
        toast.success(res.data.message || "Evaluation submitted successfully!");
        handleClosePreview();
        if (selectedBatch?.value) {
          fetchSubmissions(selectedBatch.value, assessmentType);
        }
      } else {
        toast.error(res.data?.message || "Failed to submit evaluation.");
      }
    } catch (err) {
      console.error("handleSaveEvaluation error:", err);
      toast.error(
        err.response?.data?.message || "Error submitting evaluation."
      );
    } finally {
      setSubmittingEval(false);
    }
  };

  // Open publish modal & fetch students with evaluated marks
  const handleOpenPublishModal = async () => {
    if (!selectedBatch?.value) {
      toast.warn("Please select a batch first.");
      return;
    }
    setIsPublishModalOpen(true);
    setPublishLoading(true);
    try {
      const res = await finalAssessmentApi.getPublishStudents(
        selectedBatch.value,
        userId
      );
      if (res.data && res.data.status === 1) {
        const studentList = Array.isArray(res.data.data) ? res.data.data : [];
        setPublishStudents(studentList);
        // Pre-select ONLY students whose USERS.IS_CERTIFICATE === 1
        const initialSelected = new Set();
        studentList.forEach((s) => {
          if (s.IS_ELIGIBLE && Number(s.IS_CERTIFICATE) === 1) {
            initialSelected.add(Number(s.STUDENT_ID));
          }
        });
        setSelectedPublishStudentIds(initialSelected);
      } else {
        setPublishStudents([]);
        setSelectedPublishStudentIds(new Set());
        toast.error(res.data?.message || "Failed to load student evaluation records for publishing.");
      }
    } catch (err) {
      console.error("handleOpenPublishModal error:", err);
      toast.error("Error loading students for publishing.");
      setPublishStudents([]);
      setSelectedPublishStudentIds(new Set());
    } finally {
      setPublishLoading(false);
    }
  };

  const handleClosePublishModal = () => {
    setIsPublishModalOpen(false);
    setPublishStudents([]);
    setSelectedPublishStudentIds(new Set());
  };

  const handleToggleStudent = (studentId, isEligible) => {
    if (!isEligible) return;
    const numId = Number(studentId);
    setSelectedPublishStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(numId)) {
        next.delete(numId);
      } else {
        next.add(numId);
      }
      return next;
    });
  };

  const handleToggleAllEligible = () => {
    const eligibleStudents = publishStudents.filter((s) => s.IS_ELIGIBLE);
    if (eligibleStudents.length === 0) return;

    const allEligibleSelected = eligibleStudents.every((s) =>
      selectedPublishStudentIds.has(Number(s.STUDENT_ID))
    );

    if (allEligibleSelected) {
      setSelectedPublishStudentIds(new Set());
    } else {
      const next = new Set();
      eligibleStudents.forEach((s) => next.add(Number(s.STUDENT_ID)));
      setSelectedPublishStudentIds(next);
    }
  };

  const handleSubmitPublish = async () => {
    if (!selectedBatch?.value) return;

    setIsPublishing(true);
    try {
      const payload = {
        batchId: selectedBatch.value,
        tutorId: userId,
        selectedStudentIds: Array.from(selectedPublishStudentIds),
      };

      const res = await finalAssessmentApi.publishCertificates(payload);
      if (res.data && res.data.status === 1) {
        toast.success(res.data.message || "Certificates published successfully!");
        handleClosePublishModal();
        if (selectedBatch?.value) {
          fetchSubmissions(selectedBatch.value, assessmentType);
        }
      } else {
        toast.error(res.data?.message || "Failed to publish certificates.");
      }
    } catch (err) {
      console.error("handleSubmitPublish error:", err);
      toast.error(
        err.response?.data?.message || "Error occurred while publishing certificates."
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const submittedCount = submissions.filter((s) => s.STATUS === "Submitted").length;
  const pendingCount = submissions.filter((s) => s.STATUS === "Pending").length;

  return (
    <div className="assessment-evaluation-page">
      {/* HEADER */}
      <div className="eval-header-section">
        <div className="eval-section-badge">
          <Sparkles size={13} className="live-dot" />
          <span>TUTOR / FINAL ASSESSMENT EVALUATION</span>
        </div>
        <div className="eval-header-row">
          <div>
            <h1 className="eval-main-title">Final Assessment Evaluation</h1>
            <p className="eval-subtitle">
              Review submissions, grade individual questions, and evaluate {assessmentType === "THEORY" ? "Theory" : "Practical"} final assessments.
            </p>
          </div>
          <div className="eval-header-actions">
            <button
              type="button"
              className="eval-publish-btn"
              onClick={handleOpenPublishModal}
              disabled={!selectedBatch}
              title="Publish certificates for evaluated students in this batch"
            >
              <Award size={15} />
              <span>Publish</span>
            </button>
            <button
              type="button"
              className="eval-refresh-btn"
              onClick={() => selectedBatch?.value && fetchSubmissions(selectedBatch.value, assessmentType)}
              disabled={loadingSubmissions || !selectedBatch}
              title="Refresh submissions"
            >
              <RefreshCw size={15} className={loadingSubmissions ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP CONTROLS & STATS */}
      <div className="eval-controls-grid">
        <div className="eval-control-card">
          <div className="eval-control-row">
            <div className="eval-control-field flex-1">
              <label className="control-label">
                <BookOpen size={14} />
                <span>Select Batch</span>
              </label>
              <Select
                options={batches}
                value={selectedBatch}
                onChange={(opt) => setSelectedBatch(opt)}
                placeholder={loadingBatches ? "Loading batches..." : "Select Batch..."}
                isLoading={loadingBatches}
                styles={customSelectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                isClearable={false}
              />
            </div>

            <div className="eval-control-field">
              <label className="control-label">
                <Award size={14} />
                <span>Assessment Type</span>
              </label>
              <div className="type-toggle-group">
                <button
                  type="button"
                  className={`type-toggle-btn ${assessmentType === "THEORY" ? "active" : ""}`}
                  onClick={() => setAssessmentType("THEORY")}
                >
                  Theory
                </button>
                <button
                  type="button"
                  className={`type-toggle-btn ${assessmentType === "PRACTICAL" ? "active" : ""}`}
                  onClick={() => setAssessmentType("PRACTICAL")}
                >
                  Practical
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="eval-stats-card">
          <div className="eval-stat-item">
            <span className="stat-label">Total Submissions</span>
            <span className="stat-value total">{submissions.length}</span>
          </div>
          <div className="eval-stat-divider" />
          <div className="eval-stat-item">
            <span className="stat-label">Submitted</span>
            <span className="stat-value submitted">{submittedCount}</span>
          </div>
          <div className="eval-stat-divider" />
          <div className="eval-stat-item">
            <span className="stat-label">Pending</span>
            <span className="stat-value pending">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* TABLE WORKSPACE CONTAINER */}
      <div className="eval-workspace-card">
        {/* TOOLBAR */}
        <div className="eval-toolbar">
          <div className="eval-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by student name, roll no, or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchTerm("")}
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>

          <div className="eval-filter-group">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`filter-btn ${statusFilter === opt.value ? "active" : ""}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* SUBMISSIONS TABLE */}
        <div className="table-responsive">
          <table className="eval-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>ID</th>
                <th>Student Name</th>
                <th>Assessment Title</th>
                <th>Submitted Date</th>
                <th style={{ width: "120px" }}>Marks</th>
                <th style={{ width: "140px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingSubmissions ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">
                    <div className="eval-loading-state">
                      <RefreshCw size={24} className="spin" />
                      <span>Loading batch submissions...</span>
                    </div>
                  </td>
                </tr>
              ) : !selectedBatch ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">
                    <div className="eval-no-data">
                      <BookOpen size={36} />
                      <p>Please select a batch from the dropdown above to view student submissions.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">
                    <div className="eval-no-data">
                      <ClipboardCheck size={36} />
                      <p>No student submissions found matching the criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const isSubmitted = sub.STATUS === "Submitted";
                  const isEvaluated =
                    sub.GIVEN_MARKS !== null &&
                    sub.GIVEN_MARKS !== undefined &&
                    sub.GIVEN_MARKS !== "";

                  return (
                    <tr key={sub.SUBMISSION_ID || idx} className={isSubmitted ? "row-submitted" : "row-pending"}>
                      <td className="col-idx">{idx + 1}</td>
                      <td>
                        <div className="student-cell">
                          <div className="student-avatar">
                            {sub.STUDENT_NAME ? sub.STUDENT_NAME.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div className="student-details">
                            <span className="student-name">{sub.STUDENT_NAME || "Student"}</span>
                            <span className="student-meta">
                              {sub.STUDENT_ROLL_NO ? `Roll: ${formatStudentRollNo(sub.STUDENT_ROLL_NO)}` : sub.STUDENT_EMAIL || ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="title-cell">
                          <span className="assessment-title-text">{sub.ASSESSMENT_TITLE || "Final Assessment"}</span>
                          <span className="assessment-batch-tag">{sub.BATCH_CODE || selectedBatch?.label?.split(" · ")[0]}</span>
                        </div>
                      </td>
                      <td>
                        <span className="date-cell">{formatDate(sub.SUBMITTED_AT)}</span>
                      </td>
                      <td>
                        {isEvaluated ? (
                          <div className="marks-badge">
                            <span className="marks-val">{sub.GIVEN_MARKS}</span>
                          </div>
                        ) : (
                          <span className="unmarked-label">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="status-action-cell">
                          {isEvaluated ? (
                            <span
                              className="eval-status-badge status-submitted"
                              style={{ cursor: "default", userSelect: "none" }}
                              title="Assessment has been reviewed"
                            >
                              <CheckCircle2 size={13} />
                              <span>Reviewed</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="eval-preview-btn"
                              onClick={() => handleOpenPreview(sub)}
                            >
                              <Eye size={13} />
                              <span>Preview</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PREVIEW & EVALUATION MODAL */}
      {activeSubmission && (
        <div className="eval-modal-backdrop" onClick={handleClosePreview}>
          <div
            className="eval-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="eval-modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-wrap">
                  <Award size={22} />
                </div>
                <div>
                  <h2 className="modal-title">Student Assessment Evaluation</h2>
                  <p className="modal-subtitle">
                    {activeSubmission.STUDENT_NAME} · {activeSubmission.ASSESSMENT_TITLE || "Final Assessment"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleClosePreview}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="eval-modal-body">
              {previewLoading ? (
                <div className="modal-loading-box">
                  <RefreshCw size={28} className="spin" />
                  <span>Loading assessment submission details...</span>
                </div>
              ) : (
                (() => {
                  const currentImage = previewData?.IMAGE_1 || activeSubmission?.IMAGE_1;
                  const currentVideo = previewData?.VIDEO_1 || activeSubmission?.VIDEO_1;
                  
                  const isSubmitted = Boolean(
                    previewData
                      ? (previewData.STATUS === "Submitted" && previewData.SUBMITTED_AT)
                      : (activeSubmission?.STATUS === "Submitted" && activeSubmission?.SUBMITTED_AT)
                  );

                  const isEvaluated = Boolean(
                    isSubmitted && (
                      (previewData?.GIVEN_MARKS !== null && previewData?.GIVEN_MARKS !== undefined && previewData?.GIVEN_MARKS !== "") ||
                      (activeSubmission?.GIVEN_MARKS !== null && activeSubmission?.GIVEN_MARKS !== undefined && activeSubmission?.GIVEN_MARKS !== "") ||
                      previewData?.isEvaluated ||
                      activeSubmission?.isEvaluated
                    )
                  );

                  const isComplete = assessmentType === "THEORY" ? isSubmitted : Boolean(currentImage && currentVideo);

                  return (
                    <div className="eval-modal-grid">
                      {/* LEFT COLUMN: SUBMISSION DETAILS & QUESTIONS/MEDIA */}
                      <div className="eval-details-pane">
                        {/* STUDENT INFO CARD */}
                        <div className="pane-section-card">
                          <h4 className="pane-card-title">
                            <User size={16} />
                            <span>Student Information</span>
                          </h4>
                          <div className="info-kv-grid">
                            <div className="kv-item">
                              <span className="kv-label">Name</span>
                              <span className="kv-val">{previewData?.STUDENT_NAME || activeSubmission.STUDENT_NAME}</span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Email</span>
                              <span className="kv-val">{previewData?.STUDENT_EMAIL || activeSubmission.STUDENT_EMAIL || "—"}</span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Roll No</span>
                              <span className="kv-val">{formatStudentRollNo(previewData?.STUDENT_ROLL_NO || activeSubmission.STUDENT_ROLL_NO)}</span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Grade / Batch</span>
                              <span className="kv-val">
                                {previewData?.STUDENT_GRADE ? `Grade ${previewData.STUDENT_GRADE} · ` : ""}
                                {previewData?.BATCH_CODE || activeSubmission.BATCH_CODE}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Submitted On</span>
                              <span className="kv-val">{formatDate(previewData?.SUBMITTED_AT || activeSubmission.SUBMITTED_AT)}</span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Submission Status</span>
                              <span className="kv-val">
                                <span className={`eval-status-badge ${isSubmitted ? "status-submitted" : "status-pending"}`}>
                                  {isSubmitted ? "Submitted" : "Not Submitted"}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* THEORY: QUESTIONS & STUDENT ANSWERS LIST */}
                        {assessmentType === "THEORY" ? (
                          <div className="pane-section-card">
                            <div className="pane-card-title-row">
                              <h4 className="pane-card-title">
                                <BookOpen size={16} />
                                <span>Questions & Student Answers</span>
                              </h4>
                              <span className="questions-count-badge">
                                {(previewData?.questions || []).length} Questions
                              </span>
                            </div>

                            {previewData?.ASSESSMENT_DESCRIPTION && (
                              <div className="assessment-desc-box">
                                {previewData.ASSESSMENT_DESCRIPTION}
                              </div>
                            )}

                            <div className="questions-evaluation-list">
                              {(previewData?.questions || []).map((q, qIdx) => {
                                const qKey = q.QUESTION_ID || qIdx + 1;

                                return (
                                  <div key={qKey} className="question-eval-card">
                                    <div className="q-eval-header">
                                      <span className="q-badge">Question {qIdx + 1}</span>
                                    </div>

                                    <div className="q-text-section">
                                      <p className="q-prompt-text">{q.QUESTION_TEXT}</p>
                                    </div>

                                    {/* STUDENT ANSWER DISPLAY */}
                                    <div className="student-answer-display-box">
                                      <div className="answer-header">
                                        <MessageSquare size={13} />
                                        <span>Student Answer:</span>
                                      </div>
                                      <div className="answer-content">
                                        {q.STUDENT_ANSWER && q.STUDENT_ANSWER !== "No answer submitted" ? (
                                          <p className="student-answer-text">{q.STUDENT_ANSWER}</p>
                                        ) : (
                                          <p className="student-answer-empty">No answer submitted by student.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* PRACTICAL: CONTEXT & MEDIA FILES */
                          <>
                            {/* ASSESSMENT DESCRIPTION */}
                            <div className="pane-section-card">
                              <h4 className="pane-card-title">
                                <BookOpen size={16} />
                                <span>Practical Task</span>
                              </h4>
                              <div className="assessment-desc-box">
                                {previewData?.ASSESSMENT_DESCRIPTION || "Practical Final Assessment Task"}
                              </div>
                            </div>

                            {/* SUBMITTED IMAGE (1 IMAGE) */}
                            <div className="pane-section-card">
                              <h4 className="pane-card-title">
                                <ImageIcon size={16} />
                                <span>Submitted Image</span>
                              </h4>
                              <div className="media-images-grid" style={{ gridTemplateColumns: "1fr" }}>
                                <div className="media-card image-media-card">
                                  <span className="media-label">Project Image</span>
                                  {currentImage ? (
                                    <div
                                      className="media-img-wrapper"
                                      onClick={() => setSelectedImageModal(getMediaUrl(currentImage))}
                                    >
                                      <img
                                        src={getMediaUrl(currentImage)}
                                        alt="Project Image"
                                        onError={(e) => {
                                          e.target.style.display = "none";
                                          if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                        }}
                                      />
                                      <div className="media-fallback" style={{ display: "none" }}>
                                        <ImageIcon size={24} />
                                        <span>Image could not load</span>
                                      </div>
                                      <div className="img-hover-overlay">
                                        <Eye size={18} />
                                        <span>Click to view</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="media-empty">
                                      <ImageIcon size={22} />
                                      <span>Image not submitted</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* SUBMITTED VIDEO (1 VIDEO) */}
                            <div className="pane-section-card">
                              <h4 className="pane-card-title">
                                <VideoIcon size={16} />
                                <span>Submitted Video</span>
                              </h4>
                              <div className="media-videos-grid" style={{ gridTemplateColumns: "1fr" }}>
                                <div className="media-card video-media-card">
                                  <span className="media-label">Project Video</span>
                                  {currentVideo ? (
                                    <div className="media-video-wrapper">
                                      <video
                                        controls
                                        preload="metadata"
                                        src={getMediaUrl(currentVideo)}
                                      >
                                        Your browser does not support the video tag.
                                      </video>
                                    </div>
                                  ) : (
                                    <div className="media-empty">
                                      <VideoIcon size={22} />
                                      <span>Video not submitted</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* RIGHT COLUMN: EVALUATION FORM */}
                      <div className="eval-form-pane">
                        <div className="eval-form-card">
                          <div className="eval-pane-header">
                            <h4 className="pane-card-title">
                              <Award size={18} />
                              <span>Tutor Evaluation</span>
                            </h4>
                            <p className="pane-card-subtitle">
                              Provide the evaluated marks (0–100) and constructive feedback for the student.
                            </p>
                          </div>

                          {!isSubmitted && (
                            <div className="eval-disabled-warning-box">
                              <div className="eval-disabled-title">
                                <Clock size={16} />
                                <strong>Evaluation Disabled:</strong>
                              </div>
                              <p className="eval-disabled-desc">
                                The student has not submitted the assessment. Evaluation can only be performed after the student submits the assessment.
                              </p>
                            </div>
                          )}

                          <form onSubmit={handleSaveEvaluation}>
                            <div className="form-field-group">
                              <label className="eval-field-label">
                                <span>GIVEN MARKS <span style={{ color: "#ef4444" }}>*</span> (Max 100)</span>
                              </label>
                              <div className="marks-input-wrapper">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  placeholder="e.g. 85"
                                  value={evalMarks}
                                  onChange={(e) => setEvalMarks(e.target.value)}
                                  disabled={!isSubmitted || submittingEval}
                                  required
                                  className="eval-overall-mark-input"
                                />
                                <span className="marks-denom">/100</span>
                              </div>
                            </div>

                            <div className="form-field-group">
                              <label className="eval-field-label">
                                <MessageSquare size={13} />
                                <span>TUTOR COMMENT / FEEDBACK</span>
                              </label>
                              <textarea
                                rows="5"
                                placeholder="Add your evaluation remarks, strengths, and areas of improvement..."
                                value={evalComment}
                                onChange={(e) => setEvalComment(e.target.value)}
                                disabled={!isSubmitted || submittingEval}
                              />
                            </div>

                            {previewData?.EVALUATOR_NAME && isEvaluated && (
                              <div className="eval-history-box" style={{ marginTop: "12px" }}>
                                <span className="history-label">Last Evaluated By:</span>
                                <span className="history-val">
                                  {previewData.EVALUATOR_NAME}
                                  {previewData.EVALUATED_AT ? ` on ${formatDate(previewData.EVALUATED_AT)}` : ""}
                                </span>
                              </div>
                            )}

                            <div className="eval-actions-row" style={{ marginTop: "24px" }}>
                              <button
                                type="button"
                                className="eval-btn-secondary"
                                onClick={handleClosePreview}
                                disabled={submittingEval}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="eval-btn-primary"
                                disabled={!isSubmitted || submittingEval}
                              >
                                {submittingEval ? (
                                  <>
                                    <RefreshCw size={16} className="spin" />
                                    <span>Submitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={16} />
                                    <span>Submit Evaluation</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSIZE IMAGE LIGHTBOX MODAL */}
      {selectedImageModal && (
        <div
          className="eval-image-lightbox"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImageModal} alt="Preview Zoom" />
            <button
              className="lightbox-close"
              onClick={() => setSelectedImageModal(null)}
            >
              <CloseIcon size={22} />
            </button>
            <a
              href={selectedImageModal}
              target="_blank"
              rel="noreferrer"
              className="lightbox-download"
            >
              <ExternalLink size={16} />
              <span>Open in new tab</span>
            </a>
          </div>
        </div>
      )}

      {/* =========================================================
          PUBLISH CERTIFICATES MODAL
      ========================================================= */}
      {isPublishModalOpen && (
        <div className="eval-modal-backdrop" onClick={handleClosePublishModal}>
          <div
            className="eval-publish-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="eval-modal-header">
              <div className="eval-modal-title-group">
                <div className="eval-modal-badge">
                  <Award size={13} />
                  <span>Certificate Publishing</span>
                </div>
                <h2 className="eval-modal-title">
                  Publish Certificates — {selectedBatch?.label || "Selected Batch"}
                </h2>
                <p className="eval-modal-desc">
                  Select eligible students with evaluated Theory or Practical marks to publish certificate eligibility.
                </p>
              </div>
              <button
                type="button"
                className="eval-modal-close-btn"
                onClick={handleClosePublishModal}
                title="Close"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="eval-publish-modal-body">
              {publishLoading ? (
                <div className="eval-publish-loading">
                  <RefreshCw size={28} className="spin" />
                  <p>Loading batch students and evaluation marks...</p>
                </div>
              ) : publishStudents.length === 0 ? (
                <div className="eval-publish-empty">
                  <Award size={36} />
                  <p>No students found in this batch.</p>
                </div>
              ) : (
                <div className="eval-publish-table-wrapper">
                  <table className="eval-publish-table">
                    <thead>
                      <tr>
                        <th style={{ width: "65px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className="eval-publish-checkbox"
                            checked={
                              publishStudents.filter((s) => s.IS_ELIGIBLE).length > 0 &&
                              publishStudents
                                .filter((s) => s.IS_ELIGIBLE)
                                .every((s) =>
                                  selectedPublishStudentIds.has(Number(s.STUDENT_ID))
                                )
                            }
                            onChange={handleToggleAllEligible}
                            title="Select / Deselect all eligible students"
                          />
                        </th>
                        <th>Student Name</th>
                        <th style={{ textAlign: "center", width: "150px" }}>Theory Mark</th>
                        <th style={{ textAlign: "center", width: "150px" }}>Practical Mark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishStudents.map((student) => {
                        const isEligible = student.IS_ELIGIBLE;
                        const isChecked = selectedPublishStudentIds.has(Number(student.STUDENT_ID));
                        const hasTheory =
                          student.THEORY_MARK !== null && student.THEORY_MARK !== undefined;
                        const hasPractical =
                          student.PRACTICAL_MARK !== null && student.PRACTICAL_MARK !== undefined;

                        return (
                          <tr
                            key={student.STUDENT_ID}
                            className={`eval-publish-row ${
                              !isEligible ? "row-disabled" : isChecked ? "row-selected" : ""
                            }`}
                            onClick={() => isEligible && handleToggleStudent(student.STUDENT_ID, isEligible)}
                            style={{ cursor: isEligible ? "pointer" : "not-allowed" }}
                          >
                            <td
                              style={{ textAlign: "center" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="eval-publish-checkbox"
                                checked={isChecked}
                                disabled={!isEligible}
                                onChange={() => handleToggleStudent(student.STUDENT_ID, isEligible)}
                                title={
                                  !isEligible
                                    ? "Student has no evaluated Theory or Practical mark"
                                    : isChecked
                                    ? "Unselect student"
                                    : "Select student"
                                }
                              />
                            </td>
                            <td>
                              <div className="student-cell">
                                <div className="student-avatar">
                                  {student.STUDENT_NAME
                                    ? student.STUDENT_NAME.charAt(0).toUpperCase()
                                    : "S"}
                                </div>
                                <div className="student-details">
                                  <span className="student-name">
                                    {student.STUDENT_NAME || "Student"}
                                  </span>
                                  <span className="student-meta">
                                    {student.SCHOOL_NAME ? `${student.SCHOOL_NAME}` : student.STUDENT_EMAIL || ""}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {hasTheory ? (
                                <span className="eval-mark-pill theory">
                                  {student.THEORY_MARK}
                                </span>
                              ) : (
                                <span className="eval-no-mark">—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {hasPractical ? (
                                <span className="eval-mark-pill practical">
                                  {student.PRACTICAL_MARK}
                                </span>
                              ) : (
                                <span className="eval-no-mark">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="eval-publish-modal-footer">
              <div className="eval-publish-summary-txt">
                <span>
                  <strong>{selectedPublishStudentIds.size}</strong> of{" "}
                  {publishStudents.filter((s) => s.IS_ELIGIBLE).length} eligible students selected
                </span>
              </div>
              <div className="eval-publish-footer-btns">
                <button
                  type="button"
                  className="eval-btn-secondary"
                  onClick={handleClosePublishModal}
                  disabled={isPublishing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="eval-btn-primary-publish"
                  onClick={handleSubmitPublish}
                  disabled={isPublishing || publishLoading || publishStudents.length === 0}
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Award size={15} />
                      <span>Submit / Publish</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentEvaluation;
