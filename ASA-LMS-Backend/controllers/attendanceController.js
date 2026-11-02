const sql = require("mssql");
const { getPool, connectDB } = require("../config/database");

// Format Date YYYY-MM-DD
const formatDateStr = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Format Time HH:mm:ss
const formatTimeStr = (time) => {
  if (!time) return "";
  if (time instanceof Date) {
    return [
      String(time.getHours()).padStart(2, "0"),
      String(time.getMinutes()).padStart(2, "0"),
      String(time.getSeconds()).padStart(2, "0"),
    ].join(":");
  }
  if (typeof time === "string") {
    return time.substring(0, 8);
  }
  return String(time);
};

// Get current date string in Asia/Kolkata timezone (YYYY-MM-DD)
const getTodayISTStr = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

// Check if class has started onwards (ongoing or finished) in Asia/Kolkata timezone
const isClassStarted = (classDate, classTime) => {
  if (!classDate) return false;
  const dateStr = formatDateStr(classDate);
  if (!dateStr) return false;
  let timeStr = formatTimeStr(classTime);
  if (!timeStr) timeStr = "00:00:00";
  if (timeStr.length === 5) timeStr += ":00";

  const now = new Date();
  const istDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const istTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const currentIST = `${istDate}T${istTime}`;
  const classStartIST = `${dateStr}T${timeStr}`;

  return classStartIST <= currentIST;
};

