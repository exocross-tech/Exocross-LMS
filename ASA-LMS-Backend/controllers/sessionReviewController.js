const sql = require("mssql");
const { getPool } = require("../config/database");

let sessionReviewSchemaChecked = false;
const ensureSessionReviewSchema = async (pool) => {
  if (sessionReviewSchemaChecked) return;
  try {
    await pool.query(`
      IF OBJECT_ID('SESSION_REVIEWS', 'U') IS NULL
      BEGIN
        CREATE TABLE SESSION_REVIEWS (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          TUTOR_ID INT NOT NULL,
          BATCH_ID INT NOT NULL,
          STUDENT_ID INT NOT NULL,
          FEEDBACK NVARCHAR(MAX) NOT NULL,
          CREATED_DATE DATETIME2 NOT NULL DEFAULT GETDATE(),
          CONSTRAINT UQ_SESSION_REVIEWS_STUDENT_TUTOR_BATCH UNIQUE (STUDENT_ID, TUTOR_ID, BATCH_ID)
        );
      END

      IF OBJECT_ID('USERS', 'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('USERS', 'ROLL_NO') IS NULL
          ALTER TABLE USERS ADD ROLL_NO NVARCHAR(50) NULL;
      END
    `);
    sessionReviewSchemaChecked = true;
  } catch (err) {
    console.warn("ensureSessionReviewSchema non-blocking warning:", err.message);
  }
};

/* =====================================================
   CREATE SESSION REVIEW
===================================================== */

