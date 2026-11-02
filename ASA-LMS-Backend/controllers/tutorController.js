const sql = require("mssql");
const { getPool } = require("../config/database");

// Get all tutors
const getTutors = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool
      .request()
      .query(
        ` SELECT USER_ID, USERNAME, SCHOOL_NAME, MOBILE_NO, EMAIL_ID, IS_ACTIVE, CREATED_AT, UPDATED_AT FROM USERS WHERE USER_TYPE = 'TUTOR' ORDER BY USER_ID DESC `,
      );
    res.json({ status: 1, data: result.recordset });
  } catch (err) {
    res.status(500).json({ status: 0, message: err.message });
  }
};
// Add tutor
const addTutor = async (req, res) => {
  try {
    const { NAME, DESIGNATION, PHONE, EMAIL, PASSWORD } = req.body;

    const pool = getPool();

    await pool
      .request()
      .input("name", NAME)
      .input("designation", DESIGNATION)
      .input("phone", PHONE)
      .input("email", EMAIL)
      .input("password", PASSWORD)
      .query(
        ` INSERT INTO TUTORS (NAME, DESIGNATION, PHONE, EMAIL, PASSWORD, IS_ACTIVE) VALUES (@name, @designation, @phone, @email, @password, 1) `,
      );

    res.json({
      status: 1,
      message: "Tutor added successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// Update tutor
const updateTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { NAME, DESIGNATION, PHONE, EMAIL, PASSWORD } = req.body;

    const pool = getPool();

    await pool
      .request()
      .input("id", id)
      .input("name", NAME)
      .input("designation", DESIGNATION)
      .input("phone", PHONE)
      .input("email", EMAIL)
      .input("password", PASSWORD).query(`
        UPDATE TUTORS
        SET
          NAME=@name,
          DESIGNATION=@designation,
          PHONE=@phone,
          EMAIL=@email,
          UPDATED_AT=GETDATE()
        WHERE ID=@id
      `);

    res.json({
      status: 1,
      message: "Tutor updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

const updateTutorStatus = async (req, res) => {
  let pool;
  let transaction;
  let transactionStarted = false;

  try {
    pool = getPool();

    const id = Number(req.params.id);

    const isActive =
      req.body.isActive !== undefined
        ? Number(req.body.isActive)
        : Number(req.body.IS_ACTIVE);

    const force = req.body.force === true;
    // =====================================================
    // VALIDATE TUTOR ID
    // =====================================================

    if (!id) {
      return res.status(400).json({
        status: 0,
        message: "Tutor ID is required",
      });
    }

    // =====================================================
    // VALIDATE STATUS
    // =====================================================

    if (isActive !== 0 && isActive !== 1) {
      return res.status(400).json({
        status: 0,
        message: "Invalid status value",
      });
    }

    // =====================================================
    // ACTIVATE TUTOR
    // =====================================================

    if (isActive === 1) {
      const result = await pool
        .request()
        .input("USER_ID", sql.Int, id)
        .query(`
          UPDATE USERS
          SET IS_ACTIVE = 1
          WHERE USER_ID = @USER_ID
            AND USER_TYPE = 'TUTOR'
        `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          status: 0,
          message: "Tutor not found",
        });
      }

      return res.json({
        status: 1,
        message: "Tutor activated successfully",
      });
    }

    // =====================================================
    // DEACTIVATE - CHECK BATCH ALLOCATIONS
    // =====================================================

    const allocationResult = await pool
      .request()
      .input("TUTOR_ID", sql.Int, id)
      .query(`
        SELECT
          ta.ID AS ALLOCATION_ID,
          ta.TUTOR_IDS,
          ta.BATCH_ID,

          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE

        FROM TUTOR_ALLOCATIONS ta

        LEFT JOIN BATCHES b
          ON b.ID = ta.BATCH_ID

        WHERE EXISTS (
          SELECT 1
          FROM OPENJSON(ta.TUTOR_IDS)
          WITH (
            tutorId INT '$.tutorId',
            role NVARCHAR(50) '$.role'
          ) AS tutors
          WHERE tutors.tutorId = @TUTOR_ID
        )

        ORDER BY ta.ID DESC
      `);

    const allocations = allocationResult.recordset || [];

    // =====================================================
    // BATCH EXISTS - ASK FOR CONFIRMATION
    // =====================================================

    if (allocations.length > 0 && !force) {
      return res.json({
        status: 3,

        message:
          "This tutor is already assigned to a batch. Deactivating the tutor will remove the batch allocation.",

        allocations: allocations.map((item) => ({
          ALLOCATION_ID: item.ALLOCATION_ID,
          TUTOR_IDS: item.TUTOR_IDS,
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

    transaction = pool.transaction();

    await transaction.begin();
    transactionStarted = true;

    // =====================================================
    // REMOVE TUTOR FROM CHAT ROOM
    // =====================================================

    if (allocations.length > 0) {
      await transaction
        .request()
        .input("TUTOR_ID", sql.Int, id)
        .query(`
          DELETE FROM CHAT_ROOM_MEMBERS
          WHERE USER_ID = @TUTOR_ID
            AND MEMBER_TYPE = 'TUTOR'
        `);

      // ===================================================
      // REMOVE TUTOR FROM TUTOR_ALLOCATIONS
      // ===================================================

      for (const allocation of allocations) {
        const tutorIds = JSON.parse(allocation.TUTOR_IDS || "[]");

        // Remove only the selected tutor
        const updatedTutorIds = tutorIds.filter(
          (tutor) => Number(tutor.tutorId) !== id
        );

        if (updatedTutorIds.length === 0) {
          // No tutors remain in this allocation
          await transaction
            .request()
            .input("ALLOCATION_ID", sql.Int, allocation.ALLOCATION_ID)
            .query(`
              DELETE FROM TUTOR_ALLOCATIONS
              WHERE ID = @ALLOCATION_ID
            `);
        } else {
          // Keep other tutors
          await transaction
            .request()
            .input(
              "TUTOR_IDS",
              sql.NVarChar(sql.MAX),
              JSON.stringify(updatedTutorIds)
            )
            .input("ALLOCATION_ID", sql.Int, allocation.ALLOCATION_ID)
            .query(`
              UPDATE TUTOR_ALLOCATIONS
              SET
                TUTOR_IDS = @TUTOR_IDS,
                UPDATED_AT = GETDATE()
              WHERE ID = @ALLOCATION_ID
            `);
        }
      }
    }

    // =====================================================
    // DEACTIVATE TUTOR
    // =====================================================

    const updateResult = await transaction
      .request()
      .input("USER_ID", sql.Int, id)
      .query(`
        UPDATE USERS
        SET IS_ACTIVE = 0
        WHERE USER_ID = @USER_ID
          AND USER_TYPE = 'TUTOR'
      `);

    if (updateResult.rowsAffected[0] === 0) {
      throw new Error("Tutor not found");
    }

    // =====================================================
    // COMMIT
    // =====================================================

    await transaction.commit();
    transactionStarted = false;

    return res.json({
      status: 1,

      message:
        allocations.length > 0
          ? "Tutor deactivated and batch allocation updated successfully"
          : "Tutor deactivated successfully",
    });

  } catch (err) {
    console.error("Update Tutor Status Error:", err);

    if (transactionStarted && transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }

    return res.status(500).json({
      status: 0,
      message:
        err.message || "Failed to update tutor status",
    });
  }
};

module.exports = {
  getTutors,
  addTutor,
  updateTutor,
  updateTutorStatus,
};
