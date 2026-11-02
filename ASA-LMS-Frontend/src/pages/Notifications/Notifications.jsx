import React, { useEffect, useState, useRef, useMemo } from "react";
import Select from "react-select";
import {
  Bell,
  Send,
  Check,
  Clock,
  Radio,
  Megaphone,
  CheckCheck,
  Search,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Inbox,
  Filter,
  Sparkles,
  Eye,
  BookOpen,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  notificationsApi,
  batchesApi,
} from "../../services/apiService";
import { notificationAudienceData } from "../../services/dataService";
import "./Notifications.css";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    height: "42px",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    border: state.isFocused ? "1px solid #00e5ff" : "1px solid #334155",
    borderRadius: "8px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 229, 255, 0.08)" : "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),

  valueContainer: (base) => ({
    ...base,
    height: "40px",
    padding: "0 11px",
  }),

  singleValue: (base) => ({
    ...base,
    color: "#f8fafc",
    fontSize: "0.82rem",
    fontWeight: 500,
  }),

  placeholder: (base) => ({
    ...base,
    color: "#64748b",
    fontSize: "0.82rem",
  }),

  input: (base) => ({
    ...base,
    color: "#fff",
    fontSize: "0.82rem",
    margin: 0,
    padding: 0,
  }),

  indicatorSeparator: () => ({
    display: "none",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: "0 9px",
  }),

  menu: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    overflow: "hidden",
    zIndex: 9999,
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
  }),

  menuList: (base) => ({
    ...base,
    padding: "4px",
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#06b6d4"
      : state.isFocused
        ? "rgba(0, 229, 255, 0.12)"
        : "transparent",
    color: state.isSelected ? "#001018" : "#f8fafc",
    fontSize: "0.82rem",
    fontWeight: state.isSelected ? 600 : 500,
    padding: "9px 10px",
    borderRadius: "5px",
    cursor: "pointer",
  }),
};

