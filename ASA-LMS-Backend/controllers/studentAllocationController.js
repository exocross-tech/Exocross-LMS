const sql = require("mssql");
const { getPool } = require("../config/database");

// Get students who are not already allocated
// =====================================================
// GET STUDENTS WITH THEIR BATCH ID
// =====================================================

const getStudentAllocations = async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT 
        u.USER_ID,
        u.USERNAME,
        u.EMAIL_ID,
        u.MOBILE_NO,
        u.SCHOOL_NAME,
        u.GRADE,
        u.IS_ACTIVE,

        -- Allocation information
        sa.BATCH_ID,

        CASE 
          WHEN sa.STUDENT_ID IS NOT NULL 
            THEN 'Assigned'
          ELSE 'Not Assigned'
        END AS ALLOCATION_STATUS

      FROM USERS u

      LEFT JOIN STUDENT_ALLOCATIONS sa
        ON sa.STUDENT_ID = u.USER_ID

      WHERE u.USER_TYPE = 'STUDENT'
        AND u.IS_ACTIVE = 1

      ORDER BY u.USER_ID DESC
    `);

    res.json({
      status: 1,
      data: result.recordset,
    });

  } catch (err) {

    console.error(
      "getStudentAllocations error:",
      err
    );

    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// Get batches with current student capacity
const getStudentAllocationBatches = async (req, res) => {
  try {
    const pool = getPool();
    const rawTutorId = req.query.tutorId || req.query.tutor_id || req.query.userId || req.query.USER_ID;

    let query = `
      SELECT
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE,

          COUNT(sa.ID) AS CURRENT_COUNT

      FROM BATCHES b

      LEFT JOIN STUDENT_ALLOCATIONS sa
          ON sa.BATCH_ID = b.ID
    `;

    // If requested by a tutor, ONLY show batches where tutor is assigned as HOST
    if (rawTutorId) {
      const tutorId = Number(rawTutorId);
      query += `
        INNER JOIN TUTOR_ALLOCATIONS ta ON ta.BATCH_ID = b.ID
        CROSS APPLY OPENJSON(ta.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE b.IS_ACTIVE = 1
          AND ISJSON(ta.TUTOR_IDS) = 1
          AND t.tutorId = @USER_ID
          AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
      `;
    } else {
      query += `
        WHERE b.IS_ACTIVE = 1
      `;
    }

    query += `
      GROUP BY
          b.ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE

      ORDER BY b.ID DESC
    `;

    const request = pool.request();
    if (rawTutorId) {
      request.input("USER_ID", sql.Int, Number(rawTutorId));
    }

    const result = await request.query(query);

    res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("getStudentAllocationBatches error:", err);

    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// Assign selected students to a batch
const assignStudentsToBatch = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const { studentIds, batchId, createdBy, tutorId, userType } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !batchId) {
      return res.status(400).json({
        status: 0,
        message: "Students and batch are required",
      });
    }

    // Security check for Tutor: Must be HOST assigned to this batch
    const rawTutorId = tutorId || (String(userType || "").toUpperCase() === "TUTOR" ? createdBy : null);
    if (rawTutorId && Number.isInteger(Number(rawTutorId))) {
      const hostCheck = await pool
        .request()
        .input("USER_ID", sql.Int, Number(rawTutorId))
        .input("BATCH_ID", sql.Int, batchId)
        .query(`
          SELECT 1
          FROM TUTOR_ALLOCATIONS ta
          CROSS APPLY OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) t
          WHERE ta.BATCH_ID = @BATCH_ID
            AND ISJSON(ta.TUTOR_IDS) = 1
            AND t.tutorId = @USER_ID
            AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
        `);

      if (hostCheck.recordset.length === 0) {
        return res.status(403).json({
          status: 0,
          message: "You can only assign students to batches where you are the HOST.",
        });
      }
    }

    // Get batch
    const batchResult = await pool.request().input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT
          ID,
          BATCH_CODE,
          BATCH_NAME,
          START_DATE,
          END_DATE
        FROM BATCHES
        WHERE ID = @BATCH_ID
          AND IS_ACTIVE = 1
      `);

    if (batchResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Batch not found or inactive",
      });
    }

    const batch = batchResult.recordset[0];

    // Get Chat Room for this batch
    const chatRoomResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId).query(`
        SELECT
          ROOM_ID,
          BATCH_ID,
          ROOM_NAME
        FROM CHAT_ROOMS
        WHERE BATCH_ID = @BATCH_ID
          AND IS_ACTIVE = 1
      `);

    if (chatRoomResult.recordset.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Chat room not found for this batch",
      });
    }

    const chatRoom = chatRoomResult.recordset[0];

    // Check current capacity
    const countResult = await pool.request().input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT COUNT(*) AS CURRENT_COUNT
        FROM STUDENT_ALLOCATIONS
        WHERE BATCH_ID = @BATCH_ID
      `);

    const currentCount = countResult.recordset[0].CURRENT_COUNT;

    if (currentCount + studentIds.length > 50) {
      return res.status(400).json({
        status: 0,
        message: `Batch ${batch.BATCH_CODE} can only have 50 students. Current count: ${currentCount}`,
      });
    }

    await transaction.begin();

    let assignedCount = 0;
    let skippedCount = 0;

    for (const studentId of studentIds) {
      // Get student
      const studentResult = await transaction
        .request()
        .input("STUDENT_ID", sql.Int, studentId).query(`
          SELECT
            USER_ID,
            USERNAME
          FROM USERS
          WHERE USER_ID = @STUDENT_ID
            AND USER_TYPE = 'STUDENT'
            AND IS_ACTIVE = 1
        `);

      if (studentResult.recordset.length === 0) {
        skippedCount++;
        continue;
      }

      const student = studentResult.recordset[0];

      // Check if student is already assigned
      const existingAllocation = await transaction
        .request()
        .input("STUDENT_ID", sql.Int, student.USER_ID).query(`
          SELECT TOP 1
  ID,
  BATCH_ID
