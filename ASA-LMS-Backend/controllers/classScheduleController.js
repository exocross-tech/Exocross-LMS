const sql = require("mssql");
const { getPool } = require("../config/database");
const { createGoogleMeet } = require("../utils/googleMeet");

// Create class
const createClassSchedule = async (req, res) => {
  try {
    const { batchId, createdBy } = req.body;
    let slotsList = Array.isArray(req.body.slots) ? req.body.slots : [];

    if (slotsList.length === 0) {
      const { topic, classDate, classTime } = req.body;
      if (topic && classDate && classTime) {
        slotsList.push({ topic, classDate, classTime });
      }
    }

    if (!batchId || slotsList.length === 0) {
      return res.status(400).json({
        status: 0,
        message:
          "Batch ID and at least one slot with topic, class date and class time are required",
      });
    }

    // =====================================================
    // Validate batch ID
    // =====================================================

    const parsedBatchId = Number(batchId);

    if (!Number.isInteger(parsedBatchId) || parsedBatchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid batch ID",
      });
    }

    const pool = getPool();

    // =====================================================
    // Check batch
    // =====================================================

    const batchResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, parsedBatchId).query(`
        SELECT
            ID,
            BATCH_CODE,
            BATCH_NAME,
            START_DATE,
            END_DATE,
            IS_ACTIVE
        FROM BATCHES
        WHERE ID = @BATCH_ID
      `);

    if (batchResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Batch not found",
      });
    }

    const batch = batchResult.recordset[0];

    // =====================================================
    // Check active batch
    // =====================================================

    if (Number(batch.IS_ACTIVE) !== 1) {
      return res.status(400).json({
        status: 0,
        message: "Cannot schedule class for inactive batch",
      });
    }

    const startDate = new Date(batch.START_DATE);
    const endDate = new Date(batch.END_DATE);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    const createdClasses = [];

    for (let i = 0; i < slotsList.length; i++) {
      const slot = slotsList[i];
      const { topic, classDate, classTime } = slot;

      if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Topic is required`,
        });
      }

      if (!dateRegex.test(classDate)) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Invalid class date. Expected format YYYY-MM-DD`,
        });
      }

      const requestedDate = new Date(`${classDate}T00:00:00`);
      if (isNaN(requestedDate.getTime())) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Invalid class date`,
        });
      }

      requestedDate.setHours(0, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      if (requestedDate < tomorrow) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Class date must be from tomorrow onwards`,
        });
      }

      if (requestedDate < startDate) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Class date cannot be before batch start date (${formatDate(batch.START_DATE)})`,
        });
      }

      if (requestedDate > endDate) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Class date cannot be after batch end date (${formatDate(batch.END_DATE)})`,
        });
      }

      if (!timeRegex.test(classTime)) {
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: Invalid class time. Expected format HH:mm:ss`,
        });
      }



      // Duplicate check
      const duplicateResult = await pool
        .request()
        .input("BATCH_ID", sql.Int, parsedBatchId)
        .input("CLASS_DATE", sql.Date, classDate)
        .input("CLASS_TIME", sql.VarChar(8), classTime).query(`
          SELECT TOP 1 ID, TOPIC, BATCH_ID, CLASS_DATE, CLASS_TIME, MEET_LINK
          FROM CLASS_SCHEDULES
          WHERE BATCH_ID = @BATCH_ID
            AND CLASS_DATE = @CLASS_DATE
            AND CLASS_TIME = @CLASS_TIME
        `);

      if (duplicateResult.recordset.length > 0) {
        const existingClass = duplicateResult.recordset[0];
        return res.status(400).json({
          status: 0,
          message: `Slot #${i + 1}: A class is already scheduled for this batch at the selected date and time`,
          data: {
            ID: existingClass.ID,
            TOPIC: existingClass.TOPIC,
            CLASS_DATE: formatDate(existingClass.CLASS_DATE),
            CLASS_TIME: formatSqlTime(existingClass.CLASS_TIME),
            MEET_LINK: existingClass.MEET_LINK,
          },
        });
      }

      // Create Google Meet
      let meeting;
      try {
        meeting = await createGoogleMeet();
        console.log("GOOGLE MEET RESPONSE:", JSON.stringify(meeting, null, 2));
      } catch (meetError) {
        console.error(
          "Google Meet creation error:",
          meetError.response?.data || meetError,
        );
        return res.status(500).json({
          status: 0,
          message: `Slot #${i + 1}: Failed to create Google Meet`,
          error: meetError.response?.data || meetError.message,
        });
      }

      if (
        !meeting ||
        !meeting.meetId ||
        !meeting.meetCode ||
        !meeting.meetLink
      ) {
        return res.status(500).json({
          status: 0,
          message: `Slot #${i + 1}: Google Meet could not be created`,
        });
      }

      // Insert class schedule
      const result = await pool
        .request()
        .input("TOPIC", sql.NVarChar(200), topic.trim())
        .input("BATCH_ID", sql.Int, parsedBatchId)
        .input("CLASS_DATE", sql.Date, classDate)
        .input("CLASS_TIME", sql.VarChar(8), classTime)
        .input("MEET_ID", sql.NVarChar(500), meeting.meetId)
        .input("MEET_CODE", sql.NVarChar(550), meeting.meetCode)
        .input("MEET_LINK", sql.NVarChar(2500), meeting.meetLink)
        .input("CREATED_BY", sql.NVarChar(50), createdBy || "ADMIN").query(`
          INSERT INTO CLASS_SCHEDULES
          (TOPIC, BATCH_ID, CLASS_DATE, CLASS_TIME, MEET_ID, MEET_CODE, MEET_LINK, CREATED_BY, CREATED_AT)
          OUTPUT INSERTED.ID, INSERTED.CLASS_DATE, INSERTED.CLASS_TIME
          VALUES (@TOPIC, @BATCH_ID, @CLASS_DATE, @CLASS_TIME, @MEET_ID, @MEET_CODE, @MEET_LINK, @CREATED_BY, GETDATE())
        `);

      const insertedClass = result.recordset[0];

      createdClasses.push({
        ID: insertedClass.ID,
        TOPIC: topic.trim(),
        BATCH_ID: batch.ID,
        BATCH_CODE: batch.BATCH_CODE,
        BATCH_NAME: batch.BATCH_NAME,
        CLASS_DATE: formatDate(insertedClass.CLASS_DATE),
        CLASS_TIME: formatSqlTime(insertedClass.CLASS_TIME),
        MEET_ID: meeting.meetId,
        MEET_CODE: meeting.meetCode,
        MEET_LINK: meeting.meetLink,
      });
    }

    return res.json({
      status: 1,
      message:
        slotsList.length > 1
          ? "Classes scheduled successfully"
          : "Class scheduled successfully",
      data: createdClasses,
    });
  } catch (err) {
    console.error("createClassSchedule error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
      error: err.response?.data || null,
    });
  }
};

