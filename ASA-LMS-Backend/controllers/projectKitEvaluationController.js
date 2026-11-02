const { getPool, sql } = require("../config/database");

// =====================================================
// HELPER: FORMAT PROJECT KIT IMAGE URL
// =====================================================
const formatProjectKitImage = (rawPath, studentId) => {
  if (!rawPath || typeof rawPath !== "string" || !rawPath.trim()) return null;
  const clean = rawPath.trim().replace(/\\/g, "/");
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  const stripped = clean.replace(/^\/+/, "");
  if (stripped.startsWith("uploads/")) {
    return `/${stripped}`;
  }
  if (stripped.startsWith("student-project-kits/")) {
    return `/uploads/${stripped}`;
  }
  return `/uploads/student-project-kits/${studentId}/${stripped}`;
};

// =====================================================
// HELPER: VERIFY TUTOR HOST / TUTOR OF BATCH
// =====================================================
const isTutorOfBatch = async (pool, tutorId, batchId) => {
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
      SELECT 1 AS IS_TUTOR
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
    `);

  return check.recordset.length > 0;
};

// =====================================================
// 1. GET TUTOR BATCHES FOR PROJECT KIT EVALUATION
// =====================================================
const getTutorBatches = async (req, res) => {
  try {
    const { userId } = req.params;
    const tutorId = Number(userId);

    if (!Number.isInteger(tutorId) || tutorId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor user ID is required",
      });
    }

    const pool = await getPool();

    // Check user type (Admin sees all active batches)
    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, tutorId)
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
        .input("USER_ID", sql.Int, tutorId)
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
          ORDER BY b.ID DESC
        `);
    }

    return res.status(200).json({
      status: 1,
      message: "Tutor batches fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    console.error("❌ getTutorBatches error in projectKitEvaluationController:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch tutor batches",
      error: error.message,
    });
  }
};

