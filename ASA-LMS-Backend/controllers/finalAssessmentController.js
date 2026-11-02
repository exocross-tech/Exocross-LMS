const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
let ffmpegPath = null;
try {
  ffmpegPath = require("ffmpeg-static");
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (e) {
  console.warn("ffmpeg-static path setup warning:", e.message);
}
const { getPool, sql } = require("../config/database");
const { ALLOWED_MODULE_CODES } = require("../validators/questionBankValidator");

// =====================================================
// HELPER: VERIFY TUTOR HOST BATCH
// =====================================================
const isTutorHostOfBatch = async (pool, tutorId, batchId) => {
  if (!tutorId) return false;

  // Check if user is ADMIN - Admins have full access to all batches
  const userCheck = await pool
    .request()
    .input("USER_ID", sql.Int, Number(tutorId))
    .query(`SELECT USER_TYPE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

  if (
    userCheck.recordset.length > 0 &&
    String(userCheck.recordset[0].USER_TYPE || "").toUpperCase().trim() === "ADMIN"
  ) {
    return true;
  }

  const check = await pool
    .request()
    .input("USER_ID", sql.Int, Number(tutorId))
    .input("BATCH_ID", sql.Int, Number(batchId))
    .query(`
      SELECT 1 AS IS_HOST
      FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
      INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = ta.BATCH_ID
      CROSS APPLY OPENJSON(
        CASE WHEN ISJSON(ta.TUTOR_IDS) = 1 THEN ta.TUTOR_IDS ELSE '[]' END
      )
      WITH (
        tutorId INT '$.tutorId',
        role NVARCHAR(50) '$.role'
      ) t
      WHERE b.ID = @BATCH_ID
        AND ISNULL(b.IS_ACTIVE, 1) = 1
        AND t.tutorId = @USER_ID
        AND (
          TRY_CONVERT(INT, t.role) = 1
          OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST'
        )
    `);

  return check.recordset.length > 0;
};

// =====================================================
// GET TUTOR HOSTED BATCHES
// =====================================================
const getTutorBatches = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !Number.isInteger(Number(userId))) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor user ID is required",
      });
    }

    const pool = await getPool();

    // Check user type (Admin sees all active batches)
    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, Number(userId))
      .query(`SELECT USER_TYPE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

    const isAdmin =
      userCheck.recordset.length > 0 &&
      String(userCheck.recordset[0].USER_TYPE || "").toUpperCase().trim() === "ADMIN";

    let result;
    if (isAdmin) {
      result = await pool.query(`
        SELECT
          b.ID,
          b.ID AS BATCH_ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE
        FROM BATCHES b WITH (NOLOCK)
        WHERE ISNULL(b.IS_ACTIVE, 1) = 1
        ORDER BY b.ID DESC
      `);
    } else {
      result = await pool
        .request()
        .input("USER_ID", sql.Int, Number(userId))
        .query(`
          SELECT DISTINCT
            b.ID,
            b.ID AS BATCH_ID,
            b.BATCH_CODE,
            b.BATCH_NAME,
            b.START_DATE,
            b.END_DATE,
            b.IS_ACTIVE
          FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
          INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = ta.BATCH_ID
          CROSS APPLY OPENJSON(
            CASE WHEN ISJSON(ta.TUTOR_IDS) = 1 THEN ta.TUTOR_IDS ELSE '[]' END
          )
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE ISNULL(b.IS_ACTIVE, 1) = 1
            AND t.tutorId = @USER_ID
            AND (
              TRY_CONVERT(INT, t.role) = 1
              OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST'
            )
          ORDER BY b.ID DESC
        `);
    }

    return res.status(200).json({
      status: 1,
      message: "Tutor batches fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getTutorBatches error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch tutor batches",
      error: error.message,
    });
  }
};

// =====================================================
// THEORY: GET ACTIVE TEMPLATES LIST (FOR SELECTION & VIEW)
// =====================================================
const getTheoryTemplatesList = async (req, res) => {
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

    const result = await pool.request().query(`
      SELECT
        qt.ID,
        qt.TEMPLATE_NAME,
        qt.QUESTION_IDS,
        qt.DIFFICULTY_LEVEL,
        ISNULL(qt.SET_TYPE, 'FINAL_ASSESSMENT') AS SET_TYPE,
        qt.CREATED_BY,
        qt.CREATED_AT,
        qt.IS_ACTIVE
      FROM QUESTION_TEMPLATES qt WITH (NOLOCK)
      WHERE ISNULL(qt.IS_ACTIVE, 1) = 1
        AND UPPER(ISNULL(qt.SET_TYPE, 'FINAL_ASSESSMENT')) = 'FINAL_ASSESSMENT'
      ORDER BY qt.ID DESC
    `);

    // Fetch all active questions to attach preview details and question counts
    const questionsRes = await pool.request().query(`
      SELECT
        qb.ID,
        qb.MODULE_ID,
        m.MODULE_NAME,
        qb.QUESTION,
        qb.QUESTION_TYPE,
        qb.OPTION_A,
        qb.OPTION_B,
        qb.OPTION_C,
        qb.OPTION_D,
        qb.CORRECT_ANSWER,
        qb.MARK,
        qb.DIFFICULTY_LEVEL
      FROM QUESTION_BANK qb WITH (NOLOCK)
      LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = qb.MODULE_ID
      WHERE ISNULL(qb.IS_ACTIVE, 1) = 1
    `);

    const qMap = new Map();
    questionsRes.recordset.forEach((q) => {
      qMap.set(Number(q.ID), q);
    });

    const list = result.recordset.map((item) => {
      let qIds = [];
      try {
        qIds = JSON.parse(item.QUESTION_IDS || "[]");
      } catch (_) {
        qIds = [];
      }
      const questions = (Array.isArray(qIds) ? qIds : [])
        .map((id) => qMap.get(Number(id)))
        .filter(Boolean);

      const totalMarks = questions.reduce(
        (sum, q) => sum + (Number(q.MARK) || 0),
        0
      );

      return {
        ID: item.ID,
        TEMPLATE_NAME: item.TEMPLATE_NAME,
        DIFFICULTY_LEVEL: item.DIFFICULTY_LEVEL,
        QUESTION_COUNT: questions.length,
        TOTAL_MARKS: totalMarks,
        CREATED_AT: item.CREATED_AT,
        questions: questions,
      };
    });

    return res.json({
      status: 1,
      data: list,
    });
  } catch (error) {
    console.error("❌ getTheoryTemplatesList error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch theory templates",
      error: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: GET ACTIVE PROJECT KITS LIST (FOR SELECTION)
// =====================================================
const getPracticalKitsList = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        pk.ID,
        pk.KIT_NAME,
        pk.IMAGE_URL,
        pk.IS_ACTIVE,
        pk.CREATED_AT
      FROM PROJECT_KITS pk WITH (NOLOCK)
      WHERE ISNULL(pk.IS_ACTIVE, 1) = 1
      ORDER BY pk.ID DESC
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getPracticalKitsList error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch practical project kits",
      error: error.message,
    });
  }
};

// =====================================================
// UNIFIED ASSIGN FINAL ASSESSMENT (THEORY / PRACTICAL / BOTH)
// =====================================================
const assignFinalAssessment = async (req, res) => {
  try {
    const {
      TYPE, // "THEORY" | "PRACTICAL" | "BOTH"
      SET_ID,
      PROJECT_KIT_ID,
      BATCH_ID,
      TUTOR_ID,
      TITLE,
      DESCRIPTION,
    } = req.body;

    const normType = (TYPE || "").toUpperCase().trim();
    if (!["THEORY", "PRACTICAL"].includes(normType)) {
      return res.status(400).json({
        status: 0,
        message: "Assessment TYPE must be THEORY or PRACTICAL",
      });
    }

    const batchId = Number(BATCH_ID);
    if (!batchId || !Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch selection is required",
      });
    }

    const tutorId = Number(TUTOR_ID);
    if (!tutorId || !Number.isInteger(tutorId) || tutorId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    const pool = await getPool();

    // Verify Tutor HOST of Batch
    const isHost = await isTutorHostOfBatch(pool, tutorId, batchId);
    if (!isHost) {
      return res.status(403).json({
        status: 0,
        message: "You are not authorized to assign assessments to this batch (HOST role required)",
      });
    }

    let setId = null;
    let templateName = "";
    if (normType === "THEORY" || normType === "BOTH") {
      setId = Number(SET_ID);
      if (!setId || !Number.isInteger(setId) || setId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "A Theory Question Set is required for this assessment type",
        });
      }
      const setCheck = await pool
        .request()
        .input("SET_ID", sql.Int, setId)
        .query("SELECT ID, TEMPLATE_NAME FROM QUESTION_TEMPLATES WITH (NOLOCK) WHERE ID = @SET_ID AND ISNULL(IS_ACTIVE, 1) = 1");
      if (setCheck.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "Selected Theory Question Set was not found or is inactive",
        });
      }
      templateName = setCheck.recordset[0].TEMPLATE_NAME;
    }

    let kitId = null;
    let kitName = "";
    if (normType === "PRACTICAL" || normType === "BOTH") {
      kitId = Number(PROJECT_KIT_ID);
      if (!kitId || !Number.isInteger(kitId) || kitId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "A Practical Assessment / Project Kit is required for this assessment type",
        });
      }
      const kitCheck = await pool
        .request()
        .input("KIT_ID", sql.Int, kitId)
        .query("SELECT ID, KIT_NAME FROM PROJECT_KITS WITH (NOLOCK) WHERE ID = @KIT_ID AND ISNULL(IS_ACTIVE, 1) = 1");
      if (kitCheck.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "Selected Project Kit was not found or is inactive",
        });
      }
      kitName = kitCheck.recordset[0].KIT_NAME;
    }

    const finalTitle = (TITLE && TITLE.trim()) ||
      (normType === "THEORY" ? templateName : normType === "PRACTICAL" ? kitName : `${templateName} & ${kitName}`);
    const finalDesc = (DESCRIPTION && DESCRIPTION.trim()) ||
      `Final Assessment (${normType}): ${finalTitle}`;

    const assessmentTypeTag = `FINAL_ASSESSMENT_${normType}`;

    // 1. Insert into ASSIGNMENT_ALERTS
    const alertResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("SET_ID", sql.Int, setId)
      .input("PROJECT_KIT_ID", sql.Int, kitId)
      .input("CREATED_BY", sql.Int, tutorId)
      .input("ASSESSMENT_TYPE", sql.NVarChar(50), assessmentTypeTag)
      .query(`
        INSERT INTO ASSIGNMENT_ALERTS
        (
          BATCH_ID,
          SET_ID,
          PROJECT_KIT_ID,
          CREATED_AT,
          CREATED_BY,
          ASSESSMENT_TYPE
        )
        OUTPUT INSERTED.ASSIGNMENT_ID
        VALUES
        (
          @BATCH_ID,
          @SET_ID,
          @PROJECT_KIT_ID,
          GETDATE(),
          @CREATED_BY,
          @ASSESSMENT_TYPE
        )
      `);

    const assignmentId = alertResult.recordset[0]?.ASSIGNMENT_ID;

    let finalAssessmentTableId = null;
    // 2. Insert into FINAL_ASSESSMENTS table for title/description metadata ONLY if Practical or Both
    if (normType !== "THEORY") {
      const faResult = await pool
        .request()
        .input("TITLE", sql.NVarChar(255), finalTitle)
        .input("DESCRIPTION", sql.NVarChar(sql.MAX), finalDesc)
        .input("BATCH_ID", sql.Int, batchId)
        .input("ASSESSMENT_TYPE", sql.VarChar(50), assessmentTypeTag)
        .input("CREATED_BY", sql.Int, tutorId)
        .query(`
          INSERT INTO FINAL_ASSESSMENTS
          (
            TITLE,
            DESCRIPTION,
            BATCH_ID,
            ASSESSMENT_TYPE,
            CREATED_BY,
            CREATED_AT,
            UPDATED_BY,
            UPDATED_AT,
            IS_ACTIVE
          )
          OUTPUT INSERTED.ID
          VALUES
          (
            @TITLE,
            @DESCRIPTION,
            @BATCH_ID,
            @ASSESSMENT_TYPE,
            @CREATED_BY,
            GETDATE(),
            @CREATED_BY,
            GETDATE(),
            1
          )
        `);
      finalAssessmentTableId = faResult.recordset[0]?.ID || null;
    }

    return res.status(201).json({
      status: 1,
      message: `Final Assessment (${normType}) assigned successfully`,
      data: {
        ASSIGNMENT_ID: assignmentId,
        FINAL_ASSESSMENT_ID: finalAssessmentTableId || assignmentId,
        TYPE: normType,
        SET_ID: setId,
        PROJECT_KIT_ID: kitId,
        BATCH_ID: batchId,
        TUTOR_ID: tutorId,
        TITLE: finalTitle,
        DESCRIPTION: finalDesc,
      },
    });
  } catch (error) {
    console.error("❌ assignFinalAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to assign Final Assessment",
      error: error.message,
    });
  }
};

