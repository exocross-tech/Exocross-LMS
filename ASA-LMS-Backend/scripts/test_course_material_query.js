const { connectDB, getPool } = require("../config/database");

async function testQueries() {
  await connectDB();
  const pool = getPool();

  const res = await pool.request().query(`
    SELECT
      CM.ID,
      CM.BATCH_ID,
      CM.TITLE,
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
  `);
  console.log("Query result count:", res.recordset.length);
  console.log("Query sample:", res.recordset);

  process.exit(0);
}

testQueries().catch((e) => {
  console.error(e);
  process.exit(1);
});