// =====================================================
// 2. GET SUBMITTED PROJECT KITS FOR EVALUATION
// =====================================================
const getSubmissions = async (req, res) => {
  try {
    const { tutorId, batchId, status, categoryId } = req.query;
    const tId = Number(tutorId);

    if (!Number.isInteger(tId) || tId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor user ID is required",
      });
    }

    const pool = getPool();

    // Check user type (e.g. ADMIN has access to all batches)
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, tId)
      .query(`
        SELECT USER_TYPE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID
      `);
    const isAdmin = userResult.recordset.length > 0 &&
      String(userResult.recordset[0].USER_TYPE || "").toUpperCase().trim() === "ADMIN";

    let authorizedBatchIds = [];

    if (isAdmin) {
      const allBatchesResult = await pool.query(`
        SELECT ID FROM BATCHES WITH (NOLOCK) WHERE IS_ACTIVE = 1
      `);
      authorizedBatchIds = allBatchesResult.recordset.map((r) => Number(r.ID));
    } else {
      // Get all authorized batches for this tutor
      const authorizedBatchesResult = await pool
        .request()
        .input("USER_ID", sql.Int, tId)
        .query(`
          SELECT DISTINCT b.ID
          FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
          INNER JOIN BATCHES b WITH (NOLOCK) ON b.ID = ta.BATCH_ID
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE b.IS_ACTIVE = 1
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
        `);

      authorizedBatchIds = authorizedBatchesResult.recordset.map((r) => Number(r.ID));
    }

    if (authorizedBatchIds.length === 0) {
      return res.status(200).json({
        status: 1,
        message: "No assigned batches found for this tutor",
        data: [],
      });
    }

    // Filter by specific batch if requested
    let targetBatchIds = authorizedBatchIds;
    if (batchId && batchId !== "ALL") {
      const bId = Number(batchId);
      if (!authorizedBatchIds.includes(bId)) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized for this batch",
        });
      }
      targetBatchIds = [bId];
    }

    const request = pool.request();
    const batchParamNames = targetBatchIds.map((id, index) => {
      const p = `bId_${index}`;
      request.input(p, sql.Int, id);
      return `@${p}`;
    });

    let statusCondition = "";
    if (status === "Pending") {
      statusCondition = "AND (ae.IS_PROJECT_KIT_EVALUATED = 0 OR ae.IS_PROJECT_KIT_EVALUATED IS NULL)";
    } else if (status === "Submitted" || status === "Evaluated") {
      statusCondition = "AND ae.IS_PROJECT_KIT_EVALUATED = 1";
    }

    let categoryCondition = "";
    if (categoryId && categoryId !== "ALL") {
      const cId = Number(categoryId);
      if (Number.isInteger(cId) && cId > 0) {
        request.input("CATEGORY_ID", sql.Int, cId);
        categoryCondition = "AND aa.MODULE_ID = @CATEGORY_ID";
      }
    }

    const query = `
      SELECT
        ae.ID AS assessment_exam_id,
        ae.ID,
        ae.STUDENT_ID AS student_id,
        ae.STUDENT_ID,
        ae.ASSESMENT_ID AS assessment_id,
        ae.ASSESMENT_ID,
        ae.PROJECT_KIT_ID AS project_kit_id,
        ae.PROJECT_KIT_ID,
        ae.PROJECT_KIT_IMAGE AS project_kit_image,
        ae.PROJECT_KIT_IMAGE,
        ae.CREATIVITY_MARK AS creativity_mark,
        ae.CREATIVITY_MARK,
        ae.PROBLEM_SOLVING_MARK AS problem_solving_mark,
        ae.PROBLEM_SOLVING_MARK,
        ae.PROJECT_KIT_MARK AS project_kit_mark,
        ae.PROJECT_KIT_MARK,
        ae.PROJECT_KIT_COMMENT AS project_kit_comment,
        ae.PROJECT_KIT_COMMENT,
        ae.PROJECT_KIT_EVALUATED_BY AS project_kit_evaluated_by,
        ae.PROJECT_KIT_EVALUATED_BY,
        ae.PROJECT_KIT_REVIEWED_DATE AS project_kit_reviewed_date,
        ae.PROJECT_KIT_REVIEWED_DATE,
        ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS is_project_kit_evaluated,
        ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS IS_PROJECT_KIT_EVALUATED,
        ae.CREATED_ON AS created_on,
        ae.CREATED_ON AS SUBMITTED_DATE,
        ae.TOTAL_QUESTIONS,
        ae.STUDENT_ANSWERED,
        ae.STUDENT_MARK,
        ae.MARK_PERCENTAGE,
        u.USERNAME AS student_name,
        u.USERNAME AS STUDENT_NAME,
        u.EMAIL_ID AS student_email,
        u.EMAIL_ID AS STUDENT_EMAIL,
        u.MOBILE_NO AS student_mobile,
        u.MOBILE_NO AS STUDENT_MOBILE,
        b.ID AS batch_id,
        b.ID AS BATCH_ID,
        b.BATCH_CODE AS batch_code,
        b.BATCH_CODE,
        b.BATCH_NAME AS batch_name,
        b.BATCH_NAME,
        COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS assessment_name,
        COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS ASSESSMENT_NAME,
        COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS assessment_title,
        m.ID AS module_id,
        m.ID AS MODULE_ID,
        m.MODULE_NAME AS category_name,
        m.MODULE_NAME AS CATEGORY_NAME,
        m.MODULE_NAME AS module_name,
        m.MODULE_NAME,
        pk.KIT_NAME AS project_kit_name,
        pk.KIT_NAME AS PROJECT_KIT_NAME,
        pk.IMAGE_URL AS template_project_kit_image,
        evaluator.USERNAME AS evaluated_by_name,
        evaluator.USERNAME AS EVALUATED_BY_NAME
      FROM ASSESMENT_EXAM ae WITH (NOLOCK)
      INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = ae.STUDENT_ID
      LEFT JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
      LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
      LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = COALESCE(sa.BATCH_ID, aa.BATCH_ID)
      LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
      LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = aa.MODULE_ID
      LEFT JOIN PROJECT_KITS pk WITH (NOLOCK) ON pk.ID = COALESCE(ae.PROJECT_KIT_ID, aa.PROJECT_KIT_ID)
      LEFT JOIN USERS evaluator WITH (NOLOCK) ON evaluator.USER_ID = ae.PROJECT_KIT_EVALUATED_BY
      WHERE COALESCE(sa.BATCH_ID, aa.BATCH_ID) IN (${batchParamNames.join(",")})
        AND ae.PROJECT_KIT_ID IS NOT NULL
        AND ae.PROJECT_KIT_IMAGE IS NOT NULL
        AND LTRIM(RTRIM(ae.PROJECT_KIT_IMAGE)) <> ''
        ${statusCondition}
        ${categoryCondition}
      ORDER BY ae.CREATED_ON DESC, ae.ID DESC
    `;

    const result = await request.query(query);

    const submissions = result.recordset.map((row) => {
      const studentKitImage = formatProjectKitImage(row.PROJECT_KIT_IMAGE, row.STUDENT_ID);
      const isEvaluated = Boolean(row.IS_PROJECT_KIT_EVALUATED);
      const kitMark = row.PROJECT_KIT_MARK !== null && row.PROJECT_KIT_MARK !== undefined
        ? Number(row.PROJECT_KIT_MARK)
        : null;
      const creativityMark = row.CREATIVITY_MARK !== null && row.CREATIVITY_MARK !== undefined
        ? Number(row.CREATIVITY_MARK)
        : null;
      const problemSolvingMark = row.PROBLEM_SOLVING_MARK !== null && row.PROBLEM_SOLVING_MARK !== undefined
        ? Number(row.PROBLEM_SOLVING_MARK)
        : null;

      const statusLabel = isEvaluated ? "Evaluated" : "Pending Evaluation";

      return {
        // Snake_case / lowercase fields
        assessment_exam_id: row.ID,
        student_id: row.STUDENT_ID,
        assessment_id: row.ASSESMENT_ID,
        project_kit_id: row.PROJECT_KIT_ID,
        project_kit_image: studentKitImage,
        creativity_mark: creativityMark,
        problem_solving_mark: problemSolvingMark,
        project_kit_mark: kitMark,
        total_tutor_evaluation: kitMark,
        project_kit_comment: row.PROJECT_KIT_COMMENT || null,
        project_kit_evaluated_by: row.PROJECT_KIT_EVALUATED_BY || null,
        project_kit_reviewed_date: row.PROJECT_KIT_REVIEWED_DATE || null,
        is_project_kit_evaluated: isEvaluated,
        created_on: row.CREATED_ON,
        student_name: row.STUDENT_NAME || "Student",
        student_email: row.STUDENT_EMAIL || "",
        student_mobile: row.STUDENT_MOBILE || "",
        batch_id: row.BATCH_ID,
        batch_code: row.BATCH_CODE,
        batch_name: row.BATCH_NAME,
        assessment_name: row.ASSESSMENT_NAME,
        assessment_title: row.ASSESSMENT_NAME,
        module_id: row.MODULE_ID || null,
        module_name: row.MODULE_NAME || "",
        category_name: row.CATEGORY_NAME || row.MODULE_NAME || "",
        project_kit_name: row.PROJECT_KIT_NAME || `Project Kit #${row.PROJECT_KIT_ID}`,
        status: statusLabel,
        evaluated_by_name: row.EVALUATED_BY_NAME || null,

        // UPPERCASE legacy compatibility fields
        ID: row.ID,
        STUDENT_ID: row.STUDENT_ID,
        STUDENT_NAME: row.STUDENT_NAME || "Student",
        STUDENT_EMAIL: row.STUDENT_EMAIL || "",
        STUDENT_MOBILE: row.STUDENT_MOBILE || "",
        BATCH_ID: row.BATCH_ID,
        BATCH_CODE: row.BATCH_CODE,
        BATCH_NAME: row.BATCH_NAME,
        ASSESSMENT_ID: row.ASSESMENT_ID,
        ASSESSMENT_NAME: row.ASSESSMENT_NAME,
        MODULE_ID: row.MODULE_ID || null,
        MODULE_NAME: row.MODULE_NAME || "",
        CATEGORY_NAME: row.CATEGORY_NAME || row.MODULE_NAME || "",
        PROJECT_KIT_ID: row.PROJECT_KIT_ID,
        PROJECT_KIT_NAME: row.PROJECT_KIT_NAME || `Project Kit #${row.PROJECT_KIT_ID}`,
        STUDENT_PROJECT_KIT_IMAGE: studentKitImage,
        PROJECT_KIT_IMAGE: studentKitImage,
        TEMPLATE_PROJECT_KIT_IMAGE: row.template_project_kit_image || null,
        TOTAL_QUESTIONS: Number(row.TOTAL_QUESTIONS) || 0,
        STUDENT_MARK: Number(row.STUDENT_MARK) || 0,
        MARK_PERCENTAGE: Number(row.MARK_PERCENTAGE) || 0,
        CREATIVITY_MARK: creativityMark,
        PROBLEM_SOLVING_MARK: problemSolvingMark,
        PROJECT_KIT_MARK: kitMark,
        TOTAL_TUTOR_EVALUATION: kitMark,
        PROJECT_KIT_COMMENT: row.PROJECT_KIT_COMMENT || "",
        IS_PROJECT_KIT_EVALUATED: isEvaluated,
        STATUS: statusLabel,
        EVALUATED_BY: row.PROJECT_KIT_EVALUATED_BY,
        EVALUATED_BY_NAME: row.EVALUATED_BY_NAME,
        EVALUATED_DATE: row.PROJECT_KIT_REVIEWED_DATE,
        SUBMITTED_DATE: row.CREATED_ON,
      };
    });

    return res.status(200).json({
      status: 1,
      message: "Submissions fetched successfully",
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error("❌ getSubmissions error in projectKitEvaluationController:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch project kit submissions",
      error: error.message,
    });
  }
};