// =====================================================
// THEORY: CREATE FINAL ASSESSMENT (QUESTION_TEMPLATES)
// =====================================================
const createTheoryAssessment = async (req, res) => {
  try {
    const {
      TEMPLATE_NAME,
      QUESTION_IDS,
      CREATED_BY,
      DIFFICULTY_LEVEL,
    } = req.body;

    if (!TEMPLATE_NAME || !TEMPLATE_NAME.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Template name is required",
      });
    }

    let difficultyLevel = null;
    if (
      DIFFICULTY_LEVEL !== undefined &&
      DIFFICULTY_LEVEL !== null &&
      DIFFICULTY_LEVEL !== ""
    ) {
      const trimmedDifficulty = String(DIFFICULTY_LEVEL).trim();
      if (!ALLOWED_MODULE_CODES.includes(trimmedDifficulty)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid Difficulty Level '${DIFFICULTY_LEVEL}'. Allowed values are: ${ALLOWED_MODULE_CODES.join(
            ", "
          )}`,
        });
      }
      difficultyLevel = trimmedDifficulty;
    }

    if (!QUESTION_IDS) {
      return res.status(400).json({
        status: 0,
        message: "Question IDs are required",
      });
    }

    let questionIds = [];
    try {
      questionIds =
        typeof QUESTION_IDS === "string"
          ? JSON.parse(QUESTION_IDS)
          : QUESTION_IDS;
    } catch {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs format",
      });
    }

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Select at least one question",
      });
    }

    questionIds = [
      ...new Set(
        questionIds
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ];

    if (questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs",
      });
    }

    const pool = await getPool();
    const idsString = questionIds.join(",");

    const questionResult = await pool.request().query(`
      SELECT ID
      FROM QUESTION_BANK
      WHERE ID IN (${idsString})
    `);

    if (questionResult.recordset.length !== questionIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected questions do not exist",
      });
    }

    const questionIdsJson = JSON.stringify(questionIds);
    const createdBy = Number(CREATED_BY) || 0;

    const result = await pool
      .request()
      .input("TEMPLATE_NAME", sql.NVarChar(255), TEMPLATE_NAME.trim())
      .input("QUESTION_IDS", sql.NVarChar(sql.MAX), questionIdsJson)
      .input("CREATED_BY", sql.Int, createdBy)
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), difficultyLevel)
      .query(`
        INSERT INTO QUESTION_TEMPLATES
        (
          TEMPLATE_NAME,
          QUESTION_IDS,
          SET_TYPE,
          DIFFICULTY_LEVEL,
          CREATED_BY,
          CREATED_AT,
          UPDATED_BY,
          UPDATED_AT,
          IS_ACTIVE
        )
        OUTPUT INSERTED.ID
        VALUES
        (
          @TEMPLATE_NAME,
          @QUESTION_IDS,
          'FINAL_ASSESSMENT',
          @DIFFICULTY_LEVEL,
          @CREATED_BY,
          GETDATE(),
          @CREATED_BY,
          GETDATE(),
          1
        )
      `);

    return res.status(201).json({
      status: 1,
      message: "Theory final assessment created successfully",
      data: {
        ID: result.recordset[0]?.ID,
        TEMPLATE_NAME: TEMPLATE_NAME.trim(),
        QUESTION_IDS: questionIds,
        DIFFICULTY_LEVEL: difficultyLevel,
        SET_TYPE: "FINAL_ASSESSMENT",
        ASSESSMENT_TYPE: "FINAL_ASSESSMENT",
      },
    });
  } catch (error) {
    console.error("❌ createTheoryAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to create theory final assessment",
      error: error.message,
    });
  }
};

// =====================================================
// THEORY: GET TUTOR FINAL ASSESSMENTS
// =====================================================
const getTutorTheoryAssessments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !Number.isInteger(Number(userId))) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    const pool = await getPool();

    // Check if user is Admin
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, Number(userId))
      .query(`SELECT USER_TYPE FROM USERS WHERE USER_ID = @USER_ID`);

    const user = userResult.recordset[0];
    const userType = user ? String(user.USER_TYPE || "").toUpperCase().trim() : "";
    const isAdmin = userType === "ADMIN";

    const request = pool
      .request()
      .input("USER_ID", sql.Int, Number(userId));

    let query = `
      SELECT
        qt.ID,
        qt.TEMPLATE_NAME,
        qt.QUESTION_IDS,
        COALESCE(
          NULLIF(qt.DIFFICULTY_LEVEL, ''),
          (
            SELECT TOP 1
              CASE
                WHEN qb.DIFFICULTY_LEVEL LIKE 'M[1-8]' THEN UPPER(qb.DIFFICULTY_LEVEL)
                WHEN qb.MODULE_ID IS NOT NULL THEN CONCAT('M', qb.MODULE_ID)
                ELSE NULL
              END
            FROM OPENJSON(CASE WHEN ISJSON(qt.QUESTION_IDS) = 1 THEN qt.QUESTION_IDS ELSE '[]' END) WITH (qid INT '$') j
            INNER JOIN QUESTION_BANK qb WITH (NOLOCK) ON qb.ID = j.qid
            WHERE qb.MODULE_ID IS NOT NULL OR qb.DIFFICULTY_LEVEL LIKE 'M[1-8]'
          ),
          '-'
        ) AS DIFFICULTY_LEVEL,
        ISNULL(qt.SET_TYPE, 'FINAL_ASSESSMENT') AS SET_TYPE,
        qt.CREATED_BY,
        qt.CREATED_AT,
        qt.UPDATED_BY,
        qt.UPDATED_AT,
        qt.IS_ACTIVE
      FROM QUESTION_TEMPLATES qt WITH (NOLOCK)
      WHERE ISNULL(qt.IS_ACTIVE, 1) = 1
        AND UPPER(qt.SET_TYPE) = 'FINAL_ASSESSMENT'
    `;

    if (!isAdmin) {
      query += `
        AND (
          qt.CREATED_BY = @USER_ID
          OR EXISTS (
            SELECT 1 FROM USERS u WITH (NOLOCK)
            WHERE u.USER_ID = qt.CREATED_BY AND UPPER(u.USER_TYPE) = 'ADMIN'
          )
        )
      `;
    }

    query += ` ORDER BY qt.ID DESC `;

    const result = await request.query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getTutorTheoryAssessments error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch theory final assessments",
      error: error.message,
    });
  }
};

// =====================================================
// THEORY: GET BY ID
// =====================================================
const getTheoryAssessmentById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid ID",
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("ID", sql.Int, id)
      .query(`
        SELECT
          ID,
          TEMPLATE_NAME,
          QUESTION_IDS,
          COALESCE(
            NULLIF(DIFFICULTY_LEVEL, ''),
            (
              SELECT TOP 1
                CASE
                  WHEN qb.DIFFICULTY_LEVEL LIKE 'M[1-8]' THEN UPPER(qb.DIFFICULTY_LEVEL)
                  WHEN qb.MODULE_ID IS NOT NULL THEN CONCAT('M', qb.MODULE_ID)
                  ELSE NULL
                END
              FROM OPENJSON(CASE WHEN ISJSON(QUESTION_IDS) = 1 THEN QUESTION_IDS ELSE '[]' END) WITH (qid INT '$') j
              INNER JOIN QUESTION_BANK qb WITH (NOLOCK) ON qb.ID = j.qid
              WHERE qb.MODULE_ID IS NOT NULL OR qb.DIFFICULTY_LEVEL LIKE 'M[1-8]'
            ),
            '-'
          ) AS DIFFICULTY_LEVEL,
          ISNULL(SET_TYPE, 'FINAL_ASSESSMENT') AS SET_TYPE,
          CREATED_BY,
          CREATED_AT,
          UPDATED_BY,
          UPDATED_AT,
          IS_ACTIVE
        FROM QUESTION_TEMPLATES WITH (NOLOCK)
        WHERE ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Theory final assessment not found",
      });
    }

    return res.json({
      status: 1,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("❌ getTheoryAssessmentById error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// THEORY: UPDATE
// =====================================================
const updateTheoryAssessment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { TEMPLATE_NAME, QUESTION_IDS, UPDATED_BY, DIFFICULTY_LEVEL } =
      req.body;

    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid ID",
      });
    }

    if (!TEMPLATE_NAME || !TEMPLATE_NAME.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Template name is required",
      });
    }

    let difficultyLevel = null;
    let hasDifficultyUpdate = false;
    if (DIFFICULTY_LEVEL !== undefined) {
      hasDifficultyUpdate = true;
      if (DIFFICULTY_LEVEL !== null && DIFFICULTY_LEVEL !== "") {
        const trimmedDifficulty = String(DIFFICULTY_LEVEL).trim();
        if (!ALLOWED_MODULE_CODES.includes(trimmedDifficulty)) {
          return res.status(400).json({
            status: 0,
            message: `Invalid Difficulty Level '${DIFFICULTY_LEVEL}'. Allowed values are: ${ALLOWED_MODULE_CODES.join(
              ", "
            )}`,
          });
        }
        difficultyLevel = trimmedDifficulty;
      }
    }

    let questionIds;
    try {
      questionIds =
        typeof QUESTION_IDS === "string"
          ? JSON.parse(QUESTION_IDS)
          : QUESTION_IDS;
    } catch {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs format",
      });
    }

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Select at least one question",
      });
    }

    questionIds = [
      ...new Set(
        questionIds.map(Number).filter((x) => Number.isInteger(x) && x > 0)
      ),
    ];

    const pool = await getPool();
    const idsString = questionIds.join(",");

    const questionResult = await pool.request().query(`
      SELECT ID
      FROM QUESTION_BANK
      WHERE ID IN (${idsString})
    `);

    if (questionResult.recordset.length !== questionIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected questions do not exist",
      });
    }

    await pool
      .request()
      .input("ID", sql.Int, id)
      .input("TEMPLATE_NAME", sql.NVarChar(255), TEMPLATE_NAME.trim())
      .input("QUESTION_IDS", sql.NVarChar(sql.MAX), JSON.stringify(questionIds))
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), difficultyLevel)
      .input("HAS_DIFFICULTY", sql.Bit, hasDifficultyUpdate ? 1 : 0)
      .input("UPDATED_BY", sql.Int, Number(UPDATED_BY) || 0)
      .query(`
        UPDATE QUESTION_TEMPLATES
        SET
          TEMPLATE_NAME = @TEMPLATE_NAME,
          QUESTION_IDS = @QUESTION_IDS,
          DIFFICULTY_LEVEL = CASE WHEN @HAS_DIFFICULTY = 1 THEN @DIFFICULTY_LEVEL ELSE DIFFICULTY_LEVEL END,
          UPDATED_BY = @UPDATED_BY,
          UPDATED_AT = GETDATE()
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: "Theory final assessment updated successfully",
      data: {
        ID: id,
        TEMPLATE_NAME: TEMPLATE_NAME.trim(),
        QUESTION_IDS: questionIds,
        DIFFICULTY_LEVEL: difficultyLevel,
      },
    });
  } catch (error) {
    console.error("❌ updateTheoryAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// THEORY: STATUS
// =====================================================
const updateTheoryAssessmentStatus = async (req, res) => {
  try {
    const { ID, IS_ACTIVE, UPDATED_BY } = req.body;
    const templateId = Number(ID);

    if (!templateId) {
      return res.status(400).json({
        status: 0,
        message: "Template ID is required",
      });
    }

    const isActive = IS_ACTIVE === 1 || IS_ACTIVE === true ? 1 : 0;
    const pool = await getPool();

    await pool
      .request()
      .input("ID", sql.Int, templateId)
      .input("IS_ACTIVE", sql.Bit, isActive)
      .input("UPDATED_BY", sql.Int, Number(UPDATED_BY) || 0)
      .query(`
        UPDATE QUESTION_TEMPLATES
        SET
          IS_ACTIVE = @IS_ACTIVE,
          UPDATED_BY = @UPDATED_BY,
          UPDATED_AT = GETDATE()
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: `Theory final assessment ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("❌ updateTheoryAssessmentStatus error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// THEORY: DELETE
// =====================================================
const deleteTheoryAssessment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid ID",
      });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("ID", sql.Int, id)
      .query(`
        DELETE FROM QUESTION_TEMPLATES
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: "Theory final assessment deleted successfully",
    });
  } catch (error) {
    console.error("❌ deleteTheoryAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: CREATE (FINAL_ASSESSMENTS)
// =====================================================
const createPracticalAssessment = async (req, res) => {
  try {
    const {
      TITLE,
      DESCRIPTION,
      BATCH_ID,
      CREATED_BY,
    } = req.body;

    if (!TITLE || !TITLE.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Title is required",
      });
    }

    if (!DESCRIPTION || !DESCRIPTION.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Description is required",
      });
    }

    const batchId = Number(BATCH_ID);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch selection is required",
      });
    }

    const createdBy = Number(CREATED_BY);
    if (!Number.isInteger(createdBy) || createdBy <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid creator user ID is required",
      });
    }

    const assessmentType = "FINAL_ASSESSMENT";
    const pool = await getPool();

    // Verify tutor ownership of the selected batch
    const isHost = await isTutorHostOfBatch(pool, createdBy, batchId);
    if (!isHost) {
      return res.status(403).json({
        status: 0,
        message: "You are not authorized to create an assessment for this batch (HOST role required)",
      });
    }

    const insertResult = await pool
      .request()
      .input("TITLE", sql.NVarChar(255), TITLE.trim())
      .input("DESCRIPTION", sql.NVarChar(sql.MAX), DESCRIPTION.trim())
      .input("BATCH_ID", sql.Int, batchId)
      .input("ASSESSMENT_TYPE", sql.VarChar(50), assessmentType)
      .input("CREATED_BY", sql.Int, createdBy)
      .query(`
        INSERT INTO FINAL_ASSESSMENTS
        (
          TITLE,
          DESCRIPTION,
          BATCH_ID,
          ASSESSMENT_TYPE,
          CREATED_BY,
          CREATED_AT,
          UPDATED_BY,
          UPDATED_AT,
          IS_ACTIVE
        )
        OUTPUT INSERTED.ID
        VALUES
        (
          @TITLE,
          @DESCRIPTION,
          @BATCH_ID,
          @ASSESSMENT_TYPE,
          @CREATED_BY,
          GETDATE(),
          @CREATED_BY,
          GETDATE(),
          1
        )
      `);

    return res.status(201).json({
      status: 1,
      message: "Practical final assessment created successfully",
      data: {
        ID: insertResult.recordset[0]?.ID,
        TITLE: TITLE.trim(),
        DESCRIPTION: DESCRIPTION.trim(),
        BATCH_ID: batchId,
        ASSESSMENT_TYPE: assessmentType,
        CREATED_BY: createdBy,
        IS_ACTIVE: 1,
      },
    });
  } catch (error) {
    console.error("❌ createPracticalAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to create practical final assessment",
      error: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: GET FOR TUTOR
// =====================================================
const getTutorPracticalAssessments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !Number.isInteger(Number(userId))) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    const tutorId = Number(userId);
    const pool = await getPool();

    const result = await pool
      .request()
      .input("USER_ID", sql.Int, tutorId)
      .query(`
        SELECT
          fa.ID,
          fa.TITLE,
          fa.DESCRIPTION,
          fa.BATCH_ID,
          b.BATCH_NAME,
          b.BATCH_CODE,
          fa.ASSESSMENT_TYPE,
          fa.CREATED_BY,
          fa.CREATED_AT,
          fa.UPDATED_BY,
          fa.UPDATED_AT,
          fa.IS_ACTIVE
        FROM FINAL_ASSESSMENTS fa
        LEFT JOIN BATCHES b ON b.ID = fa.BATCH_ID
        WHERE fa.CREATED_BY = @USER_ID
        ORDER BY fa.CREATED_AT DESC, fa.ID DESC
      `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getTutorPracticalAssessments error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch practical final assessments",
      error: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: UPDATE
// =====================================================
const updatePracticalAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { TITLE, DESCRIPTION, BATCH_ID, UPDATED_BY } = req.body;

    const assessmentId = Number(id);
    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid assessment ID is required",
      });
    }

    if (!TITLE || !TITLE.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Title is required",
      });
    }

    if (!DESCRIPTION || !DESCRIPTION.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Description is required",
      });
    }

    const batchId = Number(BATCH_ID);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch selection is required",
      });
    }

    const updatedBy = Number(UPDATED_BY) || 0;
    const pool = await getPool();

    if (updatedBy > 0) {
      const isHost = await isTutorHostOfBatch(pool, updatedBy, batchId);
      if (!isHost) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized for the selected batch",
        });
      }
    }

    await pool
      .request()
      .input("ID", sql.Int, assessmentId)
      .input("TITLE", sql.NVarChar(255), TITLE.trim())
      .input("DESCRIPTION", sql.NVarChar(sql.MAX), DESCRIPTION.trim())
      .input("BATCH_ID", sql.Int, batchId)
      .input("UPDATED_BY", sql.Int, updatedBy)
      .query(`
        UPDATE FINAL_ASSESSMENTS
        SET
          TITLE = @TITLE,
          DESCRIPTION = @DESCRIPTION,
          BATCH_ID = @BATCH_ID,
          UPDATED_BY = @UPDATED_BY,
          UPDATED_AT = GETDATE()
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: "Practical final assessment updated successfully",
    });
  } catch (error) {
    console.error("❌ updatePracticalAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to update practical final assessment",
      error: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: STATUS
// =====================================================
const updatePracticalAssessmentStatus = async (req, res) => {
  try {
    const { ID, IS_ACTIVE, UPDATED_BY } = req.body;
    const assessmentId = Number(ID);

    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid assessment ID is required",
      });
    }

    const isActive = IS_ACTIVE === 1 || IS_ACTIVE === true ? 1 : 0;
    const pool = await getPool();

    await pool
      .request()
      .input("ID", sql.Int, assessmentId)
      .input("IS_ACTIVE", sql.Bit, isActive)
      .input("UPDATED_BY", sql.Int, Number(UPDATED_BY) || 0)
      .query(`
        UPDATE FINAL_ASSESSMENTS
        SET
          IS_ACTIVE = @IS_ACTIVE,
          UPDATED_BY = @UPDATED_BY,
          UPDATED_AT = GETDATE()
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: `Practical final assessment ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("❌ updatePracticalAssessmentStatus error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// PRACTICAL: DELETE
// =====================================================
const deletePracticalAssessment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Valid assessment ID is required",
      });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("ID", sql.Int, id)
      .query(`
        DELETE FROM FINAL_ASSESSMENTS
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: "Practical final assessment deleted successfully",
    });
  } catch (error) {
    console.error("❌ deletePracticalAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// UNIFIED: GET ALL FINAL ASSESSMENTS (THEORY + PRACTICAL)
// =====================================================
const getAllFinalAssessments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !Number.isInteger(Number(userId))) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    const tutorId = Number(userId);
    const pool = await getPool();

    // Practical
    const practicalResult = await pool
      .request()
      .input("USER_ID", sql.Int, tutorId)
      .query(`
        SELECT
          fa.ID,
          fa.TITLE,
          fa.DESCRIPTION,
          fa.BATCH_ID,
          b.BATCH_NAME,
          b.BATCH_CODE,
          fa.ASSESSMENT_TYPE,
          'PRACTICAL' AS CATEGORY,
          fa.CREATED_BY,
          fa.CREATED_AT,
          fa.UPDATED_BY,
          fa.UPDATED_AT,
          fa.IS_ACTIVE
        FROM FINAL_ASSESSMENTS fa
        LEFT JOIN BATCHES b ON b.ID = fa.BATCH_ID
        WHERE fa.CREATED_BY = @USER_ID
      `);

    // Theory
    const theoryResult = await pool
      .request()
      .input("USER_ID", sql.Int, tutorId)
      .query(`
        SELECT
          qt.ID,
          qt.TEMPLATE_NAME AS TITLE,
          NULL AS DESCRIPTION,
          NULL AS BATCH_ID,
          'All Batches' AS BATCH_NAME,
          NULL AS BATCH_CODE,
          'THEORY' AS CATEGORY,
          qt.QUESTION_IDS,
          ISNULL(qt.SET_TYPE, 'FINAL_ASSESSMENT') AS SET_TYPE,
          qt.CREATED_BY,
          qt.CREATED_AT,
          qt.UPDATED_BY,
          qt.UPDATED_AT,
          qt.IS_ACTIVE
        FROM QUESTION_TEMPLATES qt WITH (NOLOCK)
        WHERE qt.CREATED_BY = @USER_ID
          AND UPPER(qt.SET_TYPE) = 'FINAL_ASSESSMENT'
      `);

    const practicalList = practicalResult.recordset.map((item) => ({
      ...item,
      CATEGORY: "PRACTICAL",
      QUESTION_COUNT: null,
    }));

    const theoryList = theoryResult.recordset.map((item) => {
      let qCount = 0;
      try {
        const parsed = JSON.parse(item.QUESTION_IDS || "[]");
        qCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        qCount = 0;
      }
      return {
        ...item,
        CATEGORY: "THEORY",
        QUESTION_COUNT: qCount,
      };
    });

    const combined = [...practicalList, ...theoryList].sort((a, b) => {
      const dateA = new Date(a.CREATED_AT || 0).getTime();
      const dateB = new Date(b.CREATED_AT || 0).getTime();
      return dateB - dateA;
    });

    return res.json({
      status: 1,
      data: combined,
    });
  } catch (error) {
    console.error("❌ getAllFinalAssessments error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch final assessments list",
      error: error.message,
    });
  }
};

