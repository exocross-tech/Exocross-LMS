const { getPool, sql } = require("../config/database");

async function migrate() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('USERS') AND name = 'IS_PASSWORD_CHANGED'
      )
      BEGIN
        ALTER TABLE USERS ADD IS_PASSWORD_CHANGED BIT DEFAULT 0;
        PRINT 'Column IS_PASSWORD_CHANGED added';
      END
    `);

    const result = await pool.request().query(`
      SELECT TOP 3 USER_ID, USERNAME, MOBILE_NO, IS_PASSWORD_CHANGED
      FROM USERS WITH (NOLOCK)
    `);
    console.log("Migration successful! Sample USERS records:", result.recordset);
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
