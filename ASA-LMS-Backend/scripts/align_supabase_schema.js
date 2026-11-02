const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function alignSchema() {
  const client = await pool.connect();
  try {
    console.log("Aligning schema columns in Supabase PostgreSQL...");

    await client.query(`
      -- 1. batches
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_code VARCHAR(100);
      UPDATE batches SET batch_code = COALESCE(batch_code, 'EXO-' || LPAD(id::text, 3, '0')) WHERE batch_code IS NULL;

      -- 2. student_allocations
      ALTER TABLE student_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE student_allocations SET created_at = COALESCE(created_date::timestamp, CURRENT_TIMESTAMP) WHERE created_at IS NULL;

      -- 3. tutor_allocations
      ALTER TABLE tutor_allocations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE tutor_allocations SET created_at = COALESCE(created_date::timestamp, CURRENT_TIMESTAMP) WHERE created_at IS NULL;

      -- 4. chat_room_members
      ALTER TABLE chat_room_members ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

      -- 5. class_schedules
      ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE class_schedules SET created_at = COALESCE(created_date::timestamp, CURRENT_TIMESTAMP) WHERE created_at IS NULL;
    `);

    // Ensure sample batch exists
    const batchRes = await client.query("SELECT id FROM batches LIMIT 1;");
    let batchId = batchRes.rows.length > 0 ? batchRes.rows[0].id : null;

    if (!batchId) {
      const newBatch = await client.query(`
        INSERT INTO batches (batch_name, batch_code, start_date, end_date, is_active)
        VALUES ('Exocross Batch A', 'EXO-BATCH-001', CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 1)
        RETURNING id;
      `);
      batchId = newBatch.rows[0].id;
      console.log(`Created sample batch with id: ${batchId}`);
    } else {
      await client.query("UPDATE batches SET batch_code = 'EXO-BATCH-001' WHERE id = $1 AND (batch_code IS NULL OR batch_code = '');", [batchId]);
    }

    // Ensure sample tutor allocation for tutor israel210904 (user_id 3)
    const tutorAlloc = await client.query("SELECT id FROM tutor_allocations WHERE batch_id = $1;", [batchId]);
    if (tutorAlloc.rows.length === 0) {
      // Tutor Israel is user 3 (host: role 1)
      const tutorJson = JSON.stringify([{ TUTOR_ID: 3, ROLE: 1 }]);
      await client.query(`
        INSERT INTO tutor_allocations (batch_id, tutor_ids, created_date, created_at)
        VALUES ($1, $2, CURRENT_DATE, CURRENT_TIMESTAMP);
      `, [batchId, tutorJson]);
      console.log("Allocated Tutor 3 (israel210904) to batch", batchId);
    }

    // Ensure sample student allocation for student arun.kumar01 (user_id 5)
    const studentAlloc = await client.query("SELECT id FROM student_allocations WHERE batch_id = $1 AND student_id = 5;", [batchId]);
    if (studentAlloc.rows.length === 0) {
      await client.query(`
        INSERT INTO student_allocations (batch_id, student_id, is_active, created_date, created_at)
        VALUES ($1, 5, 1, CURRENT_DATE, CURRENT_TIMESTAMP);
      `, [batchId]);
      console.log("Allocated Student 5 (arun.kumar01) to batch", batchId);
    }

    // Ensure sample chat room exists for batch
    const chatRoom = await client.query("SELECT room_id FROM chat_rooms WHERE batch_id = $1;", [batchId]);
    if (chatRoom.rows.length === 0) {
      await client.query(`
        INSERT INTO chat_rooms (room_id, batch_id, room_name, created_by, is_active)
        VALUES (101, $1, 'Batch Discussion', 1, 1);
      `, [batchId]);
      console.log("Created chat room 101");
    }

    console.log("✅ Schema alignment and sample allocations completed successfully!");
  } catch (err) {
    console.error("❌ Schema alignment failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

alignSchema();
