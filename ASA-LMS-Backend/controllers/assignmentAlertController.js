const path = require("path");
const sql = require("mssql");
const { getPool } = require("../config/database");

// =========================================================
// GET MODULES + QUESTION SETS + QUESTIONS
//
// QUESTION SETS ARE ALWAYS AVAILABLE.
//
// A question set is NOT removed after assignment because
// the same question set can be assigned to another class.
//
// Class uniqueness is handled separately:
// ONE ASSIGNMENT PER CLASS SCHEDULE.
// =========================================================
const getModulesForAssignment = async (req, res) => {
  try {
    const pool = await getPool();

    // Ensure SET_TYPE column exists in QUESTION_TEMPLATES
    try {
      await pool.query(`
        IF OBJECT_ID('QUESTION_TEMPLATES', 'U') IS NOT NULL
        BEGIN
          IF COL_LENGTH('QUESTION_TEMPLATES', 'SET_TYPE') IS NULL
            ALTER TABLE QUESTION_TEMPLATES ADD SET_TYPE NVARCHAR(50) NOT NULL DEFAULT 'ASSESSMENT';
        END
      `);
    } catch (_) {}

    const rawBatchId =
      req.query.batchId ||
      req.query.batch_id ||
      req.query.BATCH_ID;

    let batchId = null;
    if (rawBatchId && Number(rawBatchId) > 0) {
      batchId = Number(rawBatchId);
    }

    const request = pool.request();
    let setNotAssignedClause = "";

    if (batchId) {
      request.input("BATCH_ID", sql.Int, batchId);
      setNotAssignedClause = `
        AND NOT EXISTS (
          SELECT 1
          FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)
          WHERE AA.SET_ID = QT.ID
            AND AA.BATCH_ID = @BATCH_ID
        )
      `;
    }

    const result = await request.query(`
      SELECT
        M.ID AS MODULE_ID,
        M.MODULE_NAME,

        QT.ID AS SET_ID,
        QT.TEMPLATE_NAME AS SET_NAME,
        ISNULL(QT.SET_TYPE, 'ASSESSMENT') AS SET_TYPE,

        QB.ID AS QUESTION_ID,
        QB.QUESTION AS QUESTION_TEXT

      FROM MODULES M

      INNER JOIN QUESTION_TEMPLATES QT
        ON QT.IS_ACTIVE = 1
        AND UPPER(ISNULL(QT.SET_TYPE, 'ASSESSMENT')) = 'ASSESSMENT'
        ${setNotAssignedClause}

      CROSS APPLY OPENJSON(
        CASE 
          WHEN ISJSON(QT.QUESTION_IDS) = 1 THEN QT.QUESTION_IDS 
          ELSE '[]' 
        END
      ) J

      INNER JOIN QUESTION_BANK QB
        ON QB.ID = TRY_CAST(J.value AS INT)
        AND QB.MODULE_ID = M.ID
        AND ISNULL(QB.IS_ACTIVE, 1) = 1

      WHERE ISNULL(M.IS_ACTIVE, 1) = 1

      ORDER BY
        M.MODULE_NAME,
        QT.TEMPLATE_NAME,
        QB.ID
    `);

    const moduleMap = {};

    result.recordset.forEach((row) => {
      if (!moduleMap[row.MODULE_ID]) {
        moduleMap[row.MODULE_ID] = {
          MODULE_ID: row.MODULE_ID,
          MODULE_NAME: row.MODULE_NAME,
          sets: [],
        };
      }

      let questionSet = moduleMap[row.MODULE_ID].sets.find(
        (set) => Number(set.SET_ID) === Number(row.SET_ID)
      );

      if (!questionSet) {
        questionSet = {
          SET_ID: row.SET_ID,
          SET_NAME: row.SET_NAME,
          SET_TYPE: row.SET_TYPE || "ASSESSMENT",
          QUESTION_COUNT: 0,
          questions: [],
        };

        moduleMap[row.MODULE_ID].sets.push(questionSet);
      }

      if (
        row.QUESTION_ID !== null &&
        row.QUESTION_ID !== undefined
      ) {
        questionSet.questions.push({
          QUESTION_ID: row.QUESTION_ID,
          QUESTION_TEXT: row.QUESTION_TEXT || "",
        });
      }

      questionSet.QUESTION_COUNT =
        questionSet.questions.length;
    });

    return res.json({
      status: 1,
      data: Object.values(moduleMap),
    });
  } catch (error) {
    console.error(
      "Get assignment modules error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message: "Failed to get modules",
      error: error.message,
    });
  }
};