// =====================================================
// STUDENT: GET ASSIGNED FINAL ASSESSMENT FOR BATCH
// =====================================================
const getStudentAssignedFinalAssessment = async (req, res) => {
  try {
    const { studentId } = req.params;
    const sId = Number(studentId);

    if (!sId || isNaN(sId) || sId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student user ID is required",
      });
    }

    const pool = await getPool();

    // 1. Get student's assigned active batch
    const batchResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .query(`
        SELECT TOP 1
          SA.BATCH_ID,
          B.BATCH_NAME,
          B.BATCH_CODE
        FROM STUDENT_ALLOCATIONS SA WITH (NOLOCK)
        INNER JOIN BATCHES B WITH (NOLOCK) ON B.ID = SA.BATCH_ID
        WHERE SA.STUDENT_ID = @STUDENT_ID
          AND ISNULL(B.IS_ACTIVE, 1) = 1
        ORDER BY SA.BATCH_ID
      `);

    if (batchResult.recordset.length === 0) {
      return res.json({
        status: 1,
        hasAssessment: false,
        data: null,
        message: "Student is not assigned to any active batch",
      });
    }

    const batch = batchResult.recordset[0];
    const batchId = Number(batch.BATCH_ID);

    // 2. Query ASSIGNMENT_ALERTS for THEORY final assessment
    // Strictly filter for FINAL_ASSESSMENT_THEORY (or SET_ID present)
    const alertResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT TOP 1
          AA.ASSIGNMENT_ID,
          AA.BATCH_ID,
          AA.SET_ID,
          AA.PROJECT_KIT_ID,
          AA.ASSESSMENT_TYPE,
          AA.CREATED_BY,
          AA.CREATED_AT,
          QT.TEMPLATE_NAME AS SET_NAME,
          QT.QUESTION_IDS,
          PK.KIT_NAME AS PROJECT_KIT_NAME,
          PK.IMAGE_URL AS PROJECT_KIT_IMAGE_URL
        FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)
        LEFT JOIN QUESTION_TEMPLATES QT WITH (NOLOCK) ON QT.ID = AA.SET_ID
        LEFT JOIN PROJECT_KITS PK WITH (NOLOCK) ON PK.ID = AA.PROJECT_KIT_ID
        WHERE AA.BATCH_ID = @BATCH_ID
          AND (
            UPPER(AA.ASSESSMENT_TYPE) = 'FINAL_ASSESSMENT_THEORY'
            OR (AA.SET_ID IS NOT NULL AND UPPER(AA.ASSESSMENT_TYPE) IN ('FINAL_ASSESSMENT', 'THEORY', 'BOTH'))
          )
        ORDER BY AA.CREATED_AT DESC
      `);

    const finalAlert = alertResult.recordset.length > 0 ? alertResult.recordset[0] : null;

    // 3. Query FINAL_ASSESSMENTS table for PRACTICAL final assessment assigned to this batch
    // Practical assessments have ASSESSMENT_TYPE = 'FINAL_ASSESSMENT' or 'FINAL_ASSESSMENT_PRACTICAL' (never FINAL_ASSESSMENT_THEORY)
    const faResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT TOP 1
          ID, TITLE, DESCRIPTION, BATCH_ID, ASSESSMENT_TYPE, CREATED_BY, CREATED_AT, IS_ACTIVE
        FROM FINAL_ASSESSMENTS WITH (NOLOCK)
        WHERE BATCH_ID = @BATCH_ID
          AND ISNULL(IS_ACTIVE, 1) = 1
          AND UPPER(ASSESSMENT_TYPE) NOT LIKE '%THEORY%'
          AND UPPER(ASSESSMENT_TYPE) IN ('FINAL_ASSESSMENT', 'FINAL_ASSESSMENT_PRACTICAL', 'PRACTICAL')
        ORDER BY CREATED_AT DESC
      `);
    const faRecord = faResult.recordset.length > 0 ? faResult.recordset[0] : null;

    const hasTheory = Boolean(finalAlert && finalAlert.SET_ID);
    const hasPractical = Boolean(faRecord && faRecord.ID);

    if (!hasTheory && !hasPractical) {
      return res.json({
        status: 1,
        hasAssessment: false,
        data: null,
        batchInfo: batch,
        message: "No active Final Assessment assigned to your batch",
      });
    }

    const theoryAssignmentId = hasTheory ? Number(finalAlert.ASSIGNMENT_ID) : 0;
    const practicalAssignmentId = hasPractical ? Number(faRecord.ID) : 0;

    // Parse question count and resolve Module for Theory component
    let questionCount = 0;
    let theoryModuleId = null;
    let theoryModuleName = "Theory Assessment";

    if (finalAlert?.QUESTION_IDS) {
      try {
        const parsed = JSON.parse(finalAlert.QUESTION_IDS);
        questionCount = Array.isArray(parsed) ? parsed.length : 0;

        if (Array.isArray(parsed) && parsed.length > 0) {
          // Resolve module from questions
          const validIds = parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
          if (validIds.length > 0) {
            const idListStr = validIds.join(",");
            const modCheck = await pool.request().query(`
              SELECT TOP 1 qb.MODULE_ID, m.MODULE_NAME
              FROM QUESTION_BANK qb WITH (NOLOCK)
              LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = qb.MODULE_ID
              WHERE qb.ID IN (${idListStr}) AND qb.MODULE_ID IS NOT NULL
            `);
            if (modCheck.recordset.length > 0) {
              theoryModuleId = modCheck.recordset[0].MODULE_ID;
              theoryModuleName = modCheck.recordset[0].MODULE_NAME || "Theory Assessment";
            }
          }
        }
      } catch (_) {
        questionCount = 0;
      }
    }

    // Check student exam attempt for Theory from ASSESMENT_EXAM
    let examAttempt = null;
    if (theoryAssignmentId > 0) {
      const examCheck = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .input("ASSESMENT_ID", sql.Int, theoryAssignmentId)
        .query(`
          SELECT TOP 1
            ae.ID AS ATTEMPT_ID,
            ae.STUDENT_ID,
            ae.ASSESMENT_ID,
            ae.TOTAL_QUESTIONS,
            ae.STUDENT_ANSWERED,
            ae.UNANSWERED,
            ae.UNVISITED,
            ae.STUDENT_MARK,
            ae.MARK_PERCENTAGE,
            ae.CREATED_ON
          FROM ASSESMENT_EXAM ae WITH (NOLOCK)
          WHERE ae.STUDENT_ID = @STUDENT_ID
            AND ae.ASSESMENT_ID = @ASSESMENT_ID
          ORDER BY ae.ID DESC
        `);
      examAttempt = examCheck.recordset.length > 0 ? examCheck.recordset[0] : null;
    }

    // Check student practical submission from STUDENT_ASSESSMENT_SUBMISSIONS
    let sasAttempt = null;
    if (practicalAssignmentId > 0) {
      const sasCheck = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .input("ASSESSMENT_ID", sql.Int, practicalAssignmentId)
        .query(`
          SELECT TOP 1
            sas.ID, sas.IMAGE_1, sas.VIDEO_1, sas.GIVEN_MARKS, sas.COMMENT, sas.GIVEN_BY, sas.REVIEWED_DATE,
            t.USERNAME AS EVALUATOR_NAME
          FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE sas.STUDENT_ID = @STUDENT_ID
            AND sas.ASSESSMENT_ID = @ASSESSMENT_ID
          ORDER BY sas.ID DESC
        `);
      sasAttempt = sasCheck.recordset.length > 0 ? sasCheck.recordset[0] : null;
    }

    const isTheoryCompleted = Boolean(examAttempt && (examAttempt.STUDENT_ANSWERED > 0 || examAttempt.MARK_PERCENTAGE !== null));
    const practicalImage = sasAttempt?.IMAGE_1 || null;
    const practicalVideo = sasAttempt?.VIDEO_1 || null;
    const isPracticalSubmitted = Boolean((practicalImage && practicalImage.trim()) || (practicalVideo && practicalVideo.trim()));
    const isPracticalEvaluated = Boolean(
      sasAttempt?.GIVEN_MARKS !== null && sasAttempt?.GIVEN_MARKS !== undefined && sasAttempt?.REVIEWED_DATE !== null
    );
    const practicalMark = sasAttempt?.GIVEN_MARKS !== null && sasAttempt?.GIVEN_MARKS !== undefined ? sasAttempt.GIVEN_MARKS : null;
    const practicalComment = sasAttempt?.COMMENT || "";
    const practicalReviewedDate = sasAttempt?.REVIEWED_DATE || null;
    const evaluatorName = sasAttempt?.EVALUATOR_NAME || null;

    // Determine default primary type
    let defaultType = "PRACTICAL";
    if (hasTheory && !hasPractical) {
      defaultType = "THEORY";
    } else if (hasPractical && !hasTheory) {
      defaultType = "PRACTICAL";
    } else if (hasTheory && hasPractical) {
      defaultType = "BOTH";
    }

    const practicalTitle = faRecord?.TITLE || "Practical Final Assessment";
    const practicalDescription = faRecord?.DESCRIPTION || "Complete the practical final assessment and submit the required evidence.";
    const theoryTitle = finalAlert?.SET_NAME || "Theory Final Assessment";
    const theoryDescription = `Final Assessment - Theory Questions`;

    const mainTitle = defaultType === "THEORY" ? theoryTitle : practicalTitle;
    const mainDescription = defaultType === "THEORY" ? theoryDescription : practicalDescription;
    const primaryId = practicalAssignmentId || theoryAssignmentId;

    return res.json({
      status: 1,
      hasAssessment: true,
      data: {
        ID: primaryId,
        ASSIGNMENT_ID: primaryId,
        FINAL_ASSESSMENT_ID: faRecord?.ID || practicalAssignmentId,
        TITLE: mainTitle,
        DESCRIPTION: mainDescription,
        BATCH_ID: batchId,
        BATCH_NAME: batch.BATCH_NAME,
        BATCH_CODE: batch.BATCH_CODE,
        ASSESSMENT_TYPE: defaultType,
        TYPE: defaultType,
        hasTheory,
        hasPractical,

        // Theory Component
        theory: hasTheory ? {
          ASSIGNMENT_ID: theoryAssignmentId,
          SET_ID: finalAlert?.SET_ID || null,
          SET_NAME: theoryTitle,
          MODULE_ID: theoryModuleId,
          MODULE_NAME: theoryModuleName,
          DESCRIPTION: theoryDescription,
          QUESTION_COUNT: questionCount,
          isAttempted: isTheoryCompleted,
          isCompleted: isTheoryCompleted,
          STUDENT_MARK: examAttempt?.STUDENT_MARK ?? null,
          MARK_PERCENTAGE: examAttempt?.MARK_PERCENTAGE ?? null,
          STUDENT_ANSWERED: examAttempt?.STUDENT_ANSWERED ?? 0,
          TOTAL_QUESTIONS: examAttempt?.TOTAL_QUESTIONS ?? questionCount,
          ATTEMPT_ID: examAttempt?.ATTEMPT_ID || null,
          COMPLETED_AT: examAttempt?.CREATED_ON || null,
        } : null,

        // Practical Component (Manual Mark Only)
        practical: hasPractical ? {
          ID: faRecord?.ID || practicalAssignmentId,
          TITLE: practicalTitle,
          DESCRIPTION: practicalDescription,
          IMAGE_1: practicalImage,
          VIDEO_1: practicalVideo,
          isSubmitted: isPracticalSubmitted,
          isEvaluated: isPracticalEvaluated,
          isCompleted: isPracticalSubmitted,
          GIVEN_MARKS: practicalMark,
          COMMENT: practicalComment,
          REVIEWED_DATE: practicalReviewedDate,
          EVALUATOR_NAME: evaluatorName,
        } : null,

        // Submission & evaluation details
        submission: sasAttempt ? {
          IMAGE_1: practicalImage,
          VIDEO_1: practicalVideo,
          GIVEN_MARKS: practicalMark,
          COMMENT: practicalComment,
        } : null,

        // Top level indicators for compatibility
        isSubmitted: hasPractical ? isPracticalSubmitted : isTheoryCompleted,
        isCompleted: hasPractical ? isPracticalSubmitted : isTheoryCompleted,
      },
    });
  } catch (error) {
    console.error("❌ getStudentAssignedFinalAssessment error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch student final assessment",
      error: error.message,
    });
  }
};

// =====================================================
// FILE UPLOAD MIDDLEWARE (2 FILES: 1 IMAGE, 1 VIDEO)
// =====================================================
const storage = multer.memoryStorage();

const uploadFinalAssessmentFiles = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per individual file limit before server-side optimization
  },
  fileFilter: (req, file, cb) => {
    const field = file.fieldname;
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (field === "image1") {
      const allowedImageExts = [".jpg", ".jpeg", ".png", ".webp"];
      if (mime.startsWith("image/") || allowedImageExts.includes(ext)) {
        return cb(null, true);
      }
      return cb(
        new Error(
          `Invalid file type for ${field}. Only JPG, JPEG, PNG, and WEBP are supported.`
        )
      );
    }

    if (field === "video1") {
      const allowedVideoExts = [".mp4", ".mov", ".webm", ".mkv"];
      if (mime.startsWith("video/") || allowedVideoExts.includes(ext)) {
        return cb(null, true);
      }
      return cb(
        new Error(
          `Invalid file type for ${field}. Only MP4, MOV, and WEBM are supported.`
        )
      );
    }

    return cb(null, true);
  },
}).fields([
  { name: "image1", maxCount: 1 },
  { name: "video1", maxCount: 1 },
]);

// =====================================================
// MEDIA COMPRESSION HELPERS
// =====================================================
const compressImageBuffer = async (buffer) => {
  return await sharp(buffer)
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
};

const compressVideoBuffer = (buffer, originalExt) => {
  return new Promise(async (resolve, reject) => {
    const tempDir = path.join(__dirname, "../uploads/temp");
    await fs.ensureDir(tempDir);

    const tempIn = path.join(
      tempDir,
      `in_${Date.now()}_${Math.random().toString(36).substring(7)}${originalExt || ".mp4"}`
    );
    const tempOut = path.join(
      tempDir,
      `out_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`
    );

    try {
      await fs.writeFile(tempIn, buffer);

      if (!ffmpegPath) {
        const origBuf = await fs.readFile(tempIn);
        await fs.remove(tempIn).catch(() => {});
        return resolve({ buffer: origBuf, ext: originalExt || ".mp4" });
      }

      ffmpeg(tempIn)
        .outputOptions([
          "-c:v libx264",
          "-crf 28",
          "-preset fast",
          "-c:a aac",
          "-b:a 96k",
          "-movflags +faststart",
          "-vf scale='min(1280,iw)':-2",
        ])
        .output(tempOut)
        .on("end", async () => {
          try {
            const outBuffer = await fs.readFile(tempOut);
            await fs.remove(tempIn);
            await fs.remove(tempOut);
            resolve({ buffer: outBuffer, ext: ".mp4" });
          } catch (readErr) {
            reject(readErr);
          }
        })
        .on("error", async (err) => {
          console.warn("⚠️ ffmpeg compression failed, falling back to original buffer:", err.message);
          try {
            await fs.remove(tempIn);
            await fs.remove(tempOut);
          } catch (_) {}
          resolve({ buffer, ext: originalExt || ".mp4" });
        })
        .run();
    } catch (e) {
      console.warn("⚠️ ffmpeg setup failed, fallback to original buffer:", e.message);
      resolve({ buffer, ext: originalExt || ".mp4" });
    }
  });
};

