const { connectDB, getPool, sql } = require("../config/database");

async function runMigration() {
  try {
    await connectDB();
    const pool = getPool();

    console.log("Checking and creating FINAL_ASSESSMENT_SUBMISSIONS table...");
    await pool.request().query(`
      IF OBJECT_ID('dbo.FINAL_ASSESSMENT_SUBMISSIONS', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.FINAL_ASSESSMENT_SUBMISSIONS (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          ASSESSMENT_ID INT NOT NULL,
          STUDENT_ID INT NOT NULL,
          IMAGE_1 NVARCHAR(500) NULL,
          VIDEO_1 NVARCHAR(500) NULL,
          CREATED_AT DATETIME2 NOT NULL DEFAULT GETDATE(),
          CREATED_BY INT NULL,
          UPDATED_AT DATETIME2 NULL,
          UPDATED_BY INT NULL,
          CONSTRAINT FK_FAS_ASSESSMENT FOREIGN KEY (ASSESSMENT_ID) REFERENCES dbo.FINAL_ASSESSMENTS(ID)
        );
      END
    `);
    console.log("✅ FINAL_ASSESSMENT_SUBMISSIONS table is ready.");

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