// =========================================================
// GET AVAILABLE PROJECT KITS FOR TUTOR / ADMIN ASSIGNMENT ALERT
//
// RULE:
// Project Kit balance is calculated PER SELECTED BATCH.
// Kits assigned to the selected batch are excluded.
// =========================================================
const getAvailableProjectKits = async (req, res) => {
  try {
    const pool = await getPool();
    const rawBatchId =
      req.query.batchId ||
      req.query.batch_id ||
      req.query.BATCH_ID;

    let batchId = null;
    if (rawBatchId && Number(rawBatchId) > 0) {
      batchId = Number(rawBatchId);
    }

    const request = pool.request();
    let kitNotAssignedClause = "";

    if (batchId) {
      request.input("BATCH_ID", sql.Int, batchId);
      kitNotAssignedClause = `
        AND NOT EXISTS (
          SELECT 1
          FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)
          WHERE AA.PROJECT_KIT_ID = PK.ID
            AND AA.BATCH_ID = @BATCH_ID
        )
      `;
    }

    const result = await request.query(`
      SELECT
        PK.ID,
        PK.KIT_NAME,
        PK.IMAGE_URL,
        PK.IS_ACTIVE,
        FORMAT(PK.CREATED_AT, 'dd MMM yyyy') AS CREATED_AT_FORMATTED,
        PK.CREATED_AT
      FROM PROJECT_KITS PK WITH (NOLOCK)
      WHERE ISNULL(PK.IS_ACTIVE, 1) = 1
        ${kitNotAssignedClause}
      ORDER BY PK.ID DESC
    `);

    const kits = result.recordset.map((kit) => ({
      ...kit,
      IMAGE_NAME: kit.IMAGE_URL ? path.basename(kit.IMAGE_URL) : "",
    }));

    return res.json({
      status: 1,
      message: "Available project kits fetched successfully",
      data: kits,
    });
  } catch (error) {
    console.error("Get available project kits error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch available project kits",
      error: error.message,
    });
  }
};


// =========================================================
// GET HOST TUTOR BATCHES (OR ALL ACTIVE BATCHES FOR ADMIN)
// =========================================================
const getTutorBatch = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: 0,
        message: "User ID is required",
      });
    }

    const numericUserId = Number(userId);

    if (!Number.isInteger(numericUserId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid user ID",
      });
    }

    const pool = await getPool();

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, numericUserId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const isAdmin = user && String(user.USER_TYPE).toUpperCase() === "ADMIN";

    let batchResult;

    if (isAdmin) {
      batchResult = await pool
        .request()
        .query(`
          SELECT
            B.ID AS BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME
          FROM BATCHES B
          WHERE ISNULL(B.IS_ACTIVE, 1) = 1
          ORDER BY B.ID
        `);
    } else {
      batchResult = await pool
        .request()
        .input("USER_ID", sql.Int, numericUserId)
        .query(`
          SELECT DISTINCT
            B.ID AS BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME

          FROM TUTOR_ALLOCATIONS TA

          INNER JOIN BATCHES B
            ON B.ID = TA.BATCH_ID

          CROSS APPLY OPENJSON(TA.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) T

          WHERE T.tutorId = @USER_ID
            AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST' OR T.role IS NULL)
            AND ISNULL(B.IS_ACTIVE, 1) = 1

          ORDER BY B.ID
        `);
    }

    if (batchResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: isAdmin
          ? "No active batches found"
          : "You are not assigned as host to any active batch",
      });
    }

    const batches = batchResult.recordset.map((batch) => ({
      BATCH_ID: batch.BATCH_ID,
      BATCH_CODE: batch.BATCH_CODE,
      BATCH_NAME: batch.BATCH_NAME,
      CLASSES: [],
    }));

    return res.json({
      status: 1,
      data: batches,
    });
  } catch (error) {
    console.error(
      "Get tutor host batches error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message:
        "Failed to get batches",
      error: error.message,
    });
  }
};


