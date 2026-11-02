const sql = require("mssql");
const { getPool } = require("../config/database");

// Self-healing schema check for Practice Test Analysis
let schemaChecked = false;
const ensurePracticeTestSchema = async (pool) => {
  if (schemaChecked) return;
  try {
    await pool.query(`
      IF OBJECT_ID('QUESTION_TEMPLATES', 'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('QUESTION_TEMPLATES', 'SET_TYPE') IS NULL
          ALTER TABLE QUESTION_TEMPLATES ADD SET_TYPE NVARCHAR(50) NOT NULL DEFAULT 'ASSESSMENT';

        IF COL_LENGTH('QUESTION_TEMPLATES', 'DIFFICULTY_LEVEL') IS NULL
          ALTER TABLE QUESTION_TEMPLATES ADD DIFFICULTY_LEVEL NVARCHAR(50) NULL;
      END

      IF OBJECT_ID('ASSIGNMENT_ALERTS', 'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('ASSIGNMENT_ALERTS', 'PROJECT_KIT_ID') IS NULL
          ALTER TABLE ASSIGNMENT_ALERTS ADD PROJECT_KIT_ID INT NULL;

        IF COL_LENGTH('ASSIGNMENT_ALERTS', 'ASSESSMENT_TYPE') IS NULL
          ALTER TABLE ASSIGNMENT_ALERTS ADD ASSESSMENT_TYPE NVARCHAR(50) NULL;
      END

      IF OBJECT_ID('STUDENT_ASSESSMENT_SUBMISSIONS', 'U') IS NULL
      BEGIN
        CREATE TABLE STUDENT_ASSESSMENT_SUBMISSIONS (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          ASSESSMENT_ID INT NOT NULL,
          STUDENT_ID INT NOT NULL,
          IMAGE_1 NVARCHAR(500) NULL,
          VIDEO_1 NVARCHAR(500) NULL,
          CREATED_AT DATETIME2 NULL DEFAULT SYSDATETIME(),
          CREATED_BY INT NULL,
          UPDATED_AT DATETIME2 NULL,
          UPDATED_BY INT NULL,
          GIVEN_MARKS DECIMAL(5,2) NULL,
          COMMENT NVARCHAR(MAX) NULL,
          GIVEN_BY INT NULL,
          REVIEWED_DATE DATETIME2 NULL
        );
      END
    `);
    schemaChecked = true;
  } catch (err) {
    console.warn("ensurePracticeTestSchema non-blocking warning:", err.message);
  }
};

// Helper to validate tutor authorization for a batch (HOST or SUPPORT)
const validateTutorBatchAccess = async (pool, tutorId, batchId) => {
  if (!tutorId || !batchId) return false;

  try {
    const check = await pool
      .request()
      .input("USER_ID", sql.Int, Number(tutorId))
      .input("BATCH_ID", sql.Int, Number(batchId))
      .query(`
        SELECT 
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
            ELSE 'SUPPORT'
          END AS TUTOR_ROLE
        FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
        INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = ta.BATCH_ID
        CROSS APPLY OPENJSON(
          CASE 
            WHEN ISJSON(ta.TUTOR_IDS) = 1 THEN ta.TUTOR_IDS 
            ELSE '[]' 
          END
        )
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE b.ID = @BATCH_ID
          AND ISNULL(b.IS_ACTIVE, 1) = 1
          AND t.tutorId = @USER_ID
      `);

    return check.recordset.length > 0;
  } catch (err) {
    console.error("validateTutorBatchAccess error:", err);
    return false;
  }
};

