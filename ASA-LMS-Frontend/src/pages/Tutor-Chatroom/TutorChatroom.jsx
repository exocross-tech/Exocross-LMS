import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  X,
  Users,
  Search,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Radio,
  BookOpen,
  User,
  Clock,
  Crown,
  Shield,
} from "lucide-react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import {
  chatRoomApi,
  classScheduleApi,
  finalAssessmentApi,
} from "../../services/apiService";
import "./TutorChatroom.css";

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:3310";

const TutorChatroom = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [inputText, setInputText] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [roomDetails, setRoomDetails] = useState(null);
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

  // Get current logged in user details
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
      console.error(e);
    }
    return null;
  };

  const user = getLoggedUser();
  const userId = user?.USER_ID || user?.ID || user?.USERID || user?.id || 1;
  const currentUserName =
    user?.USERNAME || user?.USER_NAME || user?.FIRST_NAME || "Tutor";
  const userRole = (
    user?.USER_TYPE ||
    user?.ROLE ||
    user?.DESIGNATION ||
    "TUTOR"
  ).toUpperCase();

  const getInitials = (name) => {
    if (!name) return "TU";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Sync messages to local storage
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

  // Fetch tutor assigned batches
  const fetchTutorAssignedBatches = async () => {
    setLoading(true);
    try {
      const res = await chatRoomApi.getChatRoomBatches({ tutorId: userId });
      if (res?.data?.status === 1 && Array.isArray(res.data.data)) {
        const formatted = res.data.data.map((b) => {
          const code = b.BATCH_CODE || "BATCH";
          const studentCount = Number(
            b.STUDENT_COUNT ?? b.CURRENT_COUNT ?? b.TOTAL_STUDENTS ?? 0
          );
          const tutorRole = String(b.TUTOR_ROLE || "HOST").toUpperCase();

          return {
            ...b,
            ROOM_ID: b.ROOM_ID,
            BATCH_CODE: code,
            GRADE: b.GRADE || "All Grades",
            TUTOR_NAME: b.TUTOR_NAME || currentUserName || "Not Assigned",
            TUTOR_ROLE: tutorRole,
            CURRENT_COUNT: studentCount,
            CHAT_COUNT: Number(b.CHAT_COUNT ?? 0),
            LAST_MESSAGE: b.LAST_MESSAGE || "No recent messages",
            LAST_TIME: b.LAST_TIME || (b.CHAT_COUNT > 0 ? "Active" : "Active Roster"),
          };
        });
        setBatches(formatted);
      } else {
        setBatches([]);
      }
    } catch (err) {
      console.error("Error loading tutor chatroom batches:", err);
      toast.error("Failed to load assigned batch chatrooms.");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchTutorAssignedBatches();
    }
  }, []);

  // WebSocket Live Connection Setup for Selected Batch Modal
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
        console.log("🔌 Connected to Tutor WebSocket:", socket.id);
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

      // Realtime Incoming Message Listener (Strict deduplication)
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
      console.warn("Socket init error:", e);
      setIsConnected(false);
    }

    return () => {
      if (socket) {
        socket.emit("leave_room", { roomId, userId });
        socket.disconnect();
      }
    };
  }, [selectedBatch?.ROOM_ID, userId]);

  // Auto scroll chat to bottom when modal opens or messages change
  useEffect(() => {
    if (selectedBatch) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [selectedBatch, chatMessages]);

  const handleOpenChat = async (batch) => {
    setSelectedBatch(batch);
    setInputText("");
    setModalLoading(true);
    setRoomDetails(null);

    const roomId = batch.ROOM_ID;

    try {
      if (roomId) {
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
              role: (m.SENDER_TYPE || "STUDENT").toUpperCase(),
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
      role: userRole || "TUTOR",
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

    // Single optimistic UI update
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

    // Update batch card state with last message
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
      b.GRADE?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeBatchKey = selectedBatch?.BATCH_CODE;
  const currentBatchMessages = chatMessages[activeBatchKey] || [];

  return (
    <div className="tutor-chatroom-page">
      {/* Header Section */}
      <div className="tutor-chatroom-header">
        <div className="section-label">
          <Radio size={14} className="live-dot" color="#00e5ff" />
          <span>COHORT & COMMS</span>
        </div>

        <div className="header-title-row">
          <div className="header-left">
            <h1 className="header-main-title">Tutor Batch Chatrooms</h1>
            <p className="header-subtitle">
              Manage your assigned cohorts, access live batch roster discussions, and broadcast guidance to your students.
            </p>
          </div>

          <div className="chatroom-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search assigned batch..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="tutor-chatroom-grid">
        {loading ? (
          <div className="chatroom-loading-state">
            <Sparkles size={28} className="animate-spin" color="#00f0ff" />
            <p>Loading your assigned batch chatrooms...</p>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="chatroom-empty-state">
            <MessageSquare size={36} color="#64748b" />
            <h3>No Assigned Batches Found</h3>
            <p>You have no active batch chatrooms assigned to your tutor profile currently.</p>
          </div>
        ) : (
          filteredBatches.map((batch) => {
            const count =
              batch.CHAT_COUNT || (chatMessages[batch.BATCH_CODE] || []).length || 0;
            const currentCount = Number(batch.CURRENT_COUNT || 0);

            return (
              <div
                className="tutor-batch-card"
                key={batch.ID || batch.BATCH_CODE}
                onClick={() => handleOpenChat(batch)}
              >
                {/* Corner Message Badge */}
                <div className="corner-msg-badge" title={`${count} messages in room`}>
                  <MessageSquare size={13} />
                  <span>{count}</span>
                </div>

                <div className="card-top-header">
                  <div className="card-badge-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <div className="badge-live-roster">
                      <span className="dot-pulse"></span> ASSIGNED COHORT
                    </div>
                    <span className={`badge-role-pill ${batch.TUTOR_ROLE === "SUPPORT" ? "support" : "host"}`}>
                      {batch.TUTOR_ROLE === "SUPPORT" ? (
                        <>
                          <Shield size={11} style={{ display: "inline", marginRight: 3 }} /> SUPPORT TUTOR
                        </>
                      ) : (
                        <>
                          <Crown size={11} style={{ display: "inline", marginRight: 3 }} /> HOST TUTOR
                        </>
                      )}
                    </span>
                  </div>

                  <h2 className="batch-code-title">{batch.BATCH_CODE}</h2>
                  <div className="batch-sub-details">
                    <span>{batch.GRADE || "All Grades"}</span>
                    <span className="dot-separator">•</span>
                    <span>{currentCount} Students</span>
                  </div>
                </div>

                <div className="card-middle-content">
                  <div className="tutor-info-row">
                    <User size={14} color="#00e5ff" />
                    <span className="label">Lead Tutor:</span>
                    <span className="val">{batch.TUTOR_NAME || "Not Assigned"}</span>
                  </div>

                  <div className="preview-message-box">
                    <p className="preview-text">"{batch.LAST_MESSAGE}"</p>
                    <span className="preview-timestamp">
                      <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                      {batch.LAST_TIME || "Active"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-enter-room"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenChat(batch);
                  }}
                >
                  <span>Enter Chatroom</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Live Chat Modal */}
      {selectedBatch && (
        <div className="tutor-modal-overlay" onClick={handleCloseChat}>
          <div
            className="tutor-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="tutor-modal-header">
              <div className="modal-header-info">
                <div className="modal-batch-icon">
                  <MessageSquare size={22} color="#00f0ff" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 className="modal-batch-title">{selectedBatch.BATCH_CODE}</h2>
                    <span className={`badge-role-pill ${selectedBatch.TUTOR_ROLE === "SUPPORT" ? "support" : "host"}`}>
                      {selectedBatch.TUTOR_ROLE === "SUPPORT" ? (
                        <>
                          <Shield size={11} style={{ display: "inline", marginRight: 3 }} /> SUPPORT TUTOR
                        </>
                      ) : (
                        <>
                          <Crown size={11} style={{ display: "inline", marginRight: 3 }} /> HOST TUTOR
                        </>
                      )}
                    </span>
                  </div>
                  <p className="modal-batch-sub">
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
                className="tutor-chat-close-btn"
                onClick={handleCloseChat}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Messages */}
            <div className="tutor-modal-body">
              {modalLoading ? (
                <div className="modal-empty-msgs">
                  <Sparkles size={24} className="animate-spin" color="#00f0ff" />
                  <p>Connecting to live batch chatroom...</p>
                </div>
              ) : currentBatchMessages.length === 0 ? (
                <div className="modal-empty-msgs">
                  <Sparkles size={26} color="#00f0ff" />
                  <p>No messages recorded yet in {selectedBatch.BATCH_CODE}.</p>
                  <span>Post an announcement or message to initiate discussion with your students.</span>
                </div>
              ) : (
                currentBatchMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`tutor-msg-row ${msg.isSelf ? "self" : "other"}`}
                  >
                    {!msg.isSelf && (
                      <div
                        className={`msg-avatar-circle ${
                          msg.role ? msg.role.toLowerCase() : "student"
                        }`}
                      >
                        {msg.avatar}
                      </div>
                    )}

                    <div className="msg-content-block">
                      <div className="msg-meta-bar">
                        <span className="sender-name">{msg.sender}</span>
                        <span
                          className={`role-pill ${
                            msg.role ? msg.role.toLowerCase() : "student"
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

            {/* Modal Footer Input */}
            <form className="tutor-modal-footer" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder={`Send a message to ${selectedBatch.BATCH_CODE}...`}
                className="modal-input-field"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="modal-send-btn"
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

export default TutorChatroom;