// =====================================================
// Helper: Format SQL Date
// =====================================================

const formatDate = (date) => {
  if (!date) {
    return null;
  }

  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return null;
  }

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// =====================================================
// Helper: Format SQL Time
// =====================================================

const formatSqlTime = (time) => {
  if (!time) {
    return null;
  }

  // If mssql returns a Date
  if (time instanceof Date) {
    return [
      String(time.getHours()).padStart(2, "0"),
      String(time.getMinutes()).padStart(2, "0"),
      String(time.getSeconds()).padStart(2, "0"),
    ].join(":");
  }

  // If it is already a string
  if (typeof time === "string") {
    return time.substring(0, 8);
  }

  return String(time);
};

// =====================================================
// GET UPCOMING CLASSES - HOST ONLY
// Used by Class Scheduling page
// ==========================================================================================================

const getUpcomingClasses = async (req, res) => {
  try {
    const rawUserId =
      req.query.userId ||
      req.query.USER_ID ||
      req.query.user_id;

    const rawBatchId =
      req.query.batchId ||
      req.query.BATCH_ID ||
      req.query.batch_id;

    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor user ID is required",
      });
    }

    const pool = getPool();

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const userType = user ? String(user.USER_TYPE || "").toUpperCase() : "";
    const isAdmin = userType === "ADMIN";
    const isStudent = userType === "STUDENT";

    const request = pool
      .request()
      .input("USER_ID", sql.Int, userId);

    let query = `
      SELECT
        CS.ID,
        CS.TOPIC,
        FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
        FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
        FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
        DATENAME(dw, CS.CLASS_DATE) AS DAY_NAME,
        CONVERT(VARCHAR(8), CS.CLASS_TIME, 108) AS CLASS_TIME,
        CS.MEET_ID,
        CS.MEET_CODE,
        CS.MEET_LINK,
        CS.IS_ACTIVE,
        CS.CREATED_BY,
        CS.CREATED_AT,
        CS.BATCH_ID,

        B.BATCH_CODE,
        B.BATCH_NAME,

        (
          SELECT TOP 1 U.USERNAME
          FROM TUTOR_ALLOCATIONS TA
          CROSS APPLY OPENJSON(ISNULL(TA.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId', role NVARCHAR(50) '$.role') T
          INNER JOIN USERS U ON U.USER_ID = T.tutorId
          WHERE TA.BATCH_ID = CS.BATCH_ID AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST')
        ) AS TUTOR_NAME

      FROM CLASS_SCHEDULES CS

      INNER JOIN BATCHES B
        ON B.ID = CS.BATCH_ID

      WHERE
    CS.CLASS_DATE >= CAST(GETDATE() AS DATE)

    AND CS.IS_ACTIVE = 1

    AND B.IS_ACTIVE = 1

    AND DATEADD(
        HOUR,
        3,
        CAST(
            CAST(CS.CLASS_DATE AS DATETIME)
            + CAST(CS.CLASS_TIME AS DATETIME)
            AS DATETIME
        )
    ) > GETDATE()
    `;

    if (isStudent) {
      query += `
        AND EXISTS (
          SELECT 1
          FROM STUDENT_ALLOCATIONS SA
          WHERE SA.BATCH_ID = CS.BATCH_ID
            AND SA.STUDENT_ID = @USER_ID
        )
      `;
    } else if (!isAdmin) {
      // Current tutor is assigned to this batch
      query += `
        AND EXISTS (
          SELECT 1
          FROM TUTOR_ALLOCATIONS TA
          CROSS APPLY OPENJSON(
            ISNULL(TA.TUTOR_IDS, '[]')
          )
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) T
          WHERE
            TA.BATCH_ID = CS.BATCH_ID
            AND T.tutorId = @USER_ID
        )
      `;
    }

    // ==========================================
    // Optional batch filter
    // ==========================================

    if (
      rawBatchId &&
      rawBatchId !== "undefined" &&
      rawBatchId !== "null"
    ) {
      const batchId = Number(rawBatchId);

      if (!Number.isInteger(batchId) || batchId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "Invalid batch ID",
        });
      }

      request.input("BATCH_ID", sql.Int, batchId);

      query += `
        AND CS.BATCH_ID = @BATCH_ID
      `;
    }

    query += `
      ORDER BY
        CS.CLASS_DATE ASC,
        CS.CLASS_TIME ASC
    `;

    const result = await request.query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });

  } catch (err) {
    console.error("getUpcomingClasses HOST error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
// =====================================================
// GET UPCOMING CLASSES - HOST + SUPPORT
// Used by Live Class page
// =====================================================

const getLiveClasses = async (req, res) => {
  try {
    const rawUserId =
      req.query.userId ||
      req.query.USER_ID ||
      req.query.user_id;

    const rawBatchId =
      req.query.batchId ||
      req.query.BATCH_ID ||
      req.query.batch_id;

    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor user ID is required",
      });
    }

    const pool = getPool();

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const userType = user ? String(user.USER_TYPE || "").toUpperCase() : "";
    const isAdmin = userType === "ADMIN";
    const isStudent = userType === "STUDENT";

    const request = pool
      .request()
      .input("USER_ID", sql.Int, userId);

    let query = `
      SELECT
        CS.ID,
        CS.TOPIC,
        FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
        FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
        FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
        DATENAME(dw, CS.CLASS_DATE) AS DAY_NAME,
        CONVERT(VARCHAR(8), CS.CLASS_TIME, 108) AS CLASS_TIME,
        CS.MEET_ID,
        CS.MEET_CODE,
        CS.MEET_LINK,
        CS.IS_ACTIVE,
        CS.CREATED_BY,
        CS.CREATED_AT,
        CS.BATCH_ID,

        B.BATCH_CODE,
        B.BATCH_NAME,

        (
          SELECT TOP 1 U.USERNAME
          FROM TUTOR_ALLOCATIONS TA
          CROSS APPLY OPENJSON(ISNULL(TA.TUTOR_IDS, '[]'))
          WITH (tutorId INT '$.tutorId', role NVARCHAR(50) '$.role') T
          INNER JOIN USERS U ON U.USER_ID = T.tutorId
          WHERE TA.BATCH_ID = CS.BATCH_ID AND (TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST')
        ) AS TUTOR_NAME

      FROM CLASS_SCHEDULES CS

      INNER JOIN BATCHES B
        ON B.ID = CS.BATCH_ID

      WHERE
  CS.CLASS_DATE >= CAST(GETDATE() AS DATE)

  AND CS.IS_ACTIVE = 1

  AND B.IS_ACTIVE = 1

  -- Class is valid only until 3 hours after start time
  AND DATEADD(
      HOUR,
      3,
      CAST(
        CAST(CS.CLASS_DATE AS DATETIME)
        + CAST(CS.CLASS_TIME AS DATETIME)
        AS DATETIME
      )
  ) > GETDATE()
    `;

    if (isStudent) {
      query += `
        AND EXISTS (
          SELECT 1
          FROM STUDENT_ALLOCATIONS SA
          WHERE SA.BATCH_ID = CS.BATCH_ID
            AND SA.STUDENT_ID = @USER_ID
        )
      `;
    } else if (!isAdmin) {
      query += `
        -- Current tutor must be assigned to this batch
        AND EXISTS (
          SELECT 1
          FROM TUTOR_ALLOCATIONS TA
          CROSS APPLY OPENJSON(
            ISNULL(TA.TUTOR_IDS, '[]')
          )
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) T

          WHERE
            TA.BATCH_ID = CS.BATCH_ID

            AND T.tutorId = @USER_ID

            -- HOST OR SUPPORT
            AND (
              TRY_CONVERT(INT, T.role) IN (1, 2)

              OR UPPER(LTRIM(RTRIM(T.role))) IN (
                'HOST',
                'SUPPORT'
              )
            )
        )
      `;
    }

    // =====================================================
    // Optional batch filter
    // =====================================================

    if (
      rawBatchId &&
      rawBatchId !== "undefined" &&
      rawBatchId !== "null"
    ) {
      const batchId = Number(rawBatchId);

      if (!Number.isInteger(batchId) || batchId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "Invalid batch ID",
        });
      }

      request.input("BATCH_ID", sql.Int, batchId);

      query += `
        AND CS.BATCH_ID = @BATCH_ID
      `;
    }

    query += `
      ORDER BY
        CS.CLASS_DATE ASC,
        CS.CLASS_TIME ASC
    `;

    const result = await request.query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });

  } catch (err) {
    console.error(
      "getLiveClasses error:",
      err
    );

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE CLASS SCHEDULE
// =====================================================

const updateClassSchedule = async (req, res) => {
  try {
    const { topic, classDate, classTime } = req.body;

    const scheduleId = Number(req.params.id || req.body.id);

    // -------------------------------------------------
    // Validate ID
    // -------------------------------------------------

    if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid schedule ID",
      });
    }

    // -------------------------------------------------
    // Validate topic
    // -------------------------------------------------

    if (
      !topic ||
      typeof topic !== "string" ||
      topic.trim().length === 0
    ) {
      return res.status(400).json({
        status: 0,
        message: "Topic is required",
      });
    }

    // -------------------------------------------------
    // Validate date
    // -------------------------------------------------

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!classDate || !dateRegex.test(classDate)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid class date format. Expected YYYY-MM-DD",
      });
    }

    const requestedDate = new Date(`${classDate}T00:00:00`);

    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({
        status: 0,
        message: "Invalid class date",
      });
    }

    requestedDate.setHours(0, 0, 0, 0);

    // -------------------------------------------------
    // Tomorrow validation
    // -------------------------------------------------

    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (requestedDate < tomorrow) {
      return res.status(400).json({
        status: 0,
        message: "Class date must be from tomorrow onwards",
      });
    }

    // -------------------------------------------------
    // Validate time
    // -------------------------------------------------

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    if (!classTime || !timeRegex.test(classTime)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid class time format. Expected HH:mm:ss",
      });
    }

    // -------------------------------------------------
    // Get existing class information
    // -------------------------------------------------

    const pool = getPool();

    const existingResult = await pool
      .request()
      .input("ID", sql.Int, scheduleId)
      .query(`
        SELECT
          CS.ID,
          CS.TOPIC,
          CS.BATCH_ID,
          CS.CLASS_DATE,
          CS.CLASS_TIME,
          CS.MEET_ID,
          CS.MEET_CODE,
          CS.MEET_LINK,

          B.BATCH_CODE,
          B.BATCH_NAME,
          B.START_DATE,
          B.END_DATE,
          B.IS_ACTIVE AS BATCH_IS_ACTIVE

        FROM CLASS_SCHEDULES CS WITH (NOLOCK)

        INNER JOIN BATCHES B WITH (NOLOCK)
          ON B.ID = CS.BATCH_ID

        WHERE CS.ID = @ID
      `);

    if (existingResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Class schedule not found",
      });
    }

    const existingClass = existingResult.recordset[0];

    // -------------------------------------------------
    // Validate target batch
    // -------------------------------------------------

    const rawBatchId =
      req.body.batch_id ??
      req.body.batchId ??
      req.body.BATCH_ID ??
      existingClass.BATCH_ID;

    const targetBatchId = Number(rawBatchId);

    if (!Number.isInteger(targetBatchId) || targetBatchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid batch ID",
      });
    }

    let targetBatch = existingClass;

    if (targetBatchId !== Number(existingClass.BATCH_ID)) {
      const batchResult = await pool
        .request()
        .input("BATCH_ID", sql.Int, targetBatchId)
        .query(`
          SELECT
            ID,
            BATCH_CODE,
            BATCH_NAME,
            START_DATE,
            END_DATE,
            IS_ACTIVE
          FROM BATCHES WITH (NOLOCK)
          WHERE ID = @BATCH_ID
        `);

      if (batchResult.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "Batch not found",
        });
      }

      targetBatch = batchResult.recordset[0];
    }

    // -------------------------------------------------
    // Check batch active
    // -------------------------------------------------

    if (Number(targetBatch.IS_ACTIVE ?? targetBatch.BATCH_IS_ACTIVE) !== 1) {
      return res.status(400).json({
        status: 0,
        message: "Cannot update class for inactive batch",
      });
    }

    // -------------------------------------------------
    // Check batch date range
    // -------------------------------------------------

    const batchStartDate = new Date(targetBatch.START_DATE);
    const batchEndDate = new Date(targetBatch.END_DATE);

    batchStartDate.setHours(0, 0, 0, 0);
    batchEndDate.setHours(0, 0, 0, 0);

    if (requestedDate < batchStartDate) {
      return res.status(400).json({
        status: 0,
        message: `Class date cannot be before batch start date (${formatDate(
          targetBatch.START_DATE
        )})`,
      });
    }

    if (requestedDate > batchEndDate) {
      return res.status(400).json({
        status: 0,
        message: `Class date cannot be after batch end date (${formatDate(
          targetBatch.END_DATE
        )})`,
      });
    }

    // -------------------------------------------------
    // Duplicate check
    // -------------------------------------------------

    const duplicateResult = await pool
      .request()
      .input("ID", sql.Int, scheduleId)
      .input("BATCH_ID", sql.Int, targetBatchId)
      .input("CLASS_DATE", sql.Date, classDate)
      .input("CLASS_TIME", sql.VarChar(8), classTime)
      .query(`
        SELECT TOP 1
          ID,
          TOPIC,
          CLASS_DATE,
          CLASS_TIME
        FROM CLASS_SCHEDULES WITH (NOLOCK)
        WHERE
          BATCH_ID = @BATCH_ID
          AND CLASS_DATE = @CLASS_DATE
          AND CLASS_TIME = @CLASS_TIME
          AND ID <> @ID
      `);

    if (duplicateResult.recordset.length > 0) {
      const duplicate = duplicateResult.recordset[0];

      return res.status(400).json({
        status: 0,
        message:
          "Another class is already scheduled for this batch at the selected date and time",
        data: {
          ID: duplicate.ID,
          TOPIC: duplicate.TOPIC,
          CLASS_DATE: formatDate(duplicate.CLASS_DATE),
          CLASS_TIME: formatSqlTime(duplicate.CLASS_TIME),
        },
      });
    }

    // -------------------------------------------------
    // UPDATE
    // -------------------------------------------------

    await pool
      .request()
      .input("ID", sql.Int, scheduleId)
      .input("BATCH_ID", sql.Int, targetBatchId)
      .input("TOPIC", sql.NVarChar(200), topic.trim())
      .input("CLASS_DATE", sql.Date, classDate)
      .input("CLASS_TIME", sql.VarChar(8), classTime)
      .query(`
        UPDATE CLASS_SCHEDULES
        SET
          TOPIC = @TOPIC,
          BATCH_ID = @BATCH_ID,
          CLASS_DATE = @CLASS_DATE,
          CLASS_TIME = @CLASS_TIME
        WHERE ID = @ID
      `);

    // -------------------------------------------------
    // Response
    // -------------------------------------------------

    return res.json({
      status: 1,
      message: "Class schedule updated successfully",
      data: {
        id: scheduleId,
        batch_id: targetBatchId,
        batch_code: targetBatch.BATCH_CODE,
        batch_name: targetBatch.BATCH_NAME,
        topic: topic.trim(),
        class_date: classDate,
        class_time: classTime,
      },
    });

  } catch (err) {
    console.error("updateClassSchedule error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
      error: err.response?.data || null,
    });
  }
};