FROM STUDENT_ALLOCATIONS
          WHERE STUDENT_ID = @STUDENT_ID
        `);

      if (existingAllocation.recordset.length > 0) {
        skippedCount++;
        continue;
      }

      // 1. Add student to STUDENT_ALLOCATIONS
      await transaction
        .request()
        .input("STUDENT_ID", sql.Int, student.USER_ID)
        .input("STUDENT_NAME", sql.NVarChar, student.USERNAME)
        .input("BATCH_ID", sql.Int, batch.ID)
        .input("CREATED_BY", sql.NVarChar, createdBy || "Admin").query(`
          INSERT INTO STUDENT_ALLOCATIONS
          (
            STUDENT_ID,
            STUDENT_NAME,
            BATCH_ID,
            CREATED_BY,
            CREATED_AT
          )
          VALUES
          (
            @STUDENT_ID,
            @STUDENT_NAME,
            @BATCH_ID,
            @CREATED_BY,
            GETDATE()
          )
        `);

      // 2. Add student to Chat Room
      await transaction
        .request()
        .input("ROOM_ID", sql.Int, chatRoom.ROOM_ID)
        .input("USER_ID", sql.Int, student.USER_ID).query(`
          IF NOT EXISTS (
            SELECT 1
            FROM CHAT_ROOM_MEMBERS
            WHERE ROOM_ID = @ROOM_ID
              AND USER_ID = @USER_ID
          )
          BEGIN
            INSERT INTO CHAT_ROOM_MEMBERS
            (
              ROOM_ID,
              USER_ID,
              MEMBER_TYPE,
              JOINED_AT,
              IS_ACTIVE
            )
            VALUES
            (
              @ROOM_ID,
              @USER_ID,
              'STUDENT',
              GETDATE(),
              1
            )
          END
        `);

      assignedCount++;
    }

    await transaction.commit();

    return res.json({
      status: 1,
      message: `${assignedCount} student(s) assigned successfully`,
      assignedCount,
      skippedCount,
      batchId: batch.ID,
      roomId: chatRoom.ROOM_ID,
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    console.error("assignStudentsToBatch error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

module.exports = {
  getStudentAllocations,
  getStudentAllocationBatches,
  assignStudentsToBatch,
};
