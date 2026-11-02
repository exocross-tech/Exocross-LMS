import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  Package,
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
  MessageSquare,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Edit3,
  Layers,
} from "lucide-react";
import "./ProjectKitEvaluation.css";
import { projectKitEvaluationApi, moduleApi } from "../../services/apiService";

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

const ProjectKitEvaluation = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState({ value: "ALL", label: "All Categories" });
  const [submissions, setSubmissions] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal / Preview state
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [evalCreativity, setEvalCreativity] = useState("");
  const [evalProblemSolving, setEvalProblemSolving] = useState("");
  const [evalComment, setEvalComment] = useState("");
  const [submittingEval, setSubmittingEval] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(null);

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

  // 1. Fetch batches assigned to this tutor
  const fetchBatches = async () => {
    if (!userId) {
      setLoadingBatches(false);
      return;
    }

    setLoadingBatches(true);
    try {
      const res = await projectKitEvaluationApi.getTutorBatches(userId);
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

  // 2. Fetch categories (active modules)
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await moduleApi.getActive();
      if (res.data && res.data.status === 1) {
        const catList = Array.isArray(res.data.data) ? res.data.data : [];
        const formatted = [
          { value: "ALL", label: "All Categories" },
          ...catList.map((c) => ({
            value: Number(c.ID),
            label: c.MODULE_NAME,
            raw: c,
          })),
        ];
        setCategories(formatted);
      } else {
        setCategories([{ value: "ALL", label: "All Categories" }]);
      }
    } catch (err) {
      console.error("fetchCategories error:", err);
      setCategories([{ value: "ALL", label: "All Categories" }]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // 3. Fetch Project Kit submissions for the selected batch and category
  const fetchSubmissions = async (batchId, catId) => {
    if (!batchId || !userId) {
      setSubmissions([]);
      return;
    }
    setLoadingSubmissions(true);
    try {
      const activeCat = catId !== undefined ? catId : selectedCategory?.value;
      const params = {
        tutorId: userId,
        batchId: batchId,
        status: statusFilter,
      };
      if (activeCat && activeCat !== "ALL") {
        params.categoryId = activeCat;
      }
      const res = await projectKitEvaluationApi.getSubmissions(params);
      if (res.data && res.data.status === 1) {
        setSubmissions(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setSubmissions([]);
      }
    } catch (err) {
      console.error("fetchSubmissions error:", err);
      toast.error("Failed to load project kit submissions.");
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchCategories();
  }, [userId]);

  useEffect(() => {
    if (selectedBatch?.value) {
      fetchSubmissions(selectedBatch.value, selectedCategory?.value);
    } else {
      setSubmissions([]);
    }
  }, [selectedBatch, statusFilter, selectedCategory]);

  // Filtered and Sorted submissions
  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];

    // Category filter
    if (selectedCategory?.value && selectedCategory.value !== "ALL") {
      const cId = Number(selectedCategory.value);
      list = list.filter((s) => Number(s.MODULE_ID || s.module_id) === cId);
    }

    // Status filter
    if (statusFilter === "Pending") {
      list = list.filter((s) => !s.IS_PROJECT_KIT_EVALUATED);
    } else if (statusFilter === "Submitted") {
      list = list.filter((s) => s.IS_PROJECT_KIT_EVALUATED);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          (s.STUDENT_NAME && s.STUDENT_NAME.toLowerCase().includes(term)) ||
          (s.STUDENT_EMAIL && s.STUDENT_EMAIL.toLowerCase().includes(term)) ||
          (s.STUDENT_MOBILE && String(s.STUDENT_MOBILE).toLowerCase().includes(term)) ||
          (s.ASSESSMENT_NAME && s.ASSESSMENT_NAME.toLowerCase().includes(term)) ||
          (s.PROJECT_KIT_NAME && s.PROJECT_KIT_NAME.toLowerCase().includes(term)) ||
          (s.CATEGORY_NAME && s.CATEGORY_NAME.toLowerCase().includes(term)) ||
          (s.MODULE_NAME && s.MODULE_NAME.toLowerCase().includes(term))
      );
    }

    // Sort order: Pending first or recent reviewed submissions
    list.sort((a, b) => {
      const isEvalA = a.IS_PROJECT_KIT_EVALUATED ? 1 : 0;
      const isEvalB = b.IS_PROJECT_KIT_EVALUATED ? 1 : 0;
      if (isEvalA !== isEvalB) return isEvalA - isEvalB;
      if (isEvalA === 1) {
        return (
          new Date(b.PROJECT_KIT_REVIEWED_DATE || 0) -
          new Date(a.PROJECT_KIT_REVIEWED_DATE || 0)
        );
      }
      return (b.ID || 0) - (a.ID || 0);
    });

    return list;
  }, [submissions, statusFilter, searchTerm]);

  // Calculated Total Tutor Evaluation Mark (Creativity + Problem Solving)
  const calculatedTotal = useMemo(() => {
    const c = parseFloat(evalCreativity);
    const p = parseFloat(evalProblemSolving);
    const validC = !isNaN(c) && c >= 0 && c <= 50 ? c : 0;
    const validP = !isNaN(p) && p >= 0 && p <= 50 ? p : 0;
    if (evalCreativity === "" && evalProblemSolving === "") return "—";
    const total = validC + validP;
    return total % 1 !== 0 ? total.toFixed(1) : String(total);
  }, [evalCreativity, evalProblemSolving]);

  // Open Preview / Evaluation Modal
  const handleOpenPreview = async (submission) => {
    setActiveSubmission(submission);
    setPreviewLoading(true);

    const initialCreativity =
      submission.CREATIVITY_MARK !== null && submission.CREATIVITY_MARK !== undefined
        ? String(submission.CREATIVITY_MARK)
        : "";
    const initialProblemSolving =
      submission.PROBLEM_SOLVING_MARK !== null && submission.PROBLEM_SOLVING_MARK !== undefined
        ? String(submission.PROBLEM_SOLVING_MARK)
        : "";

    setEvalCreativity(initialCreativity);
    setEvalProblemSolving(initialProblemSolving);
    setEvalComment(submission.PROJECT_KIT_COMMENT || "");

    try {
      const res = await projectKitEvaluationApi.getSubmissionPreview(
        submission.ID || submission.assessment_exam_id,
        userId
      );
      if (res.data && res.data.status === 1) {
        const d = res.data.data;
        setPreviewData(d);
        if (d.CREATIVITY_MARK !== null && d.CREATIVITY_MARK !== undefined) {
          setEvalCreativity(String(d.CREATIVITY_MARK));
        }
        if (d.PROBLEM_SOLVING_MARK !== null && d.PROBLEM_SOLVING_MARK !== undefined) {
          setEvalProblemSolving(String(d.PROBLEM_SOLVING_MARK));
        }
        if (d.PROJECT_KIT_COMMENT) {
          setEvalComment(d.PROJECT_KIT_COMMENT);
        }
      } else {
        setPreviewData(submission);
      }
    } catch (err) {
      console.error("handleOpenPreview error:", err);
      setPreviewData(submission);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setActiveSubmission(null);
    setPreviewData(null);
    setEvalCreativity("");
    setEvalProblemSolving("");
    setEvalComment("");
  };

  // Submit Evaluation
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!activeSubmission) return;

    // Check if already evaluated
    if (
      Boolean(
        previewData?.IS_PROJECT_KIT_EVALUATED ??
          activeSubmission.IS_PROJECT_KIT_EVALUATED
      )
    ) {
      toast.info("This Project Kit submission has already been evaluated.");
      return;
    }

    // 1. Validate Creativity (0–50)
    if (
      evalCreativity === "" ||
      evalCreativity === null ||
      evalCreativity === undefined ||
      isNaN(Number(evalCreativity))
    ) {
      toast.warn("Please enter a valid numeric mark for Creativity (0–50).");
      return;
    }

    const cNum = Number(evalCreativity);
    if (cNum < 0 || cNum > 50) {
      toast.warn("Creativity mark must be between 0 and 50.");
      return;
    }

    // 2. Validate Problem Solving (0–50)
    if (
      evalProblemSolving === "" ||
      evalProblemSolving === null ||
      evalProblemSolving === undefined ||
      isNaN(Number(evalProblemSolving))
    ) {
      toast.warn("Please enter a valid numeric mark for Problem Solving (0–50).");
      return;
    }

    const pNum = Number(evalProblemSolving);
    if (pNum < 0 || pNum > 50) {
      toast.warn("Problem Solving mark must be between 0 and 50.");
      return;
    }

    // 3. Validate Total (0–100)
    const totalNum = Number((cNum + pNum).toFixed(2));
    if (totalNum < 0 || totalNum > 100) {
      toast.warn("Total Tutor Evaluation mark must be between 0 and 100.");
      return;
    }

    setSubmittingEval(true);
    try {
      const payload = {
        attemptId: activeSubmission.ID || activeSubmission.assessment_exam_id,
        tutorId: userId,
        creativityMark: cNum,
        problemSolvingMark: pNum,
        marks: totalNum,
        comment: evalComment.trim(),
      };

      const res = await projectKitEvaluationApi.submitEvaluation(payload);
      if (res.data && res.data.status === 1) {
        toast.success("Project Kit evaluated successfully!");
        handleClosePreview();
        if (selectedBatch?.value) {
          fetchSubmissions(selectedBatch.value);
        }
      } else {
        toast.error(res.data?.message || "Failed to save evaluation.");
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

  // Format Review Date (PROJECT_KIT_REVIEWED_DATE) strictly as DD/MM/YYYY hh:mm A
  const formatReviewDate = (dateVal) => {
    if (!dateVal) return "—";
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return "—";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const amPm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${day}/${month}/${year} ${hours}:${minutes} ${amPm}`;
  };

  const submittedCount = submissions.filter((s) => s.IS_PROJECT_KIT_EVALUATED).length;
  const pendingCount = submissions.filter((s) => !s.IS_PROJECT_KIT_EVALUATED).length;

  return (
    <div className="assessment-evaluation-page">
      {/* HEADER */}
      <div className="eval-header-section">
        <div className="eval-section-badge">
          <Sparkles size={13} className="live-dot" />
          <span>TUTOR / PROJECT KIT EVALUATION</span>
        </div>
        <div className="eval-header-row">
          <div>
            <h1 className="eval-main-title">Project Kit Evaluation</h1>
            <p className="eval-subtitle">
              Review student project kit submissions, inspect build photos, and assign evaluation marks.
            </p>
          </div>
          <button
            className="eval-refresh-btn"
            onClick={() => selectedBatch?.value && fetchSubmissions(selectedBatch.value, selectedCategory?.value)}
            disabled={loadingSubmissions || !selectedBatch}
            title="Refresh submissions"
          >
            <RefreshCw size={15} className={loadingSubmissions ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TOP CONTROLS & STATS */}
      <div className="eval-controls-grid">
        <div className="eval-control-card">
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

        <div className="eval-control-card">
          <label className="control-label">
            <Layers size={14} />
            <span>Category</span>
          </label>
          <Select
            options={categories}
            value={selectedCategory}
            onChange={(opt) => setSelectedCategory(opt || { value: "ALL", label: "All Categories" })}
            placeholder={loadingCategories ? "Loading categories..." : "All Categories"}
            isLoading={loadingCategories}
            styles={customSelectStyles}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            isClearable={false}
          />
        </div>

        <div className="eval-stats-card">
          <div className="eval-stat-item">
            <span className="stat-label">Total Submissions</span>
            <span className="stat-value total">{submissions.length}</span>
          </div>
          <div className="eval-stat-divider" />
          <div className="eval-stat-item">
            <span className="stat-label">Reviewed</span>
            <span className="stat-value evaluated">{submittedCount}</span>
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
              placeholder="Search by student name, kit, or assessment..."
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
                <th>Assessment &amp; Category</th>
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
                      <span>Loading project kit submissions...</span>
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
                      <Package size={36} />
                      <p>No project kit submissions found matching the criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const isEvaluated = Boolean(sub.IS_PROJECT_KIT_EVALUATED);
                  const reviewedDate = sub.PROJECT_KIT_REVIEWED_DATE || sub.project_kit_reviewed_date;

                  return (
                    <tr
                      key={sub.ID || idx}
                      className={isEvaluated ? "row-evaluated" : "row-pending"}
                    >
                      <td className="col-idx">{idx + 1}</td>
                      <td>
                        <div className="student-cell">
                          <div className="student-avatar">
                            {sub.STUDENT_NAME ? sub.STUDENT_NAME.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div className="student-details">
                            <span className="student-name">{sub.STUDENT_NAME || "Student"}</span>
                            <span className="student-meta">
                              {sub.STUDENT_EMAIL || (sub.BATCH_CODE ? `Batch: ${sub.BATCH_CODE}` : "")}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="title-cell">
                          <span className="assessment-title-text">{sub.ASSESSMENT_NAME || sub.PROJECT_KIT_NAME || "Project Kit"}</span>
                          <span className="assessment-batch-tag">
                            {sub.CATEGORY_NAME || sub.category_name || sub.MODULE_NAME || sub.PROJECT_KIT_NAME || sub.BATCH_CODE || ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="date-cell">
                          {formatReviewDate(reviewedDate)}
                        </span>
                      </td>
                      <td>
                        {isEvaluated && sub.PROJECT_KIT_MARK !== null && sub.PROJECT_KIT_MARK !== undefined ? (
                          <div
                            className="marks-badge"
                            title={
                              sub.CREATIVITY_MARK !== null && sub.PROBLEM_SOLVING_MARK !== null
                                ? `Creativity: ${sub.CREATIVITY_MARK}/50 | Problem Solving: ${sub.PROBLEM_SOLVING_MARK}/50`
                                : undefined
                            }
                          >
                            <span className="marks-val">{sub.PROJECT_KIT_MARK}</span>
                            <span className="marks-max">/ 100</span>
                          </div>
                        ) : (
                          <span className="unmarked-label">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="status-action-cell">
                          {isEvaluated ? (
                            <button
                              type="button"
                              className="eval-preview-btn btn-reviewed"
                              onClick={() => handleOpenPreview(sub)}
                              title="View evaluated Project Kit"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="eval-preview-btn"
                              onClick={() => handleOpenPreview(sub)}
                              title="Preview and evaluate Project Kit"
                            >
                              <Eye size={13} />
                              <span>Evaluate</span>
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
                  <Package size={22} />
                </div>
                <div>
                  <h2 className="modal-title">Project Kit Evaluation</h2>
                  <p className="modal-subtitle">
                    {activeSubmission.STUDENT_NAME} · {activeSubmission.PROJECT_KIT_NAME || activeSubmission.ASSESSMENT_NAME}
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
                  <span>Loading project kit details...</span>
                </div>
              ) : (
                (() => {
                  const currentImage =
                    previewData?.STUDENT_PROJECT_KIT_IMAGE ||
                    previewData?.PROJECT_KIT_IMAGE ||
                    activeSubmission.STUDENT_PROJECT_KIT_IMAGE ||
                    activeSubmission.PROJECT_KIT_IMAGE;
                  const isComplete = Boolean(currentImage && currentImage.trim());

                  return (
                    <div className="eval-modal-grid">
                      {/* LEFT COLUMN: SUBMISSION DETAILS & MEDIA */}
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
                              <span className="kv-val">
                                {previewData?.STUDENT_NAME || activeSubmission.STUDENT_NAME}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Email</span>
                              <span className="kv-val">
                                {previewData?.STUDENT_EMAIL || activeSubmission.STUDENT_EMAIL || "—"}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Assessment</span>
                              <span className="kv-val">
                                {previewData?.ASSESSMENT_NAME || activeSubmission.ASSESSMENT_NAME}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Category / Batch</span>
                              <span className="kv-val">
                                {(previewData?.CATEGORY_NAME || previewData?.category_name || previewData?.MODULE_NAME) ? `${previewData.CATEGORY_NAME || previewData.category_name || previewData.MODULE_NAME} · ` : ""}
                                {previewData?.BATCH_CODE || activeSubmission.BATCH_CODE}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Review Date</span>
                              <span className="kv-val">
                                {formatReviewDate(previewData?.PROJECT_KIT_REVIEWED_DATE || activeSubmission.PROJECT_KIT_REVIEWED_DATE)}
                              </span>
                            </div>
                            <div className="kv-item">
                              <span className="kv-label">Status</span>
                              <span className="kv-val">
                                <span
                                  className={`eval-status-badge ${
                                    (previewData?.IS_PROJECT_KIT_EVALUATED ?? activeSubmission.IS_PROJECT_KIT_EVALUATED)
                                      ? "status-submitted"
                                      : "status-pending"
                                  }`}
                                >
                                  {(previewData?.IS_PROJECT_KIT_EVALUATED ?? activeSubmission.IS_PROJECT_KIT_EVALUATED)
                                    ? "Reviewed"
                                    : "Pending"}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* SUBMITTED PROJECT KIT IMAGE */}
                        <div className="pane-section-card">
                          <h4 className="pane-card-title">
                            <ImageIcon size={16} />
                            <span>Submitted Build Photo: {previewData?.PROJECT_KIT_NAME || activeSubmission.PROJECT_KIT_NAME}</span>
                          </h4>
                          <div className="media-images-grid" style={{ gridTemplateColumns: "1fr" }}>
                            <div className="media-card image-media-card">
                              <span className="media-label">Project Kit Build</span>
                              {currentImage ? (
                                <div
                                  className="media-img-wrapper"
                                  onClick={() => setSelectedImageModal(getMediaUrl(currentImage))}
                                >
                                  <img
                                    src={getMediaUrl(currentImage)}
                                    alt="Project Kit Build"
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
                                    <span>Click to view full photo</span>
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
                      </div>

                      {/* RIGHT COLUMN: EVALUATION FORM */}
                      <div className="eval-form-pane">
                        <div className="eval-form-card">
                          <h3 className="form-card-title">
                            <GraduationCap size={18} />
                            <span>Tutor Evaluation</span>
                          </h3>
                          <p className="form-card-desc">
                            Evaluate the student on Creativity and Problem Solving (0–50 marks each). Total evaluation mark is out of 100.
                          </p>

                          {(() => {
                            const isAlreadyEvaluated = Boolean(
                              previewData?.IS_PROJECT_KIT_EVALUATED ??
                                activeSubmission.IS_PROJECT_KIT_EVALUATED
                            );

                            return (
                              <form onSubmit={handleSaveEvaluation}>
                                <div className="eval-criteria-table-wrap">
                                  <table className="eval-criteria-table">
                                    <thead>
                                      <tr>
                                        <th>Type</th>
                                        <th>Maximum Mark</th>
                                        <th>Mark</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="criteria-type">Creativity</td>
                                        <td className="criteria-max">50</td>
                                        <td className="criteria-input-cell">
                                          <input
                                            type="number"
                                            min="0"
                                            max="50"
                                            step="1"
                                            placeholder="0–50"
                                            value={evalCreativity}
                                            onChange={(e) => setEvalCreativity(e.target.value)}
                                            disabled={isAlreadyEvaluated || submittingEval}
                                            className="criteria-mark-input"
                                            required
                                          />
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="criteria-type">Problem Solving</td>
                                        <td className="criteria-max">50</td>
                                        <td className="criteria-input-cell">
                                          <input
                                            type="number"
                                            min="0"
                                            max="50"
                                            step="1"
                                            placeholder="0–50"
                                            value={evalProblemSolving}
                                            onChange={(e) => setEvalProblemSolving(e.target.value)}
                                            disabled={isAlreadyEvaluated || submittingEval}
                                            className="criteria-mark-input"
                                            required
                                          />
                                        </td>
                                      </tr>
                                    </tbody>
                                    <tfoot>
                                      <tr className="criteria-total-row">
                                        <td className="criteria-total-label">Total</td>
                                        <td className="criteria-total-max">100</td>
                                        <td className="criteria-total-val">
                                          <span className="total-score-badge">
                                            {calculatedTotal} <span className="total-denom">/ 100</span>
                                          </span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>

                                <div className="form-field-group">
                                  <label className="eval-field-label">
                                    <MessageSquare size={13} />
                                    <span>Tutor Comment / Feedback</span>
                                  </label>
                                  <textarea
                                    rows="4"
                                    placeholder="Add observations, feedback, and grading remarks on the build..."
                                    value={evalComment}
                                    onChange={(e) => setEvalComment(e.target.value)}
                                    disabled={isAlreadyEvaluated || submittingEval}
                                  />
                                </div>

                                {previewData?.EVALUATED_BY_NAME && (
                                  <div className="eval-history-box">
                                    <span className="history-label">Last Evaluated By:</span>
                                    <span className="history-val">
                                      {previewData.EVALUATED_BY_NAME}
                                      {previewData.PROJECT_KIT_REVIEWED_DATE || previewData.EVALUATED_DATE
                                        ? ` on ${formatReviewDate(
                                            previewData.PROJECT_KIT_REVIEWED_DATE ||
                                              previewData.EVALUATED_DATE
                                          )}`
                                        : ""}
                                    </span>
                                  </div>
                                )}

                                <div className="eval-actions-row">
                                  <button
                                    type="button"
                                    className="eval-btn-secondary"
                                    onClick={handleClosePreview}
                                    disabled={submittingEval}
                                  >
                                    {isAlreadyEvaluated ? "Close" : "Cancel"}
                                  </button>
                                  {!isAlreadyEvaluated && (
                                    <button
                                      type="submit"
                                      className="eval-btn-primary"
                                      disabled={submittingEval}
                                    >
                                      {submittingEval ? (
                                        <>
                                          <RefreshCw size={16} className="spin" />
                                          <span>Saving...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 size={16} />
                                          <span>Save Evaluation</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </form>
                            );
                          })()}
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
    </div>
  );
};

export default ProjectKitEvaluation;

