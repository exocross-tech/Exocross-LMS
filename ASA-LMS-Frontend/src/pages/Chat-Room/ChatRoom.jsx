import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  X,
  Users,
  Search,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCheck,
  Radio,
} from "lucide-react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { batchesApi, chatRoomApi } from "../../services/apiService";
import "./ChatRoom.css";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:3310";

const ChatRoom = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
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

  // Get active logged-in user name
  const getCurrentUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        return (
          parsed?.USERNAME ||
          parsed?.USER_NAME ||
          parsed?.FIRST_NAME ||
          "Admin"
        );
      }
    } catch (e) {
      console.error(e);
    }
    return "Admin";
  };

  const getCurrentUserId = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.USER_ID || parsed?.userId || parsed?.id || 1;
      }
    } catch (e) {
      console.error(e);
    }
    return 1;
  };

  const currentUserName = getCurrentUser();
  const userId = getCurrentUserId();

  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Save messages to local storage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(
        "ASA_LMS_CHATROOM_MSGS",
        JSON.stringify(chatMessages)
      );
    } catch (e) {
      console.error(e);
    }
  }, [chatMessages]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await chatRoomApi.getChatRoomBatches();
      if (res?.data?.status === 1 && res?.data?.data?.length > 0) {
        const list = res.data.data.map((b) => {
          const code = b.BATCH_CODE || "BATCH";
          return {
            ...b,
            BATCH_CODE: code,
            TUTOR_NAME: b.TUTOR_NAME || "Not Assigned",
            CURRENT_COUNT: Number(b.STUDENT_COUNT ?? b.CURRENT_COUNT ?? 0),
            GRADE: b.GRADE || "All Grades",
            CHAT_COUNT: Number(b.CHAT_COUNT ?? (chatMessages[code] || []).length),
            LAST_MESSAGE: b.LAST_MESSAGE || "",
            LAST_TIME: b.LAST_TIME || (b.CHAT_COUNT > 0 ? "Active" : "No messages"),
          };
        });
        setBatches(list);
      } else {
        setBatches([]);
      }
    } catch (err) {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch batches from backend API once on mount
  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchBatches();
    }
  }, []);

  // WebSocket Live Connection Setup for Open Chat Modal
  useEffect(() => {
    if (!selectedBatch?.ROOM_ID) return;

    const roomId = selectedBatch.ROOM_ID;
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
        console.log("🔌 Connected to Admin Chat WebSocket:", socket.id);
        setIsConnected(true);
        socket.emit("join_room", { roomId, userId });
      });

      socket.on("connect_error", (err) => {
        console.warn("WebSocket connect_error fallback:", err.message);
        setIsConnected(false);
      });

      socket.on("disconnect", () => {
        console.log("🔌 Disconnected from WebSocket");
        setIsConnected(false);
      });

      // Realtime Message Listener (Strict deduplication)
      socket.on("receive_message", (m) => {
        if (Number(m.ROOM_ID || m.roomId) === Number(roomId)) {
          const senderIdFromMsg =
            m.SENDER_ID || m.senderId || m.USER_ID || m.userId;
          const senderNameFromMsg = m.SENDER_NAME || m.senderName;
          const isSelfMsg =
            Number(senderIdFromMsg) === Number(userId) ||
            (senderNameFromMsg && senderNameFromMsg === currentUserName);

          // Ignore socket echo for self messages (handled optimistically)
          if (isSelfMsg) {
            return;
          }

          const batchKey = selectedBatch.BATCH_CODE;
          const msgText = m.MESSAGE_TEXT || m.messageText || m.text;

          const serverMsg = {
            id: m.MESSAGE_ID || m.id || Date.now() + Math.random(),
            sender: senderNameFromMsg || "User",
            role: (m.SENDER_TYPE || m.role || "ADMIN").toUpperCase(),
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
                  selectedBatch?.BATCH_CODE,
                  selectedBatch?.ROOM_NAME,
                  selectedBatch?.ROOM_ID,
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
      console.warn("Socket connection error:", e);
      setIsConnected(false);
    }

    return () => {
      if (socket) {
        socket.emit("leave_room", { roomId, userId });
        socket.disconnect();
      }
    };
  }, [selectedBatch?.ROOM_ID, userId]);

  // Auto scroll chat to bottom when modal or messages change
  useEffect(() => {
    if (selectedBatch) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedBatch, chatMessages]);

  const [modalLoading, setModalLoading] = useState(false);
  const [roomDetails, setRoomDetails] = useState(null);

  const handleOpenChat = async (batch) => {
    setSelectedBatch(batch);
    setInputText("");
    setModalLoading(true);
    setRoomDetails(null);

    const roomId = batch.ROOM_ID;

    try {
      const res = await chatRoomApi.getChatRoom(roomId, userId);

      if (res?.data?.status === 1 && res?.data?.data) {
        const data = res.data.data;
        setRoomDetails(data);

        if (data.room) {
          setSelectedBatch((prev) => ({
            ...prev,
            ...data.room,
            TUTOR_NAME: data.room.TUTOR_NAME || prev?.TUTOR_NAME || "Not Assigned",
            CURRENT_COUNT: Number(data.room.STUDENT_COUNT ?? prev?.CURRENT_COUNT ?? 0),
            GRADE: data.room.GRADE || prev?.GRADE || "All Grades",
          }));
        }

        if (data.messages && data.messages.length > 0) {
          const formattedMsgs = data.messages.map((m) => ({
            id: m.MESSAGE_ID || Date.now() + Math.random(),
            sender: m.SENDER_NAME || "User",
            role: m.SENDER_TYPE || "STUDENT",
            avatar: getInitials(m.SENDER_NAME),
            text: m.MESSAGE_TEXT,
            time: m.SENT_AT
              ? new Date(m.SENT_AT).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Active",
            isSelf: Number(m.SENDER_ID) === Number(userId),
          }));

          setChatMessages((prev) => ({
            ...prev,
            [batch.BATCH_CODE]: formattedMsgs,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat room details:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseChat = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setSelectedBatch(null);
    setRoomDetails(null);
    setInputText("");
  };

  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSendingRef.current) return;
    const textToSend = inputText.trim();
    if (!textToSend || !selectedBatch) return;

    isSendingRef.current = true;
    setIsSending(true);

    const batchKey = selectedBatch.BATCH_CODE;
    const roomId = selectedBatch.ROOM_ID;
    const tempId = Date.now();

    const newMsg = {
      id: tempId,
      sender: currentUserName,
      role: "ADMIN",
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
          selectedBatch?.BATCH_CODE,
          selectedBatch?.ROOM_NAME,
          selectedBatch?.ROOM_ID,
        ].filter(Boolean)
      )
    );

    // Optimistic UI update across keys
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
          userId,
          senderId: userId,
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
      console.error("Failed to send chat message:", err);
      toast.error("Failed to send message");
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }

    // Update batch list count & last message
    setBatches((prev) =>
      prev.map((b) =>
        b.BATCH_CODE === batchKey
          ? {
              ...b,
              CHAT_COUNT: (chatMessages[batchKey] || []).length + 1,
              LAST_MESSAGE: textToSend,
              LAST_TIME: "Just now",
            }
          : b
      )
    );
  };

  // Filter batches by search term
  const filteredBatches = batches.filter(
    (b) =>
      b.BATCH_CODE?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.TUTOR_NAME?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeBatchKey = selectedBatch?.BATCH_CODE;
  const currentBatchMessages = chatMessages[activeBatchKey] || [];

  return (
    <div className="chatroom-container">
      {/* Header Section */}
      <div className="chatroom-header-section">
        <div className="chatroom-breadcrumb">COMMS & CONTENT</div>
        <div className="chatroom-title-row">
          <div className="chatroom-title-left">
            <h1 className="chatroom-title">Batch Chatrooms</h1>
            <p className="chatroom-subtitle">
              Select any cohort to enter its live roster chat room, review discussions, and communicate.
            </p>
          </div>
          <div className="chatroom-search-wrapper">
            <Search size={16} className="chatroom-search-icon" />
            <input
              type="text"
              placeholder="Search batch code or name..."
              className="chatroom-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Batches Grid View */}
      <div className="chatroom-grid">
        {loading ? (
          <div className="chatroom-empty-state">Loading batch chatrooms...</div>
        ) : filteredBatches.length === 0 ? (
          <div className="chatroom-empty-state">No matching batch chatrooms found.</div>
        ) : (
          filteredBatches.map((batch) => {
            const count = batch.CHAT_COUNT || (chatMessages[batch.BATCH_CODE] || []).length || 0;
            const currentCount = Number(batch.CURRENT_COUNT || 45);

            return (
              <div
                className="chatroom-card"
                key={batch.ID || batch.BATCH_CODE}
                onClick={() => handleOpenChat(batch)}
              >
                {/* Corner Chat Icon with Count */}
                <div className="corner-chat-badge" title={`${count} messages in chatroom`}>
                  <MessageSquare size={14} className="badge-icon" />
                  <span className="badge-count">{count}</span>
                </div>

                <div className="chatroom-card-header">
                  <div className="chatroom-badge-live">
                    <span className="live-dot"></span> LIVE ROSTER
                  </div>
                  <h3 className="chatroom-batch-title">
                    {batch.BATCH_CODE}
                  </h3>
                  <span className="chatroom-batch-sub">
                    {batch.GRADE || "All Grades"} · {currentCount} Students
                  </span>
                </div>

                <div className="chatroom-card-body">
                  <div className="chatroom-info-row">
                    <span className="info-label">Assigned Tutor:</span>
                    <span className="info-val tutor-highlight">
                      {batch.TUTOR_NAME || "Not Assigned"}
                    </span>
                  </div>

                  {batch.LAST_MESSAGE && (
                    <div className="chatroom-preview-box">
                      <p className="preview-text">"{batch.LAST_MESSAGE}"</p>
                      <span className="preview-time">{batch.LAST_TIME || "Active"}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-open-chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenChat(batch);
                  }}
                >
                  <span>Open Chatroom</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Chat Modal */}
      {selectedBatch && (
        <div className="chat-modal-overlay" onClick={handleCloseChat}>
          <div
            className="chat-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="chat-modal-header">
              <div className="chat-header-info">
                <div className="chat-batch-avatar">
                  <MessageSquare size={20} color="#00f0ff" />
                </div>
                <div>
                  <h2 className="chat-modal-title">
                    {selectedBatch.BATCH_CODE}
                  </h2>
                  <p className="chat-modal-sub">
                    <Users size={12} style={{ display: "inline", marginRight: 4 }} />
                    {selectedBatch.CURRENT_COUNT ?? selectedBatch.STUDENT_COUNT ?? 0} Enrolled Students • Tutor:{" "}
                    {selectedBatch.TUTOR_NAME || "Not Assigned"}
                    {isConnected && (
                      <span style={{ color: "#10b981", marginLeft: 8, fontWeight: 700 }}>
                        • LIVE WEBSOCKET
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="chat-close-btn"
                onClick={handleCloseChat}
                aria-label="Close Chat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Chat Messages Body */}
            <div className="chat-modal-body">
              {modalLoading ? (
                <div className="chat-empty-msgs">
                  <Sparkles size={24} className="animate-spin" color="#00f0ff" />
                  <p>Loading chatroom data...</p>
                </div>
              ) : currentBatchMessages.length === 0 ? (
                <div className="chat-empty-msgs">
                  <Sparkles size={24} color="#00f0ff" />
                  <p>No messages yet in this batch chatroom.</p>
                  <span>Be the first to start the discussion!</span>
                </div>
              ) : (
                currentBatchMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`chat-msg-row ${msg.isSelf ? "self" : "other"}`}
                  >
                    {!msg.isSelf && (
                      <div className={`msg-avatar ${msg.role ? msg.role.toLowerCase() : 'student'}`}>
                        {msg.avatar}
                      </div>
                    )}

                    <div className="msg-content-wrapper">
                      <div className="msg-meta">
                        <span className="msg-sender">{msg.sender}</span>
                        <span className={`msg-role-badge ${msg.role ? msg.role.toLowerCase() : 'student'}`}>
                          {msg.role}
                        </span>
                        <span className="msg-time">{msg.time}</span>
                      </div>
                      <div className="msg-bubble">{msg.text}</div>
                    </div>

                    {msg.isSelf && (
                      <div className="msg-avatar self">
                        {msg.avatar}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Modal Input Footer */}
            <form className="chat-modal-footer" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder={`Type a message to ${selectedBatch.BATCH_CODE}...`}
                className="chat-input-field"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!inputText.trim() || isSending}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;
