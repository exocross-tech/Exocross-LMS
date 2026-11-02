const sql = require("mssql");
const { getPool } = require("../config/database");
const { broadcastToRoom } = require("../services/socketService");

const getChatRoom = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Get logged-in user ID
        // Adjust this according to your authentication middleware
        const userId =
            req.user?.USER_ID ||
            req.user?.userId ||
            req.user?.id ||
            req.query.userId ||
            req.headers["x-user-id"];

        if (!roomId) {
            return res.status(400).json({
                status: 0,
                message: "Room ID is required",
            });
        }

        if (!userId) {
            return res.status(401).json({
                status: 0,
                message: "User ID is required",
            });
        }

        const pool = getPool();

        // =========================================================
        // 1. Get Chat Room + Batch
        // =========================================================

        const roomResult = await pool
            .request()
            .input("ROOM_ID", sql.Int, roomId)
            .input("USER_ID", sql.Int, userId)
            .query(`
        SELECT
          cr.ROOM_ID,
          cr.BATCH_ID,
          cr.ROOM_NAME,
          cr.IS_ACTIVE AS ROOM_IS_ACTIVE,
          cr.CREATED_AT AS ROOM_CREATED_AT,

          b.BATCH_CODE,
          b.BATCH_NAME,
          b.START_DATE,
          b.END_DATE,
          b.IS_ACTIVE AS BATCH_IS_ACTIVE,

          (
              SELECT COUNT(DISTINCT sa.STUDENT_ID)
              FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
              WHERE sa.BATCH_ID = b.ID
          ) AS STUDENT_COUNT,

          (
              SELECT 
                  CASE 
                      WHEN MIN(u.GRADE) IS NULL THEN 'Grade 6-12'
                      WHEN MIN(u.GRADE) = MAX(u.GRADE) THEN CONCAT('Grade ', MIN(u.GRADE))
                      ELSE CONCAT('Grade ', MIN(u.GRADE), '-', MAX(u.GRADE))
                  END
              FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
              INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
              WHERE sa.BATCH_ID = b.ID AND u.GRADE IS NOT NULL AND u.GRADE <> ''
          ) AS GRADE,

          COALESCE(
              (
                  SELECT TOP 1 u.USERNAME
                  FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
                  CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
                  WITH (
                      tutorId INT '$.tutorId',
                      role NVARCHAR(50) '$.role'
                  ) t
                  INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = t.tutorId
                  WHERE ta.BATCH_ID = b.ID 
                    AND ISJSON(ta.TUTOR_IDS) = 1
                    AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
              ),
              (
                  SELECT TOP 1 u2.USERNAME
                  FROM TUTOR_ALLOCATIONS ta2 WITH (NOLOCK)
                  CROSS APPLY OPENJSON(ISNULL(ta2.TUTOR_IDS, '[]'))
                  WITH (
                      tutorId INT '$.tutorId'
                  ) t2
                  INNER JOIN USERS u2 WITH (NOLOCK) ON u2.USER_ID = t2.tutorId
                  WHERE ta2.BATCH_ID = b.ID
                    AND ISJSON(ta2.TUTOR_IDS) = 1
              ),
              'Not Assigned'
          ) AS TUTOR_NAME,

          COALESCE(
              (
                  SELECT TOP 1 
                      CASE 
                          WHEN TRY_CONVERT(INT, t_myrole.role) = 1 OR UPPER(LTRIM(RTRIM(t_myrole.role))) = 'HOST' THEN 'HOST'
                          ELSE 'SUPPORT'
                      END
                  FROM TUTOR_ALLOCATIONS ta_myrole WITH (NOLOCK)
                  CROSS APPLY OPENJSON(ISNULL(ta_myrole.TUTOR_IDS, '[]'))
                  WITH (
                      tutorId INT '$.tutorId',
                      role NVARCHAR(50) '$.role'
                  ) t_myrole
                  WHERE ta_myrole.BATCH_ID = b.ID 
                    AND ISJSON(ta_myrole.TUTOR_IDS) = 1
                    AND t_myrole.tutorId = @USER_ID
              ),
              'HOST'
          ) AS TUTOR_ROLE

        FROM CHAT_ROOMS cr

        INNER JOIN BATCHES b
          ON b.ID = cr.BATCH_ID

        WHERE cr.ROOM_ID = @ROOM_ID
      `);

        if (roomResult.recordset.length === 0) {
            return res.status(404).json({
                status: 0,
                message: "Chat room not found",
            });
        }

        const room = roomResult.recordset[0];

        // =========================================================
        // 2. Check Room Active
        // =========================================================

        if (!room.ROOM_IS_ACTIVE) {
            return res.status(400).json({
                status: 0,
                message: "Chat room is inactive",
            });
        }

        // =========================================================
        // 3. Check User
        // =========================================================

        const userResult = await pool
            .request()
            .input("USER_ID", sql.Int, userId)
            .query(`
        SELECT
          USER_ID,
          USERNAME,
          USER_TYPE,
          IS_ACTIVE
        FROM USERS
        WHERE USER_ID = @USER_ID
      `);

        if (userResult.recordset.length === 0) {
            return res.status(401).json({
                status: 0,
                message: "User not found",
            });
        }

        const user = userResult.recordset[0];

        if (!user.IS_ACTIVE) {
            return res.status(403).json({
                status: 0,
                message: "User account is inactive",
            });
        }

        // =========================================================
        // 4. Check Chat Room Access
        // =========================================================

        let hasAccess = false;

        // ADMIN can access all chat rooms
        if (user.USER_TYPE === "ADMIN") {
            hasAccess = true;
        }

        // TUTOR / STUDENT
        else {
            const memberResult = await pool
                .request()
                .input("ROOM_ID", sql.Int, roomId)
                .input("USER_ID", sql.Int, userId)
                .query(`
          SELECT TOP 1
            ID,
            ROOM_ID,
            USER_ID,
            MEMBER_TYPE,
            JOINED_AT,
            IS_ACTIVE
          FROM CHAT_ROOM_MEMBERS
          WHERE ROOM_ID = @ROOM_ID
            AND USER_ID = @USER_ID
            AND IS_ACTIVE = 1
        `);

            if (memberResult.recordset.length > 0) {
                hasAccess = true;
            }
        }

        // User is not allowed
        if (!hasAccess) {
            return res.status(403).json({
                status: 0,
                message: "You are not authorized to access this chat room",
            });
        }

        // =========================================================
        // 5. Get Room Members
        // =========================================================

        const membersResult = await pool
            .request()
            .input("ROOM_ID", sql.Int, roomId)
            .query(`
        SELECT
          crm.ID,
          crm.ROOM_ID,
          crm.USER_ID,
          u.USERNAME,
          u.USER_TYPE,
          crm.MEMBER_TYPE,
          crm.JOINED_AT,
          crm.IS_ACTIVE

        FROM CHAT_ROOM_MEMBERS crm

        INNER JOIN USERS u
          ON u.USER_ID = crm.USER_ID

        WHERE crm.ROOM_ID = @ROOM_ID
          AND crm.IS_ACTIVE = 1
          AND u.IS_ACTIVE = 1

        ORDER BY
          CASE
            WHEN crm.MEMBER_TYPE = 'TUTOR' THEN 1
            WHEN crm.MEMBER_TYPE = 'STUDENT' THEN 2
            ELSE 3
          END,
          u.USERNAME
      `);

        // =========================================================
        // 6. Get Messages
        // =========================================================

        const messagesResult = await pool
            .request()
            .input("ROOM_ID", sql.Int, roomId)
            .query(`
        SELECT
          cm.MESSAGE_ID,
          cm.ROOM_ID,
          cm.SENDER_ID,
          u.USERNAME AS SENDER_NAME,
          u.USER_TYPE AS SENDER_TYPE,
          cm.MESSAGE_TEXT,
          cm.MESSAGE_TYPE,
          cm.FILE_URL,
          cm.SENT_AT,
          cm.IS_DELETED

        FROM CHAT_MESSAGES cm

        INNER JOIN USERS u
          ON u.USER_ID = cm.SENDER_ID

        WHERE cm.ROOM_ID = @ROOM_ID
          AND cm.IS_DELETED = 0

        ORDER BY cm.SENT_AT ASC, cm.MESSAGE_ID ASC
      `);

        // =========================================================
        // 7. Response
        // =========================================================

        return res.json({
            status: 1,

            data: {
                room: {
                    ROOM_ID: room.ROOM_ID,
                    BATCH_ID: room.BATCH_ID,
                    ROOM_NAME: room.ROOM_NAME,

                    BATCH_CODE: room.BATCH_CODE,
                    BATCH_NAME: room.BATCH_NAME,

                    START_DATE: room.START_DATE,
                    END_DATE: room.END_DATE,

                    IS_ACTIVE: room.ROOM_IS_ACTIVE,
                    CREATED_AT: room.ROOM_CREATED_AT,

                    STUDENT_COUNT: room.STUDENT_COUNT || 0,
                    GRADE: room.GRADE || "All Grades",
                    TUTOR_NAME: room.TUTOR_NAME || "Not Assigned",
                    TUTOR_ROLE: room.TUTOR_ROLE || "HOST",
                },

                currentUser: {
                    USER_ID: user.USER_ID,
                    USERNAME: user.USERNAME,
                    USER_TYPE: user.USER_TYPE,
                },

                members: membersResult.recordset,

                messages: messagesResult.recordset,
            },
        });

    } catch (err) {
        console.error("getChatRoom error:", err);

        return res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};