// Get Initial Attendance Data (Active Batches, Conducted Sessions, Batch Details, Students & Attendance)
const getInitialAttendanceData = async (req, res) => {
  try {
    let pool = getPool();
    if (!pool || !pool.connected) {
      pool = await connectDB();
    }
    const targetBatchId = req.query.batchId ? Number(req.query.batchId) : null;
    const targetClassId = req.query.classId ? Number(req.query.classId) : null;
    const rawUserId = req.query.userId || req.headers["x-user-id"];
    const rawUserType = req.query.userType || req.query.role;

    const userId = rawUserId ? Number(rawUserId) : null;
    let userType = rawUserType ? String(rawUserType).trim().toUpperCase() : null;

    // If userId is provided but userType is not, fetch USER_TYPE from USERS table
    if (userId && !userType) {
      const userRes = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`SELECT USER_TYPE FROM USERS WHERE USER_ID = @USER_ID`);
      if (userRes.recordset.length > 0) {
        userType = String(userRes.recordset[0].USER_TYPE || "").trim().toUpperCase();
      }
    }

    let batches = [];

    // 1. Fetch active batches (Both HOST and SUPPORT tutors can access authorized batches)
    if (userType === "TUTOR" && userId) {
      const tutorBatchesResult = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`
          SELECT DISTINCT
            b.ID,
            b.BATCH_CODE,
            b.BATCH_NAME,
            b.START_DATE,
            b.END_DATE,
            b.IS_ACTIVE,
            COUNT(DISTINCT sa.ID) AS TOTAL_STUDENTS
          FROM TUTOR_ALLOCATIONS ta
          INNER JOIN BATCHES b ON b.ID = ta.BATCH_ID
          LEFT JOIN STUDENT_ALLOCATIONS sa ON sa.BATCH_ID = b.ID
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE b.IS_ACTIVE = 1
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
            AND (
              TRY_CONVERT(INT, t.role) IN (1, 2)
              OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT')
            )
          GROUP BY b.ID, b.BATCH_CODE, b.BATCH_NAME, b.START_DATE, b.END_DATE, b.IS_ACTIVE
          ORDER BY b.ID DESC
        `);
      batches = tutorBatchesResult.recordset;
    } else {
      const batchesResult = await pool.request().query(`
        SELECT 
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE,
          COUNT(DISTINCT sa.ID) AS TOTAL_STUDENTS
        FROM BATCHES b
        LEFT JOIN STUDENT_ALLOCATIONS sa ON sa.BATCH_ID = b.ID
        WHERE b.IS_ACTIVE = 1
        GROUP BY b.ID, b.BATCH_CODE, b.BATCH_NAME, b.START_DATE, b.END_DATE, b.IS_ACTIVE
        ORDER BY b.ID DESC
      `);
      batches = batchesResult.recordset;
    }

    // Determine selected batch with tutor authorization check
    if (targetBatchId && userType === "TUTOR" && userId) {
      const isAuthorized = batches.some((b) => b.ID === targetBatchId);
      if (!isAuthorized) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to view attendance for this batch",
        });
      }
    }

    if (batches.length === 0) {
      return res.json({
        status: 1,
        data: {
          batches: [],
          selectedBatch: null,
          sessions: [],
          lastConductedSession: null,
          students: [],
        },
      });
    }

    let selectedBatch = null;
    if (targetBatchId) {
      selectedBatch = batches.find((b) => b.ID === targetBatchId) || batches[0];
    } else {
      selectedBatch = batches[0];
    }

    const batchId = selectedBatch.ID;

    // 2. Fetch sessions for the selected batch
    const sessionsResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT 
          cs.ID,
          cs.TOPIC,
          cs.CLASS_DATE,
          CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME,
          cs.MEET_LINK,
          cs.BATCH_ID
        FROM CLASS_SCHEDULES cs
        WHERE cs.BATCH_ID = @BATCH_ID
        ORDER BY cs.CLASS_DATE DESC, cs.CLASS_TIME DESC
      `);

    const sessions = sessionsResult.recordset.map((s) => ({
      ...s,
      CLASS_DATE: formatDateStr(s.CLASS_DATE),
      CLASS_TIME: formatTimeStr(s.CLASS_TIME),
      isStarted: isClassStarted(s.CLASS_DATE, s.CLASS_TIME),
    }));

    // Determine selected session (last conducted / specified)
    let selectedSession = null;
    if (targetClassId) {
      selectedSession = sessions.find((s) => s.ID === targetClassId) || null;
    }
    if (!selectedSession && sessions.length > 0) {
      // Default to the most recent ongoing/finished session, otherwise the first session
      selectedSession = sessions.find((s) => s.isStarted) || sessions[0];
    }

    const classId = selectedSession ? selectedSession.ID : null;

    // 3. Fetch allocated students & attendance records for selected batch and class
    let students = [];
    if (batchId) {
      const studentsRequest = pool.request().input("BATCH_ID", sql.Int, batchId);

      let query = `
        SELECT 
          u.USER_ID AS STUDENT_ID,
          u.USERNAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          ca.ATTENDANCE_STATUS AS ATTENDANCE_STATUS,
          ISNULL(ca.REMARKS, '') AS REMARKS,
          ca.ID AS ATTENDANCE_ID
        FROM STUDENT_ALLOCATIONS sa
        INNER JOIN USERS u ON sa.STUDENT_ID = u.USER_ID
      `;

      if (classId) {
        studentsRequest.input("CLASS_ID", sql.Int, classId);
        query += `
          LEFT JOIN CLASS_ATTENDANCE ca 
            ON ca.STUDENT_ID = u.USER_ID AND ca.CLASS_ID = @CLASS_ID
        `;
      } else {
        query += `
          LEFT JOIN CLASS_ATTENDANCE ca ON 1 = 0
        `;
      }

      query += `
        WHERE sa.BATCH_ID = @BATCH_ID
          AND u.IS_ACTIVE = 1
        ORDER BY u.USERNAME ASC
      `;

      const studentsResult = await studentsRequest.query(query);
      students = studentsResult.recordset;
    }

    res.json({
      status: 1,
      data: {
        batches,
        selectedBatch,
        sessions,
        lastConductedSession: selectedSession,
        students,
      },
    });
  } catch (err) {
    console.error("getInitialAttendanceData error:", err);
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// Submit / Upsert Attendance for a class session
// Supports Present (1), Absent (0), and Not Marked (removes record so missing DB row = Not Marked)
// Verifies that attendance can only be marked once the class has started onwards
const submitAttendance = async (req, res) => {
  try {
    const { classId, batchId, createdBy, attendance, userId, userType } = req.body;

    const parsedClassId = Number(classId);
    const parsedBatchId = Number(batchId);

    if (!parsedClassId || !parsedBatchId) {
      return res.status(400).json({
        status: 0,
        message: "Class ID and Batch ID are required",
      });
    }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Attendance array with student attendance records is required",
      });
    }

    let pool = getPool();
    if (!pool || !pool.connected) {
      pool = await connectDB();
    }

    const rawUserId = userId || req.headers["x-user-id"] || req.query.userId;
    const rawUserType = userType || req.headers["x-user-type"] || req.query.userType;
    const callerId = rawUserId ? Number(rawUserId) : null;
    let callerType = rawUserType ? String(rawUserType).trim().toUpperCase() : null;

    if (callerId && !callerType) {
      const userRes = await pool
        .request()
        .input("USER_ID", sql.Int, callerId)
        .query(`SELECT USER_TYPE FROM USERS WHERE USER_ID = @USER_ID`);
      if (userRes.recordset.length > 0) {
        callerType = String(userRes.recordset[0].USER_TYPE || "").trim().toUpperCase();
      }
    }

    // Authorization check for TUTOR (both HOST and SUPPORT tutors are authorized for assigned batches)
    if (callerType === "TUTOR" && callerId) {
      const authCheck = await pool
        .request()
        .input("BATCH_ID", sql.Int, parsedBatchId)
        .input("USER_ID", sql.Int, callerId)
        .query(`
          SELECT TOP 1 1
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE ta.BATCH_ID = @BATCH_ID
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
            AND (
              TRY_CONVERT(INT, t.role) IN (1, 2)
              OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT')
            )
        `);

      if (authCheck.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to mark attendance for this batch",
        });
      }
    }

    // Verify class start time: Attendance can only be marked once class has started onwards
    const classCheck = await pool
      .request()
      .input("CLASS_ID", sql.Int, parsedClassId)
      .query(`SELECT TOP 1 CLASS_DATE, CLASS_TIME, TOPIC FROM CLASS_SCHEDULES WHERE ID = @CLASS_ID`);

    if (classCheck.recordset.length > 0) {
      const cls = classCheck.recordset[0];
      if (!isClassStarted(cls.CLASS_DATE, cls.CLASS_TIME)) {
        return res.status(400).json({
          status: 0,
          message: "Attendance can only be marked once the class has started onwards (ongoing or finished).",
        });
      }
    }

    const creator = createdBy || (callerType || "ADMIN");

    for (const record of attendance) {
      const studentId = Number(record.studentId);
      if (!studentId || isNaN(studentId)) continue;

      const rawStatus = record.attendanceStatus;
      const isPresent = rawStatus === 1 || rawStatus === "1";
      const isAbsent = rawStatus === 0 || rawStatus === "0";
      const isNotMarked = !isPresent && !isAbsent;
      const remarks = record.remarks ? String(record.remarks).trim() : null;

      if (isNotMarked) {
        // If Not Marked: remove any existing attendance record so it is truly unmarked (missing DB row)
        await pool
          .request()
          .input("CLASS_ID", sql.Int, parsedClassId)
          .input("STUDENT_ID", sql.Int, studentId)
          .query(`
            DELETE FROM CLASS_ATTENDANCE
            WHERE CLASS_ID = @CLASS_ID AND STUDENT_ID = @STUDENT_ID
          `);
      } else {
        const status = isPresent ? 1 : 0;
        await pool
          .request()
          .input("CLASS_ID", sql.Int, parsedClassId)
          .input("BATCH_ID", sql.Int, parsedBatchId)
          .input("STUDENT_ID", sql.Int, studentId)
          .input("ATTENDANCE_STATUS", sql.Int, status)
          .input("REMARKS", sql.NVarChar(500), remarks)
          .input("CREATED_BY", sql.NVarChar(50), creator)
          .query(`
            MERGE CLASS_ATTENDANCE AS target
            USING (SELECT @CLASS_ID AS CLASS_ID, @BATCH_ID AS BATCH_ID, @STUDENT_ID AS STUDENT_ID, @ATTENDANCE_STATUS AS ATTENDANCE_STATUS, @REMARKS AS REMARKS, @CREATED_BY AS CREATED_BY) AS source
            ON (target.CLASS_ID = source.CLASS_ID AND target.STUDENT_ID = source.STUDENT_ID)
            WHEN MATCHED THEN
                UPDATE SET 
                    BATCH_ID = source.BATCH_ID,
                    ATTENDANCE_STATUS = source.ATTENDANCE_STATUS,
                    REMARKS = source.REMARKS,
                    UPDATED_BY = source.CREATED_BY,
                    UPDATED_AT = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (CLASS_ID, BATCH_ID, STUDENT_ID, ATTENDANCE_STATUS, REMARKS, CREATED_BY, CREATED_AT)
                VALUES (source.CLASS_ID, source.BATCH_ID, source.STUDENT_ID, source.ATTENDANCE_STATUS, source.REMARKS, source.CREATED_BY, GETDATE());
          `);
      }
    }

    return res.json({
      status: 1,
      message: "Attendance marked successfully!",
    });
  } catch (err) {
    console.error("submitAttendance error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

const getStudentAttendance = async (req, res) => {
  try {
    const rawUserId = req.params.userId || req.query.userId || req.headers["x-user-id"];
    const sId = Number(rawUserId);

    if (!sId || isNaN(sId) || sId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student user ID is required",
      });
    }

    const explicitBatchId =
      req.params.batchId || req.query.batchId
        ? Number(req.params.batchId || req.query.batchId)
        : null;

    let pool = getPool();
    if (!pool || !pool.connected) {
      pool = await connectDB();
    }

    // 1. Fetch student info and allocated active batch
    const userBatchRes = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .input("EXPLICIT_BATCH_ID", sql.Int, explicitBatchId)
      .query(`
        SELECT TOP 1
          u.USER_ID,
          u.USERNAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          u.SCHOOL_NAME,
          u.GRADE,
          u.ADDRESS_LINE1,
          u.ADDRESS_LINE2,
          u.CITY,
          u.DISTRICT,
          u.STATE,
          u.PINCODE,
          u.LANDMARK,
          u.USER_TYPE,
          sa.BATCH_ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE AS BATCH_IS_ACTIVE,
          (
            SELECT TOP 1 ut.USERNAME
            FROM TUTOR_ALLOCATIONS ta
            CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
            WITH (tutorId INT '$.tutorId', role NVARCHAR(50) '$.role') t
            INNER JOIN USERS ut ON ut.USER_ID = t.tutorId
            WHERE ta.BATCH_ID = b.ID AND (TRY_CONVERT(INT, t.role) IN (1, 2) OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT'))
          ) AS TUTOR_NAME
        FROM USERS u WITH (NOLOCK)
        LEFT JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) 
          ON sa.STUDENT_ID = u.USER_ID 
          AND (@EXPLICIT_BATCH_ID IS NULL OR sa.BATCH_ID = @EXPLICIT_BATCH_ID)
        LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID AND ISNULL(b.IS_ACTIVE, 1) = 1
        WHERE u.USER_ID = @STUDENT_ID
        ORDER BY sa.ID DESC
      `);

    if (userBatchRes.recordset.length === 0) {
      return res.json({
        status: 1,
        message: "Attendance details fetched successfully",
        data: {
          overallPercentage: 0,
          classesAttended: 0,
          totalClasses: 0,
          currentStreak: 0,
          records: [],
          student: null,
          batch: null,
        },
      });
    }

    const row = userBatchRes.recordset[0];
    const batchId = explicitBatchId || (row.BATCH_ID ? Number(row.BATCH_ID) : null);

    const studentData = {
      USER_ID: row.USER_ID,
      USERNAME: row.USERNAME || "-",
      EMAIL_ID: row.EMAIL_ID || "-",
      MOBILE_NO: row.MOBILE_NO || "-",
      SCHOOL_NAME: row.SCHOOL_NAME || "-",
      GRADE: row.GRADE || "-",
      ADDRESS_LINE1: row.ADDRESS_LINE1 || "-",
      ADDRESS_LINE2: row.ADDRESS_LINE2 || "",
      CITY: row.CITY || "-",
      DISTRICT: row.DISTRICT || "-",
      STATE: row.STATE || "-",
      PINCODE: row.PINCODE || "-",
      LANDMARK: row.LANDMARK || "-",
      USER_TYPE: row.USER_TYPE || "STUDENT",
    };

    const batchData = batchId
      ? {
          ID: batchId,
          BATCH_CODE: row.BATCH_CODE || "-",
          BATCH_NAME: row.BATCH_NAME || "-",
          START_DATE: formatDateStr(row.START_DATE),
          END_DATE: formatDateStr(row.END_DATE),
          TUTOR_NAME: row.TUTOR_NAME || "Lead Instructor",
          STATUS: row.BATCH_IS_ACTIVE ? "ACTIVE" : "INACTIVE",
        }
      : null;

    if (!batchId) {
      return res.json({
        status: 1,
        message: "Attendance details fetched successfully",
        data: {
          overallPercentage: 0,
          classesAttended: 0,
          totalClasses: 0,
          currentStreak: 0,
          records: [],
          student: studentData,
          batch: null,
        },
      });
    }

    // 2. Fetch all scheduled classes for the student's batch
    const classesRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT 
          cs.ID AS CLASS_ID,
          cs.TOPIC,
          cs.CLASS_DATE,
          CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME,
          cs.BATCH_ID,
          cs.CREATED_AT
        FROM CLASS_SCHEDULES cs WITH (NOLOCK)
        WHERE cs.BATCH_ID = @BATCH_ID
        ORDER BY cs.CLASS_DATE ASC, cs.CLASS_TIME ASC, cs.ID ASC
      `);

    const assignedClasses = classesRes.recordset;

    // 3. Fetch attendance records for this student and batch
    const attRes = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT 
          ca.ID,
          ca.CLASS_ID,
          ca.BATCH_ID,
          ca.STUDENT_ID,
          ca.ATTENDANCE_STATUS,
          ca.REMARKS,
          ca.CREATED_AT,
          ca.UPDATED_AT,
          cs.TOPIC,
          cs.CLASS_DATE,
          CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME,
          b.BATCH_CODE,
          b.BATCH_NAME
        FROM CLASS_ATTENDANCE ca WITH (NOLOCK)
        INNER JOIN CLASS_SCHEDULES cs WITH (NOLOCK) ON ca.CLASS_ID = cs.ID
        LEFT JOIN BATCHES b WITH (NOLOCK) ON cs.BATCH_ID = b.ID
        WHERE ca.STUDENT_ID = @STUDENT_ID AND cs.BATCH_ID = @BATCH_ID
        ORDER BY cs.CLASS_DATE ASC, cs.CLASS_TIME ASC, cs.ID ASC
      `);

    const attendanceRecordsChronological = attRes.recordset;

    // Map attendance by CLASS_ID
    const attendanceByClassId = new Map();
    attendanceRecordsChronological.forEach((att) => {
      attendanceByClassId.set(att.CLASS_ID, att);
    });

    const todayStr = getTodayISTStr();

    // 4. Calculate Classes Attended (Numerator) and Eligible Classes (Denominator)
    let classesAttended = 0;
    let eligibleClasses = 0;

    assignedClasses.forEach((cls) => {
      const classDateStr = formatDateStr(cls.CLASS_DATE);
      const att = attendanceByClassId.get(cls.CLASS_ID);
      const hasAttendance = att !== undefined && att !== null;
      const status = hasAttendance ? Number(att.ATTENDANCE_STATUS) : null;

      // Count only Present records in numerator
      if (status === 1) {
        classesAttended++;
      }

      // Denominator: class has reached today or in the past (or has attendance marked)
      const isEligible =
        hasAttendance || (classDateStr && classDateStr <= todayStr);
      if (isEligible) {
        eligibleClasses++;
      }
    });

    // OVERALL PERCENTAGE: (ATTENDED_CLASSES / ELIGIBLE_CLASSES) * 100
    const overallPercentage =
      eligibleClasses > 0
        ? Math.round((classesAttended / eligibleClasses) * 100)
        : 0;

    // Build formatted records for all scheduled classes (most recent classes first)
    // Every scheduled class is shown. If not marked, status is null / "Not Marked"
    const formattedRecords = assignedClasses
      .map((cls) => {
        const att = attendanceByClassId.get(cls.CLASS_ID);
        const hasAttendance = att !== undefined && att !== null;
        const status = hasAttendance ? Number(att.ATTENDANCE_STATUS) : null;
        return {
          ID: att?.ID || cls.CLASS_ID,
          CLASS_ID: cls.CLASS_ID,
          BATCH_ID: batchId,
          STUDENT_ID: sId,
          TOPIC: cls.TOPIC || "-",
          CLASS_DATE: formatDateStr(cls.CLASS_DATE),
          CLASS_TIME: formatTimeStr(cls.CLASS_TIME),
          ATTENDANCE_STATUS: status, // null: Not Marked, 1: Present, 0: Absent
          STATUS_TEXT: hasAttendance
            ? status === 1
              ? "Present"
              : "Absent"
            : "Not Marked",
          REMARKS: att?.REMARKS || null,
          BATCH_CODE: row.BATCH_CODE || "-",
          BATCH_NAME: row.BATCH_NAME || "-",
          START_DATE: formatDateStr(row.START_DATE),
          END_DATE: formatDateStr(row.END_DATE),
          USERNAME: row.USERNAME || "-",
          EMAIL_ID: row.EMAIL_ID || "-",
          MOBILE_NO: row.MOBILE_NO || "-",
        };
      })
      .reverse();

    // CURRENT STREAK: from most recent class backwards
    let currentStreak = 0;
    for (const rec of formattedRecords) {
      if (rec.ATTENDANCE_STATUS === 1) {
        currentStreak++;
      } else if (rec.ATTENDANCE_STATUS === 0) {
        break;
      } else if (currentStreak > 0) {
        break;
      }
    }

    return res.json({
      status: 1,
      message: "Attendance details fetched successfully",
      data: {
        overallPercentage,
        classesAttended,
        totalClasses: eligibleClasses,
        currentStreak,
        records: formattedRecords,
        student: studentData,
        batch: batchData,
      },
    });
  } catch (error) {
    console.error("getStudentAttendance error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// Get Date-wise Student Attendance for a Batch
const getBatchAttendanceByDate = async (req, res) => {
  try {
    const rawBatchId =
      req.query.batchId ||
      req.query.batch_id ||
      req.query.batchID ||
      req.params.batchId;
    const batchId = Number(rawBatchId);

    if (!batchId || isNaN(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch ID is required",
      });
    }

    const rawClassId =
      req.query.classId ||
      req.query.class_id ||
      req.query.sessionId ||
      req.query.session_id ||
      req.query.CLASS_ID;
    const classId = rawClassId ? Number(rawClassId) : null;

    const rawDate =
      req.query.date ||
      req.query.attendance_date ||
      req.query.attendanceDate;

    // Normalize date to YYYY-MM-DD if date is provided
    let normalizedDate = null;
    if (rawDate) {
      const dateStr = String(rawDate).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        normalizedDate = dateStr;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split("-");
        normalizedDate = `${y}-${m}-${d}`;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split("/");
        normalizedDate = `${y}-${m}-${d}`;
      } else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          normalizedDate = `${y}-${m}-${day}`;
        }
      }
    }

    if (!classId && !normalizedDate) {
      return res.status(400).json({
        status: 0,
        message: "Either class ID (sessionId) or attendance date is required",
      });
    }

    let pool = getPool();
    if (!pool || !pool.connected) {
      pool = await connectDB();
    }

    const rawUserId = req.query.userId || req.headers["x-user-id"];
    const rawUserType = req.query.userType || req.query.role;
    const callerId = rawUserId ? Number(rawUserId) : null;
    let callerType = rawUserType ? String(rawUserType).trim().toUpperCase() : null;

    if (callerId && !callerType) {
      const userRes = await pool
        .request()
        .input("USER_ID", sql.Int, callerId)
        .query(`SELECT USER_TYPE FROM USERS WHERE USER_ID = @USER_ID`);
      if (userRes.recordset.length > 0) {
        callerType = String(userRes.recordset[0].USER_TYPE || "").trim().toUpperCase();
      }
    }

    // Authorization check for TUTOR (both HOST and SUPPORT tutors are authorized for assigned batches)
    if (callerType === "TUTOR" && callerId) {
      const authCheck = await pool
        .request()
        .input("BATCH_ID", sql.Int, batchId)
        .input("USER_ID", sql.Int, callerId)
        .query(`
          SELECT TOP 1 1
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE ta.BATCH_ID = @BATCH_ID
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
            AND (
              TRY_CONVERT(INT, t.role) IN (1, 2)
              OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT')
            )
        `);

      if (authCheck.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to view attendance for this batch",
        });
      }
    }

    let result;
    if (classId) {
      // Query attendance for specific class / session
      result = await pool
        .request()
        .input("BATCH_ID", sql.Int, batchId)
        .input("CLASS_ID", sql.Int, classId)
        .query(`
          SELECT 
            u.USER_ID AS STUDENT_ID,
            u.USERNAME,
            u.EMAIL_ID,
            u.SCHOOL_NAME,
            u.GRADE,
            u.IS_ACTIVE,
            ca.ATTENDANCE_STATUS,
            ca.REMARKS,
            cs.ID AS CLASS_ID,
            cs.TOPIC AS CLASS_TOPIC,
            cs.CLASS_DATE,
            CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME
          FROM STUDENT_ALLOCATIONS sa
          INNER JOIN USERS u ON sa.STUDENT_ID = u.USER_ID
          LEFT JOIN CLASS_ATTENDANCE ca 
            ON ca.STUDENT_ID = u.USER_ID AND ca.CLASS_ID = @CLASS_ID AND ca.BATCH_ID = @BATCH_ID
          LEFT JOIN CLASS_SCHEDULES cs ON cs.ID = @CLASS_ID
          WHERE sa.BATCH_ID = @BATCH_ID
            AND (u.USER_TYPE IS NULL OR UPPER(u.USER_TYPE) = 'STUDENT')
          ORDER BY u.USERNAME ASC
        `);
    } else {
      // Query attendance by date
      result = await pool
        .request()
        .input("BATCH_ID", sql.Int, batchId)
        .input("ATTENDANCE_DATE", sql.Date, normalizedDate)
        .query(`
          SELECT 
            u.USER_ID AS STUDENT_ID,
            u.USERNAME,
            u.EMAIL_ID,
            u.SCHOOL_NAME,
            u.GRADE,
            u.IS_ACTIVE,
            ca.ATTENDANCE_STATUS,
            ca.REMARKS,
            cs.ID AS CLASS_ID,
            cs.TOPIC AS CLASS_TOPIC
          FROM STUDENT_ALLOCATIONS sa
          INNER JOIN USERS u ON sa.STUDENT_ID = u.USER_ID
          LEFT JOIN (
            SELECT 
              ca_inner.STUDENT_ID,
              ca_inner.BATCH_ID,
              ca_inner.CLASS_ID,
              ca_inner.ATTENDANCE_STATUS,
              ca_inner.REMARKS,
              ROW_NUMBER() OVER(PARTITION BY ca_inner.STUDENT_ID ORDER BY ca_inner.ID DESC) as rn
            FROM CLASS_ATTENDANCE ca_inner
            LEFT JOIN CLASS_SCHEDULES cs_inner ON ca_inner.CLASS_ID = cs_inner.ID
            WHERE (ca_inner.BATCH_ID = @BATCH_ID OR cs_inner.BATCH_ID = @BATCH_ID)
              AND (
                cs_inner.CLASS_DATE = @ATTENDANCE_DATE
                OR (cs_inner.CLASS_DATE IS NULL AND CAST(ca_inner.CREATED_AT AS DATE) = @ATTENDANCE_DATE)
              )
          ) ca ON ca.STUDENT_ID = u.USER_ID AND ca.rn = 1
          LEFT JOIN CLASS_SCHEDULES cs ON cs.ID = ca.CLASS_ID
          WHERE sa.BATCH_ID = @BATCH_ID
            AND (u.USER_TYPE IS NULL OR UPPER(u.USER_TYPE) = 'STUDENT')
          ORDER BY u.USERNAME ASC
        `);
    }

    const studentsAttendance = result.recordset.map((row) => ({
      STUDENT_ID: row.STUDENT_ID,
      USER_ID: row.STUDENT_ID,
      USERNAME: row.USERNAME,
      EMAIL_ID: row.EMAIL_ID,
      SCHOOL_NAME: row.SCHOOL_NAME,
      ATTENDANCE_STATUS:
        row.ATTENDANCE_STATUS === 1
          ? 1
          : row.ATTENDANCE_STATUS === 0
          ? 0
          : null,
      STATUS_TEXT:
        row.ATTENDANCE_STATUS === 1
          ? "Present"
          : row.ATTENDANCE_STATUS === 0
          ? "Absent"
          : "Not Marked",
      REMARKS: row.REMARKS || null,
      CLASS_ID: row.CLASS_ID || null,
      CLASS_TOPIC: row.CLASS_TOPIC || null,
    }));

    return res.json({
      status: 1,
      data: {
        batchId,
        classId: classId || null,
        date: normalizedDate,
        attendance: studentsAttendance,
      },
    });
  } catch (err) {
    console.error("getBatchAttendanceByDate error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

module.exports = {
  getInitialAttendanceData,
  submitAttendance,
  getStudentAttendance,
  getBatchAttendanceByDate,
};
