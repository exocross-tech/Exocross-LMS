const { connectDB, getPool } = require("../config/database");

async function setupTable() {
  await connectDB();
  const pool = getPool();

  const check = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'COURSE_MATERIAL_BATCHES'
  `);

  if (check.recordset.length === 0) {
    console.log("Creating COURSE_MATERIAL_BATCHES table...");
    await pool.request().query(`
      CREATE TABLE COURSE_MATERIAL_BATCHES (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        MATERIAL_ID INT NOT NULL,
        BATCH_ID INT NOT NULL,
        CREATED_AT DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CMB_MATERIAL FOREIGN KEY (MATERIAL_ID) REFERENCES COURSE_MATERIALS(ID) ON DELETE CASCADE,
        CONSTRAINT FK_CMB_BATCH FOREIGN KEY (BATCH_ID) REFERENCES BATCHES(ID)
      );
    `);
    try {
      await pool.request().query(`
        CREATE INDEX IX_CMB_MATERIAL_ID ON COURSE_MATERIAL_BATCHES(MATERIAL_ID);
        CREATE INDEX IX_CMB_BATCH_ID ON COURSE_MATERIAL_BATCHES(BATCH_ID);
      `);
    } catch (e) {
      console.log("Index note:", e.message);
    }
    console.log("COURSE_MATERIAL_BATCHES table created.");
  } else {
    console.log("COURSE_MATERIAL_BATCHES table already exists.");
  }

  // Migrate existing single BATCH_ID from COURSE_MATERIALS into COURSE_MATERIAL_BATCHES if not present
  await pool.request().query(`
    INSERT INTO COURSE_MATERIAL_BATCHES (MATERIAL_ID, BATCH_ID, CREATED_AT)
    SELECT CM.ID, CM.BATCH_ID, ISNULL(CM.CREATED_AT, GETDATE())
    FROM COURSE_MATERIALS CM
    WHERE CM.BATCH_ID IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM COURSE_MATERIAL_BATCHES CMB 
        WHERE CMB.MATERIAL_ID = CM.ID AND CMB.BATCH_ID = CM.BATCH_ID
      )
  `);
  console.log("Migrated existing single-batch materials to COURSE_MATERIAL_BATCHES.");

  const sample = await pool.request().query(`
    SELECT CMB.*, B.BATCH_CODE 
    FROM COURSE_MATERIAL_BATCHES CMB
    LEFT JOIN BATCHES B ON B.ID = CMB.BATCH_ID
  `);
  console.log("Current COURSE_MATERIAL_BATCHES count:", sample.recordset.length);
  console.log("Sample rows:", sample.recordset.slice(0, 10));

  process.exit(0);
}

setupTable().catch((e) => {
  console.error("Setup error:", e);
  process.exit(1);
});