const submitFinalAssessmentProject = async (req, res) => {
  const writtenFilePaths = [];

  try {
    const { assessmentId, studentId } = req.body;
    const aId = Number(assessmentId);
    const sId = Number(studentId);

    if (!aId || isNaN(aId) || aId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid assessment ID is required.",
      });
    }

    if (!sId || isNaN(sId) || sId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student ID is required.",
      });
    }

    const files = req.files || {};
    const img1File = files.image1?.[0];
    const vid1File = files.video1?.[0];

    // At least one new file (image or video) must be supplied
    if (!img1File && !vid1File) {
      return res.status(400).json({
        status: 0,
        message: "Please select at least one file (Image or Video) to upload.",
      });
    }

    const pool = await getPool();

    // Verify assessment exists
    const aCheck = await pool
      .request()
      .input("ID", sql.Int, aId)
      .query(`
        SELECT ID, BATCH_ID, TITLE
        FROM FINAL_ASSESSMENTS WITH (NOLOCK)
        WHERE ID = @ID AND ISNULL(IS_ACTIVE, 1) = 1
      `);

    if (aCheck.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Active Final Assessment not found.",
      });
    }

    // Verify student is allocated to this batch
    const aRecord = aCheck.recordset[0];
    const saCheck = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .input("BATCH_ID", sql.Int, Number(aRecord.BATCH_ID))
      .query(`
        SELECT ID
        FROM STUDENT_ALLOCATIONS WITH (NOLOCK)
        WHERE STUDENT_ID = @STUDENT_ID AND BATCH_ID = @BATCH_ID
      `);

    if (saCheck.recordset.length === 0) {
      return res.status(403).json({
        status: 0,
        message: "You are not enrolled in the batch for this assessment.",
      });
    }

    // Check if submission already exists
    const existingCheck = await pool
      .request()
      .input("ASSESSMENT_ID", sql.Int, aId)
      .input("STUDENT_ID", sql.Int, sId)
      .query(`
        SELECT TOP 1
          ID,
          IMAGE_1,
          VIDEO_1,
          GIVEN_MARKS,
          COMMENT,
          REVIEWED_DATE
        FROM STUDENT_ASSESSMENT_SUBMISSIONS WITH (NOLOCK)
        WHERE ASSESSMENT_ID = @ASSESSMENT_ID AND STUDENT_ID = @STUDENT_ID
      `);

    const existingSub =
      existingCheck.recordset.length > 0 ? existingCheck.recordset[0] : null;

    // If already completed (both IMAGE_1 and VIDEO_1 exist), prevent further modifications
    const isAlreadyCompleted = Boolean(
      existingSub?.IMAGE_1 &&
      existingSub.IMAGE_1.trim() &&
      existingSub?.VIDEO_1 &&
      existingSub.VIDEO_1.trim()
    );

    if (isAlreadyCompleted) {
      return res.status(400).json({
        status: 0,
        message: "You have already completed this Final Assessment project.",
      });
    }

    // 1. Prepare target directory: uploads/Final-assessment/{studentId}
    const studentUploadDir = path.join(
      __dirname,
      `../uploads/Final-assessment/${sId}`
    );
    await fs.ensureDir(studentUploadDir);

    let finalImg1Path = existingSub?.IMAGE_1 || null;
    let finalVid1Path = existingSub?.VIDEO_1 || null;
    let totalBytes = 0;

    // 2. Compress and save image if provided
    if (img1File) {
      const compImg1 = await compressImageBuffer(img1File.buffer);
      totalBytes += compImg1.length;
      const img1Name = `image1.jpg`;
      const img1Full = path.join(studentUploadDir, img1Name);
      await fs.writeFile(img1Full, compImg1);
      writtenFilePaths.push(img1Full);
      finalImg1Path = `uploads/Final-assessment/${sId}/${img1Name}`;
    }

    // 3. Compress and save video if provided
    if (vid1File) {
      const compVid1 = await compressVideoBuffer(
        vid1File.buffer,
        path.extname(vid1File.originalname)
      );
      totalBytes += compVid1.buffer.length;
      const vid1Name = `video1${compVid1.ext}`;
      const vid1Full = path.join(studentUploadDir, vid1Name);
      await fs.writeFile(vid1Full, compVid1.buffer);
      writtenFilePaths.push(vid1Full);
      finalVid1Path = `uploads/Final-assessment/${sId}/${vid1Name}`;
    }

    const isNowCompleted = Boolean(
      finalImg1Path &&
      finalImg1Path.trim() &&
      finalVid1Path &&
      finalVid1Path.trim()
    );

    // 4. UPSERT into STUDENT_ASSESSMENT_SUBMISSIONS
    if (existingSub) {
      // Update existing row
      await pool
        .request()
        .input("SUBMISSION_ID", sql.Int, existingSub.ID)
        .input("IMAGE_1", sql.NVarChar(500), finalImg1Path)
        .input("VIDEO_1", sql.NVarChar(500), finalVid1Path)
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          UPDATE STUDENT_ASSESSMENT_SUBMISSIONS
          SET
            IMAGE_1 = @IMAGE_1,
            VIDEO_1 = @VIDEO_1,
            UPDATED_AT = SYSDATETIME(),
            UPDATED_BY = @STUDENT_ID
          WHERE ID = @SUBMISSION_ID
        `);
    } else {
      // Insert new row
      await pool
        .request()
        .input("ASSESSMENT_ID", sql.Int, aId)
        .input("STUDENT_ID", sql.Int, sId)
        .input("IMAGE_1", sql.NVarChar(500), finalImg1Path)
        .input("VIDEO_1", sql.NVarChar(500), finalVid1Path)
        .query(`
          INSERT INTO STUDENT_ASSESSMENT_SUBMISSIONS (
            ASSESSMENT_ID,
            STUDENT_ID,
            IMAGE_1,
            VIDEO_1,
            CREATED_AT,
            CREATED_BY
          ) VALUES (
            @ASSESSMENT_ID,
            @STUDENT_ID,
            @IMAGE_1,
            @VIDEO_1,
            GETDATE(),
            @STUDENT_ID
          )
        `);
    }

    return res.json({
      status: 1,
      message: isNowCompleted
        ? "Final Assessment completed and submitted successfully."
        : "Final Assessment progress saved successfully.",
      data: {
        assessmentId: aId,
        studentId: sId,
        totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
        IMAGE_1: finalImg1Path,
        VIDEO_1: finalVid1Path,
        hasImage: Boolean(finalImg1Path && finalImg1Path.trim()),
        hasVideo: Boolean(finalVid1Path && finalVid1Path.trim()),
        isCompleted: isNowCompleted,
      },
    });
  } catch (error) {
    console.error("❌ submitFinalAssessmentProject error:", error);

    for (const f of writtenFilePaths) {
      try {
        await fs.remove(f);
      } catch (_) {}
    }

    return res.status(500).json({
      status: 0,
      message: "Failed to submit Final Assessment",
      error: error.message,
    });
  }
};

// =====================================================
// GET STUDENT SUBMISSIONS FOR TUTOR EVALUATION
// Supports Assessment Type filtering: 'THEORY' | 'PRACTICAL'
// =====================================================
const getTutorBatchSubmissions = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { tutorId, assessmentType, type } = req.query;

    const bId = Number(batchId);
    const tId = Number(tutorId);
    const selectedType = (assessmentType || type || "THEORY").toUpperCase();

    if (!bId || isNaN(bId)) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch ID is required",
      });
    }

    const pool = await getPool();

    // Verify Tutor authorization for this batch if tutorId provided
    if (tId && !isNaN(tId)) {
      const isHost = await isTutorHostOfBatch(pool, tId, bId);
      if (!isHost) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to evaluate assessments for this batch",
        });
      }
    }

    // 1. Get student list for this batch
    const studentsRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          u.USER_ID AS STUDENT_ID,
          u.USERNAME AS STUDENT_NAME,
          u.EMAIL_ID AS STUDENT_EMAIL,
          u.ROLL_NO AS STUDENT_ROLL_NO,
          u.GRADE AS STUDENT_GRADE,
          u.SCHOOL_NAME,
          b.ID AS BATCH_ID,
          b.BATCH_NAME,
          b.BATCH_CODE
        FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
        INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
        WHERE sa.BATCH_ID = @BATCH_ID
        ORDER BY u.USERNAME ASC
      `);

    const students = studentsRes.recordset;

    if (selectedType === "THEORY") {
      // ----------------------------------------------------
      // THEORY SUBMISSIONS (from ASSIGNMENT_ALERTS + ASSESMENT_EXAM)
      // ----------------------------------------------------
      const alertRes = await pool
        .request()
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          SELECT TOP 1
            aa.ASSIGNMENT_ID,
            aa.SET_ID,
            aa.ASSESSMENT_TYPE,
            qt.TEMPLATE_NAME AS SET_NAME,
            qt.QUESTION_IDS
          FROM ASSIGNMENT_ALERTS aa WITH (NOLOCK)
          LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
          WHERE aa.BATCH_ID = @BATCH_ID
            AND (
              UPPER(aa.ASSESSMENT_TYPE) LIKE 'FINAL_ASSESSMENT%'
              OR UPPER(aa.ASSESSMENT_TYPE) IN ('FINAL_ASSESSMENT', 'FINAL_ASSESSMENT_THEORY', 'THEORY', 'BOTH')
              OR aa.SET_ID IS NOT NULL
            )
          ORDER BY aa.CREATED_AT DESC
        `);
      const faAlert = alertRes.recordset.length > 0 ? alertRes.recordset[0] : null;

      // Find all theory assignment IDs assigned to this batch to ensure we match student exam records
      const allAlertsRes = await pool
        .request()
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          SELECT aa.ASSIGNMENT_ID, aa.SET_ID
          FROM ASSIGNMENT_ALERTS aa WITH (NOLOCK)
          WHERE aa.BATCH_ID = @BATCH_ID
            AND (
              UPPER(aa.ASSESSMENT_TYPE) LIKE 'FINAL_ASSESSMENT%'
              OR UPPER(aa.ASSESSMENT_TYPE) IN ('FINAL_ASSESSMENT', 'FINAL_ASSESSMENT_THEORY', 'THEORY', 'BOTH')
              OR aa.SET_ID IS NOT NULL
            )
        `);
      const alertIds = allAlertsRes.recordset
        .map((r) => Number(r.ASSIGNMENT_ID))
        .filter((id) => Number.isInteger(id) && id > 0);

      let examRes;
      if (alertIds.length > 0) {
        examRes = await pool
          .request()
          .input("BATCH_ID", sql.Int, bId)
          .query(`
            SELECT
              ae.ID AS ATTEMPT_ID,
              ae.STUDENT_ID,
              ae.ASSESMENT_ID,
              ae.TOTAL_QUESTIONS,
              ae.STUDENT_ANSWERED,
              ae.STUDENT_MARK,
              ae.MARK_PERCENTAGE,
              ae.STUDENT_ANSWER,
              ae.PROJECT_KIT_MARK,
              ae.PROJECT_KIT_COMMENT,
              ae.PROJECT_KIT_EVALUATED_BY,
              ae.PROJECT_KIT_REVIEWED_DATE,
              ae.IS_PROJECT_KIT_EVALUATED,
              ae.CREATED_ON,
              t.USERNAME AS EVALUATOR_NAME
            FROM ASSESMENT_EXAM ae WITH (NOLOCK)
            INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
            LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = ae.PROJECT_KIT_EVALUATED_BY
            WHERE sa.BATCH_ID = @BATCH_ID
              AND ae.ASSESMENT_ID IN (${alertIds.join(",")})
            ORDER BY ae.ID DESC
          `);
      } else {
        examRes = await pool
          .request()
          .input("BATCH_ID", sql.Int, bId)
          .query(`
            SELECT
              ae.ID AS ATTEMPT_ID,
              ae.STUDENT_ID,
              ae.ASSESMENT_ID,
              ae.TOTAL_QUESTIONS,
              ae.STUDENT_ANSWERED,
              ae.STUDENT_MARK,
              ae.MARK_PERCENTAGE,
              ae.STUDENT_ANSWER,
              ae.PROJECT_KIT_MARK,
              ae.PROJECT_KIT_COMMENT,
              ae.PROJECT_KIT_EVALUATED_BY,
              ae.PROJECT_KIT_REVIEWED_DATE,
              ae.IS_PROJECT_KIT_EVALUATED,
              ae.CREATED_ON,
              t.USERNAME AS EVALUATOR_NAME
            FROM ASSESMENT_EXAM ae WITH (NOLOCK)
            INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
            LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = ae.PROJECT_KIT_EVALUATED_BY
            WHERE sa.BATCH_ID = @BATCH_ID
            ORDER BY ae.ID DESC
          `);
      }

      const examMap = new Map();
      examRes.recordset.forEach((r) => {
        if (!examMap.has(Number(r.STUDENT_ID))) {
          examMap.set(Number(r.STUDENT_ID), r);
        }
      });

      const rows = students.map((s, idx) => {
        const exam = examMap.get(Number(s.STUDENT_ID));
        const isSubmitted = Boolean(
          exam && (
            (exam.STUDENT_ANSWERED !== null && Number(exam.STUDENT_ANSWERED) > 0) ||
            exam.MARK_PERCENTAGE !== null ||
            exam.STUDENT_MARK !== null ||
            (exam.STUDENT_ANSWER && exam.STUDENT_ANSWER.trim() !== "" && exam.STUDENT_ANSWER !== "[]")
          )
        );
        
        let parsedAnswers = [];
        if (exam?.STUDENT_ANSWER) {
          try {
            parsedAnswers = JSON.parse(exam.STUDENT_ANSWER);
          } catch (_) {
            parsedAnswers = [];
          }
        }

        // Determine if evaluated: only when evaluated by Tutor (IS_PROJECT_KIT_EVALUATED = 1 or reviewed by tutor)
        const isEvaluated = Boolean(
          isSubmitted &&
          exam && (
            exam.IS_PROJECT_KIT_EVALUATED === 1 ||
            exam.IS_PROJECT_KIT_EVALUATED === true ||
            (exam.PROJECT_KIT_REVIEWED_DATE !== null && exam.PROJECT_KIT_EVALUATED_BY !== null)
          )
        );

        const mark = isEvaluated
          ? (exam?.PROJECT_KIT_MARK !== null && exam?.PROJECT_KIT_MARK !== undefined
              ? exam.PROJECT_KIT_MARK
              : exam?.STUDENT_MARK !== null && exam?.STUDENT_MARK !== undefined
              ? exam.STUDENT_MARK
              : exam?.MARK_PERCENTAGE ?? null)
          : null;

        return {
          SUBMISSION_ID: isSubmitted && exam?.ATTEMPT_ID ? exam.ATTEMPT_ID : (idx + 1),
          ATTEMPT_ID: isSubmitted && exam?.ATTEMPT_ID ? exam.ATTEMPT_ID : null,
          ASSESSMENT_ID: faAlert?.ASSIGNMENT_ID || exam?.ASSESMENT_ID || 0,
          SET_ID: faAlert?.SET_ID || null,
          STUDENT_ID: s.STUDENT_ID,
          STUDENT_NAME: s.STUDENT_NAME,
          STUDENT_EMAIL: s.STUDENT_EMAIL,
          STUDENT_ROLL_NO: s.STUDENT_ROLL_NO,
          STUDENT_GRADE: s.STUDENT_GRADE,
          SCHOOL_NAME: s.SCHOOL_NAME,
          BATCH_ID: s.BATCH_ID,
          BATCH_NAME: s.BATCH_NAME,
          BATCH_CODE: s.BATCH_CODE,
          ASSESSMENT_TITLE: faAlert?.SET_NAME || "Theory Final Assessment",
          ASSESSMENT_TYPE: "THEORY",
          TYPE: "THEORY",
          TOTAL_QUESTIONS: isSubmitted ? (exam?.TOTAL_QUESTIONS || 0) : 0,
          STUDENT_ANSWERED: isSubmitted ? (exam?.STUDENT_ANSWERED || 0) : 0,
          STUDENT_ANSWER: isSubmitted ? parsedAnswers : [],
          GIVEN_MARKS: mark,
          MARK_PERCENTAGE: isEvaluated ? (exam?.MARK_PERCENTAGE ?? null) : null,
          COMMENT: isEvaluated ? (exam?.PROJECT_KIT_COMMENT || "") : "",
          EVALUATOR_NAME: isEvaluated ? (exam?.EVALUATOR_NAME || null) : null,
          SUBMITTED_AT: isSubmitted ? (exam?.CREATED_ON || null) : null,
          EVALUATED_AT: isEvaluated ? (exam?.PROJECT_KIT_REVIEWED_DATE || exam?.CREATED_ON || null) : null,
          STATUS: isSubmitted ? "Submitted" : "Pending",
          isEvaluated: isEvaluated,
        };
      });

      return res.json({
        status: 1,
        assessmentType: "THEORY",
        data: rows,
      });
    } else {
      // ----------------------------------------------------
      // PRACTICAL SUBMISSIONS (from FINAL_ASSESSMENTS + STUDENT_ASSESSMENT_SUBMISSIONS)
      // ----------------------------------------------------
      const faRes = await pool
        .request()
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          SELECT TOP 1 ID, TITLE, DESCRIPTION, ASSESSMENT_TYPE
          FROM FINAL_ASSESSMENTS WITH (NOLOCK)
          WHERE BATCH_ID = @BATCH_ID AND ISNULL(IS_ACTIVE, 1) = 1
          ORDER BY CREATED_AT DESC
        `);
      const faRow = faRes.recordset.length > 0 ? faRes.recordset[0] : null;

      const sasRes = await pool
        .request()
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          SELECT
            sas.ID AS SUBMISSION_ID,
            sas.ASSESSMENT_ID,
            sas.STUDENT_ID,
            sas.IMAGE_1,
            sas.VIDEO_1,
            sas.GIVEN_MARKS,
            sas.COMMENT,
            sas.GIVEN_BY,
            sas.REVIEWED_DATE,
            sas.CREATED_AT,
            sas.UPDATED_AT,
            t.USERNAME AS EVALUATOR_NAME
          FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE sa.BATCH_ID = @BATCH_ID
          ORDER BY sas.ID DESC
        `);

      const sasMap = new Map();
      sasRes.recordset.forEach((r) => {
        if (!sasMap.has(Number(r.STUDENT_ID))) {
          sasMap.set(Number(r.STUDENT_ID), r);
        }
      });

      const assessmentTitle = faRow?.TITLE || "Practical Final Assessment";
      const assessmentDesc = faRow?.DESCRIPTION || "Practical Final Assessment Task";

      const rows = students.map((s, idx) => {
        const sas = sasMap.get(Number(s.STUDENT_ID));
        const submissionId = sas?.SUBMISSION_ID || (idx + 1);
        const img = sas?.IMAGE_1 || null;
        const vid = sas?.VIDEO_1 || null;
        const isSubmitted = Boolean(sas && ((img && img.trim()) || (vid && vid.trim())));
        const isEvaluated = Boolean(isSubmitted && sas && sas.GIVEN_MARKS !== null && sas.GIVEN_MARKS !== undefined && sas.REVIEWED_DATE !== null);
        const mark = isEvaluated ? sas.GIVEN_MARKS : null;
        const comment = isEvaluated ? (sas?.COMMENT || "") : "";
        const evaluatedBy = isEvaluated ? (sas?.GIVEN_BY || null) : null;
        const reviewedDate = isEvaluated ? (sas?.REVIEWED_DATE || null) : null;
        const evaluatorName = isEvaluated ? (sas?.EVALUATOR_NAME || null) : null;
        const submittedAt = isSubmitted ? (sas?.CREATED_AT || null) : null;

        return {
          SUBMISSION_ID: submissionId,
          ASSESSMENT_ID: faRow?.ID || sas?.ASSESSMENT_ID || 0,
          STUDENT_ID: s.STUDENT_ID,
          STUDENT_NAME: s.STUDENT_NAME,
          STUDENT_EMAIL: s.STUDENT_EMAIL,
          STUDENT_ROLL_NO: s.STUDENT_ROLL_NO,
          STUDENT_GRADE: s.STUDENT_GRADE,
          SCHOOL_NAME: s.SCHOOL_NAME,
          BATCH_ID: s.BATCH_ID,
          BATCH_NAME: s.BATCH_NAME,
          BATCH_CODE: s.BATCH_CODE,
          ASSESSMENT_TITLE: assessmentTitle,
          ASSESSMENT_DESCRIPTION: assessmentDesc,
          ASSESSMENT_TYPE: "PRACTICAL",
          TYPE: "PRACTICAL",
          IMAGE_1: isSubmitted ? img : null,
          VIDEO_1: isSubmitted ? vid : null,
          GIVEN_MARKS: mark,
          COMMENT: comment,
          GIVEN_BY: evaluatedBy,
          REVIEWED_DATE: reviewedDate,
          EVALUATOR_NAME: evaluatorName,
          SUBMITTED_AT: submittedAt,
          EVALUATED_AT: reviewedDate,
          STATUS: isSubmitted ? "Submitted" : "Pending",
          isEvaluated: isEvaluated,
        };
      });

      return res.json({
        status: 1,
        assessmentType: "PRACTICAL",
        data: rows,
      });
    }
  } catch (error) {
    console.error("❌ getTutorBatchSubmissions error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch student submissions for evaluation",
      error: error.message,
    });
  }
};

