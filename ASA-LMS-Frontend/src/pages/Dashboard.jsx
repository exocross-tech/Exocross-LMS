import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { dashboardApi } from "../services/apiService";
import {
  Users,
  Layers,
  GraduationCap,
  TrendingUp,
  ArrowRight,
  Clock,
  UserPlus,
  Video,
  Radio,
  UserCheck,
  Filter,
  ChevronDown,
  RefreshCw,
  Bell,
  CheckCircle,
  ExternalLink,
  Calendar,
  Layers as BatchIcon,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";

const Dashboard = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const isFetched = useRef(false);

  // Navigation handler supporting prop or react-router
  const handleNav = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
    } else {
      navigate(`/${page}`);
    }
  };

  // Fetch real Dashboard data from backend API
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getDashboardData();
      if (res?.data?.status === 1 && res?.data?.data) {
        setDashboardData(res.data.data);
      } else if (res?.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error("Dashboard API call error:", err);
      toast.error("Failed to load real dashboard statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Batches list from real API data
  const batches = useMemo(() => {
    return Array.isArray(dashboardData?.batches) ? dashboardData.batches : [];
  }, [dashboardData]);

  // Filtered Batches based on Selected Batch dropdown
  const filteredBatches = useMemo(() => {
    if (selectedBatchId === "ALL") return batches;
    return batches.filter(
      (b) => String(b.ID) === String(selectedBatchId) || b.BATCH_CODE === selectedBatchId
    );
  }, [batches, selectedBatchId]);

  // Filtered Upcoming Classes based on Selected Batch dropdown
  const upcomingClasses = useMemo(() => {
    const list = Array.isArray(dashboardData?.upcomingClasses)
      ? dashboardData.upcomingClasses
      : [];
    if (selectedBatchId === "ALL") return list;
    return list.filter(
      (c) => String(c.BATCH_ID) === String(selectedBatchId) || c.BATCH_CODE === selectedBatchId
    );
  }, [dashboardData, selectedBatchId]);

  // Hero Featured Upcoming Class (Next class in schedule)
  const featuredClass = useMemo(() => {
    return upcomingClasses.length > 0 ? upcomingClasses[0] : null;
  }, [upcomingClasses]);

  // Enrollment Queue / Unassigned Students
  const enrollmentQueue = useMemo(() => {
    return Array.isArray(dashboardData?.enrollmentQueue)
      ? dashboardData.enrollmentQueue
      : [];
  }, [dashboardData]);

  // Tutor Roster
  const tutorRoster = useMemo(() => {
    return Array.isArray(dashboardData?.tutorRoster)
      ? dashboardData.tutorRoster
      : [];
  }, [dashboardData]);

  // Announcements
  const announcements = useMemo(() => {
    return Array.isArray(dashboardData?.announcements)
      ? dashboardData.announcements
      : [];
  }, [dashboardData]);

  // Dynamic Metrics computed across all batches or selected batch
  const totalStudentsCount = useMemo(() => {
    if (selectedBatchId === "ALL") {
      return dashboardData?.totalStudents ?? 0;
    }
    return filteredBatches.reduce((acc, b) => acc + (b.TOTAL_STUDENTS || 0), 0);
  }, [dashboardData, filteredBatches, selectedBatchId]);

  const activeBatchesCount = useMemo(() => {
    if (selectedBatchId === "ALL") {
      return dashboardData?.activeBatches ?? batches.length;
    }
    return filteredBatches.filter((b) => b.IS_ACTIVE).length;
  }, [dashboardData, batches, filteredBatches, selectedBatchId]);

  const totalTutorsCount = useMemo(() => {
    return dashboardData?.totalTutors ?? 0;
  }, [dashboardData]);

  const avgAttendancePct = useMemo(() => {
    if (selectedBatchId === "ALL") {
      return dashboardData?.avgAttendancePct ?? 0;
    }
    let totalP = 0;
    let totalA = 0;
    filteredBatches.forEach((b) => {
      totalP += Number(b.PRESENT_COUNT || 0);
      totalA += Number(b.ABSENT_COUNT || 0);
    });
    const totalRec = totalP + totalA;
    return totalRec > 0 ? Math.round((totalP / totalRec) * 100) : 0;
  }, [dashboardData, filteredBatches, selectedBatchId]);

  const completionRate = useMemo(() => {
    if (selectedBatchId === "ALL") {
      return dashboardData?.completionRate || "0%";
    }
    if (filteredBatches.length > 0) {
      const avg = Math.round(
        filteredBatches.reduce((acc, b) => acc + (b.COMPLETION_PCT || 0), 0) /
          filteredBatches.length
      );
      return `${avg}%`;
    }
    return "0%";
  }, [dashboardData, filteredBatches, selectedBatchId]);

  // Format Class Date nicely
  const formatClassDate = (dateStr) => {
    if (!dateStr) return "Upcoming";
    try {
      if (typeof dateStr === "string") {
        const clean = dateStr.split("T")[0];
        const parts = clean.split("-");
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime())
        ? String(dateStr).split("T")[0]
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return String(dateStr).split("T")[0];
    }
  };

  // Format Time string
  const formatClassTime = (timeStr) => {
    if (!timeStr) return "TBD";
    const parts = String(timeStr).split(":");
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const mins = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${mins} ${ampm}`;
    }
    return timeStr;
  };

  // Open Google Meet link in new tab without showing raw link
  const handleOpenMeet = (meetLink, e) => {
    if (e) e.stopPropagation();
    if (meetLink) {
      window.open(meetLink, "_blank", "noopener,noreferrer");
    } else {
      toast.info("No Meet Link has been attached to this session yet.");
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading-skeleton">
          <RefreshCw size={32} className="spin" />
          <p>Loading real-time Master Admin Dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* ====================================================
          1. HEADER & GLOBAL CONTROLS
      ==================================================== */}
      <div className="dashboard-header-section">
        <div className="breadcrumb">OVERVIEW &bull; MISSION CONTROL</div>
        <div className="dashboard-title-row">
          <div className="dashboard-title-left">
            <h1 className="welcome-text">Master Dashboard</h1>
            <p className="welcome-subtext">
              Full administrative view of students, tutors, batches, live operations, and LMS health.
            </p>
          </div>

          <div className="dashboard-header-actions">
            {/* Batch Selector Dropdown */}
            <div className="batch-select-wrapper">
              <Filter size={15} className="batch-select-icon" />
              <select
                className="batch-select-dropdown"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                aria-label="Filter Dashboard by Batch"
              >
                <option value="ALL">All Batches ({batches.length})</option>
                {batches.map((b) => (
                  <option key={b.ID} value={b.ID}>
                    {b.BATCH_CODE}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="batch-select-arrow" />
            </div>

            {/* Quick Action Buttons */}
            <button
              type="button"
              className="btn-header-action primary"
              onClick={() => handleNav("class-scheduling")}
            >
              <Radio size={15} />
              <span>Schedule Class</span>
            </button>

            <button
              type="button"
              className="btn-header-action secondary"
              onClick={() => handleNav("batch-creation")}
            >
              <BatchIcon size={15} />
              <span>Add Batch</span>
            </button>

            <button
              type="button"
              className="btn-header-refresh"
              onClick={fetchDashboardData}
              title="Refresh Dashboard"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================
          2. HERO LIVE / NEXT UPCOMING CLASS BANNER
      ==================================================== */}
      {featuredClass ? (
        <div className="admin-live-banner">
          <div className="live-banner-left">
            <div className="live-status-pill upcoming">
              <div className="pulse-dot" />
              <span>UPCOMING CLASS &bull; NEXT SCHEDULED</span>
            </div>
            <h2 className="live-banner-title">{featuredClass.TOPIC || "Live Operations Session"}</h2>
            <div className="live-banner-meta">
              <div className="meta-item">
                <Layers size={14} color="var(--accent-cyan)" />
                <span className="batch-code-pill">{featuredClass.BATCH_CODE}</span>
              </div>
              <div className="meta-item">
                <Clock size={14} color="var(--accent-cyan)" />
                <span>
                  {formatClassDate(featuredClass.CLASS_DATE)} &bull; {formatClassTime(featuredClass.CLASS_TIME)}
                </span>
              </div>
              <div className="meta-item">
                <GraduationCap size={14} color="var(--accent-cyan)" />
                <span>Tutor: {featuredClass.TUTOR_NAME || "Assigned Tutor"}</span>
              </div>
            </div>
          </div>

          <div className="live-banner-right">
            {featuredClass.MEET_LINK && (
              <button
                type="button"
                className="btn-meet-direct"
                onClick={(e) => handleOpenMeet(featuredClass.MEET_LINK, e)}
                title="Launch Google Meet session"
              >
                <Video size={16} />
                <span>Join Meet</span>
              </button>
            )}
            <button
              type="button"
              className="btn-launch-live"
              onClick={() => handleNav("live-class")}
            >
              <ExternalLink size={16} />
              <span>Live Class Room</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-live-banner" style={{ justifyContent: "center", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)" }}>
            <Calendar size={18} color="var(--accent-cyan)" />
            <span>No upcoming classes scheduled at this moment.</span>
            <button
              type="button"
              className="btn-link"
              onClick={() => handleNav("class-scheduling")}
              style={{ marginLeft: 8 }}
            >
              Schedule New Class <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ====================================================
          3. METRICS CARDS GRID (4 Real KPI Cards)
      ==================================================== */}
      <div className="metrics-grid">
        {/* TOTAL STUDENTS */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-header-left">
              <Users size={15} color="var(--accent-cyan)" />
              <span>TOTAL STUDENTS</span>
            </div>
            <div className="metric-icon-badge cyan">
              <Users size={16} />
            </div>
          </div>
          <div className="metric-value">{totalStudentsCount}</div>
          <div className="metric-subtext">
            {dashboardData?.activeStudents ?? totalStudentsCount} Active &bull;{" "}
            {dashboardData?.unassignedStudentsCount ?? 0} Unassigned
          </div>
        </div>

        {/* ACTIVE BATCHES */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-header-left">
              <Layers size={15} color="#c084fc" />
              <span>ACTIVE BATCHES</span>
            </div>
            <div className="metric-icon-badge purple">
              <Layers size={16} />
            </div>
          </div>
          <div className="metric-value">{activeBatchesCount}</div>
          <div className="metric-subtext">
            {dashboardData?.totalBatches ?? batches.length} Total Registered Batches
          </div>
        </div>

        {/* TUTORS ON BOARD */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-header-left">
              <GraduationCap size={15} color="#34d399" />
              <span>TUTORS ON BOARD</span>
            </div>
            <div className="metric-icon-badge green">
              <GraduationCap size={16} />
            </div>
          </div>
          <div className="metric-value">{totalTutorsCount}</div>
          <div className="metric-subtext">
            {dashboardData?.activeTutors ?? totalTutorsCount} Active &bull;{" "}
            {dashboardData?.inactiveTutors ?? 0} Inactive
          </div>
        </div>

        {/* AVG ATTENDANCE / COMPLETION */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-header-left">
              <TrendingUp size={15} color="#fbbf24" />
              <span>AVG ATTENDANCE</span>
            </div>
            <div className="metric-icon-badge amber">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="metric-value">{avgAttendancePct}%</div>
          <div className="metric-progress-wrapper">
            <div className="metric-progress-fill" style={{ width: `${avgAttendancePct}%` }} />
          </div>
          <div className="metric-subtext" style={{ marginTop: "6px" }}>
            Overall Course Completion: {completionRate}
          </div>
        </div>
      </div>

      {/* ====================================================
          4. MIDDLE SECTION: BATCH COMPLETION & SCHEDULE
      ==================================================== */}
      <div className="dashboard-middle-row">
        {/* Panel 1: Batch Completion & Health */}
        <div className="dashboard-panel batch-completion-panel">
          <div className="panel-header">
            <h2>
              <Layers size={18} color="var(--accent-cyan)" />
              Batch Completion & Health
            </h2>
            <button
              type="button"
              className="btn-link"
              onClick={() => handleNav("batches")}
            >
              All Batches <ArrowRight size={14} />
            </button>
          </div>

          <div className="batch-progress-list">
            {filteredBatches.length === 0 ? (
              <div className="panel-empty-state">
                <Layers size={28} color="#475569" />
                <p>No active batches found.</p>
              </div>
            ) : (
              filteredBatches.slice(0, 5).map((b) => {
                const completion = b.COMPLETION_PCT ?? 0;
                return (
                  <div className="batch-progress-item" key={b.ID}>
                    <div className="batch-labels">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="batch-code-pill">{b.BATCH_CODE}</span>
                        <span className="batch-meta-txt">
                          {b.TOTAL_STUDENTS || 0} Students &bull; Lead: {b.HOST_TUTOR || "Unassigned"}
                        </span>
                      </div>
                      <span className="batch-percentage">{completion}%</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2: Upcoming Scheduled Operations */}
        <div className="dashboard-panel schedule-panel">
          <div className="panel-header">
            <h2>
              <Calendar size={18} color="var(--accent-cyan)" />
              Scheduled Class Operations
            </h2>
            <button
              type="button"
              className="btn-link"
              onClick={() => handleNav("class-scheduling")}
            >
              Manage Schedule <ArrowRight size={14} />
            </button>
          </div>

          <div className="schedule-timeline-list">
            {upcomingClasses.length === 0 ? (
              <div className="panel-empty-state">
                <Calendar size={28} color="#475569" />
                <p>No scheduled classes found.</p>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => handleNav("class-scheduling")}
                >
                  Create class schedule
                </button>
              </div>
            ) : (
              upcomingClasses.slice(0, 5).map((c) => (
                <div className="schedule-item-card" key={c.ID}>
                  <div className="time-box">
                    <span className="time-str">{formatClassTime(c.CLASS_TIME)}</span>
                    <span className="date-str">{formatClassDate(c.CLASS_DATE)}</span>
                  </div>

                  <div className="schedule-info">
                    <div className="schedule-topic">{c.TOPIC || "Live Operations Class"}</div>
                    <div className="schedule-sub">
                      <span className="batch-code-pill" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
                        {c.BATCH_CODE}
                      </span>
                      <span>&bull; Tutor: {c.TUTOR_NAME || "Assigned Tutor"}</span>
                    </div>
                  </div>

                  {c.MEET_LINK ? (
                    <button
                      type="button"
                      className="meet-icon-btn"
                      onClick={(e) => handleOpenMeet(c.MEET_LINK, e)}
                      title="Open Google Meet Link"
                      aria-label="Join Meet"
                    >
                      <Video size={16} />
                    </button>
                  ) : (
                    <div className="meet-icon-btn" style={{ opacity: 0.35, cursor: "not-allowed" }} title="No Meet link added">
                      <Video size={16} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ====================================================
          5. BOTTOM SECTION: ENROLLMENT QUEUE & TUTOR ROSTER
      ==================================================== */}
      <div className="dashboard-bottom-row">
        {/* Panel 3: Enrollment Queue (Unassigned Students) */}
        <div className="dashboard-panel enrollment-queue-panel">
          <div className="panel-header">
            <h2>
              <UserPlus size={18} color="var(--accent-cyan)" />
              Enrollment Queue
            </h2>
            <span className="badge-red">
              {dashboardData?.unassignedStudentsCount ?? enrollmentQueue.length} Unassigned
            </span>
          </div>

          <div className="queue-list">
            {enrollmentQueue.length === 0 ? (
              <div className="panel-empty-state">
                <CheckCircle size={28} color="#10b981" />
                <p>All students are currently segregated into active batches.</p>
              </div>
            ) : (
              enrollmentQueue.slice(0, 5).map((st) => (
                <div className="queue-item" key={st.USER_ID}>
                  <div className="student-info">
                    <h4>{st.USERNAME}</h4>
                    <span>
                      {st.EMAIL_ID} {st.MOBILE_NO ? `&bull; ${st.MOBILE_NO}` : ""}
                    </span>
                  </div>
                  <div className="badge-unassigned">Unassigned</div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="btn-panel-action primary-action"
            onClick={() => handleNav("student-allocation")}
          >
            <UserPlus size={16} /> Segregate into batches
          </button>
        </div>

        {/* Panel 4: Tutor Roster & Allocations */}
        <div className="dashboard-panel tutor-roster-panel">
          <div className="panel-header">
            <h2>
              <GraduationCap size={18} color="var(--accent-cyan)" />
              Tutor Roster
            </h2>
            <button
              type="button"
              className="btn-link"
              onClick={() => handleNav("tutor-allocation")}
            >
              Allocations <ArrowRight size={14} />
            </button>
          </div>

          <div className="tutor-list">
            {tutorRoster.length === 0 ? (
              <div className="panel-empty-state">
                <GraduationCap size={28} color="#475569" />
                <p>No tutors onboarded yet.</p>
              </div>
            ) : (
              tutorRoster.slice(0, 5).map((t) => (
                <div className="tutor-item" key={t.USER_ID}>
                  <div className="tutor-info">
                    <h4>{t.USERNAME}</h4>
                    <span>
                      {t.ASSIGNED_BATCHES_COUNT > 0
                        ? `Assigned: ${t.ASSIGNED_BATCH_CODES}`
                        : "No batches assigned"}
                    </span>
                  </div>
                  <div
                    className={`status-badge ${
                      t.IS_ACTIVE ? "active" : "inactive"
                    }`}
                  >
                    {t.IS_ACTIVE ? "ACTIVE" : "INACTIVE"}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="btn-panel-action dark-action"
            onClick={() => handleNav("tutor-allocation")}
          >
            <Shield size={16} /> Manage allocations
          </button>
        </div>
      </div>

      {/* ====================================================
          6. RECENT ANNOUNCEMENTS FEED (Full-width card)
      ==================================================== */}
      {announcements.length > 0 && (
        <div className="dashboard-panel announcements-full-row">
          <div className="panel-header">
            <h2>
              <Bell size={18} color="var(--accent-cyan)" />
              Recent Announcements
            </h2>
            <button
              type="button"
              className="btn-link"
              onClick={() => handleNav("batch-announcements")}
            >
              Post Announcement <ArrowRight size={14} />
            </button>
          </div>

          <div className="announcement-feed">
            {announcements.map((ann) => (
              <div className="feed-item" key={ann.ID}>
                <div className="feed-header">
                  <span className="feed-title">{ann.TITLE}</span>
                  <span className="feed-date">{formatClassDate(ann.CREATED_AT)}</span>
                </div>
                <div className="feed-content">{ann.MESSAGE}</div>
                <div className="feed-batch-tag">
                  <Layers size={12} />
                  <span>Target: {ann.BATCH_CODE}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
