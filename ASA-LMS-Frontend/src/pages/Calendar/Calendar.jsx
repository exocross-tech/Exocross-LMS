import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Users,
  Eye,
  X,
  Copy,
  ExternalLink,
  BookOpen,
  CalendarCheck,
  Shield,
  Crown,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "react-toastify";
import { classScheduleApi } from "../../services/apiService";
import "./Calendar.css";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  const fetchTutorSchedules = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      const userId = user?.USER_ID || user?.userId || user?.id;

      if (!userId) {
        toast.error("User ID not found in session.");
        setSchedules([]);
        return;
      }

      const res = await classScheduleApi.getCalendarSchedule(userId);
      if (res?.data?.status === 1 && Array.isArray(res.data.data)) {
        setSchedules(res.data.data);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error("Failed to load tutor calendar schedules:", err);
      toast.error("Failed to load scheduled classes");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchTutorSchedules();
    }
  }, []);

  // Helper to extract clean YYYY-MM-DD from any date format without timezone shift
  const extractDateOnly = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string") {
      // Pure date string YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
        return dateVal.trim();
      }
      // ISO timestamp with time component (e.g. 2026-10-05T18:30:00.000Z)
      if (dateVal.includes("T")) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        }
        return dateVal.split("T")[0];
      }
      const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, "0");
      const day = String(dateVal.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return "";
  };

  // Map schedules by date string: { "YYYY-MM-DD": [class1, class2] }
  const schedulesByDate = useMemo(() => {
    const map = {};
    schedules.forEach((cls) => {
      const dateStr =
        extractDateOnly(cls.CLASS_DATE_STR) ||
        extractDateOnly(cls.CLASS_DATE);
      if (!dateStr) return;
      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push(cls);
    });
    return map;
  }, [schedules]);

  // Calendar matrix calculation (Monday-first)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonthIndex + 1, 0);

    // 0 = Sun, 1 = Mon, ..., 6 = Sat -> convert to Monday=0, ..., Sunday=6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonthIndex, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonthIndex - 1, dayNum);
      const y = prevDate.getFullYear();
      const m = String(prevDate.getMonth() + 1).padStart(2, "0");
      const d = String(dayNum).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        events: schedulesByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const y = currentYear;
      const m = String(currentMonthIndex + 1).padStart(2, "0");
      const d = String(i).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: true,
        events: schedulesByDate[dateStr] || [],
      });
    }

    // Next month padding days to complete 35 or 42 grid slots
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remainingSlots = totalSlots - days.length;

    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(currentYear, currentMonthIndex + 1, i);
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, "0");
      const d = String(i).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
        events: schedulesByDate[dateStr] || [],
      });
    }

    return days;
  }, [currentYear, currentMonthIndex, schedulesByDate]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDateStr(`${y}-${m}-${d}`);
  };

  const handleDateClick = (day) => {
    setSelectedDateStr(day.dateStr);
    if (!day.isCurrentMonth) {
      const [y, m] = day.dateStr.split("-");
      setCurrentDate(new Date(Number(y), Number(m) - 1, 1));
    }
  };

  const handleOpenClassDetails = (cls, e) => {
    if (e) e.stopPropagation();
    setSelectedClass(cls);
    setIsDetailsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedClass(null);
    setIsDetailsModalOpen(false);
  };

  const handleCopyMeetLink = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard!");
  };

  const handleJoinClass = (link) => {
    if (!link) {
      toast.error("Meeting link is not available.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // Today string for highlighting
  const todayStr = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Selected date scheduled classes
  const selectedDateClasses = useMemo(() => {
    return schedulesByDate[selectedDateStr] || [];
  }, [schedulesByDate, selectedDateStr]);

  // Formatted selected date display string
  const formattedSelectedDateDisplay = useMemo(() => {
    if (!selectedDateStr) return "";
    const [y, m, d] = selectedDateStr.split("-");
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dateObj.getTime())) return selectedDateStr;

    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [selectedDateStr]);

  // Total classes scheduled this month
  const totalClassesThisMonth = useMemo(() => {
    return calendarDays
      .filter((d) => d.isCurrentMonth)
      .reduce((sum, d) => sum + (d.events?.length || 0), 0);
  }, [calendarDays]);

  return (
    <div className="tutor-calendar-page">
      {/* 1. Header Section */}
      <div className="tutor-calendar-header">
        <div className="tutor-calendar-breadcrumb">
          <CalendarIcon size={14} />
          TIMETABLE / SCHEDULE
        </div>
        <div className="tutor-calendar-title-row">
          <div>
            <h1 className="tutor-calendar-title">Calendar</h1>
            <p className="tutor-calendar-subtitle">
              View your scheduled classes, explore by date, and inspect session details.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Month Calendar Card */}
      <div className="tutor-calendar-card">
        {/* Navigation Bar */}
        <div className="calendar-nav-bar">
          <div className="calendar-month-selector">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="calendar-month-title">
              {MONTH_NAMES[currentMonthIndex]} {currentYear}
            </span>
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-nav-actions">
            <span className="month-classes-count-badge">
              {totalClassesThisMonth}{" "}
              {totalClassesThisMonth === 1 ? "Class Scheduled" : "Classes Scheduled"}
            </span>
            <button
              type="button"
              className="btn-today"
              onClick={handleToday}
            >
              <CalendarCheck size={16} />
              Today
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="calendar-loading-container">
            <div className="calendar-spinner" />
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>
              Loading schedule calendar...
            </p>
          </div>
        ) : (
          <div className="calendar-grid-wrapper">
            <div className="calendar-grid">
              {/* Weekday Labels */}
              {WEEKDAY_NAMES.map((w) => (
                <div key={w} className="calendar-weekday-cell">
                  {w}
                </div>
              ))}

              {/* Day Cells */}
              {calendarDays.map((day, idx) => {
                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDateStr;
                const hasEvents = day.events && day.events.length > 0;

                return (
                  <div
                    key={`${day.dateStr}-${idx}`}
                    className={`calendar-day-cell ${
                      !day.isCurrentMonth ? "other-month" : ""
                    } ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="day-header">
                      <span className="day-number">{day.dayNumber}</span>
                      {hasEvents && (
                        <div
                          className="day-class-count-indicator"
                          title={`${day.events.length} class(es)`}
                        />
                      )}
                    </div>

                    <div className="day-events-container">
                      {hasEvents &&
                        day.events.slice(0, 2).map((cls) => {
                          const isHost = cls.TUTOR_ROLE === "HOST";
                          return (
                            <div
                              key={cls.ID}
                              className={`calendar-event-pill ${
                                !isHost ? "support-role" : ""
                              }`}
                              onClick={(e) => handleOpenClassDetails(cls, e)}
                              title={`${cls.START_TIME} - ${cls.TOPIC} (${cls.BATCH_CODE})`}
                            >
                              <span className="event-time-micro">
                                {cls.START_TIME}
                              </span>
                              <span className="event-topic-micro">
                                {cls.TOPIC}
                              </span>
                            </div>
                          );
                        })}
                      {hasEvents && day.events.length > 2 && (
                        <div className="more-events-pill">
                          +{day.events.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Selected Date Scheduled Classes Section */}
      <div className="selected-date-section">
        <div className="selected-date-header">
          <div className="selected-date-title-wrap">
            <CalendarCheck size={20} color="#00f0ff" />
            <h3>Scheduled Classes for {formattedSelectedDateDisplay}</h3>
          </div>
          <span className="date-classes-badge">
            {selectedDateClasses.length}{" "}
            {selectedDateClasses.length === 1 ? "Class" : "Classes"}
          </span>
        </div>

        {selectedDateClasses.length === 0 ? (
          <div className="empty-schedule-card">
            <CalendarIcon size={36} className="empty-schedule-icon" />
            <h4>No classes scheduled for this date</h4>
            <p>Select another date from the calendar to view scheduled sessions.</p>
          </div>
        ) : (
          <div className="scheduled-classes-list">
            {selectedDateClasses.map((cls) => {
              const isHost = cls.TUTOR_ROLE === "HOST";
              return (
                <div
                  key={cls.ID}
                  className={`calendar-class-card ${
                    !isHost ? "role-support" : ""
                  }`}
                >
                  <div className="card-top-row">
                    <span className="time-slot-pill">
                      <Clock size={13} />
                      {cls.START_TIME} – {cls.END_TIME}
                    </span>
                    {cls.TUTOR_ROLE && cls.TUTOR_ROLE !== "STUDENT" && (
                      <span
                        className={`tutor-role-pill-sm ${
                          isHost ? "host" : "support"
                        }`}
                      >
                        {isHost ? <Crown size={11} /> : <Shield size={11} />}
                        Role: {cls.TUTOR_ROLE}
                      </span>
                    )}
                  </div>

                  <div className="class-title-and-batch">
                    <h4 className="class-topic-heading">{cls.TOPIC}</h4>
                    <div className="class-batch-badge-row">
                      <span className="batch-code-pill">{cls.BATCH_CODE}</span>
                    </div>
                  </div>

                  <div className="class-meta-info-row">
                    <div className="meta-item">
                      <Users size={14} />
                      <span>{cls.STUDENT_COUNT || 0} Students</span>
                    </div>
                    {cls.TUTOR_NAME && (
                      <div className="meta-item">
                        <span>Tutor: {cls.TUTOR_NAME}</span>
                      </div>
                    )}
                  </div>

                  <div className="card-actions-row">
                    <button
                      type="button"
                      className="btn-details"
                      onClick={() => handleOpenClassDetails(cls)}
                    >
                      <Eye size={15} />
                      View Details
                    </button>
                    {cls.MEET_LINK && (
                      <button
                        type="button"
                        className="btn-join-meet"
                        onClick={() => handleJoinClass(cls.MEET_LINK)}
                      >
                        <Video size={15} />
                        Join Class
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Class / Module Details Modal */}
      {isDetailsModalOpen && selectedClass && (
        <div className="modal-backdrop-calendar" onClick={handleCloseModal}>
          <div
            className="calendar-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header-calendar">
              <div className="modal-title-wrap">
                <div className="modal-tags-row">
                  <span className="modal-batch-code">
                    {selectedClass.BATCH_CODE}
                  </span>
                  {selectedClass.TUTOR_ROLE && selectedClass.TUTOR_ROLE !== "STUDENT" && (
                    <span
                      className={`tutor-role-pill-sm ${
                        selectedClass.TUTOR_ROLE === "HOST" ? "host" : "support"
                      }`}
                    >
                      {selectedClass.TUTOR_ROLE === "HOST" ? (
                        <Crown size={11} />
                      ) : (
                        <Shield size={11} />
                      )}
                      Role: {selectedClass.TUTOR_ROLE}
                    </span>
                  )}
                </div>
                <h2 className="modal-main-title">{selectedClass.TOPIC}</h2>
              </div>

              <button
                type="button"
                className="modal-close-btn-cal"
                onClick={handleCloseModal}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-calendar">
              {/* Information Grid */}
              <div className="details-info-grid">
                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <CalendarCheck size={13} />
                    Class Date
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.CLASS_DATE_FORMATTED || selectedClass.CLASS_DATE_STR} ({selectedClass.DAY_NAME})
                  </span>
                </div>

                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <Clock size={13} />
                    Timing & Duration
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.START_TIME} – {selectedClass.END_TIME} (1 Hour)
                  </span>
                </div>

                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <Layers size={13} />
                    Batch Code
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.BATCH_CODE}
                  </span>
                </div>

                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <Users size={13} />
                    Enrolled Students
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.STUDENT_COUNT || 0} Students Allocated
                  </span>
                </div>

                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <BookOpen size={13} />
                    Batch Timeline
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.BATCH_START_DATE || "—"} to {selectedClass.BATCH_END_DATE || "—"}
                  </span>
                </div>

                <div className="detail-tile">
                  <span className="detail-tile-label">
                    <Shield size={13} />
                    Assigned Tutor
                  </span>
                  <span className="detail-tile-val">
                    {selectedClass.TUTOR_NAME || "Current Tutor"}
                  </span>
                </div>
              </div>

              {/* Google Meet Info Card */}
              {selectedClass.MEET_LINK && (
                <div className="meet-info-card">
                  <div className="meet-info-header">
                    <div className="meet-header-left">
                      <Video size={16} />
                      <span>Google Meet Classroom</span>
                    </div>
                    {selectedClass.MEET_CODE && (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        Code: {selectedClass.MEET_CODE}
                      </span>
                    )}
                  </div>

                  <div className="meet-link-box">
                    <button
                      type="button"
                      className="btn-meet-icon-launch"
                      onClick={() => handleJoinClass(selectedClass.MEET_LINK)}
                      title="Join Google Meet Session"
                    >
                      <Video size={18} />
                      <span>Join Google Meet Session</span>
                    </button>
                    <button
                      type="button"
                      className="btn-copy-link"
                      onClick={() => handleCopyMeetLink(selectedClass.MEET_LINK)}
                      title="Copy meeting link"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-calendar">
              <button
                type="button"
                className="btn-modal-close"
                onClick={handleCloseModal}
              >
                Close
              </button>
              {selectedClass.MEET_LINK && (
                <button
                  type="button"
                  className="btn-join-meet"
                  onClick={() => handleJoinClass(selectedClass.MEET_LINK)}
                >
                  <ExternalLink size={15} />
                  Join Live Session
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