// =====================================================
// TUTOR: GET SUBMISSION PREVIEW / QUESTION-BY-QUESTION
// =====================================================
const getSubmissionPreview = async (req, res) => {
  try {
    const { submissionId, studentId, batchId, assessmentType, type, tutorId } = req.query;

    const sId = Number(submissionId);
    const studId = Number(studentId);
    const bId = Number(batchId);
    const tId = Number(tutorId);
    const selectedType = (assessmentType || type || "").toUpperCase();

    const pool = await getPool();

    // If studentId and batchId are provided, verify tutor host rights
    if (tId && bId && !isNaN(tId) && !isNaN(bId)) {
      const isHost = await isTutorHostOfBatch(pool, tId, bId);
      if (!isHost) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to view this submission",
        });
      }
    }

    if (selectedType === "THEORY" || (!selectedType && studId && !sId)) {
      // 1. Try to find ASSESMENT_EXAM row
      let examQuery = `
        SELECT TOP 1
          ae.ID AS SUBMISSION_ID,
          ae.ASSESMENT_ID,
          ae.STUDENT_ID,
          ae.TOTAL_QUESTIONS,
          ae.STUDENT_ANSWERED,
          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.STUDENT_ANSWER,
          ae.PROJECT_KIT_MARK,
          ae.PROJECT_KIT_COMMENT,
          ae.PROJECT_KIT_EVALUATED_BY,
          ae.PROJECT_KIT_REVIEWED_DATE,
          ae.IS_PROJECT_KIT_EVALUATED,
          ae.CREATED_ON AS SUBMITTED_AT,
          u.USERNAME AS STUDENT_NAME,
          u.EMAIL_ID AS STUDENT_EMAIL,
          u.ROLL_NO AS STUDENT_ROLL_NO,
          u.GRADE AS STUDENT_GRADE,
          u.SCHOOL_NAME,
          b.ID AS BATCH_ID,
          b.BATCH_NAME,
          b.BATCH_CODE,
          t.USERNAME AS EVALUATOR_NAME,
          aa.SET_ID,
          qt.TEMPLATE_NAME AS ASSESSMENT_TITLE,
          qt.QUESTION_IDS
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = ae.STUDENT_ID
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
        INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
        LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
        LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
        LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = ae.PROJECT_KIT_EVALUATED_BY
        WHERE 1=1
      `;

      const reqExam = pool.request();
      if (sId && sId > 0 && selectedType === "THEORY") {
        reqExam.input("ID", sql.Int, sId);
        examQuery += ` AND ae.ID = @ID`;
      } else if (studId && studId > 0) {
        reqExam.input("STUDENT_ID", sql.Int, studId);
        examQuery += ` AND ae.STUDENT_ID = @STUDENT_ID`;
      }

      if (bId && bId > 0) {
        reqExam.input("BATCH_ID", sql.Int, bId);
        examQuery += ` AND sa.BATCH_ID = @BATCH_ID`;
      }

      examQuery += ` ORDER BY ae.ID DESC`;
      const examRes = await reqExam.query(examQuery);

      if (examRes.recordset.length > 0) {
        const row = examRes.recordset[0];
        const isSubmitted = Boolean(
          row.SUBMITTED_AT ||
          (row.STUDENT_ANSWERED !== null && Number(row.STUDENT_ANSWERED) > 0) ||
          row.STUDENT_MARK !== null ||
          row.MARK_PERCENTAGE !== null ||
          (row.STUDENT_ANSWER && row.STUDENT_ANSWER.trim() !== "" && row.STUDENT_ANSWER !== "[]")
        );

        let parsedAnswers = [];
        try {
          parsedAnswers = row.STUDENT_ANSWER ? JSON.parse(row.STUDENT_ANSWER) : [];
        } catch (_) {
          parsedAnswers = [];
        }

        const questionsList = parsedAnswers.map((q, qIndex) => ({
          QUESTION_INDEX: qIndex + 1,
          QUESTION_ID: q.QUESTION_ID || qIndex + 1,
          QUESTION_TEXT: q.QUESTION || `Question ${qIndex + 1}`,
          QUESTION_TYPE: q.QUESTION_TYPE || "SHORT ESSAY",
          STUDENT_ANSWER: isSubmitted ? (q.STUDENT_ANSWER || q.studentAnswer || "No answer submitted") : "No answer submitted",
          CORRECT_ANSWER: q.CORRECT_ANSWER || null,
        }));

        const isEvaluated = Boolean(
          isSubmitted && (
            row.IS_PROJECT_KIT_EVALUATED === 1 ||
            row.IS_PROJECT_KIT_EVALUATED === true ||
            (row.PROJECT_KIT_REVIEWED_DATE !== null && row.PROJECT_KIT_EVALUATED_BY !== null)
          )
        );

        const givenMarks = isEvaluated
          ? (row.PROJECT_KIT_MARK !== null && row.PROJECT_KIT_MARK !== undefined
              ? row.PROJECT_KIT_MARK
              : row.STUDENT_MARK ?? row.MARK_PERCENTAGE)
          : null;

        return res.json({
          status: 1,
          data: {
            SUBMISSION_ID: isSubmitted ? row.SUBMISSION_ID : 0,
            ATTEMPT_ID: isSubmitted ? row.SUBMISSION_ID : null,
            ASSESSMENT_ID: row.ASSESMENT_ID,
            STUDENT_ID: row.STUDENT_ID,
            STUDENT_NAME: row.STUDENT_NAME,
            STUDENT_EMAIL: row.STUDENT_EMAIL,
            STUDENT_ROLL_NO: row.STUDENT_ROLL_NO,
            STUDENT_GRADE: row.STUDENT_GRADE,
            SCHOOL_NAME: row.SCHOOL_NAME,
            BATCH_ID: row.BATCH_ID,
            BATCH_NAME: row.BATCH_NAME,
            BATCH_CODE: row.BATCH_CODE,
            ASSESSMENT_TITLE: row.ASSESSMENT_TITLE || "Theory Final Assessment",
            ASSESSMENT_DESCRIPTION: "Theory Final Assessment Questions",
            ASSESSMENT_TYPE: "THEORY",
            GIVEN_MARKS: givenMarks,
            COMMENT: isEvaluated ? (row.PROJECT_KIT_COMMENT || "") : "",
            EVALUATOR_NAME: isEvaluated ? (row.EVALUATOR_NAME || null) : null,
            SUBMITTED_AT: isSubmitted ? row.SUBMITTED_AT : null,
            EVALUATED_AT: isEvaluated ? (row.PROJECT_KIT_REVIEWED_DATE || null) : null,
            STATUS: isSubmitted ? "Submitted" : "Pending",
            isEvaluated: isEvaluated,
            questions: questionsList,
          },
        });
      }

      // If Theory student has no exam attempt yet, fetch student details and question template to show unsubmitted preview
      if (studId && studId > 0) {
        const studInfoRes = await pool
          .request()
          .input("STUDENT_ID", sql.Int, studId)
          .input("BATCH_ID", sql.Int, bId || 0)
          .query(`
            SELECT TOP 1
              u.USER_ID AS STUDENT_ID,
              u.USERNAME AS STUDENT_NAME,
              u.EMAIL_ID AS STUDENT_EMAIL,
              u.ROLL_NO AS STUDENT_ROLL_NO,
              u.GRADE AS STUDENT_GRADE,
              u.SCHOOL_NAME,
              b.ID AS BATCH_ID,
              b.BATCH_NAME,
              b.BATCH_CODE,
              aa.ASSIGNMENT_ID,
              aa.SET_ID,
              qt.TEMPLATE_NAME AS ASSESSMENT_TITLE,
              qt.QUESTION_IDS
            FROM USERS u WITH (NOLOCK)
            INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = u.USER_ID
            INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
            LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.BATCH_ID = b.ID
              AND (
                UPPER(aa.ASSESSMENT_TYPE) LIKE 'FINAL_ASSESSMENT%'
                OR UPPER(aa.ASSESSMENT_TYPE) IN ('FINAL_ASSESSMENT', 'FINAL_ASSESSMENT_THEORY', 'THEORY', 'BOTH')
                OR aa.SET_ID IS NOT NULL
              )
            LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
            WHERE u.USER_ID = @STUDENT_ID
              AND (sa.BATCH_ID = @BATCH_ID OR @BATCH_ID = 0)
            ORDER BY aa.CREATED_AT DESC
          `);

        if (studInfoRes.recordset.length > 0) {
          const sRow = studInfoRes.recordset[0];
          let questionsList = [];
          if (sRow.QUESTION_IDS) {
            try {
              const qIds = typeof sRow.QUESTION_IDS === "string" ? JSON.parse(sRow.QUESTION_IDS) : sRow.QUESTION_IDS;
              if (Array.isArray(qIds) && qIds.length > 0) {
                const numericQIds = qIds.map(Number).filter((n) => !isNaN(n));
                if (numericQIds.length > 0) {
                  const qBankRes = await pool.request().query(`
                    SELECT ID, QUESTION, QUESTION_TYPE, ANSWER
                    FROM QUESTION_BANK WITH (NOLOCK)
                    WHERE ID IN (${numericQIds.join(",")})
                  `);
                  const qMap = new Map();
                  qBankRes.recordset.forEach((qb) => qMap.set(Number(qb.ID), qb));
                  questionsList = numericQIds.map((qid, idx) => {
                    const qObj = qMap.get(qid);
                    return {
                      QUESTION_INDEX: idx + 1,
                      QUESTION_ID: qid,
                      QUESTION_TEXT: qObj?.QUESTION || `Question ${idx + 1}`,
                      QUESTION_TYPE: qObj?.QUESTION_TYPE || "SHORT ESSAY",
                      STUDENT_ANSWER: "No answer submitted",
                      CORRECT_ANSWER: qObj?.ANSWER || null,
                    };
                  });
                }
              }
            } catch (_) {}
          }

          return res.json({
            status: 1,
            data: {
              SUBMISSION_ID: 0,
              ATTEMPT_ID: null,
              ASSESSMENT_ID: sRow.ASSIGNMENT_ID || 0,
              STUDENT_ID: sRow.STUDENT_ID,
              STUDENT_NAME: sRow.STUDENT_NAME,
              STUDENT_EMAIL: sRow.STUDENT_EMAIL,
              STUDENT_ROLL_NO: sRow.STUDENT_ROLL_NO,
              STUDENT_GRADE: sRow.STUDENT_GRADE,
              SCHOOL_NAME: sRow.SCHOOL_NAME,
              BATCH_ID: sRow.BATCH_ID,
              BATCH_NAME: sRow.BATCH_NAME,
              BATCH_CODE: sRow.BATCH_CODE,
              ASSESSMENT_TITLE: sRow.ASSESSMENT_TITLE || "Theory Final Assessment",
              ASSESSMENT_DESCRIPTION: "Theory Final Assessment Questions",
              ASSESSMENT_TYPE: "THEORY",
              GIVEN_MARKS: null,
              COMMENT: "",
              EVALUATOR_NAME: null,
              SUBMITTED_AT: null,
              EVALUATED_AT: null,
              STATUS: "Pending",
              isEvaluated: false,
              questions: questionsList,
            },
          });
        }
      }
    }

    // 2. Check PRACTICAL submission from STUDENT_ASSESSMENT_SUBMISSIONS
    let sub = null;
    if (sId && !isNaN(sId)) {
      const subResult = await pool
        .request()
        .input("SUBMISSION_ID", sql.Int, sId)
        .query(`
          SELECT TOP 1
            sas.ID AS SUBMISSION_ID,
            sas.ASSESSMENT_ID,
            sas.STUDENT_ID,
            u.USERNAME AS STUDENT_NAME,
            u.EMAIL_ID AS STUDENT_EMAIL,
            u.ROLL_NO AS STUDENT_ROLL_NO,
            u.GRADE AS STUDENT_GRADE,
            u.SCHOOL_NAME,
            b.ID AS BATCH_ID,
            b.BATCH_NAME,
            b.BATCH_CODE,
            ISNULL(fa.TITLE, 'Practical Final Assessment') AS ASSESSMENT_TITLE,
            ISNULL(fa.DESCRIPTION, 'Practical Final Assessment Task') AS ASSESSMENT_DESCRIPTION,
            'PRACTICAL' AS ASSESSMENT_TYPE,
            sas.IMAGE_1,
            sas.VIDEO_1,
            sas.GIVEN_MARKS,
            sas.COMMENT,
            sas.GIVEN_BY,
            sas.REVIEWED_DATE,
            t.USERNAME AS EVALUATOR_NAME,
            sas.CREATED_AT AS SUBMITTED_AT,
            sas.UPDATED_AT AS EVALUATED_AT
          FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sas.STUDENT_ID
          INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
          INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
          LEFT JOIN FINAL_ASSESSMENTS fa WITH (NOLOCK) ON fa.ID = sas.ASSESSMENT_ID
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE sas.ID = @SUBMISSION_ID
        `);
      if (subResult.recordset.length > 0) {
        sub = subResult.recordset[0];
      }
    }

    if (!sub && studId) {
      const subByStud = await pool
        .request()
        .input("STUDENT_ID", sql.Int, studId)
        .query(`
          SELECT TOP 1
            sas.ID AS SUBMISSION_ID,
            sas.ASSESSMENT_ID,
            sas.STUDENT_ID,
            u.USERNAME AS STUDENT_NAME,
            u.EMAIL_ID AS STUDENT_EMAIL,
            u.ROLL_NO AS STUDENT_ROLL_NO,
            u.GRADE AS STUDENT_GRADE,
            u.SCHOOL_NAME,
            b.ID AS BATCH_ID,
            b.BATCH_NAME,
            b.BATCH_CODE,
            ISNULL(fa.TITLE, 'Practical Final Assessment') AS ASSESSMENT_TITLE,
            ISNULL(fa.DESCRIPTION, 'Practical Final Assessment Task') AS ASSESSMENT_DESCRIPTION,
            'PRACTICAL' AS ASSESSMENT_TYPE,
            sas.IMAGE_1,
            sas.VIDEO_1,
            sas.GIVEN_MARKS,
            sas.COMMENT,
            sas.GIVEN_BY,
            sas.REVIEWED_DATE,
            t.USERNAME AS EVALUATOR_NAME,
            sas.CREATED_AT AS SUBMITTED_AT,
            sas.UPDATED_AT AS EVALUATED_AT
          FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sas.STUDENT_ID
          INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
          INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
          LEFT JOIN FINAL_ASSESSMENTS fa WITH (NOLOCK) ON fa.ID = sas.ASSESSMENT_ID
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE sas.STUDENT_ID = @STUDENT_ID
          ORDER BY sas.ID DESC
        `);
      if (subByStud.recordset.length > 0) {
        sub = subByStud.recordset[0];
      }
    }

    if (!sub && studId) {
      const studInfo = await pool
        .request()
        .input("STUDENT_ID", sql.Int, studId)
        .query(`
          SELECT TOP 1
            0 AS SUBMISSION_ID,
            0 AS ASSESSMENT_ID,
            u.USER_ID AS STUDENT_ID,
            u.USERNAME AS STUDENT_NAME,
            u.EMAIL_ID AS STUDENT_EMAIL,
            u.ROLL_NO AS STUDENT_ROLL_NO,
            u.GRADE AS STUDENT_GRADE,
            u.SCHOOL_NAME,
            b.ID AS BATCH_ID,
            b.BATCH_NAME,
            b.BATCH_CODE,
            'Practical Final Assessment' AS ASSESSMENT_TITLE,
            'Practical Final Assessment Task' AS ASSESSMENT_DESCRIPTION,
            'PRACTICAL' AS ASSESSMENT_TYPE,
            NULL AS IMAGE_1,
            NULL AS VIDEO_1,
            NULL AS GIVEN_MARKS,
            NULL AS COMMENT,
            NULL AS GIVEN_BY,
            NULL AS REVIEWED_DATE,
            NULL AS EVALUATOR_NAME,
            NULL AS SUBMITTED_AT,
            NULL AS EVALUATED_AT
          FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
          INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
          INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = sa.BATCH_ID
          WHERE sa.STUDENT_ID = @STUDENT_ID
        `);
      if (studInfo.recordset.length > 0) {
        sub = studInfo.recordset[0];
      }
    }

    if (!sub) {
      return res.status(404).json({
        status: 0,
        message: "Submission not found",
      });
    }

    const isPracticalSubmitted = Boolean(
      (sub.IMAGE_1 && sub.IMAGE_1.trim()) || (sub.VIDEO_1 && sub.VIDEO_1.trim())
    );
    const isPracticalEvaluated = Boolean(
      isPracticalSubmitted &&
      sub.GIVEN_MARKS !== null &&
      sub.GIVEN_MARKS !== undefined &&
      sub.REVIEWED_DATE !== null
    );

    return res.json({
      status: 1,
      data: {
        ...sub,
        SUBMITTED_AT: isPracticalSubmitted ? sub.SUBMITTED_AT : null,
        GIVEN_MARKS: isPracticalEvaluated ? sub.GIVEN_MARKS : null,
        COMMENT: isPracticalEvaluated ? (sub.COMMENT || "") : "",
        STATUS: isPracticalSubmitted ? "Submitted" : "Pending",
        isEvaluated: isPracticalEvaluated,
        questions: [
          {
            QUESTION_INDEX: 1,
            QUESTION_ID: sub.ASSESSMENT_ID || 1,
            QUESTION_TEXT: sub.ASSESSMENT_DESCRIPTION || sub.ASSESSMENT_TITLE || "Practical Task Execution & Evidence Submission",
            QUESTION_TYPE: "PRACTICAL",
            STUDENT_ANSWER: isPracticalSubmitted ? "Multimedia project evidence uploaded (Image & Video)" : "No evidence uploaded yet",
            MAX_MARK: 100,
            GIVEN_MARK: isPracticalEvaluated && sub.GIVEN_MARKS !== null && sub.GIVEN_MARKS !== undefined ? Number(sub.GIVEN_MARKS) : null,
          },
        ],
      },
    });
  } catch (error) {
    console.error("❌ getSubmissionPreview error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch submission preview",
      error: error.message,
    });
  }
};