// Helper to get logged-in user from storage
const getLoggedUser = () => {
  try {
    const raw =
      sessionStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Centralized, safe date parser that correctly handles ISO strings, UTC dates, and SQL datetime strings
const parseSafeDate = (date) => {
  if (!date) return null;
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof date === "string") {
    let clean = date.trim();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(clean)) {
      clean = clean.replace(" ", "T");
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

// Helper to format human-readable relative time
const getTimeAgo = (date) => {
  const created = parseSafeDate(date);
  if (!created) return "";
  const now = new Date();
  const diffSec = Math.floor((now - created) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return created.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDate = (date) => {
  const d = parseSafeDate(date);
  if (!d) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper to format details modal date (DD/MM/YYYY)
const formatDetailsDate = (date) => {
  const d = parseSafeDate(date);
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to format details modal time (HH:MM AM/PM)
const formatDetailsTime = (date) => {
  const d = parseSafeDate(date);
  if (!d) return "-";
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const strHours = String(hours).padStart(2, "0");
  return `${strHours}:${minutes} ${ampm}`;
};

// Helper for 2-3 word preview with ellipsis
const getShortPreview = (message, maxWords = 3) => {
  if (!message) return "";
  const words = message.trim().split(/\s+/);
  if (words.length <= maxWords) return message.trim();
  return words.slice(0, maxWords).join(" ") + "...";
};

// =========================================================================
// READ-ONLY NOTIFICATIONS VIEW (FOR STUDENT & TUTOR)
// =========================================================================
const ReadOnlyNotificationsView = ({ loggedUser, userType }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | UNREAD | BATCH | GENERAL
  const [readIds, setReadIds] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const isTutor = userType === "TUTOR";

  const userId =
    loggedUser?.USER_ID ||
    loggedUser?.userId ||
    loggedUser?.STUDENT_ID ||
    loggedUser?.id ||
    (isTutor ? "tutor" : "student");

  const storageKey = isTutor
    ? `asa_tutor_read_notifs_${userId}`
    : `asa_student_read_notifs_${userId}`;

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedNotification(null);
      }
    };
    if (selectedNotification) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNotification]);

  // Load read status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load read notifications state:", e);
    }
  }, [storageKey]);

  // Save read status to localStorage
  const saveReadIds = (ids) => {
    setReadIds(ids);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch (e) {
      console.error("Failed to save read notifications state:", e);
    }
  };

  const isRead = (id) => readIds.includes(id);

  const toggleReadStatus = (id, e) => {
    if (e) e.stopPropagation();
    if (isRead(id)) {
      saveReadIds(readIds.filter((item) => item !== id));
    } else {
      saveReadIds([...readIds, id]);
    }
  };

  const markAllAsRead = () => {
    const allIds = list.map((n) => n.NOTIFICATION_ID);
    const newReadIds = Array.from(new Set([...readIds, ...allIds]));
    saveReadIds(newReadIds);
    toast.success("All notifications marked as read");
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsApi.getNotifications({ userId });

      if (res.data.status === 1) {
        setList(res.data.data || []);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  // Handle opening notification details modal & mark as read
  const handleOpenNotification = (item) => {
    setSelectedNotification(item);
    if (!isRead(item.NOTIFICATION_ID)) {
      saveReadIds([...readIds, item.NOTIFICATION_ID]);
    }
  };

  // Compute counts
  const unreadCount = useMemo(() => {
    return list.filter((n) => !isRead(n.NOTIFICATION_ID)).length;
  }, [list, readIds]);

  const batchCount = useMemo(() => {
    return list.filter(
      (n) => String(n.AUDIENCE || "").toUpperCase() === "BATCH"
    ).length;
  }, [list]);

  const generalCount = useMemo(() => {
    return list.filter((n) => {
      const aud = String(n.AUDIENCE || "").toUpperCase();
      if (isTutor) {
        return aud === "TUTOR" || aud === "BOTH";
      }
      return aud === "STUDENT" || aud === "BOTH" || aud === "INDIVIDUAL";
    }).length;
  }, [list, isTutor]);

  // Filter and search
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.TITLE?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.MESSAGE?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.SENDER_NAME?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.BATCH_CODE?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const itemIsRead = isRead(item.NOTIFICATION_ID);
      const audience = String(item.AUDIENCE || "").toUpperCase();

      if (activeFilter === "UNREAD") return !itemIsRead;
      if (activeFilter === "BATCH") return audience === "BATCH";
      if (activeFilter === "GENERAL") {
        if (isTutor) {
          return audience === "TUTOR" || audience === "BOTH";
        }
        return audience === "STUDENT" || audience === "BOTH" || audience === "INDIVIDUAL";
      }

      return true;
    });
  }, [list, searchQuery, activeFilter, readIds, isTutor]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="notifications-page student-notifications-page">
      {/* ================= HEADER ================= */}
      <div className="notifications-header student-notif-header">
        <div className="header-left">
          <div className="section-label student-label">
            <Radio size={12} className="live-dot" />
            <span>{isTutor ? "TUTOR INBOX" : "STUDENT INBOX"}</span>
          </div>
          <h1 className="header-main-title">Notifications</h1>
          <p className="header-subtitle">
            {isTutor
              ? "Stay updated with your latest batch announcements, curriculum alerts, and academy notices."
              : "Stay updated with your latest batch announcements, class alerts, and academy notices."}
          </p>
        </div>

        <div className="header-right">
          <div
            className={`header-stat-pill unread-pill ${
              unreadCount > 0 ? "has-unread" : ""
            }`}
          >
            <Bell size={16} color={unreadCount > 0 ? "#00f0ff" : "#94a3b8"} />
            <span>
              {unreadCount} {unreadCount === 1 ? "Unread" : "Unread"}
            </span>
          </div>
          <div className="header-stat-pill total-pill">
            <Inbox size={16} color="#00f0ff" />
            <span>{list.length} Total</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="student-notif-container">
        {/* Toolbar: Filters, Search, Mark All Read */}
        <div className="student-notif-toolbar">
          <div className="student-filter-tabs">
            <button
              type="button"
              className={`student-tab ${activeFilter === "ALL" ? "active" : ""}`}
              onClick={() => {
                setActiveFilter("ALL");
                setCurrentPage(1);
              }}
            >
              All <span className="tab-badge">{list.length}</span>
            </button>

            <button
              type="button"
              className={`student-tab ${
                activeFilter === "UNREAD" ? "active" : ""
              }`}
              onClick={() => {
                setActiveFilter("UNREAD");
                setCurrentPage(1);
              }}
            >
              Unread{" "}
              <span
                className={`tab-badge ${
                  unreadCount > 0 ? "unread-badge" : ""
                }`}
              >
                {unreadCount}
              </span>
            </button>

            <button
              type="button"
              className={`student-tab ${
                activeFilter === "BATCH" ? "active" : ""
              }`}
              onClick={() => {
                setActiveFilter("BATCH");
                setCurrentPage(1);
              }}
            >
              Batch Updates <span className="tab-badge">{batchCount}</span>
            </button>

            <button
              type="button"
              className={`student-tab ${
                activeFilter === "GENERAL" ? "active" : ""
              }`}
              onClick={() => {
                setActiveFilter("GENERAL");
                setCurrentPage(1);
              }}
            >
              General <span className="tab-badge">{generalCount}</span>
            </button>
          </div>

          <div className="student-toolbar-actions">
            <div className="student-search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search notifications..."
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={markAllAsRead}
                title="Mark all notifications as read"
              >
                <CheckCheck size={15} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="student-notif-card">
          {loading ? (
            <div className="empty-history loading-state">
              <div className="empty-icon-wrapper spinner-wrapper">
                <div className="empty-spinner" />
              </div>
              <span className="empty-title">Loading Notifications</span>
              <span className="empty-subtitle">
                Fetching your latest inbox updates...
              </span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="empty-history student-empty">
              <div className="empty-icon-wrapper">
                <Bell className="empty-bell-icon" size={26} strokeWidth={1.8} />
              </div>
              <span className="empty-title">
                {searchQuery
                  ? "No matching notifications found"
                  : activeFilter === "UNREAD"
                  ? "You're all caught up!"
                  : "No Notifications Yet"}
              </span>
              <span className="empty-subtitle">
                {searchQuery
                  ? `No announcements match "${searchQuery}". Try a different keyword.`
                  : activeFilter === "UNREAD"
                  ? "You have read all received announcements and updates."
                  : "Important announcements and batch alerts will appear here."}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  className="reset-filter-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("ALL");
                  }}
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          ) : (
            <div className="student-notif-feed">
              {paginatedList.map((item) => {
                const itemRead = isRead(item.NOTIFICATION_ID);
                const audience = String(
                  item.AUDIENCE || ""
                ).toUpperCase();

                return (
                  <div
                    key={item.NOTIFICATION_ID}
                    className={`student-notif-row ${
                      itemRead ? "read" : "unread"
                    }`}
                    onClick={() => handleOpenNotification(item)}
                  >
                    {/* Status Indicator Icon */}
                    <div className="notif-icon-col">
                      <div
                        className={`notif-avatar-icon ${
                          itemRead ? "read" : "unread"
                        }`}
                      >
                        {audience === "BATCH" ? (
                          <Radio size={16} />
                        ) : (
                          <Megaphone size={16} />
                        )}
                      </div>
                      {!itemRead && <span className="unread-dot" />}
                    </div>

                    {/* Notification Details */}
                    <div className="notif-main-col">
                      <div className="notif-top-row">
                        <div className="notif-title-group">
                          <h3 className="notif-title-text">{item.TITLE}</h3>
                          {!itemRead && (
                            <span className="notif-badge-new">NEW</span>
                          )}
                        </div>

                        <div className="notif-badges-group">
                          {audience === "BATCH" && (
                            <span className="student-badge badge-batch">
                              {item.BATCH_CODE || `BATCH-${item.BATCH_ID}`}
                            </span>
                          )}
                          {audience === "STUDENT" && (
                            <span className="student-badge badge-student">
                              Student Alert
                            </span>
                          )}
                          {audience === "TUTOR" && (
                            <span className="student-badge badge-tutor">
                              Tutor Alert
                            </span>
                          )}
                          {audience === "BOTH" && (
                            <span className="student-badge badge-general">
                              General Broadcast
                            </span>
                          )}
                          {audience === "INDIVIDUAL" && (
                            <span className="student-badge badge-student">
                              Assessment Reminder
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Short 2-3 Word Preview */}
                      <div className="notif-message-preview">
                        {getShortPreview(item.MESSAGE, 3)}
                      </div>

                      {/* Meta Footer */}
                      <div className="notif-bottom-row">
                        <div className="notif-meta-item">
                          <User size={13} className="meta-icon" />
                          <span>
                            From:{" "}
                            <strong>
                              {item.SENDER_NAME || "Administration"}
                            </strong>
                          </span>
                        </div>

                        <div className="notif-meta-divider">•</div>

                        <div className="notif-meta-item">
                          <Clock size={13} className="meta-icon" />
                          <span title={formatDate(item.CREATED_AT)}>
                            {getTimeAgo(item.CREATED_AT)}
                          </span>
                        </div>

                        <div className="notif-actions-item">
                          <button
                            type="button"
                            className={`toggle-read-btn ${
                              itemRead ? "read-btn" : "unread-btn"
                            }`}
                            onClick={(e) =>
                              toggleReadStatus(item.NOTIFICATION_ID, e)
                            }
                            title={
                              itemRead ? "Mark as unread" : "Mark as read"
                            }
                          >
                            {itemRead ? (
                              <>
                                <CheckCheck size={13} />
                                <span>Read</span>
                              </>
                            ) : (
                              <>
                                <Check size={13} />
                                <span>Mark as read</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="history-pagination student-pagination">
              <div className="history-pagination-info">
                Showing Page {currentPage} of {totalPages} ({filteredList.length}{" "}
                total)
              </div>
              <div className="history-pagination-actions">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= NOTIFICATION DETAILS MODAL ================= */}
      {selectedNotification && (
        <div
          className="notif-modal-backdrop"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="notif-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notif-modal-header">
              <div className="notif-modal-title-box">
                <div className="notif-modal-icon-badge">
                  <Bell size={20} color="#00f0ff" />
                </div>
                <div>
                  <h2 className="notif-modal-heading">Notification</h2>
                  {selectedNotification.TITLE && (
                    <p className="notif-modal-subheading">
                      {selectedNotification.TITLE}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="notif-modal-close-btn"
                onClick={() => setSelectedNotification(null)}
                aria-label="Close notification"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notif-modal-body">
              {/* Full Message */}
              <div className="notif-modal-message-box">
                <p className="notif-modal-message-text">
                  {selectedNotification.MESSAGE}
                </p>
              </div>

              {/* Metadata Details Card */}
              <div className="notif-modal-meta-box">
                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Sent by:</span>
                  <span className="notif-meta-val">
                    {selectedNotification.SENDER_NAME || "Administration"}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Sent Date:</span>
                  <span className="notif-meta-val">
                    {formatDetailsDate(
                      selectedNotification.SENT_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Sent Time:</span>
                  <span className="notif-meta-val">
                    {formatDetailsTime(
                      selectedNotification.SENT_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Received Date:</span>
                  <span className="notif-meta-val">
                    {formatDetailsDate(
                      selectedNotification.RECEIVED_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Received Time:</span>
                  <span className="notif-meta-val">
                    {formatDetailsTime(
                      selectedNotification.RECEIVED_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="notif-modal-footer">
              <button
                type="button"
                className="notif-modal-close-action"
                onClick={() => setSelectedNotification(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// =========================================================================
// ADMIN NOTIFICATION MANAGEMENT VIEW (UNCHANGED FOR ADMIN)
// =========================================================================
const AdminNotificationsView = ({ loggedUser }) => {
  const [selectedAudience, setSelectedAudience] = useState(
    notificationAudienceData[0]
  );
  const [batchOptions, setBatchOptions] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [list, setList] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const fetchedRef = useRef(false);

  const adminUserId =
    loggedUser?.USER_ID ||
    loggedUser?.userId ||
    loggedUser?.id;

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedNotification(null);
      }
    };
    if (selectedNotification) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNotification]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsApi.getNotifications(
        adminUserId ? { userId: adminUserId } : {}
      );

      if (res.data.status == 1) {
        setList(res.data.data || []);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setBatchLoading(true);
      const res = await batchesApi.getBatches();

      if (res.data.status === 1) {
        const batches = res.data.data || [];

        const options = batches.map((batch) => ({
          value: batch.ID,
          batchCode: batch.BATCH_CODE,
          label: batch.BATCH_CODE || `BATCH-${batch.ID}`,
        }));

        setBatchOptions(options);
      } else {
        setBatchOptions([]);
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
      toast.error("Failed to load batches");
      setBatchOptions([]);
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetchNotifications();
    fetchBatches();
  }, []);

  const handleSend = async () => {
    if (!title.trim()) {
      toast.error("Please enter notification title");
      return;
    }

    if (!message.trim()) {
      toast.error("Please enter notification message");
      return;
    }

    if (!selectedAudience) {
      toast.error("Please select target audience");
      return;
    }

    if (selectedAudience.value === "BATCH" && !selectedBatch) {
      toast.error("Please select a batch");
      return;
    }

    try {
      setSending(true);

      const res = await notificationsApi.sendNotification({
        audience: selectedAudience.value,
        batchId:
          selectedAudience.value === "BATCH" ? selectedBatch.value : null,
        title: title.trim(),
        message: message.trim(),
      });

      if (res.data.status === 1) {
        toast.success(res.data.message);

        setTitle("");
        setMessage("");
        setSelectedAudience(notificationAudienceData[0]);
        setSelectedBatch(null);

        await fetchNotifications();
        setCurrentPage(1);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error("Failed to send notification:", err);
      toast.error(
        err?.response?.data?.message || "Failed to send notification"
      );
    } finally {
      setSending(false);
    }
  };

  const getAudienceLabel = (audience) => {
    switch (audience) {
      case "BOTH":
        return "Both";
      case "TUTOR":
        return "Tutor";
      case "STUDENT":
        return "Student";
      default:
        return audience || "";
    }
  };

  const getAudienceClass = (audience) => {
    const value = String(audience || "").trim().toUpperCase();

    switch (value) {
      case "BOTH":
        return "both";
      case "BATCH":
        return "batch";
      case "TUTOR":
        return "tutor";
      case "STUDENT":
        return "student";
      default:
        return "";
    }
  };

  const isFormValid =
    title.trim() !== "" &&
    message.trim() !== "" &&
    selectedAudience &&
    (selectedAudience.value !== "BATCH" || selectedBatch);

  const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
  const paginatedList = list.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="notifications-page">
      {/* ================= HEADER ================= */}
      <div className="notifications-header">
        <div className="header-left">
          <div className="section-label">
            <Radio size={12} className="live-dot" />
            <span>BROADCAST ENGINE</span>
          </div>
          <h1 className="header-main-title">Program Notifications</h1>
          <p className="header-subtitle">
            Send instant broadcast announcements to tutors, students, or both.
          </p>
        </div>
        <div className="header-right">
          <div className="header-stat-pill">
            <Megaphone size={16} color="#00f0ff" />
            <span>{list.length} Total Sent</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="notifications-grid">
        {/* ================= COMPOSER ================= */}
        <section className="notification-card composer-card">
          <div className="card-header">
            <div className="card-title-box">
              <Send size={18} color="#00f0ff" />
              <h2>New Broadcast</h2>
            </div>
          </div>

          {/* Audience */}
          <div className="notification-field">
            <label>TARGET AUDIENCE</label>
            <Select
              value={selectedAudience}
              options={notificationAudienceData}
              onChange={(option) => {
                setSelectedAudience(option);
                if (option?.value !== "BATCH") {
                  setSelectedBatch(null);
                }
              }}
              styles={selectStyles}
              classNamePrefix="notification-select"
              isSearchable={false}
              menuPlacement="auto"
              components={{
                Option: ({ innerRef, innerProps, data, isSelected }) => (
                  <div
                    ref={innerRef}
                    {...innerProps}
                    className={`notification-option ${
                      isSelected ? "selected" : ""
                    }`}
                  >
                    <span className="option-label">{data.label}</span>
                    {isSelected && (
                      <span className="option-check">
                        <Check size={16} />
                      </span>
                    )}
                  </div>
                ),
              }}
            />
          </div>

          {selectedAudience?.value === "BATCH" && (
            <div className="notification-field">
              <label>
                SELECT BATCH <span className="required">*</span>
              </label>
              <Select
                value={selectedBatch}
                options={batchOptions}
                onChange={setSelectedBatch}
                isLoading={batchLoading}
                isSearchable
                placeholder="Select Batch"
                noOptionsMessage={() => "No batches found"}
                styles={selectStyles}
                classNamePrefix="notification-select"
                menuPlacement="auto"
              />
            </div>
          )}

          {/* Title */}
          <div className="notification-field">
            <div className="label-row">
              <label>NOTIFICATION TITLE</label>
              <span className="char-count">{title.length}/120</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Fee reminder & Schedule update"
              maxLength={120}
            />
          </div>

          {/* Message */}
          <div className="notification-field message-field">
            <div className="label-row">
              <label>MESSAGE BODY</label>
              <span className="char-count">{message.length}/1000</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type the notification body here..."
              maxLength={1000}
            />
          </div>

          {/* Send */}
          <button
            type="button"
            className={`send-btn ${isFormValid ? "active" : "disabled"}`}
            onClick={handleSend}
            disabled={!isFormValid || sending}
          >
            <Send size={16} strokeWidth={2.2} />
            <span>{sending ? "Sending..." : "Send Broadcast"}</span>
          </button>
        </section>

        {/* ================= HISTORY ================= */}
        <section className="notification-card history-card">
          <div className="history-header">
            <div className="card-title-box">
              <Clock size={18} color="#00f0ff" />
              <h2>Recently Sent</h2>
            </div>
            <span className="count-badge">{list.length} History</span>
          </div>

          <div className="history-list">
            {loading ? (
              <div className="empty-history loading-state">
                <div className="empty-icon-wrapper spinner-wrapper">
                  <div className="empty-spinner" />
                </div>
                <span className="empty-title">Loading History</span>
                <span className="empty-subtitle">
                  Fetching broadcast history...
                </span>
              </div>
            ) : list.length === 0 ? (
              <div className="empty-history">
                <div className="empty-icon-wrapper">
                  <Bell
                    className="empty-bell-icon"
                    size={24}
                    strokeWidth={1.75}
                  />
                </div>
                <span className="empty-title">No Notifications Sent</span>
                <span className="empty-subtitle">
                  Sent broadcast messages and program updates will appear here.
                </span>
              </div>
            ) : (
              paginatedList.map((item) => {
                const audience = String(item.AUDIENCE || "")
                  .trim()
                  .toUpperCase();

                return (
                  <div
                    className={`history-item ${getAudienceClass(audience)}`}
                    key={item.NOTIFICATION_ID}
                    onClick={() => setSelectedNotification(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="history-content">
                      <div className="history-title-row">
                        <div className="history-title">
                          <div className="history-bell-wrapper">
                            <Bell
                              className="notification-bell"
                              size={14}
                              strokeWidth={2}
                            />
                          </div>
                          <h3>{item.TITLE}</h3>
                        </div>

                        <div className="history-audience-box">
                          <span
                            className={`audience-badge ${getAudienceClass(
                              audience
                            )}`}
                          >
                            {getAudienceLabel(audience)}
                          </span>

                          {audience === "BATCH" && (
                            <span className="history-batch-info">
                              {item.BATCH_CODE ||
                                `BATCH-${item.BATCH_ID || ""}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <p>{getShortPreview(item.MESSAGE, 3)}</p>

                      <div className="history-meta">
                        <div className="meta-left">
                          <Clock size={12} className="time-icon" />
                          <span className="history-time">
                            {getTimeAgo(item.CREATED_AT)}
                          </span>
                        </div>

                        <div className="meta-right">
                          <CheckCheck size={13} className="delivery-icon" />
                          <span className="delivered-tag">Delivered</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {totalPages > 1 && (
              <div className="history-pagination">
                <div className="history-pagination-info">
                  Showing Page {currentPage} of {totalPages}
                </div>
                <div className="history-pagination-actions">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ================= NOTIFICATION DETAILS MODAL ================= */}
      {selectedNotification && (
        <div
          className="notif-modal-backdrop"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="notif-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notif-modal-header">
              <div className="notif-modal-title-box">
                <div className="notif-modal-icon-badge">
                  <Bell size={20} color="#00f0ff" />
                </div>
                <div>
                  <h2 className="notif-modal-heading">Notification Details</h2>
                  {selectedNotification.TITLE && (
                    <p className="notif-modal-subheading">
                      {selectedNotification.TITLE}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="notif-modal-close-btn"
                onClick={() => setSelectedNotification(null)}
                aria-label="Close notification"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notif-modal-body">
              {/* Full Message */}
              <div className="notif-modal-message-box">
                <p className="notif-modal-message-text">
                  {selectedNotification.MESSAGE}
                </p>
              </div>

              {/* Metadata Details Card */}
              <div className="notif-modal-meta-box">
                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Target Audience:</span>
                  <span className="notif-meta-val">
                    {getAudienceLabel(selectedNotification.AUDIENCE)}
                    {selectedNotification.BATCH_CODE
                      ? ` (${selectedNotification.BATCH_CODE})`
                      : ""}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Sent Date:</span>
                  <span className="notif-meta-val">
                    {formatDetailsDate(
                      selectedNotification.SENT_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Sent Time:</span>
                  <span className="notif-meta-val">
                    {formatDetailsTime(
                      selectedNotification.SENT_AT ||
                        selectedNotification.CREATED_AT
                    )}
                  </span>
                </div>

                <div className="notif-modal-meta-row">
                  <span className="notif-meta-label">Status:</span>
                  <span className="notif-meta-val" style={{ color: "#00f0ff" }}>
                    Delivered
                  </span>
                </div>
              </div>
            </div>

            <div className="notif-modal-footer">
              <button
                type="button"
                className="notif-modal-close-action"
                onClick={() => setSelectedNotification(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// =========================================================================
// MAIN NOTIFICATIONS ROUTER / ENTRY
// =========================================================================
const Notifications = () => {
  const loggedUser = getLoggedUser();
  const userType = String(
    loggedUser?.USER_TYPE || loggedUser?.ROLE || ""
  ).trim().toUpperCase();

  const isReadOnly = userType === "STUDENT" || userType === "TUTOR";

  if (isReadOnly) {
    return <ReadOnlyNotificationsView loggedUser={loggedUser} userType={userType} />;
  }

  return <AdminNotificationsView loggedUser={loggedUser} />;
};

export default Notifications;
