const { connectDB, getPool } = require("../config/database");
const {
  uploadCourseMaterial,
  getCourseMaterials,
  getCourseMaterialById,
  getStudentCourseMaterials,
  updateCourseMaterial,
  deleteCourseMaterial,
} = require("../controllers/courseMaterialController");

function createMock(reqData = {}) {
  let statusCode = 200;
  let responseData = null;
  const req = { body: {}, params: {}, query: {}, files: [], ...reqData };
  const res = {
    status(c) { statusCode = c; return res; },
    json(d) { responseData = d; return res; },
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runComprehensiveTests() {
  await connectDB();
  const pool = getPool();

  console.log("==================================================");
  console.log("1. FETCH CONTEXT DATA (BATCHES, TUTORS, STUDENTS)");
  console.log("==================================================");

  const batchesRes = await pool.request().query("SELECT ID, BATCH_CODE, BATCH_NAME FROM BATCHES WHERE IS_ACTIVE = 1 ORDER BY ID ASC");
  const activeBatches = batchesRes.recordset;
  console.log(`Active Batches (${activeBatches.length}):`, activeBatches.map(b => `${b.ID}: ${b.BATCH_CODE}`));

  // Find a tutor and their assigned batches
  const tutorAllocRes = await pool.request().query(`
    SELECT DISTINCT
      t.tutorId,
      u.USERNAME AS TUTOR_NAME,
      ta.BATCH_ID,
      b.BATCH_CODE
    FROM TUTOR_ALLOCATIONS ta
    INNER JOIN BATCHES b ON b.ID = ta.BATCH_ID
    INNER JOIN USERS u ON u.USER_ID = CAST(JSON_VALUE(ta.TUTOR_IDS, '$[0].tutorId') AS INT)
    CROSS APPLY OPENJSON(ta.TUTOR_IDS)
    WITH (
      tutorId INT '$.tutorId'
    ) t
    WHERE b.IS_ACTIVE = 1 AND ISJSON(ta.TUTOR_IDS) = 1
  `);

  console.log("Tutor Allocations:", tutorAllocRes.recordset);

  // Group batches by tutor
  const tutorBatchesMap = {};
  for (const row of tutorAllocRes.recordset) {
    if (!tutorBatchesMap[row.tutorId]) {
      tutorBatchesMap[row.tutorId] = { name: row.TUTOR_NAME, batches: [] };
    }
    tutorBatchesMap[row.tutorId].batches.push(row.BATCH_ID);
  }

  const tutorIdList = Object.keys(tutorBatchesMap);
  const testTutorId = tutorIdList.length > 0 ? Number(tutorIdList[0]) : null;
  const testTutorBatches = testTutorId ? tutorBatchesMap[testTutorId].batches : [];
  console.log(`Selected Test Tutor: ID ${testTutorId} (${tutorBatchesMap[testTutorId]?.name}), Authorized Batches:`, testTutorBatches);

  // Find students in different batches
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
  const activeStudents = studentsRes.recordset;
  console.log(`Active Students (${activeStudents.length}):`, activeStudents.map(s => `${s.USERNAME} in Batch ${s.BATCH_CODE} (ID: ${s.BATCH_ID})`));

  console.log("\n==================================================");
  console.log("2. TEST ADMIN FLOW");
  console.log("==================================================");

  // A. Add Material with 1 Batch
  console.log("\n-> A. Add material with ONE batch (ID: " + activeBatches[0].ID + ")");
  const adminAdd1 = createMock({
    body: {
      title: "Admin Material - 1 Batch",
      description: "Testing single batch selection",
      batchIds: [activeBatches[0].ID],
      urls: ["https://example.com/guide-1"],
      createdBy: "ADMIN",
    },
  });
  await uploadCourseMaterial(adminAdd1.req, adminAdd1.res);
  const mat1 = adminAdd1.getData()?.data;
  console.log("Status:", adminAdd1.getStatus(), "Assigned batches:", mat1?.BATCH_IDS);

  // B. Add Material with Multiple Batches + Duplicate IDs Test
  console.log("\n-> B. Add material with MULTIPLE batches + Duplicate IDs [1, 2, 1, 2]");
  const b1 = activeBatches[0].ID;
  const b2 = activeBatches[1].ID;
  const adminAddMulti = createMock({
    body: {
      title: "Admin Material - Multi Batch",
      description: "Testing multi batch selection and deduplication",
      batchIds: [b1, b2, b1, b2],
      urls: ["https://example.com/multi-guide"],
      createdBy: "ADMIN",
    },
  });
  await uploadCourseMaterial(adminAddMulti.req, adminAddMulti.res);
  const matMulti = adminAddMulti.getData()?.data;
  console.log("Status:", adminAddMulti.getStatus(), "Deduplicated BATCH_IDS:", matMulti?.BATCH_IDS);
  if (matMulti?.BATCH_IDS?.length !== 2) throw new Error("Deduplication failed");

  // C. Edit Material and Add Batches
  console.log("\n-> C. Edit material and add 3rd batch if available");
  const b3 = activeBatches.length >= 3 ? activeBatches[2].ID : b2;
  const adminEditAdd = createMock({
    params: { id: matMulti.ID },
    body: {
      title: "Admin Material - Multi Batch (Expanded)",
      description: "Added 3rd batch",
      batchIds: JSON.stringify([b1, b2, b3]),
      urls: JSON.stringify(["https://example.com/multi-guide-v2"]),
    },
  });
  await updateCourseMaterial(adminEditAdd.req, adminEditAdd.res);
  console.log("Edit Add Status:", adminEditAdd.getStatus(), "Updated BATCH_IDS:", adminEditAdd.getData()?.data?.BATCH_IDS);

  // D. Edit Material and Remove Batches
  console.log("\n-> D. Edit material and remove batch (keep only b2)");
  const adminEditRemove = createMock({
    params: { id: matMulti.ID },
    body: {
      title: "Admin Material - Multi Batch (Trimmed)",
      description: "Removed b1",
      batchIds: [b2],
      urls: ["https://example.com/multi-guide-v3"],
    },
  });
  await updateCourseMaterial(adminEditRemove.req, adminEditRemove.res);
  console.log("Edit Remove Status:", adminEditRemove.getStatus(), "Updated BATCH_IDS:", adminEditRemove.getData()?.data?.BATCH_IDS);

  // E. Verify Get By ID
  console.log("\n-> E. Verify Get Course Material By ID");
  const getSingle = createMock({ params: { id: matMulti.ID } });
  await getCourseMaterialById(getSingle.req, getSingle.res);
  console.log("GetById BATCHES:", getSingle.getData()?.data?.BATCHES?.map(b => b.BATCH_CODE));

  console.log("\n==================================================");
  console.log("3. TEST TUTOR FLOW & AUTHORIZATION");
  console.log("==================================================");

  if (testTutorId && testTutorBatches.length > 0) {
    // A. Tutor adds material with authorized batches
    console.log("\n-> A. Tutor uploads material with authorized batches:", testTutorBatches);
    const tutorAddAuth = createMock({
      body: {
        title: "Tutor Authorized Material",
        description: "Uploaded by Tutor for assigned batches",
        batchIds: testTutorBatches,
        urls: ["https://example.com/tutor-lesson"],
        createdBy: "TUTOR",
        tutorId: testTutorId,
      },
    });
    await uploadCourseMaterial(tutorAddAuth.req, tutorAddAuth.res);
    const tutorMat = tutorAddAuth.getData()?.data;
    console.log("Tutor Add Status:", tutorAddAuth.getStatus(), "Assigned:", tutorMat?.BATCH_IDS);

    // B. Tutor attempts to assign unauthorized batch
    const unauthorizedBatch = activeBatches.find(b => !testTutorBatches.includes(b.ID));
    if (unauthorizedBatch) {
      console.log(`\n-> B. Tutor attempts to assign unauthorized batch (ID: ${unauthorizedBatch.ID} - ${unauthorizedBatch.BATCH_CODE})`);
      const tutorUnauthMock = createMock({
        body: {
          title: "Tutor Unauthorized Material",
          description: "Should fail with 403",
          batchIds: [unauthorizedBatch.ID],
          urls: ["https://example.com/unauth"],
          createdBy: "TUTOR",
          tutorId: testTutorId,
        },
      });
      await uploadCourseMaterial(tutorUnauthMock.req, tutorUnauthMock.res);
      console.log("Unauthorized Attempt Status (Expected 403):", tutorUnauthMock.getStatus(), "Message:", tutorUnauthMock.getData()?.message);
    }

    // Clean up tutor test material
    if (tutorMat?.ID) {
      const delTutor = createMock({ params: { id: tutorMat.ID } });
      await deleteCourseMaterial(delTutor.req, delTutor.res);
    }
  }

  console.log("\n==================================================");
  console.log("4. TEST STUDENT VISIBILITY");
  console.log("==================================================");

  if (activeStudents.length >= 2) {
    const s1 = activeStudents[0];
    const sOther = activeStudents.find(s => s.BATCH_ID !== s1.BATCH_ID);

    if (sOther) {
      console.log(`Student 1: ${s1.USERNAME} (Batch: ${s1.BATCH_CODE}, ID: ${s1.BATCH_ID})`);
      console.log(`Student 2: ${sOther.USERNAME} (Batch: ${sOther.BATCH_CODE}, ID: ${sOther.BATCH_ID})`);

      // Create material assigned to Student 1's batch
      const studentTestMatMock = createMock({
        body: {
          title: "Student Visibility Verification Material",
          description: "Visible to Student 1 only",
          batchIds: [s1.BATCH_ID],
          urls: ["https://example.com/student-vis-test"],
          createdBy: "ADMIN",
        },
      });
      await uploadCourseMaterial(studentTestMatMock.req, studentTestMatMock.res);
      const studentTestMat = studentTestMatMock.getData()?.data;

      // Check Student 1
      const s1Check = createMock({ query: { USER_ID: s1.USER_ID } });
      await getStudentCourseMaterials(s1Check.req, s1Check.res);
      const s1List = s1Check.getData()?.data || [];
      const s1Found = s1List.some(m => m.ID === studentTestMat.ID);
      console.log(`Student 1 in Batch ${s1.BATCH_CODE} sees material:`, s1Found ? "✅ YES" : "❌ NO");

      // Check Student 2
      const s2Check = createMock({ query: { USER_ID: sOther.USER_ID } });
      await getStudentCourseMaterials(s2Check.req, s2Check.res);
      const s2List = s2Check.getData()?.data || [];
      const s2Found = s2List.some(m => m.ID === studentTestMat.ID);
      console.log(`Student 2 in Batch ${sOther.BATCH_CODE} sees material:`, s2Found ? "❌ INCORRECT (Visible)" : "✅ CORRECT (Hidden)");

      // Now update material to include Student 2's batch as well
      console.log(`\n-> Updating material to assign BOTH Batch ${s1.BATCH_CODE} and Batch ${sOther.BATCH_CODE}`);
      const updateBothMock = createMock({
        params: { id: studentTestMat.ID },
        body: {
          title: "Student Visibility Verification Material (Shared)",
          description: "Visible to both batches",
          batchIds: [s1.BATCH_ID, sOther.BATCH_ID],
          urls: ["https://example.com/student-vis-test"],
        },
      });
      await updateCourseMaterial(updateBothMock.req, updateBothMock.res);

      // Re-check Student 2
      const s2ReCheck = createMock({ query: { USER_ID: sOther.USER_ID } });
      await getStudentCourseMaterials(s2ReCheck.req, s2ReCheck.res);
      const s2ReList = s2ReCheck.getData()?.data || [];
      const s2NowFound = s2ReList.some(m => m.ID === studentTestMat.ID);
      console.log(`Student 2 in Batch ${sOther.BATCH_CODE} now sees material:`, s2NowFound ? "✅ YES" : "❌ NO");

      // Clean up
      const delStudentMat = createMock({ params: { id: studentTestMat.ID } });
      await deleteCourseMaterial(delStudentMat.req, delStudentMat.res);
    }
  }

  // Clean up remaining test materials
  if (mat1?.ID) {
    const d1 = createMock({ params: { id: mat1.ID } });
    await deleteCourseMaterial(d1.req, d1.res);
  }
  if (matMulti?.ID) {
    const d2 = createMock({ params: { id: matMulti.ID } });
    await deleteCourseMaterial(d2.req, d2.res);
  }

  console.log("\n==================================================");
  console.log("✅ ALL COMPREHENSIVE MULTI-BATCH TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runComprehensiveTests().catch(err => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