// =====================================================
// TUTOR: SUBMIT EVALUATION (SINGLE OVERALL MARK: 0 TO 100)
// =====================================================
const submitEvaluation = async (req, res) => {
  try {
    const {
      submissionId,
      studentId,
      batchId,
      assessmentType,
      type,
      givenMarks,
      marks,
      tutorId,
    } = req.body;

    const tId = Number(tutorId);
    if (!tId || isNaN(tId) || tId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    const pool = await getPool();
    let sId = Number(submissionId);
    let studId = Number(studentId);
    let bId = Number(batchId);
    const selectedType = (assessmentType || type || "THEORY").toUpperCase();

    // Resolve student and batch if not supplied
    if (!studId && sId && sId > 0) {
      if (selectedType === "THEORY" || selectedType === "FINAL_ASSESSMENT_THEORY") {
        const aeRes = await pool
          .request()
          .input("ID", sql.Int, sId)
          .query("SELECT STUDENT_ID FROM ASSESMENT_EXAM WITH (NOLOCK) WHERE ID = @ID");
        if (aeRes.recordset.length > 0) {
          studId = Number(aeRes.recordset[0].STUDENT_ID);
        }
      } else {
        const sasRes = await pool
          .request()
          .input("ID", sql.Int, sId)
          .query("SELECT STUDENT_ID FROM STUDENT_ASSESSMENT_SUBMISSIONS WITH (NOLOCK) WHERE ID = @ID");
        if (sasRes.recordset.length > 0) {
          studId = Number(sasRes.recordset[0].STUDENT_ID);
        }
      }
    }

    if (!bId && studId) {
      const bRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, studId)
        .query("SELECT TOP 1 BATCH_ID FROM STUDENT_ALLOCATIONS WITH (NOLOCK) WHERE STUDENT_ID = @STUDENT_ID");
      if (bRes.recordset.length > 0) {
        bId = Number(bRes.recordset[0].BATCH_ID);
      }
    }

    if (bId) {
      const isHost = await isTutorHostOfBatch(pool, tId, bId);
      if (!isHost) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to evaluate this student's assessment (HOST role required)",
        });
      }
    }

    // Validate single overall mark
    const rawMark = givenMarks !== undefined && givenMarks !== null && givenMarks !== "" ? givenMarks : marks;
    if (rawMark === undefined || rawMark === null || rawMark === "" || isNaN(Number(rawMark))) {
      return res.status(400).json({
        status: 0,
        message: "Please provide a valid overall mark between 0 and 100",
      });
    }

    const finalOverallMark = Number(rawMark);
    if (finalOverallMark < 0 || finalOverallMark > 100) {
      return res.status(400).json({
        status: 0,
        message: "Mark must be between 0 and 100",
      });
    }

    const cleanComment = (req.body.comment || "").trim();

    // ----------------------------------------------------
    // EVALUATING FINAL ASSESSMENT THEORY (SINGLE OVERALL MARK)
    // ----------------------------------------------------
    if (selectedType === "THEORY" || selectedType === "FINAL_ASSESSMENT_THEORY") {
      const examCheck = await pool
        .request()
        .input("STUDENT_ID", sql.Int, studId)
        .input("ATTEMPT_ID", sql.Int, sId > 0 ? sId : 0)
        .query(`
          SELECT TOP 1 ID, TOTAL_QUESTIONS, STUDENT_ANSWERED, CREATED_ON
          FROM ASSESMENT_EXAM WITH (NOLOCK)
          WHERE STUDENT_ID = @STUDENT_ID
            AND (ID = @ATTEMPT_ID OR @ATTEMPT_ID = 0)
          ORDER BY ID DESC
        `);

      if (examCheck.recordset.length === 0) {
        return res.status(400).json({
          status: 0,
          message: "Student has not submitted the assessment and cannot be evaluated.",
        });
      }

      const examRecord = examCheck.recordset[0];
      const isExamSubmitted = Boolean(
        examRecord.CREATED_ON || examRecord.STUDENT_ANSWERED > 0
      );

      if (!isExamSubmitted) {
        return res.status(400).json({
          status: 0,
          message: "Student has not submitted the assessment and cannot be evaluated.",
        });
      }

      await pool
        .request()
        .input("ATTEMPT_ID", sql.Int, examRecord.ID)
        .input("STUDENT_MARK", sql.Decimal(10, 2), finalOverallMark)
        .input("MARK_PERCENTAGE", sql.Decimal(10, 2), finalOverallMark)
        .input("PROJECT_KIT_MARK", sql.Decimal(10, 2), finalOverallMark)
        .input("COMMENT", sql.NVarChar(sql.MAX), cleanComment)
        .input("GIVEN_BY", sql.Int, tId)
        .query(`
          UPDATE ASSESMENT_EXAM
          SET
            STUDENT_MARK = @STUDENT_MARK,
            MARK_PERCENTAGE = @MARK_PERCENTAGE,
            PROJECT_KIT_MARK = @PROJECT_KIT_MARK,
            PROJECT_KIT_COMMENT = @COMMENT,
            PROJECT_KIT_EVALUATED_BY = @GIVEN_BY,
            PROJECT_KIT_REVIEWED_DATE = SYSDATETIME(),
            IS_PROJECT_KIT_EVALUATED = 1
          WHERE ID = @ATTEMPT_ID
        `);

      return res.json({
        status: 1,
        message: "Final Assessment Theory evaluation saved successfully",
        data: {
          submissionId: examRecord.ID,
          studentId: studId,
          givenMarks: finalOverallMark,
          markPercentage: finalOverallMark,
          comment: cleanComment,
          givenBy: tId,
          reviewedDate: new Date().toISOString(),
          status: "Reviewed",
        },
      });
    }

    // ----------------------------------------------------
    // EVALUATING PRACTICAL ASSESSMENT (SINGLE OVERALL MARK)
    // ----------------------------------------------------
    let practicalSubmission = null;
    if (sId && sId > 0) {
      const psRes = await pool
        .request()
        .input("SUBMISSION_ID", sql.Int, sId)
        .query(`SELECT ID, IMAGE_1, VIDEO_1 FROM STUDENT_ASSESSMENT_SUBMISSIONS WITH (NOLOCK) WHERE ID = @SUBMISSION_ID`);
      if (psRes.recordset.length > 0) {
        practicalSubmission = psRes.recordset[0];
      }
    } else if (studId) {
      const psRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, studId)
        .query(`SELECT TOP 1 ID, IMAGE_1, VIDEO_1 FROM STUDENT_ASSESSMENT_SUBMISSIONS WITH (NOLOCK) WHERE STUDENT_ID = @STUDENT_ID ORDER BY ID DESC`);
      if (psRes.recordset.length > 0) {
        practicalSubmission = psRes.recordset[0];
      }
    }

    if (!practicalSubmission || (!practicalSubmission.IMAGE_1 && !practicalSubmission.VIDEO_1)) {
      return res.status(400).json({
        status: 0,
        message: "Student has not submitted the practical assessment and cannot be evaluated.",
      });
    }

    await pool
      .request()
      .input("SUBMISSION_ID", sql.Int, practicalSubmission.ID)
      .input("GIVEN_MARKS", sql.Decimal(10, 2), finalOverallMark)
      .input("COMMENT", sql.NVarChar(sql.MAX), cleanComment)
      .input("GIVEN_BY", sql.Int, tId)
      .query(`
        UPDATE STUDENT_ASSESSMENT_SUBMISSIONS
        SET
          GIVEN_MARKS = @GIVEN_MARKS,
          COMMENT = @COMMENT,
          GIVEN_BY = @GIVEN_BY,
          REVIEWED_DATE = SYSDATETIME(),
          UPDATED_AT = SYSDATETIME(),
          UPDATED_BY = @GIVEN_BY
        WHERE ID = @SUBMISSION_ID
      `);

    return res.json({
      status: 1,
      message: "Practical evaluation saved successfully",
      data: {
        submissionId: practicalSubmission.ID,
        studentId: studId,
        givenMarks: finalOverallMark,
        comment: cleanComment,
        givenBy: tId,
        reviewedDate: new Date().toISOString(),
        status: "Reviewed",
      },
    });
  } catch (error) {
    console.error("❌ submitEvaluation error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to submit evaluation",
      error: error.message,
    });
  }
};

