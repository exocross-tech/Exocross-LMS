const { connectDB } = require('../ASA-LMS-Backend/config/database');

async function checkUser() {
  const pool = await connectDB();
  
  const users = await pool.request().query(`
    SELECT USER_ID, USERNAME, EMAIL_ID, MOBILE_NO, PASSWORD, ALTERNATIVE_PASSWORD, USER_TYPE, IS_ACTIVE
    FROM USERS
    WHERE EMAIL_ID LIKE '%isravel%' OR USERNAME LIKE '%isravel%'
  `);
  console.log("MATCHING USERS:", JSON.stringify(users.recordset, null, 2));

  // Also check TUTORS table if separate
  try {
    const tutors = await pool.request().query(`
      SELECT * FROM TUTORS WHERE EMAIL LIKE '%isravel%' OR EMAIL_ID LIKE '%isravel%' OR NAME LIKE '%isravel%'
    `);
    console.log("MATCHING TUTORS:", JSON.stringify(tutors.recordset, null, 2));
  } catch (e) {
    console.log("No matching tutors or column mismatch:", e.message);
  }

  process.exit(0);
}

checkUser().catch(err => {
  console.error(err);
  process.exit(1);
});