const createSessionReview = async (req, res) => {
  try {
    const {
      TUTOR_ID,
      BATCH_ID,
      STUDENT_ID,
      FEEDBACK,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!STUDENT_ID) {
      return res.status(400).json({
        status: 0,
        message: "Student ID is required.",
      });
    }

    const pool = await getPool();
    await ensureSessionReviewSchema(pool);

    /* =====================================================
       1. RESOLVE STUDENT BATCH_ID
    ===================================================== */
    let resolvedBatchId = BATCH_ID ? Number(BATCH_ID) : null;

    if (!resolvedBatchId) {
      // Find the active batch assigned to this student
      const batchRes = await pool
        .request()
        .input("STUDENT_ID", sql.Int, Number(STUDENT_ID))
        .query(`
          SELECT TOP 1
            SA.BATCH_ID
          FROM STUDENT_ALLOCATIONS SA
          INNER JOIN BATCHES B ON B.ID = SA.BATCH_ID
          WHERE SA.STUDENT_ID = @STUDENT_ID
            AND B.IS_ACTIVE = 1
          ORDER BY SA.ID DESC
        `);

      if (batchRes.recordset.length > 0) {
        resolvedBatchId = Number(batchRes.recordset[0].BATCH_ID);
      } else {
        // Fallback to any assigned batch if active filter fails
        const fallbackBatchRes = await pool
          .request()
          .input("STUDENT_ID", sql.Int, Number(STUDENT_ID))
          .query(`
            SELECT TOP 1
              BATCH_ID
            FROM STUDENT_ALLOCATIONS
            WHERE STUDENT_ID = @STUDENT_ID
            ORDER BY ID DESC
          `);

        if (fallbackBatchRes.recordset.length > 0) {
          resolvedBatchId = Number(fallbackBatchRes.recordset[0].BATCH_ID);
        }
      }
    }

    if (!resolvedBatchId) {
      return res.status(400).json({
        status: 0,
        message: "Student batch not found.",
      });
    }

    /* =====================================================
       2. RESOLVE HOST TUTOR_ID FROM BATCH
    ===================================================== */
    let resolvedTutorId = null;

    // Look up HOST tutor for the batch
    const tutorRes = await pool
      .request()
      .input("BATCH_ID", sql.Int, resolvedBatchId)
      .query(`
        SELECT TOP 1
          T.tutorId AS TUTOR_ID
        FROM TUTOR_ALLOCATIONS TA
        CROSS APPLY OPENJSON(
          CASE WHEN ISJSON(TA.TUTOR_IDS) = 1 THEN TA.TUTOR_IDS ELSE '[]' END
        )
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) T
        INNER JOIN USERS U ON U.USER_ID = T.tutorId
        WHERE TA.BATCH_ID = @BATCH_ID
          AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST')
          AND U.IS_ACTIVE = 1
        ORDER BY T.tutorId ASC
      `);

    if (tutorRes.recordset.length > 0 && tutorRes.recordset[0].TUTOR_ID) {
      resolvedTutorId = Number(tutorRes.recordset[0].TUTOR_ID);
    } else {
      // Fallback: check without U.IS_ACTIVE constraint if tutor was deactivated
      const fallbackTutorRes = await pool
        .request()
        .input("BATCH_ID", sql.Int, resolvedBatchId)
        .query(`
          SELECT TOP 1
            T.tutorId AS TUTOR_ID
          FROM TUTOR_ALLOCATIONS TA
          CROSS APPLY OPENJSON(
            CASE WHEN ISJSON(TA.TUTOR_IDS) = 1 THEN TA.TUTOR_IDS ELSE '[]' END
          )
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) T
          WHERE TA.BATCH_ID = @BATCH_ID
            AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST')
          ORDER BY T.tutorId ASC
        `);

      if (fallbackTutorRes.recordset.length > 0 && fallbackTutorRes.recordset[0].TUTOR_ID) {
        resolvedTutorId = Number(fallbackTutorRes.recordset[0].TUTOR_ID);
      }
    }

    if (!resolvedTutorId) {
      return res.status(400).json({
        status: 0,
        message: "Host tutor not found for this batch.",
      });
    }

    // Debug logging
    console.log("Create session review:", {
      studentId: Number(STUDENT_ID),
      batchId: resolvedBatchId,
      hostTutorId: resolvedTutorId,
      resolution: "Resolved via STUDENT_ALLOCATIONS -> TUTOR_ALLOCATIONS (HOST)",
    });

    // Parse and validate FEEDBACK array
    let feedbackArray = FEEDBACK;
    if (typeof feedbackArray === "string") {
      try {
        feedbackArray = JSON.parse(feedbackArray);
      } catch (e) {
        return res.status(400).json({
          status: 0,
          message: "Feedback must be a valid array.",
        });
      }
    }

    if (!Array.isArray(feedbackArray) || feedbackArray.length !== 10) {
      return res.status(400).json({
        status: 0,
        message: "Feedback must contain exactly 10 answers.",
      });
    }

    // Validate Questions 1–8: Ratings 1 to 5
    for (let i = 0; i < 8; i++) {
      const rating = Number(feedbackArray[i]);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          status: 0,
          message: `Question ${i + 1} rating must be an integer between 1 and 5.`,
        });
      }
      feedbackArray[i] = rating;
    }

    // Validate Question 9: "Yes" | "Maybe" | "No"
    const allowedQ9 = ["Yes", "Maybe", "No"];
    const q9Val = typeof feedbackArray[8] === "string" ? feedbackArray[8].trim() : "";
    if (!allowedQ9.includes(q9Val)) {
      return res.status(400).json({
        status: 0,
        message: 'Question 9 recommendation must be "Yes", "Maybe", or "No".',
      });
    }
    feedbackArray[8] = q9Val;

    // Validate Question 10: Optional text
    const q10Val = feedbackArray[9];
    if (q10Val !== null && q10Val !== undefined && typeof q10Val === "string" && q10Val.trim() !== "") {
      feedbackArray[9] = q10Val.trim();
    } else {
      feedbackArray[9] = null;
    }

    const feedbackJson = JSON.stringify(feedbackArray);

    /* =====================================================
       DUPLICATE REVIEW CHECK (By Student, Tutor & Batch)
    ===================================================== */
    const existingCheck = await pool
      .request()
      .input("STUDENT_ID", sql.Int, Number(STUDENT_ID))
      .input("BATCH_ID", sql.Int, resolvedBatchId)
      .input("TUTOR_ID", sql.Int, resolvedTutorId)
      .query(`
        SELECT TOP 1 ID 
        FROM SESSION_REVIEWS 
        WHERE STUDENT_ID = @STUDENT_ID 
          AND BATCH_ID = @BATCH_ID
          AND TUTOR_ID = @TUTOR_ID
      `);

    if (existingCheck.recordset.length > 0) {
      return res.status(409).json({
        status: 0,
        message: "You have already submitted a review for this program.",
      });
    }

    /* =====================================================
       INSERT REVIEW
    ===================================================== */

    const result = await pool
      .request()
      .input("TUTOR_ID", sql.Int, resolvedTutorId)
      .input("BATCH_ID", sql.Int, resolvedBatchId)
      .input("STUDENT_ID", sql.Int, Number(STUDENT_ID))
      .input("FEEDBACK", sql.NVarChar(sql.MAX), feedbackJson)
      .query(`
        INSERT INTO SESSION_REVIEWS (
          TUTOR_ID,
          BATCH_ID,
          STUDENT_ID,
          FEEDBACK,
          CREATED_DATE
        )
        OUTPUT INSERTED.ID
        VALUES (
          @TUTOR_ID,
          @BATCH_ID,
          @STUDENT_ID,
          @FEEDBACK,
          GETDATE()
        )
      `);

    const reviewId = result.recordset[0].ID;

    /* =====================================================
       SUCCESS
    ===================================================== */

    return res.status(201).json({
      status: 1,
      message: "Review submitted successfully.",
      data: {
        ID: reviewId,
        FEEDBACK: feedbackArray,
      },
    });

  } catch (error) {

    console.error(
      "Create session review error:",
      error
    );

    /* =====================================================
       DUPLICATE REVIEW ERROR CATCH
    ===================================================== */

    if (
      error.number === 2627 ||
      error.number === 2601 ||
      (error.message && error.message.includes("UQ_SESSION_REVIEWS"))
    ) {
      return res.status(409).json({
        status: 0,
        message:
          "You have already submitted a review for this program.",
      });
    }

    /* =====================================================
       SERVER ERROR
    ===================================================== */

    return res.status(500).json({
      status: 0,
      message: error.message || "Failed to submit review.",
      error: error.message,
    });
  }
};

