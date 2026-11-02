const sql = require("mssql");
const { getPool } = require("../config/database");

// Helper to extract userId from request
const getRequestUserId = (req) => {
  const rawUserId =
    req?.body?.userId ||
    req?.body?.USER_ID ||
    req?.body?.created_by ||
    req?.body?.CREATED_BY ||
    req?.query?.userId ||
    req?.query?.USER_ID ||
    req?.query?.user_id ||
    req?.headers?.["x-user-id"] ||
    req?.user?.USER_ID ||
    req?.user?.userId ||
    req?.user?.id;

  const parsed = Number(rawUserId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// =====================================================
// GET BATCHES FOR BATCH ANNOUNCEMENTS
//
// ADMIN  -> All active batches
// TUTOR  -> Only batches allocated to that tutor
// =====================================================
const getBatches = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({
        status: 0,
        message: "Unauthorized user: User ID is required",
      });
    }

    // -------------------------------------------------
    // Get logged-in user's type and active status
    // -------------------------------------------------
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT
          USER_ID,
          USER_TYPE,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({
        status: 0,
        message: "User not found",
      });
    }

    const user = userResult.recordset[0];

    // Inactive user
    if (user.IS_ACTIVE !== true && user.IS_ACTIVE !== 1) {
      return res.status(403).json({
        status: 0,
        message: "Your account is inactive",
      });
    }

    // =================================================
    // ADMIN
    // =================================================
    if (String(user.USER_TYPE).toUpperCase() === "ADMIN") {
      const result = await pool.request().query(`
        SELECT
          ID,
          BATCH_CODE,
          BATCH_NAME
        FROM BATCHES
        WHERE IS_ACTIVE = 1
        ORDER BY BATCH_NAME
      `);

      return res.json({
        status: 1,
        message: "Batches fetched successfully",
        data: result.recordset,
      });
    }

    // =================================================
    // TUTOR
    // Only allocated batches
    // =================================================
    if (String(user.USER_TYPE).toUpperCase() === "TUTOR") {
      const result = await pool
        .request()
        .input("TUTOR_ID", sql.Int, userId)
        .query(`
          SELECT DISTINCT
            B.ID,
            B.BATCH_CODE,
            B.BATCH_NAME
          FROM TUTOR_ALLOCATIONS TA
          INNER JOIN BATCHES B
            ON B.ID = TA.BATCH_ID
          CROSS APPLY OPENJSON(TA.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId'
          ) T
          WHERE T.tutorId = @TUTOR_ID
            AND B.IS_ACTIVE = 1
          ORDER BY B.BATCH_NAME
        `);

      return res.json({
        status: 1,
        message: "Batches fetched successfully",
        data: result.recordset,
      });
    }

    // =================================================
    // STUDENT / OTHER
    // =================================================
    return res.status(403).json({
      status: 0,
      message: "You are not authorized to view batches",
    });

  } catch (err) {
    console.error("Get announcement batches error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};


// =====================================================
// CREATE ANNOUNCEMENT
//
// ADMIN  -> Can send to any active batch
// TUTOR  -> Can send ONLY to allocated batch
// =====================================================
const createAnnouncement = async (req, res) => {
  try {
    const rawBatchId = req.body?.batchId || req.body?.BATCH_ID || req.body?.batch_id;
    const batchId = Number(rawBatchId);
    const title = (req.body?.title || req.body?.TITLE || "").trim();
    const message = (req.body?.message || req.body?.MESSAGE || "").trim();
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({
        status: 0,
        message: "Unauthorized user: User ID is required",
      });
    }

    // -------------------------------------------------
    // Validate request
    // -------------------------------------------------
    if (
      !batchId ||
      !Number.isInteger(batchId) ||
      batchId <= 0 ||
      !title ||
      !message
    ) {
      return res.status(400).json({
        status: 0,
        message: "Batch, Title and Message are all required",
      });
    }

    const pool = await getPool();

    // -------------------------------------------------
    // Get logged-in user
    // -------------------------------------------------
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT
          USER_ID,
          USER_TYPE,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({
        status: 0,
        message: "User not found",
      });
    }

    const user = userResult.recordset[0];

    // -------------------------------------------------
    // Check user active
    // -------------------------------------------------
    if (user.IS_ACTIVE !== true && user.IS_ACTIVE !== 1) {
      return res.status(403).json({
        status: 0,
        message: "Your account is inactive",
      });
    }

    // -------------------------------------------------
    // Check batch exists and active
    // -------------------------------------------------
    const batchResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          ID,
          BATCH_CODE,
          BATCH_NAME
        FROM BATCHES
        WHERE ID = @BATCH_ID
          AND IS_ACTIVE = 1
      `);

    if (batchResult.recordset.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Selected batch is inactive or does not exist",
      });
    }

    const userType = String(user.USER_TYPE).toUpperCase();

    // =================================================
    // TUTOR AUTHORIZATION
    // =================================================
    if (userType === "TUTOR") {
      const allocationResult = await pool
        .request()
        .input("TUTOR_ID", sql.Int, userId)
        .input("BATCH_ID", sql.Int, batchId)
        .query(`
          SELECT TOP 1
            TA.ID
          FROM TUTOR_ALLOCATIONS TA
          INNER JOIN BATCHES B
            ON B.ID = TA.BATCH_ID
          CROSS APPLY OPENJSON(TA.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId'
          ) T
          WHERE T.tutorId = @TUTOR_ID
            AND TA.BATCH_ID = @BATCH_ID
            AND B.IS_ACTIVE = 1
        `);

      // Tutor is NOT allocated to this batch
      if (allocationResult.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You are not authorized to send announcements to this batch",
        });
      }
    } else if (userType !== "ADMIN") {
      // Non-Admin and Non-Tutor are forbidden
      return res.status(403).json({
        status: 0,
        message: "You are not authorized to send announcements",
      });
    }

    // -------------------------------------------------
    // Duplicate prevention: check if identical announcement was sent within last 10 seconds
    // -------------------------------------------------
    const dupCheck = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("TITLE", sql.NVarChar(200), title)
      .input("CREATED_BY", sql.Int, userId)
      .query(`
        SELECT TOP 1 ID 
        FROM BATCH_ANNOUNCEMENTS WITH (NOLOCK)
        WHERE BATCH_ID = @BATCH_ID 
          AND TITLE = @TITLE 
          AND CREATED_BY = @CREATED_BY
          AND DATEDIFF(SECOND, CREATED_AT, GETDATE()) < 10
      `);

    if (dupCheck.recordset.length > 0) {
      return res.status(200).json({
        status: 1,
        message: "Announcement already sent",
      });
    }

    // -------------------------------------------------
    // Insert announcement into BATCH_ANNOUNCEMENTS
    // -------------------------------------------------
    await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("TITLE", sql.NVarChar(200), title)
      .input("MESSAGE", sql.NVarChar(sql.MAX), message)
      .input("CREATED_BY", sql.Int, userId)
      .query(`
        INSERT INTO BATCH_ANNOUNCEMENTS
        (
          BATCH_ID,
          TITLE,
          MESSAGE,
          CREATED_BY,
          CREATED_AT
        )
        VALUES
        (
          @BATCH_ID,
          @TITLE,
          @MESSAGE,
          @CREATED_BY,
          GETDATE()
        )
      `);

    // -------------------------------------------------
    // Also insert into NOTIFICATIONS table so that students
    // (and tutors if sent by ADMIN) receive it in their notifications page
    // -------------------------------------------------
    await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .input("AUDIENCE", sql.NVarChar(20), "BATCH")
      .input("TITLE", sql.NVarChar(200), title)
      .input("MESSAGE", sql.NVarChar(sql.MAX), message)
      .input("CREATED_BY", sql.Int, userId)
      .input("SENDER_TYPE", sql.NVarChar(30), userType)
      .query(`
        INSERT INTO NOTIFICATIONS
        (
          BATCH_ID,
          AUDIENCE,
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
          @TITLE,
          @MESSAGE,
          @CREATED_BY,
          @SENDER_TYPE,
          GETDATE()
        )
      `);

    return res.json({
      status: 1,
      message: "Announcement sent successfully",
    });

  } catch (err) {
    console.error("Create announcement error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};


// =====================================================
// GET RECENT ANNOUNCEMENTS
//
// ADMIN  -> All announcements
// TUTOR  -> Only announcements for allocated batches
// STUDENT-> Only announcements for student's batch
// =====================================================
const getAnnouncements = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({
        status: 0,
        message: "Unauthorized user: User ID is required",
      });
    }

    // -------------------------------------------------
    // Get user type
    // -------------------------------------------------
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT
          USER_TYPE,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({
        status: 0,
        message: "User not found",
      });
    }

    const user = userResult.recordset[0];

    if (user.IS_ACTIVE !== true && user.IS_ACTIVE !== 1) {
      return res.status(403).json({
        status: 0,
        message: "Your account is inactive",
      });
    }

    const userType = String(user.USER_TYPE).toUpperCase();

    // =================================================
    // ADMIN
    // =================================================
    if (userType === "ADMIN") {
      const result = await pool.request().query(`
        SELECT TOP 50
          BA.ID,
          BA.BATCH_ID,
          B.BATCH_CODE,
          B.BATCH_NAME,
          BA.TITLE,
          BA.MESSAGE,
          BA.CREATED_AT,
          BA.CREATED_BY,
          U.USERNAME AS CREATED_BY_NAME
        FROM BATCH_ANNOUNCEMENTS BA
        INNER JOIN BATCHES B
          ON BA.BATCH_ID = B.ID
        LEFT JOIN USERS U
          ON BA.CREATED_BY = U.USER_ID
        WHERE B.IS_ACTIVE = 1
        ORDER BY BA.CREATED_AT DESC
      `);

      return res.json({
        status: 1,
        message: "Announcements fetched successfully",
        data: result.recordset,
      });
    }

    // =================================================
    // TUTOR
    // Only announcements from allocated batches
    // =================================================
    if (userType === "TUTOR") {
      const result = await pool
        .request()
        .input("TUTOR_ID", sql.Int, userId)
        .query(`
          SELECT DISTINCT TOP 50
            BA.ID,
            BA.BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME,
            BA.TITLE,
            BA.MESSAGE,
            BA.CREATED_AT,
            BA.CREATED_BY,
            U.USERNAME AS CREATED_BY_NAME
          FROM BATCH_ANNOUNCEMENTS BA
          INNER JOIN BATCHES B
            ON BA.BATCH_ID = B.ID
          INNER JOIN TUTOR_ALLOCATIONS TA
            ON TA.BATCH_ID = B.ID
          CROSS APPLY OPENJSON(TA.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId'
          ) T
          LEFT JOIN USERS U
            ON BA.CREATED_BY = U.USER_ID
          WHERE T.tutorId = @TUTOR_ID
            AND B.IS_ACTIVE = 1
          ORDER BY BA.CREATED_AT DESC
        `);

      return res.json({
        status: 1,
        message: "Announcements fetched successfully",
        data: result.recordset,
      });
    }

    // =================================================
    // STUDENT
    // =================================================
    if (userType === "STUDENT") {
      const result = await pool
        .request()
        .input("STUDENT_ID", sql.Int, userId)
        .query(`
          SELECT TOP 50
            BA.ID,
            BA.BATCH_ID,
            B.BATCH_CODE,
            B.BATCH_NAME,
            BA.TITLE,
            BA.MESSAGE,
            BA.CREATED_AT,
            BA.CREATED_BY,
            U.USERNAME AS CREATED_BY_NAME
          FROM BATCH_ANNOUNCEMENTS BA
          INNER JOIN BATCHES B
            ON BA.BATCH_ID = B.ID
          INNER JOIN STUDENT_ALLOCATIONS SA
            ON SA.BATCH_ID = B.ID
          LEFT JOIN USERS U
            ON BA.CREATED_BY = U.USER_ID
          WHERE SA.STUDENT_ID = @STUDENT_ID
            AND B.IS_ACTIVE = 1
          ORDER BY BA.CREATED_AT DESC
        `);

      return res.json({
        status: 1,
        message: "Announcements fetched successfully",
        data: result.recordset,
      });
    }

    return res.status(403).json({
      status: 0,
      message: "You are not authorized to view announcements",
    });

  } catch (err) {
    console.error("Get announcements error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};


module.exports = {
  getBatches,
  createAnnouncement,
  getAnnouncements,
};