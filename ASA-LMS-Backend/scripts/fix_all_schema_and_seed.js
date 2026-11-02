const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("🛠️ Applying schema improvements to Supabase...");

    await client.query(`
      -- 1. users table
      ALTER TABLE users ADD COLUMN IF NOT EXISTS school_name VARCHAR(255) DEFAULT 'Exocross Aerospace Academy';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS grade VARCHAR(50) DEFAULT '10th Standard';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Chennai';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Tamil Nadu';
      UPDATE users SET school_name = 'Exocross Aerospace Academy' WHERE school_name IS NULL;
      UPDATE users SET grade = '10th Standard' WHERE grade IS NULL;
      UPDATE users SET district = 'Chennai' WHERE district IS NULL;
      UPDATE users SET state = 'Tamil Nadu' WHERE state IS NULL;

      -- 2. class_attendance table
      ALTER TABLE class_attendance ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE class_attendance ADD COLUMN IF NOT EXISTS class_id INT;
      ALTER TABLE class_attendance ADD COLUMN IF NOT EXISTS attendance_status INT DEFAULT 1;
      ALTER TABLE class_attendance ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';
      ALTER TABLE class_attendance ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      UPDATE class_attendance SET attendance_status = 1 WHERE attendance_status IS NULL;
      UPDATE class_attendance SET class_id = schedule_id WHERE class_id IS NULL;

      -- 3. student_attendance table
      CREATE TABLE IF NOT EXISTS student_attendance (
        id SERIAL PRIMARY KEY,
        student_id INT,
        batch_id INT,
        class_id INT,
        attendance_status INT DEFAULT 1,
        attendance_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. notifications table
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_id INT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by INT DEFAULT 1;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
      UPDATE notifications SET notification_id = id WHERE notification_id IS NULL;

      -- 5. assignment_alerts table
      ALTER TABLE assignment_alerts ADD COLUMN IF NOT EXISTS assignment_id INT;
      ALTER TABLE assignment_alerts ADD COLUMN IF NOT EXISTS set_id INT;
      ALTER TABLE assignment_alerts ADD COLUMN IF NOT EXISTS module_id INT;
      UPDATE assignment_alerts SET assignment_id = id WHERE assignment_id IS NULL;

      -- 6. class_schedules table
      ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS meet_id VARCHAR(255);
      ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS tutor_id INT DEFAULT 3;
      UPDATE class_schedules SET meet_id = meet_code WHERE meet_id IS NULL;

      -- 6. course_materials & batches
      ALTER TABLE course_materials ALTER COLUMN file_path DROP NOT NULL;
      ALTER TABLE course_materials ALTER COLUMN file_type DROP NOT NULL;
      ALTER TABLE course_materials ALTER COLUMN created_by DROP DEFAULT;
      ALTER TABLE course_materials ALTER COLUMN created_by TYPE VARCHAR(50) USING created_by::text;
      ALTER TABLE course_materials ALTER COLUMN created_by SET DEFAULT 'ADMIN';
      UPDATE course_materials SET created_by = 'ADMIN' WHERE created_by IS NULL OR created_by = '1';
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS files TEXT;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS module_id INT;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;

      CREATE TABLE IF NOT EXISTS course_material_batches (
        id SERIAL PRIMARY KEY,
        material_id INT,
        batch_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE course_material_batches ADD COLUMN IF NOT EXISTS material_id INT;
      ALTER TABLE course_material_batches ADD COLUMN IF NOT EXISTS batch_id INT;
    `);
    console.log("✅ Schema columns and tables aligned!");

    console.log("🌱 Seeding realistic test data for all pages...");

    // Batch verification
    const batchRes = await client.query("SELECT id FROM batches WHERE is_active = 1 LIMIT 1;");
    const batchId = batchRes.rows[0].id;

    // 1. Modules
    const modRes = await client.query("SELECT id FROM modules LIMIT 1;");
    let moduleId = modRes.rows.length > 0 ? modRes.rows[0].id : null;
    if (!moduleId) {
      const newMod = await client.query(`
        INSERT INTO modules (module_name, module_code, description, is_active)
        VALUES ('Introduction to Aeronautics & Drone Mechanics', 'AERO-101', 'Foundations of flight and aerospace design', 1)
        RETURNING id;
      `);
      moduleId = newMod.rows[0].id;
      console.log("Created module id:", moduleId);
    }

    // 2. Class Schedules (Upcoming classes)
    const schedCount = await client.query("SELECT COUNT(*) FROM class_schedules WHERE batch_id = $1;", [batchId]);
    if (parseInt(schedCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO class_schedules (batch_id, class_date, class_time, topic, meet_link, meet_code, is_active, created_by, created_at)
        VALUES 
        ($1, CURRENT_DATE, '10:00:00', 'Introduction to Aerodynamics & Airfoils', 'https://meet.google.com/exo-aero-001', 'exo-aero-001', 1, 1, CURRENT_TIMESTAMP),
        ($1, CURRENT_DATE + INTERVAL '1 day', '14:30:00', 'Drone Avionics & Microcontroller Interfacing', 'https://meet.google.com/exo-aero-002', 'exo-aero-002', 1, 1, CURRENT_TIMESTAMP),
        ($1, CURRENT_DATE + INTERVAL '2 days', '11:00:00', 'Propulsion Systems & Rocket Dynamics', 'https://meet.google.com/exo-aero-003', 'exo-aero-003', 1, 1, CURRENT_TIMESTAMP);
      `, [batchId]);
      console.log("Seeded 3 upcoming class schedules for batch:", batchId);
    }

    // 3. Course Materials
    const matCount = await client.query("SELECT COUNT(*) FROM course_materials WHERE batch_id = $1;", [batchId]);
    if (parseInt(matCount.rows[0].count, 10) === 0) {
      const filesJson = JSON.stringify([
        { name: "aerodynamics_handbook.pdf", url: "/uploads/aerodynamics_handbook.pdf", size: "2.4 MB" }
      ]);
      const mat = await client.query(`
        INSERT INTO course_materials (title, description, files, batch_id, module_id, created_by, is_active, created_at)
        VALUES ('Module 1: Flight Dynamics Handbook', 'Essential reference reading for airfoils and lift coefficients', $1, $2, $3, 1, 1, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [filesJson, batchId, moduleId]);
      const matId = mat.rows[0].id;

      await client.query(`
        INSERT INTO course_material_batches (material_id, batch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;
      `, [matId, batchId]);
      console.log("Seeded course material id:", matId);
    }

    // 4. Notifications
    const notifCount = await client.query("SELECT COUNT(*) FROM notifications;");
    if (parseInt(notifCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO notifications (user_id, batch_id, title, message, is_read, created_at)
        VALUES
        (5, $1, 'Welcome to Exocross LMS', 'Your enrollment in Aerospace Batch Alpha is active.', 0, CURRENT_TIMESTAMP),
        (3, $1, 'Teaching Schedule Assigned', 'You are assigned as Host Tutor for Batch Alpha.', 0, CURRENT_TIMESTAMP),
        (1, $1, 'System Ready', 'Exocross LMS has transitioned to Supabase Cloud Database.', 0, CURRENT_TIMESTAMP);
      `, [batchId]);
      console.log("Seeded system notifications.");
    }

    // 5. Batch Announcements
    const annCount = await client.query("SELECT COUNT(*) FROM batch_announcements;");
    if (parseInt(annCount.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO batch_announcements (batch_id, title, message, created_by, created_at)
        VALUES ($1, 'Upcoming Drone Workshop', 'Please download the Aerodynamics Handbook before the session on Wednesday.', 1, CURRENT_TIMESTAMP);
      `, [batchId]);
      console.log("Seeded batch announcement.");
    }

    // 6. Attendance records
    const attCount = await client.query("SELECT COUNT(*) FROM class_attendance WHERE batch_id = $1;", [batchId]);
    if (parseInt(attCount.rows[0].count, 10) === 0) {
      const sched = await client.query("SELECT id FROM class_schedules WHERE batch_id = $1 LIMIT 1;", [batchId]);
      const schedId = sched.rows[0].id;
      await client.query(`
        INSERT INTO class_attendance (schedule_id, student_id, batch_id, status, attendance_status, attendance_date, marked_by)
        VALUES 
        ($1, 5, $2, 'Present', 1, CURRENT_DATE, 3),
        ($1, 6, $2, 'Present', 1, CURRENT_DATE, 3);
      `, [schedId, batchId]);
      console.log("Seeded class attendance records.");
    }

    console.log("🎉 Complete schema alignment and test data seeding successful!");
  } catch (err) {
    console.error("❌ Schema and seed error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
