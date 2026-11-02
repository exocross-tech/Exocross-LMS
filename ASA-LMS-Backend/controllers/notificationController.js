const { getPool, sql } = require("../config/database");

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

// GET notifications
const getNotifications = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = getRequestUserId(req);

    // If userId provided, check role
    if (userId) {
      const userResult = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`
          SELECT USER_ID, USER_TYPE, IS_ACTIVE, CREATED_AT, UPDATED_AT
          FROM USERS WITH (NOLOCK)
          WHERE USER_ID = @USER_ID
        `);

      if (userResult.recordset.length > 0) {
        const user = userResult.recordset[0];
        const userType = String(user.USER_TYPE || "").trim().toUpperCase();
        const isActive = user.IS_ACTIVE === true || user.IS_ACTIVE === 1;
        const userCreatedAt = user.CREATED_AT || new Date();
        const userDeactivatedAt = user.UPDATED_AT || user.CREATED_AT || new Date();

        // ---------------------------------------------
        // STUDENT: Filter notifications for student
        // ---------------------------------------------
        if (userType === "STUDENT") {
          const studentResult = await pool
            .request()
            .input("STUDENT_ID", sql.Int, userId)
            .input("USER_CREATED_AT", sql.DateTime, userCreatedAt)
            .input("IS_ACTIVE", sql.Bit, isActive ? 1 : 0)
            .input("DEACTIVATED_AT", sql.DateTime, userDeactivatedAt)
            .query(`
              SELECT
                N.NOTIFICATION_ID,
                N.BATCH_ID,
                B.BATCH_CODE,
                B.BATCH_NAME,
                N.AUDIENCE,
                N.TITLE,
                CAST(N.MESSAGE AS NVARCHAR(MAX)) AS MESSAGE,
                N.CREATED_BY,
                N.SENDER_TYPE,
                N.RECIPIENT_ID,
                N.CREATED_AT,
                N.CREATED_AT AS SENT_AT,
                N.CREATED_AT AS RECEIVED_AT,
                ISNULL(U.USERNAME, 'Administration') AS SENDER_NAME
              FROM NOTIFICATIONS N WITH (NOLOCK)
              LEFT JOIN BATCHES B WITH (NOLOCK)
                ON B.ID = N.BATCH_ID
              LEFT JOIN USERS U WITH (NOLOCK)
                ON U.USER_ID = N.CREATED_BY
              WHERE 
                -- Rule 1: No previous notifications created before the student account existed
                N.CREATED_AT >= DATEADD(second, -2, @USER_CREATED_AT)
                -- Rule 2: When deactivated, no upcoming notifications created after deactivation
                AND (@IS_ACTIVE = 1 OR N.CREATED_AT <= @DEACTIVATED_AT)
                AND (
                  -- Case 1: Individual notification sent directly to this student
                  (N.RECIPIENT_ID = @STUDENT_ID)
                  OR (
                    N.RECIPIENT_ID IS NULL AND (
                      -- Case 2: General student broadcast notification
                      N.AUDIENCE IN ('STUDENT', 'BOTH')
                      -- Case 3: Batch notification
                      -- Only show if student is currently in this batch AND notification was created ON OR AFTER entering the batch
                      OR (
                        N.AUDIENCE = 'BATCH' 
                        AND EXISTS (
                          SELECT 1 FROM STUDENT_ALLOCATIONS SA WITH (NOLOCK)
                          WHERE SA.BATCH_ID = N.BATCH_ID 
                            AND SA.STUDENT_ID = @STUDENT_ID
                            AND N.CREATED_AT >= DATEADD(second, -2, SA.CREATED_AT)
                        )
                      )
                    )
                  )
                )
              ORDER BY N.CREATED_AT DESC
            `);

          return res.json({
            status: 1,
            data: studentResult.recordset,
          });
        }

        // ---------------------------------------------
        // TUTOR: Filter notifications for tutor
        // ---------------------------------------------
        if (userType === "TUTOR") {
          const tutorResult = await pool
            .request()
            .input("TUTOR_ID", sql.Int, userId)
            .input("USER_CREATED_AT", sql.DateTime, userCreatedAt)
            .input("IS_ACTIVE", sql.Bit, isActive ? 1 : 0)
            .input("DEACTIVATED_AT", sql.DateTime, userDeactivatedAt)
            .query(`
              SELECT
                N.NOTIFICATION_ID,
                N.BATCH_ID,
                B.BATCH_CODE,
                B.BATCH_NAME,
                N.AUDIENCE,
                N.TITLE,
                CAST(N.MESSAGE AS NVARCHAR(MAX)) AS MESSAGE,
                N.CREATED_BY,
                N.SENDER_TYPE,
                N.RECIPIENT_ID,
                N.CREATED_AT,
                N.CREATED_AT AS SENT_AT,
                N.CREATED_AT AS RECEIVED_AT,
                ISNULL(U.USERNAME, 'Administration') AS SENDER_NAME
              FROM NOTIFICATIONS N WITH (NOLOCK)
              LEFT JOIN BATCHES B WITH (NOLOCK)
                ON B.ID = N.BATCH_ID
              LEFT JOIN USERS U WITH (NOLOCK)
                ON U.USER_ID = N.CREATED_BY
              WHERE 
                -- Rule 1: No previous notifications created before the tutor account existed
                N.CREATED_AT >= DATEADD(second, -2, @USER_CREATED_AT)
                -- Rule 2: When deactivated, no upcoming notifications created after deactivation
                AND (@IS_ACTIVE = 1 OR N.CREATED_AT <= @DEACTIVATED_AT)
                AND (
                  -- Case 1: Individual notification sent directly to this tutor
                  (N.RECIPIENT_ID = @TUTOR_ID)
                  OR (
                    N.RECIPIENT_ID IS NULL AND (
                      -- Case 2: General tutor broadcast notification
                      N.AUDIENCE IN ('TUTOR', 'BOTH')
                      -- Case 3: Batch notification
                      -- Only show if tutor is assigned to this batch AND notification was created ON OR AFTER tutor was allocated
                      OR (
                        N.AUDIENCE = 'BATCH' 
                        AND (UPPER(LTRIM(RTRIM(ISNULL(N.SENDER_TYPE, 'ADMIN')))) = 'ADMIN')
                        AND EXISTS (
                          SELECT 1 
                          FROM TUTOR_ALLOCATIONS TA WITH (NOLOCK)
                          CROSS APPLY OPENJSON(TA.TUTOR_IDS)
                          WITH (tutorId INT '$.tutorId') T
                          WHERE TA.BATCH_ID = N.BATCH_ID 
                            AND T.tutorId = @TUTOR_ID
                            AND N.CREATED_AT >= DATEADD(second, -2, TA.CREATED_AT)
                        )
                      )
                    )
                  )
                )
              ORDER BY N.CREATED_AT DESC
            `);

          return res.json({
            status: 1,
            data: tutorResult.recordset,
          });
        }

        // ---------------------------------------------
        // ADMIN: Filter notifications for admin user
        // ---------------------------------------------
        if (userType === "ADMIN") {
          const isRootAdmin = Number(userId) === 1;
          const adminResult = await pool
            .request()
            .input("ADMIN_ID", sql.Int, userId)
            .input("IS_ROOT_ADMIN", sql.Bit, isRootAdmin ? 1 : 0)
            .input("USER_CREATED_AT", sql.DateTime, userCreatedAt)
            .input("IS_ACTIVE", sql.Bit, isActive ? 1 : 0)
            .input("DEACTIVATED_AT", sql.DateTime, userDeactivatedAt)
            .query(`
              SELECT
                N.NOTIFICATION_ID,
                N.BATCH_ID,
                B.BATCH_CODE,
                B.BATCH_NAME,
                N.AUDIENCE,
                N.TITLE,
                CAST(N.MESSAGE AS NVARCHAR(MAX)) AS MESSAGE,
                N.CREATED_BY,
                N.SENDER_TYPE,
                N.RECIPIENT_ID,
                N.CREATED_AT,
                N.CREATED_AT AS SENT_AT,
                N.CREATED_AT AS RECEIVED_AT,
                ISNULL(U.USERNAME, 'Administration') AS SENDER_NAME
              FROM NOTIFICATIONS N WITH (NOLOCK)
              LEFT JOIN BATCHES B WITH (NOLOCK)
                ON B.ID = N.BATCH_ID
              LEFT JOIN USERS U WITH (NOLOCK)
                ON U.USER_ID = N.CREATED_BY
              WHERE
                -- Rule 1: Root admin sees all; new admin sees only notifications from creation onwards
                (@IS_ROOT_ADMIN = 1 OR N.CREATED_AT >= DATEADD(second, -2, @USER_CREATED_AT))
                -- Rule 2: When deactivated, no upcoming notifications created after deactivation
                AND (@IS_ACTIVE = 1 OR N.CREATED_AT <= @DEACTIVATED_AT)
              ORDER BY N.CREATED_AT DESC
            `);

          return res.json({
            status: 1,
            data: adminResult.recordset,
          });
        }
      }
    }

    // ---------------------------------------------
    // DEFAULT / FALLBACK: Return all notifications
    // ---------------------------------------------
    const result = await pool.request().query(`
      SELECT 
        N.NOTIFICATION_ID,
        N.BATCH_ID,
        B.BATCH_CODE,
        B.BATCH_NAME,
        N.AUDIENCE,
        N.TITLE,
        CAST(N.MESSAGE AS NVARCHAR(MAX)) AS MESSAGE,
        N.CREATED_BY,
        N.SENDER_TYPE,
        N.RECIPIENT_ID,
        N.CREATED_AT,
        N.CREATED_AT AS SENT_AT,
        N.CREATED_AT AS RECEIVED_AT,
        ISNULL(U.USERNAME, 'Administration') AS SENDER_NAME
      FROM NOTIFICATIONS N WITH (NOLOCK)
      LEFT JOIN BATCHES B WITH (NOLOCK)
        ON B.ID = N.BATCH_ID
      LEFT JOIN USERS U WITH (NOLOCK)
        ON U.USER_ID = N.CREATED_BY
      ORDER BY N.CREATED_AT DESC
    `);

    res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Get notifications error:", err);

    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};


