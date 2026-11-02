import React, { useState, useEffect, useMemo, useCallback } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  Search,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  X,
  BookOpen,
  GraduationCap,
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileCheck,
  Check,
  Crown,
  Shield,
  Layers,
  Award,
  Building2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import "./PracticeTestAnalysis.css";
import { practiceTestAnalysisApi, moduleApi } from "../../services/apiService";
import { moduleCodeData } from "../../services/dataService";

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

const PracticeTestAnalysis = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchOption, setSelectedBatchOption] = useState(null);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Category & Module filters for main page
  const [categories, setCategories] = useState([]);
  const [selectedCategoryOption, setSelectedCategoryOption] = useState({
    value: "ALL",
    label: "All Categories",
  });
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedModuleOption, setSelectedModuleOption] = useState({
    value: "ALL",
    label: "All Modules",
  });

  // Students list state
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Student details modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [studentAssessments, setStudentAssessments] = useState([]);
  const [modalStudentData, setModalStudentData] = useState(null);
  const [modalCategoryFilter, setModalCategoryFilter] = useState({
    value: "ALL",
    label: "All Categories",
  });
  const [modalModuleFilter, setModalModuleFilter] = useState({
    value: "ALL",
    label: "All Modules",
  });

  // In-flight reminder state & sent history (for 1 click -> 1 notification protection)
  const [sendingReminderMap, setSendingReminderMap] = useState({});
  const [reminderSentMap, setReminderSentMap] = useState({});

  // Read current user session
  useEffect(() => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (storedUser) {
        const parsed =
          typeof storedUser === "string" ? JSON.parse(storedUser) : storedUser;
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.error("Error reading user data in PracticeTestAnalysis:", e);
    }
  }, []);

  const currentUserId = currentUser?.USER_ID || currentUser?.id;

  // Module Options list (All + M1 to M8)
  const moduleOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All Modules" },
      ...moduleCodeData.map((m) => ({
        value: m.value,
        label: m.label,
      })),
    ];
  }, []);

  // Fetch Categories (active modules)
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await moduleApi.getActive();
      if (res?.data?.status === 1) {
        const list = res?.data?.data || [];
        const opts = [
          { value: "ALL", label: "All Categories" },
          ...list.map((c) => ({
            value: Number(c.ID),
            label: c.MODULE_NAME,
            data: c,
          })),
        ];
        setCategories(opts);
      } else {
        setCategories([{ value: "ALL", label: "All Categories" }]);
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
      setCategories([{ value: "ALL", label: "All Categories" }]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 1. Fetch Tutor Assigned Batches (HOST + SUPPORT)
  const fetchBatches = useCallback(async () => {
    if (!currentUserId) return;
    setBatchesLoading(true);
    try {
      const res = await practiceTestAnalysisApi.getTutorBatches(currentUserId);
      if (res?.data?.status === 1) {
        const list = res?.data?.data || [];
        setBatches(list);

        // Auto-select first batch if available and none currently selected
        if (list.length > 0 && !selectedBatchOption) {
          const first = list[0];
          const isHost = String(first.TUTOR_ROLE).toUpperCase() === "HOST";
          setSelectedBatchOption({
            value: first.ID,
            label: `${first.BATCH_CODE} (${isHost ? "HOST" : "SUPPORT"})`,
            data: first,
          });
        }
      } else {
        setBatches([]);
        toast.error(res?.data?.message || "Failed to load assigned batches");
      }
    } catch (err) {
      console.error("Fetch batches error:", err);
      toast.error("An error occurred while fetching assigned batches");
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [currentUserId, selectedBatchOption]);

  useEffect(() => {
    if (currentUserId) {
      fetchBatches();
    }
  }, [currentUserId, fetchBatches]);

  // 2. Fetch Students for Selected Batch with Category & Module filters
  const fetchStudents = useCallback(async () => {
    if (!selectedBatchOption?.value || !currentUserId) {
      setStudents([]);
      return;
    }

    setStudentsLoading(true);
    try {
      const params = {};
      if (selectedCategoryOption?.value && selectedCategoryOption.value !== "ALL") {
        params.categoryId = selectedCategoryOption.value;
      }
      if (selectedModuleOption?.value && selectedModuleOption.value !== "ALL") {
        params.moduleCode = selectedModuleOption.value;
      }

      const res = await practiceTestAnalysisApi.getBatchStudents(
        selectedBatchOption.value,
        currentUserId,
        params
      );

      if (res?.data?.status === 1) {
        setStudents(res?.data?.data || []);
      } else {
        setStudents([]);
        toast.error(res?.data?.message || "Failed to load students for batch");
      }
    } catch (err) {
      console.error("Fetch students error:", err);
      toast.error("Failed to load students for the selected batch");
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedBatchOption, currentUserId, selectedCategoryOption, selectedModuleOption]);

  useEffect(() => {
    if (fetchStudents) {
      fetchStudents();
    }
  }, [fetchStudents]);

  // Batch Select Options
  const batchOptions = useMemo(() => {
    return batches.map((b) => {
      const isHost = String(b.TUTOR_ROLE).toUpperCase() === "HOST";
      return {
        value: b.ID,
        label: `${b.BATCH_CODE} (${isHost ? "HOST" : "SUPPORT"})`,
        data: b,
      };
    });
  }, [batches]);

  // Filtered Students list by search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.trim().toLowerCase();
    return students.filter(
      (st) =>
        String(st.USERNAME || "").toLowerCase().includes(q) ||
        String(st.STUDENT_ID || "").toLowerCase().includes(q) ||
        String(st.EMAIL_ID || "").toLowerCase().includes(q) ||
        String(st.SCHOOL_NAME || "").toLowerCase().includes(q)
    );
  }, [students, searchTerm]);

  // 3. Open View Details Modal for a Student
  const handleViewDetails = async (student) => {
    const studentId = student.STUDENT_ID || student.USER_ID;
    const batchId = selectedBatchOption?.value || student.BATCH_ID;

    if (!studentId || !batchId) return;

    setSelectedStudent(student);
    setIsModalOpen(true);
    setModalLoading(true);
    setStudentAssessments([]);
    setModalStudentData(student);
    setModalCategoryFilter(selectedCategoryOption || { value: "ALL", label: "All Categories" });
    setModalModuleFilter(selectedModuleOption || { value: "ALL", label: "All Modules" });

    try {
      const res = await practiceTestAnalysisApi.getStudentAssessments(
        studentId,
        batchId,
        currentUserId
      );

      if (res?.data?.status === 1) {
        const data = res?.data?.data || {};
        setStudentAssessments(data.assessments || []);
        if (data.student) {
          setModalStudentData((prev) => ({
            ...prev,
            ...data.student,
          }));
        }
      } else {
        toast.error(res?.data?.message || "Failed to load student assessments");
      }
    } catch (err) {
      console.error("Fetch student assessments error:", err);
      toast.error("Failed to load student assessments");
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
    setStudentAssessments([]);
    setModalStudentData(null);
  };

  // Filtered Student Assessments in Modal by Category & Module
  const filteredModalAssessments = useMemo(() => {
    let list = [...studentAssessments];

    if (modalCategoryFilter?.value && modalCategoryFilter.value !== "ALL") {
      const cId = Number(modalCategoryFilter.value);
      list = list.filter((a) => Number(a.MODULE_ID) === cId);
    }

    if (modalModuleFilter?.value && modalModuleFilter.value !== "ALL") {
      const mCode = String(modalModuleFilter.value).toUpperCase();
      list = list.filter(
        (a) => String(a.MODULE_CODE || a.DIFFICULTY_LEVEL || "").toUpperCase() === mCode
      );
    }

    return list;
  }, [studentAssessments, modalCategoryFilter, modalModuleFilter]);

  // 4. Send Reminder Notification to Selected Student for Pending Assessment
  const handleSendReminder = async (assessment) => {
    const studentId =
      selectedStudent?.STUDENT_ID ||
      selectedStudent?.USER_ID ||
      modalStudentData?.STUDENT_ID;
    const batchId =
      selectedBatchOption?.value ||
      selectedStudent?.BATCH_ID ||
      assessment.BATCH_ID;
    const assessmentId = assessment.ASSIGNMENT_ID;
    const assessmentName =
      assessment.ASSESSMENT_NAME ||
      assessment.MODULE_NAME ||
      `Practice Test #${assessmentId}`;

    if (!studentId || !batchId || !assessmentId) return;

    // Prevent duplicate in-flight clicks or if already sent
    if (sendingReminderMap[assessmentId] || reminderSentMap[assessmentId]) return;

    setSendingReminderMap((prev) => ({ ...prev, [assessmentId]: true }));

    try {
      const payload = {
        studentId,
        batchId,
        assessmentName,
        tutorId: currentUserId,
      };

      const res = await practiceTestAnalysisApi.sendReminder(payload);

      if (res?.data?.status === 1) {
        toast.success(res?.data?.message || "Notification sent successfully");
        setReminderSentMap((prev) => ({ ...prev, [assessmentId]: true }));
      } else {
        toast.error(res?.data?.message || "Failed to send notification");
      }
    } catch (err) {
      console.error("Send reminder error:", err);
      toast.error("Failed to send notification");
    } finally {
      setSendingReminderMap((prev) => ({ ...prev, [assessmentId]: false }));
    }
  };

  // Stats calculation for modal
  const modalStats = useMemo(() => {
    const total = filteredModalAssessments.length;
    const completed = filteredModalAssessments.filter(
      (a) => a.IS_COMPLETED === 1 || String(a.STATUS).toLowerCase() === "completed"
    ).length;
    const pending = Math.max(0, total - completed);
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, completionPct };
  }, [filteredModalAssessments]);

  return (
    <div className="pta-container">
      {/* Header Section */}
      <div className="pta-header-section">
        <div className="pta-breadcrumb">TEACHING</div>
        <div className="pta-title-row">
          <div className="pta-title-left">
            <h1 className="pta-title">Practice Test Analysis</h1>
            <p className="pta-subtitle">
              Track student practice test completions, pending assignments, and send direct reminders.
            </p>
          </div>

          <div className="pta-header-controls">
            {/* Batch Selector Dropdown */}
            <div className="pta-batch-select-wrap">
              <label className="pta-control-lbl">
                <Layers size={13} /> SELECT BATCH
              </label>
              <Select
                styles={customSelectStyles}
                options={batchOptions}
                value={selectedBatchOption}
                onChange={(option) => setSelectedBatchOption(option)}
                placeholder="Select Batch..."
                isLoading={batchesLoading}
                isSearchable={true}
                className="pta-select-field"
              />
            </div>

            {/* Category Filter Dropdown */}
            <div className="pta-filter-select-wrap category">
              <label className="pta-control-lbl">
                <Layers size={13} /> CATEGORY
              </label>
              <Select
                styles={customSelectStyles}
                options={categories}
                value={selectedCategoryOption}
                onChange={(option) =>
                  setSelectedCategoryOption(
                    option || { value: "ALL", label: "All Categories" }
                  )
                }
                placeholder="All Categories"
                isLoading={categoriesLoading}
                isSearchable={true}
                className="pta-select-field"
              />
            </div>

            {/* Module Filter Dropdown */}
            <div className="pta-filter-select-wrap module">
              <label className="pta-control-lbl">
                <BookOpen size={13} /> MODULE
              </label>
              <Select
                styles={customSelectStyles}
                options={moduleOptions}
                value={selectedModuleOption}
                onChange={(option) =>
                  setSelectedModuleOption(
                    option || { value: "ALL", label: "All Modules" }
                  )
                }
                placeholder="All Modules"
                isSearchable={true}
                className="pta-select-field"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className="pta-btn-refresh"
              onClick={() => {
                fetchBatches();
                fetchStudents();
              }}
              title="Refresh Data"
            >
              <RefreshCw
                size={16}
                className={batchesLoading || studentsLoading ? "spin" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pta-main-card">
        {/* Table Top Controls Bar */}
        <div className="pta-table-header-bar">
          <div className="pta-table-title-group">
            <h3 className="pta-card-title">
              Enrolled Students ({filteredStudents.length})
            </h3>
            {selectedBatchOption && (
              <span className="pta-selected-batch-tag">
                {selectedBatchOption.label}
              </span>
            )}
            {selectedCategoryOption?.value &&
              selectedCategoryOption.value !== "ALL" && (
                <span className="pta-selected-filter-tag">
                  Category: {selectedCategoryOption.label}
                </span>
              )}
            {selectedModuleOption?.value &&
              selectedModuleOption.value !== "ALL" && (
                <span className="pta-selected-filter-tag">
                  Module: {selectedModuleOption.label}
                </span>
              )}
          </div>

          {/* Search Input */}
          <div className="pta-search-box">
            <Search size={16} className="pta-search-icon" />
            <input
              type="text"
              placeholder="Search student name, ID, school..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pta-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="pta-search-clear"
                onClick={() => setSearchTerm("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Student Table */}
        <div className="pta-table-wrapper">
          {studentsLoading ? (
            <div className="pta-loading-state">
              <div className="pta-spinner" />
              <p>Loading student assessment records...</p>
            </div>
          ) : !selectedBatchOption ? (
            <div className="pta-empty-state">
              <Layers size={40} className="empty-icon" />
              <h3>No Batch Selected</h3>
              <p>Please select a batch from the dropdown above to view student assessment analysis.</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="pta-empty-state">
              <AlertCircle size={40} className="empty-icon" />
              <h3>No Students Found</h3>
              <p>
                {searchTerm
                  ? "No students match your search query in this batch."
                  : "No students have been allocated to this batch yet."}
              </p>
            </div>
          ) : (
            <table className="pta-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>S.No</th>
                  <th>Student</th>
                  {/* <th>Student ID</th> 
                  <th>Batch</th> */}
                  <th style={{ textAlign: "center" }}>
                    Practice Tests / Assessments
                  </th>
                  <th style={{ textAlign: "center" }}>Completed</th>
                  <th style={{ textAlign: "center" }}>Pending</th>
                  <th style={{ textAlign: "center", width: "130px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => {
                  const studentId = student.STUDENT_ID || student.USER_ID;
                  const total = student.TOTAL_ASSESSMENTS || 0;
                  const completed = student.COMPLETED_ASSESSMENTS || 0;
                  const pending = student.PENDING_ASSESSMENTS || 0;

                  return (
                    <tr key={studentId || index}>
                      <td>{index + 1}</td>
                      <td className="student-info-cell">
                        <div className="student-avatar-small">
                          {(student.USERNAME || "S")
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="student-names">
                          <span className="student-uname">
                            {student.USERNAME}
                          </span>
                          {student.SCHOOL_NAME && (
                            <span className="student-school-sub">
                              {student.SCHOOL_NAME}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* <td>
                        <span className="student-id-pill">#{studentId}</span>
                      </td> 
                      <td>
                        <span className="batch-code-badge">
                          {student.BATCH_CODE ||
                            selectedBatchOption?.data?.BATCH_CODE ||
                            "—"}
                        </span>
                      </td>*/}
                      <td style={{ textAlign: "center" }}>
                        <span className="assessment-count-total">{total}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="assessment-count-completed">
                          {completed}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`assessment-count-pending ${
                            pending > 0 ? "has-pending" : "zero-pending"
                          }`}
                        >
                          {pending}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn-view-details-action"
                          onClick={() => handleViewDetails(student)}
                          title="View student assessment breakdown"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* =========================================================
          VIEW DETAILS MODAL (Student Profile & Assessment Breakdown)
      ========================================================= */}
      {isModalOpen && (
        <div className="modal-overlay pta-modal-overlay" onClick={handleCloseModal}>
          <div
            className="pta-details-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="pta-modal-header">
              <div className="pta-modal-header-left">
                <div className="pta-avatar-modal">
                  {(
                    modalStudentData?.USERNAME ||
                    selectedStudent?.USERNAME ||
                    "S"
                  )
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="pta-header-titles">
                  <div className="pta-header-tags-row">
                    {/* <span className="pta-id-tag">
                      ID 
                      {modalStudentData?.STUDENT_ID ||
                        selectedStudent?.STUDENT_ID ||
                        modalStudentData?.USER_ID}
                    </span>*/}
                    <span
                      className={`tl-live-status-pill ${
                        modalStudentData?.IS_ACTIVE === 1 ||
                        selectedStudent?.IS_ACTIVE === 1
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      <span className="tl-status-dot" />
                      {modalStudentData?.IS_ACTIVE === 1 ||
                      selectedStudent?.IS_ACTIVE === 1
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </div>
                  <h2 className="pta-modal-student-name">
                    {modalStudentData?.USERNAME ||
                      selectedStudent?.USERNAME ||
                      "Student"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="pta-modal-close-btn"
                onClick={handleCloseModal}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="pta-modal-body">
              {/* Student Overview Strip */}
              <div className="pta-student-info-strip">
                <div className="pta-info-item">
                  <span className="pta-info-lbl">
                    <Building2 size={12} /> School
                  </span>
                  <span className="pta-info-val">
                    {modalStudentData?.SCHOOL_NAME ||
                      selectedStudent?.SCHOOL_NAME ||
                      "—"}
                  </span>
                </div>

                <div className="pta-info-divider" />

                <div className="pta-info-item">
                  <span className="pta-info-lbl">
                    <GraduationCap size={12} /> Grade
                  </span>
                  <span className="pta-info-val">
                    {modalStudentData?.GRADE ||
                      selectedStudent?.GRADE ||
                      "—"}
                  </span>
                </div>

                <div className="pta-info-divider" />

                <div className="pta-info-item">
                  <span className="pta-info-lbl">
                    <BookOpen size={12} /> Batch
                  </span>
                  <span className="pta-info-val">
                    {modalStudentData?.BATCH_CODE ||
                      selectedStudent?.BATCH_CODE ||
                      selectedBatchOption?.data?.BATCH_CODE ||
                      "—"}
                  </span>
                </div>

                <div className="pta-info-divider" />

                <div className="pta-info-item">
                  <span className="pta-info-lbl">
                    <Mail size={12} /> Email
                  </span>
                  <span className="pta-info-val">
                    {modalStudentData?.EMAIL_ID ||
                      selectedStudent?.EMAIL_ID ||
                      "—"}
                  </span>
                </div>
              </div>

              {/* Assessment Metrics Strip */}
              <div className="pta-metrics-strip">
                <div className="pta-metric-tile total">
                  <span className="pta-metric-num">{modalStats.total}</span>
                  <span className="pta-metric-lbl">TOTAL ASSIGNED</span>
                </div>

                <div className="pta-metric-tile completed">
                  <span className="pta-metric-num">{modalStats.completed}</span>
                  <span className="pta-metric-lbl">COMPLETED</span>
                </div>

                <div className="pta-metric-tile pending">
                  <span className="pta-metric-num">{modalStats.pending}</span>
                  <span className="pta-metric-lbl">PENDING</span>
                </div>

                <div className="pta-metric-tile rate">
                  <span className="pta-metric-num">
                    {modalStats.completionPct}%
                  </span>
                  <span className="pta-metric-lbl">COMPLETION RATE</span>
                </div>
              </div>

              {/* Assigned Assessments Table Section */}
              <div className="pta-assessments-section">
                <div className="pta-sec-header">
                  <FileCheck size={17} className="pta-sec-icon" />
                  <h4 className="pta-sec-title">
                    Assigned Practice Tests / Assessments ({filteredModalAssessments.length})
                  </h4>
                </div>

                {/* Modal Category & Module Filters */}
                <div className="pta-modal-filters-row">
                  <div className="pta-modal-filter-item">
                    <span className="pta-modal-filter-lbl">
                      <Layers size={12} /> Category:
                    </span>
                    <Select
                      styles={customSelectStyles}
                      options={categories}
                      value={modalCategoryFilter}
                      onChange={(opt) =>
                        setModalCategoryFilter(
                          opt || { value: "ALL", label: "All Categories" }
                        )
                      }
                      placeholder="All Categories"
                      isSearchable={true}
                      className="pta-modal-select"
                    />
                  </div>

                  <div className="pta-modal-filter-item">
                    <span className="pta-modal-filter-lbl">
                      <BookOpen size={12} /> Module:
                    </span>
                    <Select
                      styles={customSelectStyles}
                      options={moduleOptions}
                      value={modalModuleFilter}
                      onChange={(opt) =>
                        setModalModuleFilter(
                          opt || { value: "ALL", label: "All Modules" }
                        )
                      }
                      placeholder="All Modules"
                      isSearchable={true}
                      className="pta-modal-select"
                    />
                  </div>
                </div>

                {modalLoading ? (
                  <div className="pta-modal-loading">
                    <div className="pta-spinner" />
                    <p>Loading assigned assessments...</p>
                  </div>
                ) : filteredModalAssessments.length === 0 ? (
                  <div className="pta-empty-state mini">
                    <AlertCircle size={30} />
                    <p>No practice tests or assessments found matching the selected filters.</p>
                  </div>
                ) : (
                  <div className="pta-modal-table-wrap">
                    <table className="pta-modal-table">
                      <thead>
                        <tr>
                          <th style={{ width: "45px" }}>S.No</th>
                          <th>Category</th>
                          <th style={{ width: "80px", textAlign: "center" }}>Module</th>
                          <th>Assessment Name</th>
                          <th>Assigned Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: "center", width: "120px" }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalAssessments.map((item, idx) => {
                          const isCompleted =
                            item.IS_COMPLETED === 1 ||
                            String(item.STATUS).toLowerCase() === "completed";
                          const isPending = !isCompleted;
                          const aId = item.ASSIGNMENT_ID;
                          const isSending = sendingReminderMap[aId];
                          const hasSent = reminderSentMap[aId];

                          return (
                            <tr key={aId || idx}>
                              <td>{idx + 1}</td>
                              <td className="fw-500">
                                <span className="module-name-txt">
                                  {item.CATEGORY_NAME || item.MODULE_NAME || "General"}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {item.MODULE_CODE || item.DIFFICULTY_LEVEL ? (
                                  <span className="pta-module-code-badge">
                                    {item.MODULE_CODE || item.DIFFICULTY_LEVEL}
                                  </span>
                                ) : (
                                  <span style={{ color: "#64748b" }}>—</span>
                                )}
                              </td>
                              <td>
                                <span className="assessment-name-txt">
                                  {item.ASSESSMENT_NAME}
                                </span>
                              </td>
                              <td className="date-txt">
                                {item.ASSIGNED_DATE || "—"}
                              </td>
                              <td>
                                {isCompleted ? (
                                  <span className="pta-status-badge completed">
                                    <CheckCircle2 size={13} />
                                    Completed
                                  </span>
                                ) : (
                                  <span className="pta-status-badge pending">
                                    <Clock size={13} />
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {isCompleted ? (
                                  <span className="pta-completed-pill" title="Assessment completed by student">
                                    <Check size={14} /> View
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`btn-send-reminder ${
                                      hasSent ? "sent" : ""
                                    } ${isSending ? "sending" : ""}`}
                                    onClick={() => handleSendReminder(item)}
                                    disabled={isSending || hasSent}
                                    title={`Send reminder to ${
                                      modalStudentData?.USERNAME || "student"
                                    } for ${item.ASSESSMENT_NAME}`}
                                  >
                                    <Bell size={14} className={isSending ? "spin" : ""} />
                                    <span>
                                      {isSending
                                        ? "Sending..."
                                        : hasSent
                                        ? "Reminder Sent"
                                        : "Send Reminder"}
                                    </span>
                                  </button>
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
            </div>

            {/* Modal Footer */}
            <div className="pta-modal-footer">
              <button
                type="button"
                className="btn-modal-close"
                onClick={handleCloseModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTestAnalysis;
