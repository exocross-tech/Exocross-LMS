const { Server } = require("socket.io");
const { getPool, sql } = require("../config/database");

let io = null;

/**
 * Initialize Socket.io server
 * @param {import('http').Server} server 
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket client connected: ${socket.id}`);

    // 1. JOIN ROOM
    socket.on("join_room", (data) => {
      const roomId = data?.roomId || data?.ROOM_ID;
      const userId = data?.userId || data?.USER_ID;

      if (roomId) {
        const roomStr = String(roomId);
        socket.join(roomStr);
        console.log(`👤 User ${userId || socket.id} joined chat room: ${roomId}`);

        socket.emit("room_joined", {
          status: 1,
          message: `Joined room ${roomId}`,
          roomId: Number(roomId),
        });
      }
    });

    // 2. LEAVE ROOM
    socket.on("leave_room", (data) => {
      const roomId = data?.roomId || data?.ROOM_ID;
      const userId = data?.userId || data?.USER_ID;

      if (roomId) {
        const roomStr = String(roomId);
        socket.leave(roomStr);
        console.log(`👤 User ${userId || socket.id} left chat room: ${roomId}`);
      }
    });

    // 3. SEND MESSAGE
    socket.on("send_message", async (data) => {
      try {
        const roomId = data?.roomId || data?.ROOM_ID;
        const senderId = data?.senderId || data?.SENDER_ID || data?.userId || data?.USER_ID;
        const text = data?.messageText || data?.MESSAGE_TEXT || data?.text || "";
        const type = data?.messageType || data?.MESSAGE_TYPE || "TEXT";
        const file = data?.fileUrl || data?.FILE_URL || null;

        if (!roomId) {
          return socket.emit("error_message", {
            status: 0,
            message: "Room ID is required",
          });
        }

        // If message is already created with MESSAGE_ID (e.g. from REST API), simply broadcast
        if (data?.MESSAGE_ID || data?.id) {
          broadcastToRoom(roomId, "receive_message", data);
          return;
        }

        if (!senderId || (!text && !file)) {
          return socket.emit("error_message", {
            status: 0,
            message: "Sender ID and message text/file are required",
          });
        }

        const pool = getPool();

        // 1. Verify Room exists
        const roomCheck = await pool
          .request()
          .input("ROOM_ID", sql.Int, Number(roomId))
          .query(`SELECT ROOM_ID FROM CHAT_ROOMS WHERE ROOM_ID = @ROOM_ID AND IS_ACTIVE = 1`);

        if (!roomCheck.recordset || roomCheck.recordset.length === 0) {
          return socket.emit("error_message", {
            status: 0,
            message: "Chat room not found or inactive",
          });
        }

        // 2. Insert into DB (Only when not already inserted via REST)
        const insertRes = await pool
          .request()
          .input("ROOM_ID", sql.Int, Number(roomId))
          .input("SENDER_ID", sql.Int, Number(senderId))
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

        const record = insertRes.recordset[0];

        // 3. Fetch sender details
        const senderRes = await pool
          .request()
          .input("USER_ID", sql.Int, Number(senderId))
          .query(`SELECT USERNAME, USER_TYPE FROM USERS WHERE USER_ID = @USER_ID`);

        const senderInfo = senderRes.recordset[0] || {};
        const senderName = data?.SENDER_NAME || data?.senderName || senderInfo.USERNAME || "User";
        const senderType = data?.SENDER_TYPE || data?.senderType || senderInfo.USER_TYPE || "STUDENT";

        const payload = {
          MESSAGE_ID: record.MESSAGE_ID,
          id: record.MESSAGE_ID,
          ROOM_ID: Number(roomId),
          roomId: Number(roomId),
          SENDER_ID: Number(senderId),
          senderId: Number(senderId),
          SENDER_NAME: senderName,
          senderName: senderName,
          SENDER_TYPE: senderType,
          role: senderType,
          MESSAGE_TEXT: text,
          messageText: text,
          text: text,
          MESSAGE_TYPE: type,
          FILE_URL: file,
          SENT_AT: record.SENT_AT,
          sentAt: record.SENT_AT,
          IS_DELETED: 0,
        };

        // Broadcast to everyone connected to this room
        broadcastToRoom(roomId, "receive_message", payload);

      } catch (err) {
        console.error("❌ Socket send_message error:", err);
        socket.emit("error_message", {
          status: 0,
          message: err.message,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get active Socket.io instance
 */
const getIO = () => {
  return io;
};

/**
 * Broadcast event to a specific chat room
 * @param {number|string} roomId 
 * @param {string} eventName 
 * @param {object} payload 
 */
const broadcastToRoom = (roomId, eventName, payload) => {
  if (io && roomId) {
    const roomStr = String(roomId);
    io.to(roomStr).emit(eventName, payload);
  }
};

module.exports = {
  initSocket,
  getIO,
  broadcastToRoom,
};