// =========================================================
// CREATE ASSIGNMENT ALERT
//
// Supports:
// 1. Question Set only: setId & moduleId provided, projectKitId = null
// 2. Project Kit only: projectKitId provided, setId = null, moduleId = null
// 3. Both: setId, moduleId AND projectKitId provided
//
// Availability:
// Immediately available to all students in the batch upon creation.
// =========================================================
const createAssignmentAlert = async (req, res) => {
  try {
    const {
      batchId,
      classId,
      setId,
      moduleId,
      projectKitId,
      createdBy,
    } = req.body;

    if (!batchId || !createdBy) {
      return res.status(400).json({
        status: 0,
        message: "Batch and user are required",
      });
    }

    const hasQuestionSet = Boolean(setId && moduleId);
    const hasProjectKit = Boolean(projectKitId);

    if (!hasQuestionSet && !hasProjectKit) {
      return res.status(400).json({
        status: 0,
        message: "Please select a Question Set, a Project Kit, or both.",
      });
    }

    const numericUserId = Number(createdBy);
    const selectedBatchId = Number(batchId);
    const selectedClassId = classId && Number(classId) > 0 ? Number(classId) : null;
    const selectedSetId = hasQuestionSet ? Number(setId) : null;
    const selectedModuleId = hasQuestionSet ? Number(moduleId) : null;
    const selectedKitId = hasProjectKit ? Number(projectKitId) : null;

    if (!Number.isInteger(numericUserId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid user ID",
      });
    }

    if (!Number.isInteger(selectedBatchId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid batch ID",
      });
    }

    if (hasQuestionSet) {
      if (!Number.isInteger(selectedSetId)) {
        return res.status(400).json({
          status: 0,
          message: "Invalid question set ID",
        });
      }
      if (!Number.isInteger(selectedModuleId)) {
        return res.status(400).json({
          status: 0,
          message: "Invalid module ID",
        });
      }
    }

    if (hasProjectKit && !Number.isInteger(selectedKitId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid project kit ID",
      });
    }

    const pool = await getPool();

    // 1. VERIFY USER ROLE & PERMISSION FOR BATCH
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, numericUserId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const isAdmin = user && String(user.USER_TYPE).toUpperCase() === "ADMIN";

    if (isAdmin) {
      const adminBatchResult = await pool
        .request()
        .input("BATCH_ID", sql.Int, selectedBatchId)
        .query(`
          SELECT ID AS BATCH_ID, BATCH_CODE, BATCH_NAME
          FROM BATCHES
          WHERE ID = @BATCH_ID AND ISNULL(IS_ACTIVE, 1) = 1
        `);

      if (adminBatchResult.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "Selected batch is inactive or not found.",
        });
      }
    } else {
      const hostBatchResult = await pool
        .request()
        .input("USER_ID", sql.Int, numericUserId)
        .input("BATCH_ID", sql.Int, selectedBatchId)
        .query(`
          SELECT DISTINCT
            B.ID AS BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME
          FROM TUTOR_ALLOCATIONS TA
          INNER JOIN BATCHES B
            ON B.ID = TA.BATCH_ID
          CROSS APPLY OPENJSON(
            CASE 
              WHEN ISJSON(TA.TUTOR_IDS) = 1 THEN TA.TUTOR_IDS 
              ELSE '[]' 
            END
          )
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) T
          WHERE T.tutorId = @USER_ID
            AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST' OR T.role IS NULL)
            AND B.ID = @BATCH_ID
            AND ISNULL(B.IS_ACTIVE, 1) = 1
        `);

      if (hostBatchResult.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You are not assigned as a host to this batch.",
        });
      }
    }

    // 2. VERIFY MODULE + QUESTION SET IF PROVIDED
    if (hasQuestionSet) {
      const templateResult = await pool
        .request()
        .input("SET_ID", sql.Int, selectedSetId)
        .input("MODULE_ID", sql.Int, selectedModuleId)
        .query(`
          SELECT DISTINCT
            QT.ID AS SET_ID,
            QT.TEMPLATE_NAME AS SET_NAME,
            M.ID AS MODULE_ID,
            M.MODULE_NAME
          FROM QUESTION_TEMPLATES QT
          CROSS APPLY OPENJSON(
            CASE 
              WHEN ISJSON(QT.QUESTION_IDS) = 1 THEN QT.QUESTION_IDS 
              ELSE '[]' 
            END
          ) J
          INNER JOIN QUESTION_BANK QB
            ON QB.ID = TRY_CAST(J.value AS INT)
          INNER JOIN MODULES M
            ON M.ID = QB.MODULE_ID
          WHERE QT.ID = @SET_ID
            AND QT.IS_ACTIVE = 1
            AND M.ID = @MODULE_ID
            AND ISNULL(M.IS_ACTIVE, 1) = 1
            AND ISNULL(QB.IS_ACTIVE, 1) = 1
        `);

      if (templateResult.recordset.length === 0) {
        return res.status(400).json({
          status: 0,
          message: "Selected question template does not belong to the module",
        });
      }

      // Check if Question Set is already assigned to THIS BATCH in assessment alerts
      const setAssignedCheck = await pool
        .request()
        .input("SET_ID", sql.Int, selectedSetId)
        .input("BATCH_ID", sql.Int, selectedBatchId)
        .query(`
          SELECT TOP 1 ASSIGNMENT_ID, BATCH_ID, CLASS_ID
          FROM ASSIGNMENT_ALERTS WITH (NOLOCK)
          WHERE SET_ID = @SET_ID
            AND BATCH_ID = @BATCH_ID
        `);

      if (setAssignedCheck.recordset.length > 0) {
        return res.status(409).json({
          status: 0,
          setAlreadyAssigned: true,
          message: "This Question Set has already been assigned to this batch.",
        });
      }
    }

    // 3. VERIFY PROJECT KIT IF PROVIDED
    if (hasProjectKit) {
      const kitResult = await pool
        .request()
        .input("KIT_ID", sql.Int, selectedKitId)
        .query(`
          SELECT ID, KIT_NAME, IS_ACTIVE
          FROM PROJECT_KITS WITH (NOLOCK)
          WHERE ID = @KIT_ID AND ISNULL(IS_ACTIVE, 1) = 1
        `);

      if (kitResult.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "Selected Project Kit does not exist or is inactive.",
        });
      }

      // Check if Project Kit is already assigned to THIS BATCH in assessment alerts
      const kitAssignedCheck = await pool
        .request()
        .input("KIT_ID", sql.Int, selectedKitId)
        .input("BATCH_ID", sql.Int, selectedBatchId)
        .query(`
          SELECT TOP 1 ASSIGNMENT_ID, BATCH_ID, CLASS_ID
          FROM ASSIGNMENT_ALERTS WITH (NOLOCK)
          WHERE PROJECT_KIT_ID = @KIT_ID
            AND BATCH_ID = @BATCH_ID
        `);

      if (kitAssignedCheck.recordset.length > 0) {
        return res.status(409).json({
          status: 0,
          kitAlreadyAssigned: true,
          message: "This Project Kit has already been assigned to this batch.",
        });
      }
    }

    const assessmentType = (
      req.body.assessmentType ||
      req.body.ASSESSMENT_TYPE ||
      "ASSESSMENT"
    ).trim();

    // 4. INSERT ASSIGNMENT ALERT (Immediately Available)
    const insertResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, selectedBatchId)
      .input("CLASS_ID", sql.Int, selectedClassId)
      .input("SET_ID", sql.Int, selectedSetId)
      .input("MODULE_ID", sql.Int, selectedModuleId)
      .input("PROJECT_KIT_ID", sql.Int, selectedKitId)
      .input("CREATED_BY", sql.Int, numericUserId)
      .input("ASSESSMENT_TYPE", sql.NVarChar(50), assessmentType)
      .query(`
        INSERT INTO ASSIGNMENT_ALERTS
        (
          BATCH_ID,
          CLASS_ID,
          SET_ID,
          MODULE_ID,
          PROJECT_KIT_ID,
          CREATED_AT,
          CREATED_BY,
          ASSESSMENT_TYPE
        )
        OUTPUT INSERTED.ASSIGNMENT_ID
        VALUES
        (
          @BATCH_ID,
          @CLASS_ID,
          @SET_ID,
          @MODULE_ID,
          @PROJECT_KIT_ID,
          GETDATE(),
          @CREATED_BY,
          @ASSESSMENT_TYPE
        )
      `);

    return res.json({
      status: 1,
      message: "Assessment alert created successfully",
      data: {
        assignmentId: insertResult.recordset[0]?.ASSIGNMENT_ID,
        batchId: selectedBatchId,
        classId: selectedClassId,
        setId: selectedSetId,
        moduleId: selectedModuleId,
        projectKitId: selectedKitId,
        createdBy: numericUserId,
        assessmentType: assessmentType,
      },
    });
  } catch (error) {
    console.error("Create assignment alert error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to create assessment alert",
      error: error.message,
    });
  }
};


