const { getPool, sql } = require("../config/database");
const sanitizeQuestionHtml = (html) => {
  if (!html || typeof html !== "string") return html;
  return html
    .replace(/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/api)?\/ckeditor-upload-images\//gi, "/api/ckeditor-upload-images/")
    .replace(/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/api)?\/ckeditor-upload-images\//gi, "/api/ckeditor-upload-images/")
    .replace(/(?:https?:)?\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/api)?\/uploads\//gi, "/api/uploads/")
    .replace(/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/api)?\/uploads\//gi, "/api/uploads/");
};

const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  createSchema,
  updateSchema,
} = require("../validators/questionBankValidator");

// 📌 Create Question
const createQuestion = async (req, res) => {
  try {
    // Joi validation
    const { error } = createSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        status: 0,
        errors: error.details.map((e) => e.message),
        message: error.details.map((e) => e.message).join(", "),
      });
    }

    const {
      MODULE_ID,
      QUESTION_TYPE,
      MARK,
      DIFFICULTY_LEVEL,
      QUESTION,
      FILLBLANK_ANSWER,
      OPTION_A,
      OPTION_B,
      OPTION_C,
      OPTION_D,
      ESSAY_ANSWER,
      CORRECT_ANSWER,
      LABELLING_ANSWER,
      USER_ID,
    } = req.body;

    const trimmedDifficulty = DIFFICULTY_LEVEL ? String(DIFFICULTY_LEVEL).trim() : null;

    const pool = await getPool();
    const insertReq = pool.request();

    insertReq
      .input("MODULE_ID", sql.Int, MODULE_ID || null)
      .input("QUESTION_TYPE", sql.NVarChar(100), QUESTION_TYPE || null)
      .input("MARK", sql.Int, MARK || 0)
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), trimmedDifficulty)
      .input("QUESTION", sql.NVarChar(sql.MAX), sanitizeQuestionHtml(QUESTION) || null)
      .input("FILLBLANK_ANSWER", sql.NVarChar(sql.MAX), FILLBLANK_ANSWER || null)
      .input("OPTION_A", sql.NVarChar(sql.MAX), OPTION_A || null)
      .input("OPTION_B", sql.NVarChar(sql.MAX), OPTION_B || null)
      .input("OPTION_C", sql.NVarChar(sql.MAX), OPTION_C || null)
      .input("OPTION_D", sql.NVarChar(sql.MAX), OPTION_D || null)
      .input("ESSAY_ANSWER", sql.NVarChar(sql.MAX), ESSAY_ANSWER || null)
      .input("CORRECT_ANSWER", sql.NVarChar(sql.MAX), CORRECT_ANSWER || null)
      .input("LABELLING_ANSWER", sql.NVarChar(sql.MAX), LABELLING_ANSWER || null)
      .input("USER_ID", sql.Int, USER_ID || 0);

    await insertReq.query(`
      INSERT INTO QUESTION_BANK
      (
        MODULE_ID,
        QUESTION_TYPE,
        MARK,
        DIFFICULTY_LEVEL,
        QUESTION,
        FILLBLANK_ANSWER,
        OPTION_A,
        OPTION_B,
        OPTION_C,
        OPTION_D,
        ESSAY_ANSWER,
        CORRECT_ANSWER,
        LABELLING_ANSWER,
        IS_ACTIVE,
        CREATED_BY,
        CREATED_ON,
        UPDATED_BY,
        UPDATED_ON
      )
      VALUES
      (
        @MODULE_ID,
        @QUESTION_TYPE,
        @MARK,
        @DIFFICULTY_LEVEL,
        @QUESTION,
        @FILLBLANK_ANSWER,
        @OPTION_A,
        @OPTION_B,
        @OPTION_C,
        @OPTION_D,
        @ESSAY_ANSWER,
        @CORRECT_ANSWER,
        @LABELLING_ANSWER,
        1,
        @USER_ID,
        GETDATE(),
        @USER_ID,
        GETDATE()
      )
    `);

    return res.status(200).json({
      status: 1,
      message: "Question created successfully",
    });

  } catch (err) {
    console.error("createQuestion error:", err);

    return res.status(500).json({
      status: 0,
      error: err.message,
    });
  }
};

// 📌 Get All Question

