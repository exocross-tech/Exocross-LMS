import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { toast } from "react-toastify";

import "./ClassDetails.css";

import { classDetailsApi } from "../../services/apiService";

const ClassDetails = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  const isFetched = useRef(false);

  /* =====================================================
     GET STUDENT ID
  ===================================================== */

  const getStudentId = () => {
    try {
      let storedUser = sessionStorage.getItem("ASA_LMSUser");

      if (!storedUser) {
        storedUser = localStorage.getItem("ASA_LMSUser");
      }

      if (!storedUser) {
        toast.error("Student login information not found.");
        return null;
      }

      const loggedInUser = JSON.parse(storedUser);

      const id =
        loggedInUser.ID ||
        loggedInUser.USER_ID ||
        loggedInUser.STUDENT_ID ||
        loggedInUser.studentId ||
        loggedInUser.id;

      if (!id) {
        toast.error("Student ID not found.");
        return null;
      }

      return id;
    } catch (error) {
      console.error("Failed to get student ID:", error);
      toast.error("Unable to get student information.");
      return null;
    }
  };

  /* =====================================================
     FORMAT TIME
  ===================================================== */

  const formatTime = (time) => {
    if (!time) return "-";

    const value = String(time);

    if (value.includes(":")) {
      return value.substring(0, 5);
    }

    return value;
  };

  /* =====================================================
     FORMAT DATE & DAY
  ===================================================== */

  const parseDateString = (dateVal) => {
    if (!dateVal) return null;
    try {
      const str = String(dateVal).trim();
      const clean = str.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split("-");
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        const [d, m, y] = clean.split("-");
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      const dt = new Date(dateVal);
      return isNaN(dt.getTime()) ? null : dt;
    } catch (_) {
      return null;
    }
  };

  const formatDate = (dateVal) => {
    const dt = parseDateString(dateVal);
    if (!dt) return "-";
    return dt.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDay = (dateVal, fallbackDay) => {
    const dt = parseDateString(dateVal);
    if (dt) {
      return dt.toLocaleDateString("en-US", { weekday: "short" });
    }
    if (fallbackDay) return String(fallbackDay).substring(0, 3);
    return "-";
  };

  // Check if assigned date matches today (local calendar date comparison)
  const isClassDateToday = (dateVal) => {
    const dt = parseDateString(dateVal);
    if (!dt) return false;
    const now = new Date();
    return (
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate()
    );
  };

  /* =====================================================
     FETCH CLASSES
  ===================================================== */

  const fetchStudentClasses = async (id) => {
    if (!id) return;

    setLoading(true);

    try {
      const res = await classDetailsApi.getByStudentId(id);

      if (res?.data?.status === 1) {
        const apiData = res.data.data || [];

        const formattedData = apiData.map((item) => {
          const rawDate = item.CLASS_DATE || item.CLASS_DATE_STR || item.DAY_DATE;
          const isToday = isClassDateToday(rawDate);

          return {
            ID: item.ID,
            RAW_DATE: rawDate,
            DATE: formatDate(rawDate),
            DAY: formatDay(rawDate, item.DAY),
            TIME: formatTime(item.TIME),
            TOPIC: item.TOPIC || "-",
            TUTOR: item.TUTOR || "-",
            IS_TODAY: isToday,
            JOIN:
              item.JOIN_LINK ||
              item.JOIN_URL ||
              item.joinLink ||
              item.join_url ||
              null,
          };
        });

        setClasses(formattedData);
      } else {
        setClasses([]);

        toast.error(res?.data?.message || "No class details found.");
      }
    } catch (error) {
      console.error(
        "Fetch student classes error:",
        error.response?.data || error,
      );

      setClasses([]);

      toast.error(
        error.response?.data?.message || "Failed to load class details.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    if (isFetched.current) return;

    isFetched.current = true;

    const id = getStudentId();

    if (id) {
      fetchStudentClasses(id);
    }
  }, []);

  /* =====================================================
     JOIN CLASS
  ===================================================== */

  const handleJoinClass = (link) => {
    if (!link) {
      toast.error("Class joining link is not available.");
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="class-details-container">
      {/* PAGE HEADER */}

      <div className="class-details-header">
        <div className="class-details-breadcrumb">TIMETABLE</div>

        <h1 className="class-details-title">Class Details</h1>

        <p className="class-details-subtitle">
          Your scheduled classes and one-click join links.
        </p>
      </div>

      {/* CARD */}

      <div className="class-details-card">
        {/* CARD TITLE */}

        <div className="class-details-card-header">
          <div className="class-details-heading">
            <CalendarDays size={21} />

            <h2>Scheduled Classes</h2>
          </div>
        </div>

        {/* TABLE */}

        <div className="class-details-table-container">
          {loading ? (
            <div className="class-details-loading">Loading scheduled classes...</div>
          ) : classes.length === 0 ? (
            <div className="class-details-empty">
              No scheduled classes found.
            </div>
          ) : (
            <table className="class-details-table">
              <thead>
                <tr>
                  <th className="class-details-date-column">DATE</th>

                  <th className="class-details-day-column">DAY</th>

                  <th className="class-details-time-column">TIME</th>

                  <th className="class-details-topic-column">TOPIC</th>

                  <th className="class-details-tutor-column">TUTOR</th>

                  <th className="class-details-join-column">JOIN LINK</th>
                </tr>
              </thead>

              <tbody>
                {classes.map((item, index) => (
                  <tr key={item.ID || index}>
                    {/* DATE */}

                    <td className="class-details-date-column">{item.DATE}</td>

                    {/* DAY */}

                    <td className="class-details-day-column">{item.DAY}</td>

                    {/* TIME */}

                    <td className="class-details-time-column">{item.TIME}</td>

                    {/* TOPIC */}

                    <td className="class-details-topic-column">{item.TOPIC}</td>

                    {/* TUTOR */}

                    <td className="class-details-tutor-column">{item.TUTOR}</td>

                    {/* JOIN LINK */}

                    <td className="class-details-join-column">
                      {item.IS_TODAY && item.JOIN ? (
                        <button
                          type="button"
                          className="class-details-join-btn"
                          onClick={() => handleJoinClass(item.JOIN)}
                        >
                          <span>Join link</span>

                          <ExternalLink size={17} strokeWidth={2} />
                        </button>
                      ) : !item.IS_TODAY && item.JOIN ? (
                        <span className="class-details-pending-link">
                          Available on class date
                        </span>
                      ) : (
                        <span className="class-details-no-link">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassDetails;