// 1. GET ALL BATCHES ASSIGNED TO TUTOR (HOST & SUPPORT)
const getTutorBatches = async (req, res) => {
  try {
    const rawTutorId =
      req.query.tutorId ||
      req.query.tutor_id ||
      req.query.userId ||
      req.query.USER_ID ||
      req.user?.USER_ID ||
      req.user?.id;

    const tutorId = Number(rawTutorId);
    if (!Number.isInteger(tutorId) || tutorId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Tutor ID is required",
      });
    }

    const pool = await getPool();
    await ensurePracticeTestSchema(pool);

    // Security check: verify user is TUTOR or ADMIN
    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, tutorId)
      .query(`SELECT USER_TYPE, IS_ACTIVE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

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

    const isTutor = String(user.USER_TYPE || "").toUpperCase() === "TUTOR";
    const isAdmin = String(user.USER_TYPE || "").toUpperCase() === "ADMIN";

    let query = "";
    const request = pool.request();

    if (isAdmin) {
      // Admin sees all batches
      query = `
        SELECT
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
          FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
          b.IS_ACTIVE,
          'ADMIN' AS TUTOR_ROLE
        FROM BATCHES b WITH (NOLOCK)
        WHERE ISNULL(b.IS_ACTIVE, 1) = 1
        ORDER BY b.ID DESC
      `;
    } else {
      // Tutor sees all assigned batches (both HOST and SUPPORT)
      request.input("USER_ID", sql.Int, tutorId);
      query = `
        SELECT
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
          FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
          b.IS_ACTIVE,
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
            ELSE 'SUPPORT'
          END AS TUTOR_ROLE
        FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
        INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = ta.BATCH_ID
        CROSS APPLY OPENJSON(
          CASE 
            WHEN ISJSON(ta.TUTOR_IDS) = 1 THEN ta.TUTOR_IDS 
            ELSE '[]' 
          END
        )
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE ISNULL(b.IS_ACTIVE, 1) = 1
          AND t.tutorId = @USER_ID
        ORDER BY 
          CASE 
            WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 1 
            ELSE 2 
          END ASC,
          b.ID DESC
      `;
    }

    const result = await request.query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Practice test analysis getTutorBatches error:", err);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch tutor batches",
      error: err.message,
    });
  }
};

// 2. GET STUDENTS FOR SELECTED BATCH WITH ASSESSMENT COUNTS
const getBatchStudents = async (req, res) => {
  try {
    const rawBatchId = req.params.batchId || req.query.batchId;
    const rawTutorId =
      req.query.tutorId ||
      req.query.tutor_id ||
      req.query.userId ||
      req.user?.USER_ID ||
      req.user?.id;

    const batchId = Number(rawBatchId);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Batch ID is required",
      });
    }

    const rawCategoryId =
      req.query.categoryId ||
      req.query.category_id ||
      req.query.moduleId ||
      req.query.MODULE_ID;
    const rawModuleCode =
      req.query.moduleCode ||
      req.query.module_code ||
      req.query.difficultyLevel ||
      req.query.DIFFICULTY_LEVEL;

    const parsedCategoryId =
      rawCategoryId && rawCategoryId !== "ALL" ? Number(rawCategoryId) : null;
    const categoryId =
      Number.isInteger(parsedCategoryId) && parsedCategoryId > 0
        ? parsedCategoryId
        : null;

    const parsedModuleCode =
      rawModuleCode && rawModuleCode !== "ALL"
        ? String(rawModuleCode).trim()
        : null;
    const moduleCode =
      parsedModuleCode && parsedModuleCode.length > 0 ? parsedModuleCode : null;

    const pool = await getPool();
    await ensurePracticeTestSchema(pool);

    // Authorization validation for Tutor
    if (rawTutorId) {
      const tutorId = Number(rawTutorId);
      if (Number.isInteger(tutorId) && tutorId > 0) {
        const userCheck = await pool
          .request()
          .input("USER_ID", sql.Int, tutorId)
          .query(`SELECT USER_TYPE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

        const userType = String(userCheck.recordset[0]?.USER_TYPE || "").toUpperCase();
        if (userType === "TUTOR") {
          const hasAccess = await validateTutorBatchAccess(pool, tutorId, batchId);
          if (!hasAccess) {
            return res.status(403).json({
              status: 0,
              message: "You are not authorized to view students for this batch",
            });
          }
        }
      }
    }

    // Fetch students with dynamic counts of Total, Completed, and Pending assessments
    const result = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("CATEGORY_ID", sql.Int, categoryId)
      .input("MODULE_CODE", sql.NVarChar(50), moduleCode)
      .query(`
        SELECT
          u.USER_ID AS STUDENT_ID,
          u.USER_ID,
          u.USERNAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          u.SCHOOL_NAME,
          u.GRADE,
          u.IS_ACTIVE,
          b.ID AS BATCH_ID,
          b.BATCH_CODE,
          b.BATCH_NAME,

          -- Total distinct assessments assigned to this batch (filtered by Category & Module if provided)
          (
            SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID)
            FROM ASSIGNMENT_ALERTS aa WITH (NOLOCK)
            LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
            WHERE aa.BATCH_ID = @BATCH_ID
              AND (@CATEGORY_ID IS NULL OR aa.MODULE_ID = @CATEGORY_ID)
              AND (@MODULE_CODE IS NULL OR qt.DIFFICULTY_LEVEL = @MODULE_CODE)
          ) AS TOTAL_ASSESSMENTS,

          -- Completed assessments by this student for this batch (filtered by Category & Module if provided)
          (
            SELECT COUNT(DISTINCT aa.ASSIGNMENT_ID)
            FROM ASSIGNMENT_ALERTS aa WITH (NOLOCK)
            LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
            WHERE aa.BATCH_ID = @BATCH_ID
              AND (@CATEGORY_ID IS NULL OR aa.MODULE_ID = @CATEGORY_ID)
              AND (@MODULE_CODE IS NULL OR qt.DIFFICULTY_LEVEL = @MODULE_CODE)
              AND (
                EXISTS (
                  SELECT 1 FROM ASSESMENT_EXAM ae WITH (NOLOCK)
                  WHERE ae.STUDENT_ID = u.USER_ID
                    AND (ae.ASSESMENT_ID = aa.ASSIGNMENT_ID OR (aa.SET_ID IS NOT NULL AND ae.ASSESMENT_ID = aa.SET_ID))
                )
                OR EXISTS (
                  SELECT 1 FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
                  WHERE sas.STUDENT_ID = u.USER_ID
                    AND sas.ASSESSMENT_ID = aa.ASSIGNMENT_ID
                    AND NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), sas.IMAGE_1))), '') IS NOT NULL
                    AND NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), sas.VIDEO_1))), '') IS NOT NULL
                )
              )
          ) AS COMPLETED_ASSESSMENTS

        FROM (
          SELECT DISTINCT STUDENT_ID, BATCH_ID 
          FROM STUDENT_ALLOCATIONS WITH (NOLOCK) 
          WHERE BATCH_ID = @BATCH_ID
        ) sa
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
        INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
        WHERE (u.USER_TYPE IS NULL OR UPPER(u.USER_TYPE) = 'STUDENT')
        ORDER BY u.USERNAME ASC
      `);

    const students = result.recordset.map((st) => {
      const total = Number(st.TOTAL_ASSESSMENTS || 0);
      const completed = Number(st.COMPLETED_ASSESSMENTS || 0);
      const pending = Math.max(0, total - completed);

      return {
        ...st,
        TOTAL_ASSESSMENTS: total,
        COMPLETED_ASSESSMENTS: completed,
        PENDING_ASSESSMENTS: pending,
      };
    });

    return res.json({
      status: 1,
      data: students,
    });
  } catch (err) {
    console.error("Practice test analysis getBatchStudents error:", err);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch batch students",
      error: err.message,
    });
  }
};

