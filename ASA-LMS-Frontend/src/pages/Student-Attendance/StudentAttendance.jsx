import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Calendar,
  Flame,
  Search,
  User,
  School,
  MapPin,
  Mail,
  Phone,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import "./StudentAttendance.css";
import { attendanceApi, classDetailsApi } from "../../services/apiService";

const StudentAttendance = () => {
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState({
    overallPercentage: 0,
    classesAttended: 0,
    totalClasses: 0,
    currentStreak: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const isFetched = useRef(false);

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchStudentAttendance();
    }
  }, []);

  const getLoggedInUser = () => {
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

  const fetchStudentAttendance = async () => {
    setLoading(true);
    const user = getLoggedInUser();

    const studentId =
      user?.STUDENT_ID ||
      user?.USER_ID ||
      user?.ID ||
      user?.id ||
      user?.studentId ||
      1;

    const userProfile = {
      USER_ID: studentId,
      USERNAME: user?.USERNAME || user?.username || user?.FIRST_NAME || "-",
      EMAIL_ID: user?.EMAIL_ID || user?.email || "-",
      MOBILE_NO: user?.MOBILE_NO || user?.mobile || "-",
      SCHOOL_NAME: user?.SCHOOL_NAME || "-",
      ADDRESS_LINE1: user?.ADDRESS_LINE1 || "-",
      ADDRESS_LINE2: user?.ADDRESS_LINE2 || "",
      CITY: user?.CITY || "-",
      DISTRICT: user?.DISTRICT || "-",
      STATE: user?.STATE || "-",
      PINCODE: user?.PINCODE || "-",
      LANDMARK: user?.LANDMARK || "-",
      USER_TYPE: user?.USER_TYPE || "-",
    };

    setStudentInfo(userProfile);

    const batchDetails = {
      ID: user?.BATCH_ID || "-",
      BATCH_CODE: user?.BATCH_CODE || "-",
      START_DATE: user?.START_DATE || "-",
      END_DATE: user?.END_DATE || "-",
    };

    setBatchInfo(batchDetails);

    try {
      let response = null;
      if (attendanceApi?.getStudentAttendance) {
        response = await attendanceApi.getStudentAttendance(studentId);
      } else if (classDetailsApi?.getByStudentId) {
        response = await classDetailsApi.getByStudentId(studentId);
      }

      if (response && response.data && response.data.status === 1 && response.data.data) {
        const resData = response.data.data;

        setStats({
          overallPercentage: resData.overallPercentage ?? 0,
          classesAttended: resData.classesAttended ?? resData.presentCount ?? 0,
          totalClasses: resData.totalClasses ?? resData.totalCount ?? 0,
          currentStreak: resData.currentStreak ?? resData.streak ?? 0,
        });

        if (resData.student) {
          setStudentInfo((prev) => ({
            ...prev,
            ...resData.student,
          }));
        }

        if (resData.batch) {
          setBatchInfo((prev) => ({
            ...prev,
            ...resData.batch,
          }));
        }

        const rawList = Array.isArray(resData.records)
          ? resData.records
          : Array.isArray(resData)
          ? resData
          : [];

        if (rawList.length > 0 && !resData.student) {
          const first = rawList[0];
          setStudentInfo((prev) => ({
            ...prev,
            USERNAME: first.USERNAME || prev?.USERNAME || "-",
            EMAIL_ID: first.EMAIL_ID || prev?.EMAIL_ID || "-",
            MOBILE_NO: first.MOBILE_NO || prev?.MOBILE_NO || "-",
          }));

          setBatchInfo((prev) => ({
            ...prev,
            ID: first.BATCH_ID || prev?.ID || "-",
            BATCH_CODE: first.BATCH_CODE || prev?.BATCH_CODE || "-",
            START_DATE: first.START_DATE ? first.START_DATE.split("T")[0] : (prev?.START_DATE || "-"),
            END_DATE: first.END_DATE ? first.END_DATE.split("T")[0] : (prev?.END_DATE || "-"),
          }));
        }

        const fetchedRecords = rawList.map((item) => {
          const rawStatus = item.ATTENDANCE_STATUS;
          const status =
            rawStatus === 1 || rawStatus === "1"
              ? 1
              : rawStatus === 0 || rawStatus === "0"
              ? 0
              : null;
          return {
            ID: item.ID || item.id || item.CLASS_ID,
            CLASS_ID: item.CLASS_ID || item.classId,
            BATCH_ID: item.BATCH_ID || item.batchId || batchDetails.ID,
            STUDENT_ID: item.STUDENT_ID || studentId,
            topic: item.TOPIC || item.topic || item.CLASS_NAME || item.className || "-",
            classDate: item.CLASS_DATE ? item.CLASS_DATE.split("T")[0] : (item.classDate ? item.classDate.split("T")[0] : (item.CREATED_AT ? item.CREATED_AT.split("T")[0] : "-")),
            classTime: item.CLASS_TIME || item.classTime || null,
            meetLink: item.MEET_LINK || item.meetLink || null,
            ATTENDANCE_STATUS: status,
            statusText: item.STATUS_TEXT || (status === 1 ? "Present" : status === 0 ? "Absent" : "Not Marked"),
            REMARKS: item.REMARKS || item.remarks || null,
            batchCode: item.BATCH_CODE || item.batchCode || batchDetails.BATCH_CODE,
          };
        });

        setAttendanceRecords(fetchedRecords);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Backend API not reachable or returned error.", err);
    }
    setLoading(false);
  };

  /* =====================================================
     3. FILTERED RECORDS (SEARCH + PRESENT/ABSENT/NOT_MARKED TAB)
  ===================================================== */
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        item.topic.toLowerCase().includes(searchLower) ||
        item.classDate.toLowerCase().includes(searchLower) ||
        (item.classTime && item.classTime.toLowerCase().includes(searchLower)) ||
        (item.REMARKS && item.REMARKS.toLowerCase().includes(searchLower)) ||
        (item.batchCode && item.batchCode.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      if (statusFilter === "PRESENT") return item.ATTENDANCE_STATUS === 1;
      if (statusFilter === "ABSENT") return item.ATTENDANCE_STATUS === 0;
      if (statusFilter === "NOT_MARKED")
        return item.ATTENDANCE_STATUS === null || item.ATTENDANCE_STATUS === undefined;

      return true;
    });
  }, [attendanceRecords, searchTerm, statusFilter]);

  return (
    <div className="student-attendance-container">
      {/* HEADER SECTION */}
      <div className="attendance-page-header">
        <div className="header-category-tag">
          <span className="tag-dot"></span>
          <span>LOG · ATTENDANCE</span>
        </div>
        <h1 className="header-main-title">Attendance</h1>
        <p className="header-subtitle-text">
          Your class attendance history and streak.
        </p>
      </div>

      {/* STUDENT & BATCH INFO CARD (TOGGLE BANNER) */}
      <div className="student-profile-banner">
        <div className="profile-banner-grid">
          <div className="info-item-box">
            <span className="info-item-label">Student Name</span>
            <span className="info-item-value highlight-cyan">
              {studentInfo?.USERNAME}
            </span>
          </div>

          <div className="info-item-box">
            <span className="info-item-label">School / Institution</span>
            <span className="info-item-value">
              {studentInfo?.SCHOOL_NAME}
            </span>
          </div>

          <div className="info-item-box">
            <span className="info-item-label">Enrolled Batch</span>
            <span className="info-item-value">
              {batchInfo?.BATCH_CODE || "—"}
            </span>
          </div>

          <div className="info-item-box" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="filter-tab-btn"
              onClick={() => setShowProfileDetails(!showProfileDetails)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                width: "fit-content",
                border: "1px solid rgba(0, 240, 255, 0.3)",
              }}
            >
              <Info size={14} color="#00f0ff" />
              <span>{showProfileDetails ? "Hide Student Info" : "View Student Info"}</span>
              {showProfileDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {showProfileDetails && (
          <div
            style={{
              marginTop: "1.25rem",
              paddingTop: "1rem",
              borderTop: "1px dashed rgba(255, 255, 255, 0.1)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            <div className="info-item-box">
              <span className="info-item-label">Email Address</span>
              <span className="info-item-value">{studentInfo?.EMAIL_ID}</span>
            </div>
            <div className="info-item-box">
              <span className="info-item-label">Contact Number</span>
              <span className="info-item-value">{studentInfo?.MOBILE_NO}</span>
            </div>
            <div className="info-item-box">
              <span className="info-item-label">District & State</span>
              <span className="info-item-value">
                {studentInfo?.DISTRICT}, {studentInfo?.STATE}
              </span>
            </div>
            <div className="info-item-box">
              <span className="info-item-label">Batch Duration</span>
              <span className="info-item-value">
                {batchInfo?.START_DATE} to {batchInfo?.END_DATE}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* METRICS SUMMARY GRID (3 TOP CARDS AS IN IMAGE) */}
      <div className="metrics-summary-grid">
        {/* CARD 1: OVERALL */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-card-label">OVERALL</span>
          </div>
          <div className="metric-value-huge">{stats.overallPercentage}%</div>
          <div className="metric-progress-wrapper">
            <div
              className="metric-progress-fill"
              style={{ width: `${stats.overallPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* CARD 2: CLASSES ATTENDED */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-card-label">CLASSES ATTENDED</span>
          </div>
          <div className="metric-value-fraction">
            <span>{stats.classesAttended}</span>
            <span className="slash">/</span>
            <span className="denom">{stats.totalClasses}</span>
          </div>
        </div>

        {/* CARD 3: CURRENT STREAK */}
        <div className="metric-card">
          <div className="metric-card-header">
            <span className="metric-card-label">CURRENT STREAK</span>
          </div>
          <div className="metric-value-streak">
            <span>{stats.currentStreak}</span>
            <span className="unit-text">days</span>
          </div>
        </div>
      </div>

      {/* RECENT CLASSES CONTAINER */}
      <div className="recent-classes-card">
        <div className="recent-classes-header">
          <h2 className="classes-title">Recent classes</h2>

          <div className="classes-toolbar">
            {/* SEARCH */}
            <div className="attendance-search-box">
              <Search size={15} color="#64748b" />
              <input
                type="text"
                placeholder="Search topic or date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* FILTER TABS */}
            <div className="filter-tab-group">
              <button
                className={`filter-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                All
              </button>
              <button
                className={`filter-tab-btn ${statusFilter === "PRESENT" ? "active" : ""}`}
                onClick={() => setStatusFilter("PRESENT")}
              >
                Present
              </button>
              <button
                className={`filter-tab-btn ${statusFilter === "ABSENT" ? "active" : ""}`}
                onClick={() => setStatusFilter("ABSENT")}
              >
                Absent
              </button>
              <button
                className={`filter-tab-btn ${statusFilter === "NOT_MARKED" ? "active" : ""}`}
                onClick={() => setStatusFilter("NOT_MARKED")}
              >
                Not Marked
              </button>
            </div>
          </div>
        </div>

        {/* CLASSES LIST */}
        {loading ? (
          <div className="attendance-loading-state">
            <div className="attendance-spinner"></div>
            <span>Loading class attendance history...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="attendance-empty-state">
            <Calendar size={32} color="#475569" />
            <p>No class attendance records match your filter query.</p>
          </div>
        ) : (
          <div className="classes-list-container">
            {filteredRecords.map((item) => {
              const isPresent = item.ATTENDANCE_STATUS === 1;

              return (
                <div className="class-row-item" key={item.ID}>
                  <div className="class-row-left">
                    <div className="class-topic-name">{item.topic}</div>
                    <div className="class-meta-row">
                      <span className="class-date-text">{item.classDate}</span>
                      {item.classTime && item.classTime !== "-" && (
                        <span className="class-date-text">· {item.classTime}</span>
                      )}
                      {item.batchCode && (
                        <span className="class-batch-badge">{item.batchCode}</span>
                      )}
                      {item.REMARKS && item.REMARKS !== "-" && (
                        <span className="class-remarks-text">
                          · {item.REMARKS}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="class-row-right">
                    <span
                      className={`attendance-status-badge ${
                        item.ATTENDANCE_STATUS === 1
                          ? "present"
                          : item.ATTENDANCE_STATUS === 0
                          ? "absent"
                          : "not-marked"
                      }`}
                    >
                      {item.ATTENDANCE_STATUS === 1
                        ? "PRESENT"
                        : item.ATTENDANCE_STATUS === 0
                        ? "ABSENT"
                        : "NOT MARKED"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendance;