// =====================================================
// 3. GET SINGLE SUBMISSION PREVIEW DETAILS
// =====================================================
const getSubmissionPreview = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { tutorId } = req.query;
    const subId = Number(submissionId);

    if (!Number.isInteger(subId) || subId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid submission ID is required",
      });
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input("SUBMISSION_ID", sql.Int, subId)
      .query(`
        SELECT
          ae.ID AS assessment_exam_id,
          ae.ID,
          ae.STUDENT_ID AS student_id,
          ae.STUDENT_ID,
          ae.ASSESMENT_ID AS assessment_id,
          ae.ASSESMENT_ID,
          ae.TOTAL_QUESTIONS,
          ae.STUDENT_ANSWERED,
          ae.UNANSWERED,
          ae.UNVISITED,
          ae.STUDENT_MARK,
          ae.MARK_PERCENTAGE,
          ae.STUDENT_ANSWER,
          ae.PROJECT_KIT_ID AS project_kit_id,
          ae.PROJECT_KIT_ID,
          ae.PROJECT_KIT_IMAGE AS project_kit_image,
          ae.PROJECT_KIT_IMAGE,
          ae.CREATIVITY_MARK AS creativity_mark,
          ae.CREATIVITY_MARK,
          ae.PROBLEM_SOLVING_MARK AS problem_solving_mark,
          ae.PROBLEM_SOLVING_MARK,
          ae.PROJECT_KIT_MARK AS project_kit_mark,
          ae.PROJECT_KIT_MARK,
          ae.PROJECT_KIT_COMMENT AS project_kit_comment,
          ae.PROJECT_KIT_COMMENT,
          ae.PROJECT_KIT_EVALUATED_BY AS project_kit_evaluated_by,
          ae.PROJECT_KIT_EVALUATED_BY,
          ae.PROJECT_KIT_REVIEWED_DATE AS project_kit_reviewed_date,
          ae.PROJECT_KIT_REVIEWED_DATE,
          ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS is_project_kit_evaluated,
          ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS IS_PROJECT_KIT_EVALUATED,
          ae.CREATED_ON AS created_on,
          ae.CREATED_ON AS SUBMITTED_DATE,
          u.USERNAME AS student_name,
          u.USERNAME AS STUDENT_NAME,
          u.EMAIL_ID AS student_email,
          u.EMAIL_ID AS STUDENT_EMAIL,
          u.MOBILE_NO AS student_mobile,
          u.MOBILE_NO AS STUDENT_MOBILE,
          b.ID AS batch_id,
          b.ID AS BATCH_ID,
          b.BATCH_CODE AS batch_code,
          b.BATCH_CODE,
          b.BATCH_NAME AS batch_name,
          b.BATCH_NAME,
          COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS assessment_name,
          COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS ASSESSMENT_NAME,
          COALESCE(qt.TEMPLATE_NAME, m.MODULE_NAME, pk.KIT_NAME, CONCAT('Assessment #', ae.ASSESMENT_ID)) AS assessment_title,
          m.ID AS module_id,
          m.ID AS MODULE_ID,
          m.MODULE_NAME AS category_name,
          m.MODULE_NAME AS CATEGORY_NAME,
          m.MODULE_NAME AS module_name,
          m.MODULE_NAME,
          pk.KIT_NAME AS project_kit_name,
          pk.KIT_NAME AS PROJECT_KIT_NAME,
          pk.IMAGE_URL AS template_project_kit_image,
          evaluator.USERNAME AS evaluated_by_name,
          evaluator.USERNAME AS EVALUATED_BY_NAME
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = ae.STUDENT_ID
        LEFT JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
        LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
        LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = COALESCE(sa.BATCH_ID, aa.BATCH_ID)
        LEFT JOIN QUESTION_TEMPLATES qt WITH (NOLOCK) ON qt.ID = aa.SET_ID
        LEFT JOIN MODULES m WITH (NOLOCK) ON m.ID = aa.MODULE_ID
        LEFT JOIN PROJECT_KITS pk WITH (NOLOCK) ON pk.ID = COALESCE(ae.PROJECT_KIT_ID, aa.PROJECT_KIT_ID)
        LEFT JOIN USERS evaluator WITH (NOLOCK) ON evaluator.USER_ID = ae.PROJECT_KIT_EVALUATED_BY
        WHERE ae.ID = @SUBMISSION_ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Submission attempt not found",
      });
    }

    const row = result.recordset[0];

    // Check tutor authorization if tutorId is provided
    if (tutorId && Number.isInteger(Number(tutorId))) {
      const isAuth = await isTutorOfBatch(pool, tutorId, row.BATCH_ID);
      if (!isAuth) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to view this student submission",
        });
      }
    }

    const studentKitImage = formatProjectKitImage(row.PROJECT_KIT_IMAGE, row.STUDENT_ID);
    const isEvaluated = Boolean(row.IS_PROJECT_KIT_EVALUATED);
    const kitMark = row.PROJECT_KIT_MARK !== null && row.PROJECT_KIT_MARK !== undefined
      ? Number(row.PROJECT_KIT_MARK)
      : null;
    const creativityMark = row.CREATIVITY_MARK !== null && row.CREATIVITY_MARK !== undefined
      ? Number(row.CREATIVITY_MARK)
      : null;
    const problemSolvingMark = row.PROBLEM_SOLVING_MARK !== null && row.PROBLEM_SOLVING_MARK !== undefined
      ? Number(row.PROBLEM_SOLVING_MARK)
      : null;

    let parsedAnswers = [];
    try {
      parsedAnswers = row.STUDENT_ANSWER ? JSON.parse(row.STUDENT_ANSWER) : [];
    } catch (_) {
      parsedAnswers = [];
    }

    const statusLabel = isEvaluated ? "Evaluated" : "Pending Evaluation";

    return res.status(200).json({
      status: 1,
      message: "Submission details fetched successfully",
      data: {
        assessment_exam_id: row.ID,
        student_id: row.STUDENT_ID,
        assessment_id: row.ASSESMENT_ID,
        project_kit_id: row.PROJECT_KIT_ID,
        project_kit_image: studentKitImage,
        creativity_mark: creativityMark,
        problem_solving_mark: problemSolvingMark,
        project_kit_mark: kitMark,
        total_tutor_evaluation: kitMark,
        project_kit_comment: row.PROJECT_KIT_COMMENT || null,
        project_kit_evaluated_by: row.PROJECT_KIT_EVALUATED_BY || null,
        project_kit_reviewed_date: row.PROJECT_KIT_REVIEWED_DATE || null,
        is_project_kit_evaluated: isEvaluated,
        created_on: row.CREATED_ON,
        student_name: row.STUDENT_NAME || "Student",
        student_email: row.STUDENT_EMAIL || "",
        student_mobile: row.STUDENT_MOBILE || "",
        batch_id: row.BATCH_ID,
        batch_code: row.BATCH_CODE,
        batch_name: row.BATCH_NAME,
        assessment_name: row.ASSESSMENT_NAME,
        assessment_title: row.ASSESSMENT_NAME,
        module_id: row.MODULE_ID || null,
        module_name: row.MODULE_NAME || "",
        category_name: row.CATEGORY_NAME || row.MODULE_NAME || "",
        project_kit_name: row.PROJECT_KIT_NAME || `Project Kit #${row.PROJECT_KIT_ID}`,
        status: statusLabel,
        evaluated_by_name: row.EVALUATED_BY_NAME || null,

        // Legacy UPPERCASE
        ID: row.ID,
        STUDENT_ID: row.STUDENT_ID,
        STUDENT_NAME: row.STUDENT_NAME || "Student",
        STUDENT_EMAIL: row.STUDENT_EMAIL || "",
        STUDENT_MOBILE: row.STUDENT_MOBILE || "",
        BATCH_ID: row.BATCH_ID,
        BATCH_CODE: row.BATCH_CODE,
        BATCH_NAME: row.BATCH_NAME,
        ASSESSMENT_ID: row.ASSESMENT_ID,
        ASSESSMENT_NAME: row.ASSESSMENT_NAME,
        MODULE_ID: row.MODULE_ID || null,
        MODULE_NAME: row.MODULE_NAME || "",
        CATEGORY_NAME: row.CATEGORY_NAME || row.MODULE_NAME || "",
        PROJECT_KIT_ID: row.PROJECT_KIT_ID,
        PROJECT_KIT_NAME: row.PROJECT_KIT_NAME || `Project Kit #${row.PROJECT_KIT_ID}`,
        STUDENT_PROJECT_KIT_IMAGE: studentKitImage,
        PROJECT_KIT_IMAGE: studentKitImage,
        TEMPLATE_PROJECT_KIT_IMAGE: row.template_project_kit_image || null,
        TOTAL_QUESTIONS: Number(row.TOTAL_QUESTIONS) || 0,
        STUDENT_ANSWERED: Number(row.STUDENT_ANSWERED) || 0,
        UNANSWERED: Number(row.UNANSWERED) || 0,
        UNVISITED: Number(row.UNVISITED) || 0,
        STUDENT_MARK: Number(row.STUDENT_MARK) || 0,
        MARK_PERCENTAGE: Number(row.MARK_PERCENTAGE) || 0,
        CREATIVITY_MARK: creativityMark,
        PROBLEM_SOLVING_MARK: problemSolvingMark,
        PROJECT_KIT_MARK: kitMark,
        TOTAL_TUTOR_EVALUATION: kitMark,
        PROJECT_KIT_COMMENT: row.PROJECT_KIT_COMMENT || "",
        IS_PROJECT_KIT_EVALUATED: isEvaluated,
        STATUS: statusLabel,
        EVALUATED_BY: row.PROJECT_KIT_EVALUATED_BY,
        EVALUATED_BY_NAME: row.EVALUATED_BY_NAME,
        EVALUATED_DATE: row.PROJECT_KIT_REVIEWED_DATE,
        SUBMITTED_DATE: row.CREATED_ON,
        STUDENT_ANSWER: parsedAnswers,
      },
    });
  } catch (error) {
    console.error("❌ getSubmissionPreview error in projectKitEvaluationController:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch submission preview",
      error: error.message,
    });
  }
};