/* =====================================================
   GET SESSION REVIEWS BY STUDENT
===================================================== */

const getSessionReviewsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!studentId) {
      return res.status(400).json({
        status: 0,
        message: "Student ID is required.",
      });
    }

    /* =====================================================
       GET REVIEWS
    ===================================================== */

    const query = `
      SELECT
        ID,
        TUTOR_ID,
        BATCH_ID,
        STUDENT_ID,
        FEEDBACK,
        CREATED_DATE
      FROM SESSION_REVIEWS
      WHERE STUDENT_ID = @STUDENT_ID
      ORDER BY CREATED_DATE DESC
    `;

    const pool = await getPool();
    await ensureSessionReviewSchema(pool);

    const result = await pool
      .request()
      .input("STUDENT_ID", sql.Int, Number(studentId))
      .query(query);

    const formattedReviews = result.recordset.map((row) => {
      let parsedFeedback = [];
      if (row.FEEDBACK) {
        try {
          parsedFeedback = JSON.parse(row.FEEDBACK);
        } catch (e) {
          parsedFeedback = [];
        }
      }
      return {
        ...row,
        FEEDBACK: parsedFeedback,
      };
    });

    return res.status(200).json({
      status: 1,
      message: "Session reviews fetched successfully.",
      data: formattedReviews,
    });
  } catch (error) {
    console.error("Get session reviews error:", error);

    return res.status(500).json({
      status: 0,
      message: "Failed to fetch session reviews.",
      error: error.message,
    });
  }
};

/* =====================================================
   HELPER: PARSE REVIEW FEEDBACK
===================================================== */

