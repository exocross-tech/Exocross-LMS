const { getPool } = require("../config/database");
const sql = require("mssql");

async function previewAndMigrate(doExecute = false) {
  const pool = await getPool();
  const res = await pool.request().query(`
    SELECT USER_ID, USERNAME, EMAIL_ID, ROLL_NO
    FROM USERS
    WHERE USER_TYPE = 'STUDENT' AND ROLL_NO IS NOT NULL
    ORDER BY USER_ID
  `);

  const plan = [];
  const assigned = new Set();

  for (const r of res.recordset) {
    let target = null;
    const trimmed = (r.ROLL_NO || "").trim();

    if (r.USER_ID === 9180) {
      target = "56-AICP-26";
    } else if (r.USER_ID === 9181) {
      target = "57-AICP-26";
    } else if (/^ASA-(\d+)-(\d+)$/i.test(trimmed)) {
      const parts = trimmed.split("-");
      target = `${parts[2].padStart(2, "0")}-AICP-${parts[1]}`;
    } else if (/^(\d+)-AICP-(\d+)$/i.test(trimmed)) {
      const parts = trimmed.split("-");
      target = `${parts[2].padStart(2, "0")}-AICP-${parts[0]}`;
    } else {
      target = trimmed;
    }

    if (assigned.has(target)) {
      throw new Error(`COLLISION DETECTED for user ${r.USER_ID} (${r.USERNAME}): ${target}`);
    }
    assigned.add(target);
    plan.push({ USER_ID: r.USER_ID, USERNAME: r.USERNAME, OLD: r.ROLL_NO, NEW: target });
  }

  console.log(`Planned updates: ${plan.length}`);
  console.log("Sample mapped rows:");
  console.log(plan.slice(0, 5));
  console.log(plan.slice(25, 30));
  console.log(plan.slice(-10));

  if (doExecute) {
    console.log("Executing transaction...");
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Step 1: Temporarily set all to a prefix to avoid intermediate unique index collisions
      for (const item of plan) {
        if (item.OLD !== item.NEW) {
          const tempReq = new sql.Request(transaction);
          tempReq.input("TEMP", sql.NVarChar(20), `T-${item.USER_ID}`);
          tempReq.input("USER_ID", sql.Int, item.USER_ID);
          await tempReq.query(`UPDATE USERS SET ROLL_NO = @TEMP WHERE USER_ID = @USER_ID`);
        }
      }

      // Step 2: Set each to its final NEW roll number
      for (const item of plan) {
        if (item.OLD !== item.NEW) {
          const finalReq = new sql.Request(transaction);
          finalReq.input("NEW_ROLL", sql.NVarChar(50), item.NEW);
          finalReq.input("USER_ID", sql.Int, item.USER_ID);
          await finalReq.query(`UPDATE USERS SET ROLL_NO = @NEW_ROLL WHERE USER_ID = @USER_ID`);
        }
      }

      await transaction.commit();
      console.log("✅ Successfully updated all student roll numbers in database!");
    } catch (err) {
      await transaction.rollback();
      console.error("❌ Transaction failed and rolled back:", err);
      throw err;
    }
  }

  process.exit(0);
}

const executeFlag = process.argv.includes("--execute");
previewAndMigrate(executeFlag).catch(err => {
  console.error(err);
  process.exit(1);
});