// POST notification
const createNotification = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const pool = await getPool();

    // -------------------------------------------------
    // Backend Role Authorization: Block Students & Tutors
    // Only Admin is authorized to send broadcast notifications
    // -------------------------------------------------
    if (userId) {
      const userResult = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .query(`
          SELECT USER_ID, USER_TYPE, IS_ACTIVE
          FROM USERS WITH (NOLOCK)
          WHERE USER_ID = @USER_ID
        `);

      if (userResult.recordset.length > 0) {
        const user = userResult.recordset[0];
        const userType = String(user.USER_TYPE || "").trim().toUpperCase();

        if (userType !== "ADMIN") {
          return res.status(403).json({
            status: 0,
            message: "You are not authorized to send notifications",
          });
        }
      }
    }

    const {
      audience,
      title,
      message,
      batchId,
    } = req.body;

    // Basic validation
    if (!audience || !title || !message) {
      return res.status(400).json({
        status: 0,
        message: "Audience, title and message are required",
      });
    }

    // Batch is required when audience is BATCH
    if (audience === "BATCH" && !batchId) {
      return res.status(400).json({
        status: 0,
        message: "Batch is required when target audience is Batch",
      });
    }

    // Get sender details from logged-in user
    const senderId = userId || req.user?.id || 1;
    const senderType = req.user?.userType || "ADMIN";

    await pool
      .request()
      .input("AUDIENCE", sql.NVarChar(20), audience)
      .input(
        "BATCH_ID",
        sql.Int,
        batchId ? Number(batchId) : null
      )
      .input("TITLE", sql.NVarChar(200), title.trim())
      .input("MESSAGE", sql.NVarChar(sql.MAX), message.trim())
      .input("CREATED_BY", sql.Int, senderId)
      .input("SENDER_TYPE", sql.NVarChar(30), senderType)
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

    res.json({
      status: 1,
      message: "Notification sent successfully",
    });

  } catch (err) {
    console.error("Create notification error:", err);

    res.status(500).json({
      status: 0,
      message: "Failed to send notification",
      error: err.message,
    });
  }
};

module.exports = {
  getNotifications,
  createNotification,
};