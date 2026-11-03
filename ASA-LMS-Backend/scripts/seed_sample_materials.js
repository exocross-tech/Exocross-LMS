const { connectDB, getPool } = require('../config/database');

async function seed() {
  await connectDB();
  const pool = getPool();
  const insMat = await pool.query(`
    INSERT INTO course_materials (title, description, files, batch_id, module_id, created_by, created_at)
    VALUES (
      'Module 1: Principles of Flight & Avionics',
      'Comprehensive reference guide covering drone flight mechanics, aerodynamic stability, telemetry systems, and rotor dynamics.',
      '[{"ORIGINAL_NAME":"Flight_Dynamics_Guide.pdf","FILE_NAME":"Flight_Dynamics_Guide.pdf","FILE_PATH":"uploads/materials/sample.pdf","FILE_SIZE":245890,"FORMAT":"PDF","TYPE":"PDF"}]',
      1,
      1,
      'ADMIN',
      NOW()
    ) RETURNING id;
  `);
  const newId = insMat.recordset[0].ID;
  await pool.query(`
    INSERT INTO course_material_batches (material_id, batch_id, created_at)
    VALUES (${newId}, 1, NOW());
  `);
  console.log("Seeded sample course material with ID:", newId);
  process.exit(0);
}

seed();
