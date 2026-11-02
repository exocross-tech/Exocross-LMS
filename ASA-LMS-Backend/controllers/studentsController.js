const sql = require("mssql");
const { getPool } = require("../config/database");

const getAllStudents = async (req, res) => {
  try {
    const pool = getPool();

    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 10);
    const search = req.query.search || "";

    const schoolName = req.query.schoolName || "";

    const offset = (page - 1) * limit;

    let whereConditions = [];

    if (search) {
      whereConditions.push(`(u.USERNAME LIKE '%' + @SEARCH + '%' OR b.BATCH_CODE LIKE '%' + @SEARCH + '%' OR u.ROLL_NO LIKE '%' + @SEARCH + '%')`);
    }

    if (schoolName) {
      whereConditions.push(`u.SCHOOL_NAME = @SCHOOL_NAME`);
    }

    if (req.query.batchId) {
      whereConditions.push(`b.ID = @BATCH_ID`);
    }

    const whereClause = whereConditions.length > 0 ? " AND " + whereConditions.join(" AND ") : "";

    const request = pool.request();

    if (search) {
      request.input("SEARCH", sql.NVarChar, search);
    }

    if (schoolName) {
      request.input("SCHOOL_NAME", sql.NVarChar, schoolName);
    }

    if (req.query.batchId) {
      request.input("BATCH_ID", sql.Int, parseInt(req.query.batchId));
    }

    request.input("OFFSET", sql.Int, offset);
    request.input("LIMIT", sql.Int, limit);

    const result = await request.query(
      ` SELECT u.USER_ID, u.USERNAME, u.ROLL_NO, u.SCHOOL_NAME, u.EMAIL_ID, u.MOBILE_NO, u.IS_ACTIVE, b.BATCH_CODE FROM USERS u INNER JOIN STUDENT_ALLOCATIONS sa ON sa.STUDENT_ID = u.USER_ID INNER JOIN BATCHES b ON b.ID = sa.BATCH_ID WHERE u.USER_TYPE = 'STUDENT' ${whereClause} ORDER BY u.USER_ID DESC OFFSET @OFFSET ROWS FETCH NEXT @LIMIT ROWS ONLY `,
    );

    const countRequest = pool.request();

    if (search) {
      countRequest.input("SEARCH", sql.NVarChar, search);
    }

    if (schoolName) {
      countRequest.input("SCHOOL_NAME", sql.NVarChar, schoolName);
    }

    if (req.query.batchId) {
      countRequest.input("BATCH_ID", sql.Int, parseInt(req.query.batchId));
    }

    const countResult = await countRequest.query(
      ` SELECT COUNT(*) AS TOTAL FROM USERS u INNER JOIN STUDENT_ALLOCATIONS sa ON sa.STUDENT_ID = u.USER_ID INNER JOIN BATCHES b ON b.ID = sa.BATCH_ID WHERE u.USER_TYPE = 'STUDENT' ${whereClause} `,
    );

    res.json({
      status: 1,
      data: result.recordset,
      pagination: {
        page,
        limit,
        total: countResult.recordset[0].TOTAL,
        totalPages: Math.ceil(countResult.recordset[0].TOTAL / limit),
      },
    });
  } catch (err) {
    console.error("getAllStudents error:", err);
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

const getAllSchools = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT SCHOOL_NAME
      FROM USERS
      WHERE USER_TYPE = 'STUDENT'
        AND SCHOOL_NAME IS NOT NULL
        AND LTRIM(RTRIM(SCHOOL_NAME)) <> ''
      ORDER BY SCHOOL_NAME ASC
    `);

    const schools = result.recordset.map((r) => r.SCHOOL_NAME.trim()).filter(Boolean);

    res.json({
      status: 1,
      data: schools,
    });
  } catch (err) {
    console.error("getAllSchools error:", err);
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

const updateStudentStatus = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const studentId = Number(req.params.id);

    const isActive =
      req.body.isActive !== undefined
        ? Number(req.body.isActive)
        : Number(req.body.IS_ACTIVE);

    const force = req.body.force === true;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!studentId) {
      return res.status(400).json({
        status: 0,
        message: "Student ID is required",
      });
    }

    if (isActive !== 0 && isActive !== 1) {
      return res.status(400).json({
        status: 0,
        message: "Invalid status value",
      });
    }

    // =====================================================
    // CHECK STUDENT
    // =====================================================

    const studentResult = await pool
      .request()
      .input("USER_ID", sql.Int, studentId)
      .query(`
        SELECT
          USER_ID,
          USERNAME,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
          AND USER_TYPE = 'STUDENT'
      `);

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Student not found",
      });
    }

    const student = studentResult.recordset[0];

    // =====================================================
    // ACTIVATE STUDENT
    // =====================================================

    if (isActive === 1) {
      await pool
        .request()
        .input("USER_ID", sql.Int, studentId)
        .query(`
          UPDATE USERS
          SET IS_ACTIVE = 1,
              UPDATED_AT = GETDATE()
          WHERE USER_ID = @USER_ID
            AND USER_TYPE = 'STUDENT'
        `);

      return res.json({
        status: 1,
        message: "Student activated successfully",
      });
    }

    // =====================================================
    // CHECK STUDENT BATCH ALLOCATION
    // =====================================================

    const allocationResult = await pool
      .request()
      .input("STUDENT_ID", sql.Int, studentId)
      .query(`
        SELECT
          sa.ID AS ALLOCATION_ID,
          sa.STUDENT_ID,
          sa.STUDENT_NAME,
          sa.BATCH_ID,

          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE

        FROM STUDENT_ALLOCATIONS sa

        LEFT JOIN BATCHES b
          ON b.ID = sa.BATCH_ID

        WHERE sa.STUDENT_ID = @STUDENT_ID

        ORDER BY sa.ID DESC
      `);

    const allocations = allocationResult.recordset || [];

    // =====================================================
    // HAS BATCH + NO FORCE
    // ASK FRONTEND FOR CONFIRMATION
    // =====================================================

    if (allocations.length > 0 && !force) {
      return res.json({
        status: 3,

        message:
          "This student is already assigned to a batch. Deactivating the student will remove the batch allocation.",

        allocations: allocations.map((item) => ({
          ALLOCATION_ID: item.ALLOCATION_ID,
          STUDENT_ID: item.STUDENT_ID,
          STUDENT_NAME: item.STUDENT_NAME,
          BATCH_ID: item.BATCH_ID,
          BATCH_CODE: item.BATCH_CODE,
          BATCH_NAME: item.BATCH_NAME,
          START_DATE: item.START_DATE,
          END_DATE: item.END_DATE,
        })),
      });
    }

    // =====================================================
    // START TRANSACTION
    // =====================================================

    await transaction.begin();

    // =====================================================
    // REMOVE STUDENT FROM CHAT ROOM
    // =====================================================

    if (allocations.length > 0) {
      await transaction
        .request()
        .input("STUDENT_ID", sql.Int, studentId)
        .query(`
          DELETE FROM CHAT_ROOM_MEMBERS
          WHERE USER_ID = @STUDENT_ID
            AND MEMBER_TYPE = 'STUDENT'
        `);

      // ===================================================
      // REMOVE STUDENT BATCH ALLOCATION
      // ===================================================

      await transaction
        .request()
        .input("STUDENT_ID", sql.Int, studentId)
        .query(`
          DELETE FROM STUDENT_ALLOCATIONS
          WHERE STUDENT_ID = @STUDENT_ID
        `);
    }

    // =====================================================
    // DEACTIVATE STUDENT
    // =====================================================

    await transaction
      .request()
      .input("USER_ID", sql.Int, studentId)
      .query(`
        UPDATE USERS
        SET IS_ACTIVE = 0,
            UPDATED_AT = GETDATE()
        WHERE USER_ID = @USER_ID
          AND USER_TYPE = 'STUDENT'
      `);

    // =====================================================
    // COMMIT
    // =====================================================

    await transaction.commit();

    return res.json({
      status: 1,

      message:
        allocations.length > 0
          ? "Student deactivated and batch allocation removed successfully"
          : "Student deactivated successfully",
    });

  } catch (err) {
    console.error("Update Student Status Error:", err);

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Rollback Error:", rollbackError);
    }

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

module.exports = { getAllStudents, getAllSchools, updateStudentStatus };