const getTutorBatches = async (req, res) => {
  try {
    const pool = getPool();

    const rawUserId =
      req.params.userId ||
      req.query.userId ||
      req.body?.userId;

    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid user ID",
      });
    }

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    const user = userResult.recordset[0];
    const isAdmin = user && String(user.USER_TYPE).toUpperCase() === "ADMIN";

    let query;

    if (isAdmin) {
      query = `
        SELECT
          B.ID,
          B.BATCH_CODE,
          B.BATCH_NAME,
          B.START_DATE,
          B.END_DATE,
          B.IS_ACTIVE

        FROM BATCHES B

        WHERE
          B.IS_ACTIVE = 1

        ORDER BY
          B.BATCH_NAME
      `;
    } else {
      query = `
        SELECT DISTINCT
          B.ID,
          B.BATCH_CODE,
          B.BATCH_NAME,
          B.START_DATE,
          B.END_DATE,
          B.IS_ACTIVE

        FROM TUTOR_ALLOCATIONS TA

        INNER JOIN BATCHES B
          ON B.ID = TA.BATCH_ID

        CROSS APPLY OPENJSON(TA.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) T

        WHERE
          B.IS_ACTIVE = 1

          AND T.tutorId = @USER_ID

          AND (
            TRY_CONVERT(INT, T.role) = 1
            OR UPPER(T.role) = 'HOST'
          )

        ORDER BY
          B.BATCH_NAME
      `;
    }

    const result = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });

  } catch (err) {
    console.error(
      "getTutorBatches error:",
      err
    );

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// GET CALENDAR SCHEDULES FOR TUTOR & STUDENT
// Used by Tutor Calendar and Student Calendar Pages
// =====================================================
const getCalendarSchedule = async (req, res) => {
  try {
    const rawUserId =
      req.query.userId ||
      req.query.USER_ID ||
      req.query.user_id;

    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid user ID is required",
      });
    }

    const { startDate, endDate, date } = req.query;
    const pool = getPool();

    // Check user role
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USER_TYPE, USERNAME, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    const user = userResult.recordset[0];
    const userType = String(user.USER_TYPE || "").toUpperCase().trim();
    const isAdmin = userType === "ADMIN";
    const isStudent = userType === "STUDENT";

    const request = pool
      .request()
      .input("USER_ID", sql.Int, userId);

    let query = "";

    if (isStudent) {
      // Logged-in Student: Filter only classes for the batch(es) assigned to this student
      query = `
        SELECT 
          CS.ID,
          CS.TOPIC,
          CS.BATCH_ID,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
          FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
          DATENAME(dw, CS.CLASS_DATE) AS DAY_NAME,
          CONVERT(VARCHAR(5), CS.CLASS_TIME, 108) AS START_TIME,
          CONVERT(VARCHAR(5), DATEADD(HOUR, 1, CAST(CS.CLASS_TIME AS DATETIME)), 108) AS END_TIME,
          CS.MEET_ID,
          CS.MEET_CODE,
          CS.MEET_LINK,
          CS.IS_ACTIVE,
          CS.CREATED_BY,
          CS.CREATED_AT,
          B.BATCH_CODE,
          B.BATCH_NAME,
          FORMAT(B.START_DATE, 'dd MMM yyyy') AS BATCH_START_DATE,
          FORMAT(B.END_DATE, 'dd MMM yyyy') AS BATCH_END_DATE,
          (
            SELECT COUNT(DISTINCT SA_SUB.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS SA_SUB
            WHERE SA_SUB.BATCH_ID = CS.BATCH_ID
          ) AS STUDENT_COUNT,
          TUTOR_USER.USERNAME AS TUTOR_NAME,
          'STUDENT' AS TUTOR_ROLE
        FROM CLASS_SCHEDULES CS
        INNER JOIN BATCHES B ON B.ID = CS.BATCH_ID
        INNER JOIN STUDENT_ALLOCATIONS SA ON SA.BATCH_ID = CS.BATCH_ID AND SA.STUDENT_ID = @USER_ID
        LEFT JOIN TUTOR_ALLOCATIONS TA ON TA.BATCH_ID = CS.BATCH_ID
        OUTER APPLY (
          SELECT TOP 1
            tutorId,
            role
          FROM OPENJSON(ISNULL(TA.TUTOR_IDS, '[]'))
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          )
          WHERE TRY_CONVERT(INT, role) = 1 OR UPPER(LTRIM(RTRIM(role))) = 'HOST'
          ORDER BY tutorId
        ) T
        LEFT JOIN USERS TUTOR_USER ON TUTOR_USER.USER_ID = T.tutorId
        WHERE B.IS_ACTIVE = 1
          AND ISNULL(CS.IS_ACTIVE, 1) = 1
      `;
    } else if (isAdmin) {
      // Admin: All active batch schedules
      query = `
        SELECT 
          CS.ID,
          CS.TOPIC,
          CS.BATCH_ID,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
          FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
          DATENAME(dw, CS.CLASS_DATE) AS DAY_NAME,
          CONVERT(VARCHAR(5), CS.CLASS_TIME, 108) AS START_TIME,
          CONVERT(VARCHAR(5), DATEADD(HOUR, 1, CAST(CS.CLASS_TIME AS DATETIME)), 108) AS END_TIME,
          CS.MEET_ID,
          CS.MEET_CODE,
          CS.MEET_LINK,
          CS.IS_ACTIVE,
          CS.CREATED_BY,
          CS.CREATED_AT,
          B.BATCH_CODE,
          B.BATCH_NAME,
          FORMAT(B.START_DATE, 'dd MMM yyyy') AS BATCH_START_DATE,
          FORMAT(B.END_DATE, 'dd MMM yyyy') AS BATCH_END_DATE,
          (
            SELECT COUNT(DISTINCT SA.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS SA
            WHERE SA.BATCH_ID = CS.BATCH_ID
          ) AS STUDENT_COUNT,
          COALESCE(TUTOR_USER.USERNAME, CREATOR_USER.USERNAME, 'Tutor') AS TUTOR_NAME,
          'HOST' AS TUTOR_ROLE
        FROM CLASS_SCHEDULES CS
        INNER JOIN BATCHES B ON B.ID = CS.BATCH_ID
        LEFT JOIN TUTOR_ALLOCATIONS TA ON TA.BATCH_ID = CS.BATCH_ID
        OUTER APPLY (
          SELECT TOP 1
            tutorId,
            role
          FROM OPENJSON(ISNULL(TA.TUTOR_IDS, '[]'))
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          )
          WHERE TRY_CONVERT(INT, role) = 1 OR UPPER(LTRIM(RTRIM(role))) = 'HOST'
          ORDER BY tutorId
        ) T
        LEFT JOIN USERS TUTOR_USER ON TUTOR_USER.USER_ID = T.tutorId
        LEFT JOIN USERS CREATOR_USER ON CREATOR_USER.USER_ID = TRY_CONVERT(INT, CS.CREATED_BY)
        WHERE B.IS_ACTIVE = 1
          AND ISNULL(CS.IS_ACTIVE, 1) = 1
      `;
    } else {
      // Tutor: Filter schedules for batches where tutor is assigned
      query = `
        SELECT 
          CS.ID,
          CS.TOPIC,
          CS.BATCH_ID,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
          FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
          FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,
          DATENAME(dw, CS.CLASS_DATE) AS DAY_NAME,
          CONVERT(VARCHAR(5), CS.CLASS_TIME, 108) AS START_TIME,
          CONVERT(VARCHAR(5), DATEADD(HOUR, 1, CAST(CS.CLASS_TIME AS DATETIME)), 108) AS END_TIME,
          CS.MEET_ID,
          CS.MEET_CODE,
          CS.MEET_LINK,
          CS.IS_ACTIVE,
          CS.CREATED_BY,
          CS.CREATED_AT,
          B.BATCH_CODE,
          B.BATCH_NAME,
          FORMAT(B.START_DATE, 'dd MMM yyyy') AS BATCH_START_DATE,
          FORMAT(B.END_DATE, 'dd MMM yyyy') AS BATCH_END_DATE,
          (
            SELECT COUNT(DISTINCT SA.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS SA
            WHERE SA.BATCH_ID = CS.BATCH_ID
          ) AS STUDENT_COUNT,
          (
            SELECT TOP 1 U.USERNAME
            FROM USERS U
            WHERE U.USER_ID = @USER_ID
          ) AS TUTOR_NAME,
          CASE 
            WHEN TRY_CONVERT(INT, T.role) = 1 OR UPPER(LTRIM(RTRIM(T.role))) = 'HOST' THEN 'HOST'
            ELSE 'SUPPORT'
          END AS TUTOR_ROLE
        FROM CLASS_SCHEDULES CS
        INNER JOIN BATCHES B ON B.ID = CS.BATCH_ID
        INNER JOIN TUTOR_ALLOCATIONS TA ON TA.BATCH_ID = CS.BATCH_ID
        CROSS APPLY OPENJSON(ISNULL(TA.TUTOR_IDS, '[]'))
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) T
        WHERE B.IS_ACTIVE = 1
          AND ISNULL(CS.IS_ACTIVE, 1) = 1
          AND T.tutorId = @USER_ID
          AND (
            TRY_CONVERT(INT, T.role) IN (1, 2)
            OR UPPER(LTRIM(RTRIM(T.role))) IN ('HOST', 'SUPPORT')
          )
      `;
    }

    if (date) {
      request.input("FILTER_DATE", sql.Date, date);
      query += ` AND CS.CLASS_DATE = @FILTER_DATE `;
    } else {
      if (startDate) {
        request.input("START_DATE", sql.Date, startDate);
        query += ` AND CS.CLASS_DATE >= @START_DATE `;
      }
      if (endDate) {
        request.input("END_DATE", sql.Date, endDate);
        query += ` AND CS.CLASS_DATE <= @END_DATE `;
      }
    }

    query += `
      ORDER BY 
        CS.CLASS_DATE ASC,
        CS.CLASS_TIME ASC
    `;

    const result = await request.query(query);

    return res.json({
      status: 1,
      message: "Calendar schedule fetched successfully",
      data: result.recordset,
    });

  } catch (err) {
    console.error("getCalendarSchedule error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

module.exports = {
  createClassSchedule,
  getUpcomingClasses,
  getLiveClasses,
  updateClassSchedule,
  getTutorBatches,
  getCalendarSchedule,
};

