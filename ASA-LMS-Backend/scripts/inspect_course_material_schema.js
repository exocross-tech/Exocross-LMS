const { connectDB, getPool } = require("../config/database");

async function inspectSchema() {
  await connectDB();
  const pool = getPool();

  console.log("=== TABLES LIST ===");
  const tables = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log(tables.recordset.map(t => t.TABLE_NAME));

  console.log("\n=== MODULES COLUMNS ===");
  const moduleCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'MODULES' OR TABLE_NAME = 'MODULE'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(moduleCols.recordset);

  console.log("\n=== MODULES SAMPLE DATA ===");
  const moduleData = await pool.request().query(`
    SELECT TOP 5 * FROM MODULES
  `);
  console.log(moduleData.recordset);

  console.log("\n=== COURSE MATERIAL COLUMNS ===");
  const cmCols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME LIKE '%COURSE%' OR TABLE_NAME LIKE '%MATERIAL%'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log(cmCols.recordset);

  console.log("\n=== COURSE MATERIAL SAMPLE DATA ===");
  const cmData = await pool.request().query(`
    SELECT TOP 5 * FROM COURSE_MATERIALS
  `);
  console.log(cmData.recordset);

  process.exit(0);
}

inspectSchema().catch((err) => {
  console.error("Error inspecting schema:", err);
  process.exit(1);
});