// 3. GET ASSIGNED ASSESSMENTS FOR A STUDENT IN A BATCH
const getStudentAssessments = async (req, res) => {
  try {
    const rawStudentId = req.params.studentId || req.query.studentId;
    const rawBatchId = req.query.batchId || req.params.batchId;
    const rawTutorId =
      req.query.tutorId ||
      req.query.tutor_id ||
      req.query.userId ||
      req.user?.USER_ID ||
      req.user?.id;

    const studentId = Number(rawStudentId);
    const batchId = Number(rawBatchId);

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Student ID is required",
      });
    }

    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Batch ID is required",
      });
    }

    const rawCategoryId =
      req.query.categoryId ||
      req.query.category_id ||
      req.query.moduleId ||
      req.query.MODULE_ID;
    const rawModuleCode =
      req.query.moduleCode ||
      req.query.module_code ||
      req.query.difficultyLevel ||
      req.query.DIFFICULTY_LEVEL;

    const parsedCategoryId =
      rawCategoryId && rawCategoryId !== "ALL" ? Number(rawCategoryId) : null;
    const categoryId =
      Number.isInteger(parsedCategoryId) && parsedCategoryId > 0
        ? parsedCategoryId
        : null;

    const parsedModuleCode =
      rawModuleCode && rawModuleCode !== "ALL"
        ? String(rawModuleCode).trim()
        : null;
    const moduleCode =
      parsedModuleCode && parsedModuleCode.length > 0 ? parsedModuleCode : null;

    const pool = await getPool();
    await ensurePracticeTestSchema(pool);

    // Authorization validation for Tutor
    if (rawTutorId) {
      const tutorId = Number(rawTutorId);
      if (Number.isInteger(tutorId) && tutorId > 0) {
        const userCheck = await pool
          .request()
          .input("USER_ID", sql.Int, tutorId)
          .query(`SELECT USER_TYPE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

        const userType = String(userCheck.recordset[0]?.USER_TYPE || "").toUpperCase();
        if (userType === "TUTOR") {
          const hasAccess = await validateTutorBatchAccess(pool, tutorId, batchId);
          if (!hasAccess) {
            return res.status(403).json({
              status: 0,
              message: "You are not authorized to view assessments for this student",
            });
          }
        }
      }
    }

    // Fetch all assigned assessments for this batch and correlate with student completion records
    const result = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("STUDENT_ID", sql.Int, studentId)
      .input("CATEGORY_ID", sql.Int, categoryId)
      .input("MODULE_CODE", sql.NVarChar(50), moduleCode)
      .query(`
        SELECT
          aa.ASSIGNMENT_ID,
          aa.BATCH_ID,
          aa.SET_ID,
          aa.MODULE_ID,
          aa.PROJECT_KIT_ID,
          aa.ASSESSMENT_TYPE,
          FORMAT(aa.CREATED_AT, 'dd-MM-yyyy') AS ASSIGNED_DATE,
          aa.CREATED_AT AS RAW_ASSIGNED_DATE,

          COALESCE(m.MODULE_NAME, pk.KIT_NAME, 'General') AS CATEGORY_NAME,
          COALESCE(m.MODULE_NAME, pk.KIT_NAME, 'General') AS MODULE_NAME,
          qt.DIFFICULTY_LEVEL AS MODULE_CODE,
          qt.DIFFICULTY_LEVEL AS DIFFICULTY_LEVEL,
          COALESCE(qt.TEMPLATE_NAME, pk.KIT_NAME, m.MODULE_NAME, CONCAT('Practice Test #', aa.ASSIGNMENT_ID)) AS ASSESSMENT_NAME,

          CASE 
            WHEN ae.ID IS NOT NULL OR sas.ID IS NOT NULL THEN 'Completed'
            ELSE 'Pending'
          END AS STATUS,

          CASE 
            WHEN ae.ID IS NOT NULL OR sas.ID IS NOT NULL THEN 1
            ELSE 0
          END AS IS_COMPLETED,

          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.CREATED_ON AS COMPLETED_DATE

        FROM ASSIGNMENT_ALERTS aa WITH (NOLOCK)
        LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = aa.MODULE_ID
        LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
        LEFT JOIN PROJECT_KITS pk WITH (NOLOCK) ON pk.ID = aa.PROJECT_KIT_ID

        LEFT JOIN ASSESMENT_EXAM ae WITH (NOLOCK)
          ON ae.STUDENT_ID = @STUDENT_ID
          AND (ae.ASSESMENT_ID = aa.ASSIGNMENT_ID OR (aa.SET_ID IS NOT NULL AND ae.ASSESMENT_ID = aa.SET_ID))

        LEFT JOIN STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          ON sas.STUDENT_ID = @STUDENT_ID
          AND sas.ASSESSMENT_ID = aa.ASSIGNMENT_ID
          AND NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), sas.IMAGE_1))), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), sas.VIDEO_1))), '') IS NOT NULL

        WHERE aa.BATCH_ID = @BATCH_ID
          AND (@CATEGORY_ID IS NULL OR aa.MODULE_ID = @CATEGORY_ID)
          AND (@MODULE_CODE IS NULL OR qt.DIFFICULTY_LEVEL = @MODULE_CODE)
        ORDER BY aa.ASSIGNMENT_ID ASC
      `);

    // Fetch Student Details for Header
    const studentResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          u.USER_ID AS STUDENT_ID,
          u.USERNAME,
          u.EMAIL_ID,
          u.MOBILE_NO,
          u.SCHOOL_NAME,
          u.GRADE,
          u.IS_ACTIVE,
          b.BATCH_CODE,
          b.BATCH_NAME
        FROM USERS u WITH (NOLOCK)
        LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = @BATCH_ID
        WHERE u.USER_ID = @STUDENT_ID
      `);

    return res.json({
      status: 1,
      data: {
        student: studentResult.recordset[0] || null,
        assessments: result.recordset,
      },
    });
  } catch (err) {
    console.error("Practice test analysis getStudentAssessments error:", err);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch student assessments",
      error: err.message,
    });
  }
};

