const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateDb() {
  await pool.query("UPDATE tutor_allocations SET tutor_ids = '[{\"tutorId\": 3, \"role\": 1}]' WHERE id = 1;");
  console.log("Updated tutor_allocations in Supabase");
  await pool.end();
}

updateDb();
