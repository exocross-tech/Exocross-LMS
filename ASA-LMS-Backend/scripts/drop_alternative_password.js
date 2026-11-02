const { getPool } = require("../config/database");

async function dropAlternativePassword() {
  try {
    const pool = await getPool();

    // Check if column exists
    const checkRes = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = 'ALTERNATIVE_PASSWORD'
    `);

    if (checkRes.recordset.length === 0) {
      console.log("Column ALTERNATIVE_PASSWORD does not exist in USERS table.");
      process.exit(0);
    }

    // Drop column
    await pool.request().query(`
      ALTER TABLE USERS
      DROP COLUMN ALTERNATIVE_PASSWORD
    `);

    console.log("Successfully dropped ALTERNATIVE_PASSWORD column from USERS table.");

    // Update user 22 password to plain text '123456'
    await pool.request().query(`
      UPDATE USERS
      SET PASSWORD = '123456'
      WHERE USER_ID = 22
    `);
    console.log("Updated USER_ID 22 password to '123456'.");

    process.exit(0);
  } catch (err) {
    console.error("Error dropping column:", err);
    process.exit(1);
  }
}

dropAlternativePassword();
