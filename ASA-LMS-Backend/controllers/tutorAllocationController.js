const sql = require("mssql");
const { getPool } = require("../config/database");

// =====================================================
// GET TUTOR ALLOCATIONS
// =====================================================

const getTutorAllocation = async (req, res) => {
  try {
    const pool = getPool();

    const status = String(req.query.status || "ACTIVE").toUpperCase();

    let query = `
      SELECT
        u.USER_ID,
        u.USERNAME,
        u.SCHOOL_NAME,
        u.EMAIL_ID,
        u.MOBILE_NO,
        u.IS_ACTIVE,

        ta.ID AS ALLOCATION_ID,
        ta.TUTOR_IDS,
        ta.BATCH_ID,

        b.BATCH_CODE,
        b.BATCH_NAME,
        b.START_DATE,
        b.END_DATE,
        b.IS_ACTIVE AS BATCH_IS_ACTIVE

      FROM USERS u

      LEFT JOIN TUTOR_ALLOCATIONS ta
        ON 1 = 1

      LEFT JOIN BATCHES b
        ON b.ID = ta.BATCH_ID

      WHERE
        u.USER_TYPE = 'TUTOR'
    `;

    // =================================================
    // TUTOR STATUS
    // =================================================

    if (status === "ACTIVE") {
      query += `
        AND u.IS_ACTIVE = 1
      `;
    } else if (status === "INACTIVE") {
      query += `
        AND u.IS_ACTIVE = 0
      `;
    }

    query += `
      ORDER BY
        u.USERNAME ASC,
        b.ID ASC
    `;

    const result = await pool.request().query(query);

    // =================================================
    // CREATE TUTOR MAP
    // =================================================

    const tutors = {};

    result.recordset.forEach((row) => {
      if (!tutors[row.USER_ID]) {
        tutors[row.USER_ID] = {
          USER_ID: row.USER_ID,
          USERNAME: row.USERNAME,
          SCHOOL_NAME: row.SCHOOL_NAME,
          EMAIL_ID: row.EMAIL_ID,
          MOBILE_NO: row.MOBILE_NO,
          IS_ACTIVE: row.IS_ACTIVE,

          assignedBatches: [],
        };
      }

      // =================================================
      // NO BATCH
      // =================================================

      if (!row.BATCH_ID || !row.TUTOR_IDS) {
        return;
      }

      // =================================================
      // PARSE TUTOR IDS
      // =================================================

      let tutorAssignments = [];

      try {
        tutorAssignments = JSON.parse(row.TUTOR_IDS);

        if (!Array.isArray(tutorAssignments)) {
          tutorAssignments = [];
        }
      } catch (error) {
        console.error("Invalid TUTOR_IDS JSON:", row.TUTOR_IDS);

        return;
      }

      // =================================================
      // FIND CURRENT TUTOR
      // =================================================

      const assignment = tutorAssignments.find(
        (item) => Number(item.tutorId) === Number(row.USER_ID),
      );

      if (!assignment) {
        return;
      }

      // =================================================
      // ONLY KEEP ACTIVE BATCH ASSIGNMENTS
      // =================================================

      if (row.BATCH_IS_ACTIVE !== 1 && row.BATCH_IS_ACTIVE !== true) {
        return;
      }

      // =================================================
      // ADD ASSIGNED BATCH
      // =================================================

      tutors[row.USER_ID].assignedBatches.push({
        ID: row.BATCH_ID,

        ALLOCATION_ID: row.ALLOCATION_ID,

        BATCH_CODE: row.BATCH_CODE,

        BATCH_NAME: row.BATCH_NAME,

        START_DATE: row.START_DATE,

        END_DATE: row.END_DATE,

        IS_ACTIVE: row.BATCH_IS_ACTIVE,

        ROLE: Number(assignment.role) === 1 ? 1 : 2,
      });
    });

    return res.json({
      status: 1,
      data: Object.values(tutors),
    });
  } catch (err) {
    console.error("Get Tutor Allocation Error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// GET ACTIVE BATCHES
// =====================================================

const getActiveBatches = async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
        SELECT
          ID,
          BATCH_CODE,
          BATCH_NAME,
          START_DATE,
          END_DATE,
          IS_ACTIVE

        FROM BATCHES

        WHERE IS_ACTIVE = 1

        ORDER BY
          ID ASC
      `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Get Active Batches Error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// ASSIGN / UPDATE TUTORS FOR BATCH
//
// RULES:
// 1. One tutor can be assigned to multiple batches.
// 2. One tutor can HOST multiple batches.
// 3. Each batch can have ONLY ONE HOST.
// 4. SUPPORT can be assigned to multiple batches.
// =====================================================

const assignBatch = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const { tutorIds, batchId, createdBy } = req.body;

    console.log("ASSIGN TUTORS BODY:", req.body);

    // =================================================
    // VALIDATION
    // =================================================

    if (!Array.isArray(tutorIds) || tutorIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "At least one tutor is required",
      });
    }

    if (!batchId) {
      return res.status(400).json({
        status: 0,
        message: "Batch is required",
      });
    }

    const numericBatchId = Number(batchId);

    if (!Number.isInteger(numericBatchId) || numericBatchId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Invalid batch ID",
      });
    }

    // =================================================
    // NORMALIZE TUTORS
    //
    // 1 = HOST
    // 2 = SUPPORT
    // =================================================

    const normalizedTutors = tutorIds
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const tutorId = Number(item.tutorId);
          let role = Number(item.role);

          if (role !== 1 && role !== 2) {
            role = 2;
          }

          return {
            tutorId,
            role,
          };
        }

        return {
          tutorId: Number(item),
          role: 2,
        };
      })
      .filter(
        (item) =>
          Number.isInteger(item.tutorId) &&
          item.tutorId > 0 &&
          (item.role === 1 || item.role === 2)
      );

    // =================================================
    // REMOVE DUPLICATES IN PAYLOAD
    // =================================================

    const tutorMap = new Map();

    normalizedTutors.forEach((item) => {
      if (tutorMap.has(item.tutorId)) {
        const existing = tutorMap.get(item.tutorId);
        // Prefer role 1 (HOST) if either entry specifies HOST role
        const role = existing.role === 1 || item.role === 1 ? 1 : 2;
        tutorMap.set(item.tutorId, { tutorId: item.tutorId, role });
      } else {
        tutorMap.set(item.tutorId, item);
      }
    });

    const uniqueTutors = Array.from(tutorMap.values());

    if (uniqueTutors.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid tutor IDs are required",
      });
    }

    // =================================================
    // ONLY ONE HOST FOR THIS BATCH
    // =================================================

    const hosts = uniqueTutors.filter(
      (item) => Number(item.role) === 1
    );

    if (hosts.length > 1) {
      return res.status(400).json({
        status: 0,
        message: "Only one host can be assigned to a batch",
      });
    }

    // =================================================
    // CHECK BATCH
    // =================================================

    const batchResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, numericBatchId)
      .query(`
        SELECT
          ID,
          BATCH_CODE,
          BATCH_NAME,
          START_DATE,
          END_DATE,
          IS_ACTIVE
        FROM BATCHES
        WHERE
          ID = @BATCH_ID
          AND IS_ACTIVE = 1
      `);

    if (batchResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Active batch not found",
      });
    }

    const batch = batchResult.recordset[0];

    // =================================================
    // CHECK END DATE
    // =================================================

    if (
      batch.END_DATE &&
      new Date(batch.END_DATE) < new Date()
    ) {
      return res.status(400).json({
        status: 0,
        message: "This batch has already ended",
      });
    }

    // =================================================
    // CHECK TUTORS
    // =================================================

    for (const tutor of uniqueTutors) {
      const tutorResult = await pool
        .request()
        .input(
          "TUTOR_ID",
          sql.Int,
          tutor.tutorId
        )
        .query(`
          SELECT
            USER_ID,
            USERNAME,
            IS_ACTIVE
          FROM USERS
          WHERE
            USER_ID = @TUTOR_ID
            AND USER_TYPE = 'TUTOR'
        `);

      if (tutorResult.recordset.length === 0) {
        return res.status(404).json({
          status: 0,
          message: `Tutor ${tutor.tutorId} not found`,
        });
      }

      const tutorData = tutorResult.recordset[0];

      if (
        tutorData.IS_ACTIVE !== 1 &&
        tutorData.IS_ACTIVE !== true
      ) {
        return res.status(400).json({
          status: 0,
          message: `${tutorData.USERNAME} is inactive`,
        });
      }
    }

    // =====================================================
    // GET EXISTING ALLOCATION
    // =====================================================

    const existingResult = await pool
      .request()
      .input(
        "BATCH_ID",
        sql.Int,
        numericBatchId
      )
      .query(`
        SELECT
          ID,
          TUTOR_IDS
        FROM TUTOR_ALLOCATIONS
        WHERE BATCH_ID = @BATCH_ID
      `);

    let allocationId = null;
    let existingTutors = [];

    if (existingResult.recordset.length > 0) {
      allocationId = existingResult.recordset[0].ID;

      try {
        existingTutors = JSON.parse(
          existingResult.recordset[0].TUTOR_IDS || "[]"
        );

        if (!Array.isArray(existingTutors)) {
          existingTutors = [];
        }
      } catch (error) {
        console.error(
          "Invalid existing TUTOR_IDS:",
          error
        );

        existingTutors = [];
      }
    }

    // =====================================================
    // CHECK EXISTING HOST FOR THIS BATCH
    //
    // IMPORTANT:
    // We ONLY check this batch.
    //
    // Same tutor being HOST in another batch is allowed.
    // =====================================================

    const selectedHost =
      uniqueTutors.find(
        (item) => Number(item.role) === 1
      );

    if (selectedHost) {
      const existingHost =
        existingTutors.find(
          (item) =>
            Number(item.role) === 1 &&
            Number(item.tutorId) !==
              Number(selectedHost.tutorId)
        );

      if (existingHost) {
        const hostResult = await pool
          .request()
          .input(
            "TUTOR_ID",
            sql.Int,
            Number(existingHost.tutorId)
          )
          .query(`
            SELECT USERNAME
            FROM USERS
            WHERE USER_ID = @TUTOR_ID
          `);

        const existingHostName =
          hostResult.recordset[0]?.USERNAME ||
          `Tutor ${existingHost.tutorId}`;

        return res.status(400).json({
          status: 0,
          message:
            `This batch already has ${existingHostName} as HOST. ` +
            `Only one HOST is allowed per batch.`,
        });
      }
    } else {
      // =================================================
      // IMPORTANT:
      // If editing an existing batch and the current
      // selection contains NO HOST, that is allowed.
      //
      // This means the batch can temporarily have no HOST.
      // =================================================
    }

    // =================================================
    // GET CHAT ROOM (OR CREATE IF NOT EXISTS)
    // =================================================

    const chatRoomResult = await pool
      .request()
      .input(
        "BATCH_ID",
        sql.Int,
        numericBatchId
      )
      .query(`
        SELECT
          ROOM_ID,
          BATCH_ID,
          ROOM_NAME
        FROM CHAT_ROOMS
        WHERE
          BATCH_ID = @BATCH_ID
          AND IS_ACTIVE = 1
      `);

    let roomId = chatRoomResult.recordset[0]?.ROOM_ID || null;

    // =================================================
    // EXACT CURRENT SELECTION
    // =================================================

    const tutorJson =
      JSON.stringify(uniqueTutors);

    // =================================================
    // START TRANSACTION
    // =================================================

    await transaction.begin();

    // If chat room doesn't exist, create it inside transaction
    if (!roomId) {
      const newRoomResult = await transaction
        .request()
        .input("BATCH_ID", sql.Int, numericBatchId)
        .input(
          "ROOM_NAME",
          sql.NVarChar(200),
          `${batch.BATCH_CODE} - ${batch.BATCH_NAME}`
        )
        .query(`
          INSERT INTO CHAT_ROOMS
          (
            BATCH_ID,
            ROOM_NAME,
            IS_ACTIVE,
            CREATED_AT
          )
          OUTPUT INSERTED.ROOM_ID
          VALUES
          (
            @BATCH_ID,
            @ROOM_NAME,
            1,
            GETDATE()
          )
        `);

      roomId = newRoomResult.recordset[0].ROOM_ID;
    }

    // =================================================
    // INSERT / UPDATE ALLOCATION
    // =================================================

    if (allocationId) {
      await transaction
        .request()
        .input(
          "ID",
          sql.Int,
          allocationId
        )
        .input(
          "TUTOR_IDS",
          sql.NVarChar(sql.MAX),
          tutorJson
        )
        .query(`
          UPDATE TUTOR_ALLOCATIONS
          SET
            TUTOR_IDS = @TUTOR_IDS,
            UPDATED_AT = GETDATE()
          WHERE ID = @ID
        `);

      // Clean up any extra duplicate allocation rows for this BATCH_ID
      if (existingResult.recordset.length > 1) {
        await transaction
          .request()
          .input("BATCH_ID", sql.Int, numericBatchId)
          .input("KEEP_ID", sql.Int, allocationId)
          .query(`
            DELETE FROM TUTOR_ALLOCATIONS
            WHERE BATCH_ID = @BATCH_ID AND ID <> @KEEP_ID
          `);
      }
    } else {
      const insertResult =
        await transaction
          .request()
          .input(
            "TUTOR_IDS",
            sql.NVarChar(sql.MAX),
            tutorJson
          )
          .input(
            "BATCH_ID",
            sql.Int,
            numericBatchId
          )
          .input(
            "CREATED_BY",
            sql.NVarChar(100),
            createdBy || "Admin"
          )
          .query(`
            INSERT INTO TUTOR_ALLOCATIONS
            (
              TUTOR_IDS,
              BATCH_ID,
              CREATED_BY,
              CREATED_AT
            )
            OUTPUT INSERTED.ID
            VALUES
            (
              @TUTOR_IDS,
              @BATCH_ID,
              @CREATED_BY,
              GETDATE()
            )
          `);

      allocationId =
        insertResult.recordset[0].ID;
    }

    // =================================================
    // GET CURRENT CHAT MEMBERS
    // =================================================

    const currentMembersResult =
      await transaction
        .request()
        .input(
          "ROOM_ID",
          sql.Int,
          roomId
        )
        .query(`
          SELECT USER_ID
          FROM CHAT_ROOM_MEMBERS
          WHERE
            ROOM_ID = @ROOM_ID
            AND MEMBER_TYPE = 'TUTOR'
        `);

    const currentTutorIds =
      currentMembersResult.recordset.map(
        (item) => Number(item.USER_ID)
      );

    const selectedTutorIds =
      uniqueTutors.map(
        (item) => Number(item.tutorId)
      );

    // =================================================
    // REMOVE TUTORS NOT SELECTED
    // =================================================

    const tutorsToRemove =
      currentTutorIds.filter(
        (id) =>
          !selectedTutorIds.includes(id)
      );

    for (const tutorId of tutorsToRemove) {
      await transaction
        .request()
        .input(
          "ROOM_ID",
          sql.Int,
          roomId
        )
        .input(
          "USER_ID",
          sql.Int,
          tutorId
        )
        .query(`
          DELETE FROM CHAT_ROOM_MEMBERS
          WHERE
            ROOM_ID = @ROOM_ID
            AND USER_ID = @USER_ID
            AND MEMBER_TYPE = 'TUTOR'
        `);
    }

    // =================================================
    // ADD / RESTORE ALL SELECTED TUTORS IN CHAT_ROOM_MEMBERS
    // =================================================

    for (const tutor of uniqueTutors) {
      await transaction
        .request()
        .input(
          "ROOM_ID",
          sql.Int,
          roomId
        )
        .input(
          "USER_ID",
          sql.Int,
          tutor.tutorId
        )
        .query(`
          IF NOT EXISTS
          (
            SELECT 1
            FROM CHAT_ROOM_MEMBERS
            WHERE
              ROOM_ID = @ROOM_ID
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
              'TUTOR',
              GETDATE(),
              1
            )

          END
          ELSE
          BEGIN

            UPDATE CHAT_ROOM_MEMBERS
            SET
              IS_ACTIVE = 1,
              MEMBER_TYPE = 'TUTOR'
            WHERE
              ROOM_ID = @ROOM_ID
              AND USER_ID = @USER_ID

          END
        `);
    }

    // =================================================
    // COMMIT
    // =================================================

    await transaction.commit();

    return res.json({
      status: 1,
      message: "Tutors assigned successfully",
      batchId: numericBatchId,
      allocationId,
      tutors: uniqueTutors,
      roomId,
    });

  } catch (err) {
    console.error(
      "assignBatch error:",
      err
    );

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError
      );
    }

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE TUTOR ROLE FOR A BATCH
//
// role:
// 1 = HOST
// 2 = SUPPORT
//
// RULES:
// - Tutor can be HOST in multiple batches.
// - Tutor can be SUPPORT in multiple batches.
// - Each batch can have only ONE HOST.
// =====================================================

const updateTutorRole = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const {
      batchId,
      tutorId,
      role,
    } = req.body;

    const numericBatchId =
      Number(batchId);

    const numericTutorId =
      Number(tutorId);

    const numericRole =
      Number(role);

    // =================================================
    // VALIDATION
    // =================================================

    if (
      !Number.isInteger(numericBatchId) ||
      numericBatchId <= 0 ||
      !Number.isInteger(numericTutorId) ||
      numericTutorId <= 0 ||
      ![1, 2].includes(numericRole)
    ) {
      return res.status(400).json({
        status: 0,
        message: "Invalid request",
      });
    }

    // =================================================
    // CHECK BATCH
    // =================================================

    const batchResult =
      await pool
        .request()
        .input(
          "BATCH_ID",
          sql.Int,
          numericBatchId
        )
        .query(`
          SELECT
            ID,
            BATCH_CODE,
            BATCH_NAME,
            IS_ACTIVE
          FROM BATCHES
          WHERE
            ID = @BATCH_ID
            AND IS_ACTIVE = 1
        `);

    if (
      batchResult.recordset.length === 0
    ) {
      return res.status(404).json({
        status: 0,
        message: "Batch not found",
      });
    }

    // =================================================
    // CHECK TUTOR
    // =================================================

    const tutorResult =
      await pool
        .request()
        .input(
          "TUTOR_ID",
          sql.Int,
          numericTutorId
        )
        .query(`
          SELECT
            USER_ID,
            USERNAME,
            IS_ACTIVE
          FROM USERS
          WHERE
            USER_ID = @TUTOR_ID
            AND USER_TYPE = 'TUTOR'
        `);

    if (
      tutorResult.recordset.length === 0
    ) {
      return res.status(404).json({
        status: 0,
        message: "Tutor not found",
      });
    }

    const tutor =
      tutorResult.recordset[0];

    if (
      tutor.IS_ACTIVE !== 1 &&
      tutor.IS_ACTIVE !== true
    ) {
      return res.status(400).json({
        status: 0,
        message: `${tutor.USERNAME} is inactive`,
      });
    }

    // =================================================
    // GET CURRENT BATCH ALLOCATION
    // =================================================

    const allocationResult =
      await pool
        .request()
        .input(
          "BATCH_ID",
          sql.Int,
          numericBatchId
        )
        .query(`
          SELECT
            ID,
            TUTOR_IDS
          FROM TUTOR_ALLOCATIONS
          WHERE
            BATCH_ID = @BATCH_ID
        `);

    let allocationId = null;
    let tutors = [];

    if (
      allocationResult.recordset.length > 0
    ) {
      allocationId =
        allocationResult.recordset[0].ID;

      try {
        tutors = JSON.parse(
          allocationResult.recordset[0]
            .TUTOR_IDS || "[]"
        );

        if (!Array.isArray(tutors)) {
          tutors = [];
        }
      } catch (error) {
        tutors = [];
      }
    }

    // =================================================
    // FIND CURRENT TUTOR
    // =================================================

    const currentTutorIndex =
      tutors.findIndex(
        (item) =>
          Number(item.tutorId) ===
          numericTutorId
      );

    // =================================================
    // HOST VALIDATION
    //
    // ONLY CHECK THE CURRENT BATCH
    //
    // Another batch having the same tutor as HOST
    // is completely valid.
    // =================================================

    if (numericRole === 1) {
      const currentHost =
        tutors.find(
          (item) =>
            Number(item.role) === 1 &&
            Number(item.tutorId) !==
              numericTutorId
        );

      if (currentHost) {
        const hostResult =
          await pool
            .request()
            .input(
              "TUTOR_ID",
              sql.Int,
              Number(
                currentHost.tutorId
              )
            )
            .query(`
              SELECT USERNAME
              FROM USERS
              WHERE USER_ID = @TUTOR_ID
            `);

        const hostName =
          hostResult.recordset[0]
            ?.USERNAME ||
          `Tutor ${currentHost.tutorId}`;

        return res.status(400).json({
          status: 0,
          message:
            `${hostName} is already HOST for this batch. ` +
            `Only one HOST is allowed per batch.`,
        });
      }
    }

    // =================================================
    // ADD / UPDATE ROLE
    // =================================================

    if (currentTutorIndex === -1) {
      tutors.push({
        tutorId: numericTutorId,
        role: numericRole,
      });
    } else {
      tutors[currentTutorIndex].role =
        numericRole;
    }

    // =================================================
    // SAVE
    // =================================================

    const tutorJson =
      JSON.stringify(tutors);

    await transaction.begin();

    if (allocationId) {
      await transaction
        .request()
        .input(
          "ID",
          sql.Int,
          allocationId
        )
        .input(
          "TUTOR_IDS",
          sql.NVarChar(sql.MAX),
          tutorJson
        )
        .query(`
          UPDATE TUTOR_ALLOCATIONS
          SET
            TUTOR_IDS = @TUTOR_IDS,
            UPDATED_AT = GETDATE()
          WHERE
            ID = @ID
        `);
    } else {
      await transaction
        .request()
        .input(
          "BATCH_ID",
          sql.Int,
          numericBatchId
        )
        .input(
          "TUTOR_IDS",
          sql.NVarChar(sql.MAX),
          tutorJson
        )
        .input(
          "CREATED_BY",
          sql.NVarChar(100),
          "Admin"
        )
        .query(`
          INSERT INTO TUTOR_ALLOCATIONS
          (
            BATCH_ID,
            TUTOR_IDS,
            CREATED_BY,
            CREATED_AT
          )
          VALUES
          (
            @BATCH_ID,
            @TUTOR_IDS,
            @CREATED_BY,
            GETDATE()
          )
        `);
    }

    // =================================================
    // ENSURE CHAT ROOM MEMBER EXISTS
    // =================================================

    const chatRoomResult = await transaction
      .request()
      .input("BATCH_ID", sql.Int, numericBatchId)
      .query(`
        SELECT ROOM_ID
        FROM CHAT_ROOMS
        WHERE BATCH_ID = @BATCH_ID AND IS_ACTIVE = 1
      `);

    if (chatRoomResult.recordset.length > 0) {
      const roomId = chatRoomResult.recordset[0].ROOM_ID;
      await transaction
        .request()
        .input("ROOM_ID", sql.Int, roomId)
        .input("USER_ID", sql.Int, numericTutorId)
        .query(`
          IF NOT EXISTS
          (
            SELECT 1
            FROM CHAT_ROOM_MEMBERS
            WHERE ROOM_ID = @ROOM_ID AND USER_ID = @USER_ID
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
              'TUTOR',
              GETDATE(),
              1
            )
          END
          ELSE
          BEGIN
            UPDATE CHAT_ROOM_MEMBERS
            SET
              IS_ACTIVE = 1,
              MEMBER_TYPE = 'TUTOR'
            WHERE ROOM_ID = @ROOM_ID AND USER_ID = @USER_ID
          END
        `);
    }

    await transaction.commit();

    return res.json({
      status: 1,
      message:
        numericRole === 1
          ? "Tutor changed to HOST successfully"
          : "Tutor changed to SUPPORT successfully",
    });

  } catch (err) {
    console.error(
      "updateTutorRole error:",
      err
    );

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError
      );
    }

    return res.status(500).json({
      status: 0,
      message:
        err.message ||
        "Failed to update tutor role",
    });
  }
};

// =====================================================
// DELETE / REMOVE TUTOR FROM BATCH
// =====================================================

const deleteTutorAllocation = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const { batchId, tutorId } = req.body;

    if (!batchId || !tutorId) {
      return res.status(400).json({
        status: 0,
        message: "Batch ID and Tutor ID are required",
      });
    }

    const numericBatchId = Number(batchId);

    const numericTutorId = Number(tutorId);

    if (
      !Number.isInteger(numericBatchId) ||
      !Number.isInteger(numericTutorId)
    ) {
      return res.status(400).json({
        status: 0,
        message: "Invalid batch ID or tutor ID",
      });
    }

    // =================================================
    // GET ALLOCATION
    // =================================================

    const result = await pool
      .request()
      .input("BATCH_ID", sql.Int, numericBatchId).query(`
          SELECT
            ID,
            TUTOR_IDS

          FROM TUTOR_ALLOCATIONS

          WHERE
            BATCH_ID = @BATCH_ID
        `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Tutor allocation not found",
      });
    }

    const allocation = result.recordset[0];

    let tutors = [];

    try {
      tutors = JSON.parse(allocation.TUTOR_IDS);

      if (!Array.isArray(tutors)) {
        tutors = [];
      }
    } catch (error) {
      tutors = [];
    }

    // =================================================
    // REMOVE TUTOR
    // =================================================

    tutors = tutors.filter((item) => Number(item.tutorId) !== numericTutorId);

    await transaction.begin();

    // =================================================
    // UPDATE / DELETE ALLOCATION
    // =================================================

    if (tutors.length === 0) {
      await transaction.request().input("ID", sql.Int, allocation.ID).query(`
          DELETE FROM TUTOR_ALLOCATIONS

          WHERE
            ID = @ID
        `);
    } else {
      await transaction
        .request()
        .input("ID", sql.Int, allocation.ID)
        .input("TUTOR_IDS", sql.NVarChar(sql.MAX), JSON.stringify(tutors))
        .query(`
          UPDATE TUTOR_ALLOCATIONS

          SET
            TUTOR_IDS = @TUTOR_IDS,
            UPDATED_AT = GETDATE()

          WHERE
            ID = @ID
        `);
    }

    // =================================================
    // REMOVE CHAT MEMBER
    // =================================================

    const chatRoomResult = await transaction
      .request()
      .input("BATCH_ID", sql.Int, numericBatchId).query(`
          SELECT
            ROOM_ID

          FROM CHAT_ROOMS

          WHERE
            BATCH_ID = @BATCH_ID
        `);

    if (chatRoomResult.recordset.length > 0) {
      const roomId = chatRoomResult.recordset[0].ROOM_ID;

      await transaction
        .request()
        .input("ROOM_ID", sql.Int, roomId)
        .input("USER_ID", sql.Int, numericTutorId).query(`
          DELETE FROM CHAT_ROOM_MEMBERS

          WHERE
            ROOM_ID = @ROOM_ID
            AND USER_ID = @USER_ID
            AND MEMBER_TYPE = 'TUTOR'
        `);
    }

    await transaction.commit();

    return res.json({
      status: 1,
      message: "Tutor removed from batch successfully",
    });
  } catch (err) {
    console.error("deleteTutorAllocation error:", err);

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  getTutorAllocation,
  getActiveBatches,
  assignBatch,
  updateTutorRole,
  deleteTutorAllocation,
};
