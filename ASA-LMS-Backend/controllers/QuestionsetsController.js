const { getPool, sql } = require("../config/database");
const { ALLOWED_MODULE_CODES } = require("../validators/questionBankValidator");

// =====================================================
// CREATE TEMPLATE
// =====================================================
const createTemplate = async (req, res) => {
  try {
    const {
      TEMPLATE_NAME,
      QUESTION_IDS,
      DIFFICULTY_LEVEL,
      CREATED_BY,
    } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------
    if (!TEMPLATE_NAME || !TEMPLATE_NAME.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Template name is required",
      });
    }

    if (!QUESTION_IDS) {
      return res.status(400).json({
        status: 0,
        message: "Question IDs are required",
      });
    }

    let trimmedDiff = null;
    if (
      DIFFICULTY_LEVEL !== undefined &&
      DIFFICULTY_LEVEL !== null &&
      String(DIFFICULTY_LEVEL).trim() !== ""
    ) {
      trimmedDiff = String(DIFFICULTY_LEVEL).trim();
      if (!ALLOWED_MODULE_CODES.includes(trimmedDiff)) {
        return res.status(400).json({
          status: 0,
          message: "Difficulty Level must be one of: M1, M2, M3, M4, M5, M6, M7, M8",
        });
      }
    }

    // -----------------------------
    // Convert QUESTION_IDS
    // -----------------------------
    let questionIds = [];

    try {
      questionIds =
        typeof QUESTION_IDS === "string"
          ? JSON.parse(QUESTION_IDS)
          : QUESTION_IDS;
    } catch (error) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs format",
      });
    }

    // -----------------------------
    // Validate array
    // -----------------------------
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Select at least one question",
      });
    }

    // -----------------------------
    // Validate IDs
    // -----------------------------
    questionIds = questionIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs",
      });
    }

    // Remove duplicate IDs
    questionIds = [...new Set(questionIds)];

    // -----------------------------
    // Check questions exist
    // -----------------------------
    const pool = await getPool();
    const checkReq = pool.request();
    const paramNames = questionIds.map((id, index) => {
      const p = `qid_${index}`;
      checkReq.input(p, sql.Int, id);
      return `@${p}`;
    });

    const questionResult = await checkReq.query(`
      SELECT ID
      FROM QUESTION_BANK WITH (NOLOCK)
      WHERE ID IN (${paramNames.join(",")})
    `);

    const existingIds = questionResult.recordset.map(
      (row) => Number(row.ID)
    );

    if (existingIds.length !== questionIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected questions do not exist",
      });
    }

    // -----------------------------
    // Save template
    // -----------------------------
    const questionIdsJson = JSON.stringify(questionIds);
    const setType = String(req.body.SET_TYPE || req.body.type || "ASSESSMENT").trim().toUpperCase();

    const insertReq = pool.request();
    insertReq
      .input("TEMPLATE_NAME", sql.NVarChar(255), TEMPLATE_NAME.trim())
      .input("QUESTION_IDS", sql.NVarChar(sql.MAX), questionIdsJson)
      .input("SET_TYPE", sql.NVarChar(50), setType)
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), trimmedDiff)
      .input("CREATED_BY", sql.Int, CREATED_BY || 0);

    const result = await insertReq.query(`
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
        @SET_TYPE,
        @DIFFICULTY_LEVEL,
        @CREATED_BY,
        GETDATE(),
        @CREATED_BY,
        GETDATE(),
        1
      )
    `);

    return res.status(200).json({
      status: 1,
      message: "Template created successfully",
      data: {
        ID: result.recordset[0]?.ID,
        TEMPLATE_NAME: TEMPLATE_NAME.trim(),
        QUESTION_IDS: questionIds,
        SET_TYPE: setType,
        DIFFICULTY_LEVEL: trimmedDiff,
      },
    });
  } catch (error) {
    console.error("❌ createTemplate error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// GET ALL TEMPLATES
// =====================================================
const getTemplates = async (req, res) => {
  try {
    const pool = await getPool();
    const typeParam =
      req.query?.type ||
      req.query?.SET_TYPE ||
      req.query?.question_set_type ||
      req.body?.type ||
      req.body?.SET_TYPE ||
      req.body?.question_set_type;

    const diffParam =
      req.query?.DIFFICULTY_LEVEL ||
      req.query?.difficulty ||
      req.body?.DIFFICULTY_LEVEL ||
      req.body?.difficulty;

    const request = pool.request();
    let typeClause = "";
    let diffClause = "";

    if (typeParam && String(typeParam).trim()) {
      const normalizedType = String(typeParam).trim().toUpperCase();
      request.input("SET_TYPE", sql.NVarChar(50), normalizedType);
      typeClause = " AND UPPER(ISNULL(SET_TYPE, 'ASSESSMENT')) = @SET_TYPE ";
    }

    if (diffParam && String(diffParam).trim()) {
      const normalizedDiff = String(diffParam).trim();
      request.input("DIFFICULTY_LEVEL", sql.NVarChar(50), normalizedDiff);
      diffClause = " AND DIFFICULTY_LEVEL = @DIFFICULTY_LEVEL ";
    }

    const result = await request.query(`
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
        ISNULL(SET_TYPE, 'ASSESSMENT') AS SET_TYPE,
        CREATED_BY,
        CREATED_AT,
        UPDATED_BY,
        UPDATED_AT,
        IS_ACTIVE
      FROM QUESTION_TEMPLATES WITH (NOLOCK)
      WHERE ISNULL(IS_ACTIVE, 1) = 1
      ${typeClause}
      ${diffClause}
      ORDER BY ID DESC
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getTemplates error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// GET TEMPLATE BY ID
// =====================================================
const getTemplateById = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid template ID",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input("id", sql.Int, id);

    const result = await reqDb.query(`
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
        ISNULL(SET_TYPE, 'ASSESSMENT') AS SET_TYPE,
        CREATED_BY,
        CREATED_AT,
        UPDATED_BY,
        UPDATED_AT,
        IS_ACTIVE
      FROM QUESTION_TEMPLATES WITH (NOLOCK)
      WHERE ID = @id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Template not found",
      });
    }

    return res.json({
      status: 1,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("❌ getTemplateById error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// UPDATE TEMPLATE
// =====================================================
const updateTemplate = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      TEMPLATE_NAME,
      QUESTION_IDS,
      DIFFICULTY_LEVEL,
      UPDATED_BY,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid template ID",
      });
    }

    if (!TEMPLATE_NAME || !TEMPLATE_NAME.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Template name is required",
      });
    }

    let trimmedDiff = null;
    let shouldUpdateDiff = false;
    if (DIFFICULTY_LEVEL !== undefined) {
      shouldUpdateDiff = true;
      if (DIFFICULTY_LEVEL !== null && String(DIFFICULTY_LEVEL).trim() !== "") {
        trimmedDiff = String(DIFFICULTY_LEVEL).trim();
        if (!ALLOWED_MODULE_CODES.includes(trimmedDiff)) {
          return res.status(400).json({
            status: 0,
            message: "Difficulty Level must be one of: M1, M2, M3, M4, M5, M6, M7, M8",
          });
        }
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
        questionIds
          .map(Number)
          .filter(
            (id) => Number.isInteger(id) && id > 0
          )
      ),
    ];

    if (questionIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question IDs",
      });
    }

    const pool = await getPool();

    // Check template
    const checkTempReq = pool.request();
    checkTempReq.input("id", sql.Int, id);

    const existingTemplate = await checkTempReq.query(`
      SELECT ID
      FROM QUESTION_TEMPLATES WITH (NOLOCK)
      WHERE ID = @id
    `);

    if (existingTemplate.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Template not found",
      });
    }

    // Check questions
    const checkQReq = pool.request();
    const paramNames = questionIds.map((qid, index) => {
      const p = `qid_${index}`;
      checkQReq.input(p, sql.Int, qid);
      return `@${p}`;
    });

    const questionResult = await checkQReq.query(`
      SELECT ID
      FROM QUESTION_BANK WITH (NOLOCK)
      WHERE ID IN (${paramNames.join(",")})
    `);

    if (questionResult.recordset.length !== questionIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected questions do not exist",
      });
    }

    const updateReq = pool.request();
    updateReq
      .input("id", sql.Int, id)
      .input("TEMPLATE_NAME", sql.NVarChar(255), TEMPLATE_NAME.trim())
      .input("QUESTION_IDS", sql.NVarChar(sql.MAX), JSON.stringify(questionIds))
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), trimmedDiff)
      .input("UPDATED_BY", sql.Int, UPDATED_BY || 0);

    const diffUpdateClause = shouldUpdateDiff ? ", DIFFICULTY_LEVEL = @DIFFICULTY_LEVEL" : "";

    await updateReq.query(`
      UPDATE QUESTION_TEMPLATES
      SET
        TEMPLATE_NAME = @TEMPLATE_NAME,
        QUESTION_IDS = @QUESTION_IDS
        ${diffUpdateClause},
        UPDATED_BY = @UPDATED_BY,
        UPDATED_AT = GETDATE()
      WHERE ID = @id
    `);

    return res.json({
      status: 1,
      message: "Template updated successfully",
      data: {
        ID: id,
        TEMPLATE_NAME: TEMPLATE_NAME.trim(),
        QUESTION_IDS: questionIds,
        DIFFICULTY_LEVEL: trimmedDiff,
      },
    });
  } catch (error) {
    console.error("❌ updateTemplate error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// ACTIVATE / DEACTIVATE TEMPLATE
// =====================================================
const updateTemplateStatus = async (req, res) => {
  try {
    const {
      ID,
      IS_ACTIVE,
      UPDATED_BY,
    } = req.body;

    if (!ID) {
      return res.status(400).json({
        status: 0,
        message: "Template ID is required",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb
      .input("ID", sql.Int, Number(ID))
      .input("IS_ACTIVE", IS_ACTIVE)
      .input("UPDATED_BY", sql.Int, UPDATED_BY || 0);

    await reqDb.query(`
      UPDATE QUESTION_TEMPLATES
      SET
        IS_ACTIVE = @IS_ACTIVE,
        UPDATED_BY = @UPDATED_BY,
        UPDATED_AT = GETDATE()
      WHERE ID = @ID
    `);

    return res.json({
      status: 1,
      message: "Template status updated successfully",
    });
  } catch (error) {
    console.error("❌ updateTemplateStatus error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// DELETE QUESTION SET
// =====================================================
const deleteTemplate = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question set ID",
      });
    }

    const pool = await getPool();
    const checkReq = pool.request();
    checkReq.input("id", sql.Int, id);

    const existing = await checkReq.query(`
      SELECT ID
      FROM QUESTION_TEMPLATES WITH (NOLOCK)
      WHERE ID = @id
    `);

    if (existing.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Question set not found",
      });
    }

    const delReq = pool.request();
    delReq.input("id", sql.Int, id);

    await delReq.query(`
      DELETE FROM QUESTION_TEMPLATES
      WHERE ID = @id
    `);

    return res.json({
      status: 1,
      message: "Question set deleted successfully",
    });

  } catch (error) {
    console.error(
      "❌ deleteTemplate error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  updateTemplateStatus,
  deleteTemplate,
};