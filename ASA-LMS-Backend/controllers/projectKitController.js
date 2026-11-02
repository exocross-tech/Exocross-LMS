const path = require("path");
const fs = require("fs");
const { getPool, sql } = require("../config/database");

// =====================================================
// HELPER: Verify Admin Access
// =====================================================
const verifyAdminAccess = async (pool, userId) => {
  if (!userId) return false;
  const userRes = await pool
    .request()
    .input("USER_ID", sql.Int, Number(userId))
    .query("SELECT USER_TYPE, IS_ACTIVE FROM USERS WHERE USER_ID = @USER_ID");

  if (userRes.recordset.length === 0) return false;
  const u = userRes.recordset[0];
  return (
    (u.IS_ACTIVE === 1 || u.IS_ACTIVE === true) &&
    String(u.USER_TYPE || "").trim().toUpperCase() === "ADMIN"
  );
};

// =====================================================
// GET ALL PROJECT KITS (ADMIN)
// =====================================================
const getProjectKits = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        ID,
        KIT_NAME,
        IMAGE_URL,
        IS_ACTIVE,
        CREATED_BY,
        FORMAT(CREATED_AT, 'dd MMM yyyy') AS CREATED_AT_FORMATTED,
        CREATED_AT,
        UPDATED_BY,
        UPDATED_AT
      FROM PROJECT_KITS WITH (NOLOCK)
      ORDER BY ID DESC
    `);

    return res.json({
      status: 1,
      message: "Project kits fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    console.error("getProjectKits error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// GET AVAILABLE PROJECT KITS (TUTOR / ADMIN - UNASSIGNED TO BATCH)
// =====================================================
const getAvailableProjectKits = async (req, res) => {
  try {
    const pool = await getPool();
    const rawBatchId =
      req.query.batchId ||
      req.query.batch_id ||
      req.query.BATCH_ID;

    let batchId = null;
    if (rawBatchId && Number(rawBatchId) > 0) {
      batchId = Number(rawBatchId);
    }

    const request = pool.request();
    let kitNotAssignedClause = "";

    if (batchId) {
      request.input("BATCH_ID", sql.Int, batchId);
      kitNotAssignedClause = `
        AND NOT EXISTS (
          SELECT 1
          FROM ASSIGNMENT_ALERTS AA WITH (NOLOCK)
          WHERE AA.PROJECT_KIT_ID = PK.ID
            AND AA.BATCH_ID = @BATCH_ID
        )
      `;
    }

    const result = await request.query(`
      SELECT
        PK.ID,
        PK.KIT_NAME,
        PK.IMAGE_URL,
        PK.IS_ACTIVE,
        FORMAT(PK.CREATED_AT, 'dd MMM yyyy') AS CREATED_AT_FORMATTED,
        PK.CREATED_AT
      FROM PROJECT_KITS PK WITH (NOLOCK)
      WHERE ISNULL(PK.IS_ACTIVE, 1) = 1
        ${kitNotAssignedClause}
      ORDER BY PK.ID DESC
    `);

    const kits = result.recordset.map((kit) => ({
      ...kit,
      IMAGE_NAME: kit.IMAGE_URL ? path.basename(kit.IMAGE_URL) : "",
    }));

    return res.json({
      status: 1,
      message: "Available project kits fetched successfully",
      data: kits,
    });
  } catch (error) {
    console.error("getAvailableProjectKits error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// GET SINGLE PROJECT KIT BY ID
// =====================================================
const getProjectKitById = async (req, res) => {
  try {
    const { id } = req.params;
    const kitId = Number(id);

    if (!Number.isInteger(kitId) || kitId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Project Kit ID is required",
      });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("ID", sql.Int, kitId)
      .query(`
        SELECT
          ID,
          KIT_NAME,
          IMAGE_URL,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_AT,
          UPDATED_BY,
          UPDATED_AT
        FROM PROJECT_KITS WITH (NOLOCK)
        WHERE ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Project Kit not found",
      });
    }

    return res.json({
      status: 1,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("getProjectKitById error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// CREATE PROJECT KIT (ADMIN ONLY)
// =====================================================
const createProjectKit = async (req, res) => {
  try {
    const { kit_name, KIT_NAME, createdBy, CREATED_BY, userId } = req.body;
    const name = (kit_name || KIT_NAME || "").trim();
    const adminUserId = CREATED_BY || createdBy || userId || req.headers["x-user-id"];

    if (!name) {
      // If file was uploaded, remove it since validation failed
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({
        status: 0,
        message: "Kit Name is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 0,
        message: "Image is required when creating a Project Kit",
      });
    }

    const pool = await getPool();

    // Verify Admin permission
    if (adminUserId) {
      const isAdmin = await verifyAdminAccess(pool, adminUserId);
      if (!isAdmin) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(403).json({
          status: 0,
          message: "Unauthorized: Admin access required",
        });
      }
    }

    // Relative path for database storage (served via /uploads)
    const relativeImagePath = "uploads/project-kits/" + req.file.filename;

    const result = await pool
      .request()
      .input("KIT_NAME", sql.NVarChar(255), name)
      .input("IMAGE_URL", sql.NVarChar(1000), relativeImagePath)
      .input("CREATED_BY", sql.Int, adminUserId ? Number(adminUserId) : null)
      .query(`
        INSERT INTO PROJECT_KITS
        (
          KIT_NAME,
          IMAGE_URL,
          IS_ACTIVE,
          CREATED_BY,
          CREATED_AT,
          UPDATED_BY,
          UPDATED_AT
        )
        OUTPUT INSERTED.ID, INSERTED.KIT_NAME, INSERTED.IMAGE_URL
        VALUES
        (
          @KIT_NAME,
          @IMAGE_URL,
          1,
          @CREATED_BY,
          GETDATE(),
          @CREATED_BY,
          GETDATE()
        )
      `);

    return res.json({
      status: 1,
      message: "Project Kit created successfully",
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("createProjectKit error:", error);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// UPDATE PROJECT KIT (ADMIN ONLY)
// =====================================================
const updateProjectKit = async (req, res) => {
  try {
    const { id } = req.params;
    const kitId = Number(id || req.body.id || req.body.ID);

    if (!Number.isInteger(kitId) || kitId <= 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        status: 0,
        message: "Valid Project Kit ID is required",
      });
    }

    const { kit_name, KIT_NAME, updatedBy, UPDATED_BY, userId } = req.body;
    const name = (kit_name || KIT_NAME || "").trim();
    const adminUserId = UPDATED_BY || updatedBy || userId || req.headers["x-user-id"];

    if (!name) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        status: 0,
        message: "Kit Name is required",
      });
    }

    const pool = await getPool();

    // Verify Admin permission
    if (adminUserId) {
      const isAdmin = await verifyAdminAccess(pool, adminUserId);
      if (!isAdmin) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(403).json({
          status: 0,
          message: "Unauthorized: Admin access required",
        });
      }
    }

    // Check if kit exists
    const existingRes = await pool
      .request()
      .input("ID", sql.Int, kitId)
      .query("SELECT ID, IMAGE_URL FROM PROJECT_KITS WHERE ID = @ID");

    if (existingRes.recordset.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        status: 0,
        message: "Project Kit not found",
      });
    }

    const existingKit = existingRes.recordset[0];
    let newImagePath = existingKit.IMAGE_URL;

    // If new image uploaded, update path and optionally delete old file
    if (req.file) {
      newImagePath = "uploads/project-kits/" + req.file.filename;

      if (existingKit.IMAGE_URL) {
        const oldFileFullPath = path.join(__dirname, "..", existingKit.IMAGE_URL);
        fs.unlink(oldFileFullPath, () => {});
      }
    }

    await pool
      .request()
      .input("ID", sql.Int, kitId)
      .input("KIT_NAME", sql.NVarChar(255), name)
      .input("IMAGE_URL", sql.NVarChar(1000), newImagePath)
      .input("UPDATED_BY", sql.Int, adminUserId ? Number(adminUserId) : null)
      .query(`
        UPDATE PROJECT_KITS
        SET
          KIT_NAME = @KIT_NAME,
          IMAGE_URL = @IMAGE_URL,
          UPDATED_BY = @UPDATED_BY,
          UPDATED_AT = GETDATE()
        WHERE ID = @ID
      `);

    return res.json({
      status: 1,
      message: "Project Kit updated successfully",
      data: {
        ID: kitId,
        KIT_NAME: name,
        IMAGE_URL: newImagePath,
      },
    });
  } catch (error) {
    console.error("updateProjectKit error:", error);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

// =====================================================
// DELETE PROJECT KIT (ADMIN ONLY)
// =====================================================
const deleteProjectKit = async (req, res) => {
  try {
    const { id } = req.params;
    const kitId = Number(id);
    const adminUserId = req.query.userId || req.headers["x-user-id"];

    if (!Number.isInteger(kitId) || kitId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Project Kit ID is required",
      });
    }

    const pool = await getPool();

    // Verify Admin permission
    if (adminUserId) {
      const isAdmin = await verifyAdminAccess(pool, adminUserId);
      if (!isAdmin) {
        return res.status(403).json({
          status: 0,
          message: "Unauthorized: Admin access required",
        });
      }
    }

    // Retrieve kit to delete physical image file
    const existingRes = await pool
      .request()
      .input("ID", sql.Int, kitId)
      .query("SELECT ID, IMAGE_URL FROM PROJECT_KITS WHERE ID = @ID");

    if (existingRes.recordset.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "Project Kit not found",
      });
    }

    const kit = existingRes.recordset[0];

    // Nullify references in referencing tables to satisfy foreign key constraints before deleting
    await pool
      .request()
      .input("ID", sql.Int, kitId)
      .query(`
        UPDATE ASSIGNMENT_ALERTS SET PROJECT_KIT_ID = NULL WHERE PROJECT_KIT_ID = @ID;
        UPDATE ASSESMENT_EXAM SET PROJECT_KIT_ID = NULL WHERE PROJECT_KIT_ID = @ID;
        DELETE FROM PROJECT_KITS WHERE ID = @ID;
      `);

    // Remove file if exists
    if (kit.IMAGE_URL) {
      const fullPath = path.join(__dirname, "..", kit.IMAGE_URL);
      fs.unlink(fullPath, () => {});
    }

    return res.json({
      status: 1,
      message: "Project Kit deleted successfully",
    });
  } catch (error) {
    console.error("deleteProjectKit error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

module.exports = {
  getProjectKits,
  getAvailableProjectKits,
  getProjectKitById,
  createProjectKit,
  updateProjectKit,
  deleteProjectKit,
};
