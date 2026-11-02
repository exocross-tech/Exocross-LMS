import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Radio,
  Clock,
  GraduationCap,
} from "lucide-react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { chatRoomApi } from "../../services/apiService";
import "./StudentChatroom.css";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:3310";

const StudentChatroom = () => {
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState(null);
  const [inputText, setInputText] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("ASA_LMS_CHATROOM_MSGS");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const chatEndRef = useRef(null);
  const isFetched = useRef(false);
  const socketRef = useRef(null);

  // Get stored logged-in student user profile
  const getLoggedUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse user details:", e);
    }
    return null;
  };

  const user = getLoggedUser();
  const studentId =
    user?.STUDENT_ID ||
    user?.USER_ID ||
    user?.ID ||
    user?.USERID ||
    user?.id ||
    1;

  const currentUserName =
    user?.USERNAME ||
    user?.FIRST_NAME ||
    user?.USER_NAME ||
    user?.username ||
    "Student";

  const getInitials = (name) => {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Sync message state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "ASA_LMS_CHATROOM_MSGS",
        JSON.stringify(chatMessages)
      );
    } catch (e) {
      console.error("Storage error:", e);
    }
  }, [chatMessages]);

  // Retrieve stored ROOM_ID from session or local storage / user object
  const getStoredRoomId = () => {
    try {
      if (user?.ROOM_ID) return user.ROOM_ID;
      if (user?.ROOMID) return user.ROOMID;
      if (user?.roomId) return user.roomId;
      if (user?.BATCH_ID) return user.BATCH_ID;

      const sessionRoomId =
        sessionStorage.getItem("ROOM_ID") ||
        sessionStorage.getItem("roomId") ||
        sessionStorage.getItem("ROOMID");
      if (sessionRoomId) return sessionRoomId;

      const localRoomId =
        localStorage.getItem("ROOM_ID") ||
        localStorage.getItem("roomId") ||
        localStorage.getItem("ROOMID");
      if (localRoomId) return localRoomId;
    } catch (e) {
      console.error("Error retrieving stored ROOM_ID:", e);
    }
    return null;
  };

  // Fetch student assigned chatroom data on load
  const fetchStudentChatroom = async () => {
    setLoading(true);
    try {
      const storedRoomId = getStoredRoomId();
      let roomBatch = null;

      if (storedRoomId) {
        try {
          const res = await chatRoomApi.getChatRoom(storedRoomId, studentId);
          const responseData = res?.data?.data || res?.data;

          if (responseData) {
            const roomObj = responseData.room || responseData;
            const membersList = responseData.members || [];
            const tutorObj = membersList.find(
              (m) =>
                (m.USER_TYPE || m.MEMBER_TYPE || "").toUpperCase() === "TUTOR"
            );

            const roomName =
              roomObj.BATCH_CODE ||
              roomObj.ROOM_NAME ||
              `Room ${storedRoomId}`;
            const code =
              roomObj.BATCH_CODE ||
              roomObj.code ||
              roomName;
            const msgList =
              responseData.messages ||
              roomObj.messages ||
              responseData.CHAT_MESSAGES ||
              (Array.isArray(responseData) ? responseData : []);

            roomBatch = {
              ID: roomObj.ID || roomObj.ROOM_ID || storedRoomId,
              ROOM_ID: roomObj.ROOM_ID || storedRoomId,
              ROOM_NAME: roomName,
              BATCH_CODE: code,
              TUTOR_NAME:
                roomObj.TUTOR_NAME ||
                tutorObj?.USERNAME ||
                user?.TUTOR_NAME ||
                "-",
              GRADE: roomObj.GRADE || "-",
              CURRENT_COUNT: Number(
                roomObj.STUDENT_COUNT ?? membersList.length ?? roomObj.CURRENT_COUNT ?? 0
              ),
              members: membersList,
              messages: msgList,
            };

            // Format & save returned room messages
            if (msgList && msgList.length > 0) {
              const formattedMsgs = msgList.map((m) => ({
                id: m.MESSAGE_ID || m.id || Date.now() + Math.random(),
                sender:
                  m.SENDER_NAME || m.SENDER_FIRST_NAME || m.senderName || "Classmate",
                role: (m.SENDER_TYPE || m.ROLE || m.role || "STUDENT").toUpperCase(),
                avatar: getInitials(
                  m.SENDER_NAME || m.SENDER_FIRST_NAME || m.senderName
                ),
                text: m.MESSAGE_TEXT || m.messageText || m.text,
                time: m.SENT_AT || m.created_at
                  ? new Date(m.SENT_AT || m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "Active",
                isSelf: Number(m.SENDER_ID || m.USER_ID) === Number(studentId),
              }));

              setChatMessages((prev) => ({
                ...prev,
                [code]: formattedMsgs,
                [roomName]: formattedMsgs,
                [storedRoomId]: formattedMsgs,
              }));
            }
          }
        } catch (e) {
          console.warn("getChatRoom API call failed:", e);
        }
      }

      // Fallback if roomBatch is null
      if (!roomBatch && chatRoomApi?.getStudentChatRooms && studentId) {
        try {
          const res = await chatRoomApi.getStudentChatRooms(studentId);
          const responseData = res?.data?.data || res?.data;

          if (responseData) {
            const list = Array.isArray(responseData)
              ? responseData
              : [responseData];
            if (list.length > 0) {
              const item = list[0];
              const roomObj = item.room || item;
              const roomName =
                roomObj.BATCH_CODE ||
                roomObj.ROOM_NAME ||
                "Batch Room";
              const code = roomObj.BATCH_CODE || user?.BATCH_CODE;

              roomBatch = {
                ...item,
                ID: roomObj.ID || roomObj.ROOM_ID || 1,
                ROOM_ID: roomObj.ROOM_ID || storedRoomId || 1,
                ROOM_NAME: roomName,
                BATCH_CODE: code,
                TUTOR_NAME: roomObj.TUTOR_NAME || "-",
                CURRENT_COUNT: Number(roomObj.CURRENT_COUNT || 42),
              };
            }
          }
        } catch (e) {
          console.warn("Student chatroom API call failed:", e);
        }
      }

      if (!roomBatch) {
        const code = user?.BATCH_CODE;
        const roomName = user?.BATCH_CODE || user?.ROOM_NAME || `Batch ${code}`;
        roomBatch = {
          ID: user?.BATCH_ID || storedRoomId || 1,
          ROOM_ID: storedRoomId || 1,
          ROOM_NAME: roomName,
          BATCH_CODE: code,
          TUTOR_NAME: user?.TUTOR_NAME || "-",
          GRADE: user?.GRADE || "-",
          CURRENT_COUNT: 45,
        };
      }

      setActiveBatch(roomBatch);
    } catch (err) {
      console.error("Error loading student chatroom:", err);
      toast.error("Failed to load your assigned cohort chatroom.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchStudentChatroom();
    }
  }, []);

  // WebSocket Live Connection Setup
  useEffect(() => {
    if (!activeBatch?.ROOM_ID) return;

    const roomId = activeBatch.ROOM_ID;
    let socket = null;

    try {
      socket = io(SOCKET_SERVER_URL, {
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 3,
        timeout: 4000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("🔌 Connected to Live WebSocket:", socket.id);
        setIsConnected(true);
        socket.emit("join_room", { roomId, userId: studentId });
      });

      socket.on("connect_error", (err) => {
        console.warn(
          "WebSocket backend server not active yet, falling back to REST API:",
          err.message
        );
        setIsConnected(false);
      });

      socket.on("disconnect", () => {
        console.log("🔌 Disconnected from Live WebSocket");
        setIsConnected(false);
      });

      // Realtime Incoming Message Listener (Strict deduplication)
      socket.on("receive_message", (m) => {
        if (Number(m.ROOM_ID || m.roomId) === Number(roomId)) {
          const senderIdFromMsg =
            m.SENDER_ID || m.senderId || m.USER_ID || m.userId;
          const senderNameFromMsg = m.SENDER_NAME || m.senderName;
          const isSelfMsg =
            Number(senderIdFromMsg) === Number(studentId) ||
            (senderNameFromMsg && senderNameFromMsg === currentUserName);

          // ALWAYS ignore socket echoes for self-sent messages (handled optimistically by handleSendMessage)
          if (isSelfMsg) {
            return;
          }

          const batchKey = activeBatch.BATCH_CODE || activeBatch.ROOM_NAME;
          const msgText = m.MESSAGE_TEXT || m.messageText || m.text;

          const serverMsg = {
            id: m.MESSAGE_ID || m.id || Date.now() + Math.random(),
            sender: senderNameFromMsg || "Classmate",
            role: (m.SENDER_TYPE || m.role || "STUDENT").toUpperCase(),
            avatar: getInitials(senderNameFromMsg),
            text: msgText,
            time: m.SENT_AT
              ? new Date(m.SENT_AT).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              : new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            isSelf: false,
          };

          setChatMessages((prev) => {
            const keysToUpdate = Array.from(
              new Set(
                [
                  batchKey,
                  activeBatch?.BATCH_CODE,
                  activeBatch?.ROOM_NAME,
                  activeBatch?.ROOM_ID,
                ].filter(Boolean)
              )
            );

            const nextState = { ...prev };
            keysToUpdate.forEach((key) => {
              const existing = nextState[key] || [];
              const isDup = existing.some(
                (msg) =>
                  String(msg.id) === String(serverMsg.id) ||
                  (msg.text === msgText && String(msg.sender) === String(serverMsg.sender))
              );
              if (!isDup) {
                nextState[key] = [...existing, serverMsg];
              }
            });

            return nextState;
          });
        }
      });
    } catch (e) {
      console.warn("Socket connection failed:", e);
      setIsConnected(false);
    }

    return () => {
      if (socket) {
        socket.emit("leave_room", { roomId, userId: studentId });
        socket.disconnect();
      }
    };
  }, [activeBatch?.ROOM_ID, studentId]);

  // Auto scroll chat to bottom when active batch or messages change
  useEffect(() => {
    if (activeBatch) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [activeBatch, chatMessages]);

  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSendingRef.current) return;
    const textToSend = inputText.trim();
    if (!textToSend || !activeBatch) return;

    isSendingRef.current = true;
    setIsSending(true);

    const batchKey = activeBatch.BATCH_CODE || activeBatch.ROOM_NAME;
    const roomId = activeBatch.ROOM_ID;
    const tempId = Date.now();

    const newMsg = {
      id: tempId,
      sender: currentUserName,
      role: "STUDENT",
      avatar: getInitials(currentUserName),
      text: textToSend,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isSelf: true,
    };

    setInputText("");

    const keysToUpdate = Array.from(
      new Set(
        [
          batchKey,
          activeBatch?.BATCH_CODE,
          activeBatch?.ROOM_NAME,
          activeBatch?.ROOM_ID,
        ].filter(Boolean)
      )
    );

    // Single optimistic UI update across room state keys
    setChatMessages((prev) => {
      const nextState = { ...prev };
      keysToUpdate.forEach((key) => {
        const existing = nextState[key] || [];
        nextState[key] = [...existing, newMsg];
      });
      return nextState;
    });

    try {
      if (roomId) {
        const res = await chatRoomApi.sendMessage({
          roomId,
          userId: studentId,
          studentId: studentId,
          senderId: studentId,
          messageText: textToSend,
          messageType: "TEXT",
        });

        const responseData = res?.data?.data || res?.data;

        if (res?.data?.status === 1 || responseData) {
          const m = responseData?.message || responseData || {};
          const serverMsgId = m.MESSAGE_ID || tempId;

          setChatMessages((prev) => {
            const nextState = { ...prev };
            keysToUpdate.forEach((key) => {
              const existing = nextState[key] || [];
              nextState[key] = existing.map((msg) =>
                msg.id === tempId ? { ...msg, id: serverMsgId } : msg
              );
            });
            return nextState;
          });
        }
      }
    } catch (err) {
      console.error("Failed to send student message:", err);
      toast.error("Failed to send message");
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const activeBatchKey = activeBatch?.BATCH_CODE || activeBatch?.ROOM_NAME;
  const currentBatchMessages =
    chatMessages[activeBatchKey] ||
    chatMessages[activeBatch?.ROOM_NAME] ||
    chatMessages[activeBatch?.BATCH_CODE] ||
    chatMessages[activeBatch?.ROOM_ID] ||
    [];

  return (
    <div className="student-chatroom-page">
      {/* Header Section */}
      <div className="student-chatroom-header">
        <div className="section-label">
          <Radio size={14} className="live-dot" color="#00e5ff" />
          <span>MISSION CONTROL • LIVE COMMS</span>
        </div>

        <div className="header-title-row">
          <div className="header-left">
            <h1 className="header-main-title">Student Cohort Chatroom</h1>
            <p className="header-subtitle">
              Real-time discussion channel with your tutor and cohort classmates. Ask questions, review announcements, and collaborate live.
            </p>
          </div>
        </div>
      </div>

      {/* Main Direct Chat Room Interface */}
      <div className="student-direct-chat-container">
        {loading ? (
          <div className="direct-chat-loading">
            <Sparkles size={32} className="animate-spin" color="#00f0ff" />
            <p>Connecting to live cohort chatroom...</p>
          </div>
        ) : !activeBatch ? (
          <div className="direct-chat-empty">
            <MessageSquare size={40} color="#64748b" />
            <h3>No Chatroom Found</h3>
            <p>Unable to load your assigned chatroom. Please contact system administration.</p>
          </div>
        ) : (
          <>
            {/* Chat Room Top Bar */}
            <div className="direct-chat-header">
              <div className="chat-header-left">
                <div className="chat-batch-icon">
                  <MessageSquare size={22} color="#00f0ff" />
                </div>
                <div>
                  <div className="chat-title-badge-row">
                    <h2 className="chat-batch-title">
                      {activeBatch.BATCH_CODE || activeBatch.ROOM_NAME}
                    </h2>
                    <span
                      className={`live-roster-pill ${isConnected ? "connected" : "disconnected"
                        }`}
                    >
                      <span className="dot-pulse"></span>{" "}
                      {isConnected ? "WEBSOCKET LIVE" : "ROSTER CONNECTING"}
                    </span>
                  </div>
                  <p className="chat-batch-sub">
                    <GraduationCap size={13} style={{ display: "inline", marginRight: 6 }} color="#00e5ff" />
                    Tutor: <span className="tutor-name-highlight">{activeBatch.TUTOR_NAME || "Not Assigned"}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Chat Messages Area */}
            <div className="direct-chat-body">
              {currentBatchMessages.length === 0 ? (
                <div className="direct-empty-msgs">
                  <Sparkles size={28} color="#00f0ff" />
                  <p>Welcome to {activeBatch.ROOM_NAME || activeBatch.BATCH_CODE}!</p>
                  <span>No messages yet. Type your question below to start the live conversation.</span>
                </div>
              ) : (
                currentBatchMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`student-msg-row ${msg.isSelf ? "self" : "other"}`}
                  >
                    {!msg.isSelf && (
                      <div
                        className={`msg-avatar-circle ${msg.role ? msg.role.toLowerCase() : "student"
                          }`}
                      >
                        {msg.avatar}
                      </div>
                    )}

                    <div className="msg-content-block">
                      <div className="msg-meta-bar">
                        <span className="sender-name">{msg.sender}</span>
                        <span
                          className={`role-pill ${msg.role ? msg.role.toLowerCase() : "student"
                            }`}
                        >
                          {msg.role}
                        </span>
                        <span className="msg-timestamp">{msg.time}</span>
                      </div>
                      <div className="msg-text-bubble">{msg.text}</div>
                    </div>

                    {msg.isSelf && (
                      <div className="msg-avatar-circle self">
                        {msg.avatar}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Direct Chat Message Input Footer */}
            <form className="direct-chat-footer" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder={`Type a message to ${activeBatch.ROOM_NAME || activeBatch.BATCH_CODE}...`}
                className="direct-input-field"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="direct-send-btn"
                disabled={!inputText.trim() || isSending}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentChatroom;