// 4. SEND REMINDER NOTIFICATION TO A SINGLE STUDENT FOR A PENDING ASSESSMENT
const sendAssessmentReminder = async (req, res) => {
  try {
    const { studentId, batchId, assessmentName, tutorId } = req.body;

    const sId = Number(studentId);
    const bId = Number(batchId);
    const tId = Number(tutorId || req.user?.USER_ID || req.user?.id || 1);

    if (!sId || !bId) {
      return res.status(400).json({
        status: 0,
        message: "Student ID and Batch ID are required",
      });
    }

    if (!assessmentName || !String(assessmentName).trim()) {
      return res.status(400).json({
        status: 0,
        message: "Assessment name is required",
      });
    }

    const pool = await getPool();

    // Security check: verify student exists and resolve canonical USER_ID
    const studentCheck = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .query(`
        SELECT USER_ID, USERNAME FROM USERS WITH (NOLOCK) WHERE USER_ID = @STUDENT_ID
        UNION
        SELECT USER_ID, STUDENT_NAME AS USERNAME FROM STUDENTS WITH (NOLOCK) WHERE STUDENT_ID = @STUDENT_ID
      `);

    if (studentCheck.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Target student not found",
      });
    }

    const targetUserId = studentCheck.recordset[0].USER_ID;
    const cleanAssessmentName = String(assessmentName).trim();
    const title = "Assessment Pending";
    const message = `Complete your assessment: ${cleanAssessmentName}`;

    // Prevent duplicate reminder within 2 minutes
    const dupCheck = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .input("RECIPIENT_ID", sql.Int, targetUserId)
      .input("MESSAGE", sql.NVarChar(sql.MAX), message)
      .query(`
        SELECT TOP 1 NOTIFICATION_ID 
        FROM NOTIFICATIONS WITH (NOLOCK)
        WHERE BATCH_ID = @BATCH_ID 
          AND RECIPIENT_ID = @RECIPIENT_ID 
          AND AUDIENCE = 'INDIVIDUAL'
          AND MESSAGE = @MESSAGE
          AND DATEDIFF(MINUTE, CREATED_AT, GETDATE()) < 2
      `);

    if (dupCheck.recordset.length > 0) {
      return res.status(200).json({
        status: 1,
        message: "Reminder already sent to this student",
      });
    }

    // Insert direct targeted notification for this student only
    await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .input("AUDIENCE", sql.NVarChar(20), "INDIVIDUAL")
      .input("RECIPIENT_ID", sql.Int, targetUserId)
      .input("TITLE", sql.NVarChar(200), title)
      .input("MESSAGE", sql.NVarChar(sql.MAX), message)
      .input("CREATED_BY", sql.Int, tId)
      .input("SENDER_TYPE", sql.NVarChar(30), "TUTOR")
      .query(`
        INSERT INTO NOTIFICATIONS
        (
          BATCH_ID,
          AUDIENCE,
          RECIPIENT_ID,
          TITLE,
          MESSAGE,
          CREATED_BY,
          SENDER_TYPE,
          CREATED_AT
        )
        VALUES
        (
          @BATCH_ID,
          @AUDIENCE,
          @RECIPIENT_ID,
          @TITLE,
          @MESSAGE,
          @CREATED_BY,
          @SENDER_TYPE,
          GETDATE()
        )
      `);

    return res.json({
      status: 1,
      message: "Notification sent successfully",
    });
  } catch (err) {
    console.error("Practice test analysis sendAssessmentReminder error:", err);
    return res.status(500).json({
      status: 0,
      message: "Failed to send notification",
      error: err.message,
    });
  }
};

module.exports = {
  getTutorBatches,
  getBatchStudents,
  getStudentAssessments,
  sendAssessmentReminder,
};
