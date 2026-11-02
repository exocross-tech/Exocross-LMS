const { getPool, sql } = require("../config/database");
const bcrypt = require("bcrypt");
const { lmsLoginSchema } = require("../validators/loginValidator");

// =====================================================
// LMS LOGIN
// =====================================================

const login = async (req, res) => {
  try {
    // =================================================
    // 1. VALIDATE REQUEST
    // =================================================

    const { error } = lmsLoginSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        status: 0,
        errors: error.details.map((e) => e.message),
      });
    }

    // =================================================
    // 2. GET LOGIN INPUT
    // =================================================

    const usernameInput = (
      req.body.USERNAME ||
      req.body.USER_NAME ||
      ""
    ).trim();

    const passwordInput = req.body.PASSWORD;

    if (!usernameInput || !passwordInput) {
      return res.status(400).json({
        status: 0,
        message:
          "Username, email, mobile number or roll number and password are required",
      });
    }

    // =================================================
    // 3. GET DATABASE POOL
    // =================================================

    const pool = await getPool();

    // =================================================
    // 4. FIND USER (Parameterized, non-blocking)
    // =================================================

    console.log("🔎 Login DB query started for user identifier:", usernameInput);

    const userRequest = pool.request();
    userRequest.input("USERNAME_INPUT", sql.NVarChar(255), usernameInput);

    const userResult = await userRequest.query(`
      SELECT TOP 1 *
      FROM USERS WITH (NOLOCK)
      WHERE
        (
          MOBILE_NO = @USERNAME_INPUT
          AND MOBILE_NO IS NOT NULL
          AND MOBILE_NO != ''
        )
        OR
        (
          EMAIL_ID = @USERNAME_INPUT
          AND EMAIL_ID IS NOT NULL
          AND EMAIL_ID != ''
        )
        OR
        (
          USERNAME = @USERNAME_INPUT
          AND USERNAME IS NOT NULL
          AND USERNAME != ''
        )
        OR
        (
          ROLL_NO = @USERNAME_INPUT
          AND ROLL_NO IS NOT NULL
          AND ROLL_NO != ''
        )
      ORDER BY USER_ID
    `);

    console.log("✅ Login DB query completed");

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return res.status(200).json({
        status: 0,
        message: "Invalid username, email, mobile number or roll number",
      });
    }

    const user = userResult.recordset[0];

    // =================================================
    // 5. CHECK ACTIVE USER
    // =================================================

    const isActive =
      user.IS_ACTIVE === true ||
      user.IS_ACTIVE === 1 ||
      user.IS_ACTIVE === "1" ||
      user.IS_ACTIVE === "true";

    if (!isActive) {
      return res.status(200).json({
        status: 0,
        message: "Given user account is inactive. Contact admin",
      });
    }

    // =================================================
    // 6. CHECK PASSWORD (PRIMARY & ALTERNATIVE PASSWORD SUPPORT)
    // =================================================

    let isPasswordValid = false;
    const userType = String(user.USER_TYPE || "").toUpperCase();
    const enteredPass = String(passwordInput || "").trim();

    if (userType === "STUDENT") {
      // 1. Check Student custom/primary password if set
      if (user.PASSWORD) {
        try {
          isPasswordValid = await bcrypt.compare(
            String(passwordInput),
            String(user.PASSWORD)
          );
        } catch (_) {}

        if (!isPasswordValid) {
          isPasswordValid = String(passwordInput) === String(user.PASSWORD);
        }
      }

      // 2. Fallback check: default password is student's registered Phone/Mobile number
      if (!isPasswordValid) {
        const registeredPhone = String(user.MOBILE_NO || "").trim();
        if (registeredPhone && enteredPass === registeredPhone) {
          isPasswordValid = true;
        }
      }
    } else {
      // For Admin, Tutor, etc.: standard primary password validation
      if (user.PASSWORD) {
        try {
          isPasswordValid = await bcrypt.compare(
            String(passwordInput),
            String(user.PASSWORD)
          );
        } catch (_) {}

        if (!isPasswordValid) {
          isPasswordValid = String(passwordInput) === String(user.PASSWORD);
        }
      }
    }

    if (!isPasswordValid) {
      return res.status(200).json({
        status: 0,
        message: "Password is wrong",
      });
    }

    // =================================================
    // 7. ASSIGNED BATCH & ROOM VARIABLES
    // =================================================

    let assignedBatch = null;
    let assignedBatches = [];
    let assignedRoomId = null;

    // =================================================
    // 8. STUDENT BATCH & ROOM
    // =================================================

    if (String(user.USER_TYPE).toUpperCase() === "STUDENT") {
      const batchRequest = pool.request();
      batchRequest.input("STUDENT_ID", sql.Int, user.USER_ID);

      const batchResult = await batchRequest.query(`
        SELECT TOP 1
          sa.STUDENT_ID,
          sa.BATCH_ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE
        FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
        INNER JOIN BATCHES b WITH (NOLOCK)
          ON b.ID = sa.BATCH_ID
        WHERE
          sa.STUDENT_ID = @STUDENT_ID
        ORDER BY
          sa.CREATED_AT DESC
      `);

      if (batchResult.recordset.length > 0) {
        assignedBatch = batchResult.recordset[0];
      }

      // Fetch assigned ROOM_ID from CHAT_ROOM_MEMBERS
      const roomRequest = pool.request();
      roomRequest.input("USER_ID", sql.Int, user.USER_ID);

      const roomResult = await roomRequest.query(`
        SELECT TOP 1 ROOM_ID
        FROM CHAT_ROOM_MEMBERS WITH (NOLOCK)
        WHERE USER_ID = @USER_ID
          AND IS_ACTIVE = 1
        ORDER BY ID DESC
      `);

      if (roomResult.recordset.length > 0) {
        assignedRoomId = roomResult.recordset[0].ROOM_ID;
      } else if (assignedBatch && assignedBatch.BATCH_ID) {
        const batchRoomReq = pool.request();
        batchRoomReq.input("BATCH_ID", sql.Int, assignedBatch.BATCH_ID);
        const batchRoomRes = await batchRoomReq.query(`
          SELECT TOP 1 ROOM_ID
          FROM CHAT_ROOMS WITH (NOLOCK)
          WHERE BATCH_ID = @BATCH_ID
            AND IS_ACTIVE = 1
        `);
        if (batchRoomRes.recordset.length > 0) {
          assignedRoomId = batchRoomRes.recordset[0].ROOM_ID;
        }
      }

      if (assignedBatch && assignedRoomId) {
        assignedBatch.ROOM_ID = assignedRoomId;
      }
    }

    // =================================================
    // 9. TUTOR BATCHES
    // =================================================
    else if (String(user.USER_TYPE).toUpperCase() === "TUTOR") {
      const tutorRequest = pool.request();

      const tutorBatchResult = await tutorRequest.query(`
        SELECT
          ta.ID AS ALLOCATION_ID,
          ta.BATCH_ID,
          ta.TUTOR_IDS,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE AS BATCH_IS_ACTIVE
        FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
        INNER JOIN BATCHES b WITH (NOLOCK)
          ON b.ID = ta.BATCH_ID
        WHERE
          b.IS_ACTIVE = 1
      `);

      for (const allocation of tutorBatchResult.recordset) {
        let tutorAssignments = [];

        try {
          tutorAssignments = JSON.parse(allocation.TUTOR_IDS || "[]");
          if (!Array.isArray(tutorAssignments)) {
            tutorAssignments = [];
          }
        } catch (error) {
          console.error("Invalid TUTOR_IDS JSON:", allocation.TUTOR_IDS);
          continue;
        }

        const tutorAssignment = tutorAssignments.find(
          (item) => Number(item.tutorId) === Number(user.USER_ID)
        );

        if (!tutorAssignment) {
          continue;
        }

        let tutorRole = Number(tutorAssignment.role);

        if (
          tutorAssignment.role === "HOST" ||
          tutorAssignment.role === "host"
        ) {
          tutorRole = 1;
        }

        if (
          tutorAssignment.role === "SUPPORT" ||
          tutorAssignment.role === "support"
        ) {
          tutorRole = 2;
        }

        if (tutorRole !== 1 && tutorRole !== 2) {
          console.warn(
            `Invalid tutor role for tutor ${user.USER_ID} in batch ${allocation.BATCH_ID}:`,
            tutorAssignment.role
          );
          continue;
        }

        const tutorRoleName = tutorRole === 1 ? "HOST" : "SUPPORT";

        assignedBatches.push({
          ALLOCATION_ID: allocation.ALLOCATION_ID,
          BATCH_ID: allocation.BATCH_ID,
          BATCH_CODE: allocation.BATCH_CODE,
          BATCH_NAME: allocation.BATCH_NAME,
          START_DATE: allocation.START_DATE,
          END_DATE: allocation.END_DATE,
          IS_ACTIVE: allocation.BATCH_IS_ACTIVE,
          TUTOR_ROLE: tutorRole,
          TUTOR_ROLE_NAME: tutorRoleName,
        });
      }

      assignedBatches.sort(
        (a, b) => Number(a.BATCH_ID) - Number(b.BATCH_ID)
      );

      if (assignedBatches.length > 0) {
        assignedBatch = assignedBatches[0];
      }
    }

    // =================================================
    // 10. UPDATE LAST LOGIN TIMESTAMP
    // =================================================

    try {
      const updateLoginReq = pool.request();
      updateLoginReq.input("USER_ID", sql.Int, user.USER_ID);
      await updateLoginReq.query(`
        UPDATE USERS
        SET LAST_LOGIN = GETDATE()
        WHERE USER_ID = @USER_ID
      `);
    } catch (updateErr) {
      console.error("⚠️ Failed to update LAST_LOGIN for user:", user.USER_ID, updateErr);
    }

    // =================================================
    // 11. RECORD LOGIN ACTIVITY LOG
    // =================================================

    try {
      const logRequest = pool.request();
      logRequest.input("USER_ID", sql.Int, user.USER_ID);
      logRequest.input("USER_TYPE", sql.NVarChar(50), user.USER_TYPE || null);
      await logRequest.query(`
        INSERT INTO dbo.USER_ACTIVITY_LOGS (
          USER_ID,
          USER_TYPE,
          ACTIVITY_TYPE,
          ACTIVITY_DATE
        )
        VALUES (
          @USER_ID,
          @USER_TYPE,
          'LOGIN',
          GETDATE()
        )
      `);
    } catch (logErr) {
      console.error("⚠️ Failed to log user activity for user:", user.USER_ID, logErr);
    }

    // =================================================
    // 12. LOGIN SUCCESSFUL
    // =================================================

    return res.status(200).json({
      status: 1,
      message: "Login successful",
      data: {
        USER_ID: user.USER_ID,
        USERNAME: user.USERNAME,
        USER_TYPE: user.USER_TYPE,
        ROLL_NO: user.ROLL_NO,
        MOBILE_NO: user.MOBILE_NO,
        EMAIL_ID: user.EMAIL_ID,
        SCHOOL_NAME: user.SCHOOL_NAME,
        ADDRESS_LINE1: user.ADDRESS_LINE1,
        ADDRESS_LINE2: user.ADDRESS_LINE2,
        CITY: user.CITY,
        DISTRICT: user.DISTRICT,
        STATE: user.STATE,
        PINCODE: user.PINCODE,
        LANDMARK: user.LANDMARK,
        ROOM_ID: assignedRoomId,
        ASSIGNED_BATCH: assignedBatch,
        ASSIGNED_BATCHES:
          String(user.USER_TYPE).toUpperCase() === "TUTOR"
            ? assignedBatches
            : [],
      },
    });
  } catch (err) {
    console.error("=================================");
    console.error("❌ LMS Login error:", err);
    console.error("=================================");

    return res.status(500).json({
      status: 0,
      message: "Internal server error during login",
      error: err.message,
    });
  }
};

