const sql = require("mssql");
const { getPool } = require("../config/database");

// GET all batches or Tutor's assigned batches (HOST & SUPPORT)
const getBatches = async (req, res) => {
  try {
    const pool = getPool();
    const rawTutorId = req.query.tutorId || req.query.tutor_id || req.query.userId || req.query.USER_ID;

    if (rawTutorId) {
      const tutorId = Number(rawTutorId);
      if (!Number.isInteger(tutorId) || tutorId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "Valid Tutor ID is required",
        });
      }

      // Security check: verify user is TUTOR
      const userCheck = await pool
        .request()
        .input("USER_ID", sql.Int, tutorId)
        .query(`SELECT USER_TYPE, IS_ACTIVE FROM USERS WHERE USER_ID = @USER_ID`);

      if (userCheck.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "User not found",
        });
      }

      const user = userCheck.recordset[0];
      if (user.IS_ACTIVE !== true && user.IS_ACTIVE !== 1) {
        return res.status(403).json({
          status: 0,
          message: "Your account is inactive",
        });
      }

      // Return ALL batches where tutor is assigned as HOST or SUPPORT
      const query = `
        SELECT
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
          FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
          FORMAT(b.START_DATE, 'dd MMM yyyy') AS START_DATE_FORMATTED,
          FORMAT(b.END_DATE, 'dd MMM yyyy') AS END_DATE_FORMATTED,
          b.IS_ACTIVE,
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
            ELSE 'SUPPORT'
          END AS TUTOR_ROLE,
          (
            SELECT COUNT(DISTINCT sa.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS sa
            WHERE sa.BATCH_ID = b.ID
          ) AS TOTAL_STUDENTS,
          (
            SELECT COUNT(DISTINCT sa.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS sa
            INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
            WHERE sa.BATCH_ID = b.ID AND ISNULL(u.IS_ACTIVE, 1) = 1
          ) AS ACTIVE_STUDENTS,
          (
            SELECT COUNT(DISTINCT sa.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS sa
            INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
            WHERE sa.BATCH_ID = b.ID AND u.IS_ACTIVE = 0
          ) AS INACTIVE_STUDENTS,
          (
            SELECT COUNT(DISTINCT cs.ID)
            FROM CLASS_SCHEDULES cs
            WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1
          ) AS CLASS_COUNT,
          (
            SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID)
            FROM ASSIGNMENT_ALERTS aa
            WHERE aa.BATCH_ID = b.ID
          ) AS ASSIGNMENT_COUNT,
          (
            SELECT COUNT(*)
            FROM CLASS_ATTENDANCE ca
            WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 1
          ) AS PRESENT_COUNT,
          (
            SELECT COUNT(*)
            FROM CLASS_ATTENDANCE ca
            WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 0
          ) AS ABSENT_COUNT,
          (
            SELECT COUNT(*)
            FROM CLASS_ATTENDANCE ca
            WHERE ca.BATCH_ID = b.ID
          ) AS TOTAL_ATTENDANCE_RECORDS,
          (
            SELECT TOP 5
              u.USER_ID,
              u.USERNAME,
              u.EMAIL_ID,
              u.GRADE,
              u.SCHOOL_NAME,
              u.IS_ACTIVE
            FROM STUDENT_ALLOCATIONS sa
            INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
            WHERE sa.BATCH_ID = b.ID
            ORDER BY u.USERNAME ASC
            FOR JSON PATH
          ) AS STUDENTS_PREVIEW,
          (
            SELECT TOP 4
              cs.ID,
              cs.TOPIC,
              FORMAT(cs.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE,
              DATENAME(dw, cs.CLASS_DATE) AS DAY_NAME,
              CONVERT(VARCHAR(5), cs.CLASS_TIME, 108) AS CLASS_TIME
            FROM CLASS_SCHEDULES cs
            WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1
            ORDER BY cs.CLASS_DATE ASC
            FOR JSON PATH
          ) AS SCHEDULES_PREVIEW,
          (
            SELECT TOP 4
              aa.ASSIGNMENT_ID AS ID,
              COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, 'Assignment #' + CAST(aa.ASSIGNMENT_ID AS VARCHAR(20))) AS TITLE,
              FORMAT(aa.CREATED_AT, 'dd MMM yyyy') AS CREATED_DATE
            FROM ASSIGNMENT_ALERTS aa
            LEFT JOIN QUESTION_TEMPLATES qt ON qt.ID = aa.SET_ID
            LEFT JOIN MODULES m ON m.ID = aa.MODULE_ID
            WHERE aa.BATCH_ID = b.ID
            ORDER BY aa.ASSIGNMENT_ID DESC
            FOR JSON PATH
          ) AS ASSIGNMENTS_PREVIEW
        FROM TUTOR_ALLOCATIONS ta
        INNER JOIN BATCHES b ON b.ID = ta.BATCH_ID
        CROSS APPLY OPENJSON(ta.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE b.IS_ACTIVE = 1
          AND ISJSON(ta.TUTOR_IDS) = 1
          AND t.tutorId = @USER_ID
        ORDER BY 
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 1 
            ELSE 2 
          END ASC,
          b.ID DESC
      `;

      const result = await pool
        .request()
        .input("USER_ID", sql.Int, tutorId)
        .query(query);

      // Parse JSON strings in result records
      const formattedData = result.recordset.map((batch) => {
        let studentsPreview = [];
        let schedulesPreview = [];
        let assignmentsPreview = [];
        try {
          if (batch.STUDENTS_PREVIEW) studentsPreview = JSON.parse(batch.STUDENTS_PREVIEW);
        } catch (e) {}
        try {
          if (batch.SCHEDULES_PREVIEW) schedulesPreview = JSON.parse(batch.SCHEDULES_PREVIEW);
        } catch (e) {}
        try {
          if (batch.ASSIGNMENTS_PREVIEW) assignmentsPreview = JSON.parse(batch.ASSIGNMENTS_PREVIEW);
        } catch (e) {}

        const presentCount = Number(batch.PRESENT_COUNT || 0);
        const absentCount = Number(batch.ABSENT_COUNT || 0);
        const totalAttendance = Number(batch.TOTAL_ATTENDANCE_RECORDS || 0);

        const presentPct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
        const absentPct = totalAttendance > 0 ? Math.round((absentCount / totalAttendance) * 100) : 0;

        return {
          ...batch,
          STUDENTS_PREVIEW: studentsPreview,
          SCHEDULES_PREVIEW: schedulesPreview,
          ASSIGNMENTS_PREVIEW: assignmentsPreview,
          PRESENT_PERCENTAGE: presentPct,
          ABSENT_PERCENTAGE: absentPct,
        };
      });

      return res.json({
        status: 1,
        data: formattedData,
      });
    }

    // Default / Admin behavior: get all batches with full metrics
    const result = await pool.request().query(`
      SELECT
        b.ID,
        b.BATCH_CODE,
        b.BATCH_NAME,
        FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
        FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
        FORMAT(b.START_DATE, 'dd MMM yyyy') AS START_DATE_FORMATTED,
        FORMAT(b.END_DATE, 'dd MMM yyyy') AS END_DATE_FORMATTED,
        b.IS_ACTIVE,
        (
          SELECT COUNT(DISTINCT sa.STUDENT_ID)
          FROM STUDENT_ALLOCATIONS sa
          WHERE sa.BATCH_ID = b.ID
        ) AS TOTAL_STUDENTS,
        (
          SELECT COUNT(DISTINCT sa.STUDENT_ID)
          FROM STUDENT_ALLOCATIONS sa
          WHERE sa.BATCH_ID = b.ID
        ) AS STUDENT_COUNT,
        (
          SELECT COUNT(DISTINCT sa.STUDENT_ID)
          FROM STUDENT_ALLOCATIONS sa
          INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
          WHERE sa.BATCH_ID = b.ID AND ISNULL(u.IS_ACTIVE, 1) = 1
        ) AS ACTIVE_STUDENTS,
        (
          SELECT COUNT(DISTINCT sa.STUDENT_ID)
          FROM STUDENT_ALLOCATIONS sa
          INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
          WHERE sa.BATCH_ID = b.ID AND u.IS_ACTIVE = 0
        ) AS INACTIVE_STUDENTS,
        (
          SELECT COUNT(DISTINCT cs.ID)
          FROM CLASS_SCHEDULES cs
          WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1
        ) AS CLASS_COUNT,
        (
          SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID)
          FROM ASSIGNMENT_ALERTS aa
          WHERE aa.BATCH_ID = b.ID
        ) AS ASSIGNMENT_COUNT,
        (
          SELECT COUNT(*)
          FROM CLASS_ATTENDANCE ca
          WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 1
        ) AS PRESENT_COUNT,
        (
          SELECT COUNT(*)
          FROM CLASS_ATTENDANCE ca
          WHERE ca.BATCH_ID = b.ID AND ca.ATTENDANCE_STATUS = 0
        ) AS ABSENT_COUNT,
        (
          SELECT COUNT(*)
          FROM CLASS_ATTENDANCE ca
          WHERE ca.BATCH_ID = b.ID
        ) AS TOTAL_ATTENDANCE_RECORDS,
        (
          SELECT TOP 5
            u.USER_ID,
            u.USERNAME,
            u.EMAIL_ID,
            u.GRADE,
            u.SCHOOL_NAME,
            u.IS_ACTIVE
          FROM STUDENT_ALLOCATIONS sa
          INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
          WHERE sa.BATCH_ID = b.ID
          ORDER BY u.USERNAME ASC
          FOR JSON PATH
        ) AS STUDENTS_PREVIEW,
        (
          SELECT TOP 4
            cs.ID,
            cs.TOPIC,
            FORMAT(cs.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE,
            DATENAME(dw, cs.CLASS_DATE) AS DAY_NAME,
            CONVERT(VARCHAR(5), cs.CLASS_TIME, 108) AS CLASS_TIME
          FROM CLASS_SCHEDULES cs
          WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1
          ORDER BY cs.CLASS_DATE ASC
          FOR JSON PATH
        ) AS SCHEDULES_PREVIEW,
        (
          SELECT TOP 4
            aa.ASSIGNMENT_ID AS ID,
            COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, 'Assignment #' + CAST(aa.ASSIGNMENT_ID AS VARCHAR(20))) AS TITLE,
            FORMAT(aa.CREATED_AT, 'dd MMM yyyy') AS CREATED_DATE
          FROM ASSIGNMENT_ALERTS aa
          LEFT JOIN QUESTION_TEMPLATES qt ON qt.ID = aa.SET_ID
          LEFT JOIN MODULES m ON m.ID = aa.MODULE_ID
          WHERE aa.BATCH_ID = b.ID
          ORDER BY aa.ASSIGNMENT_ID DESC
          FOR JSON PATH
        ) AS ASSIGNMENTS_PREVIEW
      FROM BATCHES b
      ORDER BY b.ID DESC
    `);

    // Parse JSON strings in result records
    const formattedData = result.recordset.map((batch) => {
      let studentsPreview = [];
      let schedulesPreview = [];
      let assignmentsPreview = [];
      try {
        if (batch.STUDENTS_PREVIEW) studentsPreview = JSON.parse(batch.STUDENTS_PREVIEW);
      } catch (e) {}
      try {
        if (batch.SCHEDULES_PREVIEW) schedulesPreview = JSON.parse(batch.SCHEDULES_PREVIEW);
      } catch (e) {}
      try {
        if (batch.ASSIGNMENTS_PREVIEW) assignmentsPreview = JSON.parse(batch.ASSIGNMENTS_PREVIEW);
      } catch (e) {}

      const presentCount = Number(batch.PRESENT_COUNT || 0);
      const absentCount = Number(batch.ABSENT_COUNT || 0);
      const totalAttendance = Number(batch.TOTAL_ATTENDANCE_RECORDS || 0);

      const presentPct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
      const absentPct = totalAttendance > 0 ? Math.round((absentCount / totalAttendance) * 100) : 0;

      return {
        ...batch,
        STUDENTS_PREVIEW: studentsPreview,
        SCHEDULES_PREVIEW: schedulesPreview,
        ASSIGNMENTS_PREVIEW: assignmentsPreview,
        PRESENT_PERCENTAGE: presentPct,
        ABSENT_PERCENTAGE: absentPct,
      };
    });

    res.json({
      status: 1,
      data: formattedData,
    });
  } catch (err) {
    console.error("getBatches error:", err);
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// GET single batch details with tutors, students, classes, and schedule
const getBatchDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const rawTutorId = req.query.tutorId || req.query.tutor_id || req.query.userId || req.query.USER_ID;
    const batchId = Number(id);

    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch ID is required",
      });
    }

    const pool = getPool();

    // If request specifies tutorId or is from a tutor, validate tutor allocation (HOST or SUPPORT)
    if (rawTutorId) {
      const tutorId = Number(rawTutorId);
      const accessCheck = await pool
        .request()
        .input("USER_ID", sql.Int, tutorId)
        .input("BATCH_ID", sql.Int, batchId)
        .query(`
          SELECT 
            CASE 
              WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
              ELSE 'SUPPORT'
            END AS TUTOR_ROLE
          FROM TUTOR_ALLOCATIONS ta
          INNER JOIN BATCHES b ON b.ID = ta.BATCH_ID
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE b.ID = @BATCH_ID
            AND b.IS_ACTIVE = 1
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
        `);

      if (accessCheck.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You don't have access to this batch.",
        });
      }
    }

    // 1. Fetch batch overview
    const batchResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
          FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
          FORMAT(b.START_DATE, 'dd MMM yyyy') AS START_DATE_FORMATTED,
          FORMAT(b.END_DATE, 'dd MMM yyyy') AS END_DATE_FORMATTED,
          FORMAT(b.START_DATE, 'yyyy-MM-dd') AS ISO_START_DATE,
          FORMAT(b.END_DATE, 'yyyy-MM-dd') AS ISO_END_DATE,
          b.START_DATE AS RAW_START_DATE,
          b.END_DATE AS RAW_END_DATE,
          b.IS_ACTIVE,
          (
            SELECT COUNT(DISTINCT sa.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS sa
            WHERE sa.BATCH_ID = b.ID
          ) AS TOTAL_STUDENTS,
          (
            SELECT COUNT(DISTINCT cs.ID)
            FROM CLASS_SCHEDULES cs
            WHERE cs.BATCH_ID = b.ID AND ISNULL(cs.IS_ACTIVE, 1) = 1
          ) AS CLASS_COUNT,
          (
            SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID)
            FROM ASSIGNMENT_ALERTS aa
            WHERE aa.BATCH_ID = b.ID
          ) AS ASSIGNMENT_COUNT
        FROM BATCHES b
        WHERE b.ID = @BATCH_ID
      `);

    if (batchResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Batch not found",
      });
    }

    const batch = batchResult.recordset[0];

    // 2. Fetch assigned tutors with roles (HOST / SUPPORT)
    const tutorsResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT 
          u.USER_ID,
          u.USER_ID AS TUTOR_ID,
          u.USERNAME AS TUTOR_NAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          u.IS_ACTIVE,
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
            ELSE 'SUPPORT'
          END AS ROLE
        FROM TUTOR_ALLOCATIONS ta
        CROSS APPLY OPENJSON(ta.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        INNER JOIN USERS u ON u.USER_ID = t.tutorId
        WHERE ta.BATCH_ID = @BATCH_ID
          AND ISJSON(ta.TUTOR_IDS) = 1
        ORDER BY 
          CASE WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 1 ELSE 2 END ASC,
          u.USERNAME ASC
      `);

    // 3. Fetch assigned students
    const studentsResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          u.USER_ID,
          u.USER_ID AS STUDENT_ID,
          u.USERNAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          u.SCHOOL_NAME,
          u.GRADE,
          u.IS_ACTIVE
        FROM STUDENT_ALLOCATIONS sa
        INNER JOIN USERS u ON u.USER_ID = sa.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
          AND (u.USER_TYPE IS NULL OR UPPER(u.USER_TYPE) = 'STUDENT')
        ORDER BY u.USERNAME ASC
      `);

    // 4. Fetch scheduled classes with tutor names
    const classesResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          cs.ID,
          cs.TOPIC,
          FORMAT(cs.CLASS_DATE, 'dd-MM-yyyy') AS CLASS_DATE,
          FORMAT(cs.CLASS_DATE, 'yyyy-MM-dd') AS ISO_CLASS_DATE,
          FORMAT(cs.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
          CONVERT(VARCHAR(8), cs.CLASS_TIME, 108) AS CLASS_TIME,
          CONVERT(VARCHAR(5), cs.CLASS_TIME, 108) AS START_TIME,
          CONVERT(VARCHAR(5), DATEADD(HOUR, 1, CAST(cs.CLASS_TIME AS DATETIME)), 108) AS END_TIME,
          cs.MEET_LINK,
          cs.IS_ACTIVE,
          cs.TUTOR_ID,
          COALESCE(u_tutor.USERNAME, 'Unassigned') AS TUTOR_NAME
        FROM CLASS_SCHEDULES cs
        LEFT JOIN USERS u_tutor ON u_tutor.USER_ID = cs.TUTOR_ID
        WHERE cs.BATCH_ID = @BATCH_ID
        ORDER BY cs.CLASS_DATE DESC, cs.CLASS_TIME DESC
      `);

    // 5. Fetch assignments associated with this batch
    const assignmentsResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          aa.ASSIGNMENT_ID AS ID,
          COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, 'Assignment #' + CAST(aa.ASSIGNMENT_ID AS VARCHAR(20))) AS TITLE,
          COALESCE(cs.TOPIC, m.MODULE_NAME, aa.ASSESSMENT_TYPE, 'Class Assignment') AS DESCRIPTION,
          FORMAT(aa.CREATED_AT, 'dd-MM-yyyy') AS CREATED_DATE,
          aa.ASSESSMENT_TYPE
        FROM ASSIGNMENT_ALERTS aa
        LEFT JOIN QUESTION_TEMPLATES qt ON qt.ID = aa.SET_ID
        LEFT JOIN MODULES m ON m.ID = aa.MODULE_ID
        LEFT JOIN CLASS_SCHEDULES cs ON cs.ID = aa.CLASS_ID
        WHERE aa.BATCH_ID = @BATCH_ID
        ORDER BY aa.ASSIGNMENT_ID DESC
      `);

    // 6. Fetch attendance summary
    const attResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          COUNT(*) AS TOTAL_RECORDS,
          SUM(CASE WHEN ATTENDANCE_STATUS = 1 THEN 1 ELSE 0 END) AS PRESENT_COUNT,
          SUM(CASE WHEN ATTENDANCE_STATUS = 0 THEN 1 ELSE 0 END) AS ABSENT_COUNT
        FROM CLASS_ATTENDANCE
        WHERE BATCH_ID = @BATCH_ID
      `);

    const attRow = attResult.recordset[0] || {};
    const totalAtt = Number(attRow.TOTAL_RECORDS || 0);
    const presentCount = Number(attRow.PRESENT_COUNT || 0);
    const absentCount = Number(attRow.ABSENT_COUNT || 0);
    const presentPct = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 0;
    const absentPct = totalAtt > 0 ? Math.round((absentCount / totalAtt) * 100) : 0;

    return res.json({
      status: 1,
      data: {
        ...batch,
        tutors: tutorsResult.recordset,
        students: studentsResult.recordset,
        classes: classesResult.recordset,
        assignments: assignmentsResult.recordset,
        attendance: {
          total: totalAtt,
          present: presentCount,
          absent: absentCount,
          presentPercentage: presentPct,
          absentPercentage: absentPct,
        },
      },
    });
  } catch (err) {
    console.error("getBatchDetails error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// ADD batch
const addBatch = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    console.log(req.body);

    const {
      BATCH_CODE,
      BATCH_NAME,
      START_DATE,
      END_DATE
    } = req.body;

    const resolvedBatchName = BATCH_NAME || BATCH_CODE;

    await transaction.begin();

    // 1. Insert Batch
    const batchResult = await transaction
      .request()
      .input("batchCode", BATCH_CODE)
      .input("batchName", resolvedBatchName)
      .input("startDate", START_DATE)
      .input("endDate", END_DATE)
      .query(`
        INSERT INTO BATCHES
        (
          BATCH_CODE,
          BATCH_NAME,
          START_DATE,
          END_DATE,
          IS_ACTIVE
        )
        OUTPUT INSERTED.ID
        VALUES
        (
          @batchCode,
          @batchName,
          @startDate,
          @endDate,
          1
        )
      `);

    // Get newly created Batch ID
    const batchId = batchResult.recordset[0].ID;

    console.log("Created Batch ID:", batchId);

    // 2. Create Chat Room
    await transaction
      .request()
      .input("BATCH_ID", batchId)
      .input(
        "ROOM_NAME",
        BATCH_CODE
      )
      .query(`
        INSERT INTO CHAT_ROOMS
        (
          BATCH_ID,
          ROOM_NAME,
          IS_ACTIVE,
          CREATED_AT
        )
        VALUES
        (
          @BATCH_ID,
          @ROOM_NAME,
          1,
          GETDATE()
        )
      `);

    // 3. Commit transaction
    await transaction.commit();

    res.json({
      status: 1,
      message: "Batch and chat room created successfully",
      batchId: batchId
    });

  } catch (err) {

    console.error("Add Batch Error:", err);

    // Rollback if anything fails
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Rollback Error:", rollbackError);
    }

    res.status(500).json({
      status: 0,
      message: err.message
    });
  }
};

