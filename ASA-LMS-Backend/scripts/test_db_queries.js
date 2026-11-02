const { connectDB, getPool, sql } = require("../config/database");
const { runCleanup } = require("../utils/classScheduleCleanup");

async function test() {
  try {
    console.log("1. Connecting DB...");
    await connectDB();
    const pool = getPool();
    console.log("Connected successfully!");

    console.log("2. Running cleanup job test...");
    await runCleanup();
    console.log("Cleanup job executed cleanly.");

    console.log("3. Testing Student Allocation query for Student ID = 21...");
    const t2 = Date.now();
    const sa = await pool.request().input("STUDENT_ID", sql.Int, 21).query(`
      SELECT TOP 1
        SA.BATCH_ID
      FROM STUDENT_ALLOCATIONS SA
      INNER JOIN BATCHES B ON B.ID = SA.BATCH_ID
      WHERE SA.STUDENT_ID = @STUDENT_ID
        AND ISNULL(B.IS_ACTIVE, 1) = 1
      ORDER BY SA.BATCH_ID
    `);
    console.log(`Student allocation query took ${Date.now() - t2}ms:`, sa.recordset);

    if (sa.recordset.length > 0) {
      const batchId = sa.recordset[0].BATCH_ID;
      console.log(`4. Testing Assignments for batch ${batchId}...`);
      const t3 = Date.now();
      const ass = await pool.request().input("BATCH_ID", sql.Int, batchId).query(`
        SELECT COUNT(*) as cnt FROM ASSIGNMENT_ALERTS WHERE BATCH_ID = @BATCH_ID
      `);
      console.log(`Assignments query took ${Date.now() - t3}ms, count:`, ass.recordset[0].cnt);

      console.log(`5. Testing Final Assessments for batch ${batchId}...`);
      const t4 = Date.now();
      const fa = await pool.request().input("BATCH_ID", sql.Int, batchId).query(`
        SELECT COUNT(*) as cnt FROM FINAL_ASSESSMENTS WHERE BATCH_ID = @BATCH_ID AND ISNULL(IS_ACTIVE, 1) = 1
      `);
      console.log(`Final assessments query took ${Date.now() - t4}ms, count:`, fa.recordset[0].cnt);
    }

    console.log("6. Testing 20 concurrent queries across the pool...");
    const t5 = Date.now();
    const promises = Array.from({ length: 20 }).map((_, i) =>
      pool.request().query(`SELECT ${i} AS reqId, GETDATE() AS serverTime`)
    );
    const results = await Promise.all(promises);
    console.log(`20 concurrent queries completed in ${Date.now() - t5}ms, success:`, results.length);

    console.log("✅ All connection and concurrency tests PASSED flawlessly!");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    process.exit(0);
  }
}

test();
