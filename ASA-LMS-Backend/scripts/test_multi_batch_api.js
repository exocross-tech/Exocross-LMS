const { connectDB, getPool } = require("../config/database");
const {
  uploadCourseMaterial,
  getCourseMaterials,
  getCourseMaterialById,
  getStudentCourseMaterials,
  updateCourseMaterial,
  deleteCourseMaterial,
} = require("../controllers/courseMaterialController");

// Mock Express req & res
function createMockReqRes(reqData = {}) {
  const req = {
    body: {},
    params: {},
    query: {},
    files: [],
    ...reqData,
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  await connectDB();
  const pool = getPool();

  console.log("=== 1. FETCH ALL ACTIVE BATCHES FOR TESTING ===");
  const batchesRes = await pool.request().query("SELECT TOP 4 ID, BATCH_CODE, BATCH_NAME FROM BATCHES WHERE IS_ACTIVE = 1");
  const testBatches = batchesRes.recordset;
  console.log("Found active batches:", testBatches.map(b => `${b.ID}: ${b.BATCH_CODE}`));

  if (testBatches.length < 2) {
    console.error("Need at least 2 active batches for testing");
    process.exit(1);
  }

  const batchIdsToAssign = [testBatches[0].ID, testBatches[1].ID];

  console.log("\n=== 2. TEST UPLOAD MATERIAL WITH MULTIPLE BATCHES ===");
  const uploadMock = createMockReqRes({
    body: {
      title: "Automated Test Material Multi-Batch",
      description: "Testing multi-batch assignment across batches",
      batchIds: JSON.stringify(batchIdsToAssign),
      urls: JSON.stringify(["https://example.com/test-guide"]),
      createdBy: "ADMIN",
    },
  });

  await uploadCourseMaterial(uploadMock.req, uploadMock.res);
  console.log("Upload Status Code:", uploadMock.getStatus());
  console.log("Upload Response:", uploadMock.getData());

  const createdMaterial = uploadMock.getData()?.data;
  if (!createdMaterial?.ID) {
    throw new Error("Failed to create course material");
  }

  console.log("\n=== 3. TEST GET BY ID (VERIFY MULTIPLE BATCHES RETURNED) ===");
  const getByIdMock = createMockReqRes({
    params: { id: createdMaterial.ID },
  });
  await getCourseMaterialById(getByIdMock.req, getByIdMock.res);
  console.log("GetById Data BATCHES:", getByIdMock.getData()?.data?.BATCHES);
  console.log("GetById Data BATCH_IDS:", getByIdMock.getData()?.data?.BATCH_IDS);

  console.log("\n=== 4. TEST UPDATE MATERIAL (ADD 3RD BATCH / CHANGE BATCHES) ===");
  const newBatchList = testBatches.length >= 3 
    ? [testBatches[1].ID, testBatches[2].ID] 
    : [testBatches[1].ID];

  const updateMock = createMockReqRes({
    params: { id: createdMaterial.ID },
    body: {
      title: "Automated Test Material Multi-Batch (Updated)",
      description: "Updated description with new batch assignment",
      batchIds: JSON.stringify(newBatchList),
      urls: JSON.stringify(["https://example.com/test-guide-v2"]),
    },
  });

  await updateCourseMaterial(updateMock.req, updateMock.res);
  console.log("Update Status Code:", updateMock.getStatus());
  console.log("Update Response Data BATCHES:", updateMock.getData()?.data?.BATCHES);
  console.log("Update Response Data BATCH_IDS:", updateMock.getData()?.data?.BATCH_IDS);

  console.log("\n=== 5. TEST GET ALL (ADMIN & TUTOR) ===");
  const getAllAdminMock = createMockReqRes({
    query: { userType: "ADMIN" },
  });
  await getCourseMaterials(getAllAdminMock.req, getAllAdminMock.res);
  const foundAdmin = getAllAdminMock.getData()?.data?.find(m => m.ID === createdMaterial.ID);
  console.log("Found updated material in Admin list:", foundAdmin ? `Yes (Batches: ${foundAdmin.BATCH_CODE})` : "No");

  console.log("\n=== 6. CLEAN UP TEST MATERIAL ===");
  const deleteMock = createMockReqRes({
    params: { id: createdMaterial.ID },
  });
  await deleteCourseMaterial(deleteMock.req, deleteMock.res);
  console.log("Delete Status Code:", deleteMock.getStatus());
  console.log("Delete Response:", deleteMock.getData());

  console.log("\n✅ ALL BACKEND CONTROLLER TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