// UPDATE batch
const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { BATCH_CODE, BATCH_NAME, START_DATE, END_DATE } = req.body;
    const resolvedBatchName = BATCH_NAME || BATCH_CODE;

    const pool = getPool();

    await pool
      .request()
      .input("id", id)
      .input("BATCH_CODE", BATCH_CODE)
      .input("BATCH_NAME", resolvedBatchName)
      .input("START_DATE", START_DATE)
      .input("END_DATE", END_DATE).query(`
        UPDATE BATCHES SET
          BATCH_CODE = @BATCH_CODE,
          BATCH_NAME = COALESCE(@BATCH_NAME, BATCH_NAME, @BATCH_CODE),
          START_DATE = @START_DATE,
          END_DATE = @END_DATE,
          UPDATED_AT = GETDATE()
        WHERE ID = @id
      `);

    res.json({
      status: 1,
      message: "Batch updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
const updateBatchStatus = async (req, res) => {
    const pool = getPool();

    try {
        const { id } = req.params;
        const { isActive, force } = req.body;

        console.log("Batch ID:", id);
        console.log("Received isActive:", isActive);
        console.log("Force:", force);

        // =====================================================
        // CHECK BATCH
        // =====================================================

        const batchResult = await pool
            .request()
            .input("id", id)
            .query(`
                SELECT
                    ID,
                    BATCH_CODE,
                    BATCH_NAME,
                    IS_ACTIVE
                FROM BATCHES
                WHERE ID = @id
            `);

        if (batchResult.recordset.length === 0) {
            return res.status(404).json({
                status: 0,
                message: "Batch not found",
            });
        }

        const batch = batchResult.recordset[0];

        // =====================================================
        // ACTIVATE
        // =====================================================

        if (Number(isActive) === 1) {

            await pool
                .request()
                .input("id", id)
                .query(`
                    UPDATE BATCHES
                    SET
                        IS_ACTIVE = 1,
                        UPDATED_AT = GETDATE()
                    WHERE ID = @id
                `);

            return res.json({
                status: 1,
                message: "Batch activated successfully",
            });
        }

        // =====================================================
        // DEACTIVATE
        // =====================================================

        if (Number(isActive) !== 0) {
            return res.status(400).json({
                status: 0,
                message: "Invalid batch status. Use 1 for active or 0 for inactive.",
            });
        }

        // =====================================================
        // CHECK STUDENTS
        // =====================================================

        const studentResult = await pool
            .request()
            .input("batchId", id)
            .query(`
                SELECT COUNT(*) AS COUNT
                FROM STUDENT_ALLOCATIONS
                WHERE BATCH_ID = @batchId
            `);

        // =====================================================
        // CHECK TUTORS
        // =====================================================

        const tutorResult = await pool
            .request()
            .input("batchId", id)
            .query(`
                SELECT COUNT(*) AS COUNT
                FROM TUTOR_ALLOCATIONS
                WHERE BATCH_ID = @batchId
            `);

        // =====================================================
        // CHECK CLASS SCHEDULES
        // =====================================================

        const scheduleResult = await pool
            .request()
            .input("batchId", id)
            .query(`
                SELECT COUNT(*) AS COUNT
                FROM CLASS_SCHEDULES
                WHERE BATCH_ID = @batchId
            `);

        const studentCount = studentResult.recordset[0].COUNT;
        const tutorCount = tutorResult.recordset[0].COUNT;
        const scheduleCount = scheduleResult.recordset[0].COUNT;

        console.log("Student Count:", studentCount);
        console.log("Tutor Count:", tutorCount);
        console.log("Schedule Count:", scheduleCount);

        // =====================================================
        // IF DATA EXISTS AND USER HAS NOT CONFIRMED
        // =====================================================

        if (
            !force &&
            (
                studentCount > 0 ||
                tutorCount > 0 ||
                scheduleCount > 0
            )
        ) {
            return res.json({
                status: 2,
                message: "Batch contains allocated data.",
                data: {
                    batchId: id,
                    batchCode: batch.BATCH_CODE,
                    batchName: batch.BATCH_NAME,
                    studentCount,
                    tutorCount,
                    scheduleCount,
                },
            });
        }

        // =====================================================
        // DELETE RELATED DATA
        // =====================================================

        const transaction = pool.transaction();

        try {
            await transaction.begin();

            // Delete class schedules
            await transaction
                .request()
                .input("batchId", id)
                .query(`
                    DELETE FROM CLASS_SCHEDULES
                    WHERE BATCH_ID = @batchId
                `);

            // Delete tutor allocations
            await transaction
                .request()
                .input("batchId", id)
                .query(`
                    DELETE FROM TUTOR_ALLOCATIONS
                    WHERE BATCH_ID = @batchId
                `);

            // Delete student allocations
            await transaction
                .request()
                .input("batchId", id)
                .query(`
                    DELETE FROM STUDENT_ALLOCATIONS
                    WHERE BATCH_ID = @batchId
                `);

            // Deactivate batch
            await transaction
                .request()
                .input("id", id)
                .query(`
                    UPDATE BATCHES
                    SET
                        IS_ACTIVE = 0,
                        UPDATED_AT = GETDATE()
                    WHERE ID = @id
                `);

            await transaction.commit();

            return res.json({
                status: 1,
                message:
                    "Batch deactivated successfully. Students, tutors and class schedules were removed.",
            });

        } catch (transactionError) {

            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Rollback Error:", rollbackError);
            }

            throw transactionError;
        }

    } catch (err) {
        console.error("Update Batch Status Error:", err);

        return res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};

// DELETE batch
const deleteBatch = async (req, res) => {
    const pool = getPool();
    const transaction = pool.transaction();

    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                status: 0,
                message: "Valid Batch ID is required",
            });
        }

        await transaction.begin();

        // 1. Delete class attendance
        await transaction
            .request()
            .input("batchId", id)
            .query(`DELETE FROM CLASS_ATTENDANCE WHERE BATCH_ID = @batchId`);

        // 2. Delete class schedules
        await transaction
            .request()
            .input("batchId", id)
            .query(`DELETE FROM CLASS_SCHEDULES WHERE BATCH_ID = @batchId`);

        // 3. Delete tutor allocations
        await transaction
            .request()
            .input("batchId", id)
            .query(`DELETE FROM TUTOR_ALLOCATIONS WHERE BATCH_ID = @batchId`);

        // 4. Delete student allocations
        await transaction
            .request()
            .input("batchId", id)
            .query(`DELETE FROM STUDENT_ALLOCATIONS WHERE BATCH_ID = @batchId`);

        // 5. Delete assignment alerts
        await transaction
            .request()
            .input("batchId", id)
            .query(`DELETE FROM ASSIGNMENT_ALERTS WHERE BATCH_ID = @batchId`);

        // 6. Delete course material batch associations if table exists
        await transaction
            .request()
            .input("batchId", id)
            .query(`
                IF OBJECT_ID('dbo.COURSE_MATERIAL_BATCHES', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM COURSE_MATERIAL_BATCHES WHERE BATCH_ID = @batchId;
                END
            `);

        // 7. Delete notifications for this batch
        await transaction
            .request()
            .input("batchId", id)
            .query(`
                IF OBJECT_ID('dbo.NOTIFICATIONS', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM NOTIFICATIONS WHERE BATCH_ID = @batchId;
                END
            `);

        // 8. Delete chat messages, chat room members, and chat rooms
        await transaction
            .request()
            .input("batchId", id)
            .query(`
                -- 1. Delete chat messages in batch chat rooms
                IF OBJECT_ID('dbo.CHAT_MESSAGES', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM CHAT_MESSAGES 
                    WHERE ROOM_ID IN (SELECT ROOM_ID FROM CHAT_ROOMS WHERE BATCH_ID = @batchId);
                END

                -- 2. Delete chat room members in batch chat rooms
                IF OBJECT_ID('dbo.CHAT_ROOM_MEMBERS', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM CHAT_ROOM_MEMBERS 
                    WHERE ROOM_ID IN (SELECT ROOM_ID FROM CHAT_ROOMS WHERE BATCH_ID = @batchId);
                END

                -- 3. Delete chat rooms for batch
                IF OBJECT_ID('dbo.CHAT_ROOMS', 'U') IS NOT NULL
                BEGIN
                    DELETE FROM CHAT_ROOMS WHERE BATCH_ID = @batchId;
                END
            `);

        // 9. Delete batch
        await transaction
            .request()
            .input("id", id)
            .query(`DELETE FROM BATCHES WHERE ID = @id`);

        await transaction.commit();

        return res.json({
            status: 1,
            message: "Batch deleted successfully",
        });

    } catch (err) {
        console.error("Delete Batch Error:", err);

        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error("Rollback Error:", rollbackError);
        }

        return res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};

module.exports = { getBatches, getBatchDetails, addBatch, updateBatch, updateBatchStatus, deleteBatch };