// =========================================================
// GET TUTOR / ADMIN ASSIGNMENT ALERTS
// =========================================================
const getTutorAssignmentAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: 0,
        message: "User ID is required",
      });
    }

    const numericUserId = Number(userId);

    if (!Number.isInteger(numericUserId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid user ID",
      });
    }

    const pool = await getPool();

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, numericUserId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const isAdmin = user && String(user.USER_TYPE).toUpperCase() === "ADMIN";

    let result;

    if (isAdmin) {
      result = await pool
        .request()
        .query(`
          SELECT DISTINCT
            AA.ASSIGNMENT_ID,
            AA.BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME,
            AA.CLASS_ID,
            CS.TOPIC AS CLASS_TOPIC,
            CS.CLASS_DATE,
            CS.CLASS_TIME,
            AA.SET_ID,
            QT.TEMPLATE_NAME AS SET_NAME,
            AA.MODULE_ID,
            M.MODULE_NAME,
            AA.PROJECT_KIT_ID,
            PK.KIT_NAME AS PROJECT_KIT_NAME,
            PK.IMAGE_URL AS PROJECT_KIT_IMAGE_URL,
            AA.ASSESSMENT_TYPE,
            AA.CREATED_AT,
            AA.CREATED_BY,
            AA.UPDATED_AT,
            AA.UPDATED_BY
          FROM ASSIGNMENT_ALERTS AA
          INNER JOIN BATCHES B ON B.ID = AA.BATCH_ID
          LEFT JOIN CLASS_SCHEDULES CS ON CS.ID = AA.CLASS_ID
          LEFT JOIN MODULES M ON M.ID = AA.MODULE_ID
          LEFT JOIN QUESTION_TEMPLATES QT ON QT.ID = AA.SET_ID
          LEFT JOIN PROJECT_KITS PK ON PK.ID = AA.PROJECT_KIT_ID
          ORDER BY AA.CREATED_AT DESC
        `);
    } else {
      result = await pool
        .request()
        .input("USER_ID", sql.Int, numericUserId)
        .query(`
          SELECT DISTINCT
            AA.ASSIGNMENT_ID,
            AA.BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME,
            AA.CLASS_ID,
            CS.TOPIC AS CLASS_TOPIC,
            CS.CLASS_DATE,
            CS.CLASS_TIME,
            AA.SET_ID,
            QT.TEMPLATE_NAME AS SET_NAME,
            AA.MODULE_ID,
            M.MODULE_NAME,
            AA.PROJECT_KIT_ID,
            PK.KIT_NAME AS PROJECT_KIT_NAME,
            PK.IMAGE_URL AS PROJECT_KIT_IMAGE_URL,
            AA.ASSESSMENT_TYPE,
            AA.CREATED_AT,
            AA.CREATED_BY,
            AA.UPDATED_AT,
            AA.UPDATED_BY
          FROM ASSIGNMENT_ALERTS AA
          INNER JOIN BATCHES B ON B.ID = AA.BATCH_ID
          LEFT JOIN CLASS_SCHEDULES CS ON CS.ID = AA.CLASS_ID
          INNER JOIN TUTOR_ALLOCATIONS TA ON TA.BATCH_ID = AA.BATCH_ID
          CROSS APPLY OPENJSON(
            CASE 
              WHEN ISJSON(TA.TUTOR_IDS) = 1 THEN TA.TUTOR_IDS 
              ELSE '[]' 
            END
          )
          WITH (
            tutorId INT '$.tutorId'
          ) T
          LEFT JOIN MODULES M ON M.ID = AA.MODULE_ID
          LEFT JOIN QUESTION_TEMPLATES QT ON QT.ID = AA.SET_ID
          LEFT JOIN PROJECT_KITS PK ON PK.ID = AA.PROJECT_KIT_ID
          WHERE T.tutorId = @USER_ID
          ORDER BY AA.CREATED_AT DESC
        `);
    }

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Get tutor assignment alerts error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to get assignment alerts",
      error: error.message,
    });
  }
};


// =========================================================
// EXPORTS
// =========================================================
module.exports = {
  getModulesForAssignment,
  getAvailableProjectKits,
  getTutorBatch,
  createAssignmentAlert,
  getTutorAssignmentAlerts,
};
