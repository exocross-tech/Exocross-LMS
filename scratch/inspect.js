const { connectDB } = require('../ASA-LMS-Backend/config/database');

async function main() {
  const pool = await connectDB();
  const defRes = await pool.request().query(`
    SELECT COLUMN_NAME, COLUMN_DEFAULT, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'CLASS_SCHEDULES'
  `);
  console.log("DEFAULTS:", JSON.stringify(defRes.recordset, null, 2));

  const allCS = await pool.request().query(`
    SELECT TOP 10 ID, TOPIC, BATCH_ID, CLASS_DATE, CLASS_TIME, IS_ACTIVE, TUTOR_ID, MEET_LINK
    FROM CLASS_SCHEDULES
    ORDER BY ID DESC
  `);
  console.log("RECENT CS:", JSON.stringify(allCS.recordset, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
