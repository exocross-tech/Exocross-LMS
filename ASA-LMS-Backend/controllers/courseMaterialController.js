const sql = require("mssql");
const path = require("path");
const fs = require("fs");
const archiverModule = require("archiver");

const createZipArchive = (options = { zlib: { level: 9 } }) => {
  if (typeof archiverModule === "function") {
    return archiverModule("zip", options);
  }
  if (archiverModule.ZipArchive) {
    return new archiverModule.ZipArchive(options);
  }
  if (archiverModule.default && typeof archiverModule.default === "function") {
    return archiverModule.default("zip", options);
  }
  throw new Error("Archiver zip instance could not be created");
};

const { getPool } = require("../config/database");

/* =====================================================
   HELPERS
===================================================== */

const parseUrls = (urls) => {
  if (!urls) {
    return [];
  }

  // Already an array
  if (Array.isArray(urls)) {
    return urls;
  }

  // JSON string
  if (typeof urls === "string") {
    try {
      const parsed = JSON.parse(urls);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // Not JSON - treat as single URL
      return [urls];
    }
  }

  return [];
};

const parseBatchIds = (body) => {
  const raw =
    body.batchIds !== undefined
      ? body.batchIds
      : body.batch_ids !== undefined
      ? body.batch_ids
      : body.BATCH_IDS !== undefined
      ? body.BATCH_IDS
      : body.batchId !== undefined
      ? body.batchId
      : body.BATCH_ID !== undefined
      ? body.BATCH_ID
      : null;

  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    );
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n > 0)
          )
        );
      }
      const num = Number(parsed);
      if (Number.isInteger(num) && num > 0) {
        return [num];
      }
    } catch {
      const split = trimmed
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return Array.from(new Set(split));
    }
  }

  const num = Number(raw);
  if (Number.isInteger(num) && num > 0) {
    return [num];
  }

  return [];
};

/* =====================================================
   URL VALIDATION
===================================================== */

const isValidUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch (error) {
    return false;
  }
};

/* =====================================================
   POST - CREATE COURSE MATERIAL (MULTIPLE BATCHES)
   PDF + URL ONLY
===================================================== */

