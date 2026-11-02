import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import "./Batches.css";
import {
  batchesApi,
  attendanceApi,
  studentAssignmentApi,
} from "../../services/apiService";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  X,
  Search,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Crown,
  Shield,
  Eye,
  Video,
  ExternalLink,
  FileText,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  ChevronDown,
  Check,
  Award,
  BarChart2,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  User,
} from "lucide-react";

const Batches = () => {
  const [tableList, setTableList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentUser, setCurrentUser] = useState(null);

  // Batch Details Modal State
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState("students"); // "students" | "tutors" | "classes"

  // 2-Step Attendance Selection State for Tutor: Select Date -> Select Scheduled Class
  const [selectedDate, setSelectedDate] = useState(null); // { dateKey, dateLabel, dateObj }
  const [selectedClass, setSelectedClass] = useState(null); // { ID, TOPIC, timeRange, ... }
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const classDropdownRef = useRef(null);

  // Student Detail Modal State (For Admin & details view)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentModalLoading, setStudentModalLoading] = useState(false);
  const [studentDetailsData, setStudentDetailsData] = useState(null);
  const [studentPerformanceData, setStudentPerformanceData] = useState(null);
  const [studentAttendanceData, setStudentAttendanceData] = useState(null);

  const isFetched = useRef(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        classDropdownRef.current &&
        !classDropdownRef.current.contains(event.target)
      ) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
      console.error("Error reading user data in Batches:", e);
    }
  }, []);

  const userType = String(
    currentUser?.USER_TYPE || currentUser?.ROLE || ""
  ).toUpperCase();
  const isAdmin = userType === "ADMIN";
  const isStudent = userType === "STUDENT";
  const isTutor = !isAdmin && !isStudent && (userType === "TUTOR" || !!currentUser);
  const currentUserId = currentUser?.USER_ID || currentUser?.id;

  const getTableList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (isTutor && currentUserId) {
        // Fetch ALL batches assigned to this tutor (both HOST and SUPPORT)
        params.tutorId = currentUserId;
      }

      const res = await batchesApi.getBatches(params);
      if (res?.data?.status === 1) {
        setTableList(res?.data?.data || []);
      } else {
        setTableList([]);
        toast.error(res?.data?.message || "Failed to fetch batches list");
      }
    } catch (err) {
      console.error("Fetch batches error:", err);
      toast.error("An error occurred while fetching batches list");
      setTableList([]);
    } finally {
      setLoading(false);
    }
  }, [isTutor, currentUserId]);

  useEffect(() => {
    if (currentUser !== null && !isFetched.current) {
      isFetched.current = true;
      getTableList();
    }
  }, [currentUser, getTableList]);

  const parseBatchDate = (dateVal) => {
    if (!dateVal || dateVal === "—" || dateVal === "-") return null;
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const d = new Date(dateVal);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const str = String(dateVal).trim();
    const clean = str.split("T")[0].trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split("-");
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split("-");
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    if (/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/.test(str)) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
    return null;
  };

  const formatLocalDateToYMD = (date) => {
    if (!date || isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatSessionTimeRange = (classTime, startTime, endTime) => {
    const timeVal = startTime || classTime;
    if (!timeVal) return "";
    const parts = String(timeVal).split(":");
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parts[1].padStart(2, "0") : "00";
    if (isNaN(hours)) return String(timeVal);

    const startPeriod = hours >= 12 ? "PM" : "AM";
    const startHour12 = hours % 12 === 0 ? 12 : hours % 12;
    const startFormatted = `${String(startHour12).padStart(2, "0")}:${minutes} ${startPeriod}`;

    let endFormatted = "";
    if (endTime) {
      const endParts = String(endTime).split(":");
      let endH = parseInt(endParts[0], 10);
      const endM = endParts[1] ? endParts[1].padStart(2, "0") : "00";
      if (!isNaN(endH)) {
        const endPeriod = endH >= 12 ? "PM" : "AM";
        const endHour12 = endH % 12 === 0 ? 12 : endH % 12;
        endFormatted = `${String(endHour12).padStart(2, "0")}:${endM} ${endPeriod}`;
      }
    }
    if (!endFormatted) {
      const endH = (hours + 1) % 24;
      const endPeriod = endH >= 12 ? "PM" : "AM";
      const endHour12 = endH % 12 === 0 ? 12 : endH % 12;
      endFormatted = `${String(endHour12).padStart(2, "0")}:${minutes} ${endPeriod}`;
    }

    return `${startFormatted} – ${endFormatted}`;
  };

  const formatSessionDateDisplay = (dateVal) => {
    const d = parseBatchDate(dateVal);
    if (!d) return String(dateVal || "");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Batch Start & End boundaries for Calendar DatePicker
  const batchMinDate = React.useMemo(() => {
    return parseBatchDate(
      batchDetails?.START_DATE ||
        selectedBatch?.START_DATE ||
        batchDetails?.START_DATE_FORMATTED ||
        selectedBatch?.START_DATE_FORMATTED ||
        batchDetails?.RAW_START_DATE
    );
  }, [batchDetails, selectedBatch]);

  const batchMaxDate = React.useMemo(() => {
    return parseBatchDate(
      batchDetails?.END_DATE ||
        selectedBatch?.END_DATE ||
        batchDetails?.END_DATE_FORMATTED ||
        selectedBatch?.END_DATE_FORMATTED ||
        batchDetails?.RAW_END_DATE
    );
  }, [batchDetails, selectedBatch]);

  // Extract scheduled classes for the selected date
  const classesForSelectedDate = React.useMemo(() => {
    if (!selectedDate || !Array.isArray(batchDetails?.classes)) return [];
    return batchDetails.classes
      .filter((cls) => {
        const rawDate = cls.ISO_CLASS_DATE || cls.CLASS_DATE;
        const dateObj = parseBatchDate(rawDate);
        const dateKey = dateObj
          ? formatLocalDateToYMD(dateObj)
          : String(rawDate);
        return dateKey === selectedDate.dateKey;
      })
      .map((cls) => ({
        ...cls,
        timeRange: formatSessionTimeRange(
          cls.CLASS_TIME,
          cls.START_TIME,
          cls.END_TIME
        ),
        topic: cls.TOPIC || "Untitled Class",
      }));
  }, [selectedDate, batchDetails?.classes]);

  // Step 1: Handle Calendar Date Selection
  const handleCalendarDateChange = (date) => {
    if (!date || isNaN(date.getTime())) {
      setSelectedDate(null);
      setSelectedClass(null);
      setIsClassDropdownOpen(false);
      setAttendanceMap({});
      return;
    }

    const dateKey = formatLocalDateToYMD(date);
    const dateLabel = formatSessionDateDisplay(date);

    setSelectedDate({
      dateKey,
      dateLabel,
      dateObj: date,
    });

    // Immediately clear previously selected class and attendance records
    setSelectedClass(null);
    setIsClassDropdownOpen(false);
    setAttendanceMap({});
  };

  // Step 2: Handle Scheduled Class Selection
  const handleSelectClass = async (cls) => {
    setSelectedClass(cls);
    setIsClassDropdownOpen(false);

    if (!selectedBatch?.ID || !cls?.ID) return;

    setAttendanceLoading(true);
    try {
      const res = await attendanceApi.getBatchDateAttendance(selectedBatch.ID, {
        classId: cls.ID,
      });

      if (res?.data?.status === 1) {
        const attArray = res?.data?.data || [];
        const map = {};
        attArray.forEach((item) => {
          const sId = item.STUDENT_ID || item.USER_ID;
          if (sId) {
            map[sId] = {
              status: item.ATTENDANCE_STATUS,
              remarks: item.REMARKS,
              ...item,
            };
          }
        });
        setAttendanceMap(map);
      } else {
        setAttendanceMap({});
      }
    } catch (err) {
      console.error("Fetch class attendance error:", err);
      setAttendanceMap({});
    } finally {
      setAttendanceLoading(false);
    }
  };

  // View batch details modal
  const handleViewBatch = async (batch, initialTab = "students") => {
    setSelectedBatch(batch);
    setModalActiveTab(initialTab);
    setIsDetailsModalOpen(true);
    setDetailsLoading(true);

    // Reset date/class selection for Tutor
    setSelectedDate(null);
    setSelectedClass(null);
    setIsClassDropdownOpen(false);
    setAttendanceMap({});

    try {
      const params = {};
      if (isTutor && currentUserId) {
        params.tutorId = currentUserId;
      }
      const res = await batchesApi.getBatchDetails(batch.ID, params);
      if (res?.data?.status === 1) {
        setBatchDetails(res.data.data);
      } else {
        toast.error(res?.data?.message || "Failed to load batch details");
        setBatchDetails(null);
      }
    } catch (err) {
      console.error("Error fetching batch details:", err);
      toast.error("Failed to load batch details");
      setBatchDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedBatch(null);
    setBatchDetails(null);
    setSelectedDate(null);
    setSelectedClass(null);
    setIsClassDropdownOpen(false);
    setAttendanceMap({});
  };

  // View student details modal
  const handleViewStudent = async (student) => {
    const studentId = student.USER_ID || student.STUDENT_ID;
    if (!studentId) return;

    setSelectedStudent(student);
    setIsStudentModalOpen(true);
    setStudentModalLoading(true);
    setStudentDetailsData(student);
    setStudentPerformanceData(null);
    setStudentAttendanceData(null);

    try {
      const [attRes, assignRes, assessRes] = await Promise.allSettled([
        attendanceApi.getStudentAttendance(studentId),
        studentAssignmentApi.getStudentAssignments(studentId),
        studentAssignmentApi.getAssessmentResults(studentId),
      ]);

      // Process Attendance
      if (attRes.status === "fulfilled" && attRes.value?.data?.status === 1) {
        setStudentAttendanceData(attRes.value.data.data);
      } else {
        setStudentAttendanceData(null);
      }

      // Process Assignments
      let completedAssignments = 0;
      let totalAssignments = 0;
      if (assignRes.status === "fulfilled" && assignRes.value?.data?.status === 1) {
        const modules = assignRes.value.data.data || [];
        modules.forEach((mod) => {
          if (Array.isArray(mod.sets)) {
            mod.sets.forEach((set) => {
              totalAssignments++;
              if (
                set.isShowExamButton === 0 ||
                set.isCompleted === true ||
                set.completed === true
              ) {
                completedAssignments++;
              }
            });
          }
        });
      }

      // Process Assessment Results
      let assessmentList = [];
      let avgScore = 0;
      if (assessRes.status === "fulfilled" && assessRes.value?.data?.status === 1) {
        assessmentList = assessRes.value.data.data || [];
        if (assessmentList.length > 0) {
          const totalPct = assessmentList.reduce(
            (acc, curr) => acc + (Number(curr.MARK_PERCENTAGE) || 0),
            0
          );
          avgScore = Math.round(totalPct / assessmentList.length);
        }
      }

      setStudentPerformanceData({
        completedAssignments,
        totalAssignments,
        completionPercentage:
          totalAssignments > 0
            ? Math.round((completedAssignments / totalAssignments) * 100)
            : 0,
        assessmentList,
        averageScore: avgScore,
      });
    } catch (err) {
      console.error("Error fetching student details modal data:", err);
      toast.error("Failed to load student performance and attendance details");
    } finally {
      setStudentModalLoading(false);
    }
  };

  const handleCloseStudentModal = () => {
    setIsStudentModalOpen(false);
    setSelectedStudent(null);
    setStudentDetailsData(null);
    setStudentPerformanceData(null);
    setStudentAttendanceData(null);
  };

  const formatBatchDisplayDate = (dateVal) => {
    if (!dateVal || dateVal === "—" || dateVal === "-") return "—";
    try {
      if (
        typeof dateVal === "string" &&
        /^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/.test(dateVal.trim())
      ) {
        return dateVal.trim();
      }
      if (
        typeof dateVal === "string" &&
        /^\d{2}-\d{2}-\d{4}$/.test(dateVal.trim())
      ) {
        const parts = dateVal.trim().split("-");
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (_) {
      return String(dateVal);
    }
  };

  // Filtered batch list by search query & status
  const filteredList = tableList
    .filter((b) => {
      const code = String(b.BATCH_CODE || "").toLowerCase();
      const query = searchTerm.trim().toLowerCase();

      let studentMatch = false;
      if (b.STUDENTS_PREVIEW && Array.isArray(b.STUDENTS_PREVIEW)) {
        studentMatch = b.STUDENTS_PREVIEW.some((st) =>
          String(st.USERNAME || "").toLowerCase().includes(query)
        );
      }

      const matchesSearch =
        !query ||
        code.includes(query) ||
        studentMatch;

      if (isTutor) {
        return matchesSearch;
      }

      const isActive = b.IS_ACTIVE === 1 || b.IS_ACTIVE === true;

      if (statusFilter === "ACTIVE") return matchesSearch && isActive;
      if (statusFilter === "INACTIVE") return matchesSearch && !isActive;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (isTutor) {
        const roleA = String(a.TUTOR_ROLE || "HOST").toUpperCase();
        const roleB = String(b.TUTOR_ROLE || "HOST").toUpperCase();
        if (roleA === "HOST" && roleB !== "HOST") return -1;
        if (roleA !== "HOST" && roleB === "HOST") return 1;
      }
      return 0;
    });

  return (
    <div className="bc-container">
      {/* Header Section */}
      <div className="bc-header-section">
        <div className="bc-breadcrumb">
          {isAdmin ? "MANAGEMENT" : "COHORT"}
        </div>
        <div className="bc-title-row">
          <div className="bc-title-left">
            <h1 className="bc-title">Batches</h1>
            <p className="bc-subtitle">
              {isAdmin
                ? "View and manage all student batches across the LMS."
                : "View and manage all batches assigned to you."}
            </p>
          </div>

          <div className="batches-title-right">
            {/* Status Filter for Admin */}
            {isAdmin && (
              <div className="admin-status-filter-pills">
                {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`status-filter-pill ${
                      statusFilter === st ? "active" : ""
                    }`}
                    onClick={() => setStatusFilter(st)}
                  >
                    {st === "ALL" ? "All Batches" : st}
                  </button>
                ))}
              </div>
            )}

            {/* Search Bar */}
            <div className="batch-search-box">
              <Search size={16} className="batch-search-icon" />
              <input
                type="text"
                placeholder="Search batch code, name, students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="batch-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="batch-search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Landscape GridView */}
      <div className="tutor-batches-grid">
        {loading ? (
          <div className="tutor-loading-grid">
            {[1, 2, 3, 4].map((n) => (
              <div className="tutor-landscape-card skeleton-card" key={n}>
                <div className="skeleton-line title" />
                <div className="skeleton-line subtitle" />
                <div className="skeleton-box" />
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="batches-empty-card">
            <AlertCircle size={40} className="empty-icon" />
            <h3>No Batches Found</h3>
            <p>
              {searchTerm || statusFilter !== "ALL"
                ? "No batches match your search or filter criteria."
                : isTutor
                ? "You currently don't have any batches assigned to you."
                : "No batches are registered in the system."}
            </p>
          </div>
        ) : (
          filteredList.map((batch, index) => {
            const totalStudents = Number(
              batch.TOTAL_STUDENTS || batch.STUDENT_COUNT || 0
            );
            const classCount = Number(batch.CLASS_COUNT || 0);
            const assignmentCount = Number(batch.ASSIGNMENT_COUNT || 0);

            // Real attendance calculation from DB records
            const presentCount = Number(batch.PRESENT_COUNT || 0);
            const absentCount = Number(batch.ABSENT_COUNT || 0);
            const totalAttendanceRecords = presentCount + absentCount;

            const presentPct =
              totalAttendanceRecords > 0
                ? Math.round((presentCount / totalAttendanceRecords) * 100)
                : 0;
            const absentPct =
              totalAttendanceRecords > 0
                ? Math.round((absentCount / totalAttendanceRecords) * 100)
                : 0;

            const role = String(batch.TUTOR_ROLE || "HOST").toUpperCase();
            const isHostRole = role === "HOST";

            return (
              <div className="tutor-landscape-card" key={batch.ID || index}>
                {/* 1. Header: Batch Code and Status */}
                <div className="tl-card-header">
                  <div className="tl-title-group">
                    <h2 className="tl-batch-name">{batch.BATCH_CODE}</h2>
                  </div>

                  <div className="tl-status-group">
                    <span
                      className={`tl-live-status-pill ${
                        batch.IS_ACTIVE === 1 || batch.IS_ACTIVE === true
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      <span className="tl-status-dot" />
                      {batch.IS_ACTIVE === 1 || batch.IS_ACTIVE === true
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </div>
                </div>

                {/* 2. Sub-header: Role (if tutor) & Batch Dates */}
                <div className="tl-sub-header">
                  {isTutor && (
                    <div className="tl-role-wrapper">
                      <span
                        className={`tl-role-pill ${
                          isHostRole ? "role-host" : "role-support"
                        }`}
                      >
                        {isHostRole ? <Crown size={13} /> : <Shield size={13} />}
                        Role: {isHostRole ? "HOST" : "SUPPORT"}
                      </span>
                    </div>
                  )}

                  {(batch.START_DATE ||
                    batch.START_DATE_FORMATTED ||
                    batch.END_DATE ||
                    batch.END_DATE_FORMATTED) && (
                    <div
                      className={`tl-card-dates-row ${
                        !isTutor ? "align-left" : ""
                      }`}
                    >
                      <span className="tl-card-date-item">
                        <span className="tl-card-date-lbl">Start Date:</span>{" "}
                        <span className="tl-card-date-val">
                          {formatBatchDisplayDate(
                            batch.START_DATE_FORMATTED || batch.START_DATE
                          )}
                        </span>
                      </span>
                      <span className="tl-card-date-divider">·</span>
                      <span className="tl-card-date-item">
                        <span className="tl-card-date-lbl">End Date:</span>{" "}
                        <span className="tl-card-date-val">
                          {formatBatchDisplayDate(
                            batch.END_DATE_FORMATTED || batch.END_DATE
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. 3-Box Horizontal Metric Strip */}
                <div className="tl-metrics-row">
                  <div className="tl-metric-box">
                    <div className="tl-metric-top">
                      <Users size={18} className="tl-metric-icon cyan" />
                      <span className="tl-metric-value">{totalStudents}</span>
                    </div>
                    <span className="tl-metric-label">STUDENTS</span>
                  </div>

                  <div className="tl-metric-box">
                    <div className="tl-metric-top">
                      <Calendar size={18} className="tl-metric-icon purple" />
                      <span className="tl-metric-value">{classCount}</span>
                    </div>
                    <span className="tl-metric-label">
                      {classCount === 1 ? "CLASS SCHEDULE" : "CLASS SCHEDULES"}
                    </span>
                  </div>

                  <div className="tl-metric-box">
                    <div className="tl-metric-top">
                      <FileText size={18} className="tl-metric-icon blue" />
                      <span className="tl-metric-value">{assignmentCount}</span>
                    </div>
                    <span className="tl-metric-label">
                      {assignmentCount === 1 ? "ASSIGNMENT" : "ASSIGNMENTS"}
                    </span>
                  </div>
                </div>

                {/* 4. Attendance Section: Horizontal Progress Line */}
                <div className="tl-attendance-line-section">
                  <div className="tl-att-line-header">
                    <span className="tl-att-line-title">Attendance</span>
                    <div className="tl-att-line-values">
                      <span className="tl-att-line-stat present">
                        Present {presentCount} ({presentPct}%)
                      </span>
                      <span className="tl-att-line-stat absent">
                        Absent {absentCount} ({absentPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="tl-att-progress-track">
                    {totalAttendanceRecords > 0 ? (
                      <>
                        {presentPct > 0 && (
                          <div
                            className="tl-att-segment present"
                            style={{ width: `${presentPct}%` }}
                            title={`Present: ${presentCount} (${presentPct}%)`}
                          />
                        )}
                        {absentPct > 0 && (
                          <div
                            className="tl-att-segment absent"
                            style={{ width: `${absentPct}%` }}
                            title={`Absent: ${absentCount} (${absentPct}%)`}
                          />
                        )}
                      </>
                    ) : (
                      <div
                        className="tl-att-segment empty"
                        style={{ width: "100%" }}
                        title="No attendance records recorded yet"
                      />
                    )}
                  </div>
                </div>

                {/* 5. Card Bottom: View Details Button */}
                <div className="tl-card-footer">
                  <button
                    type="button"
                    className="tl-btn-view-batch"
                    onClick={() => handleViewBatch(batch, "students")}
                  >
                    <Eye size={15} />
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================
          BATCH OVERVIEW & DETAILS MODAL (Admin & Tutor)
      ========================================================= */}
      {isDetailsModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="batch-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="batch-modal-header">
              <div className="batch-modal-title-area">
                <div className="batch-modal-tag-row">
                  {isTutor && (
                    <span
                      className={`tl-role-pill ${
                        selectedBatch?.TUTOR_ROLE === "HOST"
                          ? "role-host"
                          : "role-support"
                      }`}
                    >
                      {selectedBatch?.TUTOR_ROLE === "HOST" ? (
                        <Crown size={12} />
                      ) : (
                        <Shield size={12} />
                      )}
                      Role: {selectedBatch?.TUTOR_ROLE || "HOST"}
                    </span>
                  )}
                  <span
                    className={`tl-live-status-pill ${
                      selectedBatch?.IS_ACTIVE === 1 ||
                      selectedBatch?.IS_ACTIVE === true
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    <span className="tl-status-dot" />
                    {selectedBatch?.IS_ACTIVE === 1 ||
                    selectedBatch?.IS_ACTIVE === true
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>
                <h2 className="batch-modal-title">
                  {selectedBatch?.BATCH_CODE}
                </h2>
              </div>

              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseModal}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Batch Overview Banner for Admin & Tutor */}
            <div className="batch-modal-overview-strip">
              <div className="bmo-item">
                <span className="bmo-label">Start Date</span>
                <span className="bmo-val">
                  {formatBatchDisplayDate(
                    batchDetails?.START_DATE_FORMATTED ||
                      selectedBatch?.START_DATE_FORMATTED ||
                      batchDetails?.START_DATE ||
                      selectedBatch?.START_DATE
                  )}
                </span>
              </div>
              <div className="bmo-divider" />
              <div className="bmo-item">
                <span className="bmo-label">End Date</span>
                <span className="bmo-val">
                  {formatBatchDisplayDate(
                    batchDetails?.END_DATE_FORMATTED ||
                      selectedBatch?.END_DATE_FORMATTED ||
                      batchDetails?.END_DATE ||
                      selectedBatch?.END_DATE
                  )}
                </span>
              </div>
              <div className="bmo-divider" />
              <div className="bmo-item">
                <span className="bmo-label">Students</span>
                <span className="bmo-val cyan">
                  {batchDetails?.students?.length ??
                    selectedBatch?.TOTAL_STUDENTS ??
                    selectedBatch?.STUDENT_COUNT ??
                    0}
                </span>
              </div>
              <div className="bmo-divider" />
              <div className="bmo-item">
                <span className="bmo-label">Classes</span>
                <span className="bmo-val purple">
                  {batchDetails?.classes?.length ??
                    selectedBatch?.CLASS_COUNT ??
                    0}
                </span>
              </div>
              <div className="bmo-divider" />
              <div className="bmo-item">
                <span className="bmo-label">Assignments</span>
                <span className="bmo-val blue">
                  {batchDetails?.assignments?.length ??
                    selectedBatch?.ASSIGNMENT_COUNT ??
                    0}
                </span>
              </div>
              {batchDetails?.attendance && (
                <>
                  <div className="bmo-divider" />
                  <div className="bmo-item">
                    <span className="bmo-label">Attendance Rate</span>
                    <span className="bmo-val green">
                      {batchDetails.attendance.presentPercentage}%
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Admin Tabs */}
            {isAdmin && (
              <div className="batch-modal-admin-tabs">
                <button
                  type="button"
                  className={`admin-modal-tab-btn ${
                    modalActiveTab === "students" ? "active" : ""
                  }`}
                  onClick={() => setModalActiveTab("students")}
                >
                  <Users size={16} />
                  <span>
                    Students (
                    {batchDetails?.students?.length ??
                      selectedBatch?.TOTAL_STUDENTS ??
                      0}
                    )
                  </span>
                </button>

                <button
                  type="button"
                  className={`admin-modal-tab-btn ${
                    modalActiveTab === "tutors" ? "active" : ""
                  }`}
                  onClick={() => setModalActiveTab("tutors")}
                >
                  <Crown size={16} />
                  <span>
                    Assigned Tutors ({batchDetails?.tutors?.length ?? 0})
                  </span>
                </button>

                <button
                  type="button"
                  className={`admin-modal-tab-btn ${
                    modalActiveTab === "classes" ? "active" : ""
                  }`}
                  onClick={() => setModalActiveTab("classes")}
                >
                  <Calendar size={16} />
                  <span>
                    Scheduled Classes ({batchDetails?.classes?.length ?? 0})
                  </span>
                </button>
              </div>
            )}

            {/* 2-Step Attendance Selection Section for Tutor */}
            {isTutor && (
              <div className="batch-modal-attendance-controls-bar">
                <div className="att-controls-row">
                  {/* Step 1: SELECT DATE IN CALENDAR FORMAT */}
                  <div className="att-control-group">
                    <label className="att-control-label">
                      <CalendarDays size={14} />
                      SELECT DATE
                    </label>
                    <div className="att-datepicker-wrapper">
                      <DatePicker
                        selected={selectedDate ? selectedDate.dateObj : null}
                        onChange={handleCalendarDateChange}
                        minDate={batchMinDate || undefined}
                        maxDate={batchMaxDate || undefined}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="Select Date (dd-mm-yyyy)"
                        className="att-calendar-input"
                        portalId="root"
                        popperPlacement="bottom-start"
                        isClearable={!!selectedDate}
                      />
                      <Calendar size={15} className="att-picker-icon" />
                    </div>
                  </div>

                  {/* Step 2: SCHEDULED CLASS */}
                  {selectedDate && (
                    <div className="att-control-group">
                      <label className="att-control-label">
                        <BookOpen size={14} />
                        SCHEDULED CLASS
                      </label>
                      {classesForSelectedDate.length === 0 ? (
                        <div
                          className="att-no-class-box"
                          title="No classes scheduled for this date"
                        >
                          <AlertCircle size={15} />
                          <span>No class assigned</span>
                        </div>
                      ) : (
                        <div
                          className="att-custom-dropdown-wrap"
                          ref={classDropdownRef}
                        >
                          <button
                            type="button"
                            className={`att-dropdown-btn ${
                              isClassDropdownOpen ? "open" : ""
                            } ${selectedClass ? "selected" : ""}`}
                            onClick={() =>
                              setIsClassDropdownOpen((prev) => !prev)
                            }
                          >
                            <Clock size={14} />
                            <span className="att-btn-text">
                              {selectedClass
                                ? `${selectedClass.topic} - ${selectedClass.timeRange}`
                                : "SELECT SCHEDULED CLASS"}
                            </span>
                            <ChevronDown
                              size={14}
                              className={`att-arrow-icon ${
                                isClassDropdownOpen ? "rotated" : ""
                              }`}
                            />
                          </button>

                          {isClassDropdownOpen && (
                            <div className="att-dropdown-menu">
                              <div className="att-options-list">
                                {classesForSelectedDate.map((cls) => {
                                  const isSelected =
                                    selectedClass?.ID === cls.ID;
                                  return (
                                    <div
                                      key={cls.ID}
                                      className={`att-option-item class-option ${
                                        isSelected ? "active" : ""
                                      }`}
                                      onClick={() => handleSelectClass(cls)}
                                    >
                                      <div className="class-option-content">
                                        <span className="option-title">
                                          {cls.topic}
                                        </span>
                                        <span className="option-subtitle">
                                          <Clock size={12} /> {cls.timeRange}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <Check
                                          size={14}
                                          className="option-check"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-header Context / Indicators */}
            {isTutor && (
              <div className="batch-modal-student-count-row">
                <span className="batch-modal-student-count-title">
                  Students (
                  {batchDetails?.students?.length ??
                    selectedBatch?.TOTAL_STUDENTS ??
                    selectedBatch?.STUDENT_COUNT ??
                    0}
                  )
                </span>

                {selectedDate && selectedClass && (
                  <div className="student-session-active-indicator">
                    <span className="active-dot" />
                    <span>
                      Attendance for:{" "}
                      <strong>
                        {selectedDate.dateLabel} → {selectedClass.topic} (
                        {selectedClass.timeRange})
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="btn-clear-session"
                      onClick={() => {
                        setSelectedClass(null);
                        setAttendanceMap({});
                      }}
                      title="Clear class selection"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="batch-modal-body">
              {detailsLoading ? (
                <div className="modal-loading-state">
                  <div className="batches-spinner" />
                  <p>Loading batch details...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: STUDENTS LIST */}
                  {modalActiveTab === "students" && (
                    <div className="tab-pane">
                      {!batchDetails?.students ||
                      batchDetails.students.length === 0 ? (
                        <div className="tab-empty-state">
                          <Users size={32} />
                          <p>
                            No students have been allocated to this batch yet.
                          </p>
                        </div>
                      ) : (
                        <div className="roster-table-wrapper">
                          <table className="roster-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Student Name</th>
                                <th>School Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                {isTutor && <th>Attendance</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetails.students.map((student, idx) => {
                                const studentId =
                                  student.USER_ID || student.STUDENT_ID;
                                const attRec =
                                  attendanceMap[studentId] ||
                                  attendanceMap[student.USER_ID] ||
                                  attendanceMap[student.STUDENT_ID];
                                const attStatus =
                                  attRec?.status !== undefined
                                    ? attRec?.status
                                    : attRec?.ATTENDANCE_STATUS;

                                return (
                                  <tr
                                    key={studentId || idx}
                                    className={
                                      isAdmin ? "clickable-student-row" : ""
                                    }
                                    onClick={() => {
                                      if (isAdmin) handleViewStudent(student);
                                    }}
                                  >
                                    <td>{idx + 1}</td>
                                    <td className="student-name-cell">
                                      <div className="student-avatar-badge">
                                        {(student.USERNAME || "S")
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </div>
                                      <div className="student-name-stack">
                                        <span className="student-name-txt">
                                          {student.USERNAME}
                                        </span>
                                        {student.GRADE && (
                                          <span className="student-grade-sub">
                                            {student.GRADE}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td>{student.SCHOOL_NAME || "—"}</td>
                                    <td>{student.EMAIL_ID || "—"}</td>
                                    <td>
                                      <span
                                        className={`student-status-badge ${
                                          student.IS_ACTIVE === 1 ||
                                          student.IS_ACTIVE === true
                                            ? "active"
                                            : "inactive"
                                        }`}
                                      >
                                        {student.IS_ACTIVE === 1 ||
                                        student.IS_ACTIVE === true
                                          ? "ACTIVE"
                                          : "INACTIVE"}
                                      </span>
                                    </td>

                                    {/* Tutor Attendance Badge */}
                                    {isTutor && (
                                      <td>
                                        {!selectedClass ? (
                                          <span
                                            className="student-att-badge not-selected"
                                            title="Select Date & Scheduled Class above to view attendance"
                                          >
                                            —
                                          </span>
                                        ) : attendanceLoading ? (
                                          <span className="student-att-badge loading">
                                            <span className="att-mini-spinner" />{" "}
                                            Loading...
                                          </span>
                                        ) : attStatus === 1 ||
                                          attStatus === "1" ||
                                          attStatus === true ? (
                                          <span className="student-att-badge present">
                                            Present
                                          </span>
                                        ) : attStatus === 0 ||
                                          attStatus === "0" ||
                                          attStatus === false ? (
                                          <span className="student-att-badge absent">
                                            Absent
                                          </span>
                                        ) : (
                                          <span className="student-att-badge not-marked">
                                            Not Marked
                                          </span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ASSIGNED TUTORS (Admin only) */}
                  {isAdmin && modalActiveTab === "tutors" && (
                    <div className="tab-pane">
                      {!batchDetails?.tutors ||
                      batchDetails.tutors.length === 0 ? (
                        <div className="tab-empty-state">
                          <Crown size={32} />
                          <p>
                            No tutors have been allocated to this batch yet.
                          </p>
                        </div>
                      ) : (
                        <div className="roster-table-wrapper">
                          <table className="roster-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Tutor Name</th>
                                <th>Role</th>
                                <th>Email</th>
                                <th>Mobile Number</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetails.tutors.map((tutor, idx) => {
                                const isHost =
                                  String(tutor.ROLE).toUpperCase() === "HOST";
                                return (
                                  <tr key={tutor.USER_ID || idx}>
                                    <td>{idx + 1}</td>
                                    <td className="student-name-cell">
                                      <div
                                        className={`student-avatar-badge ${
                                          isHost ? "host" : "support"
                                        }`}
                                      >
                                        {(tutor.TUTOR_NAME || "T")
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </div>
                                      <span className="student-name-txt">
                                        {tutor.TUTOR_NAME}
                                      </span>
                                    </td>
                                    <td>
                                      <span
                                        className={`tl-role-pill ${
                                          isHost
                                            ? "role-host"
                                            : "role-support"
                                        }`}
                                      >
                                        {isHost ? (
                                          <Crown size={12} />
                                        ) : (
                                          <Shield size={12} />
                                        )}
                                        {isHost ? "HOST" : "SUPPORT"}
                                      </span>
                                    </td>
                                    <td>{tutor.EMAIL_ID || "—"}</td>
                                    <td>{tutor.MOBILE_NO || "—"}</td>
                                    <td>
                                      <span
                                        className={`student-status-badge ${
                                          tutor.IS_ACTIVE === 1 ||
                                          tutor.IS_ACTIVE === true
                                            ? "active"
                                            : "inactive"
                                        }`}
                                      >
                                        {tutor.IS_ACTIVE === 1 ||
                                        tutor.IS_ACTIVE === true
                                          ? "ACTIVE"
                                          : "INACTIVE"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: SCHEDULED CLASSES (Admin only) */}
                  {isAdmin && modalActiveTab === "classes" && (
                    <div className="tab-pane">
                      {!batchDetails?.classes ||
                      batchDetails.classes.length === 0 ? (
                        <div className="tab-empty-state">
                          <Calendar size={32} />
                          <p>
                            No classes have been scheduled for this batch yet.
                          </p>
                        </div>
                      ) : (
                        <div className="roster-table-wrapper">
                          <table className="roster-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Module / Topic</th>
                                <th>Time Range</th>
                                <th>Assigned Tutor</th>
                                <th>Meet Link</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetails.classes.map((cls, idx) => (
                                <tr key={cls.ID || idx}>
                                  <td>{idx + 1}</td>
                                  <td className="class-date-cell">
                                    <span className="class-date-txt">
                                      {cls.CLASS_DATE_FORMATTED ||
                                        formatSessionDateDisplay(
                                          cls.CLASS_DATE
                                        )}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="class-topic-cell">
                                      <BookOpen
                                        size={14}
                                        className="topic-icon"
                                      />
                                      <span>
                                        {cls.TOPIC || "Untitled Class"}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="class-time-badge">
                                      <Clock size={12} />
                                      <span>
                                        {formatSessionTimeRange(
                                          cls.CLASS_TIME,
                                          cls.START_TIME,
                                          cls.END_TIME
                                        )}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="class-tutor-badge">
                                      <User size={13} />
                                      <span>
                                        {cls.TUTOR_NAME || "Unassigned"}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    {cls.MEET_LINK ? (
                                      <a
                                        href={cls.MEET_LINK}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="class-meet-icon-btn"
                                        title="Join Google Meet"
                                      >
                                        <Video size={16} />
                                      </a>
                                    ) : (
                                      <span className="no-meet-link">—</span>
                                    )}
                                  </td>
                                  <td>
                                    <span
                                      className={`student-status-badge ${
                                        cls.IS_ACTIVE === 1 ||
                                        cls.IS_ACTIVE === true
                                          ? "active"
                                          : "inactive"
                                      }`}
                                    >
                                      {cls.IS_ACTIVE === 1 ||
                                      cls.IS_ACTIVE === true
                                        ? "SCHEDULED"
                                        : "CANCELLED"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="batch-modal-footer">
              <button
                type="button"
                className="btn-close-details"
                onClick={handleCloseModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          STUDENT DETAIL MODAL (Admin - Details, Performance, Attendance)
      ========================================================= */}
      {isStudentModalOpen && (
        <div className="modal-overlay student-modal-overlay" onClick={handleCloseStudentModal}>
          <div
            className="student-details-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sd-popup-header">
              <div className="sd-header-left">
                <div className="sd-avatar-large">
                  {(
                    selectedStudent?.USERNAME ||
                    studentAttendanceData?.student?.USERNAME ||
                    "S"
                  )
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="sd-header-title-box">
                  <div className="sd-header-tags">
                    <span className="sd-id-tag">
                      ID #
                      {selectedStudent?.USER_ID ||
                        selectedStudent?.STUDENT_ID ||
                        studentAttendanceData?.student?.STUDENT_ID}
                    </span>
                    <span
                      className={`tl-live-status-pill ${
                        selectedStudent?.IS_ACTIVE === 1 ||
                        selectedStudent?.IS_ACTIVE === true ||
                        studentAttendanceData?.student?.IS_ACTIVE === 1
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      <span className="tl-status-dot" />
                      {selectedStudent?.IS_ACTIVE === 1 ||
                      selectedStudent?.IS_ACTIVE === true ||
                      studentAttendanceData?.student?.IS_ACTIVE === 1
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </div>
                  <h2 className="sd-popup-name">
                    {selectedStudent?.USERNAME ||
                      studentAttendanceData?.student?.USERNAME ||
                      "Student"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseStudentModal}
                title="Close student modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="sd-popup-body">
              {studentModalLoading ? (
                <div className="modal-loading-state">
                  <div className="batches-spinner" />
                  <p>Loading student details, performance & attendance...</p>
                </div>
              ) : (
                <div className="sd-sections-container">
                  {/* SECTION 1: STUDENT PROFILE INFORMATION */}
                  <div className="sd-section-card">
                    <div className="sd-section-header">
                      <GraduationCap size={18} className="sd-sec-icon cyan" />
                      <h3 className="sd-sec-title">Student Information</h3>
                    </div>

                    <div className="sd-info-grid">
                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <Building2 size={13} /> School Name
                        </span>
                        <span className="sd-field-val">
                          {selectedStudent?.SCHOOL_NAME ||
                            studentAttendanceData?.student?.SCHOOL_NAME ||
                            "—"}
                        </span>
                      </div>

                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <GraduationCap size={13} /> Grade
                        </span>
                        <span className="sd-field-val">
                          {selectedStudent?.GRADE ||
                            studentAttendanceData?.student?.GRADE ||
                            "—"}
                        </span>
                      </div>

                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <BookOpen size={13} /> Assigned Batch
                        </span>
                        <span className="sd-field-val">
                          {selectedBatch?.BATCH_CODE ||
                            studentAttendanceData?.batch?.BATCH_CODE ||
                            "—"}
                        </span>
                      </div>

                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <Mail size={13} /> Email Address
                        </span>
                        <span className="sd-field-val">
                          {selectedStudent?.EMAIL_ID ||
                            studentAttendanceData?.student?.EMAIL_ID ||
                            "—"}
                        </span>
                      </div>

                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <Phone size={13} /> Mobile Number
                        </span>
                        <span className="sd-field-val">
                          {selectedStudent?.MOBILE_NO ||
                            studentAttendanceData?.student?.MOBILE_NO ||
                            "—"}
                        </span>
                      </div>

                      <div className="sd-info-field">
                        <span className="sd-field-lbl">
                          <CheckCircle2 size={13} /> Account Status
                        </span>
                        <span className="sd-field-val">
                          {selectedStudent?.IS_ACTIVE === 1 ||
                          selectedStudent?.IS_ACTIVE === true
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: PERFORMANCE METRICS */}
                  <div className="sd-section-card">
                    <div className="sd-section-header">
                      <TrendingUp size={18} className="sd-sec-icon purple" />
                      <h3 className="sd-sec-title">Academic Performance</h3>
                    </div>

                    <div className="sd-performance-grid">
                      {/* Assignment Progress Box */}
                      <div className="sd-metric-card">
                        <div className="sd-metric-top-row">
                          <span className="sd-metric-title">
                            <FileText size={15} /> Assignment Completion
                          </span>
                          <span className="sd-metric-value-highlight">
                            {studentPerformanceData?.completedAssignments || 0}{" "}
                            / {studentPerformanceData?.totalAssignments || 0}
                          </span>
                        </div>

                        <div className="sd-progress-track">
                          <div
                            className="sd-progress-fill cyan"
                            style={{
                              width: `${
                                studentPerformanceData?.completionPercentage || 0
                              }%`,
                            }}
                          />
                        </div>

                        <span className="sd-progress-caption">
                          {studentPerformanceData?.completionPercentage || 0}%
                          completed of total assigned sets
                        </span>
                      </div>

                      {/* Assessment Average Score Box */}
                      <div className="sd-metric-card">
                        <div className="sd-metric-top-row">
                          <span className="sd-metric-title">
                            <Award size={15} /> Assessment Score Average
                          </span>
                          <span className="sd-metric-value-highlight purple">
                            {studentPerformanceData?.averageScore || 0}%
                          </span>
                        </div>

                        <div className="sd-progress-track">
                          <div
                            className="sd-progress-fill purple"
                            style={{
                              width: `${
                                studentPerformanceData?.averageScore || 0
                              }%`,
                            }}
                          />
                        </div>

                        <span className="sd-progress-caption">
                          {studentPerformanceData?.assessmentList?.length || 0}{" "}
                          assessment attempts submitted
                        </span>
                      </div>
                    </div>

                    {/* Assessment Submissions List */}
                    {studentPerformanceData?.assessmentList &&
                      studentPerformanceData.assessmentList.length > 0 && (
                        <div className="sd-assessment-table-wrap">
                          <h4 className="sd-subsection-title">
                            Assessment Attempts
                          </h4>
                          <table className="sd-mini-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Assessment</th>
                                <th>Module</th>
                                <th>Score / Total</th>
                                <th>Percentage</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentPerformanceData.assessmentList.map(
                                (attempt, i) => (
                                  <tr key={attempt.ID || i}>
                                    <td>{i + 1}</td>
                                    <td className="fw-500">
                                      {attempt.ASSESSMENT_NAME || "Assessment"}
                                    </td>
                                    <td>{attempt.MODULE_NAME || "—"}</td>
                                    <td>
                                      {attempt.STUDENT_MARK ?? 0} /{" "}
                                      {attempt.TOTAL_QUESTIONS ?? 0}
                                    </td>
                                    <td>
                                      <span
                                        className={`score-badge ${
                                          Number(attempt.MARK_PERCENTAGE) >= 70
                                            ? "high"
                                            : Number(attempt.MARK_PERCENTAGE) >=
                                              40
                                            ? "mid"
                                            : "low"
                                        }`}
                                      >
                                        {Number(
                                          attempt.MARK_PERCENTAGE || 0
                                        ).toFixed(0)}
                                        %
                                      </span>
                                    </td>
                                    <td>
                                      {formatBatchDisplayDate(
                                        attempt.CREATED_ON
                                      )}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </div>

                  {/* SECTION 3: ATTENDANCE SUMMARY & RECORDS */}
                  <div className="sd-section-card">
                    <div className="sd-section-header">
                      <BarChart2 size={18} className="sd-sec-icon green" />
                      <h3 className="sd-sec-title">
                        Batch Attendance Summary
                      </h3>
                    </div>

                    <div className="sd-att-stats-strip">
                      <div className="sd-att-box">
                        <span className="sd-att-num">
                          {studentAttendanceData?.totalClasses ??
                            selectedBatch?.CLASS_COUNT ??
                            0}
                        </span>
                        <span className="sd-att-lbl">TOTAL CLASSES</span>
                      </div>
                      <div className="sd-att-box present">
                        <span className="sd-att-num">
                          {studentAttendanceData?.classesAttended ?? 0}
                        </span>
                        <span className="sd-att-lbl">PRESENT</span>
                      </div>
                      <div className="sd-att-box absent">
                        <span className="sd-att-num">
                          {studentAttendanceData
                            ? Math.max(
                                0,
                                (studentAttendanceData.totalClasses || 0) -
                                  (studentAttendanceData.classesAttended || 0)
                              )
                            : 0}
                        </span>
                        <span className="sd-att-lbl">ABSENT</span>
                      </div>
                      <div className="sd-att-box pct">
                        <span className="sd-att-num">
                          {studentAttendanceData?.overallPercentage ?? 0}%
                        </span>
                        <span className="sd-att-lbl">ATTENDANCE RATE</span>
                      </div>
                    </div>

                    {/* Attendance Logs Table */}
                    {studentAttendanceData?.records &&
                    studentAttendanceData.records.length > 0 ? (
                      <div className="sd-attendance-table-wrap">
                        <h4 className="sd-subsection-title">
                          Class-by-Class Attendance Records
                        </h4>
                        <table className="sd-mini-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Date</th>
                              <th>Topic</th>
                              <th>Time</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentAttendanceData.records.map((rec, idx) => (
                              <tr key={rec.CLASS_ID || idx}>
                                <td>{idx + 1}</td>
                                <td>{rec.CLASS_DATE || "—"}</td>
                                <td className="fw-500">{rec.TOPIC || "—"}</td>
                                <td>{rec.CLASS_TIME || "—"}</td>
                                <td>
                                  {Number(rec.ATTENDANCE_STATUS) === 1 ? (
                                    <span className="student-att-badge present">
                                      <CheckCircle2 size={12} /> Present
                                    </span>
                                  ) : (
                                    <span className="student-att-badge absent">
                                      <XCircle size={12} /> Absent
                                    </span>
                                  )}
                                </td>
                                <td>{rec.REMARKS || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="sd-att-empty">
                        <Calendar size={24} />
                        <span>
                          No individual attendance sessions recorded yet for
                          this student.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="batch-modal-footer">
              <button
                type="button"
                className="btn-close-details"
                onClick={handleCloseStudentModal}
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

export default Batches;