// =====================================================
// STUDENT: GET CERTIFICATE DATA & ELIGIBILITY
// =====================================================
const getStudentCertificate = async (req, res) => {
  try {
    const rawUserId =
      req.params.studentId ||
      req.query.studentId ||
      req.query.STUDENT_ID ||
      req.user?.USER_ID;

    const sId = Number(rawUserId);

    if (!sId || isNaN(sId) || sId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student ID is required",
      });
    }

    const pool = await getPool();

    // 1. Get student's verified profile data from USERS table
    const userRes = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .query(`
        SELECT TOP 1
          USER_ID,
          USERNAME,
          EMAIL_ID,
          ROLL_NO,
          GRADE,
          SCHOOL_NAME,
          ISNULL(IS_CERTIFICATE, 0) AS IS_CERTIFICATE
        FROM USERS WITH (NOLOCK)
        WHERE USER_ID = @STUDENT_ID
      `);

    if (userRes.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Student user not found",
      });
    }

    const studentUser = userRes.recordset[0];

    // 2. Lookup student's batch allocation (if available)
    let batch = null;
    const batchRes = await pool
      .request()
      .input("STUDENT_ID", sql.Int, sId)
      .query(`
        SELECT TOP 1
          SA.BATCH_ID,
          B.BATCH_NAME,
          B.BATCH_CODE,
          B.START_DATE,
          B.END_DATE
        FROM STUDENT_ALLOCATIONS SA WITH (NOLOCK)
        INNER JOIN BATCHES B WITH (NOLOCK) ON B.ID = SA.BATCH_ID
        WHERE SA.STUDENT_ID = @STUDENT_ID
          AND ISNULL(B.IS_ACTIVE, 1) = 1
        ORDER BY SA.BATCH_ID
      `);

    if (batchRes.recordset.length > 0) {
      batch = batchRes.recordset[0];
    }

    const batchId = batch ? Number(batch.BATCH_ID) : null;

    // =========================================================================
    // BATCH END DATE AVAILABILITY CHECK:
    // A student can access the Report Card ONLY after the student's assigned
    // batch has reached its END DATE (today >= batchEndDate).
    // Treat the entire end date as available.
    // =========================================================================
    const isDateReached = (endDateVal) => {
      if (!endDateVal) return true;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const bEnd = new Date(endDateVal);
      const batchEndDate = new Date(bEnd.getFullYear(), bEnd.getMonth(), bEnd.getDate());
      if (isNaN(batchEndDate.getTime())) return true;
      return today.getTime() >= batchEndDate.getTime();
    };

    if (batch?.END_DATE && !isDateReached(batch.END_DATE)) {
      return res.json({
        status: 1,
        eligible: false,
        available: false,
        state: "BATCH_NOT_ENDED",
        message: "Your Report Card will be available after the batch end date.",
        data: {
          studentId: studentUser.USER_ID,
          studentName: studentUser.USERNAME,
          rollNo: studentUser.ROLL_NO || studentUser.USER_ID,
          schoolName: studentUser.SCHOOL_NAME,
          batchName: batch?.BATCH_NAME || "",
          batchCode: batch?.BATCH_CODE || "",
          startDate: batch?.START_DATE || null,
          endDate: batch?.END_DATE || null,
          batchEndDate: batch?.END_DATE || null,
          isBatchEnded: false,
        },
      });
    }

    // =========================================================================
    // CERTIFICATE ELIGIBILITY CHECK:
    // Check Table 1: FINAL_ASSESSMENTS (assigned to student's batch)
    // Check Table 2: STUDENT_ASSESSMENT_SUBMISSIONS (for student ID + FINAL_ASSESSMENT)
    // Requirement:
    // - Assessment type must be 'FINAL_ASSESSMENT' (explicitly filtered)
    // - Completion requires: IMAGE_1 IS NOT NULL AND VIDEO_1 IS NOT NULL
    // - Tutor evaluation requires: GIVEN_MARKS IS NOT NULL AND REVIEWED_DATE IS NOT NULL
    // =========================================================================

    let evaluatedRecord = null;
    let completedUnreviewedRecord = null;
    let incompleteRecord = null;
    let fallbackAssessmentInfo = null;

    // -------------------------------------------------------------------------
    // STEP 1: CHECK FINAL_ASSESSMENTS
    // Look up FINAL_ASSESSMENTS records assigned to the student's batch (or via ASSIGNMENT_ALERTS)
    // and check the corresponding submission in STUDENT_ASSESSMENT_SUBMISSIONS.
    // -------------------------------------------------------------------------
    if (batchId) {
      const faQuery = await pool
        .request()
        .input("BATCH_ID", sql.Int, batchId)
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          SELECT
            fa.ID AS ASSESSMENT_ID,
            fa.TITLE,
            fa.DESCRIPTION,
            fa.BATCH_ID,
            fa.ASSESSMENT_TYPE,
            sas.ID AS SUBMISSION_ID,
            sas.IMAGE_1,
            sas.VIDEO_1,
            sas.GIVEN_MARKS,
            sas.COMMENT,
            sas.GIVEN_BY,
            sas.REVIEWED_DATE,
            sas.CREATED_AT AS SUBMITTED_AT,
            sas.UPDATED_AT,
            t.USERNAME AS EVALUATOR_NAME,
            b.BATCH_NAME,
            b.BATCH_CODE,
            b.START_DATE,
            b.END_DATE
          FROM FINAL_ASSESSMENTS fa WITH (NOLOCK)
          LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = fa.BATCH_ID
          LEFT JOIN STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK) 
            ON sas.ASSESSMENT_ID = fa.ID AND sas.STUDENT_ID = @STUDENT_ID
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE fa.BATCH_ID = @BATCH_ID
            AND fa.ASSESSMENT_TYPE = 'FINAL_ASSESSMENT'
            AND ISNULL(fa.IS_ACTIVE, 1) = 1
          ORDER BY ISNULL(sas.UPDATED_AT, sas.CREATED_AT) DESC, fa.CREATED_AT DESC, fa.ID DESC
        `);

      for (const row of faQuery.recordset) {
        if (!fallbackAssessmentInfo) {
          fallbackAssessmentInfo = {
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
          };
        }

        const hasImg = Boolean(row.IMAGE_1 && String(row.IMAGE_1).trim() !== "");
        const hasVid = Boolean(row.VIDEO_1 && String(row.VIDEO_1).trim() !== "");
        const isComplete = hasImg && hasVid;
        const isEvaluated =
          isComplete &&
          row.GIVEN_MARKS !== null &&
          row.GIVEN_MARKS !== undefined &&
          row.REVIEWED_DATE !== null &&
          row.REVIEWED_DATE !== undefined;

        if (isEvaluated && !evaluatedRecord) {
          evaluatedRecord = {
            sourceTable: "FINAL_ASSESSMENTS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            marks: Number(row.GIVEN_MARKS),
            comment: row.COMMENT,
            reviewedDate: row.REVIEWED_DATE,
            evaluatorName: row.EVALUATOR_NAME,
            submittedAt: row.SUBMITTED_AT,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
          break; // Found fully evaluated record in Table 1
        } else if (isComplete && !completedUnreviewedRecord) {
          completedUnreviewedRecord = {
            sourceTable: "FINAL_ASSESSMENTS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            submittedAt: row.SUBMITTED_AT,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
        } else if (!incompleteRecord && row.SUBMISSION_ID) {
          incompleteRecord = {
            sourceTable: "FINAL_ASSESSMENTS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // STEP 2: CHECK STUDENT_ASSESSMENT_SUBMISSIONS (Fallback / Independent Lookup)
    // If not already found evaluated in FINAL_ASSESSMENTS, inspect STUDENT_ASSESSMENT_SUBMISSIONS
    // joined with FINAL_ASSESSMENTS and ASSIGNMENT_ALERTS for ASSESSMENT_TYPE = 'FINAL_ASSESSMENT'.
    // -------------------------------------------------------------------------
    if (!evaluatedRecord) {
      const sasQuery = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          SELECT
            sas.ID AS SUBMISSION_ID,
            sas.ASSESSMENT_ID,
            sas.STUDENT_ID,
            sas.IMAGE_1,
            sas.VIDEO_1,
            sas.GIVEN_MARKS,
            sas.COMMENT,
            sas.GIVEN_BY,
            sas.REVIEWED_DATE,
            sas.CREATED_AT AS SUBMITTED_AT,
            sas.UPDATED_AT,
            COALESCE(fa.ASSESSMENT_TYPE, aa.ASSESSMENT_TYPE) AS ASSESSMENT_TYPE,
            COALESCE(fa.TITLE, qt.TEMPLATE_NAME, m.MODULE_NAME, 'Final Assessment') AS TITLE,
            COALESCE(fa.DESCRIPTION, m.MODULE_NAME, 'Final Assessment') AS DESCRIPTION,
            COALESCE(b1.BATCH_NAME, b2.BATCH_NAME, b3.BATCH_NAME) AS BATCH_NAME,
            COALESCE(b1.BATCH_CODE, b2.BATCH_CODE, b3.BATCH_CODE) AS BATCH_CODE,
            COALESCE(b1.START_DATE, b2.START_DATE, b3.START_DATE) AS START_DATE,
            COALESCE(b1.END_DATE, b2.END_DATE, b3.END_DATE) AS END_DATE,
            t.USERNAME AS EVALUATOR_NAME
          FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
          LEFT JOIN FINAL_ASSESSMENTS fa WITH (NOLOCK) ON fa.ID = sas.ASSESSMENT_ID
          LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = sas.ASSESSMENT_ID
          LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
          LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = aa.MODULE_ID
          LEFT JOIN BATCHES b1 WITH (NOLOCK) ON b1.ID = fa.BATCH_ID
          LEFT JOIN BATCHES b2 WITH (NOLOCK) ON b2.ID = aa.BATCH_ID
          LEFT JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
          LEFT JOIN BATCHES b3 WITH (NOLOCK) ON b3.ID = sa.BATCH_ID
          LEFT JOIN USERS t WITH (NOLOCK) ON t.USER_ID = sas.GIVEN_BY
          WHERE sas.STUDENT_ID = @STUDENT_ID
            AND (fa.ASSESSMENT_TYPE = 'FINAL_ASSESSMENT' OR aa.ASSESSMENT_TYPE = 'FINAL_ASSESSMENT')
          ORDER BY ISNULL(sas.UPDATED_AT, sas.CREATED_AT) DESC, sas.ID DESC
        `);

      for (const row of sasQuery.recordset) {
        if (!fallbackAssessmentInfo) {
          fallbackAssessmentInfo = {
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
          };
        }

        const hasImg = Boolean(row.IMAGE_1 && String(row.IMAGE_1).trim() !== "");
        const hasVid = Boolean(row.VIDEO_1 && String(row.VIDEO_1).trim() !== "");
        const isComplete = hasImg && hasVid;
        const isEvaluated =
          isComplete &&
          row.GIVEN_MARKS !== null &&
          row.GIVEN_MARKS !== undefined &&
          row.REVIEWED_DATE !== null &&
          row.REVIEWED_DATE !== undefined;

        if (isEvaluated) {
          evaluatedRecord = {
            sourceTable: "STUDENT_ASSESSMENT_SUBMISSIONS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            marks: Number(row.GIVEN_MARKS),
            comment: row.COMMENT,
            reviewedDate: row.REVIEWED_DATE,
            evaluatorName: row.EVALUATOR_NAME,
            submittedAt: row.SUBMITTED_AT,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
          break; // Found evaluated record in Table 2
        } else if (isComplete && !completedUnreviewedRecord) {
          completedUnreviewedRecord = {
            sourceTable: "STUDENT_ASSESSMENT_SUBMISSIONS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            submittedAt: row.SUBMITTED_AT,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
        } else if (!incompleteRecord) {
          incompleteRecord = {
            sourceTable: "STUDENT_ASSESSMENT_SUBMISSIONS",
            assessmentId: row.ASSESSMENT_ID,
            title: row.TITLE,
            description: row.DESCRIPTION,
            batchName: row.BATCH_NAME || batch?.BATCH_NAME,
            batchCode: row.BATCH_CODE || batch?.BATCH_CODE,
            startDate: row.START_DATE || batch?.START_DATE || null,
            endDate: row.END_DATE || batch?.END_DATE || null,
          };
        }
      }
    }

    // Fetch Theory assessment marks from ASSESMENT_EXAM if available
    let theoryMarks = null;
    let isTheoryEvaluated = false;
    try {
      const theoryRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          SELECT TOP 1
            ae.STUDENT_MARK,
            ae.MARK_PERCENTAGE,
            ae.PROJECT_KIT_MARK,
            ae.IS_PROJECT_KIT_EVALUATED,
            ae.PROJECT_KIT_REVIEWED_DATE
          FROM ASSESMENT_EXAM ae WITH (NOLOCK)
          WHERE ae.STUDENT_ID = @STUDENT_ID
            AND (
              ae.IS_PROJECT_KIT_EVALUATED = 1
              OR ae.PROJECT_KIT_REVIEWED_DATE IS NOT NULL
              OR ae.STUDENT_MARK IS NOT NULL
              OR ae.MARK_PERCENTAGE IS NOT NULL
              OR ae.PROJECT_KIT_MARK IS NOT NULL
            )
          ORDER BY ae.PROJECT_KIT_REVIEWED_DATE DESC, ae.ID DESC
        `);

      if (theoryRes.recordset.length > 0) {
        const tr = theoryRes.recordset[0];
        const val = tr.PROJECT_KIT_MARK ?? tr.STUDENT_MARK ?? tr.MARK_PERCENTAGE;
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          theoryMarks = Number(val);
          isTheoryEvaluated = true;
        }
      }
    } catch (e) {
      console.warn("Could not query theory marks:", e.message);
    }

    // Practical assessment marks
    let practicalMarks = null;
    let isPracticalEvaluated = false;
    if (evaluatedRecord && evaluatedRecord.marks !== null && evaluatedRecord.marks !== undefined) {
      practicalMarks = Number(evaluatedRecord.marks);
      isPracticalEvaluated = true;
    }

    // Attendance percentage calculation
    let attendancePercentage = null;
    if (batchId) {
      try {
        const schRes = await pool
          .request()
          .input("BATCH_ID", sql.Int, batchId)
          .query(`SELECT ID AS CLASS_ID FROM CLASS_SCHEDULES WITH (NOLOCK) WHERE BATCH_ID = @BATCH_ID`);
        const totalClasses = schRes.recordset.length;

        if (totalClasses > 0) {
          const attRes = await pool
            .request()
            .input("STUDENT_ID", sql.Int, sId)
            .input("BATCH_ID", sql.Int, batchId)
            .query(`
              SELECT ca.CLASS_ID, ca.ATTENDANCE_STATUS
              FROM CLASS_ATTENDANCE ca WITH (NOLOCK)
              INNER JOIN CLASS_SCHEDULES cs WITH (NOLOCK) ON ca.CLASS_ID = cs.ID
              WHERE ca.STUDENT_ID = @STUDENT_ID AND cs.BATCH_ID = @BATCH_ID
            `);
          let attendedCount = 0;
          attRes.recordset.forEach((att) => {
            if (Number(att.ATTENDANCE_STATUS) === 1) attendedCount++;
          });
          attendancePercentage = Math.round((attendedCount / totalClasses) * 100);
        }
      } catch (e) {
        console.warn("Could not calculate attendance percentage:", e.message);
      }
    }

    // Overall marks calculation
    let overallMarks = null;
    const markParts = [];
    if (practicalMarks !== null && !isNaN(practicalMarks)) markParts.push(practicalMarks);
    if (theoryMarks !== null && !isNaN(theoryMarks)) markParts.push(theoryMarks);
    if (markParts.length > 0) {
      const sum = markParts.reduce((a, b) => a + b, 0);
      overallMarks = Math.round(sum / markParts.length);
    }

    // Helper to calculate standard LMS grade
    const calculateGradeHelper = (mark) => {
      if (mark === null || mark === undefined || isNaN(Number(mark))) return "";
      const m = Number(mark);
      if (m >= 90) return "A+";
      if (m >= 80) return "A";
      if (m >= 70) return "B+";
      if (m >= 60) return "B";
      if (m >= 50) return "C";
      return "D";
    };

    // 1. Module grades / Internal Assessments query
    let internalAssessments = [];
    let moduleGrades = [];
    try {
      const modRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          SELECT 
            m.ID AS MODULE_ID,
            m.MODULE_NAME,
            ae.STUDENT_MARK,
            ae.MARK_PERCENTAGE,
            ae.PROJECT_KIT_MARK,
            ae.CREATED_ON
          FROM ASSESMENT_EXAM ae WITH (NOLOCK)
          INNER JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
          INNER JOIN MODULES m WITH (NOLOCK) ON m.ID = aa.MODULE_ID
          WHERE ae.STUDENT_ID = @STUDENT_ID
          ORDER BY m.ID ASC, ae.ID DESC
        `);
      moduleGrades = modRes.recordset;
      internalAssessments = modRes.recordset.map((row) => {
        const val = row.MARK_PERCENTAGE ?? row.STUDENT_MARK;
        const grade = val !== null && val !== undefined && !isNaN(Number(val))
          ? calculateGradeHelper(Number(val))
          : "";
        return {
          moduleId: row.MODULE_ID,
          moduleName: row.MODULE_NAME,
          mark: val !== null && val !== undefined ? Number(val) : null,
          grade,
        };
      });
    } catch (e) {
      console.warn("Could not query module grades:", e.message);
    }

    // 2. Practical Assessments (Evaluated Project Kits) query
    let practicalAssessments = [];
    let evaluatedProjectKits = [];
    try {
      const pkRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, sId)
        .query(`
          SELECT 
            pk.ID AS KIT_ID,
            pk.KIT_NAME,
            ae.CREATIVITY_MARK,
            ae.PROBLEM_SOLVING_MARK,
            ae.PROJECT_KIT_MARK,
            ae.PROJECT_KIT_REVIEWED_DATE,
            ae.IS_PROJECT_KIT_EVALUATED
          FROM ASSESMENT_EXAM ae WITH (NOLOCK)
          LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
          INNER JOIN PROJECT_KITS pk WITH (NOLOCK) ON pk.ID = COALESCE(ae.PROJECT_KIT_ID, aa.PROJECT_KIT_ID)
          WHERE ae.STUDENT_ID = @STUDENT_ID
            AND ae.IS_PROJECT_KIT_EVALUATED = 1
            AND ae.PROJECT_KIT_MARK IS NOT NULL
          ORDER BY ae.PROJECT_KIT_REVIEWED_DATE DESC, ae.ID DESC
        `);
      evaluatedProjectKits = pkRes.recordset;
      practicalAssessments = pkRes.recordset.map((row) => {
        const mark = row.PROJECT_KIT_MARK;
        const grade = mark !== null && mark !== undefined && !isNaN(Number(mark))
          ? calculateGradeHelper(Number(mark))
          : "";
        return {
          kitId: row.KIT_ID,
          kitName: row.KIT_NAME,
          creativityMark: row.CREATIVITY_MARK !== null && row.CREATIVITY_MARK !== undefined ? Number(row.CREATIVITY_MARK) : null,
          problemSolvingMark: row.PROBLEM_SOLVING_MARK !== null && row.PROBLEM_SOLVING_MARK !== undefined ? Number(row.PROBLEM_SOLVING_MARK) : null,
          projectKitMark: mark !== null && mark !== undefined ? Number(mark) : null,
          grade,
        };
      });
    } catch (e) {
      console.warn("Could not query evaluated project kits:", e.message);
    }

    // 3. Skill Development grades computation
    let creativityGrade = "";
    let problemSolvingGrade = "";
    if (evaluatedProjectKits.length > 0) {
      const kitsWithCreativity = evaluatedProjectKits.filter((r) => r.CREATIVITY_MARK !== null && r.CREATIVITY_MARK !== undefined);
      if (kitsWithCreativity.length > 0) {
        const totalC = kitsWithCreativity.reduce((sum, r) => sum + Number(r.CREATIVITY_MARK), 0);
        const avgC = totalC / kitsWithCreativity.length;
        const pctC = (avgC / 50) * 100;
        creativityGrade = calculateGradeHelper(pctC);
      } else if (practicalMarks !== null) {
        creativityGrade = calculateGradeHelper(practicalMarks);
      }

      const kitsWithPS = evaluatedProjectKits.filter((r) => r.PROBLEM_SOLVING_MARK !== null && r.PROBLEM_SOLVING_MARK !== undefined);
      if (kitsWithPS.length > 0) {
        const totalPS = kitsWithPS.reduce((sum, r) => sum + Number(r.PROBLEM_SOLVING_MARK), 0);
        const avgPS = totalPS / kitsWithPS.length;
        const pctPS = (avgPS / 50) * 100;
        problemSolvingGrade = calculateGradeHelper(pctPS);
      } else if (practicalMarks !== null) {
        problemSolvingGrade = calculateGradeHelper(practicalMarks);
      }
    } else if (practicalMarks !== null) {
      creativityGrade = calculateGradeHelper(practicalMarks);
      problemSolvingGrade = calculateGradeHelper(practicalMarks);
    }

    // Safety & Procedure Awareness
    let safetyGrade = "";
    const safetyMod = moduleGrades.find((m) => /safety/i.test(m.MODULE_NAME)) || moduleGrades[0];
    if (safetyMod) {
      const val = safetyMod.MARK_PERCENTAGE ?? safetyMod.STUDENT_MARK;
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        safetyGrade = calculateGradeHelper(Number(val));
      }
    } else if (overallMarks !== null) {
      safetyGrade = calculateGradeHelper(overallMarks);
    }

    // Learning Discipline (from Attendance)
    let learningDisciplineGrade = "";
    if (attendancePercentage !== null && attendancePercentage !== undefined) {
      learningDisciplineGrade = calculateGradeHelper(attendancePercentage);
    }

    const skillDevelopment = {
      creativityGrade,
      problemSolvingGrade,
      safetyGrade,
      learningDisciplineGrade,
    };

    // =========================================================================
    // DECISION & RESPONSE DISPATCH
    // Respect IS_CERTIFICATE flag in USERS table
    // =========================================================================
    const isCertificatePublished =
      studentUser.IS_CERTIFICATE === 1 ||
      studentUser.IS_CERTIFICATE === true ||
      studentUser.IS_CERTIFICATE === "1";

    if (!isCertificatePublished) {
      return res.json({
        status: 1,
        eligible: false,
        state: "NOT_EVALUATED",
        message: "Your certificate has not been published yet by your Tutor or Admin.",
        data: {
          studentName: studentUser.USERNAME,
          rollNo: studentUser.ROLL_NO || studentUser.USER_ID,
          schoolName: studentUser.SCHOOL_NAME,
          batchName: evaluatedRecord?.batchName || batch?.BATCH_NAME || "",
          batchCode: evaluatedRecord?.batchCode || batch?.BATCH_CODE || "",
          assessmentTitle: evaluatedRecord?.title || fallbackAssessmentInfo?.title || "Final Assessment",
          assessmentDescription: evaluatedRecord?.description || fallbackAssessmentInfo?.description || "",
          submittedAt: evaluatedRecord?.submittedAt || null,
          moduleGrades,
          internalAssessments,
          practicalAssessments,
          skillDevelopment,
          creativityGrade,
          problemSolvingGrade,
          safetyGrade,
          learningDisciplineGrade,
        },
      });
    }

    // CASE A: ELIGIBLE (Valid Completed + Evaluated Final Assessment exists in either table and published)
    if (evaluatedRecord) {
      return res.json({
        status: 1,
        eligible: true,
        state: "EVALUATED",
        message: "Certificate available for download",
        data: {
          studentId: studentUser.USER_ID,
          studentName: studentUser.USERNAME,
          studentEmail: studentUser.EMAIL_ID,
          rollNo: studentUser.ROLL_NO || studentUser.USER_ID,
          grade: studentUser.GRADE,
          schoolName: studentUser.SCHOOL_NAME,
          batchName: evaluatedRecord.batchName || batch?.BATCH_NAME || "Program Batch",
          batchCode: evaluatedRecord.batchCode || batch?.BATCH_CODE || "AICP-001",
          startDate: evaluatedRecord.startDate || batch?.START_DATE || null,
          endDate: evaluatedRecord.endDate || batch?.END_DATE || null,
          programDuration: "30 Hours",
          mode: "Hands-on / Practical Training",
          assessmentId: evaluatedRecord.assessmentId,
          assessmentTitle: evaluatedRecord.title || "Aerospace / Final Assessment Program",
          assessmentDescription: evaluatedRecord.description || "",
          marks: evaluatedRecord.marks,
          theoryMarks,
          practicalMarks,
          overallMarks,
          attendancePercentage,
          isTheoryEvaluated,
          isPracticalEvaluated,
          moduleGrades,
          internalAssessments,
          practicalAssessments,
          skillDevelopment,
          creativityGrade,
          problemSolvingGrade,
          safetyGrade,
          learningDisciplineGrade,
          totalMarks: 100,
          comment: evaluatedRecord.comment || "",
          reviewedDate: evaluatedRecord.reviewedDate,
          evaluatorName: evaluatedRecord.evaluatorName || "Program Instructor",
          submittedAt: evaluatedRecord.submittedAt,
        },
      });
    }

    // CASE B: COMPLETED BUT NOT EVALUATED BY TUTOR
    if (completedUnreviewedRecord) {
      return res.json({
        status: 1,
        eligible: false,
        state: "NOT_EVALUATED",
        message:
          "Tutor hasn't evaluated your Final Assessment. Please contact your Tutor or Admin.",
        data: {
          studentName: studentUser.USERNAME,
          rollNo: studentUser.ROLL_NO || studentUser.USER_ID,
          schoolName: studentUser.SCHOOL_NAME,
          batchName: completedUnreviewedRecord.batchName || batch?.BATCH_NAME || "",
          batchCode: completedUnreviewedRecord.batchCode || batch?.BATCH_CODE || "",
          assessmentTitle: completedUnreviewedRecord.title || "Final Assessment",
          assessmentDescription: completedUnreviewedRecord.description || "",
          submittedAt: completedUnreviewedRecord.submittedAt,
        },
      });
    }

    // CASE C: INCOMPLETE / NO FINAL ASSESSMENT SUBMITTED / NO RECORD
    const defaultTitle =
      fallbackAssessmentInfo?.title ||
      incompleteRecord?.title ||
      "Final Assessment";
    const defaultBatchName =
      fallbackAssessmentInfo?.batchName ||
      incompleteRecord?.batchName ||
      batch?.BATCH_NAME ||
      "";
    const defaultBatchCode =
      fallbackAssessmentInfo?.batchCode ||
      incompleteRecord?.batchCode ||
      batch?.BATCH_CODE ||
      "";

    return res.json({
      status: 1,
      eligible: false,
      state: "NOT_COMPLETED",
      message: "Complete your Final Assessment",
      data: {
        studentName: studentUser.USERNAME,
        rollNo: studentUser.ROLL_NO || studentUser.USER_ID,
        schoolName: studentUser.SCHOOL_NAME,
        batchName: defaultBatchName,
        batchCode: defaultBatchCode,
        assessmentTitle: defaultTitle,
        assessmentDescription: fallbackAssessmentInfo?.description || "",
      },
    });
  } catch (error) {
    console.error("❌ getStudentCertificate error:", error);
    return res.status(500).json({
      status: 0,
      eligible: false,
      state: "ERROR",
      message: "Failed to retrieve certificate details",
      error: error.message,
    });
  }
};

