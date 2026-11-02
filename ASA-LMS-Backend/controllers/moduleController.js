const { getPool, sql } = require("../config/database");

const createModule = async (req, res) => {
  try {
    const { MODULE_NAME, CREATED_BY } = req.body;

    if (!MODULE_NAME?.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Module name is required",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb
      .input("MODULE_NAME", sql.NVarChar(255), MODULE_NAME.trim())
      .input("CREATED_BY", sql.Int, CREATED_BY || 0);

    await reqDb.query(`
      INSERT INTO MODULES
      (
        MODULE_NAME,
        IS_ACTIVE,
        CREATED_BY,
        CREATED_AT,
        UPDATED_BY,
        UPDATED_AT        
      )
      VALUES
      (
        @MODULE_NAME,
        1,
        @CREATED_BY,
        GETDATE(),
        @CREATED_BY,
        GETDATE()
      )
    `);

    res.json({
      status: 1,
      message: "Module created successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

const getModules = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        ID,
        MODULE_NAME,
        IS_ACTIVE,
        CREATED_BY,
        CREATED_AT,
        UPDATED_BY,
        UPDATED_AT        
      FROM MODULES WITH (NOLOCK)
      ORDER BY ID DESC
    `);

    res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

const updateModuleStatus = async (req, res) => {
  try {
    const { ID, IS_ACTIVE, UPDATED_BY } = req.body;

    if (!ID) {
      return res.status(400).json({
        status: 0,
        message: "Module ID is required",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb
      .input("ID", sql.Int, Number(ID))
      .input("IS_ACTIVE", IS_ACTIVE)
      .input("UPDATED_BY", sql.Int, UPDATED_BY || 0);

    await reqDb.query(`
      UPDATE MODULES
      SET
        IS_ACTIVE = @IS_ACTIVE,
        UPDATED_BY = @UPDATED_BY,
        UPDATED_AT = GETDATE()
      WHERE ID = @ID
    `);

    res.json({
      status: 1,
      message: "Module status updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

const updateModule = async (req, res) => {
  try {
    const { ID, MODULE_NAME, UPDATED_BY } = req.body;

    if (!ID) {
      return res.status(400).json({
        status: 0,
        message: "Module ID is required",
      });
    }

    if (!MODULE_NAME?.trim()) {
      return res.status(400).json({
        status: 0,
        message: "Module name is required",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb
      .input("ID", sql.Int, Number(ID))
      .input("MODULE_NAME", sql.NVarChar(255), MODULE_NAME.trim())
      .input("UPDATED_BY", sql.Int, UPDATED_BY || 0);

    await reqDb.query(`
      UPDATE MODULES
      SET
        MODULE_NAME = @MODULE_NAME,
        UPDATED_BY = @UPDATED_BY,
        UPDATED_AT = GETDATE()
      WHERE ID = @ID
    `);

    return res.json({
      status: 1,
      message: "Module updated successfully",
    });
  } catch (error) {
    console.error("Update module error:", error);

    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

const getActiveModules = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ID, MODULE_NAME
      FROM MODULES WITH (NOLOCK)
      WHERE IS_ACTIVE = 1
      ORDER BY MODULE_NAME
    `);

    return res.json({
      status: 1,
      data: result.recordset,
    });
  } catch (error) {
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

const deleteModule = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({
        status: 0,
        message: "Valid Module ID is required",
      });
    }

    const pool = await getPool();
    const reqDb = pool.request();
    reqDb.input("ID", sql.Int, id);

    await reqDb.query(`
      DELETE FROM MODULES
      WHERE ID = @ID
    `);

    return res.json({
      status: 1,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Delete module error:", error);
    return res.status(500).json({
      status: 0,
      message: error.message,
    });
  }
};

module.exports = {
  createModule,
  getModules,
  updateModule,
  updateModuleStatus,
  getActiveModules,
  deleteModule,
};
