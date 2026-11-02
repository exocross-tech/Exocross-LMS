const cron = require("node-cron");
const { getPool } = require("../config/database");

let isCleanupStarted = false;
let cronTask = null;

const runCleanup = async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      UPDATE CLASS_SCHEDULES WITH (ROWLOCK)
      SET IS_ACTIVE = 0
      WHERE
        IS_ACTIVE = 1
        AND DATEADD(
          HOUR,
          3,
          CAST(
            CAST(CLASS_DATE AS DATETIME)
            + CAST(CLASS_TIME AS DATETIME)
            AS DATETIME
          )
        ) <= GETDATE()
    `);

    if (result.rowsAffected[0] > 0) {
      console.log(
        `🧹 ${result.rowsAffected[0]} expired class(es) deactivated`
      );
    }
  } catch (error) {
    console.error("❌ Class schedule cleanup error:", error.message);
  }
};

const startClassScheduleCleanup = () => {
  if (isCleanupStarted) {
    return;
  }
  isCleanupStarted = true;

  // Run every 5 minutes
  cronTask = cron.schedule("*/5 * * * *", async () => {
    await runCleanup();
  });

  console.log("⏰ Class schedule cleanup job started");
};

const stopClassScheduleCleanup = () => {
  if (cronTask) {
    try {
      cronTask.stop();
    } catch (_) {}
    cronTask = null;
  }
  isCleanupStarted = false;
};

module.exports = {
  startClassScheduleCleanup,
  stopClassScheduleCleanup,
  runCleanup,
};