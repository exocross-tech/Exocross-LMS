import React, { useState, useEffect, useMemo, useRef } from "react";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  UserCheck,
  Users,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Save,
  Filter,
  Layers,
  Video,
  Check,
  X as CloseIcon,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import "./AttendanceMarking.css";
import { attendanceApi } from "../../services/apiService";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    height: "42px",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    border: state.isFocused ? "1px solid #00e5ff" : "1px solid #334155",
    borderRadius: "10px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 229, 255, 0.12)" : "none",
    cursor: "pointer",
  }),
  singleValue: (base) => ({ ...base, color: "#f8fafc", fontSize: "0.85rem" }),
  placeholder: (base) => ({ ...base, color: "#64748b", fontSize: "0.85rem" }),
  input: (base) => ({ ...base, color: "#fff", fontSize: "0.85rem" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "#94a3b8" }),
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
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#06b6d4"
      : state.isFocused
        ? "rgba(0, 229, 255, 0.12)"
        : "transparent",
    color: state.isSelected ? "#001018" : "#f8fafc",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "0.85rem",
  }),
};

const AttendanceMarking = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isFetched = useRef(false);

  const getStoredUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;
    fetchInitialData(null, null);
  }, []);

  const fetchInitialData = async (batchId, classId) => {
    setLoading(true);
    try {
      const user = getStoredUser();
      const userId = user?.USER_ID || user?.userId || user?.id;
      const userType =
        user?.USER_TYPE || user?.ROLE || user?.role || user?.DESIGNATION;

      const res = await attendanceApi.getInitialData(
        batchId,
        classId,
        userId,
        userType
      );
      if (res.data.status === 1) {
        const {
          batches: fetchedBatches,
          selectedBatch: currentBatch,
          sessions: fetchedSessions,
          lastConductedSession: currentSession,
          students: fetchedStudents,
        } = res.data.data;

        // Map batches to select options
        const batchOpts = fetchedBatches.map((b) => ({
          value: b.ID,
          label: b.BATCH_CODE,
          batchCode: b.BATCH_CODE,
          totalStudents: b.TOTAL_STUDENTS || 0,
        }));

        setBatches(batchOpts);

        if (currentBatch) {
          const matchedBatchOpt = batchOpts.find(
            (b) => b.value === currentBatch.ID,
          );
          setSelectedBatch(matchedBatchOpt || batchOpts[0] || null);
        } else {
          setSelectedBatch(batchOpts[0] || null);
        }

        // Map sessions to select options
        const sessionOpts = fetchedSessions.map((s) => ({
          value: s.ID,
          label: `${s.TOPIC} (${s.CLASS_DATE} ${s.CLASS_TIME})${s.isStarted === false ? " — Upcoming (Not Started)" : ""}`,
          topic: s.TOPIC,
          classDate: s.CLASS_DATE,
          classTime: s.CLASS_TIME,
          meetLink: s.MEET_LINK,
          isStarted: s.isStarted !== false,
        }));

        setSessions(sessionOpts);

        if (currentSession) {
          const matchedSessionOpt = sessionOpts.find(
            (s) => s.value === currentSession.ID,
          );
          setSelectedSession(matchedSessionOpt || sessionOpts[0] || null);
        } else {
          setSelectedSession(sessionOpts[0] || null);
        }

        // Map students state (Initial unmarked state is null = Not Marked)
        const studentList = fetchedStudents.map((st) => ({
          studentId: st.STUDENT_ID,
          username: st.USERNAME || "Student",
          emailId: st.EMAIL_ID || "",
          mobileNo: st.MOBILE_NO || "N/A",
          attendanceStatus:
            st.ATTENDANCE_STATUS === 1 || st.ATTENDANCE_STATUS === "1"
              ? 1
              : st.ATTENDANCE_STATUS === 0 || st.ATTENDANCE_STATUS === "0"
              ? 0
              : null,
          remarks: st.REMARKS || "",
        }));

        setStudents(studentList);
      }
    } catch (err) {
      console.error("Failed to load attendance data", err);
      toast.error("Failed to load attendance details");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchChange = (batchOpt) => {
    setSelectedBatch(batchOpt);
    fetchInitialData(batchOpt.value, null);
  };

  const handleSessionChange = (sessionOpt) => {
    setSelectedSession(sessionOpt);
    if (selectedBatch) {
      fetchInitialData(selectedBatch.value, sessionOpt.value);
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    setStudents((prev) =>
      prev.map((st) =>
        st.studentId === studentId ? { ...st, attendanceStatus: newStatus } : st,
      ),
    );
  };

  const handleRemarksChange = (studentId, newRemarks) => {
    setStudents((prev) =>
      prev.map((st) =>
        st.studentId === studentId ? { ...st, remarks: newRemarks } : st,
      ),
    );
  };

  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((st) => ({ ...st, attendanceStatus: 1 })),
    );
    toast.info("Marked all students as Present");
  };

  const handleMarkAllAbsent = () => {
    setStudents((prev) =>
      prev.map((st) => ({ ...st, attendanceStatus: 0 })),
    );
    toast.info("Marked all students as Absent");
  };

  const handleResetAllNotMarked = () => {
    setStudents((prev) =>
      prev.map((st) => ({ ...st, attendanceStatus: null })),
    );
    toast.info("Reset all students to Not Marked");
  };

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const matchesSearch =
        st.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.emailId.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "PRESENT") return st.attendanceStatus === 1;
      if (statusFilter === "ABSENT") return st.attendanceStatus === 0;
      if (statusFilter === "NOT_MARKED")
        return st.attendanceStatus === null || st.attendanceStatus === undefined;

      return true;
    });
  }, [students, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = students.length;
    const present = students.filter((s) => s.attendanceStatus === 1).length;
    const absent = students.filter((s) => s.attendanceStatus === 0).length;
    const notMarked = students.filter(
      (s) => s.attendanceStatus === null || s.attendanceStatus === undefined,
    ).length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, notMarked, percentage };
  }, [students]);

  const handleSubmit = async () => {
    if (!selectedBatch || !selectedSession) {
      toast.error("Please select a valid batch and class session");
      return;
    }

    if (selectedSession && !selectedSession.isStarted) {
      toast.warning(
        "Attendance can only be marked once the class has started onwards (ongoing or finished)."
      );
      return;
    }

    if (students.length === 0) {
      toast.error("No students available to mark attendance");
      return;
    }

    setSubmitting(true);
    try {
      const user = getStoredUser();
      const userId = user?.USER_ID || user?.userId || user?.id;
      const userType =
        user?.USER_TYPE || user?.ROLE || user?.role || user?.DESIGNATION;
      const userName = user?.USERNAME || user?.username || "TUTOR";

      const payload = {
        classId: selectedSession.value,
        batchId: selectedBatch.value,
        userId,
        userType,
        createdBy: userName,
        attendance: students.map((s) => ({
          studentId: s.studentId,
          attendanceStatus:
            s.attendanceStatus === 1 ? 1 : s.attendanceStatus === 0 ? 0 : null,
          remarks: s.remarks,
        })),
      };

      const res = await attendanceApi.submit(payload);
      if (res.data.status === 1) {
        toast.success(res.data.message || "Attendance saved successfully!");
        // Refresh displayed attendance state
        await fetchInitialData(selectedBatch.value, selectedSession.value);
      } else {
        toast.error(res.data.message || "Failed to save attendance");
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="attendance-page">
      {/* HEADER SECTION */}
      <div className="attendance-header">
        <div className="header-left1">
          <div className="section-label">
            <UserCheck size={13} className="live-dot" />
            <span>SESSION ATTENDANCE</span>
          </div>
          <h1 className="header-main-title">Attendance Marking</h1>
          <p className="header-subtitle">
            Review conducted sessions, manage student attendance, and log session remarks.
          </p>
        </div>
      </div>

      {/* TOP CONFIGURATION GRID */}
      <div className="attendance-config-grid">
        {/* CARD 1: CURRENTLY ASSIGNED BATCH */}
        <div className="config-card">
          <div className="config-card-header">
            <div className="card-icon-title">
              <Layers size={18} color="#00f0ff" />
              <h3>Assigned Batch</h3>
            </div>
            {selectedBatch && (
              <span className="count-pill">{stats.total} Enrolled</span>
            )}
          </div>

          <div className="config-field">
            <label>SELECT BATCH</label>
            <Select
              value={selectedBatch}
              onChange={handleBatchChange}
              options={batches}
              styles={selectStyles}
              isSearchable={true}
              placeholder="Select assigned batch..."
              isLoading={loading}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
            />
          </div>

          {selectedBatch ? (
            <div className="batch-info-box">
              <div className="info-row">
                <span className="info-label">Code:</span>
                <span className="info-value highlight">{selectedBatch.batchCode}</span>
              </div>
            </div>
          ) : (
            <div className="no-info-msg">No active batch selected</div>
          )}
        </div>

        {/* CARD 2: LAST CONDUCTED SESSION DETAILS */}
        <div className="config-card">
          <div className="config-card-header">
            <div className="card-icon-title">
              <Clock size={18} color="#00f0ff" />
              <h3>Class Session</h3>
            </div>
            {selectedSession && (
              <span
                className={
                  selectedSession.isStarted
                    ? "status-badge-live"
                    : "status-badge-upcoming"
                }
              >
                {selectedSession.isStarted
                  ? "Ongoing / Finished"
                  : "Upcoming (Not Started)"}
              </span>
            )}
          </div>

          <div className="config-field">
            <label>SELECT SESSION</label>
            <Select
              value={selectedSession}
              onChange={handleSessionChange}
              options={sessions}
              styles={selectStyles}
              isSearchable={true}
              placeholder="Select session..."
              isLoading={loading}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
            />
          </div>

          {selectedSession ? (
            <div className="session-info-box">
              <div className="session-topic-title">{selectedSession.topic}</div>
              <div className="session-meta-row">
                <div className="meta-item">
                  <Calendar size={13} color="#94a3b8" />
                  <span>{selectedSession.classDate}</span>
                </div>
                <div className="meta-item">
                  <Clock size={13} color="#00e5ff" />
                  <span className="time-text">{selectedSession.classTime}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-info-msg">No session available for this batch</div>
          )}
        </div>
      </div>

      {/* ATTENDANCE WORKSPACE CARD */}
      <div className="attendance-workspace-card">
        {/* WARNING BANNER FOR UPCOMING / NOT STARTED SESSIONS */}
        {selectedSession && !selectedSession.isStarted && (
          <div className="attendance-warning-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Attendance Locked:</strong> This class session is scheduled for{" "}
              <strong>{selectedSession.classDate} {selectedSession.classTime}</strong> and has not started yet. Tutors can mark attendance once the class starts onwards (ongoing or finished).
            </div>
          </div>
        )}
        {/* TOOLBAR: SEARCH, FILTERS & QUICK ACTIONS */}
        <div className="workspace-toolbar">
          <div className="toolbar-left">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search student by name or email..."
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

            <div className="filter-group">
              <button
                className={`filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                All ({stats.total})
              </button>
              <button
                className={`filter-tab present ${statusFilter === "PRESENT" ? "active" : ""}`}
                onClick={() => setStatusFilter("PRESENT")}
              >
                Present ({stats.present})
              </button>
              <button
                className={`filter-tab absent ${statusFilter === "ABSENT" ? "active" : ""}`}
                onClick={() => setStatusFilter("ABSENT")}
              >
                Absent ({stats.absent})
              </button>
              <button
                className={`filter-tab not-marked ${statusFilter === "NOT_MARKED" ? "active" : ""}`}
                onClick={() => setStatusFilter("NOT_MARKED")}
              >
                Not Marked ({stats.notMarked})
              </button>
            </div>
          </div>

          <div className="toolbar-right">
            <div className="quick-actions">
              <button
                type="button"
                className="action-btn mark-present-btn"
                onClick={handleMarkAllPresent}
                disabled={!selectedSession?.isStarted}
                title={
                  !selectedSession?.isStarted
                    ? "Class has not started yet"
                    : "Mark all as Present"
                }
              >
                <CheckCircle2 size={15} />
                <span>Mark All Present</span>
              </button>
              <button
                type="button"
                className="action-btn mark-absent-btn"
                onClick={handleMarkAllAbsent}
                disabled={!selectedSession?.isStarted}
                title={
                  !selectedSession?.isStarted
                    ? "Class has not started yet"
                    : "Mark all as Absent"
                }
              >
                <XCircle size={15} />
                <span>Mark All Absent</span>
              </button>
              <button
                type="button"
                className="action-btn mark-unmarked-btn"
                onClick={handleResetAllNotMarked}
                title={
                  !selectedSession?.isStarted
                    ? "Class has not started yet"
                    : "Reset all to Not Marked"
                }
                disabled={!selectedSession?.isStarted}
              >
                <RotateCcw size={14} />
                <span>Reset Not Marked</span>
              </button>
            </div>
          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        <div className="summary-stats-bar">
          <div className="stat-card">
            <span className="stat-lbl">TOTAL STUDENTS</span>
            <span className="stat-val">{stats.total}</span>
          </div>
          <div className="stat-card green">
            <span className="stat-lbl">PRESENT</span>
            <span className="stat-val">{stats.present}</span>
          </div>
          <div className="stat-card red">
            <span className="stat-lbl">ABSENT</span>
            <span className="stat-val">{stats.absent}</span>
          </div>
          <div className="stat-card slate">
            <span className="stat-lbl">NOT MARKED</span>
            <span className="stat-val">{stats.notMarked}</span>
          </div>
          <div className="stat-card cyan">
            <span className="stat-lbl">ATTENDANCE RATE</span>
            <span className="stat-val">{stats.percentage}%</span>
          </div>
        </div>

        {/* STUDENT LIST TABLE */}
        {loading ? (
          <div className="table-loading-container">
            <div className="spinner"></div>
            <span>Loading student list...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="no-students-msg">
            <Users size={32} className="empty-icon" />
            <p>No students found for the selected filter or batch.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>STUDENT DETAILS</th>
                  <th>CONTACT NO</th>
                  <th style={{ width: "320px" }}>ATTENDANCE STATUS</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => (
                  <tr key={student.studentId}>
                    <td className="col-idx">{idx + 1}</td>
                    <td>
                      <div className="student-info-cell">
                        <div className="avatar-circle">
                          {student.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="student-name">{student.username}</div>
                          <div className="student-email">{student.emailId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-mobile">{student.mobileNo}</td>
                    <td>
                      <div className="status-toggle-group">
                        <button
                          type="button"
                          className={`toggle-btn present-btn ${student.attendanceStatus === 1 ? "selected" : ""}`}
                          onClick={() => handleStatusChange(student.studentId, 1)}
                          disabled={!selectedSession?.isStarted}
                          title={!selectedSession?.isStarted ? "Class has not started yet" : ""}
                        >
                          <Check size={14} />
                          <span>Present</span>
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn absent-btn ${student.attendanceStatus === 0 ? "selected" : ""}`}
                          onClick={() => handleStatusChange(student.studentId, 0)}
                          disabled={!selectedSession?.isStarted}
                          title={!selectedSession?.isStarted ? "Class has not started yet" : ""}
                        >
                          <CloseIcon size={14} />
                          <span>Absent</span>
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn unmarked-btn ${student.attendanceStatus === null || student.attendanceStatus === undefined ? "selected" : ""}`}
                          onClick={() => handleStatusChange(student.studentId, null)}
                          disabled={!selectedSession?.isStarted}
                          title={!selectedSession?.isStarted ? "Class has not started yet" : ""}
                        >
                          <HelpCircle size={14} />
                          <span>Not Marked</span>
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="remarks-input"
                        placeholder={
                          !selectedSession?.isStarted
                            ? "Session not started..."
                            : "Add optional remark..."
                        }
                        value={student.remarks}
                        onChange={(e) =>
                          handleRemarksChange(student.studentId, e.target.value)
                        }
                        disabled={!selectedSession?.isStarted}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBMIT FOOTER BAR */}
        <div className="attendance-submit-bar">
          <div className="submit-info">
            <Sparkles size={16} color="#00f0ff" />
            <span>
              Session: <strong>{selectedSession ? selectedSession.topic : "No session selected"}</strong> ({stats.present} Present / {stats.absent} Absent / {stats.notMarked} Not Marked).
            </span>
          </div>

          <button
            type="button"
            className="submit-attendance-btn"
            onClick={handleSubmit}
            disabled={
              submitting ||
              loading ||
              students.length === 0 ||
              !selectedSession?.isStarted
            }
            title={
              !selectedSession?.isStarted
                ? "Attendance can only be marked once the class starts onwards"
                : ""
            }
          >
            {submitting ? (
              <>
                <span className="btn-spinner"></span>
                <span>Saving Attendance...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Submit Attendance</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMarking;
