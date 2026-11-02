const { getPool } = require("../config/database");
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const multer = require("multer");
const sql = require("mssql");
const axios = require("axios");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// =====================================================
// GENERATE STUDENT ROLL NUMBER
// FORMAT: AICP-26-01
// =====================================================

const generateStudentRollNo = async (pool) => {
  const currentYear = new Date().getFullYear();

  // 2026 -> 26
  const yearCode = String(currentYear).slice(-2);

  const pattern = `%-AICP-${yearCode}`;

  const result = await pool
    .request()
    .input("PATTERN", sql.NVarChar(20), pattern).query(`
      SELECT TOP 1 ROLL_NO
      FROM USERS
      WHERE USER_TYPE = 'STUDENT'
        AND ROLL_NO LIKE @PATTERN
      ORDER BY
        TRY_CONVERT(
          INT,
          LEFT(
            ROLL_NO,
            CHARINDEX('-', ROLL_NO) - 1
          )
        ) DESC
    `);

  let nextNumber = 1;

  if (result.recordset.length > 0) {
    const lastRollNo = result.recordset[0].ROLL_NO;

    const parts = lastRollNo.split("-");

    const lastNumber = parseInt(parts[0], 10);

    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  const sequence = String(nextNumber).padStart(2, "0");

  return `${sequence}-AICP-${yearCode}`;
};

// =====================================================
// GET ALL USERS
// =====================================================

const getUsers = async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT *
      FROM USERS
      ORDER BY USER_ID DESC
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("getUsers error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// GET TUTORS
// =====================================================

const getTutors = async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT *
      FROM USERS
      WHERE USER_TYPE = 'TUTOR'
      ORDER BY USER_ID DESC
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("getTutors error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// GET STUDENTS
// =====================================================

const getStudents = async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.request().query(`
      SELECT *
      FROM USERS
      WHERE USER_TYPE = 'STUDENT'
      ORDER BY USER_ID DESC
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("getStudents error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// ADD USER
// ADMIN / TUTOR / STUDENT
// =====================================================

const addUser = async (req, res) => {
  try {
    const {
      SCHOOL_NAME,
      USERNAME,
      EMAIL_ID,
      MOBILE_NO,
      ADDRESS_LINE1,
      ADDRESS_LINE2,
      CITY,
      DISTRICT,
      STATE,
      PINCODE,
      LANDMARK,
      GRADE,
      PASSWORD,
      USER_TYPE,
    } = req.body;

    // =================================================
    // VALIDATION
    // =================================================

    const isStudent = String(USER_TYPE || "").toUpperCase() === "STUDENT";

    if (!USERNAME || !EMAIL_ID || !MOBILE_NO || !USER_TYPE) {
      return res.status(400).json({
        status: 0,
        message: "Please fill all required fields",
      });
    }

    if (!isStudent && !PASSWORD) {
      return res.status(400).json({
        status: 0,
        message: "Password is required",
      });
    }

    if (isStudent && (!SCHOOL_NAME || !String(SCHOOL_NAME).trim())) {
      return res.status(400).json({
        status: 0,
        message: "School Name is required",
      });
    }

    const pool = getPool();

    // =================================================
    // CHECK EMAIL / MOBILE DUPLICATE FOR TUTOR AND ADMIN ONLY
    // =================================================

    const userTypeUpper = String(USER_TYPE || "").toUpperCase();

    if (userTypeUpper === "TUTOR" || userTypeUpper === "ADMIN") {
      const trimmedEmail = String(EMAIL_ID || "").trim().toLowerCase();
      const trimmedMobile = String(MOBILE_NO || "").trim();

      const existingUsers = await pool
        .request()
        .input("EMAIL_ID", sql.NVarChar(300), trimmedEmail)
        .input("MOBILE_NO", sql.NVarChar(30), trimmedMobile).query(`
          SELECT USER_ID, EMAIL_ID, MOBILE_NO
          FROM USERS WITH (NOLOCK)
          WHERE (
            LOWER(LTRIM(RTRIM(EMAIL_ID))) = @EMAIL_ID
            OR LTRIM(RTRIM(MOBILE_NO)) = @MOBILE_NO
          )
        `);

      if (existingUsers.recordset.length > 0) {
        const isEmailTaken = existingUsers.recordset.some(
          (u) => u.EMAIL_ID && u.EMAIL_ID.trim().toLowerCase() === trimmedEmail
        );
        const isMobileTaken = existingUsers.recordset.some(
          (u) => u.MOBILE_NO && String(u.MOBILE_NO).trim() === trimmedMobile
        );

        if (isEmailTaken && isMobileTaken) {
          return res.status(400).json({
            status: 0,
            message: "This email ID and phone number are already used",
          });
        }

        if (isEmailTaken) {
          return res.status(400).json({
            status: 0,
            message: "This email ID is already used",
          });
        }

        if (isMobileTaken) {
          return res.status(400).json({
            status: 0,
            message: "This phone number is already used",
          });
        }
      }
    }

    // =================================================
    // GENERATE ROLL NUMBER ONLY FOR STUDENT
    // =================================================

    let rollNo = null;

    if (String(USER_TYPE).toUpperCase() === "STUDENT") {
      rollNo = await generateStudentRollNo(pool);

      console.log("Generated Student Roll No:", rollNo);
    }

    // =================================================
    // INSERT USER
    // =================================================

    const savedPassword = isStudent ? (PASSWORD || MOBILE_NO) : PASSWORD;

    await pool
      .request()
      .input("SCHOOL_NAME", sql.NVarChar(300), SCHOOL_NAME || "")
      .input("USERNAME", sql.NVarChar(200), USERNAME)
      .input("EMAIL_ID", sql.NVarChar(300), EMAIL_ID)
      .input("MOBILE_NO", sql.NVarChar(30), MOBILE_NO)
      .input("ADDRESS_LINE1", sql.NVarChar(400), ADDRESS_LINE1 || "")
      .input("ADDRESS_LINE2", sql.NVarChar(400), ADDRESS_LINE2 || "")
      .input("CITY", sql.NVarChar(200), CITY || "")
      .input("DISTRICT", sql.NVarChar(200), DISTRICT || "")
      .input("STATE", sql.NVarChar(200), STATE || "")
      .input("PINCODE", sql.NVarChar(20), PINCODE || "")
      .input("LANDMARK", sql.NVarChar(300), LANDMARK || "")
      .input("GRADE", sql.Int, GRADE ? Number(GRADE) : null)
      .input("PASSWORD", sql.NVarChar(500), savedPassword)
      .input("USER_TYPE", sql.NVarChar(50), USER_TYPE)
      .input("ROLL_NO", sql.NVarChar(20), rollNo).query(`
        INSERT INTO USERS
        (
          SCHOOL_NAME,
          USERNAME,
          EMAIL_ID,
          MOBILE_NO,
          ADDRESS_LINE1,
          ADDRESS_LINE2,
          CITY,
          DISTRICT,
          STATE,
          PINCODE,
          LANDMARK,
          GRADE,
          PASSWORD,
          USER_TYPE,
          ROLL_NO,
          IS_ACTIVE
        )
        VALUES
        (
          @SCHOOL_NAME,
          @USERNAME,
          @EMAIL_ID,
          @MOBILE_NO,
          @ADDRESS_LINE1,
          @ADDRESS_LINE2,
          @CITY,
          @DISTRICT,
          @STATE,
          @PINCODE,
          @LANDMARK,
          @GRADE,
          @PASSWORD,
          @USER_TYPE,
          @ROLL_NO,
          1
        )
      `);

    // =================================================
    // RESPONSE
    // =================================================

    return res.json({
      status: 1,
      message: "User Added Successfully",
      data: {
        USERNAME,
        USER_TYPE,
        ROLL_NO: rollNo,
      },
    });
  } catch (err) {
    console.error("Add User Error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE USER
// =====================================================

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(id);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid User ID",
      });
    }

    const {
      SCHOOL_NAME,
      USERNAME,
      EMAIL_ID,
      MOBILE_NO,
      ADDRESS_LINE1,
      ADDRESS_LINE2,
      CITY,
      DISTRICT,
      STATE,
      PINCODE,
      LANDMARK,
      GRADE,
      USER_TYPE,
    } = req.body;

    const trimmedEmail = EMAIL_ID ? String(EMAIL_ID).trim() : "";
    const trimmedMobile = MOBILE_NO ? String(MOBILE_NO).trim() : "";

    const pool = getPool();

    // =================================================
    // CHECK IF TARGET USER EXISTS
    // =================================================

    const userCheck = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, EMAIL_ID, MOBILE_NO, USER_TYPE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    const effectiveUserType = USER_TYPE || userCheck.recordset[0].USER_TYPE || "STUDENT";
    if (String(effectiveUserType).toUpperCase() === "STUDENT" && (!SCHOOL_NAME || !String(SCHOOL_NAME).trim())) {
      return res.status(400).json({
        status: 0,
        message: "School Name is required",
      });
    }

    // =================================================
    // CHECK DUPLICATE EMAIL / MOBILE (EXCLUDING CURRENT USER)
    // =================================================

    if (trimmedEmail || trimmedMobile) {
      const existingUsers = await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .input("EMAIL_ID", sql.NVarChar(300), trimmedEmail || null)
        .input("MOBILE_NO", sql.NVarChar(30), trimmedMobile || null).query(`
          SELECT USER_ID, EMAIL_ID, MOBILE_NO
          FROM USERS WITH (NOLOCK)
          WHERE
            USER_ID <> @USER_ID
            AND (
              (NULLIF(@EMAIL_ID, '') IS NOT NULL AND LOWER(LTRIM(RTRIM(EMAIL_ID))) = LOWER(@EMAIL_ID))
              OR
              (NULLIF(@MOBILE_NO, '') IS NOT NULL AND LTRIM(RTRIM(MOBILE_NO)) = @MOBILE_NO)
            )
        `);

      if (existingUsers.recordset.length > 0) {
        const isEmailTaken = trimmedEmail && existingUsers.recordset.some(
          (u) => u.EMAIL_ID && u.EMAIL_ID.trim().toLowerCase() === trimmedEmail.toLowerCase()
        );
        const isMobileTaken = trimmedMobile && existingUsers.recordset.some(
          (u) => u.MOBILE_NO && String(u.MOBILE_NO).trim() === trimmedMobile
        );

        if (isEmailTaken && isMobileTaken) {
          return res.status(400).json({
            status: 0,
            message: "This email ID and phone number are already used",
          });
        }

        if (isEmailTaken) {
          return res.status(400).json({
            status: 0,
            message: "This email ID is already used",
          });
        }

        if (isMobileTaken) {
          return res.status(400).json({
            status: 0,
            message: "This phone number is already used",
          });
        }
      }
    }

    // =================================================
    // UPDATE
    // =================================================

    await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .input("SCHOOL_NAME", sql.NVarChar(300), SCHOOL_NAME || "")
      .input("USERNAME", sql.NVarChar(200), USERNAME)
      .input("EMAIL_ID", sql.NVarChar(300), trimmedEmail)
      .input("MOBILE_NO", sql.NVarChar(30), trimmedMobile)
      .input("ADDRESS_LINE1", sql.NVarChar(400), ADDRESS_LINE1 || "")
      .input("ADDRESS_LINE2", sql.NVarChar(400), ADDRESS_LINE2 || "")
      .input("CITY", sql.NVarChar(200), CITY || "")
      .input("DISTRICT", sql.NVarChar(200), DISTRICT || "")
      .input("STATE", sql.NVarChar(200), STATE || "")
      .input("PINCODE", sql.NVarChar(20), PINCODE || "")
      .input("LANDMARK", sql.NVarChar(300), LANDMARK || "")
      .input("GRADE", sql.Int, GRADE !== undefined && GRADE !== null && GRADE !== "" ? Number(GRADE) : null)
      .input("USER_TYPE", sql.NVarChar(50), USER_TYPE || "STUDENT").query(`
        UPDATE USERS
        SET
          SCHOOL_NAME = @SCHOOL_NAME,
          USERNAME = @USERNAME,
          EMAIL_ID = @EMAIL_ID,
          MOBILE_NO = @MOBILE_NO,
          ADDRESS_LINE1 = @ADDRESS_LINE1,
          ADDRESS_LINE2 = @ADDRESS_LINE2,
          CITY = @CITY,
          DISTRICT = @DISTRICT,
          STATE = @STATE,
          PINCODE = @PINCODE,
          LANDMARK = @LANDMARK,
          GRADE = @GRADE,
          USER_TYPE = @USER_TYPE,
          UPDATED_AT = GETDATE()
        WHERE USER_ID = @USER_ID
      `);

    return res.json({
      status: 1,
      message: "User Updated Successfully",
    });
  } catch (err) {
    console.error("Update User Error:", err);

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE USER STATUS
// =====================================================

const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(
      req.params.id ||
      req.body.USER_ID ||
      req.body.userId
    );

    const isActive =
      req.body.isActive !== undefined
        ? Number(req.body.isActive)
        : Number(req.body.IS_ACTIVE);

    // force = true means admin already confirmed removal
    const force = req.body.force === true;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 0,
        message: "User ID is required",
      });
    }

    if (isActive !== 0 && isActive !== 1) {
      return res.status(400).json({
        status: 0,
        message: "Invalid status value",
      });
    }

    const pool = getPool();

    // 1. Verify user exists and get user type
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USERNAME, USER_TYPE, IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    const targetUser = userResult.recordset[0];
    const userType = String(targetUser.USER_TYPE || "").toUpperCase();

    // =====================================================
    // ACTIVATE USER
    // =====================================================
    if (isActive === 1) {
      await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .input("IS_ACTIVE", sql.Bit, 1)
        .query(`
          UPDATE USERS
          SET IS_ACTIVE = @IS_ACTIVE,
              UPDATED_AT = GETDATE()
          WHERE USER_ID = @USER_ID
        `);

      return res.json({
        status: 1,
        message: `${targetUser.USERNAME || "User"} activated successfully`,
      });
    }

    // =====================================================
    // DEACTIVATE USER
    // =====================================================
    if (userType === "TUTOR") {
      // 1. Check whether tutor has any allocated active batches
      const allocationResult = await pool.request().query(`
        SELECT
          ta.ID AS ALLOCATION_ID,
          ta.TUTOR_IDS,
          ta.BATCH_ID,
          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE
        FROM TUTOR_ALLOCATIONS ta
        INNER JOIN BATCHES b
          ON b.ID = ta.BATCH_ID
        WHERE ISNULL(b.IS_ACTIVE, 1) = 1
        ORDER BY ta.ID DESC
      `);

      const allAllocations = allocationResult.recordset || [];
      const tutorAllocations = [];

      for (const item of allAllocations) {
        let list = [];
        try {
          list = JSON.parse(item.TUTOR_IDS || "[]");
        } catch (_) { }

        if (Array.isArray(list) && list.some((t) => Number(t.tutorId) === userId)) {
          tutorAllocations.push({
            ALLOCATION_ID: item.ALLOCATION_ID,
            TUTOR_ID: userId,
            BATCH_ID: item.BATCH_ID,
            TUTOR_NAME: targetUser.USERNAME || "Tutor",
            BATCH_CODE: item.BATCH_CODE,
            BATCH_NAME: item.BATCH_NAME,
            START_DATE: item.START_DATE,
            END_DATE: item.END_DATE,
            rawList: list,
          });
        }
      }

      // 2. If tutor has batch allocations and force is explicitly false, prompt admin
      if (tutorAllocations.length > 0 && force === false) {
        return res.json({
          status: 3,
          message: "This tutor is currently assigned to one or more batches.",
          allocations: tutorAllocations.map((item) => ({
            ALLOCATION_ID: item.ALLOCATION_ID,
            TUTOR_ID: item.TUTOR_ID,
            BATCH_ID: item.BATCH_ID,
            TUTOR_NAME: item.TUTOR_NAME,
            BATCH_CODE: item.BATCH_CODE,
            BATCH_NAME: item.BATCH_NAME,
            START_DATE: item.START_DATE,
            END_DATE: item.END_DATE,
          })),
        });
      }

      // 3. Deactivate tutor and remove allocations in transaction
      const transaction = pool.transaction();
      let transactionStarted = false;

      try {
        await transaction.begin();
        transactionStarted = true;

        if (tutorAllocations.length > 0) {
          // Remove tutor from chat rooms
          await transaction
            .request()
            .input("TUTOR_ID", sql.Int, userId)
            .query(`
              DELETE FROM CHAT_ROOM_MEMBERS
              WHERE USER_ID = @TUTOR_ID
                AND MEMBER_TYPE = 'TUTOR'
            `);

          // Remove tutor from each batch allocation's TUTOR_IDS
          for (const item of tutorAllocations) {
            const remainingTutors = (item.rawList || []).filter(
              (t) => Number(t.tutorId) !== userId
            );

            if (remainingTutors.length === 0) {
              await transaction
                .request()
                .input("ID", sql.Int, item.ALLOCATION_ID)
                .query(`
                  DELETE FROM TUTOR_ALLOCATIONS
                  WHERE ID = @ID
                `);
            } else {
              await transaction
                .request()
                .input("ID", sql.Int, item.ALLOCATION_ID)
                .input(
                  "TUTOR_IDS",
                  sql.NVarChar(sql.MAX),
                  JSON.stringify(remainingTutors)
                )
                .query(`
                  UPDATE TUTOR_ALLOCATIONS
                  SET
                    TUTOR_IDS = @TUTOR_IDS,
                    UPDATED_AT = GETDATE()
                  WHERE
                    ID = @ID
                `);
            }
          }
        }

        // Deactivate tutor in USERS table
        await transaction
          .request()
          .input("USER_ID", sql.Int, userId)
          .input("IS_ACTIVE", sql.Bit, 0)
          .query(`
            UPDATE USERS
            SET IS_ACTIVE = @IS_ACTIVE,
                UPDATED_AT = GETDATE()
            WHERE USER_ID = @USER_ID
          `);

        await transaction.commit();
        transactionStarted = false;

        return res.json({
          status: 1,
          message:
            tutorAllocations.length > 0
              ? "Tutor deactivated and batch allocations removed successfully"
              : "Tutor deactivated successfully",
        });
      } catch (txError) {
        if (transactionStarted) {
          try {
            await transaction.rollback();
          } catch (_) { }
        }
        throw txError;
      }
    } else if (userType === "STUDENT") {
      // Deactivate student and remove allocations in transaction
      const transaction = pool.transaction();
      let transactionStarted = false;

      try {
        await transaction.begin();
        transactionStarted = true;

        // Remove student from chat rooms
        await transaction
          .request()
          .input("STUDENT_ID", sql.Int, userId)
          .query(`
            DELETE FROM CHAT_ROOM_MEMBERS
            WHERE USER_ID = @STUDENT_ID
              AND MEMBER_TYPE = 'STUDENT'
          `);

        // Remove student from batch allocations
        await transaction
          .request()
          .input("STUDENT_ID", sql.Int, userId)
          .query(`
            DELETE FROM STUDENT_ALLOCATIONS
            WHERE STUDENT_ID = @STUDENT_ID
          `);

        // Deactivate student in USERS table
        await transaction
          .request()
          .input("USER_ID", sql.Int, userId)
          .input("IS_ACTIVE", sql.Bit, 0)
          .query(`
            UPDATE USERS
            SET IS_ACTIVE = @IS_ACTIVE,
                UPDATED_AT = GETDATE()
            WHERE USER_ID = @USER_ID
          `);

        await transaction.commit();
        transactionStarted = false;

        return res.json({
          status: 1,
          message: `${targetUser.USERNAME || "Student"} deactivated and batch allocations removed successfully`,
        });
      } catch (txError) {
        if (transactionStarted) {
          try {
            await transaction.rollback();
          } catch (_) { }
        }
        throw txError;
      }
    } else {
      // Generic deactivation for non-tutor, non-student users (ADMIN, etc.)
      await pool
        .request()
        .input("USER_ID", sql.Int, userId)
        .input("IS_ACTIVE", sql.Bit, 0)
        .query(`
          UPDATE USERS
          SET IS_ACTIVE = @IS_ACTIVE,
              UPDATED_AT = GETDATE()
          WHERE USER_ID = @USER_ID
        `);

      return res.json({
        status: 1,
        message: `${targetUser.USERNAME || "User"} deactivated successfully`,
      });
    }
  } catch (err) {
    console.error("Update User Status Error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};



// =====================================================
// EXTRACT STUDENT FROM EXCEL / OBJECT (FLEXIBLE ALIASES & NORMALIZATION)
// =====================================================

const normalizeFieldKey = (key) => {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

// Recognized aliases for the 5 logical fields
const FIELD_ALIASES = {
  USER_NAME: [
    "username",
    "user_name",
    "studentname",
    "student_name",
    "name",
    "student",
    "studentfullname",
    "student_full_name",
    "fullname",
    "full_name",
  ],
  GRADE: [
    "grade",
    "class",
    "schoolgrade",
    "school_grade",
    "gradelevel",
    "grade_level",
    "classgrade",
    "class_grade",
    "standard",
    "std",
  ],
  SCHOOL_NAME: [
    "schoolname",
    "school_name",
    "school",
    "institutionname",
    "institution_name",
    "institution",
  ],
  MOBILE_NO: [
    "mobileno",
    "mobile_no",
    "mobilenumber",
    "mobile_number",
    "mobile",
    "phone",
    "phoneno",
    "phone_no",
    "phonenumber",
    "phone_number",
    "contactnumber",
    "contact_number",
    "contactno",
    "contact_no",
    "contact",
  ],
  EMAIL: [
    "email",
    "emailid",
    "email_id",
    "emailaddress",
    "email_address",
    "e_mail",
    "e_mailid",
    "e_mail_id",
  ],
};

const mapObjectToStudentFields = (obj) => {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  // Map each object key to normalized key
  const normalizedEntries = Object.entries(obj).map(([origKey, val]) => ({
    normKey: normalizeFieldKey(origKey),
    val: val !== null && val !== undefined ? String(val).trim() : "",
  }));

  // Helper to find first value matching any alias
  const getFieldValue = (aliasList) => {
    for (const alias of aliasList) {
      const normAlias = normalizeFieldKey(alias);
      const match = normalizedEntries.find((entry) => entry.normKey === normAlias);
      if (match && match.val !== "") {
        return match.val;
      }
    }
    // Also try finding if an empty value was provided (to know the key exists)
    for (const alias of aliasList) {
      const normAlias = normalizeFieldKey(alias);
      const match = normalizedEntries.find((entry) => entry.normKey === normAlias);
      if (match) {
        return match.val;
      }
    }
    return "";
  };

  const username = getFieldValue(FIELD_ALIASES.USER_NAME);
  const gradeRaw = getFieldValue(FIELD_ALIASES.GRADE);
  const schoolName = getFieldValue(FIELD_ALIASES.SCHOOL_NAME);
  const mobileRaw = getFieldValue(FIELD_ALIASES.MOBILE_NO);
  const email = getFieldValue(FIELD_ALIASES.EMAIL);

  return {
    rawRow: obj,
    USERNAME: username.trim(),
    GRADE_RAW: gradeRaw.trim(),
    SCHOOL_NAME: schoolName.trim(),
    MOBILE_NO_RAW: mobileRaw.trim(),
    EMAIL_ID: email.trim(),
    PASSWORD: "password@123",
  };
};

const detectHeaderColumns = (headerKeys) => {
  const normKeys = headerKeys.map(normalizeFieldKey);

  const checkField = (aliasList) => {
    return aliasList.some((alias) => normKeys.includes(normalizeFieldKey(alias)));
  };

  const detected = {
    USER_NAME: checkField(FIELD_ALIASES.USER_NAME),
    GRADE: checkField(FIELD_ALIASES.GRADE),
    SCHOOL_NAME: checkField(FIELD_ALIASES.SCHOOL_NAME),
    MOBILE_NO: checkField(FIELD_ALIASES.MOBILE_NO),
    EMAIL: checkField(FIELD_ALIASES.EMAIL),
  };

  const missing = [];
  if (!detected.USER_NAME) missing.push("User Name");
  if (!detected.GRADE) missing.push("Grade");
  if (!detected.SCHOOL_NAME) missing.push("School Name");
  if (!detected.MOBILE_NO) missing.push("Mobile No");
  if (!detected.EMAIL) missing.push("Email");

  return { detected, missing, isValid: missing.length === 0 };
};

// Alias for backward compatibility
const extractStudentFromObject = (obj) => mapObjectToStudentFields(obj);

// =====================================================
// BULK ADD STUDENTS (ATOMIC TRANSACTION & STRICT VALIDATION)
// =====================================================

const bulkAddStudents = async (req, res) => {
  let transaction = null;
  try {
    let rows = [];

    // 1. Parse payload / Excel file
    if (req.body.students && Array.isArray(req.body.students)) {
      rows = req.body.students;
    } else if (Array.isArray(req.body)) {
      rows = req.body;
    } else if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName || !workbook.Sheets[sheetName]) {
        return res.status(400).json({
          status: 0,
          message: "Excel sheet is empty or invalid.",
        });
      }
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      return res.status(400).json({
        status: 0,
        message: "No student data or Excel file provided.",
      });
    }

    // Filter out completely blank rows
    const nonEmptyRows = rows.filter((row) => {
      if (!row || typeof row !== "object") return false;
      return Object.values(row).some((val) => val !== null && String(val).trim() !== "");
    });

    if (nonEmptyRows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Excel sheet is empty or contains no student data.",
      });
    }

    // 2. Validate Headers if raw object keys exist
    const rawKeys = Object.keys(nonEmptyRows[0] || {});
    const { missing: missingHeaders, isValid: isHeaderValid } = detectHeaderColumns(rawKeys);

    if (!isHeaderValid) {
      return res.status(400).json({
        status: 0,
        message: `Invalid Excel format. Required columns are: User Name, Grade, School Name, Mobile No, Email. Missing: ${missingHeaders.join(", ")}`,
        errors: [`Missing required header columns: ${missingHeaders.join(", ")}`],
      });
    }

    // 3. Row-level validation rules
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;
    const allowedGrades = [6, 7, 8, 9, 10, 11, 12];

    const validationErrors = [];
    const validStudents = [];

    // Internal duplicate trackers
    const seenEmails = new Map();
    const seenMobiles = new Map();

    for (let i = 0; i < nonEmptyRows.length; i++) {
      const rowNum = i + 1; // 1-based data row index (or rowNum + 1 in Excel accounting for header)
      const excelDisplayRow = i + 2; // Excel row numbering
      const parsed = extractStudentFromObject(nonEmptyRows[i]);

      const rowIssues = [];

      // A. USER NAME
      if (!parsed.USERNAME) {
        rowIssues.push("User Name is required");
      }

      // B. GRADE
      if (!parsed.GRADE_RAW) {
        rowIssues.push("Grade is required");
      } else {
        const parsedGrade = Number(parsed.GRADE_RAW);
        if (isNaN(parsedGrade) || !allowedGrades.includes(parsedGrade)) {
          rowIssues.push(`Grade must be numeric and between 6 and 12 (received: "${parsed.GRADE_RAW}")`);
        } else {
          parsed.GRADE = parsedGrade;
        }
      }

      // C. SCHOOL NAME
      if (!parsed.SCHOOL_NAME) {
        rowIssues.push("School Name is required");
      }

      // D. MOBILE NO
      const cleanMobile = parsed.MOBILE_NO_RAW.replace(/\D/g, "");
      if (!parsed.MOBILE_NO_RAW) {
        rowIssues.push("Mobile No is required");
      } else if (!phoneRegex.test(cleanMobile)) {
        rowIssues.push("Mobile number must be exactly 10 digits");
      } else {
        parsed.MOBILE_NO = cleanMobile;
      }

      // E. EMAIL
      if (!parsed.EMAIL_ID) {
        rowIssues.push("Email is required");
      } else if (!emailRegex.test(parsed.EMAIL_ID.toLowerCase())) {
        rowIssues.push("Invalid email address format");
      } else {
        parsed.EMAIL_ID = parsed.EMAIL_ID.toLowerCase();
      }

      // Check internal duplicate email
      if (parsed.EMAIL_ID && emailRegex.test(parsed.EMAIL_ID)) {
        if (seenEmails.has(parsed.EMAIL_ID)) {
          rowIssues.push(
            `Duplicate email "${parsed.EMAIL_ID}" found inside the file (matches Row ${seenEmails.get(parsed.EMAIL_ID)})`
          );
        } else {
          seenEmails.set(parsed.EMAIL_ID, excelDisplayRow);
        }
      }

      // Check internal duplicate mobile
      if (parsed.MOBILE_NO && phoneRegex.test(parsed.MOBILE_NO)) {
        if (seenMobiles.has(parsed.MOBILE_NO)) {
          rowIssues.push(
            `Duplicate mobile number "${parsed.MOBILE_NO}" found inside the file (matches Row ${seenMobiles.get(parsed.MOBILE_NO)})`
          );
        } else {
          seenMobiles.set(parsed.MOBILE_NO, excelDisplayRow);
        }
      }

      if (rowIssues.length > 0) {
        validationErrors.push({
          row: excelDisplayRow,
          studentName: parsed.USERNAME || `Row ${excelDisplayRow}`,
          errors: rowIssues,
        });
      } else {
        validStudents.push(parsed);
      }
    }

    // 4. If ANY row failed basic/internal validation, reject entire file immediately
    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 0,
        message: `Validation failed for ${validationErrors.length} row(s). No students were inserted.`,
        errorCount: validationErrors.length,
        errors: validationErrors,
      });
    }

    // 5. Database duplicate validation for all valid records
    const pool = getPool();
    const emailsToCheck = validStudents.map((s) => s.EMAIL_ID);
    const mobilesToCheck = validStudents.map((s) => s.MOBILE_NO);

    const dbDupReq = pool.request();
    // Query existing USERS with any of these emails or mobiles
    const emailParams = emailsToCheck.map((e, idx) => {
      const pName = `em_${idx}`;
      dbDupReq.input(pName, sql.NVarChar(300), e);
      return `@${pName}`;
    });

    const mobileParams = mobilesToCheck.map((m, idx) => {
      const pName = `mb_${idx}`;
      dbDupReq.input(pName, sql.NVarChar(30), m);
      return `@${pName}`;
    });

    const dbDupResult = await dbDupReq.query(`
      SELECT USER_ID, EMAIL_ID, MOBILE_NO, USERNAME
      FROM USERS WITH (NOLOCK)
      WHERE EMAIL_ID IN (${emailParams.join(",")})
         OR MOBILE_NO IN (${mobileParams.join(",")})
    `);

    const existingUsers = dbDupResult.recordset || [];
    const dbErrors = [];

    if (existingUsers.length > 0) {
      const existingEmailSet = new Set(
        existingUsers
          .filter((u) => u.EMAIL_ID)
          .map((u) => u.EMAIL_ID.toLowerCase().trim())
      );
      const existingMobileSet = new Set(
        existingUsers
          .filter((u) => u.MOBILE_NO)
          .map((u) => String(u.MOBILE_NO).trim())
      );

      validStudents.forEach((student, idx) => {
        const excelDisplayRow = idx + 2;
        const rowIssues = [];
        if (existingEmailSet.has(student.EMAIL_ID)) {
          rowIssues.push(`Email "${student.EMAIL_ID}" already exists in database`);
        }
        if (existingMobileSet.has(student.MOBILE_NO)) {
          rowIssues.push(`Mobile number "${student.MOBILE_NO}" already exists in database`);
        }
        if (rowIssues.length > 0) {
          dbErrors.push({
            row: excelDisplayRow,
            studentName: student.USERNAME,
            errors: rowIssues,
          });
        }
      });
    }

    if (dbErrors.length > 0) {
      return res.status(400).json({
        status: 0,
        message: `Database duplicate check failed for ${dbErrors.length} student(s). No students were inserted.`,
        errorCount: dbErrors.length,
        errors: dbErrors,
      });
    }

    // 6. ATOMIC DATABASE TRANSACTION FOR BULK INSERT
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const createdStudents = [];
    const currentYear = new Date().getFullYear();
    const yearCode = String(currentYear).slice(-2);
    const pattern = `%-AICP-${yearCode}`;

    // Query highest current sequence within transaction with UPDLOCK/HOLDLOCK
    const rollNoReq = new sql.Request(transaction);
    rollNoReq.input("PATTERN", sql.NVarChar(20), pattern);
    const lastRollResult = await rollNoReq.query(`
      SELECT TOP 1 ROLL_NO
      FROM USERS WITH (UPDLOCK, HOLDLOCK)
      WHERE USER_TYPE = 'STUDENT'
        AND ROLL_NO LIKE @PATTERN
      ORDER BY
        TRY_CONVERT(
          INT,
          LEFT(
            ROLL_NO,
            CHARINDEX('-', ROLL_NO) - 1
          )
        ) DESC
    `);

    let nextNumber = 1;
    if (lastRollResult.recordset.length > 0) {
      const lastRollNo = lastRollResult.recordset[0].ROLL_NO;
      const parts = lastRollNo.split("-");
      const lastNum = parseInt(parts[0], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    for (const student of validStudents) {
      const seqStr = String(nextNumber).padStart(2, "0");
      const rollNo = `${seqStr}-AICP-${yearCode}`;
      nextNumber++;

      const insertReq = new sql.Request(transaction);
      insertReq.input("SCHOOL_NAME", sql.NVarChar(300), student.SCHOOL_NAME);
      insertReq.input("USERNAME", sql.NVarChar(200), student.USERNAME);
      insertReq.input("EMAIL_ID", sql.NVarChar(300), student.EMAIL_ID);
      insertReq.input("MOBILE_NO", sql.NVarChar(30), student.MOBILE_NO);
      insertReq.input("PASSWORD", sql.NVarChar(500), student.PASSWORD);
      insertReq.input("GRADE", sql.Int, student.GRADE);
      insertReq.input("USER_TYPE", sql.NVarChar(50), "STUDENT");
      insertReq.input("ROLL_NO", sql.NVarChar(20), rollNo);

      await insertReq.query(`
        INSERT INTO USERS (
          SCHOOL_NAME,
          USERNAME,
          EMAIL_ID,
          MOBILE_NO,
          PASSWORD,
          GRADE,
          USER_TYPE,
          ROLL_NO,
          IS_ACTIVE,
          CREATED_AT
        ) VALUES (
          @SCHOOL_NAME,
          @USERNAME,
          @EMAIL_ID,
          @MOBILE_NO,
          @PASSWORD,
          @GRADE,
          @USER_TYPE,
          @ROLL_NO,
          1,
          GETDATE()
        )
      `);

      createdStudents.push({
        USERNAME: student.USERNAME,
        EMAIL_ID: student.EMAIL_ID,
        MOBILE_NO: student.MOBILE_NO,
        SCHOOL_NAME: student.SCHOOL_NAME,
        GRADE: student.GRADE,
        ROLL_NO: rollNo,
      });
    }

    // Commit transaction
    await transaction.commit();

    return res.json({
      status: 1,
      message: `Successfully added ${createdStudents.length} students.`,
      inserted: createdStudents.length,
      students: createdStudents,
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        console.error("Transaction rollback error:", rbErr);
      }
    }
    console.error("❌ Bulk Add Students Error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message || "Failed to bulk add students",
    });
  }
};

// =====================================================
// CHANGE PASSWORD
// =====================================================

const changePassword = async (req, res) => {
  try {
    const { userId, oldPassword, password, confirmPassword, type } = req.body;

    if (!userId || !password || !confirmPassword) {
      return res.status(400).json({
        status: 0,
        message: "Password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 0,
        message: "Password mismatch",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 0,
        message: "Password must be at least 6 characters",
      });
    }

    const pool = await getPool();

    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, Number(userId)).query(`
          SELECT USER_ID, USER_TYPE, PASSWORD, MOBILE_NO, ISNULL(IS_PASSWORD_CHANGED, 0) AS IS_PASSWORD_CHANGED
          FROM USERS WITH (NOLOCK)
          WHERE USER_ID = @USER_ID
        `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    const userData = userResult.recordset[0];

    const isPasswordChanged =
      userData.IS_PASSWORD_CHANGED === 1 ||
      userData.IS_PASSWORD_CHANGED === true ||
      userData.IS_PASSWORD_CHANGED === "1";

    // If user has already changed their password before, require and validate oldPassword
    if (isPasswordChanged) {
      if (!oldPassword || !String(oldPassword).trim()) {
        return res.status(400).json({
          status: 0,
          message: "Old password is required to change password",
        });
      }

      let isOldPassValid = false;
      if (userData.PASSWORD) {
        if (String(oldPassword).trim() === String(userData.PASSWORD).trim()) {
          isOldPassValid = true;
        } else {
          try {
            isOldPassValid = await bcrypt.compare(
              String(oldPassword),
              String(userData.PASSWORD)
            );
          } catch (_) {}
        }
      }

      // Also check if old password was registered phone number as fallback
      if (!isOldPassValid && userData.MOBILE_NO) {
        isOldPassValid =
          String(oldPassword).trim() === String(userData.MOBILE_NO).trim();
      }

      if (!isOldPassValid) {
        return res.status(400).json({
          status: 0,
          message: "Incorrect old password",
        });
      }
    } else if (oldPassword && String(oldPassword).trim()) {
      // First time change, but old password was provided: verify against phone number or current password
      let isOldPassValid = false;
      if (
        userData.MOBILE_NO &&
        String(oldPassword).trim() === String(userData.MOBILE_NO).trim()
      ) {
        isOldPassValid = true;
      } else if (userData.PASSWORD) {
        if (String(oldPassword).trim() === String(userData.PASSWORD).trim()) {
          isOldPassValid = true;
        } else {
          try {
            isOldPassValid = await bcrypt.compare(
              String(oldPassword),
              String(userData.PASSWORD)
            );
          } catch (_) {}
        }
      }

      if (!isOldPassValid) {
        return res.status(400).json({
          status: 0,
          message: "Incorrect old password",
        });
      }
    }

    const trimmedNewPassword = String(password).trim();
    await pool
      .request()
      .input("USER_ID", sql.Int, Number(userId))
      .input("PASSWORD", sql.NVarChar(500), trimmedNewPassword).query(`
        UPDATE USERS
        SET PASSWORD = @PASSWORD,
            IS_PASSWORD_CHANGED = 1,
            UPDATED_AT = GETDATE()
        WHERE USER_ID = @USER_ID
      `);

    return res.status(200).json({
      status: 1,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("changePassword error:", err);

    return res.status(500).json({
      status: 0,
      message: "Failed to change password",
    });
  }
};

// =====================================================
// GET USER PROFILE
// =====================================================

const getUserProfile = async (req, res) => {
  try {
    const rawId =
      req.params.id ||
      req.query.id ||
      req.query.userId ||
      req.user?.id ||
      req.user?.USER_ID;
    const userId = Number(rawId);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 0,
        message: "Valid User ID is required",
      });
    }

    const upstreamUrl = process.env.USER_SERVICE_BASE_URL;
    const currentPort = process.env.PORT || 3310;
    const isSelfHost =
      upstreamUrl &&
      (upstreamUrl.includes(`localhost:${currentPort}`) ||
        upstreamUrl.includes(`127.0.0.1:${currentPort}`));

    if (upstreamUrl && !isSelfHost) {
      try {
        const targetUrl = `${upstreamUrl.replace(
          /\/+$/,
          ""
        )}/api/users/profile/${userId}`;
        const upstreamResponse = await axios.get(targetUrl, {
          headers: {
            authorization: req.headers.authorization || "",
            "x-user-id": req.headers["x-user-id"] || String(userId),
          },
          timeout: 10000,
        });

        if (upstreamResponse?.data) {
          return res
            .status(upstreamResponse.status || 200)
            .json(upstreamResponse.data);
        }
      } catch (upstreamErr) {
        console.warn(
          `Upstream profile service (${upstreamUrl}) error: ${upstreamErr.message}. Falling back to database.`
        );
        if (upstreamErr.response && upstreamErr.response.status === 404) {
          return res.status(404).json({
            status: 0,
            message: "User not found",
          });
        }
      }
    }

    const pool = await getPool();

    const result = await pool.request().input("USER_ID", sql.Int, userId)
      .query(`
          SELECT
            USER_ID,
            USER_TYPE,
            ROLL_NO,
            SCHOOL_NAME,
            USERNAME,
            EMAIL_ID,
            MOBILE_NO,
            ADDRESS_LINE1,
            ADDRESS_LINE2,
            LANDMARK,
            CITY,
            DISTRICT,
            STATE,
            PINCODE,
            GRADE,
            IS_ACTIVE,
            ISNULL(IS_PASSWORD_CHANGED, 0) AS IS_PASSWORD_CHANGED,
            PASSWORD,
            MOBILE_NO AS DEFAULT_PASSWORD
          FROM USERS WITH (NOLOCK)
          WHERE USER_ID = @USER_ID
        `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: 1,
      message: "Profile fetched successfully",
      data: result.recordset[0],
    });
  } catch (err) {
    console.error("getUserProfile error:", err);

    return res.status(500).json({
      status: 0,
      message: "Failed to fetch profile",
    });
  }
};

// =====================================================
// UPDATE USER PROFILE
// =====================================================

const updateUserProfile = async (req, res) => {
  try {
    const rawId =
      req.params.id ||
      req.body.USER_ID ||
      req.user?.id ||
      req.user?.USER_ID;
    const userId = Number(rawId);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 0,
        message: "Valid User ID is required",
      });
    }

    const {
      USERNAME,
      EMAIL_ID,
      MOBILE_NO,
      ADDRESS_LINE1,
      ADDRESS_LINE2,
      CITY,
      DISTRICT,
      STATE,
      PINCODE,
      LANDMARK,
      SCHOOL_NAME,
      GRADE,
    } = req.body;

    if (!USERNAME || !EMAIL_ID || !MOBILE_NO) {
      return res.status(400).json({
        status: 0,
        message: "Username, email and mobile number are required",
      });
    }

    const upstreamUrl = process.env.USER_SERVICE_BASE_URL;
    const currentPort = process.env.PORT || 3310;
    const isSelfHost =
      upstreamUrl &&
      (upstreamUrl.includes(`localhost:${currentPort}`) ||
        upstreamUrl.includes(`127.0.0.1:${currentPort}`));

    if (upstreamUrl && !isSelfHost) {
      try {
        const targetUrl = `${upstreamUrl.replace(
          /\/+$/,
          ""
        )}/api/users/profile/${userId}`;
        const upstreamResponse = await axios.put(targetUrl, req.body, {
          headers: {
            authorization: req.headers.authorization || "",
            "x-user-id": req.headers["x-user-id"] || String(userId),
          },
          timeout: 10000,
        });

        if (upstreamResponse?.data) {
          return res
            .status(upstreamResponse.status || 200)
            .json(upstreamResponse.data);
        }
      } catch (upstreamErr) {
        console.warn(
          `Upstream profile update service (${upstreamUrl}) error: ${upstreamErr.message}. Falling back to database.`
        );
      }
    }

    const pool = await getPool();

    // =================================================
    // GET USER
    // =================================================

    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId).query(`
          SELECT
            USER_ID,
            USER_TYPE,
            ROLL_NO
          FROM USERS WITH (NOLOCK)
          WHERE USER_ID = @USER_ID
        `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "User not found",
      });
    }

    const user = userResult.recordset[0];

    // =================================================
    // CHECK DUPLICATE EMAIL / MOBILE
    // =================================================

    const duplicateResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .input("EMAIL_ID", sql.NVarChar(300), EMAIL_ID.trim())
      .input("MOBILE_NO", sql.NVarChar(30), MOBILE_NO.trim()).query(`
          SELECT TOP 1
            USER_ID,
            EMAIL_ID,
            MOBILE_NO
          FROM USERS WITH (NOLOCK)
          WHERE
            (
              EMAIL_ID = @EMAIL_ID
              OR MOBILE_NO = @MOBILE_NO
            )
            AND USER_ID <> @USER_ID
        `);

    if (duplicateResult.recordset.length > 0) {
      const duplicate = duplicateResult.recordset[0];

      if (
        duplicate.EMAIL_ID &&
        duplicate.EMAIL_ID.toLowerCase() === EMAIL_ID.trim().toLowerCase()
      ) {
        return res.status(400).json({
          status: 0,
          message: "Email ID already registered",
        });
      }

      if (
        duplicate.MOBILE_NO &&
        String(duplicate.MOBILE_NO).trim() === String(MOBILE_NO).trim()
      ) {
        return res.status(400).json({
          status: 0,
          message: "Mobile number already registered",
        });
      }
    }

    // =================================================
    // UPDATE PROFILE IN DATABASE
    // =================================================

    const gradeVal =
      GRADE !== undefined && GRADE !== null && GRADE !== ""
        ? Number(GRADE)
        : null;

    await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .input("USERNAME", sql.NVarChar(200), USERNAME.trim())
      .input("EMAIL_ID", sql.NVarChar(300), EMAIL_ID.trim())
      .input("MOBILE_NO", sql.NVarChar(30), MOBILE_NO.trim())
      .input("SCHOOL_NAME", sql.NVarChar(300), SCHOOL_NAME || "")
      .input("ADDRESS_LINE1", sql.NVarChar(400), ADDRESS_LINE1 || "")
      .input("ADDRESS_LINE2", sql.NVarChar(400), ADDRESS_LINE2 || "")
      .input("CITY", sql.NVarChar(200), CITY || "")
      .input("DISTRICT", sql.NVarChar(200), DISTRICT || "")
      .input("STATE", sql.NVarChar(200), STATE || "")
      .input("PINCODE", sql.NVarChar(20), PINCODE || "")
      .input("LANDMARK", sql.NVarChar(300), LANDMARK || "")
      .input("GRADE", sql.Int, gradeVal).query(`
        UPDATE USERS
        SET
          USERNAME = @USERNAME,
          EMAIL_ID = @EMAIL_ID,
          MOBILE_NO = @MOBILE_NO,
          SCHOOL_NAME = @SCHOOL_NAME,
          ADDRESS_LINE1 = @ADDRESS_LINE1,
          ADDRESS_LINE2 = @ADDRESS_LINE2,
          CITY = @CITY,
          DISTRICT = @DISTRICT,
          STATE = @STATE,
          PINCODE = @PINCODE,
          LANDMARK = @LANDMARK,
          GRADE = CASE WHEN @GRADE IS NOT NULL THEN @GRADE ELSE GRADE END,
          UPDATED_AT = GETDATE()
        WHERE USER_ID = @USER_ID
      `);

    return res.status(200).json({
      status: 1,
      message: "Profile updated successfully",
    });
  } catch (err) {
    console.error("updateUserProfile error:", err);

    return res.status(500).json({
      status: 0,
      message: "Failed to update profile",
    });
  }
};

// =====================================================
// GET USER ACTIVITY LOGS (LATEST LOGIN PER USER WITH FILTERS)
// =====================================================

const getUserActivityLogs = async (req, res) => {
  try {
    const pool = getPool();
    const { userType, dateFilter, fromDate, toDate } = req.query;

    const request = pool.request();

    let query = `
      WITH FilteredLogs AS (
        SELECT
          UAL.ID,
          UAL.USER_ID,
          UAL.USER_TYPE,
          UAL.ACTIVITY_TYPE,
          UAL.ACTIVITY_DATE,
          U.USERNAME,
          ROW_NUMBER() OVER (
            PARTITION BY UAL.USER_ID
            ORDER BY UAL.ACTIVITY_DATE DESC, UAL.ID DESC
          ) AS RN
        FROM dbo.USER_ACTIVITY_LOGS UAL WITH (NOLOCK)
        INNER JOIN dbo.USERS U WITH (NOLOCK)
          ON U.USER_ID = UAL.USER_ID
        WHERE UAL.ACTIVITY_TYPE = 'LOGIN'
    `;

    if (userType && userType.toUpperCase() !== "ALL") {
      request.input("USER_TYPE", sql.NVarChar(50), userType.toUpperCase());
      query += ` AND UPPER(LTRIM(RTRIM(UAL.USER_TYPE))) = @USER_TYPE`;
    }

    if (dateFilter) {
      const filter = dateFilter.toLowerCase();
      if (filter === "today") {
        query += ` AND CAST(UAL.ACTIVITY_DATE AS DATE) = CAST(GETDATE() AS DATE)`;
      } else if (filter === "yesterday") {
        query += ` AND CAST(UAL.ACTIVITY_DATE AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE)`;
      } else if (
        filter === "past15days" ||
        filter === "past_15_days" ||
        filter === "last15days" ||
        filter === "last 15 days" ||
        filter === "past 15 days"
      ) {
        query += ` AND UAL.ACTIVITY_DATE >= DATEADD(day, -15, CAST(GETDATE() AS DATE)) AND UAL.ACTIVITY_DATE <= GETDATE()`;
      } else if (
        filter === "lastmonth" ||
        filter === "last_month" ||
        filter === "last month"
      ) {
        query += `
          AND UAL.ACTIVITY_DATE >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 1, 0)
          AND UAL.ACTIVITY_DATE < DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
        `;
      } else if (filter === "custom" && fromDate && toDate) {
        request.input("FROM_DATE", sql.NVarChar(30), fromDate);
        request.input("TO_DATE", sql.NVarChar(30), toDate);
        query += `
          AND CAST(UAL.ACTIVITY_DATE AS DATE) >= CAST(@FROM_DATE AS DATE)
          AND CAST(UAL.ACTIVITY_DATE AS DATE) <= CAST(@TO_DATE AS DATE)
        `;
      }
    }

    query += `
      )
      SELECT
        ID,
        USER_ID,
        USERNAME,
        USER_TYPE,
        ACTIVITY_DATE
      FROM FilteredLogs
      WHERE RN = 1
      ORDER BY ACTIVITY_DATE DESC, ID DESC
    `;

    const result = await request.query(query);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (err) {
    console.error("getUserActivityLogs error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message || "Failed to fetch user activity logs",
    });
  }
};

// =====================================================
// DELETE USER
// =====================================================

const deleteUser = async (req, res) => {
  const pool = getPool();
  const transaction = pool.transaction();

  try {
    const userId = Number(req.params.id || req.body.id || req.body.USER_ID);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 0,
        message: "Valid User ID is required",
      });
    }

    // 1. Check if user exists
    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT USER_ID, USERNAME, USER_TYPE
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

    await transaction.begin();

    // 2. Remove from Chat Room Members
    await transaction
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        DELETE FROM CHAT_ROOM_MEMBERS
        WHERE USER_ID = @USER_ID
      `);

    // 3. Remove from Student Allocations if student
    await transaction
      .request()
      .input("STUDENT_ID", sql.Int, userId)
      .query(`
        DELETE FROM STUDENT_ALLOCATIONS
        WHERE STUDENT_ID = @STUDENT_ID
      `);

    // 4. Delete user record
    await transaction
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        DELETE FROM USERS
        WHERE USER_ID = @USER_ID
      `);

    await transaction.commit();

    return res.json({
      status: 1,
      message: `${user.USERNAME || "Student"} deleted successfully`,
    });
  } catch (err) {
    console.error("deleteUser error:", err);

    try {
      await transaction.rollback();
    } catch (_) { }

    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getUsers,

  getTutors,

  getStudents,

  addUser,

  updateUser,

  deleteUser,

  updateUserStatus,

  bulkAddStudents,

  upload,

  changePassword,

  getUserProfile,

  updateUserProfile,

  generateStudentRollNo,

  getUserActivityLogs,
};
