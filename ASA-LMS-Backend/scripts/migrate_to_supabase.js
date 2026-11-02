const fs = require("fs");
const path = require("path");
const { connectSupabase, closeSupabase } = require("../config/supabase");

async function runMigration() {
  console.log("🚀 Starting Supabase Database Migration for Exocross LMS...");
  
  const pool = await connectSupabase();
  if (!pool) {
    console.error("❌ Cannot migrate: SUPABASE_DB_URL is missing in .env.");
    console.error("Please add your Supabase connection string to .env and retry.");
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, "../config/supabase_schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log("📄 Reading schema from supabase_schema.sql...");
  
  try {
    await pool.query(sql);
    console.log("✅ All tables, constraints, indexes, and seed users created successfully on Supabase!");
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  } finally {
    await closeSupabase();
    process.exit(0);
  }
}

runMigration().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
