import React, { useEffect, useRef, useState } from "react";
import { Video } from "lucide-react";
import { toast } from "react-toastify";
import { classScheduleApi } from "../../services/apiService";
import "./LiveClass.css";

const LiveClass = () => {
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const isFetched = useRef(false);

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("ASA_LMSUser") ||
      "{}",
  );

  // =====================================================
  // FETCH ALL LIVE CLASSES
  // HOST + SUPPORT
  // ALL ASSIGNED BATCHES
  // =====================================================

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchUpcomingClasses();
    }
  }, []);

  const fetchUpcomingClasses = async () => {
    try {
      setLoading(true);

      const userId =
        userData?.ID ||
        userData?.USER_ID ||
        userData?.id ||
        userData?.userId;

      if (!userId) {
        console.error("Tutor user ID not found in session");
        setUpcomingClasses([]);
        return;
      }

      console.log("Live Class - User ID:", userId);

      // IMPORTANT:
      // Do NOT send batchId.
      // This returns classes from ALL batches
      // where this tutor is HOST or SUPPORT.
      const res = await classScheduleApi.getLiveClasses(userId);

      console.log("Live Classes API Response:", res?.data);

      if (
        res?.data?.status === 1 &&
        Array.isArray(res.data.data)
      ) {
        setUpcomingClasses(res.data.data);
      } else {
        setUpcomingClasses([]);
      }
    } catch (err) {
      console.error(
        "Failed to fetch upcoming live classes:",
        err?.response?.data || err,
      );

      setUpcomingClasses([]);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CALCULATE REMAINING TIME
  // =====================================================

  const calculateRemainingTime = (cls) => {
    if (!cls?.CLASS_DATE || !cls?.CLASS_TIME) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isJoinable: false,
      };
    }

    try {
      const datePart = String(cls.CLASS_DATE).split("T")[0];
      const timePart = String(cls.CLASS_TIME).substring(0, 8);

      const targetDate = new Date(`${datePart}T${timePart}`);
      const now = new Date();

      const diff = targetDate.getTime() - now.getTime();

      if (Number.isNaN(diff)) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: false,
          isJoinable: false,
        };
      }

      const ONE_HOUR_MS = 60 * 60 * 1000;

      // Join is allowed from 1 hour before class
      const isJoinable = diff <= ONE_HOUR_MS;

      // Class started
      if (diff <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          isJoinable: true,
        };
      }

      const days = Math.floor(
        diff / (1000 * 60 * 60 * 24),
      );

      const hours = Math.floor(
        (diff / (1000 * 60 * 60)) % 24,
      );

      const minutes = Math.floor(
        (diff / (1000 * 60)) % 60,
      );

      const seconds = Math.floor(
        (diff / 1000) % 60,
      );

      return {
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        isJoinable,
      };
    } catch (error) {
      console.error(
        "Error calculating remaining time:",
        error,
      );

      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isJoinable: false,
      };
    }
  };

  // =====================================================
  // FORMAT NUMBER
  // =====================================================

  const formatNumber = (num) => {
    return String(num).padStart(2, "0");
  };

  // =====================================================
  // COUNTDOWN TEXT
  // =====================================================

  const renderCountdownText = (cls) => {
    const timeLeft = calculateRemainingTime(cls);

    if (timeLeft.isExpired) {
      return "CLASS IS LIVE NOW";
    }

    const {
      days,
      hours,
      minutes,
      seconds,
    } = timeLeft;

    const hStr = formatNumber(hours);
    const mStr = formatNumber(minutes);
    const sStr = formatNumber(seconds);

    if (days > 0) {
      return `${days}D ${hStr}:${mStr}:${sStr}`;
    }

    return `${hStr}:${mStr}:${sStr}`;
  };

  // =====================================================
  // JOIN CLASS
  // =====================================================

  const handleJoinClass = (cls) => {
    const timeLeft = calculateRemainingTime(cls);

    if (!timeLeft.isJoinable) {
      toast.info(
        "Meeting link will unlock 1 hour before class starts",
      );
      return;
    }

    if (cls?.MEET_LINK) {
      window.open(cls.MEET_LINK, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Meeting link is not available yet");
    }
  };

  // =====================================================
  // FORMAT DATE + TIME
  // =====================================================

  const formatMetaTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) {
      return "";
    }

    try {
      const datePart = String(dateStr).split("T")[0];

      const dateObj = new Date(`${datePart}T00:00:00`);

      if (Number.isNaN(dateObj.getTime())) {
        return `${dateStr} · ${timeStr}`;
      }

      const dateFormatted = dateObj.toLocaleDateString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
        },
      );

      const timeParts = String(timeStr)
        .substring(0, 8)
        .split(":");

      const d = new Date();

      d.setHours(Number(timeParts[0] || 0));
      d.setMinutes(Number(timeParts[1] || 0));
      d.setSeconds(Number(timeParts[2] || 0));

      const timeFormatted = d.toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        },
      );

      return `${dateFormatted} · ${timeFormatted}`;
    } catch (error) {
      return `${dateStr} · ${timeStr}`;
    }
  };

  // =====================================================
  // COUNTDOWN REFRESH
  // =====================================================

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!upcomingClasses.length) {
      return;
    }

    const timer = setInterval(() => {
      forceUpdate((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [upcomingClasses]);

  // =====================================================
  // RENDER SINGLE CLASS CARD
  // =====================================================

  const renderClassCard = (cls, index, isSingle) => {
    const timeLeft = calculateRemainingTime(cls);

    const isCanJoin = Boolean(
      timeLeft.isJoinable,
    );

    const topicDisplay =
      cls?.TOPIC || "Untitled Class";

    const batchDisplay =
      cls?.BATCH_CODE || "Batch";

    const timeDisplay = formatMetaTime(
      cls?.CLASS_DATE,
      cls?.CLASS_TIME,
    );

    return (
      <section
        key={cls?.ID || index}
        className={`liveclass-card ${
          isSingle
            ? "main-access-card"
            : "multi-access-card"
        }`}
      >
        {/* =========================================
            TOP BADGE
        ========================================= */}

        <div className="card-top-badge">
          <span className="live-dot-pulse"></span>

          <span className="badge-label">
            {timeLeft.isExpired
              ? "LIVE SESSION ONGOING"
              : "LIVE - COUNTDOWN"}
          </span>
        </div>

        {/* =========================================
            BATCH
        ========================================= */}

        <div className="batch-label">
          {batchDisplay}
        </div>

        {/* =========================================
            TOPIC
        ========================================= */}

        <h2 className="class-title">
          {topicDisplay}
        </h2>

        {/* =========================================
            DATE + TIME
        ========================================= */}

        <div className="class-meta">
          <span>{timeDisplay}</span>
        </div>

        {/* =========================================
            COUNTDOWN
        ========================================= */}

        <div className="countdown-box">
          <div
            className={`countdown-time ${
              !isSingle
                ? "countdown-time-small"
                : ""
            }`}
          >
            {renderCountdownText(cls)}
          </div>
        </div>

        {/* =========================================
            JOIN BUTTON
        ========================================= */}

        <button
          className={`join-live-btn ${
            isCanJoin
              ? "active"
              : "disabled"
          }`}
          onClick={() =>
            handleJoinClass(cls)
          }
          disabled={!isCanJoin}
        >
          <Video size={18} />

          <span>
            {timeLeft.isExpired
              ? "Join live class"
              : "Join live class"}
          </span>
        </button>
      </section>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className="liveclass-page">

      {/* ===========================================
          HEADER
      =========================================== */}

      <div className="liveclass-header">
        <div className="section-label">
          LIVE
        </div>

        <h1 className="header-main-title">
          Live Class Access
        </h1>

        <p className="header-subtitle">
          One-click join for your upcoming online
          classes.
        </p>
      </div>

      {/* ===========================================
          CONTENT
      =========================================== */}

      <div
        className={`liveclass-container ${
          upcomingClasses.length > 1
            ? "multiple-classes"
            : ""
        }`}
      >

        {/* =========================================
            LOADING
        ========================================= */}

        {loading ? (
          <section className="liveclass-card main-access-card loading-card">
            <p className="loading-text">
              Loading live class details...
            </p>
          </section>
        ) : upcomingClasses.length === 0 ? (

          /* =======================================
             NO CLASSES
          ======================================= */

          <section className="liveclass-card main-access-card">
            <div className="card-top-badge">
              <span
                className="badge-label no-session-label"
              >
                NO LIVE SESSION
              </span>
            </div>

            <h2 className="class-title">
              No Classes Scheduled
            </h2>

            <p className="class-meta no-session-text">
              There are currently no upcoming live
              classes scheduled for your assigned
              batches.
            </p>
          </section>

        ) : upcomingClasses.length === 1 ? (

          /* =======================================
             ONE CLASS
          ======================================= */

          renderClassCard(
            upcomingClasses[0],
            0,
            true,
          )

        ) : (

          /* =======================================
             MULTIPLE CLASSES
             2 CARDS PER ROW
          ======================================= */

          <div className="liveclass-grid">
            {upcomingClasses.map(
              (cls, index) =>
                renderClassCard(
                  cls,
                  index,
                  false,
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveClass;