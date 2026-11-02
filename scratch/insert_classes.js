const { connectDB } = require('../ASA-LMS-Backend/config/database');
const sql = require('../ASA-LMS-Backend/node_modules/mssql');

async function insertClasses() {
  const pool = await connectDB();

  const batchResult = await pool.request()
    .input('BATCH_CODE', sql.NVarChar, 'BC-1678')
    .query('SELECT ID, BATCH_CODE, BATCH_NAME FROM BATCHES WHERE BATCH_CODE = @BATCH_CODE');

  if (batchResult.recordset.length === 0) {
    throw new Error('Batch BC-1678 not found');
  }

  const batch = batchResult.recordset[0];
  console.log(`Found Batch: ID=${batch.ID}, Code=${batch.BATCH_CODE}`);

  const classesToInsert = [
    {
      topic: 'Introduction to Aerodynamics & Airframes',
      classDate: '2026-10-16',
      classTime: '10:00:00',
      meetCode: 'aero-dyn-101',
      meetLink: 'https://meet.google.com/aero-dyn-101',
      meetId: 'spaces/aero-dyn-101',
      tutorId: 22,
    },
    {
      topic: 'Avionics & Sensor Calibration',
      classDate: '2026-10-19',
      classTime: '11:30:00',
      meetCode: 'avio-sen-102',
      meetLink: 'https://meet.google.com/avio-sen-102',
      meetId: 'spaces/avio-sen-102',
      tutorId: 22,
    },
    {
      topic: 'Propulsion Systems & Motor Dynamics',
      classDate: '2026-10-22',
      classTime: '14:00:00',
      meetCode: 'prop-mot-103',
      meetLink: 'https://meet.google.com/prop-mot-103',
      meetId: 'spaces/prop-mot-103',
      tutorId: 22,
    },
    {
      topic: 'Autonomous Flight Control & Telemetry',
      classDate: '2026-10-26',
      classTime: '10:30:00',
      meetCode: 'auto-flt-104',
      meetLink: 'https://meet.google.com/auto-flt-104',
      meetId: 'spaces/auto-flt-104',
      tutorId: 22,
    },
    {
      topic: 'Flight Testing, Simulation & Mission Review',
      classDate: '2026-10-29',
      classTime: '15:00:00',
      meetCode: 'test-mis-105',
      meetLink: 'https://meet.google.com/test-mis-105',
      meetId: 'spaces/test-mis-105',
      tutorId: 22,
    },
  ];

  const inserted = [];

  for (const cls of classesToInsert) {
    // Check if already exists
    const check = await pool.request()
      .input('BATCH_ID', sql.Int, batch.ID)
      .input('CLASS_DATE', sql.Date, cls.classDate)
      .input('CLASS_TIME', sql.VarChar(8), cls.classTime)
      .query(`
        SELECT ID, TOPIC FROM CLASS_SCHEDULES
        WHERE BATCH_ID = @BATCH_ID AND CLASS_DATE = @CLASS_DATE AND CLASS_TIME = @CLASS_TIME
      `);

    if (check.recordset.length > 0) {
      console.log(`Class already exists for ${cls.classDate} ${cls.classTime}: ID=${check.recordset[0].ID}`);
      inserted.push(check.recordset[0]);
      continue;
    }

    const insertRes = await pool.request()
      .input('TOPIC', sql.NVarChar(200), cls.topic)
      .input('BATCH_ID', sql.Int, batch.ID)
      .input('CLASS_DATE', sql.Date, cls.classDate)
      .input('CLASS_TIME', sql.VarChar(8), cls.classTime)
      .input('MEET_ID', sql.NVarChar(500), cls.meetId)
      .input('MEET_CODE', sql.NVarChar(550), cls.meetCode)
      .input('MEET_LINK', sql.NVarChar(2500), cls.meetLink)
      .input('IS_ACTIVE', sql.Int, 1)
      .input('CREATED_BY', sql.NVarChar(50), 'ADMIN')
      .input('TUTOR_ID', sql.Int, cls.tutorId)
      .query(`
        INSERT INTO CLASS_SCHEDULES
          (TOPIC, BATCH_ID, CLASS_DATE, CLASS_TIME, MEET_ID, MEET_CODE, MEET_LINK, IS_ACTIVE, CREATED_BY, CREATED_AT, TUTOR_ID)
        OUTPUT
          INSERTED.ID, INSERTED.TOPIC, INSERTED.BATCH_ID, INSERTED.CLASS_DATE, INSERTED.CLASS_TIME, INSERTED.MEET_LINK, INSERTED.IS_ACTIVE, INSERTED.TUTOR_ID
        VALUES
          (@TOPIC, @BATCH_ID, @CLASS_DATE, @CLASS_TIME, @MEET_ID, @MEET_CODE, @MEET_LINK, @IS_ACTIVE, @CREATED_BY, GETDATE(), @TUTOR_ID)
      `);

    console.log('Inserted class:', insertRes.recordset[0]);
    inserted.push(insertRes.recordset[0]);
  }

  console.log(`\nSuccessfully processed ${inserted.length} classes for Batch ${batch.BATCH_CODE}!`);
  process.exit(0);
}

insertClasses().catch(err => {
  console.error('Insertion failed:', err);
  process.exit(1);
});