const getChatRoomBatches = async (req, res) => {
    try {
        const pool = getPool();
        const rawTutorId = req.query.tutorId || req.query.userId || req.query.USER_ID;
        const request = pool.request();

        let tutorFilter = "";
        let tutorRoleSelect = "'HOST' AS TUTOR_ROLE,";

        if (rawTutorId && Number.isInteger(Number(rawTutorId)) && Number(rawTutorId) > 0) {
            const tutorId = Number(rawTutorId);
            request.input("TUTOR_ID", sql.Int, tutorId);

            tutorRoleSelect = `
                COALESCE(
                    (
                        SELECT TOP 1
                            CASE 
                                WHEN TRY_CONVERT(INT, t_myrole.role) = 1 OR UPPER(LTRIM(RTRIM(t_myrole.role))) = 'HOST' THEN 'HOST'
                                ELSE 'SUPPORT'
                            END
                        FROM TUTOR_ALLOCATIONS ta_myrole WITH (NOLOCK)
                        CROSS APPLY OPENJSON(ISNULL(ta_myrole.TUTOR_IDS, '[]'))
                        WITH (
                            tutorId INT '$.tutorId',
                            role NVARCHAR(50) '$.role'
                        ) t_myrole
                        WHERE ta_myrole.BATCH_ID = b.ID 
                          AND ISJSON(ta_myrole.TUTOR_IDS) = 1
                          AND t_myrole.tutorId = @TUTOR_ID
                    ),
                    'HOST'
                ) AS TUTOR_ROLE,
            `;

            tutorFilter = `
                WHERE EXISTS (
                    SELECT 1 
                    FROM TUTOR_ALLOCATIONS ta_assigned WITH (NOLOCK)
                    CROSS APPLY OPENJSON(ISNULL(ta_assigned.TUTOR_IDS, '[]'))
                    WITH (tutorId INT '$.tutorId') t_assigned
                    WHERE ta_assigned.BATCH_ID = b.ID 
                      AND ISJSON(ta_assigned.TUTOR_IDS) = 1
                      AND t_assigned.tutorId = @TUTOR_ID
                )
            `;
        }

        const result = await request.query(`
      SELECT
        b.ID,
        b.BATCH_CODE,
        b.BATCH_NAME,
        FORMAT(b.START_DATE, 'dd-MM-yyyy') AS START_DATE,
        FORMAT(b.END_DATE, 'dd-MM-yyyy') AS END_DATE,
        b.IS_ACTIVE,
        cr.ROOM_ID,
        ${tutorRoleSelect}
        (
            SELECT COUNT(DISTINCT sa.STUDENT_ID)
            FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
            WHERE sa.BATCH_ID = b.ID
        ) AS STUDENT_COUNT,
        (
            SELECT 
                CASE 
                    WHEN MIN(u.GRADE) IS NULL THEN 'Grade 6-12'
                    WHEN MIN(u.GRADE) = MAX(u.GRADE) THEN CONCAT('Grade ', MIN(u.GRADE))
                    ELSE CONCAT('Grade ', MIN(u.GRADE), '-', MAX(u.GRADE))
                END
            FROM STUDENT_ALLOCATIONS sa WITH (NOLOCK)
            INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = sa.STUDENT_ID
            WHERE sa.BATCH_ID = b.ID AND u.GRADE IS NOT NULL AND u.GRADE <> ''
        ) AS GRADE,
        COALESCE(
            (
                SELECT TOP 1 u.USERNAME
                FROM TUTOR_ALLOCATIONS ta WITH (NOLOCK)
                CROSS APPLY OPENJSON(ISNULL(ta.TUTOR_IDS, '[]'))
                WITH (
                    tutorId INT '$.tutorId',
                    role NVARCHAR(50) '$.role'
                ) t
                INNER JOIN USERS u WITH (NOLOCK) ON u.USER_ID = t.tutorId
                WHERE ta.BATCH_ID = b.ID 
                  AND ISJSON(ta.TUTOR_IDS) = 1
                  AND (TRY_CONVERT(INT, t.role) = 1 OR UPPER(LTRIM(RTRIM(t.role))) = 'HOST')
            ),
            (
                SELECT TOP 1 u2.USERNAME
                FROM TUTOR_ALLOCATIONS ta2 WITH (NOLOCK)
                CROSS APPLY OPENJSON(ISNULL(ta2.TUTOR_IDS, '[]'))
                WITH (
                    tutorId INT '$.tutorId'
                ) t2
                INNER JOIN USERS u2 WITH (NOLOCK) ON u2.USER_ID = t2.tutorId
                WHERE ta2.BATCH_ID = b.ID
                  AND ISJSON(ta2.TUTOR_IDS) = 1
              ),
            'Not Assigned'
        ) AS TUTOR_NAME,
        (
            SELECT COUNT(cm.MESSAGE_ID)
            FROM CHAT_MESSAGES cm WITH (NOLOCK)
            WHERE cm.ROOM_ID = cr.ROOM_ID AND cm.IS_DELETED = 0
        ) AS CHAT_COUNT,
        (
            SELECT TOP 1 cm.MESSAGE_TEXT
            FROM CHAT_MESSAGES cm WITH (NOLOCK)
            WHERE cm.ROOM_ID = cr.ROOM_ID AND cm.IS_DELETED = 0
            ORDER BY cm.SENT_AT DESC, cm.MESSAGE_ID DESC
        ) AS LAST_MESSAGE,
        (
            SELECT TOP 1 FORMAT(cm.SENT_AT, 'hh:mm tt')
            FROM CHAT_MESSAGES cm WITH (NOLOCK)
            WHERE cm.ROOM_ID = cr.ROOM_ID AND cm.IS_DELETED = 0
            ORDER BY cm.SENT_AT DESC, cm.MESSAGE_ID DESC
        ) AS LAST_TIME
      FROM BATCHES b WITH (NOLOCK)
      LEFT JOIN CHAT_ROOMS cr WITH (NOLOCK)
          ON b.ID = cr.BATCH_ID
      ${tutorFilter}
      ORDER BY b.ID ASC;
    `);

        res.json({
            status: 1,
            data: result.recordset,
        });
    } catch (err) {
        res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};

const sendMessage = async (req, res) => {
    try {
        const body = req.body || {};
        const params = req.params || {};
        const headers = req.headers || {};
        const user = req.user || {};

        const roomId = params.roomId || body.roomId || body.ROOM_ID;
        const senderId =
            user.USER_ID ||
            user.userId ||
            user.id ||
            body.senderId ||
            body.SENDER_ID ||
            body.userId ||
            headers["x-user-id"];

        const {
            messageText,
            MESSAGE_TEXT,
            messageType,
            MESSAGE_TYPE,
            fileUrl,
            FILE_URL
        } = body;

        const text = messageText !== undefined ? messageText : MESSAGE_TEXT;
        const type = messageType || MESSAGE_TYPE || "TEXT";
        const file = fileUrl !== undefined ? fileUrl : FILE_URL;

        if (!roomId) {
            return res.status(400).json({
                status: 0,
                message: "Room ID is required",
            });
        }

        if (!senderId) {
            return res.status(400).json({
                status: 0,
                message: "Sender ID is required",
            });
        }

        if (!text && !file) {
            return res.status(400).json({
                status: 0,
                message: "Message text or file URL is required",
            });
        }

        const pool = getPool();

        // 1. Verify Room exists and is active
        const roomResult = await pool
            .request()
            .input("ROOM_ID", sql.Int, roomId)
            .query(`
                SELECT ROOM_ID, IS_ACTIVE
                FROM CHAT_ROOMS
                WHERE ROOM_ID = @ROOM_ID
            `);

        if (roomResult.recordset.length === 0) {
            return res.status(404).json({
                status: 0,
                message: "Chat room not found",
            });
        }

        if (!roomResult.recordset[0].IS_ACTIVE) {
            return res.status(400).json({
                status: 0,
                message: "Chat room is inactive",
            });
        }

        // 2. Insert into CHAT_MESSAGES
        const insertResult = await pool
            .request()
            .input("ROOM_ID", sql.Int, roomId)
            .input("SENDER_ID", sql.Int, senderId)
            .input("MESSAGE_TEXT", sql.VarChar(sql.MAX), text || null)
            .input("MESSAGE_TYPE", sql.VarChar(30), type)
            .input("FILE_URL", sql.VarChar(1000), file || null)
            .query(`
                INSERT INTO CHAT_MESSAGES
                (
                    ROOM_ID,
                    SENDER_ID,
                    MESSAGE_TEXT,
                    MESSAGE_TYPE,
                    FILE_URL,
                    SENT_AT,
                    IS_DELETED
                )
                OUTPUT INSERTED.MESSAGE_ID, INSERTED.SENT_AT
                VALUES
                (
                    @ROOM_ID,
                    @SENDER_ID,
                    @MESSAGE_TEXT,
                    @MESSAGE_TYPE,
                    @FILE_URL,
                    GETDATE(),
                    0
                )
            `);

        const insertedRecord = insertResult.recordset[0];

        // 3. Fetch sender information (username, user_type)
        const senderResult = await pool
            .request()
            .input("USER_ID", sql.Int, senderId)
            .query(`
                SELECT USERNAME, USER_TYPE
                FROM USERS
                WHERE USER_ID = @USER_ID
            `);

        const senderInfo = senderResult.recordset[0] || {};

        const messageData = {
            MESSAGE_ID: insertedRecord.MESSAGE_ID,
            id: insertedRecord.MESSAGE_ID,
            ROOM_ID: Number(roomId),
            roomId: Number(roomId),
            SENDER_ID: Number(senderId),
            senderId: Number(senderId),
            SENDER_NAME: senderInfo.USERNAME || "User",
            senderName: senderInfo.USERNAME || "User",
            SENDER_TYPE: senderInfo.USER_TYPE || "STUDENT",
            role: senderInfo.USER_TYPE || "STUDENT",
            MESSAGE_TEXT: text || null,
            messageText: text || null,
            text: text || null,
            MESSAGE_TYPE: type,
            FILE_URL: file || null,
            SENT_AT: insertedRecord.SENT_AT,
            sentAt: insertedRecord.SENT_AT,
            IS_DELETED: 0
        };

        // Broadcast to WebSocket clients live
        try {
            broadcastToRoom(roomId, "receive_message", messageData);
        } catch (sockErr) {
            console.warn("⚠️ Failed to broadcast socket event:", sockErr);
        }

        return res.json({
            status: 1,
            message: "Message sent successfully",
            data: messageData
        });

    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(500).json({
            status: 0,
            message: err.message,
        });
    }
};

module.exports = {
    getChatRoom,
    getChatRoomBatches,
    sendMessage
};