// =====================================================
// 4. SUBMIT / SAVE PROJECT KIT EVALUATION
// =====================================================
const submitEvaluation = async (req, res) => {
  try {
    const {
      attemptId,
      tutorId,
      creativityMark,
      problemSolvingMark,
      marks,
      comment,
    } = req.body;
    const aId = Number(attemptId || req.body.ATTEMPT_ID);
    const tId = Number(tutorId || req.body.TUTOR_ID);

    if (!Number.isInteger(aId) || aId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid attempt ID is required",
      });
    }

    if (!Number.isInteger(tId) || tId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor ID is required",
      });
    }

    // Resolve Creativity mark
    const rawCreativity =
      creativityMark !== undefined
        ? creativityMark
        : req.body.creativity ?? req.body.CREATIVITY_MARK;

    // Resolve Problem Solving mark
    const rawProblemSolving =
      problemSolvingMark !== undefined
        ? problemSolvingMark
        : req.body.problemSolving ?? req.body.PROBLEM_SOLVING_MARK;

    // Validate Creativity
    if (
      rawCreativity === undefined ||
      rawCreativity === null ||
      rawCreativity === "" ||
      isNaN(Number(rawCreativity))
    ) {
      return res.status(400).json({
        status: 0,
        message: "Please enter a valid numeric mark for Creativity.",
      });
    }
    const numCreativity = Number(rawCreativity);
    if (numCreativity < 0 || numCreativity > 50) {
      return res.status(400).json({
        status: 0,
        message: "Creativity mark must be between 0 and 50.",
      });
    }

    // Validate Problem Solving
    if (
      rawProblemSolving === undefined ||
      rawProblemSolving === null ||
      rawProblemSolving === "" ||
      isNaN(Number(rawProblemSolving))
    ) {
      return res.status(400).json({
        status: 0,
        message: "Please enter a valid numeric mark for Problem Solving.",
      });
    }
    const numProblemSolving = Number(rawProblemSolving);
    if (numProblemSolving < 0 || numProblemSolving > 50) {
      return res.status(400).json({
        status: 0,
        message: "Problem Solving mark must be between 0 and 50.",
      });
    }

    const totalMark = Number((numCreativity + numProblemSolving).toFixed(2));
    if (totalMark < 0 || totalMark > 100) {
      return res.status(400).json({
        status: 0,
        message: "Total Tutor Evaluation mark must be between 0 and 100.",
      });
    }

    const pool = getPool();

    // Verify submission exists and find batch
    const checkResult = await pool
      .request()
      .input("ATTEMPT_ID", sql.Int, aId)
      .query(`
        SELECT
          ae.ID,
          ae.STUDENT_ID,
          COALESCE(sa.BATCH_ID, aa.BATCH_ID) AS BATCH_ID,
          ISNULL(ae.IS_PROJECT_KIT_EVALUATED, 0) AS IS_PROJECT_KIT_EVALUATED
        FROM ASSESMENT_EXAM ae WITH (NOLOCK)
        LEFT JOIN STUDENT_ALLOCATIONS sa WITH (NOLOCK) ON sa.STUDENT_ID = ae.STUDENT_ID
        LEFT JOIN ASSIGNMENT_ALERTS aa WITH (NOLOCK) ON aa.ASSIGNMENT_ID = ae.ASSESMENT_ID
        WHERE ae.ID = @ATTEMPT_ID
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Assessment attempt not found",
      });
    }

    const attemptRecord = checkResult.recordset[0];
    if (Number(attemptRecord.IS_PROJECT_KIT_EVALUATED) === 1) {
      return res.status(400).json({
        status: 0,
        message: "This Project Kit submission has already been evaluated and cannot be re-evaluated.",
      });
    }

    const batchId = attemptRecord.BATCH_ID;
    if (batchId) {
      const isAuth = await isTutorOfBatch(pool, tId, batchId);
      if (!isAuth) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to evaluate submissions for this batch",
        });
      }
    }

    // Save evaluation marks (Creativity, Problem Solving, Total), reviewer, date and status
    await pool
      .request()
      .input("ATTEMPT_ID", sql.Int, aId)
      .input("CREATIVITY_MARK", sql.Decimal(5, 2), numCreativity)
      .input("PROBLEM_SOLVING_MARK", sql.Decimal(5, 2), numProblemSolving)
      .input("PROJECT_KIT_MARK", sql.Decimal(5, 2), totalMark)
      .input("PROJECT_KIT_COMMENT", sql.NVarChar(sql.MAX), (comment || "").trim())
      .input("PROJECT_KIT_EVALUATED_BY", sql.Int, tId)
      .query(`
        UPDATE ASSESMENT_EXAM
        SET
          CREATIVITY_MARK = @CREATIVITY_MARK,
          PROBLEM_SOLVING_MARK = @PROBLEM_SOLVING_MARK,
          PROJECT_KIT_MARK = @PROJECT_KIT_MARK,
          PROJECT_KIT_COMMENT = @PROJECT_KIT_COMMENT,
          PROJECT_KIT_EVALUATED_BY = @PROJECT_KIT_EVALUATED_BY,
          PROJECT_KIT_REVIEWED_DATE = GETDATE(),
          IS_PROJECT_KIT_EVALUATED = 1
        WHERE ID = @ATTEMPT_ID
          AND (IS_PROJECT_KIT_EVALUATED = 0 OR IS_PROJECT_KIT_EVALUATED IS NULL)
      `);

    return res.status(200).json({
      status: 1,
      message: "Project Kit evaluation saved successfully",
      data: {
        assessment_exam_id: aId,
        creativity_mark: numCreativity,
        problem_solving_mark: numProblemSolving,
        project_kit_mark: totalMark,
        total_tutor_evaluation: totalMark,
        project_kit_comment: (comment || "").trim(),
        is_project_kit_evaluated: true,
        // Legacy uppercase
        ATTEMPT_ID: aId,
        CREATIVITY_MARK: numCreativity,
        PROBLEM_SOLVING_MARK: numProblemSolving,
        PROJECT_KIT_MARK: totalMark,
        TOTAL_TUTOR_EVALUATION: totalMark,
        PROJECT_KIT_COMMENT: (comment || "").trim(),
        IS_PROJECT_KIT_EVALUATED: true,
      },
    });
  } catch (error) {
    console.error("❌ submitEvaluation error in projectKitEvaluationController:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to submit project kit evaluation",
      error: error.message,
    });
  }
};

module.exports = {
  getTutorBatches,
  getSubmissions,
  getSubmissionPreview,
  submitEvaluation,
};
