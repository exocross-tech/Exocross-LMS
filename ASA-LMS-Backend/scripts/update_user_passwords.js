const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const supabaseUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:ExocrossPass2026@db.aubiybxrmejgoyczlxrc.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: supabaseUrl,
  ssl: { rejectUnauthorized: false },
});

const userCredentials = [
  { email_id: "isravel@gmail.com", pass: "isravel@2004" },
  { email_id: "rajesh@gmail.com", pass: "123456" },
  { email_id: "israel210904@gmail.com", pass: "123456" },
  { email_id: "logan@gmail.com", pass: "123456" },
  { email_id: "arun.kumar01@gmail.com", pass: "Arun@123" },
  { email_id: "divya.selvi02@gmail.com", pass: "Divya@123" },
];

async function updatePasswords() {
  const client = await pool.connect();
  try {
    console.log("Updating user passwords in Supabase PostgreSQL...");
    for (const u of userCredentials) {
      const hashed = await bcrypt.hash(u.pass, 10);
      const res = await client.query(
        "UPDATE users SET password = $1 WHERE LOWER(email_id) = LOWER($2) OR LOWER(username) = LOWER($2)",
        [hashed, u.email_id]
      );
      console.log(`Updated ${u.email_id} (${res.rowCount} row) -> pass: ${u.pass}`);
    }
    console.log("✅ All user passwords updated with genuine bcrypt hashes!");
  } catch (err) {
    console.error("Error updating passwords:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

updatePasswords();
