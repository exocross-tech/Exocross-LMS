const { getPool, sql } = require("../config/database");

const savePracticeExamAttempt = async (req, res) => {
  try {
    const {
      STUDENT_ID,
      ASSESMENT_ID,
      TOTAL_QUESTIONS,
      STUDENT_ANSWERED,
      UNANSWERED,
      UNVISITED,
      STUDENT_MARK,
      MARK_PERCENTAGE,
      STUDENT_ANSWER,
      PROJECT_KIT_ID,
      PROJECT_KIT_IMAGE,
    } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!STUDENT_ID) {
      return res.status(400).json({
        status: 0,
        message: "STUDENT_ID is required",
      });
    }

    if (!ASSESMENT_ID) {
      return res.status(400).json({
        status: 0,
        message: "ASSESMENT_ID is required",
      });
    }

    const pool = getPool();

    // ==========================================
    // VALUES
    // ==========================================

    const totalQuestions = Number(TOTAL_QUESTIONS) || 0;
    const studentAnswered = Number(STUDENT_ANSWERED) || 0;
    const unanswered = Number(UNANSWERED) || 0;
    const unvisited = Number(UNVISITED) || 0;
    const studentMark = Number(STUDENT_MARK) || 0;
    const markPercentage = Number(MARK_PERCENTAGE) || 0;

    let parsedKitId = null;
    if (PROJECT_KIT_ID && Number.isInteger(Number(PROJECT_KIT_ID)) && Number(PROJECT_KIT_ID) > 0) {
      parsedKitId = Number(PROJECT_KIT_ID);
    }

    // Determine Project Kit image path from req.file or req.body
    let finalKitImagePath = PROJECT_KIT_IMAGE || null;
    if (req.file) {
      const studentIdVal = Number(STUDENT_ID);
      finalKitImagePath = `uploads/student-project-kits/${studentIdVal}/${req.file.filename}`;
    }

    // If no PROJECT_KIT_ID passed explicitly, check if the assignment has one
    if (!parsedKitId) {
      const alertKitCheck = await pool
        .request()
        .input("ASSESMENT_ID", sql.Int, Number(ASSESMENT_ID))
        .query(`
          SELECT PROJECT_KIT_ID
          FROM ASSIGNMENT_ALERTS WITH (NOLOCK)
          WHERE ASSIGNMENT_ID = @ASSESMENT_ID
        `);
      if (alertKitCheck.recordset.length > 0 && alertKitCheck.recordset[0].PROJECT_KIT_ID) {
        parsedKitId = Number(alertKitCheck.recordset[0].PROJECT_KIT_ID);
      }
    }

    // ==========================================
    // INSERT
    // ==========================================

    const result = await pool
      .request()
      .input(
        "STUDENT_ID",
        sql.Int,
        Number(STUDENT_ID)
      )
      .input(
        "ASSESMENT_ID",
        sql.Int,
        Number(ASSESMENT_ID)
      )
      .input(
        "TOTAL_QUESTIONS",
        sql.Int,
        totalQuestions
      )
      .input(
        "STUDENT_ANSWERED",
        sql.Int,
        studentAnswered
      )
      .input(
        "UNANSWERED",
        sql.Int,
        unanswered
      )
      .input(
        "UNVISITED",
        sql.Int,
        unvisited
      )
      .input(
        "STUDENT_MARK",
        sql.Decimal(10, 2),
        studentMark
      )
      .input(
        "MARK_PERCENTAGE",
        sql.Decimal(10, 2),
        markPercentage
      )
      .input(
        "STUDENT_ANSWER",
        sql.NVarChar(sql.MAX),
        STUDENT_ANSWER || null
      )
      .input(
        "PROJECT_KIT_ID",
        sql.Int,
        parsedKitId
      )
      .input(
        "PROJECT_KIT_IMAGE",
        sql.NVarChar(500),
        finalKitImagePath
      )
      .query(`
        INSERT INTO ASSESMENT_EXAM
        (
          STUDENT_ID,
          ASSESMENT_ID,
          TOTAL_QUESTIONS,
          STUDENT_ANSWERED,
          UNANSWERED,
          UNVISITED,
          STUDENT_MARK,
          MARK_PERCENTAGE,
          STUDENT_ANSWER,
          PROJECT_KIT_ID,
          PROJECT_KIT_IMAGE,
          CREATED_ON
        )
        OUTPUT
          INSERTED.ID,
          INSERTED.MARK_PERCENTAGE,
          INSERTED.STUDENT_MARK,
          INSERTED.PROJECT_KIT_ID,
          INSERTED.PROJECT_KIT_IMAGE
        VALUES
        (
          @STUDENT_ID,
          @ASSESMENT_ID,
          @TOTAL_QUESTIONS,
          @STUDENT_ANSWERED,
          @UNANSWERED,
          @UNVISITED,
          @STUDENT_MARK,
          @MARK_PERCENTAGE,
          @STUDENT_ANSWER,
          @PROJECT_KIT_ID,
          @PROJECT_KIT_IMAGE,
          GETDATE()
        )
      `);

    return res.status(200).json({
      status: 1,
      message: "Practice exam attempt saved successfully",

      ATTEMPT_ID: result.recordset[0]?.ID,

      STUDENT_MARK:
        result.recordset[0]?.STUDENT_MARK,

      SCORE_PERCENTAGE:
        result.recordset[0]?.MARK_PERCENTAGE,

      PROJECT_KIT_ID:
        result.recordset[0]?.PROJECT_KIT_ID,

      PROJECT_KIT_IMAGE:
        result.recordset[0]?.PROJECT_KIT_IMAGE,
    });

  } catch (error) {
    console.error(
      "Save practice exam attempt error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message: "Failed to save practice exam attempt",
      error: error.message,
    });
  }
};

const getStudentAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    const studentId = Number(userId);

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student user ID is required",
      });
    }

    const pool = getPool();

    // Check whether student already has regular exam records or final assessment submissions
    const examResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .query(`
        SELECT DISTINCT ASSESMENT_ID
        FROM ASSESMENT_EXAM WITH (NOLOCK)
        WHERE STUDENT_ID = @STUDENT_ID
      `);

    const finalSubmissionsResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .query(`
        SELECT DISTINCT ASSESSMENT_ID
        FROM STUDENT_ASSESSMENT_SUBMISSIONS WITH (NOLOCK)
        WHERE STUDENT_ID = @STUDENT_ID
          AND IMAGE_1 IS NOT NULL AND LTRIM(RTRIM(IMAGE_1)) <> ''
          AND VIDEO_1 IS NOT NULL AND LTRIM(RTRIM(VIDEO_1)) <> ''
      `);

    const completedAssignmentIds = new Set([
      ...examResult.recordset.map((row) => Number(row.ASSESMENT_ID)),
      ...finalSubmissionsResult.recordset.map((row) => Number(row.ASSESSMENT_ID)),
    ]);

    // Get student active batch
    const batchResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .query(`
        SELECT TOP 1
          SA.BATCH_ID
        FROM STUDENT_ALLOCATIONS SA WITH (NOLOCK)

        INNER JOIN BATCHES B WITH (NOLOCK)
          ON B.ID = SA.BATCH_ID

        WHERE SA.STUDENT_ID = @STUDENT_ID
          AND ISNULL(B.IS_ACTIVE, 1) = 1

        ORDER BY SA.BATCH_ID
      `);

    if (batchResult.recordset.length === 0) {
      return res.json({
        status: 1,
        batchId: null,
        data: [],
        message: "Student is not assigned to any active batch",
      });
    }

    const batchId = Number(batchResult.recordset[0].BATCH_ID);

    // Get assignments for the batch (with PROJECT_KITS joined)
    const result = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          AA.ASSIGNMENT_ID,
          AA.BATCH_ID,
          AA.SET_ID,
          AA.MODULE_ID,
          AA.PROJECT_KIT_ID,
          AA.ASSESSMENT_TYPE,
          AA.CREATED_AT,

          M.MODULE_NAME,

          QT.TEMPLATE_NAME AS SET_NAME,

          PK.KIT_NAME AS PROJECT_KIT_NAME,
          PK.IMAGE_URL AS PROJECT_KIT_IMAGE_URL,

          QB.ID AS QUESTION_ID,
          QB.QUESTION AS QUESTION_TEXT,

          -- Question mark
          ISNULL(QB.MARK, 0) AS QUESTION_MARK

        FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)

        LEFT JOIN MODULES M WITH (NOLOCK)
          ON M.ID = AA.MODULE_ID
          AND ISNULL(M.IS_ACTIVE, 1) = 1

        LEFT JOIN QUESTION_TEMPLATES QT WITH (NOLOCK)
          ON QT.ID = AA.SET_ID
          AND ISNULL(QT.IS_ACTIVE, 1) = 1

        LEFT JOIN PROJECT_KITS PK WITH (NOLOCK)
          ON PK.ID = AA.PROJECT_KIT_ID

        OUTER APPLY OPENJSON(
          ISNULL(QT.QUESTION_IDS, '[]')
        ) J

        LEFT JOIN QUESTION_BANK QB WITH (NOLOCK)
          ON QB.ID = TRY_CAST(J.value AS INT)
          AND (AA.MODULE_ID IS NULL OR QB.MODULE_ID = AA.MODULE_ID)
          AND ISNULL(QB.IS_ACTIVE, 1) = 1

        WHERE AA.BATCH_ID = @BATCH_ID
          AND (
            AA.ASSESSMENT_TYPE IS NULL
            OR (
              UPPER(AA.ASSESSMENT_TYPE) NOT LIKE 'FINAL_ASSESSMENT%'
              AND UPPER(AA.ASSESSMENT_TYPE) NOT IN ('FINAL_ASSESSMENT', 'FINAL_ASSESSMENT_THEORY', 'THEORY', 'PRACTICAL')
            )
          )

        ORDER BY
          ISNULL(M.ID, 999999),
          AA.CREATED_AT DESC,
          QB.ID
      `);

    const moduleMap = {};

    result.recordset.forEach((row) => {
      const assignmentId = Number(row.ASSIGNMENT_ID);
      const hasQuestionSet = Boolean(row.SET_ID);
      const hasProjectKit = Boolean(row.PROJECT_KIT_ID);

      // Unique module key: use MODULE_ID if present, or assign a synthetic key based on assignmentId for kit-only assignments
      const moduleId = row.MODULE_ID ? Number(row.MODULE_ID) : (900000 + assignmentId);
      const moduleName = row.MODULE_NAME || (hasProjectKit ? (row.PROJECT_KIT_NAME || "Project Kit Assessment") : "Assessment");

      if (!moduleMap[moduleId]) {
        moduleMap[moduleId] = {
          MODULE_ID: moduleId,
          MODULE_NAME: moduleName,
          ASSESSMENT_TYPE: (row.ASSESSMENT_TYPE || "ASSESSMENT").toUpperCase(),
          SET_COUNT: 0,
          QUESTION_COUNT: 0,
          TOTAL_MARKS: 0,
          PROJECT_KIT_ID: hasProjectKit ? Number(row.PROJECT_KIT_ID) : null,
          PROJECT_KIT_NAME: row.PROJECT_KIT_NAME || null,
          PROJECT_KIT_IMAGE_URL: row.PROJECT_KIT_IMAGE_URL || null,
          HAS_PROJECT_KIT: hasProjectKit,
          HAS_QUESTION_SET: hasQuestionSet,
          sets: [],
        };
      }

      const module = moduleMap[moduleId];

      let questionSet = module.sets.find(
        (set) =>
          Number(set.ASSIGNMENT_ID) === assignmentId
      );

      if (!questionSet) {
        questionSet = {
          ASSIGNMENT_ID: assignmentId,
          BATCH_ID: Number(row.BATCH_ID),
          SET_ID: row.SET_ID ? Number(row.SET_ID) : null,
          MODULE_ID: row.MODULE_ID ? Number(row.MODULE_ID) : moduleId,
          SET_NAME: row.SET_NAME || (hasProjectKit ? (row.PROJECT_KIT_NAME || "Project Kit") : "Question Set"),
          ASSESSMENT_TYPE: (row.ASSESSMENT_TYPE || "ASSESSMENT").toUpperCase(),
          CREATED_AT: row.CREATED_AT,
          QUESTION_COUNT: 0,
          TOTAL_MARKS: 0,
          PROJECT_KIT_ID: hasProjectKit ? Number(row.PROJECT_KIT_ID) : null,
          PROJECT_KIT_NAME: row.PROJECT_KIT_NAME || null,
          PROJECT_KIT_IMAGE_URL: row.PROJECT_KIT_IMAGE_URL || null,
          HAS_PROJECT_KIT: hasProjectKit,
          HAS_QUESTION_SET: hasQuestionSet,

          // Assignment-wise exam button: 0 if already attempted (exists in ASSESMENT_EXAM), 1 if pending
          isShowExamButton:
            completedAssignmentIds.has(assignmentId) ||
            (row.SET_ID && completedAssignmentIds.has(Number(row.SET_ID)))
              ? 0
              : 1,

          questions: [],
        };

        module.sets.push(questionSet);
        module.SET_COUNT += 1;
      }

      if (
        row.QUESTION_ID !== null &&
        row.QUESTION_ID !== undefined
      ) {
        const questionId = Number(row.QUESTION_ID);

        const alreadyExists = questionSet.questions.some(
          (question) =>
            Number(question.QUESTION_ID) === questionId
        );

        if (!alreadyExists) {
          const questionMark =
            Number(row.QUESTION_MARK) || 0;

          questionSet.questions.push({
            QUESTION_ID: questionId,
            QUESTION_TEXT: row.QUESTION_TEXT || "",
            MARK: questionMark,
          });

          questionSet.QUESTION_COUNT += 1;
          questionSet.TOTAL_MARKS += questionMark;
          module.QUESTION_COUNT += 1;
          module.TOTAL_MARKS += questionMark;
        }
      }
    });

    const modules = Object.values(moduleMap);

    return res.json({
      status: 1,
      batchId,
      data: modules,
    });
  } catch (error) {
    console.error(
      "Get student assignments error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message: "Failed to load assignments",
      error: error.message,
    });
  }
};

const getAssignmentExam = async (req, res) => {
  try {
    const { SET_ID, ASSIGNMENT_ID } = req.query;

    const pool = getPool();
    const setIdNum = SET_ID && !isNaN(Number(SET_ID)) ? Number(SET_ID) : null;
    const assignmentIdNum = ASSIGNMENT_ID && !isNaN(Number(ASSIGNMENT_ID)) ? Number(ASSIGNMENT_ID) : null;

    let projectKitInfo = null;

    // Check project kit info from ASSIGNMENT_ALERTS if ASSIGNMENT_ID provided or SET_ID provided
    if (assignmentIdNum || setIdNum) {
      const kitQuery = pool.request();
      let whereClause = "";
      if (assignmentIdNum) {
        kitQuery.input("A_ID", sql.Int, assignmentIdNum);
        whereClause = "AA.ASSIGNMENT_ID = @A_ID";
      } else {
        kitQuery.input("S_ID", sql.Int, setIdNum);
        whereClause = "AA.SET_ID = @S_ID";
      }

      const kitRes = await kitQuery.query(`
        SELECT
          AA.ASSIGNMENT_ID,
          AA.PROJECT_KIT_ID,
          PK.KIT_NAME AS PROJECT_KIT_NAME,
          PK.IMAGE_URL AS PROJECT_KIT_IMAGE_URL
        FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)
        LEFT JOIN PROJECT_KITS PK WITH (NOLOCK)
          ON PK.ID = AA.PROJECT_KIT_ID
        WHERE ${whereClause}
      `);

      if (kitRes.recordset.length > 0 && kitRes.recordset[0].PROJECT_KIT_ID) {
        projectKitInfo = {
          PROJECT_KIT_ID: kitRes.recordset[0].PROJECT_KIT_ID,
          PROJECT_KIT_NAME: kitRes.recordset[0].PROJECT_KIT_NAME,
          PROJECT_KIT_IMAGE_URL: kitRes.recordset[0].PROJECT_KIT_IMAGE_URL,
        };
      }
    }

    // 1. If SET_ID provided, check QUESTION_TEMPLATES
    if (setIdNum && setIdNum > 0) {
      const result = await pool
        .request()
        .input("SET_ID", sql.Int, setIdNum)
        .query(`
          SELECT
            QB.ID,
            QB.MODULE_ID,
            M.MODULE_NAME,
            QB.QUESTION,
            QB.QUESTION_TYPE,

            QB.OPTION_A,
            QB.OPTION_B,
            QB.OPTION_C,
            QB.OPTION_D,

            QB.CORRECT_ANSWER,
            QB.MARK,

            QB.FILLBLANK_ANSWER,
            QB.ESSAY_ANSWER,
            QB.LABELLING_ANSWER

          FROM QUESTION_TEMPLATES QT WITH (NOLOCK)

          CROSS APPLY OPENJSON(
            ISNULL(QT.QUESTION_IDS, '[]')
          ) J

          INNER JOIN QUESTION_BANK QB WITH (NOLOCK)
            ON QB.ID = TRY_CAST(J.value AS INT)

          LEFT JOIN MODULES M WITH (NOLOCK)
            ON QB.MODULE_ID = M.ID

          WHERE QT.ID = @SET_ID
            AND ISNULL(QT.IS_ACTIVE, 1) = 1
            AND ISNULL(QB.IS_ACTIVE, 1) = 1

          ORDER BY
            TRY_CAST(J.[key] AS INT)
        `);

      if (result.recordset.length > 0) {
        return res.json({
          status: 1,
          SET_ID: setIdNum,
          totalQuestions: result.recordset.length,
          projectKit: projectKitInfo,
          data: result.recordset,
        });
      }

      // 2. Check FINAL_ASSESSMENTS
      const faResult = await pool
        .request()
        .input("SET_ID", sql.Int, setIdNum)
        .query(`
          SELECT
            fa.ID,
            0 AS MODULE_ID,
            fa.TITLE AS MODULE_NAME,
            fa.DESCRIPTION AS QUESTION,
            'SHORT ESSAY' AS QUESTION_TYPE,

            NULL AS OPTION_A,
            NULL AS OPTION_B,
            NULL AS OPTION_C,
            NULL AS OPTION_D,

            NULL AS CORRECT_ANSWER,
            100 AS MARK,

            NULL AS FILLBLANK_ANSWER,
            fa.DESCRIPTION AS ESSAY_ANSWER,
            NULL AS LABELLING_ANSWER
          FROM FINAL_ASSESSMENTS fa WITH (NOLOCK)
          WHERE fa.ID = @SET_ID
            AND ISNULL(fa.IS_ACTIVE, 1) = 1
        `);

      if (faResult.recordset.length > 0) {
        return res.json({
          status: 1,
          SET_ID: setIdNum,
          totalQuestions: faResult.recordset.length,
          projectKit: projectKitInfo,
          data: faResult.recordset,
        });
      }
    }

    // 3. If Project Kit only (no questions)
    if (projectKitInfo) {
      return res.json({
        status: 1,
        SET_ID: setIdNum,
        totalQuestions: 0,
        projectKit: projectKitInfo,
        data: [],
      });
    }

    return res.json({
      status: 1,
      SET_ID: setIdNum,
      totalQuestions: 0,
      projectKit: null,
      data: [],
    });
  } catch (error) {
    console.error("Get assignment exam error:", error);

    return res.status(500).json({
      status: 0,
      message: "Failed to load assignment questions",
      error: error.message,
    });
  }
};

const getStudentAssessmentResults = async (req, res) => {
  try {
    const rawUserId =
      req.params.userId ||
      req.query.userId ||
      req.query.STUDENT_ID ||
      req.user?.USER_ID;

    const studentId = Number(rawUserId);

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid student ID is required",
      });
    }

    const pool = getPool();

    // Ensure evaluation columns exist in ASSESMENT_EXAM
    try {
      await pool.query(`
        IF OBJECT_ID('ASSESMENT_EXAM', 'U') IS NOT NULL
        BEGIN
          IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_MARK') IS NULL
            ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_MARK DECIMAL(5,2) NULL;

          IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_COMMENT') IS NULL
            ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_COMMENT NVARCHAR(MAX) NULL;

          IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_EVALUATED_BY') IS NULL
            ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_EVALUATED_BY INT NULL;

          IF COL_LENGTH('ASSESMENT_EXAM', 'PROJECT_KIT_REVIEWED_DATE') IS NULL
            ALTER TABLE ASSESMENT_EXAM ADD PROJECT_KIT_REVIEWED_DATE DATETIME NULL;

          IF COL_LENGTH('ASSESMENT_EXAM', 'IS_PROJECT_KIT_EVALUATED') IS NULL
            ALTER TABLE ASSESMENT_EXAM ADD IS_PROJECT_KIT_EVALUATED BIT NOT NULL DEFAULT 0;
        END
      `);
    } catch (_) {}

    const result = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .query(`
        SELECT
          ae.ID,
          ae.STUDENT_ID,
          ae.ASSESMENT_ID,
          aa.SET_ID,
          COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS ASSESSMENT_NAME,
          m.MODULE_NAME,
          ae.PROJECT_KIT_ID,
          ae.PROJECT_KIT_IMAGE,
          ae.PROJECT_KIT_MARK,
          ae.PROJECT_KIT_COMMENT,
          ae.PROJECT_KIT_EVALUATED_BY,
          ae.PROJECT_KIT_REVIEWED_DATE,
          ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS IS_PROJECT_KIT_EVALUATED,
          pk.KIT_NAME AS PROJECT_KIT_NAME,
          pk.IMAGE_URL AS PROJECT_KIT_IMAGE_URL,
          ae.TOTAL_QUESTIONS,
          ae.STUDENT_ANSWERED,
          ae.UNANSWERED,
          ae.UNVISITED,
          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.STUDENT_ANSWER,
          ae.CREATED_ON
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK)
          ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
        LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK)
          ON qt.ID = aa.SET_ID
        LEFT JOIN MODULES m WITH (NOLOCK)
          ON m.ID = aa.MODULE_ID
        LEFT JOIN PROJECT_KITS pk WITH (NOLOCK)
          ON pk.ID = ISNULL(ae.PROJECT_KIT_ID, aa.PROJECT_KIT_ID)
        WHERE ae.STUDENT_ID = @STUDENT_ID
        ORDER BY
          ae.CREATED_ON DESC,
          ae.ID DESC
      `);

    // Extract all question IDs across attempts
    const allQuestionIds = new Set();
    const parsedRows = result.recordset.map((row) => {
      let parsedAnswers = [];
      try {
        parsedAnswers = row.STUDENT_ANSWER ? JSON.parse(row.STUDENT_ANSWER) : [];
      } catch (e) {
        parsedAnswers = [];
      }
      parsedAnswers.forEach((q) => {
        if (q.QUESTION_ID && Number(q.QUESTION_ID) > 0) {
          allQuestionIds.add(Number(q.QUESTION_ID));
        }
      });
      return {
        ...row,
        STUDENT_ANSWER: parsedAnswers,
      };
    });

    // Fetch question details from QUESTION_BANK if any question IDs exist
    const questionMap = new Map();
    if (allQuestionIds.size > 0) {
      const idList = Array.from(allQuestionIds);
      const qbRequest = pool.request();
      const paramNames = idList.map((id, index) => {
        const param = `qId_${index}`;
        qbRequest.input(param, sql.Int, id);
        return `@${param}`;
      });

      const qbResult = await qbRequest.query(`
        SELECT
          ID,
          QUESTION_TYPE,
          QUESTION,
          MARK,
          CORRECT_ANSWER,
          FILLBLANK_ANSWER,
          ESSAY_ANSWER,
          LABELLING_ANSWER,
          OPTION_A,
          OPTION_B,
          OPTION_C,
          OPTION_D
        FROM QUESTION_BANK WITH (NOLOCK)
        WHERE ID IN (${paramNames.join(",")})
      `);

      qbResult.recordset.forEach((qb) => {
        questionMap.set(Number(qb.ID), qb);
      });
    }

    const data = parsedRows.map((row) => {
      const enrichedAnswers = (row.STUDENT_ANSWER || []).map((q) => {
        const qb = questionMap.get(Number(q.QUESTION_ID));
        let resolvedCorrectAnswer = q.CORRECT_ANSWER;

        if (!resolvedCorrectAnswer && qb) {
          if (qb.QUESTION_TYPE === "MULTIPLE CHOICE") {
            const optLetter = (qb.CORRECT_ANSWER || "").toUpperCase().trim();
            let optText = "";
            if (optLetter === "A") optText = qb.OPTION_A;
            else if (optLetter === "B") optText = qb.OPTION_B;
            else if (optLetter === "C") optText = qb.OPTION_C;
            else if (optLetter === "D") optText = qb.OPTION_D;

            resolvedCorrectAnswer = optLetter
              ? optText
                ? `${optLetter}: ${optText}`
                : optLetter
              : qb.CORRECT_ANSWER || "";
          } else if (qb.QUESTION_TYPE === "FILL IN THE BLANKS") {
            resolvedCorrectAnswer = qb.FILLBLANK_ANSWER || qb.CORRECT_ANSWER;
          } else if (
            qb.QUESTION_TYPE === "SHORT ESSAY" ||
            qb.QUESTION_TYPE === "ESSAY"
          ) {
            resolvedCorrectAnswer = qb.ESSAY_ANSWER || qb.CORRECT_ANSWER;
          } else if (qb.QUESTION_TYPE === "LABELLING") {
            resolvedCorrectAnswer = qb.LABELLING_ANSWER || qb.CORRECT_ANSWER;
          } else {
            resolvedCorrectAnswer =
              qb.CORRECT_ANSWER ||
              qb.FILLBLANK_ANSWER ||
              qb.ESSAY_ANSWER ||
              qb.LABELLING_ANSWER;
          }
        }

        // Clean JSON strings in fill in the blank answers if array format
        if (typeof resolvedCorrectAnswer === "string") {
          try {
            const parsed = JSON.parse(resolvedCorrectAnswer);
            if (Array.isArray(parsed)) {
              resolvedCorrectAnswer = parsed.join(", ");
            }
          } catch (e) {
            // Keep string as is
          }
        }

        return {
          QUESTION_ID: q.QUESTION_ID,
          QUESTION: q.QUESTION || qb?.QUESTION || "",
          QUESTION_TYPE: q.QUESTION_TYPE || qb?.QUESTION_TYPE || "",
          STUDENT_ANSWER: q.STUDENT_ANSWER,
          CORRECT_ANSWER: resolvedCorrectAnswer || null,
          MARK: q.MARK !== undefined ? Number(q.MARK) : Number(qb?.MARK || 0),
          GIVEN_MARK: q.GIVEN_MARK !== undefined ? Number(q.GIVEN_MARK) : 0,
        };
      });

      const rawKitImg = row.PROJECT_KIT_IMAGE;
      let studentKitImage = null;
      if (rawKitImg && typeof rawKitImg === "string" && rawKitImg.trim()) {
        const clean = rawKitImg.trim().replace(/\\/g, "/");
        if (clean.startsWith("http://") || clean.startsWith("https://")) {
          studentKitImage = clean;
        } else {
          const stripped = clean.replace(/^\/+/, "");
          if (stripped.startsWith("uploads/")) {
            studentKitImage = `/${stripped}`;
          } else if (stripped.startsWith("student-project-kits/")) {
            studentKitImage = `/uploads/${stripped}`;
          } else {
            studentKitImage = `/uploads/student-project-kits/${row.STUDENT_ID}/${stripped}`;
          }
        }
      }

      // Determine Assessment Types (Theory vs Project Kit)
      // Only consider theory if question answers exist or a valid question set ID was assigned
      const hasQuestions = enrichedAnswers.length > 0 || (row.SET_ID && Number(row.SET_ID) > 0);
      const hasProjectKit = Boolean(
        (row.PROJECT_KIT_ID && Number(row.PROJECT_KIT_ID) > 0) ||
        (studentKitImage && studentKitImage.trim() !== "") ||
        (row.PROJECT_KIT_NAME && row.PROJECT_KIT_NAME.trim() !== "")
      );

      const isKitEvaluated = Boolean(row.IS_PROJECT_KIT_EVALUATED);
      const kitMark = row.PROJECT_KIT_MARK !== null && row.PROJECT_KIT_MARK !== undefined
        ? Number(row.PROJECT_KIT_MARK)
        : null;

      // Calculate Theory marks and max mark
      const sumTheoryMaxMarks = enrichedAnswers.reduce((acc, curr) => acc + (Number(curr.MARK) || 0), 0);
      const totalQuestionsCount = enrichedAnswers.length;
      const theoryMaxMark = sumTheoryMaxMarks > 0 ? sumTheoryMaxMarks : (totalQuestionsCount > 0 ? totalQuestionsCount : 100);
      const rawTheoryMark = Number(row.STUDENT_MARK) || 0;
      const rawTheoryPercentage = theoryMaxMark > 0
        ? (rawTheoryMark / theoryMaxMark) * 100
        : (Number(row.MARK_PERCENTAGE) || 0);

      let assessmentKind = "THEORY_ONLY";
      let evaluationStatus = "COMPLETED";
      let finalScore = null;
      let finalPercentage = null;
      let theoryWeightedScore = null;
      let kitWeightedScore = null;

      if (hasQuestions && hasProjectKit) {
        // Case 3: Theory + Project Kit
        // Theory weight = 75%, Project Kit weight = 25%
        assessmentKind = "THEORY_AND_PROJECT_KIT";
        evaluationStatus = isKitEvaluated ? "Reviewed" : "Pending Evaluation";
        theoryWeightedScore = Number(((rawTheoryPercentage / 100) * 75).toFixed(2)); // 75%
        if (isKitEvaluated && kitMark !== null) {
          kitWeightedScore = Number(((kitMark / 100) * 25).toFixed(2)); // 25%
          finalScore = Number((theoryWeightedScore + kitWeightedScore).toFixed(2));
          finalPercentage = finalScore;
        }
      } else if (!hasQuestions && hasProjectKit) {
        // Case 1: Project Kit Only
        // Project Kit is out of 100 and contributes 100% of the final result
        assessmentKind = "PROJECT_KIT_ONLY";
        evaluationStatus = isKitEvaluated ? "Reviewed" : "Pending Evaluation";
        if (isKitEvaluated && kitMark !== null) {
          kitWeightedScore = kitMark;
          finalScore = kitMark;
          finalPercentage = kitMark;
        }
      } else {
        // Case 2: Theory Only
        // Final result remains out of 100
        assessmentKind = "THEORY_ONLY";
        evaluationStatus = "COMPLETED";
        finalScore = rawTheoryMark;
        finalPercentage = Number(rawTheoryPercentage.toFixed(2));
        theoryWeightedScore = rawTheoryMark;
      }

      return {
        ID: row.ID,
        STUDENT_ID: row.STUDENT_ID,
        ASSESMENT_ID: row.ASSESMENT_ID,
        ASSESSMENT_NAME:
          row.ASSESSMENT_NAME || `Assessment #${row.ASSESMENT_ID}`,
        MODULE_NAME: row.MODULE_NAME || "",
        PROJECT_KIT_ID: row.PROJECT_KIT_ID || null,
        PROJECT_KIT_IMAGE: studentKitImage,
        STUDENT_PROJECT_KIT_IMAGE: studentKitImage,
        PROJECT_KIT_NAME: row.PROJECT_KIT_NAME || null,
        PROJECT_KIT_IMAGE_URL: studentKitImage || (row.PROJECT_KIT_IMAGE_URL ? (row.PROJECT_KIT_IMAGE_URL.startsWith("/") || row.PROJECT_KIT_IMAGE_URL.startsWith("http") ? row.PROJECT_KIT_IMAGE_URL : `/${row.PROJECT_KIT_IMAGE_URL}`) : null),
        TEMPLATE_PROJECT_KIT_IMAGE_URL: row.PROJECT_KIT_IMAGE_URL || null,
        TOTAL_QUESTIONS: totalQuestionsCount,
        STUDENT_ANSWERED: Number(row.STUDENT_ANSWERED) || 0,
        UNANSWERED: Number(row.UNANSWERED) || 0,
        UNVISITED: Number(row.UNVISITED) || 0,
        STUDENT_MARK: rawTheoryMark,
        MARK_PERCENTAGE: Number(rawTheoryPercentage.toFixed(2)),
        STUDENT_ANSWER: enrichedAnswers,
        CREATED_ON: row.CREATED_ON,
        // Evaluation & Weightage Fields
        ASSESSMENT_KIND: assessmentKind,
        HAS_THEORY: hasQuestions,
        HAS_PROJECT_KIT: hasProjectKit,
        IS_PROJECT_KIT_EVALUATED: isKitEvaluated,
        EVALUATION_STATUS: evaluationStatus,
        THEORY_MAX_MARK: theoryMaxMark,
        THEORY_WEIGHTED_SCORE: theoryWeightedScore,
        PROJECT_KIT_MARK: kitMark,
        PROJECT_KIT_WEIGHTED_SCORE: kitWeightedScore,
        PROJECT_KIT_COMMENT: row.PROJECT_KIT_COMMENT || "",
        PROJECT_KIT_REVIEWED_DATE: row.PROJECT_KIT_REVIEWED_DATE || null,
        FINAL_SCORE: finalScore,
        FINAL_PERCENTAGE: finalPercentage,
      };
    });

    return res.status(200).json({
      status: 1,
      message: "Assessment results fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get student assessment results error:", error);

    return res.status(500).json({
      status: 0,
      message: "Failed to fetch assessment results",
      error: error.message,
    });
  }
};

module.exports = {
  savePracticeExamAttempt,
  getStudentAssignments,
  getAssignmentExam,
  getStudentAssessmentResults,
};