// =====================================================
// TUTOR: GET STUDENTS FOR PUBLISHING CERTIFICATES
// =====================================================
const getPublishStudents = async (req, res) => {
  try {
    const { batchId } = req.params;
    const bId = Number(batchId);

    if (!bId || isNaN(bId) || bId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch ID is required",
      });
    }

    const pool = await getPool();

    // Verify batch exists
    const batchRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`SELECT ID, BATCH_CODE, BATCH_NAME FROM BATCHES WITH (NOLOCK) WHERE ID = @BATCH_ID`);

    if (batchRes.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Batch not found",
      });
    }

    // 1. Fetch all students in this batch
    const studentsRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          u.USER_ID AS STUDENT_ID,
          u.USERNAME AS STUDENT_NAME,
          u.EMAIL_ID AS STUDENT_EMAIL,
          u.ROLL_NO AS STUDENT_ROLL_NO,
          u.GRADE AS STUDENT_GRADE,
          u.SCHOOL_NAME,
          ISNULL(u.IS_CERTIFICATE, 0) AS IS_CERTIFICATE,
          sa.BATCH_ID
        FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
          AND (u.USER_TYPE = 'STUDENT' OR u.USER_TYPE IS NULL)
        ORDER BY u.USERNAME ASC
      `);

    const students = studentsRes.recordset;

    // 2. Fetch Theory exam submissions for this batch
    const examRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          ae.STUDENT_ID,
          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.PROJECT_KIT_MARK,
          ae.PROJECT_KIT_COMMENT,
          ae.PROJECT_KIT_EVALUATED_BY,
          ae.PROJECT_KIT_REVIEWED_DATE,
          ae.IS_PROJECT_KIT_EVALUATED,
          ae.STUDENT_ANSWERED,
          ae.STUDENT_ANSWER,
          ae.CREATED_ON
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
        ORDER BY ae.ID DESC
      `);

    const examMap = new Map();
    examRes.recordset.forEach((r) => {
      const sId = Number(r.STUDENT_ID);
      const isExamSubmitted = Boolean(
        (r.STUDENT_ANSWERED !== null && Number(r.STUDENT_ANSWERED) > 0) ||
        r.MARK_PERCENTAGE !== null ||
        r.STUDENT_MARK !== null ||
        (r.STUDENT_ANSWER && r.STUDENT_ANSWER.trim() !== "" && r.STUDENT_ANSWER !== "[]") ||
        r.CREATED_ON
      );
      const isEvaluated = Boolean(
        isExamSubmitted && (
          r.IS_PROJECT_KIT_EVALUATED === 1 ||
          r.IS_PROJECT_KIT_EVALUATED === true ||
          r.PROJECT_KIT_REVIEWED_DATE !== null ||
          (r.PROJECT_KIT_MARK !== null && r.PROJECT_KIT_MARK !== undefined && r.PROJECT_KIT_MARK !== "") ||
          (r.STUDENT_MARK !== null && r.STUDENT_MARK !== undefined && r.STUDENT_MARK !== "")
        )
      );
      if (!examMap.has(sId) || (!examMap.get(sId).isEvaluated && isEvaluated)) {
        examMap.set(sId, { ...r, isEvaluated });
      }
    });

    // 3. Fetch Practical project submissions for this batch
    const sasRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          sas.STUDENT_ID,
          sas.IMAGE_1,
          sas.VIDEO_1,
          sas.GIVEN_MARKS,
          sas.COMMENT,
          sas.GIVEN_BY,
          sas.REVIEWED_DATE
        FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
        ORDER BY sas.ID DESC
      `);

    const sasMap = new Map();
    sasRes.recordset.forEach((r) => {
      const sId = Number(r.STUDENT_ID);
      const isEvaluated = Boolean(
        r.GIVEN_MARKS !== null &&
        r.GIVEN_MARKS !== undefined &&
        r.GIVEN_MARKS !== ""
      );
      if (!sasMap.has(sId) || (!sasMap.get(sId).isEvaluated && isEvaluated)) {
        sasMap.set(sId, { ...r, isEvaluated });
      }
    });

    // 4. Map students with evaluated marks and eligibility
    const data = students.map((s) => {
      const sIdNum = Number(s.STUDENT_ID);
      const exam = examMap.get(sIdNum);
      const sas = sasMap.get(sIdNum);

      // Check evaluated Theory mark
      let theoryMark = null;
      if (exam && exam.isEvaluated) {
        const rawMark = exam.PROJECT_KIT_MARK ?? exam.STUDENT_MARK ?? exam.MARK_PERCENTAGE;
        if (rawMark !== null && rawMark !== undefined && rawMark !== "" && !isNaN(Number(rawMark))) {
          theoryMark = Number(rawMark);
        }
      }

      // Check evaluated Practical mark
      let practicalMark = null;
      if (sas && sas.isEvaluated) {
        if (!isNaN(Number(sas.GIVEN_MARKS))) {
          practicalMark = Number(sas.GIVEN_MARKS);
        }
      }

      const hasTheory = theoryMark !== null && theoryMark !== undefined && !isNaN(theoryMark);
      const hasPractical = practicalMark !== null && practicalMark !== undefined && !isNaN(practicalMark);
      const isEligible = hasTheory || hasPractical;

      return {
        STUDENT_ID: s.STUDENT_ID,
        STUDENT_NAME: s.STUDENT_NAME,
        STUDENT_EMAIL: s.STUDENT_EMAIL,
        STUDENT_ROLL_NO: s.STUDENT_ROLL_NO,
        SCHOOL_NAME: s.SCHOOL_NAME,
        THEORY_MARK: theoryMark,
        PRACTICAL_MARK: practicalMark,
        IS_ELIGIBLE: isEligible,
        IS_CERTIFICATE: isEligible && (Number(s.IS_CERTIFICATE) === 1 || s.IS_CERTIFICATE === true) ? 1 : 0,
      };
    });

    return res.json({
      status: 1,
      batch: batchRes.recordset[0],
      data,
    });
  } catch (error) {
    console.error("❌ getPublishStudents error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch students for certificate publishing",
      error: error.message,
    });
  }
};

// =====================================================
// TUTOR: PUBLISH CERTIFICATES FOR SELECTED STUDENTS
// =====================================================
const publishCertificates = async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let isTransactionBegun = false;

  try {
    const { batchId, tutorId, selectedStudentIds } = req.body;
    const bId = Number(batchId);
    const tId = Number(tutorId);

    console.log("📥 [publishCertificates] Received request:", {
      batchId: bId,
      tutorId: tId,
      selectedStudentIdsCount: Array.isArray(selectedStudentIds) ? selectedStudentIds.length : 0,
      selectedStudentIds,
    });

    if (!bId || isNaN(bId) || bId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid batch ID is required",
      });
    }

    const pool = await getPool();

    // Verify Tutor host authorization if tutorId is supplied
    if (tId && tId > 0) {
      const isHost = await isTutorHostOfBatch(pool, tId, bId);
      if (!isHost) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to publish certificates for this batch (HOST role required)",
        });
      }
    }

    // 1. Fetch all students belonging to this batch
    const studentsRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          u.USER_ID AS STUDENT_ID,
          u.USERNAME AS STUDENT_NAME
        FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
          AND (u.USER_TYPE = 'STUDENT' OR u.USER_TYPE IS NULL)
      `);

    const batchStudents = studentsRes.recordset;
    if (batchStudents.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "No students found in the selected batch",
      });
    }

    const batchStudentIds = new Set(batchStudents.map((s) => Number(s.STUDENT_ID)));

    // 2. Fetch Theory & Practical evaluations to compute eligibility
    const examRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          ae.STUDENT_ID,
          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.PROJECT_KIT_MARK,
          ae.IS_PROJECT_KIT_EVALUATED,
          ae.PROJECT_KIT_REVIEWED_DATE,
          ae.PROJECT_KIT_EVALUATED_BY,
          ae.STUDENT_ANSWERED,
          ae.STUDENT_ANSWER,
          ae.CREATED_ON
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
        ORDER BY ae.ID DESC
      `);

    const examMap = new Map();
    examRes.recordset.forEach((r) => {
      const sId = Number(r.STUDENT_ID);
      const isExamSubmitted = Boolean(
        (r.STUDENT_ANSWERED !== null && Number(r.STUDENT_ANSWERED) > 0) ||
        r.MARK_PERCENTAGE !== null ||
        r.STUDENT_MARK !== null ||
        (r.STUDENT_ANSWER && r.STUDENT_ANSWER.trim() !== "" && r.STUDENT_ANSWER !== "[]") ||
        r.CREATED_ON
      );
      const isEvaluated = Boolean(
        isExamSubmitted && (
          r.IS_PROJECT_KIT_EVALUATED === 1 ||
          r.IS_PROJECT_KIT_EVALUATED === true ||
          r.PROJECT_KIT_REVIEWED_DATE !== null ||
          (r.PROJECT_KIT_MARK !== null && r.PROJECT_KIT_MARK !== undefined && r.PROJECT_KIT_MARK !== "") ||
          (r.STUDENT_MARK !== null && r.STUDENT_MARK !== undefined && r.STUDENT_MARK !== "")
        )
      );
      if (!examMap.has(sId) || (!examMap.get(sId).isEvaluated && isEvaluated)) {
        examMap.set(sId, { ...r, isEvaluated });
      }
    });

    const sasRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT
          sas.STUDENT_ID,
          sas.IMAGE_1,
          sas.VIDEO_1,
          sas.GIVEN_MARKS,
          sas.REVIEWED_DATE
        FROM STUDENT_ASSESSMENT_SUBMISSIONS sas WITH (NOLOCK)
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = sas.STUDENT_ID
        WHERE sa.BATCH_ID = @BATCH_ID
        ORDER BY sas.ID DESC
      `);

    const sasMap = new Map();
    sasRes.recordset.forEach((r) => {
      const sId = Number(r.STUDENT_ID);
      const isEvaluated = Boolean(
        r.GIVEN_MARKS !== null &&
        r.GIVEN_MARKS !== undefined &&
        r.GIVEN_MARKS !== ""
      );
      if (!sasMap.has(sId) || (!sasMap.get(sId).isEvaluated && isEvaluated)) {
        sasMap.set(sId, { ...r, isEvaluated });
      }
    });

    // Check eligible student IDs (Must have evaluated Theory OR Practical mark)
    const eligibleStudentIds = new Set();
    for (const student of batchStudents) {
      const sIdNum = Number(student.STUDENT_ID);
      const exam = examMap.get(sIdNum);
      const sas = sasMap.get(sIdNum);

      let hasTheory = false;
      if (exam && exam.isEvaluated) {
        const rawMark = exam.PROJECT_KIT_MARK ?? exam.STUDENT_MARK ?? exam.MARK_PERCENTAGE;
        if (rawMark !== null && rawMark !== undefined && rawMark !== "" && !isNaN(Number(rawMark))) {
          hasTheory = true;
        }
      }

      let hasPractical = false;
      if (sas && sas.isEvaluated) {
        if (!isNaN(Number(sas.GIVEN_MARKS))) {
          hasPractical = true;
        }
      }

      if (hasTheory || hasPractical) {
        eligibleStudentIds.add(sIdNum);
      }
    }

    // Filter requested selected IDs to only those belonging to batch and eligible
    const selectedSet = new Set(
      Array.isArray(selectedStudentIds)
        ? selectedStudentIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : []
    );

    const publishIds = [];
    const unpublishIds = [];

    for (const sId of batchStudentIds) {
      if (selectedSet.has(sId) && eligibleStudentIds.has(sId)) {
        publishIds.push(sId);
      } else {
        unpublishIds.push(sId);
      }
    }

    console.log("🔄 [publishCertificates] Publishing plan:", {
      totalBatchStudents: batchStudentIds.size,
      eligibleCount: eligibleStudentIds.size,
      publishIds,
      unpublishIds,
    });

    // 3. Execute transactional update to guarantee consistency
    await transaction.begin();
    isTransactionBegun = true;

    // Reset IS_CERTIFICATE to 0 for all students in the batch
    await new sql.Request(transaction)
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        UPDATE u
        SET u.IS_CERTIFICATE = 0
        FROM USERS u
        INNER JOIN STUDENT_ALLOCATIONS sa ON sa.STUDENT_ID = u.USER_ID
        WHERE sa.BATCH_ID = @BATCH_ID
      `);

    // Set IS_CERTIFICATE = 1 for the selected eligible students
    if (publishIds.length > 0) {
      const idsStr = publishIds.join(",");
      await new sql.Request(transaction).query(`
        UPDATE USERS
        SET IS_CERTIFICATE = 1
        WHERE USER_ID IN (${idsStr})
      `);
    }

    await transaction.commit();
    isTransactionBegun = false;

    // Verification check after commit
    const verifyRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, bId)
      .query(`
        SELECT u.USER_ID, u.USERNAME, u.IS_CERTIFICATE
        FROM USERS u WITH (NOLOCK)
        INNER JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = u.USER_ID
        WHERE sa.BATCH_ID = @BATCH_ID
      `);

    console.log("✅ [publishCertificates] Updated USERS table state:", verifyRes.recordset);

    return res.json({
      status: 1,
      success: true,
      message: "Certificates published successfully",
      publishedCount: publishIds.length,
      unpublishedCount: unpublishIds.length,
      publishedStudentIds: publishIds,
      unpublishedStudentIds: unpublishIds,
    });
  } catch (error) {
    if (isTransactionBegun) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        console.error("❌ publishCertificates rollback error:", rbErr);
      }
    }
    console.error("❌ publishCertificates error:", error);
    return res.status(500).json({
      status: 0,
      success: false,
      message: "Failed to publish certificates",
      error: error.message,
    });
  }
};

module.exports = {
  getTutorBatches,
  getTheoryTemplatesList,
  getPracticalKitsList,
  assignFinalAssessment,
  createTheoryAssessment,
  getTutorTheoryAssessments,
  getTheoryAssessmentById,
  updateTheoryAssessment,
  updateTheoryAssessmentStatus,
  deleteTheoryAssessment,
  createPracticalAssessment,
  getTutorPracticalAssessments,
  updatePracticalAssessment,
  updatePracticalAssessmentStatus,
  deletePracticalAssessment,
  getAllFinalAssessments,
  getStudentAssignedFinalAssessment,
  uploadFinalAssessmentFiles,
  submitFinalAssessmentProject,
  getTutorBatchSubmissions,
  getSubmissionPreview,
  submitEvaluation,
  getStudentCertificate,
  getPublishStudents,
  publishCertificates,
};

