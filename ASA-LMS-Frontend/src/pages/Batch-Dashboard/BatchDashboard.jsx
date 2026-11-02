import React, { useState, useEffect, useRef, useCallback } from "react";
import "./BatchDashboard.css";
import {
  batchesApi,
  classScheduleApi,
  batchAnnouncementsApi,
  finalAssessmentApi,
} from "../../services/apiService";
import {
  Users,
  Layers,
  Calendar,
  Clock,
  CheckCircle,
  Radio,
  Bell,
  ChevronDown,
  ArrowRight,
  PlusCircle,
  Award,
  BookOpen,
  Filter,
  FileText,
  UserCheck,
  Shield,
  Crown,
  Video,
  ExternalLink,
  ClipboardList,
} from "lucide-react";

const BatchDashboard = ({ onNavigate }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [batchesList, setBatchesList] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("ALL");
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [pendingEvaluations, setPendingEvaluations] = useState(0);
  const [loading, setLoading] = useState(true);

  const isFetched = useRef(false);

  // 1. Read Current User Session
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
      console.error("Error reading user data in BatchDashboard:", e);
    }
  }, []);

  const userType = String(
    currentUser?.USER_TYPE || currentUser?.ROLE || ""
  ).toUpperCase();
  const isAdmin = userType === "ADMIN";
  const currentUserId =
    currentUser?.USER_ID ||
    currentUser?.userId ||
    currentUser?.id ||
    currentUser?.ID;

  // 2. Fetch Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (!isAdmin && currentUserId) {
        params.tutorId = currentUserId;
      }

      // Fetch Batches
      const batchRes = await batchesApi.getBatches(params);
      if (batchRes?.data?.status === 1 && Array.isArray(batchRes.data.data)) {
        setBatchesList(batchRes.data.data);
      } else if (Array.isArray(batchRes?.data)) {
        setBatchesList(batchRes.data);
      }

      // Fetch Upcoming Classes
      try {
        const classRes = await classScheduleApi.getUpcoming(currentUserId);
        if (classRes?.data?.status === 1 && Array.isArray(classRes.data.data)) {
          setUpcomingClasses(classRes.data.data);
        } else if (Array.isArray(classRes?.data)) {
          setUpcomingClasses(classRes.data);
        }
      } catch (e) {
        console.warn("Class schedule fetch error:", e);
      }

      // Fetch Announcements
      try {
        if (currentUserId) {
          const annRes = await batchAnnouncementsApi.getAll({
            userId: currentUserId,
          });
          if (annRes?.data?.status === 1 && Array.isArray(annRes.data.data)) {
            setAnnouncements(annRes.data.data);
          } else if (Array.isArray(annRes?.data)) {
            setAnnouncements(annRes.data);
          }
        }
      } catch (e) {
        console.warn("Announcements fetch error:", e);
      }

      // Fetch Evaluations Count
      try {
        if (currentUserId) {
          const evalRes = await finalAssessmentApi.getAllByTutor(currentUserId);
          if (evalRes?.data?.data && Array.isArray(evalRes.data.data)) {
            setPendingEvaluations(evalRes.data.data.length);
          }
        }
      } catch (e) {
        console.warn("Evaluations fetch error:", e);
      }
    } catch (err) {
      console.error("BatchDashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, currentUserId]);

  useEffect(() => {
    if (currentUser !== null && !isFetched.current) {
      isFetched.current = true;
      fetchDashboardData();
    }
  }, [currentUser, fetchDashboardData]);

  // Batches for the current user
  const displayBatches = batchesList;

  // Filter Active Batches based on Dropdown
  const activeSelectedBatches =
    selectedBatchId === "ALL"
      ? displayBatches
      : displayBatches.filter(
          (b) =>
            String(b.ID) === String(selectedBatchId) ||
            b.BATCH_CODE === selectedBatchId
        );

  // Compute Aggregated Statistics
  const totalBatchesCount = displayBatches.length;
  const hostCount = displayBatches.filter(
    (b) => String(b.TUTOR_ROLE || "").toUpperCase() === "HOST"
  ).length;
  const supportCount = totalBatchesCount - hostCount;

  const totalStudentsCount = activeSelectedBatches.reduce(
    (acc, b) => acc + Number(b.TOTAL_STUDENTS ?? b.STUDENT_COUNT ?? b.STUDENTS_PREVIEW?.length ?? 0),
    0
  );

  // Attendance calculation across selected batches
  let totalPresent = 0;
  let totalAbsent = 0;
  activeSelectedBatches.forEach((b) => {
    totalPresent += Number(b.PRESENT_COUNT || 0);
    totalAbsent += Number(b.ABSENT_COUNT || 0);
  });
  const totalAttRecords = totalPresent + totalAbsent;
  const avgAttendancePct =
    totalAttRecords > 0 ? Math.round((totalPresent / totalAttRecords) * 100) : 0;

  // Format real upcoming classes from backend
  const formattedUpcomingClasses = upcomingClasses.map((cls, idx) => ({
    ID: cls.ID || idx + 1,
    TITLE: cls.TOPIC || cls.TITLE || "Live Class Session",
    TOPIC: cls.TOPIC || cls.TITLE || "Live Class Session",
    BATCH_CODE: cls.BATCH_CODE || "Assigned Cohort",
    START_TIME: cls.CLASS_DATE
      ? `${new Date(cls.CLASS_DATE).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${cls.CLASS_TIME ? cls.CLASS_TIME.substring(0, 5) : "TBD"}`
      : (cls.START_TIME || "Upcoming"),
    DATE_STR: cls.CLASS_DATE
      ? new Date(cls.CLASS_DATE).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "Upcoming",
    TIME_STR: cls.CLASS_TIME ? cls.CLASS_TIME.substring(0, 5) : "TBD",
    TUTOR_NAME: cls.TUTOR_NAME || currentUser?.USERNAME || "Assigned Tutor",
    MODULE_NAME: cls.MODULE_NAME || cls.BATCH_NAME || "Core Curriculum",
    MEETING_LINK: cls.MEET_LINK || "#",
    IS_LIVE: !!cls.IS_LIVE,
  }));

  // Selected Batch Live Session / Hero Highlight
  const featuredClass = formattedUpcomingClasses.length > 0 ? formattedUpcomingClasses[0] : null;

  // Display Schedule List
  const displaySchedule = formattedUpcomingClasses;

  // Display Announcements List
  const displayAnnouncements = announcements;

  // Flattened Students Roster for the Selected Batch(es)
  let studentRoster = [];
  activeSelectedBatches.forEach((b) => {
    if (b.STUDENTS_PREVIEW && Array.isArray(b.STUDENTS_PREVIEW)) {
      b.STUDENTS_PREVIEW.forEach((st) => {
        studentRoster.push({
          ...st,
          BATCH_CODE: b.BATCH_CODE,
        });
      });
    }
  });

  // Navigation Helper
  const handleNav = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
    }
  };

  return (
    <div className="batch-db-container">
      {/* =================================================--------
         1. HEADER & CONTROLS TOOLBAR
      ================================================--------- */}
      <div className="batch-db-header">
        <div className="batch-db-breadcrumb">COHORT • FLIGHT DASHBOARD</div>

        <div className="batch-db-title-row">
          <div className="batch-db-title-left">
            <h1>Batch Dashboard</h1>
            <p>Real-time analytics, live class scheduling, and student engagement overview.</p>
          </div>

          <div className="batch-db-header-actions">
            {/* Batch Selector Dropdown */}
            <div className="batch-select-wrapper">
              <Filter size={16} className="batch-select-icon" />
              <select
                className="batch-select-dropdown"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="ALL">All Assigned Batches ({displayBatches.length})</option>
                {displayBatches.map((b) => (
                  <option key={b.ID || b.BATCH_CODE} value={b.ID || b.BATCH_CODE}>
                    {b.BATCH_CODE}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="batch-select-arrow" />
            </div>

            {/* Quick Action Shortcuts */}
            <button
              className="btn-db-action primary"
              onClick={() => handleNav("class-scheduling")}
            >
              <Radio size={16} />
              Schedule Class
            </button>

            <button
              className="btn-db-action secondary"
              onClick={() => handleNav("attendance-marking")}
            >
              <UserCheck size={16} />
              Mark Attendance
            </button>
          </div>
        </div>
      </div>

      {/* =================================================--------
         2. HERO LIVE CLASS BANNER
      ================================================--------- */}
      {featuredClass ? (
        <div className="batch-live-banner">
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
              Launch Live Room
            </button>
          </div>
        </div>
      ) : (
        <div className="batch-live-banner no-session" style={{ background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.8))" }}>
          <div className="live-banner-left">
            <div className="live-status-pill upcoming" style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8", borderColor: "rgba(100, 116, 139, 0.4)" }}>
              <Clock size={12} style={{ marginRight: 6 }} />
              NO LIVE SESSIONS SCHEDULED
            </div>
            <h2 className="live-banner-title">No Upcoming Classes Scheduled</h2>
            <div className="live-banner-meta">
              <div className="meta-item">
                <Layers size={14} />
                <span>{displayBatches.length > 0 ? `${displayBatches.length} Assigned Batches` : "No Assigned Batches"}</span>
              </div>
              <div className="meta-item">
                <Calendar size={14} />
                <span>Ready for scheduling</span>
              </div>
            </div>
          </div>

          <div className="live-banner-right">
            <button
              className="btn-launch-live"
              onClick={() => handleNav("class-scheduling")}
            >
              <Radio size={18} />
              Schedule New Class
            </button>
          </div>
        </div>
      )}

      {/* =================================================--------
         3. TOP KPI METRICS STRIP
      ================================================--------- */}
      <div className="batch-metrics-grid">
        <div className="batch-stat-card">
          <div className="stat-header-row">
            <div className="stat-header-left">
              <span>ASSIGNED BATCHES</span>
            </div>
            <div className="stat-icon-wrapper cyan">
              <Layers size={18} />
            </div>
          </div>
          <div className="stat-number">{totalBatchesCount}</div>
          <div className="stat-footer-text">
            <span><strong>{hostCount}</strong> Host • <strong>{supportCount}</strong> Support</span>
          </div>
        </div>

        <div className="batch-stat-card">
          <div className="stat-header-row">
            <div className="stat-header-left">
              <span>ENROLLED STUDENTS</span>
            </div>
            <div className="stat-icon-wrapper purple">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-number">{totalStudentsCount}</div>
          <div className="stat-footer-text">
            <span>Across selected cohorts</span>
          </div>
        </div>

        <div className="batch-stat-card">
          <div className="stat-header-row">
            <div className="stat-header-left">
              <span>AVG ATTENDANCE</span>
            </div>
            <div className="stat-icon-wrapper green">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="stat-number">{avgAttendancePct}%</div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill" style={{ width: `${avgAttendancePct}%` }} />
          </div>
        </div>

        <div className="batch-stat-card">
          <div className="stat-header-row">
            <div className="stat-header-left">
              <span>EVALUATIONS PENDING</span>
            </div>
            <div className="stat-icon-wrapper amber">
              <ClipboardList size={18} />
            </div>
          </div>
          <div className="stat-number">{pendingEvaluations || 0}</div>
          <div className="stat-footer-text">
            <span
              className="btn-panel-link"
              onClick={() => handleNav("assessment-evaluation")}
              style={{ cursor: "pointer" }}
            >
              Grade Submissions <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* =================================================--------
         4. MIDDLE SECTION GRID: BATCH HEALTH & UPCOMING SCHEDULE
      ================================================--------- */}
      <div className="batch-db-grid-row">
        {/* Panel 1: Batch Performance & Health */}
        <div className="db-panel">
          <div className="db-panel-header">
            <h2>
              <Layers size={18} color="var(--accent-cyan)" />
              Batch Health & Completion
            </h2>
            <button className="btn-panel-link" onClick={() => handleNav("batches")}>
              View All Batches <ArrowRight size={14} />
            </button>
          </div>

          <div className="batch-health-list">
            {activeSelectedBatches.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b" }}>
                <Layers size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>No active batch assigned.</p>
              </div>
            ) : (
              activeSelectedBatches.map((batch, idx) => {
                const isHost = String(batch.TUTOR_ROLE || "HOST").toUpperCase() === "HOST";
                const completion = batch.COMPLETION || 0;
                const studentCount = Number(
                  batch.TOTAL_STUDENTS ?? batch.STUDENT_COUNT ?? batch.STUDENTS_PREVIEW?.length ?? 0
                );
                const attPct = batch.PRESENT_PERCENTAGE ?? 0;

                return (
                  <div className="batch-health-card" key={batch.ID || idx}>
                    <div className="health-card-top">
                      <div className="batch-title-group">
                        <span className="batch-code-pill">{batch.BATCH_CODE}</span>
                        {batch.BATCH_NAME && (
                          <span style={{ marginLeft: 8, fontSize: "0.85rem", color: "#94a3b8" }}>
                            {batch.BATCH_NAME}
                          </span>
                        )}
                      </div>

                      <span className={`role-tag-pill ${isHost ? "host" : "support"}`}>
                        {isHost ? <Crown size={12} /> : <Shield size={12} />}
                        {isHost ? "HOST TUTOR" : "SUPPORT TUTOR"}
                      </span>
                    </div>

                    <div className="health-stats-row">
                      <div className="h-stat-box">
                        <span className="h-stat-label">Students</span>
                        <span className="h-stat-value">{studentCount} Active</span>
                      </div>
                      <div className="h-stat-box">
                        <span className="h-stat-label">Attendance</span>
                        <span className="h-stat-value green">
                          {attPct}%
                        </span>
                      </div>
                      <div className="h-stat-box">
                        <span className="h-stat-label">Classes</span>
                        <span className="h-stat-value cyan">
                          {batch.CLASS_COUNT || 0}
                        </span>
                      </div>
                    </div>

                    <div className="batch-progress-wrapper">
                      <div className="batch-progress-labels">
                        <span>Course Progress</span>
                        <span><strong>{completion}%</strong> Completed</span>
                      </div>
                      <div className="batch-track">
                        <div className="batch-fill" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2: Class Schedule Timeline */}
        <div className="db-panel">
          <div className="db-panel-header">
            <h2>
              <Calendar size={18} color="var(--accent-cyan)" />
              Class Operations
            </h2>
            <button className="btn-panel-link" onClick={() => handleNav("class-scheduling")}>
              Manage <ArrowRight size={14} />
            </button>
          </div>

          <div className="schedule-timeline-list">
            {displaySchedule.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b" }}>
                <Calendar size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>No upcoming classes scheduled.</p>
              </div>
            ) : (
              displaySchedule.map((item, idx) => (
                <div className="schedule-item-card" key={item.ID || idx}>
                  <div className="time-box">
                    <span className="time-str">{item.TIME_STR || "TBD"}</span>
                    <span className="date-str">{item.DATE_STR || "Upcoming"}</span>
                  </div>

                  <div className="schedule-info">
                    <div className="schedule-topic">{item.TITLE || item.TOPIC}</div>
                    <div className="schedule-sub">
                      <span className="batch-badge-sm">{item.BATCH_CODE}</span>
                      <span>• {item.MODULE_NAME || "Core Unit"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =================================================--------
         5. BOTTOM SECTION GRID: STUDENT ROSTER & ANNOUNCEMENTS
      ================================================--------- */}
      <div className="batch-db-grid-row">
        {/* Panel 3: Student Roster Overview */}
        <div className="db-panel">
          <div className="db-panel-header">
            <h2>
              <Users size={18} color="var(--accent-cyan)" />
              Student Engagement Roster
            </h2>
            <button className="btn-panel-link" onClick={() => handleNav("student-allocation")}>
              Allocations <ArrowRight size={14} />
            </button>
          </div>

          <div className="roster-table-container">
            {studentRoster.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b" }}>
                <Users size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>No enrolled students found in selected cohort.</p>
              </div>
            ) : (
              <table className="roster-db-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRoster.slice(0, 8).map((st, idx) => (
                    <tr key={st.USER_ID || idx}>
                      <td>
                        <div className="student-user-cell">
                          <div className="avatar-circle">
                            {(st.USERNAME || "S").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="student-name-group">
                            <span className="student-name-txt">{st.USERNAME}</span>
                            <span className="student-email-txt">{st.EMAIL_ID || "student@lms.com"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="batch-code-pill">{st.BATCH_CODE}</span>
                      </td>
                      <td>
                        <span style={{ color: "#00e5ff", fontWeight: 600, fontSize: "0.85rem" }}>
                          {st.GRADE ? `Grade ${st.GRADE}` : "Enrolled"}
                        </span>
                      </td>
                      <td>
                        <div className="status-indicator">
                          <span className="status-dot-sm active" />
                          <span>Active</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel 4: Announcements & Alerts Feed */}
        <div className="db-panel">
          <div className="db-panel-header">
            <h2>
              <Bell size={18} color="var(--accent-cyan)" />
              Recent Announcements
            </h2>
            <button className="btn-panel-link" onClick={() => handleNav("batch-announcements")}>
              Post New <ArrowRight size={14} />
            </button>
          </div>

          <div className="announcement-feed">
            {displayAnnouncements.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b" }}>
                <Bell size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>No recent announcements posted.</p>
              </div>
            ) : (
              displayAnnouncements.map((ann, idx) => (
                <div className="feed-item" key={ann.ID || idx}>
                  <div className="feed-header">
                    <span className="feed-title">{ann.TITLE}</span>
                    <span className="feed-date">{ann.CREATED_AT || "Recent"}</span>
                  </div>
                  <div className="feed-content">{ann.MESSAGE}</div>
                  <div className="feed-batch-tag">
                    <Layers size={12} />
                    <span>Target: {ann.BATCH_CODE || "ALL"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchDashboard;
