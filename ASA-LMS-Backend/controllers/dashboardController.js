const sql = require("mssql");
const { getPool } = require("../config/database");

const getDashboardData = async (req, res) => {
  try {
    const pool = getPool();

    // 1. Overall Aggregated KPI Counts
    const metricsResult = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'STUDENT') AS totalStudents,
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'STUDENT' AND ISNULL(IS_ACTIVE, 1) = 1) AS activeStudents,
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'STUDENT' AND IS_ACTIVE = 0) AS inactiveStudents,
        
        (SELECT COUNT(*) FROM BATCHES) AS totalBatches,
        (SELECT COUNT(*) FROM BATCHES WHERE ISNULL(IS_ACTIVE, 1) = 1) AS activeBatches,
        (SELECT COUNT(*) FROM BATCHES WHERE IS_ACTIVE = 0) AS inactiveBatches,
        
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'TUTOR') AS totalTutors,
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'TUTOR' AND ISNULL(IS_ACTIVE, 1) = 1) AS activeTutors,
        (SELECT COUNT(*) FROM USERS WHERE UPPER(USER_TYPE) = 'TUTOR' AND IS_ACTIVE = 0) AS inactiveTutors,
        
        (SELECT COUNT(*) FROM CLASS_SCHEDULES WHERE ISNULL(IS_ACTIVE, 1) = 1) AS totalClasses,
        (SELECT COUNT(*) FROM CLASS_SCHEDULES WHERE ISNULL(IS_ACTIVE, 1) = 1 AND CLASS_DATE >= CAST(GETDATE() AS DATE)) AS upcomingClassesCount,
        (SELECT COUNT(*) FROM ASSIGNMENT_ALERTS) AS totalAssignments,
        (SELECT COUNT(*) FROM FINAL_ASSESSMENTS) AS totalAssessments,
        
        (SELECT COUNT(*) FROM CLASS_ATTENDANCE WHERE ATTENDANCE_STATUS = 1) AS presentAttendance,
        (SELECT COUNT(*) FROM CLASS_ATTENDANCE) AS totalAttendance,
        (SELECT COUNT(*) FROM USERS u WHERE UPPER(u.USER_TYPE) = 'STUDENT' AND NOT EXISTS (SELECT 1 FROM STUDENT_ALLOCATIONS sa WHERE sa.STUDENT_ID = u.USER_ID)) AS unassignedStudentsCount
    `);

    const counts = metricsResult.recordset[0] || {};
    const totalAtt = Number(counts.totalAttendance || 0);
    const presentAtt = Number(counts.presentAttendance || 0);
    const avgAttendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

    // 2. Batches Performance & Health Breakdown
    const batchesResult = await pool.request().query(`
      SELECT
        b.ID,
        b.BATCH_CODE,
        b.START_DATE,
        b.END_DATE,
        b.IS_ACTIVE,
        (SELECT COUNT(DISTINCT sa.STUDENT_ID) FROM STUDENT_ALLOCATIONS sa WHERE sa.BATCH_ID = b.ID) AS TOTAL_STUDENTS,
        (SELECT COUNT(DISTINCT cs.ID) FROM CLASS_SCHEDULES cs WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1) AS CLASS_COUNT,
        (SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID) FROM ASSIGNMENT_ALERTS aa WHERE aa.BATCH_ID = b.ID) AS ASSIGNMENT_COUNT,
        (SELECT COUNT(*) FROM CLASS_ATTENDANCE ca WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 1) AS PRESENT_COUNT,
        (SELECT COUNT(*) FROM CLASS_ATTENDANCE ca WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 0) AS ABSENT_COUNT,
        (
          SELECT TOP 1 u.USERNAME
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId', role NVARCHAR(50) '$.role') t
          INNER JOIN USERS u ON u.USER_ID = t.tutorId
          WHERE ta.BATCH_ID = b.ID AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
        ) AS HOST_TUTOR,
        (
          SELECT COUNT(DISTINCT t.tutorId)
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId') t
          WHERE ta.BATCH_ID = b.ID
        ) AS TUTORS_COUNT
      FROM BATCHES b
      ORDER BY b.ID DESC
    `);

    const batchesList = (batchesResult.recordset || []).map((b) => {
      const bTotalAtt = Number(b.PRESENT_COUNT || 0) + Number(b.ABSENT_COUNT || 0);
      const bPresent = Number(b.PRESENT_COUNT || 0);
      const attPct = bTotalAtt > 0 ? Math.round((bPresent / bTotalAtt) * 100) : 0;
      
      // Calculate realistic batch progress based on classes and assignments conducted
      const classProgress = Math.min(100, Math.round((Number(b.CLASS_COUNT || 0) / 10) * 100));
      const assignmentProgress = Math.min(100, Math.round((Number(b.ASSIGNMENT_COUNT || 0) / 5) * 100));
      const completionPct = Math.max(classProgress, assignmentProgress, bTotalAtt > 0 ? attPct : 0);

      return {
        ID: b.ID,
        BATCH_CODE: b.BATCH_CODE,
        START_DATE: b.START_DATE,
        END_DATE: b.END_DATE,
        IS_ACTIVE: b.IS_ACTIVE === 1 || b.IS_ACTIVE === true,
        TOTAL_STUDENTS: Number(b.TOTAL_STUDENTS || 0),
        CLASS_COUNT: Number(b.CLASS_COUNT || 0),
        ASSIGNMENT_COUNT: Number(b.ASSIGNMENT_COUNT || 0),
        PRESENT_COUNT: Number(b.PRESENT_COUNT || 0),
        ABSENT_COUNT: Number(b.ABSENT_COUNT || 0),
        ATTENDANCE_PCT: attPct,
        COMPLETION_PCT: completionPct,
        HOST_TUTOR: b.HOST_TUTOR || "Unassigned",
        TUTORS_COUNT: Number(b.TUTORS_COUNT || 0),
      };
    });

    // 3. Upcoming Scheduled Classes across ALL batches
    const upcomingResult = await pool.request().query(`
      SELECT TOP 10
        cs.ID,
        cs.TOPIC,
        FORMAT(cs.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
        FORMAT(cs.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
        FORMAT(cs.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
        CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME,
        cs.MEET_LINK,
        cs.BATCH_ID,
        b.BATCH_CODE,
        COALESCE(
          (SELECT TOP 1 u.USERNAME FROM USERS u WHERE u.USER_ID = cs.TUTOR_ID),
          (
            SELECT TOP 1 u.USERNAME
            FROM TUTOR_ALLOCATIONS ta
            CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
            WITH (tutorId INT '$.tutorId', role NVARCHAR(50) '$.role') t
            INNER JOIN USERS u ON u.USER_ID = t.tutorId
            WHERE ta.BATCH_ID = cs.BATCH_ID AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
          ),
          'Assigned Tutor'
        ) AS TUTOR_NAME
      FROM CLASS_SCHEDULES cs
      INNER JOIN BATCHES b ON b.ID = cs.BATCH_ID
      WHERE cs.IS_ACTIVE = 1
        AND b.IS_ACTIVE = 1
      ORDER BY cs.CLASS_DATE ASC, cs.CLASS_TIME ASC
    `);

    const upcomingClasses = (upcomingResult.recordset || []).map((c) => ({
      ID: c.ID,
      TOPIC: c.TOPIC,
      CLASS_DATE: c.CLASS_DATE,
      CLASS_TIME: c.CLASS_TIME,
      MEET_LINK: c.MEET_LINK || null,
      BATCH_ID: c.BATCH_ID,
      BATCH_CODE: c.BATCH_CODE,
      TUTOR_NAME: c.TUTOR_NAME,
    }));

    // 4. Unassigned Students / Enrollment Queue
    const unassignedResult = await pool.request().query(`
      SELECT TOP 10
        u.USER_ID,
        u.USERNAME,
        u.EMAIL_ID,
        u.MOBILE_NO,
        u.DISTRICT,
        u.STATE,
        u.CREATED_AT
      FROM USERS u
      WHERE UPPER(u.USER_TYPE) = 'STUDENT'
        AND NOT EXISTS (SELECT 1 FROM STUDENT_ALLOCATIONS sa WHERE sa.STUDENT_ID = u.USER_ID)
      ORDER BY u.USER_ID DESC
    `);

    const enrollmentQueue = (unassignedResult.recordset || []).map((st) => ({
      USER_ID: st.USER_ID,
      USERNAME: st.USERNAME,
      EMAIL_ID: st.EMAIL_ID,
      MOBILE_NO: st.MOBILE_NO,
      DISTRICT: st.DISTRICT,
      STATE: st.STATE,
      CREATED_AT: st.CREATED_AT,
    }));

    // 5. Tutor Roster with assigned batches
    const tutorsResult = await pool.request().query(`
      SELECT
        u.USER_ID,
        u.USERNAME,
        u.EMAIL_ID,
        u.MOBILE_NO,
        u.IS_ACTIVE,
        (
          SELECT COUNT(DISTINCT ta.BATCH_ID)
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId') t
          WHERE t.tutorId = u.USER_ID
        ) AS ASSIGNED_BATCHES_COUNT,
        (
          SELECT STRING_AGG(b.BATCH_CODE, ', ')
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId') t
          INNER JOIN BATCHES b ON b.ID = ta.BATCH_ID
          WHERE t.tutorId = u.USER_ID
        ) AS ASSIGNED_BATCH_CODES
      FROM USERS u
      WHERE UPPER(u.USER_TYPE) = 'TUTOR'
      ORDER BY u.USER_ID DESC
    `);

    const tutorRoster = (tutorsResult.recordset || []).map((t) => ({
      USER_ID: t.USER_ID,
      USERNAME: t.USERNAME,
      EMAIL_ID: t.EMAIL_ID,
      MOBILE_NO: t.MOBILE_NO,
      IS_ACTIVE: t.IS_ACTIVE === 1 || t.IS_ACTIVE === true,
      ASSIGNED_BATCHES_COUNT: Number(t.ASSIGNED_BATCHES_COUNT || 0),
      ASSIGNED_BATCH_CODES: t.ASSIGNED_BATCH_CODES || "None",
    }));

    // 6. Recent Announcements
    const annResult = await pool.request().query(`
      SELECT TOP 5
        ba.ID,
        ba.TITLE,
        ba.MESSAGE,
        ba.CREATED_AT,
        b.BATCH_CODE
      FROM BATCH_ANNOUNCEMENTS ba
      LEFT JOIN BATCHES b ON b.ID = ba.BATCH_ID
      ORDER BY ba.ID DESC
    `);

    const announcements = (annResult.recordset || []).map((a) => ({
      ID: a.ID,
      TITLE: a.TITLE,
      MESSAGE: a.MESSAGE,
      CREATED_AT: a.CREATED_AT,
      BATCH_CODE: a.BATCH_CODE || "ALL BATCHES",
    }));

    // 7. Recent Notifications / Activity Feed
    const notifResult = await pool.request().query(`
      SELECT TOP 8
        n.NOTIFICATION_ID,
        n.TITLE,
        n.MESSAGE,
        n.AUDIENCE,
        n.SENDER_TYPE,
        n.CREATED_AT,
        b.BATCH_CODE
      FROM NOTIFICATIONS n
      LEFT JOIN BATCHES b ON b.ID = n.BATCH_ID
      ORDER BY n.NOTIFICATION_ID DESC
    `);

    const recentActivities = (notifResult.recordset || []).map((n) => ({
      ID: n.NOTIFICATION_ID,
      TITLE: n.TITLE,
      MESSAGE: n.MESSAGE,
      AUDIENCE: n.AUDIENCE,
      SENDER_TYPE: n.SENDER_TYPE,
      CREATED_AT: n.CREATED_AT,
      BATCH_CODE: n.BATCH_CODE || "GENERAL",
    }));

    // Overall Completion Rate across LMS
    const overallCompletionRate =
      batchesList.length > 0
        ? Math.round(
            batchesList.reduce((sum, b) => sum + b.COMPLETION_PCT, 0) /
              batchesList.length
          )
        : avgAttendancePct;

    const data = {
      totalStudents: Number(counts.totalStudents || 0),
      activeStudents: Number(counts.activeStudents || 0),
      inactiveStudents: Number(counts.inactiveStudents || 0),
      totalBatches: Number(counts.totalBatches || 0),
      activeBatches: Number(counts.activeBatches || 0),
      inactiveBatches: Number(counts.inactiveBatches || 0),
      totalTutors: Number(counts.totalTutors || 0),
      activeTutors: Number(counts.activeTutors || 0),
      inactiveTutors: Number(counts.inactiveTutors || 0),
      totalClasses: Number(counts.totalClasses || 0),
      upcomingClassesCount: Number(counts.upcomingClassesCount || 0),
      totalAssignments: Number(counts.totalAssignments || 0),
      totalAssessments: Number(counts.totalAssessments || 0),
      presentAttendance: presentAtt,
      totalAttendance: totalAtt,
      avgAttendancePct,
      completionRate: `${overallCompletionRate}%`,
      unassignedStudentsCount: Number(counts.unassignedStudentsCount || 0),
      batches: batchesList,
      upcomingClasses,
      enrollmentQueue,
      tutorRoster,
      announcements,
      recentActivities,
    };

    return res.json({
      status: 1,
      data,
    });
  } catch (err) {
    console.error("getDashboardData error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

module.exports = {
  getDashboardData,
};