const parseReviewFeedback = (rawFeedback) => {
  let feedbackArr = [];
  if (typeof rawFeedback === "string") {
    try {
      feedbackArr = JSON.parse(rawFeedback);
    } catch (_) {
      feedbackArr = [];
    }
  } else if (Array.isArray(rawFeedback)) {
    feedbackArr = rawFeedback;
  }

  // 1. Calculate overall rating from Questions 1–8
  const validRatings = [];
  for (let i = 0; i < Math.min(8, feedbackArr.length); i++) {
    const val = Number(feedbackArr[i]);
    if (Number.isFinite(val) && val >= 1 && val <= 5) {
      validRatings.push(val);
    }
  }

  let overallRating = null;
  let roundedStar = null;
  if (validRatings.length > 0) {
    const sum = validRatings.reduce((acc, curr) => acc + curr, 0);
    // Round to 1 decimal place (e.g. 4.8)
    overallRating = Math.round((sum / validRatings.length) * 10) / 10;
    // Nearest integer star bucket (1 to 5) for star filter matching
    roundedStar = Math.round(overallRating);
  }

  // 2. Extract Recommendation (Question 9)
  const recommendation =
    feedbackArr.length > 8 && typeof feedbackArr[8] === "string"
      ? feedbackArr[8].trim()
      : null;

  // 3. Extract Written Comment (Question 10)
  let comment = "";
  if (feedbackArr.length > 9 && feedbackArr[9] !== null && feedbackArr[9] !== undefined) {
    comment = String(feedbackArr[9]).trim();
  } else {
    // Fallback: check if any string exists after the numeric questions
    for (let i = 8; i < feedbackArr.length; i++) {
      if (typeof feedbackArr[i] === "string" && !["Yes", "Maybe", "No"].includes(feedbackArr[i].trim())) {
        comment = feedbackArr[i].trim();
        break;
      }
    }
  }

  return {
    rawFeedback: feedbackArr,
    validRatings,
    overallRating,
    roundedStar,
    recommendation,
    comment,
  };
};

/* =====================================================
   GET BATCHES FOR STUDENTS REVIEWS (ADMIN / TUTOR)
===================================================== */