const uploadCourseMaterial = async (req, res) => {
  try {
    const {
      title,
      description,
    } = req.body;

    const rawModuleId = req.body.MODULE_ID || req.body.moduleId;
    const batchIds = parseBatchIds(req.body);

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (batchIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "At least one batch is required",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        status: 0,
        message: "Title is required",
      });
    }

    const uploadedFiles = req.files || [];
    const rawUrls = parseUrls(req.body.urls);

    // -------------------------------------------------
    // VALIDATE URLS
    // -------------------------------------------------

    const validUrls = [];

    for (const url of rawUrls) {
      const cleanUrl = String(url).trim();

      if (!cleanUrl) {
        continue;
      }

      if (!isValidUrl(cleanUrl)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid URL: ${cleanUrl}`,
        });
      }

      validUrls.push(cleanUrl);
    }

    // -------------------------------------------------
    // REQUIRE PDF OR URL
    // -------------------------------------------------

    if (
      uploadedFiles.length === 0 &&
      validUrls.length === 0
    ) {
      return res.status(400).json({
        status: 0,
        message: "Please upload at least one PDF or provide at least one URL",
      });
    }

    const pool = getPool();

    // -------------------------------------------------
    // CHECK BATCHES IN DB
    // -------------------------------------------------

    const batchCheckReq = pool.request();
    const batchInParams = batchIds.map((bId, idx) => {
      const paramName = `BID_${idx}`;
      batchCheckReq.input(paramName, sql.Int, bId);
      return `@${paramName}`;
    });

    const batchResult = await batchCheckReq.query(`
      SELECT
        ID,
        BATCH_CODE,
        BATCH_NAME
      FROM BATCHES
      WHERE ID IN (${batchInParams.join(",")})
        AND IS_ACTIVE = 1
    `);

    if (batchResult.recordset.length !== batchIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected batches are invalid or inactive",
      });
    }

    const validBatches = batchResult.recordset;

    // -------------------------------------------------
    // CHECK TUTOR AUTHORIZATION FOR BATCHES
    // -------------------------------------------------

    const rawCreatedBy =
      req.body.createdBy ||
      req.body.userType ||
      req.body.role ||
      req.user?.role ||
      req.user?.USER_TYPE ||
      "ADMIN";

    const createdBy =
      String(rawCreatedBy).trim().toUpperCase() === "TUTOR"
        ? "TUTOR"
        : "ADMIN";

    const rawTutorId =
      req.body.tutorId ||
      req.body.userId ||
      req.body.tutor_id ||
      req.body.USER_ID ||
      req.query?.tutorId ||
      req.headers?.["x-user-id"] ||
      req.user?.USER_ID ||
      req.user?.id;

    if (createdBy === "TUTOR") {
      const tutorId = Number(rawTutorId);
      if (!Number.isInteger(tutorId) || tutorId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "Valid Tutor ID is required for tutor course material uploads",
        });
      }

      const tutorAllocReq = pool.request().input("TUTOR_ID", sql.Int, tutorId);
      batchIds.forEach((bId, idx) => {
        tutorAllocReq.input(`TBID_${idx}`, sql.Int, bId);
      });
      const tutorInParams = batchIds.map((_, idx) => `@TBID_${idx}`).join(",");

      const tutorBatchCheck = await tutorAllocReq.query(`
        SELECT DISTINCT ta.BATCH_ID
        FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
        CROSS APPLY OPENJSON(ta.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE ISJSON(ta.TUTOR_IDS) = 1
          AND t.tutorId = @TUTOR_ID
          AND ta.BATCH_ID IN (${tutorInParams})
      `);

      if (tutorBatchCheck.recordset.length !== batchIds.length) {
        return res.status(403).json({
          status: 0,
          message:
            "You are not authorized to assign course materials to one or more selected batches",
        });
      }
    }

    // -------------------------------------------------
    // CHECK MODULE IF PROVIDED
    // -------------------------------------------------

    let moduleId = null;
    let moduleName = null;

    if (rawModuleId && Number(rawModuleId) > 0) {
      moduleId = Number(rawModuleId);

      const moduleResult = await pool
        .request()
        .input("MODULE_ID", sql.Int, moduleId)
        .query(`
          SELECT
            ID,
            MODULE_NAME,
            IS_ACTIVE
          FROM MODULES
          WHERE ID = @MODULE_ID
            AND IS_ACTIVE = 1
        `);

      if (moduleResult.recordset.length === 0) {
        return res.status(400).json({
          status: 0,
          message: "Invalid or inactive module selected",
        });
      }

      moduleName = moduleResult.recordset[0].MODULE_NAME;
    }

    // -------------------------------------------------
    // FORMAT PDF FILES
    // -------------------------------------------------

    const files = uploadedFiles.map((file) => ({
      TYPE: "PDF",
      FORMAT: "PDF",
      FILE_NAME: file.originalname,
      FILE_PATH: `uploads/course-materials/${file.filename}`,
    }));

    // -------------------------------------------------
    // FORMAT URLS
    // -------------------------------------------------

    const urls = validUrls.map((url) => ({
      TYPE: "URL",
      FORMAT: "URL",
      URL: url,
    }));

    // -------------------------------------------------
    // COMBINE
    // -------------------------------------------------

    const materialFiles = [
      ...files,
      ...urls,
    ];

    const primaryBatchId = batchIds[0];

    // -------------------------------------------------
    // INSERT INTO COURSE_MATERIALS
    // -------------------------------------------------

    const result = await pool
      .request()
      .input("BATCH_ID", sql.Int, primaryBatchId)
      .input("MODULE_ID", sql.Int, moduleId)
      .input("TITLE", sql.NVarChar(255), title.trim())
      .input("DESCRIPTION", sql.NVarChar(sql.MAX), description?.trim() || "")
      .input("FILES", sql.NVarChar(sql.MAX), JSON.stringify(materialFiles))
      .input("CREATED_BY", sql.NVarChar(50), createdBy)
      .query(`
        INSERT INTO COURSE_MATERIALS
        (
          BATCH_ID,
          MODULE_ID,
          TITLE,
          DESCRIPTION,
          FILES,
          CREATED_BY,
          CREATED_AT
        )
        VALUES
        (
          @BATCH_ID,
          @MODULE_ID,
          @TITLE,
          @DESCRIPTION,
          @FILES,
          @CREATED_BY,
          GETDATE()
        );

        SELECT SCOPE_IDENTITY() AS ID;
      `);

    const insertedId = result.recordset[0]?.ID;

    // -------------------------------------------------
    // INSERT MULTIPLE BATCHES INTO COURSE_MATERIAL_BATCHES
    // -------------------------------------------------

    for (const bId of batchIds) {
      await pool
        .request()
        .input("MATERIAL_ID", sql.Int, insertedId)
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          INSERT INTO COURSE_MATERIAL_BATCHES (MATERIAL_ID, BATCH_ID, CREATED_AT)
          VALUES (@MATERIAL_ID, @BATCH_ID, GETDATE())
        `);
    }

    const batchCodes = validBatches.map((b) => b.BATCH_CODE).join(", ");
    const batchNames = validBatches.map((b) => b.BATCH_NAME).join(", ");

    return res.status(201).json({
      status: 1,
      message: "Course material uploaded successfully",
      data: {
        ID: insertedId,
        BATCH_ID: primaryBatchId,
        BATCH_IDS: batchIds,
        BATCHES: validBatches,
        BATCH_CODE: batchCodes,
        BATCH_CODES: batchCodes,
        BATCH_NAME: batchNames,
        BATCH_NAMES: batchNames,
        MODULE_ID: moduleId,
        MODULE_NAME: moduleName,
        TITLE: title.trim(),
        DESCRIPTION: description?.trim() || "",
        FILES: materialFiles,
        CREATED_BY: createdBy,
      },
    });
  } catch (err) {
    console.error("uploadCourseMaterial error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   GET ALL COURSE MATERIALS - ADMIN / TUTOR
===================================================== */

const getCourseMaterials = async (req, res) => {
  try {
    const pool = getPool();
    const rawTutorId =
      req.query.tutorId ||
      req.query.tutor_id ||
      req.query.userId ||
      req.query.USER_ID;

    const rawUserType =
      req.query.userType ||
      req.query.USER_TYPE ||
      req.query.role ||
      req.query.ROLE ||
      (rawTutorId ? "TUTOR" : "ADMIN");

    const userType = String(rawUserType).trim().toUpperCase();

    let tutorId = null;
    if (rawTutorId) {
      const parsedId = Number(rawTutorId);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        tutorId = parsedId;
      }
    }

    const request = pool.request();
    let whereClause = "";

    if (userType === "TUTOR" || tutorId) {
      if (tutorId) {
        request.input("TUTOR_ID", sql.Int, tutorId);
        whereClause = `
          WHERE (
              EXISTS (
                SELECT 1
                FROM COURSE_MATERIAL_BATCHES cmb
                INNER JOIN TUTOR_ALLOCATIONS ta WITH (NOLOCK) ON ta.BATCH_ID = cmb.BATCH_ID
                CROSS APPLY OPENJSON(ta.TUTOR_IDS)
                WITH (
                  tutorId INT '$.tutorId',
                  role NVARCHAR(50) '$.role'
                ) t
                WHERE cmb.MATERIAL_ID = CM.ID
                  AND ISJSON(ta.TUTOR_IDS) = 1
                  AND t.tutorId = @TUTOR_ID
              )
              OR CM.BATCH_ID IN (
                SELECT ta.BATCH_ID
                FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
                CROSS APPLY OPENJSON(ta.TUTOR_IDS)
                WITH (
                  tutorId INT '$.tutorId',
                  role NVARCHAR(50) '$.role'
                ) t
                WHERE ISJSON(ta.TUTOR_IDS) = 1
                  AND t.tutorId = @TUTOR_ID
              )
            )
        `;
      } else {
        whereClause = `
          WHERE 1 = 0
        `;
      }
    } else {
      // Default to ADMIN: Admin should only see materials uploaded by Admin
      whereClause = `
        WHERE UPPER(LTRIM(RTRIM(ISNULL(CM.CREATED_BY, 'ADMIN')))) = 'ADMIN'
      `;
    }

    const result = await request.query(`
      SELECT
        CM.ID,
        CM.BATCH_ID,
        CM.MODULE_ID,
        CM.TITLE,
        CM.DESCRIPTION,
        CM.FILES,
        CM.CREATED_BY,
        CM.CREATED_AT,
        M.MODULE_NAME,
        B_SINGLE.BATCH_CODE AS LEGACY_BATCH_CODE,
        B_SINGLE.BATCH_NAME AS LEGACY_BATCH_NAME,
        (
          SELECT 
            b.ID,
            b.BATCH_CODE,
            b.BATCH_NAME
          FROM COURSE_MATERIAL_BATCHES cmb
          INNER JOIN BATCHES b ON b.ID = cmb.BATCH_ID
          WHERE cmb.MATERIAL_ID = CM.ID AND b.IS_ACTIVE = 1
          FOR JSON PATH
        ) AS BATCHES_JSON
      FROM COURSE_MATERIALS CM
      LEFT JOIN BATCHES B_SINGLE ON B_SINGLE.ID = CM.BATCH_ID
      LEFT JOIN MODULES M ON M.ID = CM.MODULE_ID
      ${whereClause}
      ORDER BY CM.CREATED_AT DESC, CM.ID DESC
    `);

    const data = result.recordset.map((item) => {
      let files = [];
      try {
        files = item.FILES ? JSON.parse(item.FILES) : [];
      } catch (error) {
        files = [];
      }

      let assignedBatches = [];
      try {
        if (item.BATCHES_JSON) {
          assignedBatches = JSON.parse(item.BATCHES_JSON);
        }
      } catch (e) {}

      if (
        assignedBatches.length === 0 &&
        item.BATCH_ID &&
        (item.LEGACY_BATCH_CODE || item.LEGACY_BATCH_NAME)
      ) {
        assignedBatches = [
          {
            ID: item.BATCH_ID,
            BATCH_CODE: item.LEGACY_BATCH_CODE,
            BATCH_NAME: item.LEGACY_BATCH_NAME,
          },
        ];
      }

      const batchCodes = assignedBatches.map((b) => b.BATCH_CODE).filter(Boolean);
      const batchNames = assignedBatches.map((b) => b.BATCH_NAME).filter(Boolean);
      const batchIds = assignedBatches.map((b) => b.ID).filter(Boolean);

      return {
        ...item,
        FILES: files,
        MODULE_NAME: item.MODULE_NAME || null,
        BATCHES: assignedBatches,
        BATCH_IDS: batchIds,
        BATCH_CODE: batchCodes.join(", ") || item.LEGACY_BATCH_CODE || null,
        BATCH_CODES: batchCodes.join(", ") || item.LEGACY_BATCH_CODE || null,
        BATCH_NAME: batchNames.join(", ") || item.LEGACY_BATCH_NAME || null,
        BATCH_NAMES: batchNames.join(", ") || item.LEGACY_BATCH_NAME || null,
      };
    });

    return res.json({
      status: 1,
      data,
    });
  } catch (err) {
    console.error("getCourseMaterials error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   GET SINGLE COURSE MATERIAL BY ID
===================================================== */

const getCourseMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const materialId = Number(id);

    if (!materialId || materialId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Material ID is required",
      });
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input("ID", sql.Int, materialId)
      .query(`
        SELECT
          CM.ID,
          CM.BATCH_ID,
          CM.MODULE_ID,
          CM.TITLE,
          CM.DESCRIPTION,
          CM.FILES,
          CM.CREATED_BY,
          CM.CREATED_AT,
          M.MODULE_NAME,
          B_SINGLE.BATCH_CODE AS LEGACY_BATCH_CODE,
          B_SINGLE.BATCH_NAME AS LEGACY_BATCH_NAME,
          (
            SELECT 
              b.ID,
              b.BATCH_CODE,
              b.BATCH_NAME
            FROM COURSE_MATERIAL_BATCHES cmb
            INNER JOIN BATCHES b ON b.ID = cmb.BATCH_ID
            WHERE cmb.MATERIAL_ID = CM.ID AND b.IS_ACTIVE = 1
            FOR JSON PATH
          ) AS BATCHES_JSON
        FROM COURSE_MATERIALS CM
        LEFT JOIN BATCHES B_SINGLE ON B_SINGLE.ID = CM.BATCH_ID
        LEFT JOIN MODULES M ON M.ID = CM.MODULE_ID
        WHERE CM.ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Course material not found",
      });
    }

    const item = result.recordset[0];
    let files = [];
    try {
      files = item.FILES ? JSON.parse(item.FILES) : [];
    } catch {
      files = [];
    }

    let assignedBatches = [];
    try {
      if (item.BATCHES_JSON) {
        assignedBatches = JSON.parse(item.BATCHES_JSON);
      }
    } catch (e) {}

    if (
      assignedBatches.length === 0 &&
      item.BATCH_ID &&
      (item.LEGACY_BATCH_CODE || item.LEGACY_BATCH_NAME)
    ) {
      assignedBatches = [
        {
          ID: item.BATCH_ID,
          BATCH_CODE: item.LEGACY_BATCH_CODE,
          BATCH_NAME: item.LEGACY_BATCH_NAME,
        },
      ];
    }

    const batchCodes = assignedBatches.map((b) => b.BATCH_CODE).filter(Boolean);
    const batchNames = assignedBatches.map((b) => b.BATCH_NAME).filter(Boolean);
    const batchIds = assignedBatches.map((b) => b.ID).filter(Boolean);

    return res.json({
      status: 1,
      message: "Course material fetched successfully",
      data: {
        ...item,
        FILES: files,
        MODULE_NAME: item.MODULE_NAME || null,
        BATCHES: assignedBatches,
        BATCH_IDS: batchIds,
        BATCH_CODE: batchCodes.join(", ") || item.LEGACY_BATCH_CODE || null,
        BATCH_CODES: batchCodes.join(", ") || item.LEGACY_BATCH_CODE || null,
        BATCH_NAME: batchNames.join(", ") || item.LEGACY_BATCH_NAME || null,
        BATCH_NAMES: batchNames.join(", ") || item.LEGACY_BATCH_NAME || null,
      },
    });
  } catch (err) {
    console.error("getCourseMaterialById error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   GET STUDENT COURSE MATERIALS
===================================================== */

const getStudentCourseMaterials = async (req, res) => {
  try {
    const pool = getPool();
    const userId = Number(req.query.USER_ID || req.query.userId);

    if (!userId || userId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "USER_ID is required",
      });
    }

    // -------------------------------------------------
    // CHECK STUDENT
    // -------------------------------------------------

    const userResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT
          USER_ID,
          USERNAME,
          USER_TYPE,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
          AND (USER_TYPE = 'STUDENT' OR USER_TYPE IS NULL)
          AND IS_ACTIVE = 1
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Student user not found",
      });
    }

    const user = userResult.recordset[0];

    // -------------------------------------------------
    // GET STUDENT BATCH
    // -------------------------------------------------

    const allocationResult = await pool
      .request()
      .input("USER_ID", sql.Int, userId)
      .query(`
        SELECT TOP 1
          U.USER_ID AS STUDENT_ID,
          U.USERNAME AS STUDENT_NAME,
          SA.ID AS ALLOCATION_ID,
          SA.BATCH_ID,
          B.BATCH_CODE,
          B.BATCH_NAME,
          B.IS_ACTIVE AS BATCH_IS_ACTIVE
        FROM USERS U
        INNER JOIN STUDENT_ALLOCATIONS SA
          ON SA.STUDENT_ID = U.USER_ID
        INNER JOIN BATCHES B
          ON B.ID = SA.BATCH_ID
        WHERE U.USER_ID = @USER_ID
        ORDER BY SA.ID DESC
      `);

    if (allocationResult.recordset.length === 0) {
      return res.json({
        status: 1,
        message: "Student is not assigned to any batch",
        student: {
          USER_ID: user.USER_ID,
          USERNAME: user.USERNAME,
        },
        batch: null,
        data: [],
      });
    }

    const allocation = allocationResult.recordset[0];

    if (Number(allocation.BATCH_IS_ACTIVE) !== 1) {
      return res.json({
        status: 1,
        message: "Student batch is inactive",
        student: {
          USER_ID: user.USER_ID,
          USERNAME: user.USERNAME,
        },
        batch: null,
        data: [],
      });
    }

    const batchId = Number(allocation.BATCH_ID);

    // -------------------------------------------------
    // GET MATERIALS (EITHER FROM MAPPING TABLE OR SINGLE BATCH_ID)
    // -------------------------------------------------

    const materialResult = await pool
      .request()
      .input("BATCH_ID", sql.Int, batchId)
      .query(`
        SELECT DISTINCT
          CM.ID,
          CM.BATCH_ID,
          CM.MODULE_ID,
          CM.TITLE,
          CM.DESCRIPTION,
          CM.FILES,
          CM.CREATED_BY,
          CM.CREATED_AT,
          M.MODULE_NAME,
          (
            SELECT 
              b.ID,
              b.BATCH_CODE,
              b.BATCH_NAME
            FROM COURSE_MATERIAL_BATCHES cmb
            INNER JOIN BATCHES b ON b.ID = cmb.BATCH_ID
            WHERE cmb.MATERIAL_ID = CM.ID AND b.IS_ACTIVE = 1
            FOR JSON PATH
          ) AS BATCHES_JSON
        FROM COURSE_MATERIALS CM
        LEFT JOIN MODULES M ON M.ID = CM.MODULE_ID
        WHERE (
          EXISTS (
            SELECT 1 FROM COURSE_MATERIAL_BATCHES CMB
            INNER JOIN BATCHES B ON B.ID = CMB.BATCH_ID
            WHERE CMB.MATERIAL_ID = CM.ID
              AND CMB.BATCH_ID = @BATCH_ID
              AND B.IS_ACTIVE = 1
          )
          OR (
            CM.BATCH_ID = @BATCH_ID
            AND EXISTS (SELECT 1 FROM BATCHES B WHERE B.ID = CM.BATCH_ID AND B.IS_ACTIVE = 1)
          )
        )
        ORDER BY CM.CREATED_AT DESC, CM.ID DESC
      `);

    const data = materialResult.recordset.map((item) => {
      let files = [];
      try {
        files = item.FILES ? JSON.parse(item.FILES) : [];
      } catch (error) {
        files = [];
      }

      let assignedBatches = [];
      try {
        if (item.BATCHES_JSON) {
          assignedBatches = JSON.parse(item.BATCHES_JSON);
        }
      } catch (e) {}

      if (assignedBatches.length === 0 && item.BATCH_ID) {
        assignedBatches = [
          {
            ID: item.BATCH_ID,
            BATCH_CODE: allocation.BATCH_CODE,
            BATCH_NAME: allocation.BATCH_NAME,
          },
        ];
      }

      const batchCodes = assignedBatches.map((b) => b.BATCH_CODE).filter(Boolean);
      const batchNames = assignedBatches.map((b) => b.BATCH_NAME).filter(Boolean);
      const batchIds = assignedBatches.map((b) => b.ID).filter(Boolean);

      return {
        ID: item.ID,
        BATCH_ID: item.BATCH_ID || batchId,
        BATCH_IDS: batchIds,
        BATCHES: assignedBatches,
        BATCH_CODE: batchCodes.join(", ") || allocation.BATCH_CODE,
        BATCH_CODES: batchCodes.join(", ") || allocation.BATCH_CODE,
        BATCH_NAME: batchNames.join(", ") || allocation.BATCH_NAME,
        BATCH_NAMES: batchNames.join(", ") || allocation.BATCH_NAME,
        MODULE_ID: item.MODULE_ID,
        MODULE_NAME: item.MODULE_NAME || null,
        TITLE: item.TITLE,
        DESCRIPTION: item.DESCRIPTION || "",
        FILES: files,
        CREATED_BY: item.CREATED_BY,
        CREATED_AT: item.CREATED_AT,
      };
    });

    return res.json({
      status: 1,
      message: "Course materials fetched successfully",
      student: {
        USER_ID: user.USER_ID,
        USERNAME: user.USERNAME,
      },
      batch: {
        BATCH_ID: allocation.BATCH_ID,
        BATCH_CODE: allocation.BATCH_CODE,
        BATCH_NAME: allocation.BATCH_NAME,
      },
      data,
    });
  } catch (err) {
    console.error("getStudentCourseMaterials error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   PUT - UPDATE COURSE MATERIAL (MULTIPLE BATCHES)
   PDF + URL ONLY
===================================================== */

const updateCourseMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const rawModuleId =
      req.body.MODULE_ID !== undefined ? req.body.MODULE_ID : req.body.moduleId;
    const batchIds = parseBatchIds(req.body);

    if (!id || Number(id) <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Material ID is required",
      });
    }

    if (batchIds.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "At least one batch is required",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        status: 0,
        message: "Title is required",
      });
    }

    const pool = getPool();

    // -------------------------------------------------
    // GET EXISTING MATERIAL
    // -------------------------------------------------

    const materialResult = await pool
      .request()
      .input("ID", sql.Int, Number(id))
      .query(`
        SELECT
          ID,
          BATCH_ID,
          MODULE_ID,
          TITLE,
          DESCRIPTION,
          FILES,
          CREATED_BY
        FROM COURSE_MATERIALS
        WHERE ID = @ID
      `);

    if (materialResult.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Course material not found",
      });
    }

    const material = materialResult.recordset[0];

    // -------------------------------------------------
    // CHECK BATCHES IN DB
    // -------------------------------------------------

    const batchCheckReq = pool.request();
    const batchInParams = batchIds.map((bId, idx) => {
      const paramName = `BID_${idx}`;
      batchCheckReq.input(paramName, sql.Int, bId);
      return `@${paramName}`;
    });

    const batchResult = await batchCheckReq.query(`
      SELECT
        ID,
        BATCH_CODE,
        BATCH_NAME
      FROM BATCHES
      WHERE ID IN (${batchInParams.join(",")})
        AND IS_ACTIVE = 1
    `);

    if (batchResult.recordset.length !== batchIds.length) {
      return res.status(400).json({
        status: 0,
        message: "One or more selected batches are invalid or inactive",
      });
    }

    const validBatches = batchResult.recordset;

    // -------------------------------------------------
    // CHECK TUTOR AUTHORIZATION IF TUTOR
    // -------------------------------------------------

    const rawUserType =
      req.body.userType ||
      req.body.role ||
      req.user?.role ||
      req.user?.USER_TYPE ||
      (material.CREATED_BY === "TUTOR" ? "TUTOR" : "ADMIN");

    const rawTutorId =
      req.body.tutorId ||
      req.body.userId ||
      req.body.tutor_id ||
      req.body.USER_ID ||
      req.query?.tutorId ||
      req.headers?.["x-user-id"] ||
      req.user?.USER_ID ||
      req.user?.id;

    if (String(rawUserType).trim().toUpperCase() === "TUTOR") {
      const tutorId = Number(rawTutorId);
      if (!Number.isInteger(tutorId) || tutorId <= 0) {
        return res.status(400).json({
          status: 0,
          message: "Valid Tutor ID is required for tutor course material updates",
        });
      }

      const tutorAllocReq = pool.request().input("TUTOR_ID", sql.Int, tutorId);
      batchIds.forEach((bId, idx) => {
        tutorAllocReq.input(`TBID_${idx}`, sql.Int, bId);
      });
      const tutorInParams = batchIds.map((_, idx) => `@TBID_${idx}`).join(",");

      const tutorBatchCheck = await tutorAllocReq.query(`
        SELECT DISTINCT ta.BATCH_ID
        FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
        CROSS APPLY OPENJSON(ta.TUTOR_IDS)
        WITH (
          tutorId INT '$.tutorId',
          role NVARCHAR(50) '$.role'
        ) t
        WHERE ISJSON(ta.TUTOR_IDS) = 1
          AND t.tutorId = @TUTOR_ID
          AND ta.BATCH_ID IN (${tutorInParams})
      `);

      if (tutorBatchCheck.recordset.length !== batchIds.length) {
        return res.status(403).json({
          status: 0,
          message:
            "You are not authorized to assign course materials to one or more selected batches",
        });
      }
    }

    // -------------------------------------------------
    // CHECK MODULE IF PROVIDED
    // -------------------------------------------------

    let moduleId = material.MODULE_ID;
    let moduleName = null;

    if (
      rawModuleId !== undefined &&
      rawModuleId !== null &&
      rawModuleId !== ""
    ) {
      moduleId = Number(rawModuleId);

      const moduleResult = await pool
        .request()
        .input("MODULE_ID", sql.Int, moduleId)
        .query(`
          SELECT
            ID,
            MODULE_NAME,
            IS_ACTIVE
          FROM MODULES
          WHERE ID = @MODULE_ID
            AND IS_ACTIVE = 1
        `);

      if (moduleResult.recordset.length === 0) {
        return res.status(400).json({
          status: 0,
          message: "Invalid or inactive module selected",
        });
      }

      moduleName = moduleResult.recordset[0].MODULE_NAME;
    } else if (rawModuleId === null || rawModuleId === "") {
      moduleId = null;
    }

    // -------------------------------------------------
    // EXISTING FILES & NEW RESOURCES
    // -------------------------------------------------

    let existingFiles = [];

    try {
      existingFiles = material.FILES ? JSON.parse(material.FILES) : [];
    } catch (error) {
      existingFiles = [];
    }

    const uploadedFiles = req.files || [];

    const newFiles = uploadedFiles.map((file) => ({
      TYPE: "PDF",
      FORMAT: "PDF",
      FILE_NAME: file.originalname,
      FILE_PATH: `uploads/course-materials/${file.filename}`,
    }));

    const rawUrls = parseUrls(req.body.urls);
    const newUrls = [];

    for (const url of rawUrls) {
      const cleanUrl = String(url).trim();

      if (!cleanUrl) {
        continue;
      }

      if (!isValidUrl(cleanUrl)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid URL: ${cleanUrl}`,
        });
      }

      newUrls.push({
        TYPE: "URL",
        FORMAT: "URL",
        URL: cleanUrl,
      });
    }

    const updatedFiles = [
      ...existingFiles,
      ...newFiles,
      ...newUrls,
    ];

    if (updatedFiles.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "At least one PDF or URL is required",
      });
    }

    const primaryBatchId = batchIds[0];

    // -------------------------------------------------
    // UPDATE COURSE_MATERIALS
    // -------------------------------------------------

    await pool
      .request()
      .input("ID", sql.Int, Number(id))
      .input("BATCH_ID", sql.Int, primaryBatchId)
      .input("MODULE_ID", sql.Int, moduleId)
      .input("TITLE", sql.NVarChar(255), title.trim())
      .input("DESCRIPTION", sql.NVarChar(sql.MAX), description?.trim() || "")
      .input("FILES", sql.NVarChar(sql.MAX), JSON.stringify(updatedFiles))
      .query(`
        UPDATE COURSE_MATERIALS
        SET
          BATCH_ID = @BATCH_ID,
          MODULE_ID = @MODULE_ID,
          TITLE = @TITLE,
          DESCRIPTION = @DESCRIPTION,
          FILES = @FILES
        WHERE ID = @ID
      `);

    // -------------------------------------------------
    // SYNC COURSE_MATERIAL_BATCHES (SAFE REPLACE)
    // -------------------------------------------------

    await pool
      .request()
      .input("MATERIAL_ID", sql.Int, Number(id))
      .query(`
        DELETE FROM COURSE_MATERIAL_BATCHES
        WHERE MATERIAL_ID = @MATERIAL_ID
      `);

    for (const bId of batchIds) {
      await pool
        .request()
        .input("MATERIAL_ID", sql.Int, Number(id))
        .input("BATCH_ID", sql.Int, bId)
        .query(`
          INSERT INTO COURSE_MATERIAL_BATCHES (MATERIAL_ID, BATCH_ID, CREATED_AT)
          VALUES (@MATERIAL_ID, @BATCH_ID, GETDATE())
        `);
    }

    const batchCodes = validBatches.map((b) => b.BATCH_CODE).join(", ");
    const batchNames = validBatches.map((b) => b.BATCH_NAME).join(", ");

    return res.json({
      status: 1,
      message: "Course material updated successfully",
      data: {
        ID: Number(id),
        BATCH_ID: primaryBatchId,
        BATCH_IDS: batchIds,
        BATCHES: validBatches,
        BATCH_CODE: batchCodes,
        BATCH_CODES: batchCodes,
        BATCH_NAME: batchNames,
        BATCH_NAMES: batchNames,
        MODULE_ID: moduleId,
        MODULE_NAME: moduleName,
        TITLE: title.trim(),
        DESCRIPTION: description?.trim() || "",
        FILES: updatedFiles,
      },
    });
  } catch (err) {
    console.error("updateCourseMaterial error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   DELETE SINGLE RESOURCE (PDF OR URL)
===================================================== */

const deleteCourseMaterialFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { filePath, url } = req.body;
    const resourceTarget = (filePath || url || "").trim();

    if (!resourceTarget) {
      return res.status(400).json({
        status: 0,
        message: "Resource path or URL is required",
      });
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input("ID", sql.Int, Number(id))
      .query(`
        SELECT
          ID,
          FILES
        FROM COURSE_MATERIALS
        WHERE ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Course material not found",
      });
    }

    const material = result.recordset[0];

    let files = [];
    try {
      files = material.FILES ? JSON.parse(material.FILES) : [];
    } catch (error) {
      return res.status(500).json({
        status: 0,
        message: "Invalid file data",
      });
    }

    // Find matching resource by FILE_PATH or URL
    const targetIndex = files.findIndex((file) => {
      if (file.FILE_PATH && file.FILE_PATH === resourceTarget) {
        return true;
      }
      if (file.URL && file.URL === resourceTarget) {
        return true;
      }
      return false;
    });

    if (targetIndex === -1) {
      return res.status(404).json({
        status: 0,
        message: "Resource not found",
      });
    }

    const matchedResource = files[targetIndex];
    const isUrlResource =
      matchedResource.TYPE === "URL" ||
      matchedResource.FORMAT === "URL" ||
      !!matchedResource.URL;

    // Filter out the deleted resource
    const updatedFiles = files.filter((_, idx) => idx !== targetIndex);

    if (updatedFiles.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "At least one file or URL must remain",
      });
    }

    await pool
      .request()
      .input("ID", sql.Int, Number(id))
      .input("FILES", sql.NVarChar(sql.MAX), JSON.stringify(updatedFiles))
      .query(`
        UPDATE COURSE_MATERIALS
        SET FILES = @FILES
        WHERE ID = @ID
      `);

    // Physical deletion only for physical files with FILE_PATH
    if (!isUrlResource && matchedResource.FILE_PATH) {
      try {
        const absolutePath = path.resolve(
          process.cwd(),
          matchedResource.FILE_PATH
        );

        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (fileErr) {
        console.error("Error removing physical file:", fileErr);
      }
    }

    return res.json({
      status: 1,
      message: isUrlResource
        ? "URL deleted successfully"
        : "File deleted successfully",
      data: updatedFiles,
    });
  } catch (err) {
    console.error("deleteCourseMaterialFile error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   DELETE ENTIRE COURSE MATERIAL
===================================================== */

const deleteCourseMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || Number(id) <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Material ID is required",
      });
    }

    const materialId = Number(id);
    const pool = getPool();

    const result = await pool
      .request()
      .input("ID", sql.Int, materialId)
      .query(`
        SELECT
          ID,
          TITLE,
          FILES
        FROM COURSE_MATERIALS
        WHERE ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Course material not found",
      });
    }

    const material = result.recordset[0];

    let files = [];
    try {
      files = material.FILES ? JSON.parse(material.FILES) : [];
    } catch (error) {
      files = [];
    }

    // -------------------------------------------------
    // DELETE DATABASE RECORD AND MAPPINGS
    // -------------------------------------------------

    await pool
      .request()
      .input("ID", sql.Int, materialId)
      .query(`
        DELETE FROM COURSE_MATERIAL_BATCHES WHERE MATERIAL_ID = @ID;
        DELETE FROM COURSE_MATERIALS WHERE ID = @ID;
      `);

    // -------------------------------------------------
    // DELETE PDF FILES
    // -------------------------------------------------

    let deletedFiles = 0;

    for (const file of files) {
      if (!file?.FILE_PATH) {
        continue;
      }

      try {
        const absolutePath = path.resolve(
          process.cwd(),
          file.FILE_PATH
        );

        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
          deletedFiles++;
        }
      } catch (fileError) {
        console.error(
          "Failed to delete file:",
          file.FILE_PATH,
          fileError
        );
      }
    }

    return res.json({
      status: 1,
      message: "Course material deleted successfully",
      data: {
        ID: materialId,
        TITLE: material.TITLE,
        deletedFiles,
      },
    });
  } catch (err) {
    console.error("deleteCourseMaterial error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};

/* =====================================================
   DOWNLOAD COURSE MATERIAL AS ZIP
   PDF FILES ONLY
===================================================== */

const downloadCourseMaterialZip = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || Number(id) <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Material ID is required",
      });
    }

    const pool = getPool();

    const result = await pool
      .request()
      .input("ID", sql.Int, Number(id))
      .query(`
        SELECT
          CM.ID,
          CM.TITLE,
          CM.FILES
        FROM COURSE_MATERIALS CM
        WHERE CM.ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Course material not found",
      });
    }

    const material = result.recordset[0];

    let files = [];
    try {
      files = material.FILES ? JSON.parse(material.FILES) : [];
    } catch (error) {
      return res.status(500).json({
        status: 0,
        message: "Invalid file data",
      });
    }

    // Only PDFs
    const pdfFiles = files.filter(
      (file) =>
        (file.TYPE === "PDF" || file.FORMAT === "PDF") && file.FILE_PATH
    );

    if (pdfFiles.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "No PDF files available for download",
      });
    }

    // -------------------------------------------------
    // ZIP NAME
    // -------------------------------------------------

    let zipFileName = String(material.TITLE || "course-material")
      .replace(/[\r\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    zipFileName = zipFileName
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[<>:"/\\|?*]/g, "")
      .trim();

    if (!zipFileName) {
      zipFileName = "course-material";
    }

    zipFileName += ".zip";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}"`
    );

    // -------------------------------------------------
    // CREATE ZIP
    // -------------------------------------------------

    const archive = createZipArchive({
      zlib: {
        level: 9,
      },
    });

    archive.on("error", (error) => {
      console.error("ZIP archive error:", error);
      if (!res.headersSent) {
        return res.status(500).json({
          status: 0,
          message: "Failed to create ZIP file",
        });
      }
      res.end();
    });

    archive.pipe(res);

    let addedFiles = 0;
    const usedNames = new Set();

    for (const file of pdfFiles) {
      const absolutePath = path.resolve(process.cwd(), file.FILE_PATH);

      if (!fs.existsSync(absolutePath)) {
        console.warn("PDF not found:", absolutePath);
        continue;
      }

      let fileName = file.FILE_NAME || path.basename(absolutePath);

      if (usedNames.has(fileName)) {
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        let count = 1;
        while (usedNames.has(`${nameWithoutExt} (${count})${ext}`)) {
          count++;
        }
        fileName = `${nameWithoutExt} (${count})${ext}`;
      }

      usedNames.add(fileName);

      archive.file(absolutePath, {
        name: fileName,
      });

      addedFiles++;
    }

    if (addedFiles === 0) {
      archive.abort();
      return res.status(404).json({
        status: 0,
        message: "None of the PDF files were found",
      });
    }

    await archive.finalize();
  } catch (err) {
    console.error("downloadCourseMaterialZip error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        status: 0,
        message: err.message,
      });
    }
  }
};

/* =====================================================
   EXPORT
===================================================== */

module.exports = {
  uploadCourseMaterial,
  getCourseMaterials,
  getCourseMaterialById,
  getStudentCourseMaterials,
  updateCourseMaterial,
  deleteCourseMaterialFile,
  deleteCourseMaterial,
  downloadCourseMaterialZip,
};