function getDisplayText(html) {
  if (!html) return "";
  const $ = cheerio.load(html);
  const img = $("img").first();
  if (img.length && img.attr("alt")) {
    return img.attr("alt");
  }
  return $.text().trim();
}

const getQuestions = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", QUESTION_TYPE = "" } = req.body;

    const safeString = (v) => (typeof v === "string" ? v.trim() : "");
    const safeNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    page = safeNumber(page) || 1;
    limit = safeNumber(limit) || 10;

    search = safeString(search);
    QUESTION_TYPE = safeString(QUESTION_TYPE);

    const offset = (page - 1) * limit;

    const whereClauses = [];
    const params = {};

    // Search
    if (search) {
      whereClauses.push(`
        (
          M.MODULE_NAME LIKE @search
          OR QB.QUESTION LIKE @search
          OR QB.CORRECT_ANSWER LIKE @search
          OR QB.DIFFICULTY_LEVEL LIKE @search
        )
      `);

      params.search = {
        type: sql.NVarChar,
        value: `%${search}%`,
      };
    }

    // Question Type
    if (QUESTION_TYPE) {
      whereClauses.push(`
        QB.QUESTION_TYPE = @QUESTION_TYPE
      `);

      params.QUESTION_TYPE = {
        type: sql.NVarChar,
        value: QUESTION_TYPE,
      };
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT
        QB.ID,
        QB.MODULE_ID,
        M.MODULE_NAME,
        QB.QUESTION_TYPE,
        QB.MARK,
        QB.DIFFICULTY_LEVEL,
        QB.QUESTION,
        QB.FILLBLANK_ANSWER,
        QB.OPTION_A,
        QB.OPTION_B,
        QB.OPTION_C,
        QB.OPTION_D,
        QB.ESSAY_ANSWER,
        QB.CORRECT_ANSWER,
        QB.LABELLING_ANSWER,
        QB.IS_ACTIVE,
        QB.CREATED_ON,
        QB.CREATED_BY,
        QB.UPDATED_ON,
        QB.UPDATED_BY
      FROM QUESTION_BANK QB WITH (NOLOCK)
      LEFT JOIN MODULES M WITH (NOLOCK)
        ON QB.MODULE_ID = M.ID
      ${whereSql}
      ORDER BY QB.ID DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(*) AS totalCount
      FROM QUESTION_BANK QB WITH (NOLOCK)
      LEFT JOIN MODULES M WITH (NOLOCK)
        ON QB.MODULE_ID = M.ID
      ${whereSql};
    `;

    const pool = await getPool();
    const request = pool.request();

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    Object.keys(params).forEach((key) => {
      request.input(key, params[key].type, params[key].value);
    });

    const result = await request.query(query);

    const rows = result.recordsets[0] || [];
    const totalCount = result.recordsets[1]?.[0]?.totalCount || 0;

    res.json({
      status: 1,
      data: rows.map((q) => ({
        ...q,
        QUESTION_TEXT: getDisplayText(q.QUESTION),
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("❌ getQuestions error:", err);

    res.status(500).json({
      status: 0,
      error: err.message,
    });
  }
};

const getQuestionByType = async (req, res) => {
  const { BOOK_ID, CHAPTER, QUESTION_TYPE } = req.body;

  try {
    const pool = await getPool();
    const request = pool.request();
    request
      .input("BOOK_ID", BOOK_ID)
      .input("CHAPTER", CHAPTER)
      .input("QUESTION_TYPE", QUESTION_TYPE);

    const result = await request.query(`
      SELECT * 
      FROM QUESTION_BANK WITH (NOLOCK)
      WHERE BOOK_ID = @BOOK_ID
        AND LTRIM(RTRIM(CHAPTER)) = LTRIM(RTRIM(@CHAPTER))
        AND LTRIM(RTRIM(QUESTION_TYPE)) = LTRIM(RTRIM(@QUESTION_TYPE))
    `);

    res.json({ status: 1, data: result.recordset });
  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ status: 0, error: err.message });
  }
};

// 📌 Update Question
const updateQuestion = async (req, res) => {
  try {
    // Joi validation
    const { error } = updateSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        status: 0,
        errors: error.details.map((e) => e.message),
        message: error.details.map((e) => e.message).join(", "),
      });
    }

    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid question ID",
      });
    }

    const {
      MODULE_ID,
      QUESTION_TYPE,
      MARK,
      DIFFICULTY_LEVEL,
      QUESTION,
      FILLBLANK_ANSWER,
      OPTION_A,
      OPTION_B,
      OPTION_C,
      OPTION_D,
      ESSAY_ANSWER,
      CORRECT_ANSWER,
      LABELLING_ANSWER,
      USER_ID,
    } = req.body;

    const trimmedDifficulty = DIFFICULTY_LEVEL ? String(DIFFICULTY_LEVEL).trim() : null;

    const pool = await getPool();

    // Check question exists
    const checkReq = pool.request();
    checkReq.input("id", sql.Int, id);

    const oldRecordResult = await checkReq.query(`
      SELECT *
      FROM QUESTION_BANK WITH (NOLOCK)
      WHERE ID = @id
    `);

    if (oldRecordResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Question not found",
      });
    }

    // Update ONLY QUESTION_BANK
    const updateReq = pool.request();
    updateReq
      .input("id", sql.Int, id)
      .input("MODULE_ID", sql.Int, MODULE_ID || null)
      .input("QUESTION_TYPE", sql.NVarChar(100), QUESTION_TYPE || null)
      .input("MARK", sql.Int, MARK || 0)
      .input("DIFFICULTY_LEVEL", sql.NVarChar(50), trimmedDifficulty)
      .input("QUESTION", sql.NVarChar(sql.MAX), sanitizeQuestionHtml(QUESTION) || null)
      .input("FILLBLANK_ANSWER", sql.NVarChar(sql.MAX), FILLBLANK_ANSWER || null)
      .input("OPTION_A", sql.NVarChar(sql.MAX), OPTION_A || null)
      .input("OPTION_B", sql.NVarChar(sql.MAX), OPTION_B || null)
      .input("OPTION_C", sql.NVarChar(sql.MAX), OPTION_C || null)
      .input("OPTION_D", sql.NVarChar(sql.MAX), OPTION_D || null)
      .input("ESSAY_ANSWER", sql.NVarChar(sql.MAX), ESSAY_ANSWER || null)
      .input("CORRECT_ANSWER", sql.NVarChar(sql.MAX), CORRECT_ANSWER || null)
      .input("LABELLING_ANSWER", sql.NVarChar(sql.MAX), LABELLING_ANSWER || null)
      .input("USER_ID", sql.Int, USER_ID || 0);

    await updateReq.query(`
      UPDATE QUESTION_BANK
      SET
        MODULE_ID = @MODULE_ID,
        QUESTION_TYPE = @QUESTION_TYPE,
        MARK = @MARK,
        DIFFICULTY_LEVEL = @DIFFICULTY_LEVEL,
        QUESTION = @QUESTION,
        FILLBLANK_ANSWER = @FILLBLANK_ANSWER,
        OPTION_A = @OPTION_A,
        OPTION_B = @OPTION_B,
        OPTION_C = @OPTION_C,
        OPTION_D = @OPTION_D,
        ESSAY_ANSWER = @ESSAY_ANSWER,
        CORRECT_ANSWER = @CORRECT_ANSWER,
        LABELLING_ANSWER = @LABELLING_ANSWER,
        UPDATED_BY = @USER_ID,
        UPDATED_ON = GETDATE()
      WHERE ID = @id
    `);

    return res.json({
      status: 1,
      message: "Question details updated successfully",
    });
  } catch (err) {
    console.error("❌ updateQuestion error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// 📌 Delete Question
const deleteQuestion = async (req, res) => {
  try {
    const qId = Number(req.query.id);
    if (!qId || isNaN(qId)) {
      return res.status(400).json({ status: 0, message: "Valid ID required" });
    }

    const pool = await getPool();
    const checkReq = pool.request();
    checkReq.input("id", sql.Int, qId);

    const QuestionResult = await checkReq.query(`
      SELECT * FROM QUESTION_BANK WITH (NOLOCK) WHERE ID = @id
    `);

    if (QuestionResult.recordset.length === 0) {
      return res.status(200).json({ status: 0, message: "ID not found" });
    }

    const deletedData = JSON.stringify(QuestionResult.recordset[0]);

    // 2️⃣ Insert into DELETE_LOGS if table exists
    try {
      const logReq = pool.request();
      logReq
        .input("deletedData", sql.NVarChar(sql.MAX), deletedData)
        .input("userId", sql.NVarChar(100), String(req.query?.userId || "System"));

      await logReq.query(`
        IF OBJECT_ID('DELETE_LOGS', 'U') IS NOT NULL
        BEGIN
          INSERT INTO DELETE_LOGS (TABLE_NAME, DELETED_DATA, DELETED_BY, DELETED_ON)
          VALUES ('QUESTION_BANK', @deletedData, @userId, GETDATE())
        END
      `);
    } catch (logErr) {
      console.warn("Delete log insertion skipped:", logErr.message);
    }

    const delReq = pool.request();
    delReq.input("id", sql.Int, qId);
    await delReq.query(`DELETE FROM QUESTION_BANK WHERE ID = @id`);

    res.json({ status: 1, message: "Question details deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📌 Delete Bulk Question
const deleteBulkQuestion = async (req, res) => {
  try {
    const { ids, userId } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 0, message: "No ids provided" });
    }

    // Validate and sanitize IDs
    const validIds = ids
      .filter((id) => Number.isInteger(Number(id)))
      .map(Number);

    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ status: 0, message: "Invalid ids provided" });
    }

    const pool = await getPool();
    const checkReq = pool.request();
    const paramNames = validIds.map((id, index) => {
      const p = `id_${index}`;
      checkReq.input(p, sql.Int, id);
      return `@${p}`;
    });

    // Fetch records to log deletion
    const QuestionResult = await checkReq.query(
      `SELECT * FROM QUESTION_BANK WITH (NOLOCK) WHERE ID IN (${paramNames.join(",")})`
    );

    if (QuestionResult.recordset.length === 0) {
      return res
        .status(200)
        .json({ status: 0, message: "No matching questions found" });
    }

    // Insert into DELETE_LOGS if table exists
    try {
      for (const record of QuestionResult.recordset) {
        const deletedData = JSON.stringify(record);
        const logReq = pool.request();
        logReq
          .input("deletedData", sql.NVarChar(sql.MAX), deletedData)
          .input("userId", sql.NVarChar(100), String(userId || "System"));

        await logReq.query(`
          IF OBJECT_ID('DELETE_LOGS', 'U') IS NOT NULL
          BEGIN
            INSERT INTO DELETE_LOGS (TABLE_NAME, DELETED_DATA, DELETED_BY, DELETED_ON)
            VALUES ('QUESTION_BANK', @deletedData, @userId, GETDATE())
          END
        `);
      }
    } catch (logErr) {
      console.warn("Delete bulk log insertion skipped:", logErr.message);
    }

    // Delete records
    const delReq = pool.request();
    const delParams = validIds.map((id, index) => {
      const p = `did_${index}`;
      delReq.input(p, sql.Int, id);
      return `@${p}`;
    });

    await delReq.query(
      `DELETE FROM QUESTION_BANK WHERE ID IN (${delParams.join(",")})`
    );

    res.json({ status: 1, message: "Questions deleted successfully" });
  } catch (err) {
    res.status(500).json({ status: 0, error: err.message });
  }
};

const updateQuestionStatus = async (req, res) => {
  try {
    const { ID, IS_ACTIVE } = req.body;

    const pool = await getPool();
    const checkReq = pool.request();
    checkReq.input("ID", sql.Int, Number(ID));

    const questionResult = await checkReq.query(`
      SELECT ID
      FROM QUESTION_BANK WITH (NOLOCK)
      WHERE ID = @ID
    `);

    if (questionResult.recordset.length === 0) {
      return res.status(200).json({
        status: 0,
        message: "ID not found",
      });
    }

    const updateReq = pool.request();
    updateReq
      .input("ID", sql.Int, Number(ID))
      .input("IS_ACTIVE", IS_ACTIVE);

    await updateReq.query(`
      UPDATE QUESTION_BANK
      SET IS_ACTIVE = @IS_ACTIVE
      WHERE ID = @ID
    `);

    res.json({
      status: 1,
      message: "Status updated successfully",
    });
  } catch (err) {
    console.error("❌ updateQuestionStatus error:", err);

    res.status(500).json({
      status: 0,
      error: err.message,
    });
  }
};

// 📌 Get Chapterlist by bookid
const getChapterByBookId = async (req, res) => {
  const { bookId } = req.query;
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input("bookId", bookId);

    const result = await reqDb.query(`
      SELECT DISTINCT
        q.CHAPTER AS CHAPTER_NAME,
        j.[CHAPTER_TITLE]
      FROM dbo.QUESTION_BANK q WITH (NOLOCK)
      INNER JOIN dbo.MST_BOOKS m WITH (NOLOCK) ON q.BOOK_ID = m.ID
      CROSS APPLY OPENJSON(m.CHAPTER_DETAILS)
        WITH (
          CHAPTER_NAME NVARCHAR(100) '$.CHAPTER_NAME',
          CHAPTER_TITLE NVARCHAR(500) '$.CHAPTER_TITLE'
        ) j
      WHERE q.BOOK_ID = @bookId
        AND q.CHAPTER = j.CHAPTER_NAME
      ORDER BY q.CHAPTER;
    `);

    res.json({ status: 1, data: result.recordset });
  } catch (err) {
    res.status(500).json({ status: 0, error: err.message });
  }
};

// 📌 Get Total Marks by Chapter
const getMarkByChapter = async (req, res) => {
  const { bookId, chapter } = req.query;
  try {
    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input("bookId", bookId);

    const result = await reqDb.query(`
      SELECT DISTINCT
        q.CHAPTER AS CHAPTER_NAME,
        j.[CHAPTER_TITLE]
      FROM dbo.QUESTION_BANK q WITH (NOLOCK)
      INNER JOIN dbo.MST_BOOKS m WITH (NOLOCK) ON q.BOOK_ID = m.ID
      CROSS APPLY OPENJSON(m.CHAPTER_DETAILS)
        WITH (
          CHAPTER_NAME NVARCHAR(100) '$.CHAPTER_NAME',
          CHAPTER_TITLE NVARCHAR(500) '$.CHAPTER_TITLE'
        ) j
      WHERE q.BOOK_ID = @bookId
        AND q.CHAPTER = j.CHAPTER_NAME
      ORDER BY q.CHAPTER;
    `);

    res.json({ status: 1, data: result.recordset });
  } catch (err) {
    res.status(500).json({ status: 0, error: err.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    const base64Image = req.body.image;
    if (!base64Image)
      return res.status(400).json({ status: 0, error: "No image provided" });

    // Extract base64 data
    const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const uploadFolder = path.join(__dirname, "../ckeditor-upload-images");
    if (!fs.existsSync(uploadFolder))
      fs.mkdirSync(uploadFolder, { recursive: true });

    const fileName = `${Date.now()}-image.png`;
    const filePath = path.join(uploadFolder, fileName);

    let outputBuffer = buffer;

    let quality = 90;
    while (outputBuffer.length / 1024 > 250 && quality > 10) {
      outputBuffer = await sharp(buffer).png({ quality }).toBuffer();
      quality -= 10;
    }

    fs.writeFileSync(filePath, outputBuffer);

    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = forwardedProto
      ? forwardedProto.split(",")[0].trim()
      : req.protocol || "http";
    let host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3310";
    if (process.env.NODE_ENV === "production" || process.env.PUBLIC_API_URL) {
      if (process.env.PUBLIC_API_URL) {
        host = process.env.PUBLIC_API_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      } else if (/^(?:127\.0\.0\.1|localhost)/i.test(host)) {
        host = process.env.PUBLIC_HOST || "lms.exocross.com";
      }
    }
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
    const imageUrl = `${baseUrl}/api/ckeditor-upload-images/${fileName}`;
    const relativeUrl = `/api/ckeditor-upload-images/${fileName}`;

    return res.json({
      status: 1,
      message: "Image saved successfully",
      default: imageUrl,
      url: imageUrl,
      relativeUrl: relativeUrl,
    });
  } catch (err) {
    console.error(err);
    return res.json({ status: 0, error: err.message });
  }
};

const deleteCkeditorImage = async (req, res) => {
  const { image } = req.body;
  const filename = path.basename(image);
  const filePath = path.join(
    __dirname,
    "../ckeditor-upload-images",
    filename
  );

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: "File not found", filePath });
    }

    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete" });
      res.json({ status: "deleted" });
    });
  });
};

const safeParse = (val, fallback = []) => {
  try {
    return typeof val === "string" ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const getAnswerHTML = (q) => {
  switch (q.QUESTION_TYPE) {
    case "TRUE/FALSE":
    case "JUMBLE WORD":
    case "MISSING LETTERS":
      return `<b>${q.CORRECT_ANSWER || "-"}</b>`;

    case "MULTIPLE CHOICE":
      return `
        <b>${{
          A: q.OPTION_A,
          B: q.OPTION_B,
          C: q.OPTION_C,
          D: q.OPTION_D,
        }[q.CORRECT_ANSWER] || "-"
        }</b>
      `;

    case "MATCHING": {
      const left = safeParse(q.LEFT_ITEMS);
      const right = safeParse(q.RIGHT_ITEMS);
      const matches = safeParse(q.CORRECT_MATCHES, {});

      return `
        <table border="1" width="100%" cellpadding="5">
          ${left.items
          ?.map(
            (l, i) => `
              <tr>
                <td>${l}</td>
                <td>${right.items?.[matches[i]] || ""}</td>
              </tr>
            `,
          )
          .join("")}
        </table>
      `;
    }

    case "PICTURE LABELLING":
      return safeParse(q.LABELLING_ANSWER)
        .map((a, i) => `${i + 1}. ${a}`)
        .join(", ");

    case "SEQUENCE":
      return safeParse(q.SEQUENCE_ANSWER)
        .map((a, i) => `${i + 1}. ${a}`)
        .join("<br>");

    case "FILL IN THE BLANKS":
    case "IMAGE IDENTIFICATION":
      return safeParse(q.FILLBLANK_ANSWER)
        .map((a) => `"${a}"`)
        .join("<br>");

    case "MULTIPLE RESPONSE": {
      const opts = safeParse(q.MULTIPLE_RESPONSE_OPTIONS);
      const ans = safeParse(q.MULTIPLE_RESPONSE_ANSWER);

      return ans.map((i) => `<div>${opts[i] || ""}</div>`).join("");
    }

    case "SHORT ESSAY":
    case "LONG ESSAY":
      return `
       ${q.ESSAY_ANSWER || "-"}
        ${safeParse(q.FILLBLANK_ANSWER).length
          ? `<b>Keywords:</b><br>${safeParse(q.FILLBLANK_ANSWER)
            .map((k) => `"${k}"`)
            .join("<br>")}<br><br>`
          : ""
        }       
      `;

    default:
      return "-";
  }
};

const renderOptionsWithAnswer = (q) => {
  let options = [];
  let correctKeys = [];

  /* MULTIPLE CHOICE */
  if (q.QUESTION_TYPE === "MULTIPLE CHOICE") {
    options = [q.OPTION_A, q.OPTION_B, q.OPTION_C, q.OPTION_D].filter(Boolean);

    if (q.CORRECT_ANSWER) {
      correctKeys = [q.CORRECT_ANSWER]; // ex: ["A"]
    }
  }

  /* MULTIPLE RESPONSE */
  if (q.QUESTION_TYPE === "MULTIPLE RESPONSE") {
    try {
      options = JSON.parse(q.MULTIPLE_RESPONSE_OPTIONS || "[]");
      correctKeys = JSON.parse(q.MULTIPLE_RESPONSE_ANSWER || "[]"); // indexes
    } catch {
      options = [];
      correctKeys = [];
    }
  }

  return `
    <div class="options-grid">
      ${options
      .map((opt, idx) => {
        const key = String.fromCharCode(65 + idx);
        const isCorrect =
          q.QUESTION_TYPE === "MULTIPLE CHOICE"
            ? correctKeys.includes(key)
            : correctKeys.includes(idx);

        return `
            <div class="option-item ${isCorrect ? "correct" : ""}">
              <span class="opt-key">(${key})</span>
              <span class="opt-text">${opt}</span>
              ${isCorrect ? `<span class="tick">✔</span>` : ""}
            </div>
          `;
      })
      .join("")}
    </div>
  `;
};

module.exports = {
  createQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  updateQuestionStatus,
  getChapterByBookId,
  getMarkByChapter,
  getQuestionByType,
  uploadImage,
  deleteCkeditorImage,
  deleteBulkQuestion,
};
