import React, { useState, useEffect, useRef } from "react";
import {
  User,
  GraduationCap,
  Calendar,
  Layers,
  Radio,
  BookOpen,
  Clock,
  CheckCircle,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  MapPin,
  Mail,
  Phone,
  School,
  Award,
  Flame,
  ChevronRight,
  Video,
} from "lucide-react";
import { toast } from "react-toastify";
import "./StudentDashboard.css";
import {
  studentsApi,
  batchesApi,
  attendanceApi,
  classScheduleApi,
  studentAssignmentApi,
  batchAnnouncementsApi,
  courseMaterialApi,
  classDetailsApi
} from "../../services/apiService";

const StudentDashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [activeTab, setActiveTab] = useState("batch");

  // Student & Batch states
  const [studentDetails, setStudentDetails] = useState(null);
  const [assignedBatch, setAssignedBatch] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({
    percentage: 0,
    attended: 0,
    total: 0,
    streak: 0,
  });
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [assignmentSummary, setAssignmentSummary] = useState({
    pending: 0,
    completed: 0,
    total: 0,
  });
  const [materialsCount, setMaterialsCount] = useState(0);

  const isFetched = useRef(false);

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      loadUserAndFetchData();
    }
  }, []);

  const handleManualRefresh = () => {
    loadUserAndFetchData();
  };

  /* =====================================================
     FORMATTING HELPERS
  ===================================================== */
  const formatDisplayDate = (dateVal) => {
    if (!dateVal || dateVal === "-" || dateVal === "—") return "-";
    try {
      const str = String(dateVal).trim();
      if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [d, m, y] = str.split("-");
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split("-");
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        }
      }
      const dt = new Date(dateVal);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
      return String(dateVal);
    } catch (_) {
      return String(dateVal);
    }
  };

  const formatScheduleDay = (dateVal) => {
    if (!dateVal) return "TODAY";
    try {
      const str = String(dateVal).trim();
      const clean = str.split("T")[0];
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        const [d, m, y] = clean.split("-");
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split("-");
        const dt = new Date(Number(y), Number(m) - 1, Number(d));
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      }
      const dt = new Date(dateVal);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      return String(dateVal);
    } catch (_) {
      return String(dateVal);
    }
  };

  const formatScheduleTime = (timeVal) => {
    if (!timeVal) return "16:00";
    const str = String(timeVal).trim();
    if (str.length > 5 && str.includes(":")) {
      const parts = str.split(":");
      return `${parts[0]}:${parts[1]}`;
    }
    return str;
  };

  /* =====================================================
     LOAD LOGGED IN USER & VALIDATE USER TYPE
  ===================================================== */
  const getStoredUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse user session", e);
    }
    return null;
  };

  const loadUserAndFetchData = async () => {
    setLoading(true);
    const user = getStoredUser();
    setCurrentUser(user);

    const role =
      user?.USER_TYPE ||
      user?.ROLE ||
      user?.DESIGNATION ||
      user?.userType ||
      "";

    setUserRole(role);

    const normalizedRole = String(role).trim().toUpperCase();
    const isStudent = normalizedRole === "STUDENT";

    // Stop fetching if user is not student
    if (!isStudent) {
      setLoading(false);
      return;
    }

    // Extract student ID
    const studentId =
      user?.STUDENT_ID ||
      user?.USER_ID ||
      user?.ID ||
      user?.id ||
      user?.studentId;

    // Initial local profile fallbacks
    const profileData = {
      USER_ID: studentId,
      USERNAME: user?.USERNAME || user?.username || user?.FIRST_NAME || "Student User",
      FIRST_NAME: user?.FIRST_NAME || user?.USERNAME || "Student",
      LAST_NAME: user?.LAST_NAME || "",
      EMAIL_ID: user?.EMAIL_ID || user?.email || "-",
      MOBILE_NO: user?.MOBILE_NO || user?.mobile || "-",
      SCHOOL_NAME: user?.SCHOOL_NAME || user?.school || "-",
      GRADE: user?.GRADE || "-",
      ADDRESS_LINE1: user?.ADDRESS_LINE1 || "-",
      ADDRESS_LINE2: user?.ADDRESS_LINE2 || "",
      CITY: user?.CITY || "-",
      DISTRICT: user?.DISTRICT || "-",
      STATE: user?.STATE || "-",
      PINCODE: user?.PINCODE || "-",
      USER_TYPE: "STUDENT",
    };
    setStudentDetails(profileData);

    let resolvedBatchId = user?.BATCH_ID || null;

    try {
      // 1. Fetch Student Profile, Assigned Batch & Attendance Summary
      if (attendanceApi?.getStudentAttendance && studentId) {
        const attRes = await attendanceApi.getStudentAttendance(studentId);
        if (attRes.data && attRes.data.status === 1 && attRes.data.data) {
          const d = attRes.data.data;
          if (d.student) {
            setStudentDetails((prev) => ({
              ...prev,
              ...d.student,
            }));
          }
          if (d.batch) {
            resolvedBatchId = d.batch.ID || resolvedBatchId;
            setAssignedBatch({
              ID: d.batch.ID,
              BATCH_CODE: d.batch.BATCH_CODE || "UNASSIGNED",
              START_DATE: d.batch.START_DATE || "-",
              END_DATE: d.batch.END_DATE || "-",
              TUTOR_NAME: d.batch.TUTOR_NAME || "Lead Instructor",
              STATUS: d.batch.STATUS || "ACTIVE",
            });
          }
          setAttendanceStats({
            percentage: d.overallPercentage ?? 0,
            attended: d.classesAttended ?? 0,
            total: d.totalClasses ?? 0,
            streak: d.currentStreak ?? 0,
          });
        }
      }
    } catch (e) {
      console.warn("Primary attendance/batch fetch notice:", e.message);
    }

    // 2. Concurrently fetch Upcoming Schedule, Batch Announcements, Student Assignments, and Course Materials
    await Promise.allSettled([
      fetchUpcomingSchedule(studentId, resolvedBatchId),
      fetchAnnouncements(studentId, resolvedBatchId),
      fetchStudentAssignments(studentId),
      fetchCourseMaterials(studentId),
    ]);

    setLoading(false);
  };

  /* =====================================================
     API CALL HANDLERS
  ===================================================== */
  const fetchUpcomingSchedule = async (studentId, batchId) => {
    try {
      let scheduleList = [];
      if (classScheduleApi?.getUpcoming && studentId) {
        const res = await classScheduleApi.getUpcoming(studentId, batchId);
        if (res.data && res.data.status === 1 && Array.isArray(res.data.data)) {
          scheduleList = res.data.data;
        }
      }

      // If empty, try classDetailsApi as secondary source
      if (scheduleList.length === 0 && classDetailsApi?.getByStudentId && studentId) {
        const classRes = await classDetailsApi.getByStudentId(studentId);
        if (classRes.data && classRes.data.status === 1 && Array.isArray(classRes.data.data)) {
          scheduleList = classRes.data.data.map((cls) => ({
            ID: cls.ID,
            TOPIC: cls.TOPIC,
            CLASS_DATE: cls.CLASS_DATE || cls.DAY,
            CLASS_TIME: cls.TIME || cls.CLASS_TIME,
            TUTOR_NAME: cls.TUTOR || cls.TUTOR_NAME,
            BATCH_ID: cls.BATCH_ID,
            MEET_LINK: cls.JOIN_LINK || cls.MEET_LINK,
          }));
        }
      }

      setUpcomingClasses(scheduleList);
    } catch (err) {
      console.warn("Schedule API notice:", err.message);
      setUpcomingClasses([]);
    }
  };

  const fetchAnnouncements = async (studentId, batchId) => {
    try {
      if (batchAnnouncementsApi?.getAll) {
        const params = {};
        if (studentId) params.userId = studentId;
        if (batchId) params.batchId = batchId;
        const res = await batchAnnouncementsApi.getAll(params);
        if (res.data && res.data.status === 1 && Array.isArray(res.data.data)) {
          setAnnouncements(res.data.data);
        } else {
          setAnnouncements([]);
        }
      }
    } catch (err) {
      console.warn("Announcements API notice:", err.message);
      setAnnouncements([]);
    }
  };

  const fetchStudentAssignments = async (studentId) => {
    try {
      if (studentAssignmentApi?.getStudentAssignments && studentId) {
        const res = await studentAssignmentApi.getStudentAssignments(studentId);
        if (res.data && res.data.status === 1 && Array.isArray(res.data.data)) {
          const modules = res.data.data;
          let totalCount = 0;
          let completedCount = 0;

          modules.forEach((mod) => {
            const sets = Array.isArray(mod.sets) ? mod.sets : [];
            sets.forEach((set) => {
              totalCount++;
              // isShowExamButton is 0 when completed, 1 when pending
              if (
                set.isShowExamButton === 0 ||
                set.isShowExamButton === "0" ||
                set.isShowExamButton === false ||
                set.IS_SUBMITTED ||
                set.isSubmitted ||
                set.STATUS === "COMPLETED" ||
                set.STATUS === "SUBMITTED"
              ) {
                completedCount++;
              }
            });
          });

          setAssignmentSummary({
            pending: Math.max(0, totalCount - completedCount),
            completed: completedCount,
            total: totalCount,
          });
        }
      }
    } catch (err) {
      console.warn("Assignments API notice:", err.message);
    }
  };

  const fetchCourseMaterials = async (studentId) => {
    try {
      if (courseMaterialApi?.getStudentMaterials && studentId) {
        const res = await courseMaterialApi.getStudentMaterials(studentId);
        if (res.data && res.data.status === 1 && Array.isArray(res.data.data)) {
          setMaterialsCount(res.data.data.length);
        }
      }
    } catch (err) {
      console.warn("Course material API notice:", err.message);
    }
  };

  /* =====================================================
     NAVIGATION HELPERS
  ===================================================== */
  const handleNav = (page) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const normalizedRole = String(userRole).trim().toUpperCase();
  const isStudentRole = normalizedRole === "STUDENT";

  /* =====================================================
     1. NON-STUDENT ACCESS DENIED VIEW
  ===================================================== */
  if (!loading && !isStudentRole) {
    return (
      <div className="student-dashboard-container">
        <div className="access-denied-card">
          <div className="access-denied-icon">
            <ShieldAlert size={36} />
          </div>
          <h2 className="access-denied-title">Student Access Only</h2>
          <p className="access-denied-text">
            This dashboard is strictly reserved for users with an active
            <strong> STUDENT</strong> account. You are currently logged in as a
            <span className="user-role-badge">{normalizedRole || "GUEST"}</span>.
          </p>
          <button
            className="btn-back"
            onClick={() => handleNav("dashboard")}
          >
            Go to Master Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* =====================================================
     2. LOADING SPINNER
  ===================================================== */
  if (loading) {
    return (
      <div className="student-dashboard-container">
        <div className="loading-spinner-box">
          <div className="spinner-ring"></div>
          <p>Loading your personal flight dashboard & batch data...</p>
        </div>
      </div>
    );
  }

  const studentName =
    studentDetails?.USERNAME ||
    studentDetails?.FIRST_NAME ||
    currentUser?.USERNAME ||
    "Student";

  // Format and find Featured / Upcoming Live Class Session (Like Tutor Dashboard)
  const formattedUpcomingClasses = upcomingClasses.map((cls, idx) => ({
    ID: cls.ID || idx + 1,
    TITLE: cls.TOPIC || cls.TOPIC_NAME || cls.CLASS_TITLE || "Live Class Session",
    TOPIC: cls.TOPIC || cls.TOPIC_NAME || cls.CLASS_TITLE || "Live Class Session",
    BATCH_CODE: cls.BATCH_CODE || assignedBatch?.BATCH_CODE || "Assigned Batch",
    START_TIME: cls.CLASS_DATE
      ? `${formatScheduleDay(cls.CLASS_DATE)} · ${formatScheduleTime(cls.CLASS_TIME)}`
      : "Upcoming",
    DATE_STR: formatScheduleDay(cls.CLASS_DATE),
    TIME_STR: formatScheduleTime(cls.CLASS_TIME),
    TUTOR_NAME: cls.TUTOR_NAME || cls.TUTOR || assignedBatch?.TUTOR_NAME || "Instructor",
    MODULE_NAME: cls.MODULE_NAME || studentDetails?.SCHOOL_NAME || "Core Curriculum",
    MEETING_LINK: cls.MEET_LINK || cls.JOIN_LINK || "#",
    IS_LIVE: !!cls.IS_LIVE,
  }));

  const featuredClass = formattedUpcomingClasses.length > 0 ? formattedUpcomingClasses[0] : null;

  return (
    <div className="student-dashboard-container">
      {/* Header Banner */}
      <div className="student-header-banner">
        <div className="student-profile-summary">
          <div className="student-avatar">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div className="student-info-main">
            <h1 className="student-welcome-title">
              Welcome back, {studentName}
            </h1>
            <div className="student-meta-details">
              <span className="student-meta-item">
                <School size={15} color="var(--accent-cyan)" />
                {studentDetails?.SCHOOL_NAME || "Aerosports Academy"}
              </span>
              <span className="student-meta-item">
                <Layers size={15} color="var(--accent-cyan)" />
                Batch: {assignedBatch?.BATCH_CODE || "—"}
              </span>
              <span className="student-meta-item">
                <Mail size={15} color="var(--text-secondary)" />
                {studentDetails?.EMAIL_ID || "student@example.com"}
              </span>
            </div>
          </div>
        </div>

        <div className="header-quick-actions">
          <button
            className="btn-secondary-action"
            onClick={handleManualRefresh}
            title="Refresh Dashboard Data"
          >
            <RefreshCw size={16} />
            Sync
          </button>
        </div>
      </div>

      {/* =========================================================
         HERO LIVE CLASS BANNER (UPCOMING SESSION - LIKE TUTOR DASHBOARD)
      ========================================================= */}
      {featuredClass ? (
        <div className="student-live-banner">
          <div className="live-banner-left">
            <div className={`live-status-pill ${featuredClass.IS_LIVE ? "live-now" : "upcoming"}`}>
              <div className="pulse-dot" />
              {featuredClass.IS_LIVE ? "LIVE • NOW" : "UPCOMING SESSION"}
            </div>
            <h2 className="live-banner-title">{featuredClass.TITLE}</h2>
            <div className="live-banner-meta">
              <div className="meta-item">
                <Layers size={14} />
                <span>{featuredClass.BATCH_CODE}</span>
              </div>
              <div className="meta-item">
                <Clock size={14} />
                <span>{featuredClass.START_TIME}</span>
              </div>
              <div className="meta-item">
                <User size={14} />
                <span>Tutor: {featuredClass.TUTOR_NAME}</span>
              </div>
              <div className="meta-item">
                <BookOpen size={14} />
                <span>{featuredClass.MODULE_NAME}</span>
              </div>
            </div>
          </div>

          <div className="live-banner-right">
            <button
              className="btn-launch-live"
              onClick={() => handleNav("live-class")}
            >
              <Video size={18} />
              Join Live Class
            </button>
          </div>
        </div>
      ) : (
        <div
          className="student-live-banner no-session"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.8))",
          }}
        >
          <div className="live-banner-left">
            <div
              className="live-status-pill upcoming"
              style={{
                background: "rgba(100, 116, 139, 0.2)",
                color: "#94a3b8",
                borderColor: "rgba(100, 116, 139, 0.4)",
              }}
            >
              <Clock size={12} style={{ marginRight: 6 }} />
              NO LIVE SESSIONS SCHEDULED
            </div>
            <h2 className="live-banner-title">No Upcoming Classes Scheduled</h2>
            <div className="live-banner-meta">
              <div className="meta-item">
                <Layers size={14} />
                <span>{assignedBatch?.BATCH_CODE || "Enrolled Cohort"}</span>
              </div>
              <div className="meta-item">
                <Calendar size={14} />
                <span>Check your calendar for upcoming classes</span>
              </div>
            </div>
          </div>

          <div className="live-banner-right">
            <button
              className="btn-launch-live"
              onClick={() => handleNav("calendar")}
            >
              <Calendar size={18} />
              View Full Calendar
            </button>
          </div>
        </div>
      )}

      {/* Metrics Cards Row */}
      <div className="student-metrics-grid">
        {/* Metric 1: Assigned Batch */}
        <div className="student-metric-card">
          <div className="metric-header-row">
            <span className="metric-title">Assigned Batch</span>
            <div className="metric-icon-wrapper">
              <Layers size={18} />
            </div>
          </div>
          <div className="metric-main-value">
            {assignedBatch?.BATCH_CODE || "—"}
          </div>
          <div className="metric-footer-text">
            <span className="badge-status active">
              {assignedBatch?.STATUS || "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Metric 2: Classes Attended */}
        <div className="student-metric-card">
          <div className="metric-header-row">
            <span className="metric-title">Classes Attended</span>
            <div className="metric-icon-wrapper">
              <Calendar size={18} />
            </div>
          </div>
          <div className="metric-main-value">
            {attendanceStats.attended}/{attendanceStats.total || 0}
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(attendanceStats.percentage, 100)}%` }}
            ></div>
          </div>
          <div className="metric-footer-text">
            <span>{attendanceStats.percentage}% attendance rate</span>
            {attendanceStats.streak > 0 && (
              <span className="badge-status warning">
                <Flame size={12} style={{ display: 'inline', marginRight: 2 }} />
                {attendanceStats.streak} day streak
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Pending Assignments */}
        <div className="student-metric-card">
          <div className="metric-header-row">
            <span className="metric-title">Assignments</span>
            <div className="metric-icon-wrapper">
              <FileText size={18} />
            </div>
          </div>
          <div className="metric-main-value">
            {assignmentSummary.pending}
          </div>
          <div className="metric-footer-text">
            <span className="badge-status info">
              {assignmentSummary.completed} Completed
            </span>
            <span>out of {assignmentSummary.total} total</span>
          </div>
        </div>

        {/* Metric 4: Course Materials */}
        <div className="student-metric-card">
          <div className="metric-header-row">
            <span className="metric-title">Course Materials</span>
            <div className="metric-icon-wrapper">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="metric-main-value">
            {materialsCount}
          </div>
          <div className="metric-footer-text">
            <span
              className="card-action-link"
              onClick={() => handleNav("course-material")}
            >
              Browse Library <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="dashboard-tabs-bar">
        <button
          className={`tab-btn ${activeTab === "batch" ? "active" : ""}`}
          onClick={() => setActiveTab("batch")}
        >
          <Layers size={16} /> Schedule & Batch Details
        </button>
        <button
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <User size={16} /> Personal Information
        </button>
        <button
          className={`tab-btn ${activeTab === "learning" ? "active" : ""}`}
          onClick={() => setActiveTab("learning")}
        >
          <GraduationCap size={16} /> Learning & Attendance
        </button>
      </div>

      {/* Tab 1: Schedule & Batch Details */}
      {activeTab === "batch" && (
        <div className="dashboard-section-grid">
          {/* Left Column: Upcoming Schedule (Top) & Assigned Batch Details (Another Section) */}
          <div className="dashboard-left-stack">
            {/* SECTION 1: UPCOMING SCHEDULE (MOVED TO TOP) */}
            <div className="dashboard-card">
              <div className="card-title-row">
                <h3 className="card-title">
                  <Clock size={18} color="var(--accent-cyan)" />
                  Upcoming Schedule
                </h3>
                <span
                  className="card-action-link"
                  onClick={() => handleNav("calendar")}
                >
                  Full Calendar <ChevronRight size={14} />
                </span>
              </div>

              {upcomingClasses.length > 0 ? (
                <div className="classes-list">
                  {upcomingClasses.map((item, idx) => (
                    <div className="class-item-row" key={item.ID || idx}>
                      <div className="class-info-left">
                        <div className="class-time-box">
                          <div className="time-date">
                            {formatScheduleDay(item.CLASS_DATE)}
                          </div>
                          <div className="time-hour">
                            {formatScheduleTime(item.CLASS_TIME)}
                          </div>
                        </div>
                        <div className="class-details-column">
                          <div className="class-topic">
                            {item.TOPIC || item.TOPIC_NAME || item.CLASS_TITLE || "Aerospace Session"}
                          </div>
                          <div className="class-tutor-name">
                            Tutor: {item.TUTOR_NAME || item.TUTOR || "Instructor"}{item.BATCH_CODE ? ` • ${item.BATCH_CODE}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn-join-class"
                        onClick={() => handleNav("live-class")}
                      >
                        Join <ExternalLink size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-card">
                  No upcoming classes scheduled for today. Check your calendar for upcoming sessions.
                </div>
              )}
            </div>

            {/* SECTION 2: BATCH DETAILS (IN ANOTHER SECTION) */}
            <div className="dashboard-card">
              <div className="card-title-row">
                <h3 className="card-title">
                  <Layers size={18} color="var(--accent-cyan)" />
                  Batch Details
                </h3>
                <span
                  className="card-action-link"
                  onClick={() => handleNav("class-details")}
                >
                  View Full Class Details <ChevronRight size={14} />
                </span>
              </div>

              <div className="info-details-grid">
                <div className="info-item-block">
                  <span className="info-label">Batch Code</span>
                  <span className="info-value">{assignedBatch?.BATCH_CODE || "-"}</span>
                </div>
                <div className="info-item-block">
                  <span className="info-label">Status</span>
                  <span className="info-value">
                    <span className="badge-status active">
                      {assignedBatch?.STATUS || "ACTIVE"}
                    </span>
                  </span>
                </div>
                <div className="info-item-block">
                  <span className="info-label">Start Date</span>
                  <span className="info-value">
                    {formatDisplayDate(assignedBatch?.START_DATE)}
                  </span>
                </div>
                <div className="info-item-block">
                  <span className="info-label">End Date</span>
                  <span className="info-value">
                    {formatDisplayDate(assignedBatch?.END_DATE)}
                  </span>
                </div>
                <div className="info-item-block">
                  <span className="info-label">Assigned Tutor</span>
                  <span className="info-value">{assignedBatch?.TUTOR_NAME || "Lead Instructor"}</span>
                </div>
                <div className="info-item-block">
                  <span className="info-label">School / Institution</span>
                  <span className="info-value">{studentDetails?.SCHOOL_NAME || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Announcements & Quick Links */}
          <div className="dashboard-card">
            <div className="card-title-row">
              <h3 className="card-title">
                <Radio size={18} color="var(--accent-cyan)" />
                Batch Announcements
              </h3>
            </div>

            {announcements.length > 0 ? (
              <div className="announcements-list">
                {announcements.slice(0, 4).map((ann, idx) => (
                  <div className="announcement-item" key={ann.ID || idx}>
                    <div className="announcement-title">
                      {ann.TITLE || ann.ANNOUNCEMENT_TITLE || "Important Notice"}
                    </div>
                    <div className="announcement-body">
                      {ann.MESSAGE || ann.CONTENT || "No details provided."}
                    </div>
                    <div className="announcement-date">
                      {formatDisplayDate(ann.CREATED_AT)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-card">
                No recent announcements for your batch.
              </div>
            )}

            <div className="card-title-row" style={{ marginTop: 12 }}>
              <h3 className="card-title">Quick Actions</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                className="btn-secondary-action"
                onClick={() => handleNav("chat-room")}
                style={{ justifyContent: "flex-start" }}
              >
                <MessageSquare size={16} /> Batch Chat Room
              </button>
              <button
                className="btn-secondary-action"
                onClick={() => handleNav("assignment-page")}
                style={{ justifyContent: "flex-start" }}
              >
                <FileText size={16} /> View Assignments
              </button>
              <button
                className="btn-secondary-action"
                onClick={() => handleNav("student-attendance")}
                style={{ justifyContent: "flex-start" }}
              >
                <CheckCircle size={16} /> Detailed Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Student Profile Information */}
      {activeTab === "profile" && (
        <div className="dashboard-card">
          <div className="card-title-row">
            <h3 className="card-title">
              <User size={18} color="var(--accent-cyan)" />
              Student Profile & Registration Details
            </h3>
            <span
              className="card-action-link"
              onClick={() => handleNav("profile")}
            >
              Edit Profile <ChevronRight size={14} />
            </span>
          </div>

          <div className="info-details-grid">
            <div className="info-item-block">
              <span className="info-label">Full Name</span>
              <span className="info-value">{studentDetails?.USERNAME || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Account User Type</span>
              <span className="info-value">
                <span className="badge-status active">STUDENT</span>
              </span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Email Address</span>
              <span className="info-value">{studentDetails?.EMAIL_ID || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Mobile Number</span>
              <span className="info-value">{studentDetails?.MOBILE_NO || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">School Name</span>
              <span className="info-value">{studentDetails?.SCHOOL_NAME || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Enrolled Batch</span>
              <span className="info-value">
                {assignedBatch?.BATCH_CODE || "-"}
              </span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Address Line 1</span>
              <span className="info-value">{studentDetails?.ADDRESS_LINE1 || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Address Line 2</span>
              <span className="info-value">{studentDetails?.ADDRESS_LINE2 || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">City</span>
              <span className="info-value">{studentDetails?.CITY || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">District</span>
              <span className="info-value">{studentDetails?.DISTRICT || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">State</span>
              <span className="info-value">{studentDetails?.STATE || "-"}</span>
            </div>
            <div className="info-item-block">
              <span className="info-label">Pincode</span>
              <span className="info-value">{studentDetails?.PINCODE || "-"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Learning & Attendance */}
      {activeTab === "learning" && (
        <div className="dashboard-section-grid">
          <div className="dashboard-card">
            <div className="card-title-row">
              <h3 className="card-title">
                <CheckCircle size={18} color="var(--accent-cyan)" />
                Attendance Summary
              </h3>
              <span
                className="card-action-link"
                onClick={() => handleNav("student-attendance")}
              >
                Full Attendance Log <ChevronRight size={14} />
              </span>
            </div>

            <div className="info-details-grid">
              <div className="info-item-block">
                <span className="info-label">Overall Percentage</span>
                <span className="info-value" style={{ color: "var(--accent-cyan)", fontSize: "1.3rem" }}>
                  {attendanceStats.percentage}%
                </span>
              </div>
              <div className="info-item-block">
                <span className="info-label">Classes Attended</span>
                <span className="info-value">{attendanceStats.attended}/{attendanceStats.total || 0}</span>
              </div>
              <div className="info-item-block">
                <span className="info-label">Eligible Classes</span>
                <span className="info-value">{attendanceStats.total || 0} Sessions</span>
              </div>
              <div className="info-item-block">
                <span className="info-label">Current Streak</span>
                <span className="info-value">{attendanceStats.streak} Days</span>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title-row">
              <h3 className="card-title">
                <GraduationCap size={18} color="var(--accent-cyan)" />
                Assignments Overview
              </h3>
              <span
                className="card-action-link"
                onClick={() => handleNav("assignment-page")}
              >
                Go to Assignments <ChevronRight size={14} />
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="info-item-block">
                <span className="info-label">Pending Assignments</span>
                <span className="info-value" style={{ color: "#fbbf24" }}>
                  {assignmentSummary.pending} Tasks Pending
                </span>
              </div>
              <div className="info-item-block">
                <span className="info-label">Completed Assignments</span>
                <span className="info-value" style={{ color: "#4ade80" }}>
                  {assignmentSummary.completed} Tasks Submitted
                </span>
              </div>
              <div className="info-item-block">
                <span className="info-label">Total Assigned</span>
                <span className="info-value">{assignmentSummary.total} Total Tasks</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
