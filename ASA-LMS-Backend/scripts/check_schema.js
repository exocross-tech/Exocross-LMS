const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const tables = [
    "batches",
    "chat_rooms",
    "chat_room_members",
    "tutor_allocations",
    "student_allocations",
    "class_schedules",
  ];
  for (const t of tables) {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1;`,
      [t]
    );
    console.log(t, "->", res.rows.map((r) => r.column_name).join(", "));
  }
  await pool.end();
}
check();
