const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

// 1. Supabase JS Client (for Auth, Storage, and Realtime if configured)
let supabaseClient = null;
if (supabaseUrl && supabaseKey) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
}

// 2. PostgreSQL Connection Pool (for direct, high-performance SQL queries)
let pgPool = null;

const connectSupabase = async () => {
  if (pgPool) {
    return pgPool;
  }

  if (!connectionString) {
    console.warn("⚠️ SUPABASE_DB_URL or DATABASE_URL is not set in .env. Skipping Supabase connection.");
    return null;
  }

  try {
    console.log("🔄 Connecting to Supabase PostgreSQL database...");
    
    pgPool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase SSL
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on("error", (err) => {
      console.error("❌ Supabase PostgreSQL Pool Error:", err.message);
    });

    // Test connectivity
    const client = await pgPool.connect();
    const res = await client.query("SELECT current_database(), current_user, version()");
    client.release();

    console.log("✅ Supabase PostgreSQL connected successfully!");
    console.log(`📊 Connected to DB: ${res.rows[0].current_database} as ${res.rows[0].current_user}`);
    
    return pgPool;
  } catch (err) {
    console.error("❌ Failed to connect to Supabase PostgreSQL:", err.message);
    pgPool = null;
    throw err;
  }
};

const getSupabasePool = () => pgPool;

const closeSupabase = async () => {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
};

module.exports = {
  connectSupabase,
  getSupabasePool,
  closeSupabase,
  supabaseClient,
};