// =====================================================
// LOG ACTIVITY
// =====================================================

const logActivity = async (req, res) => {
  try {
    const { USER_ID, ACTIVITY_TYPE, BOOK_ID, USER_TYPE } = req.body;

    if (!USER_ID || !ACTIVITY_TYPE) {
      return res.status(400).json({
        status: 0,
        message: "USER_ID and ACTIVITY_TYPE are required",
      });
    }

    const pool = await getPool();

    // Fetch user data to get SCHOOL_ID
    const userRequest = pool.request();
    userRequest.input("USER_ID", sql.Int, Number(USER_ID));

    const userResult = await userRequest.query(`
      SELECT SCHOOL_ID, USER_TYPE 
      FROM USERS WITH (NOLOCK)
      WHERE USER_ID = @USER_ID
    `);

    if (!userResult.recordset || !userResult.recordset.length) {
      return res.status(200).json({ status: 0, message: "User not found" });
    }

    const user = userResult.recordset[0];
    const schoolId = user.SCHOOL_ID || 0;
    const type = String(USER_TYPE || user.USER_TYPE || "").toUpperCase();
    const bookId = BOOK_ID || 0;

    const activityRequest = pool.request();
    activityRequest
      .input("USER_ID", sql.Int, Number(USER_ID))
      .input("USER_TYPE", sql.NVarChar(50), type)
      .input("SCHOOL_ID", sql.Int, schoolId)
      .input("BOOK_ID", sql.Int, Number(bookId))
      .input("ACTIVITY_TYPE", sql.NVarChar(100), ACTIVITY_TYPE);

    await activityRequest.query(`
      INSERT INTO USER_ACTIVITY_LOGS (USER_ID, USER_TYPE, SCHOOL_ID, BOOK_ID, ACTIVITY_TYPE, ACTIVITY_DATE, CREATED_AT)
      VALUES (@USER_ID, @USER_TYPE, @SCHOOL_ID, @BOOK_ID, @ACTIVITY_TYPE, GETDATE(), GETDATE())
    `);

    return res.status(200).json({
      status: 1,
      message: "Activity logged successfully",
    });
  } catch (err) {
    console.error("❌ Log activity error:", err);
    return res.status(500).json({ status: 0, error: err.message });
  }
};

module.exports = { login, logActivity };
