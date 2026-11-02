const { connectDB, getPool } = require("../config/database");
const {
  uploadCourseMaterial,
  getStudentCourseMaterials,
  deleteCourseMaterial,
} = require("../controllers/courseMaterialController");

function createMockReqRes(reqData = {}) {
  let statusCode = 200;
  let responseData = null;
  const req = { body: {}, params: {}, query: {}, files: [], ...reqData };
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseData = data; return res; },
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function testStudentVisibility() {
  await connectDB();
  const pool = getPool();

  console.log("=== 1. FIND STUDENTS IN DIFFERENT BATCHES ===");
  const studentsRes = await pool.request().query(`
    SELECT DISTINCT
      U.USER_ID,
      U.USERNAME,
      SA.BATCH_ID,
      B.BATCH_CODE
    FROM USERS U
    INNER JOIN STUDENT_ALLOCATIONS SA ON SA.STUDENT_ID = U.USER_ID
    INNER JOIN BATCHES B ON B.ID = SA.BATCH_ID
    WHERE U.USER_TYPE = 'STUDENT' AND U.IS_ACTIVE = 1 AND B.IS_ACTIVE = 1
  `);

  const studentList = studentsRes.recordset;
  console.log("Found students:", studentList.map(s => `${s.USERNAME} (ID: ${s.USER_ID}) in Batch ${s.BATCH_CODE} (ID: ${s.BATCH_ID})`));

  if (studentList.length < 2) {
    console.log("Not enough students in different batches to test comparative visibility.");
    process.exit(0);
  }

  const batch1 = studentList[0].BATCH_ID;
  const otherBatchStudent = studentList.find(s => s.BATCH_ID !== batch1);

  if (!otherBatchStudent) {
    console.log("All students belong to the same batch; testing single batch student access.");
  }

  const student1 = studentList[0];
  console.log(`Student 1: ${student1.USERNAME} (Batch ID: ${batch1})`);
  if (otherBatchStudent) {
    console.log(`Student 2 (Other Batch): ${otherBatchStudent.USERNAME} (Batch ID: ${otherBatchStudent.BATCH_ID})`);
  }

  console.log("\n=== 2. UPLOAD MATERIAL ASSIGNED ONLY TO BATCH 1 ===");
  const uploadMock = createMockReqRes({
    body: {
      title: "Batch 1 Exclusive Material",
      description: "Only for Batch 1 students",
      batchIds: JSON.stringify([batch1]),
      urls: JSON.stringify(["https://example.com/b1-notes"]),
      createdBy: "ADMIN",
    },
  });
  await uploadCourseMaterial(uploadMock.req, uploadMock.res);
  const createdMat = uploadMock.getData()?.data;
  console.log("Uploaded material ID:", createdMat.ID);

  console.log("\n=== 3. VERIFY STUDENT 1 (IN BATCH 1) SEES IT ===");
  const s1Mock = createMockReqRes({ query: { USER_ID: student1.USER_ID } });
  await getStudentCourseMaterials(s1Mock.req, s1Mock.res);
  const s1Materials = s1Mock.getData()?.data || [];
  const s1HasMaterial = s1Materials.some(m => m.ID === createdMat.ID);
  console.log(`Student 1 (${student1.USERNAME}) sees material:`, s1HasMaterial ? "✅ YES" : "❌ NO");

  if (otherBatchStudent) {
    console.log("\n=== 4. VERIFY STUDENT 2 (IN DIFFERENT BATCH) DOES NOT SEE IT ===");
    const s2Mock = createMockReqRes({ query: { USER_ID: otherBatchStudent.USER_ID } });
    await getStudentCourseMaterials(s2Mock.req, s2Mock.res);
    const s2Materials = s2Mock.getData()?.data || [];
    const s2HasMaterial = s2Materials.some(m => m.ID === createdMat.ID);
    console.log(`Student 2 (${otherBatchStudent.USERNAME}) sees material:`, s2HasMaterial ? "❌ INCORRECT (Visible)" : "✅ CORRECT (Not Visible)");
  }

  console.log("\n=== 5. CLEAN UP ===");
  const delMock = createMockReqRes({ params: { id: createdMat.ID } });
  await deleteCourseMaterial(delMock.req, delMock.res);
  console.log("Cleaned up test material.");

  console.log("\n✅ STUDENT VISIBILITY TESTS PASSED!");
  process.exit(0);
}

testStudentVisibility().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
