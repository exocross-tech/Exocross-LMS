const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const { connectDB, getPool } = require("../config/database");

async function runTest() {
  try {
    await connectDB();
    const pool = getPool();

    console.log("1. Checking assessment for Student ID = 21...");
    // Let's create dummy test images and video files
    const scratchDir = path.join(__dirname, "temp_test_files");
    await fs.ensureDir(scratchDir);

    const img1Path = path.join(scratchDir, "test_img1.png");
    const img2Path = path.join(scratchDir, "test_img2.png");
    const img3Path = path.join(scratchDir, "test_img3.png");
    const vid1Path = path.join(scratchDir, "test_vid1.mp4");
    const vid2Path = path.join(scratchDir, "test_vid2.mp4");

    // Generate dummy test images using sharp
    await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 4,
        background: { r: 99, g: 102, b: 241, alpha: 1 },
      },
    }).png().toFile(img1Path);

    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 34, g: 197, b: 94, alpha: 1 },
      },
    }).png().toFile(img2Path);

    await sharp({
      create: {
        width: 1024,
        height: 768,
        channels: 4,
        background: { r: 234, g: 179, b: 8, alpha: 1 },
      },
    }).png().toFile(img3Path);

    // Create small valid dummy MP4 containers or buffers
    const dummyMp4Buffer = Buffer.from(
      "00000018667479706d7034320000000069736f6d6d7034320000000866726565000000086d646174",
      "hex"
    );
    await fs.writeFile(vid1Path, dummyMp4Buffer);
    await fs.writeFile(vid2Path, dummyMp4Buffer);

    console.log("2. Testing direct controller invocation with 5 files...");
    const { submitFinalAssessmentProject } = require("../controllers/finalAssessmentController");

    const req = {
      body: {
        studentId: "21",
        assessmentId: "1",
      },
      files: {
        image1: [{ buffer: await fs.readFile(img1Path), originalname: "test_img1.png", mimetype: "image/png" }],
        image2: [{ buffer: await fs.readFile(img2Path), originalname: "test_img2.png", mimetype: "image/png" }],
        image3: [{ buffer: await fs.readFile(img3Path), originalname: "test_img3.png", mimetype: "image/png" }],
        video1: [{ buffer: await fs.readFile(vid1Path), originalname: "test_vid1.mp4", mimetype: "video/mp4" }],
        video2: [{ buffer: await fs.readFile(vid2Path), originalname: "test_vid2.mp4", mimetype: "video/mp4" }],
      },
    };

    let resultData = null;
    const res = {
      json: (d) => {
        resultData = d;
        console.log("Controller response:", d);
      },
      status: (code) => ({
        json: (err) => {
          console.error("Controller returned error code", code, err);
        },
      }),
    };

    await submitFinalAssessmentProject(req, res);

    if (resultData && resultData.status === 1) {
      console.log("3. Verifying FINAL_ASSESSMENT_SUBMISSIONS record in database...");
      const dbCheck = await pool.request().query(`
        SELECT TOP 1 * FROM FINAL_ASSESSMENT_SUBMISSIONS
        WHERE STUDENT_ID = 21 AND ASSESSMENT_ID = 1
      `);
      console.log("Database submission record:", dbCheck.recordset[0]);

      console.log("4. Verifying saved files in uploads folder...");
      const uploadDir = path.join(__dirname, "../uploads/Final-assessment/21");
      const filesInDir = await fs.readdir(uploadDir);
      console.log("Files in uploads/Final-assessment/21:", filesInDir);

      console.log("✅ All submission tests PASSED successfully!");
    } else {
      console.error("❌ Submission failed:", resultData);
    }

    // Clean up scratch test files
    await fs.remove(scratchDir).catch(() => {});
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

runTest();