const getSessionReviewBatches = async (req, res) => {
  try {
    const rawUserId =
      req.query.userId ||
      req.query.USER_ID ||
      req.headers["x-user-id"] ||
      req.user?.USER_ID ||
      req.user?.id;
    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid user ID is required.",
      });
    }

    const pool = await getPool();
    await ensureSessionReviewSchema(pool);

    // Verify user role & status
    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`SELECT USER_ID, USER_TYPE, IS_ACTIVE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found.",
      });
    }

    const caller = userCheck.recordset[0];
    if (caller.IS_ACTIVE !== true && caller.IS_ACTIVE !== 1) {
      return res.status(403).json({
        status: 0,
        message: "Your account is inactive.",
      });
    }

    const userType = String(caller.USER_TYPE || "").toUpperCase().trim();
    const isAdmin = userType === "ADMIN";
    const isTutor = userType === "TUTOR";

    if (!isAdmin && !isTutor) {
      return res.status(403).json({
        status: 0,
        message: "Access denied. Only Admins and Tutors can access batches.",
      });
    }

    let batches = [];
    if (isAdmin) {
      // Admin sees all active batches
      const allBatches = await pool.query(`
        SELECT
          b.ID AS BATCH_ID,
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.IS_ACTIVE,
          'ADMIN' AS TUTOR_ROLE
        FROM BATCHES b WITH (NOLOCK)
        WHERE ISNULL(b.IS_ACTIVE, 1) = 1
        ORDER BY b.ID DESC
      `);
      batches = allBatches.recordset;
    } else {
      // Tutor sees only batches assigned as HOST or SUPPORT
      const tutorBatches = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`
          SELECT DISTINCT
            b.ID AS BATCH_ID,
            b.ID,
            b.BATCH_CODE,
            b.BATCH_NAME,
            b.IS_ACTIVE,
            CASE 
              WHEN TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST' THEN 'HOST'
              ELSE 'SUPPORT'
            END AS TUTOR_ROLE
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
            AND (TRY_CONVERT(INT, t.role) IN (1, 2) OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT'))
          ORDER BY b.ID DESC
        `);
      batches = tutorBatches.recordset;
    }

    return res.status(200).json({
      status: 1,
      message: "Batches fetched successfully.",
      data: batches,
    });
  } catch (error) {
    console.error("❌ getSessionReviewBatches error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch batches.",
      error: error.message,
    });
  }
};

/* =====================================================
   GET STUDENTS REVIEWS (FOR ADMIN & TUTOR)
===================================================== */

const getStudentsReviews = async (req, res) => {
  try {
    const rawUserId =
      req.query.userId ||
      req.query.USER_ID ||
      req.headers["x-user-id"] ||
      req.user?.USER_ID ||
      req.user?.id;
    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid user ID is required.",
      });
    }

    const pool = await getPool();
    await ensureSessionReviewSchema(pool);

    // Verify user role & status
    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`SELECT USER_ID, USERNAME, USER_TYPE, IS_ACTIVE FROM USERS WITH (NOLOCK) WHERE USER_ID = @USER_ID`);

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found.",
      });
    }

    const caller = userCheck.recordset[0];
    if (caller.IS_ACTIVE !== true && caller.IS_ACTIVE !== 1) {
      return res.status(403).json({
        status: 0,
        message: "Your account is inactive.",
      });
    }

    const userType = String(caller.USER_TYPE || "").toUpperCase().trim();
    const isAdmin = userType === "ADMIN";
    const isTutor = userType === "TUTOR";

    if (!isAdmin && !isTutor) {
      return res.status(403).json({
        status: 0,
        message: "Access denied. Only Admins and Tutors can access student reviews.",
      });
    }

    const { batchId, starRating } = req.query;

    let authorizedBatchIds = [];

    if (isAdmin) {
      // Admin is authorized across all active batches
      const allBatches = await pool.query(`SELECT ID FROM BATCHES WITH (NOLOCK) WHERE ISNULL(IS_ACTIVE, 1) = 1`);
      authorizedBatchIds = allBatches.recordset.map((b) => Number(b.ID));
    } else {
      // Tutor is authorized only for assigned batches (HOST or SUPPORT)
      const tutorBatches = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`
          SELECT DISTINCT b.ID
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
            AND (TRY_CONVERT(INT, t.role) IN (1, 2) OR UPPER(LTRIM(RTRIM(t.role))) IN ('HOST', 'SUPPORT'))
        `);

      authorizedBatchIds = tutorBatches.recordset.map((b) => Number(b.ID));
    }

    // If tutor has no assigned batches, return empty list immediately
    if (!isAdmin && authorizedBatchIds.length === 0) {
      return res.status(200).json({
        status: 1,
        message: "No assigned batches found for this tutor.",
        data: [],
      });
    }

    // Determine target batch IDs
    let targetBatchIds = authorizedBatchIds;
    if (batchId && batchId !== "ALL" && batchId !== "") {
      const requestedBatchId = Number(batchId);
      if (!Number.isInteger(requestedBatchId)) {
        return res.status(400).json({
          status: 0,
          message: "Invalid batch ID format.",
        });
      }

      // Security validation: verify that the requested batch is authorized for caller
      if (!isAdmin && !authorizedBatchIds.includes(requestedBatchId)) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to view reviews for this batch.",
        });
      }

      targetBatchIds = [requestedBatchId];
    }

    // Build SQL query for session reviews
    const reviewRequest = pool.request();
    let query = `
      SELECT
        sr.ID,
        sr.TUTOR_ID,
        sr.BATCH_ID,
        sr.STUDENT_ID,
        sr.FEEDBACK,
        sr.CREATED_DATE,
        COALESCE(u.USERNAME, 'Student') AS STUDENT_NAME,
        ISNULL(u.ROLL_NO, '') AS ROLL_NO,
        ISNULL(u.EMAIL_ID, '') AS STUDENT_EMAIL,
        ISNULL(b.BATCH_CODE, CONCAT('Batch-', sr.BATCH_ID)) AS BATCH_CODE,
        ISNULL(b.BATCH_NAME, CONCAT('Batch-', sr.BATCH_ID)) AS BATCH_NAME,
        COALESCE(tu.USERNAME, 'Tutor') AS TUTOR_NAME
      FROM SESSION_REVIEWS sr WITH (NOLOCK)
      LEFT JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sr.STUDENT_ID
      LEFT JOIN BATCHES b WITH (NOLOCK) ON b.ID = sr.BATCH_ID
      LEFT JOIN USERS tu WITH (NOLOCK) ON tu.USER_ID = sr.TUTOR_ID
    `;

    if (targetBatchIds.length === 1) {
      reviewRequest.input("TARGET_BATCH_ID", sql.Int, targetBatchIds[0]);
      query += ` WHERE sr.BATCH_ID = @TARGET_BATCH_ID `;
    } else if (targetBatchIds.length > 0) {
      const batchParamNames = targetBatchIds.map((id, index) => {
        const paramName = `BATCH_PARAM_${index}`;
        reviewRequest.input(paramName, sql.Int, id);
        return `@${paramName}`;
      });
      query += ` WHERE sr.BATCH_ID IN (${batchParamNames.join(", ")}) `;
    } else {
      return res.status(200).json({
        status: 1,
        message: "No reviews found.",
        data: [],
      });
    }

    query += ` ORDER BY sr.CREATED_DATE DESC, sr.ID DESC `;

    const result = await reviewRequest.query(query);

    // Parse each record and calculate overall rating
    let parsedReviews = result.recordset.map((row) => {
      const parsed = parseReviewFeedback(row.FEEDBACK);
      return {
        ID: row.ID,
        TUTOR_ID: row.TUTOR_ID,
        TUTOR_NAME: row.TUTOR_NAME || "Tutor",
        BATCH_ID: row.BATCH_ID,
        BATCH_CODE: row.BATCH_CODE || `Batch-${row.BATCH_ID}`,
        BATCH_NAME: row.BATCH_NAME || `Batch-${row.BATCH_ID}`,
        STUDENT_ID: row.STUDENT_ID,
        STUDENT_NAME: row.STUDENT_NAME,
        ROLL_NO: row.ROLL_NO || null,
        STUDENT_EMAIL: row.STUDENT_EMAIL || null,
        CREATED_DATE: row.CREATED_DATE,
        FEEDBACK_ARRAY: parsed.rawFeedback,
        VALID_RATINGS: parsed.validRatings,
        OVERALL_RATING: parsed.overallRating,
        ROUNDED_STAR: parsed.roundedStar,
        RECOMMENDATION: parsed.recommendation,
        COMMENTS: parsed.comment,
      };
    });

    // Apply star rating filter if selected (1 to 5)
    if (starRating && starRating !== "ALL" && starRating !== "") {
      const targetStar = Number(starRating);
      if (Number.isInteger(targetStar) && targetStar >= 1 && targetStar <= 5) {
        parsedReviews = parsedReviews.filter(
          (r) => r.ROUNDED_STAR === targetStar
        );
      }
    }

    return res.status(200).json({
      status: 1,
      message: "Student reviews fetched successfully.",
      data: parsedReviews,
      totalCount: parsedReviews.length,
    });
  } catch (error) {
    console.error("❌ getStudentsReviews error:", error);
    return res.status(500).json({
      status: 0,
      message: "Failed to fetch student reviews.",
      error: error.message,
    });
  }
};

module.exports = {
  createSessionReview,
  getSessionReviewsByStudent,
  getSessionReviewBatches,
  getStudentsReviews,
  parseReviewFeedback,
};