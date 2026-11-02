const fs = require("fs");
const path = require("path");
const { sql } = require("../../config/database");
const { encryptFile } = require("../../utils/cryptoUtil");

const startUpload = async (req, res) => {
    try {
        const {
            fileName,
            fileSize,
            totalChunks,
            BOOK_ID,
            CHAPTER,
            CONTENT_TYPE,
            TITLE,
            ABOUT,
            DURATION,
            USER_ID
        } = req.body;

        if (!BOOK_ID || !CHAPTER || !CONTENT_TYPE || !TITLE || !USER_ID) {
            return res.status(400).json({
                status: 0,
                message: "Missing required fields"
            });
        }

        /* ================================
           1️⃣ INSERT BOOK CONTENT
        ================================ */
        const contentResult = await sql.query`
      INSERT INTO BOOK_CONTENTS (
        BOOK_ID, CHAPTER, CONTENT_TYPE, TITLE, ABOUT, DURATION,
        STATUS, CREATED_BY, CREATED_ON
      )
      OUTPUT INSERTED.ID
      VALUES (
        ${BOOK_ID},
        ${CHAPTER},
        ${CONTENT_TYPE},
        ${TITLE},
        ${ABOUT || null},
        ${DURATION || null},
        'UPLOADING',
        ${USER_ID},
        GETDATE()
      )
    `;

        const contentId = contentResult.recordset[0].ID;

        /* ================================
           2️⃣ INSERT UPLOAD SESSION
        ================================ */
        const sessionResult = await sql.query`
      INSERT INTO UPLOAD_SESSIONS (
        CONTENT_ID, FILE_NAME, FILE_SIZE, TOTAL_CHUNKS, STATUS, CREATED_ON
      )
      OUTPUT INSERTED.ID
      VALUES (
        ${contentId},
        ${fileName},
        ${fileSize},
        ${totalChunks},
        'UPLOADING',
        GETDATE()
      )
    `;

        return res.json({
            status: 1,
            contentId,
            sessionId: sessionResult.recordset[0].ID
        });

    } catch (err) {
        console.error("START UPLOAD ERROR 👉", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};

const uploadChunk = async (req, res) => {
    const { sessionId, chunkIndex } = req.body;

    if (!req.file || !sessionId || chunkIndex === undefined) {
        return res.status(400).json({
            status: 0,
            message: "Invalid chunk data"
        });
    }

    const chunkDir = path.join(__dirname, `../../uploads/chunks/${sessionId}`);
    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `${chunkIndex}.part`);
    fs.renameSync(req.file.path, chunkPath);

    await sql.query`
    INSERT INTO UPLOAD_CHUNKS (SESSION_ID, CHUNK_INDEX)
    VALUES (${sessionId}, ${chunkIndex})
  `;

    await sql.query`
    UPDATE UPLOAD_SESSIONS
    SET UPLOADED_CHUNKS = UPLOADED_CHUNKS + 1,
        UPDATED_ON = GETDATE()
    WHERE ID = ${sessionId}
  `;

    res.json({ status: 1 });
};

const resumeUpload = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;

        const result = await sql.query`
      SELECT CHUNK_INDEX FROM UPLOAD_CHUNKS
      WHERE SESSION_ID = ${sessionId}
    `;

        res.json({
            status: 1,
            uploadedChunks: result.recordset.map(r => r.CHUNK_INDEX)
        });
    } catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
};

const completeUpload = async (req, res) => {
    try {
        const { sessionId } = req.body;

        /* ===============================
           1️⃣ FETCH SESSION
        =============================== */
        const sessionRes = await sql.query`
            SELECT * FROM UPLOAD_SESSIONS WHERE ID = ${sessionId}
        `;

        if (!sessionRes.recordset.length) {
            return res.status(404).json({ status: 0, message: "Session not found" });
        }

        const s = sessionRes.recordset[0];

        if (s.UPLOADED_CHUNKS !== s.TOTAL_CHUNKS) {
            return res.status(400).json({
                status: 0,
                message: "Upload incomplete"
            });
        }

        /* ===============================
           2️⃣ MERGE CHUNKS
        =============================== */
        const chunkDir = path.join(__dirname, `../../uploads/chunks/${sessionId}`);
        const tempFilePath = path.join(chunkDir, "temp_merge");

        const chunkFiles = fs.readdirSync(chunkDir)
            .filter(f => f !== "temp_merge")
            .sort((a, b) => Number(a) - Number(b));

        const writeStream = fs.createWriteStream(tempFilePath);

        for (const file of chunkFiles) {
            writeStream.write(
                fs.readFileSync(path.join(chunkDir, file))
            );
        }

        writeStream.end();
        await new Promise(resolve => writeStream.on("finish", resolve));

        /* ===============================
           3️⃣ FINAL TARGET (SW vs OTHERS)
        =============================== */
        let targetDir;
        let finalFileName;
        let isEncrypted = true;

        if (s.CONTENT_TYPE === "SW") {
            targetDir = path.join(__dirname, "../../uploads/applications");
            isEncrypted = false;
            finalFileName = `app_${s.CONTENT_ID}${path.extname(s.ORIGINAL_NAME)}`;
        } else {
            targetDir = path.join(__dirname, "../../uploads/contents/encrypted");
            finalFileName = `content_${s.CONTENT_ID}.enc`;
        }

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const finalPath = path.join(targetDir, finalFileName);

        if (isEncrypted) {
            await encryptFile(tempFilePath, finalPath);
        } else {
            fs.copyFileSync(tempFilePath, finalPath);
        }

        /* ===============================
           4️⃣ UPDATE EXISTING BOOK_CONTENTS
        =============================== */
        await sql.query`
            UPDATE BOOK_CONTENTS
            SET
                CONTENT_PATH = ${finalFileName},
                STATUS = 'COMPLETED',
                UPDATED_BY = ${s.CREATED_BY},
                UPDATED_ON = GETDATE()
            WHERE ID = ${s.CONTENT_ID}
        `;

        /* ===============================
           5️⃣ MARK SESSION COMPLETED
        =============================== */
        await sql.query`
            UPDATE UPLOAD_SESSIONS
            SET STATUS = 'COMPLETED', UPDATED_ON = GETDATE()
            WHERE ID = ${sessionId}
        `;

        /* ===============================
           6️⃣ CLEANUP
        =============================== */
        try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(chunkDir)) {
                fs.rmSync(chunkDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.warn("Cleanup warning:", e.message);
        }

        return res.json({
            status: 1,
            message: "Upload completed successfully",
            contentPath: finalFileName
        });

    } catch (err) {
        console.error("Complete upload error:", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};

const cancelUpload = async (req, res) => {
    try {
        const { sessionId } = req.body;

        await sql.query`
      UPDATE UPLOAD_SESSIONS
      SET STATUS = 'FAILED', UPDATED_ON = GETDATE()
      WHERE ID = ${sessionId}
    `;

        const chunkDir = path.join(__dirname, `../../uploads/chunks/${sessionId}`);
        if (fs.existsSync(chunkDir)) {
            fs.rmSync(chunkDir, { recursive: true, force: true });
        }

        res.json({ status: 1, message: "Upload cancelled" });
    } catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
};

module.exports = {
    startUpload,
    uploadChunk,
    resumeUpload,
    completeUpload,
    cancelUpload,
};