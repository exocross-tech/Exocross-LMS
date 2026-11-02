import React, { useEffect, useState, useRef } from "react";
import Select from "react-select";
import { Send, Check, Clock, Radio, Megaphone, CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import { batchAnnouncementsApi, classScheduleApi } from "../../services/apiService";
//import { BatchAnnouncementsAudienceData } from "../../services/dataService";
//import { BatchAnnouncementsTableHeading } from "../../services/tableHeading";
//import ClientSideTable from "../../components/ClientSideTable/ClientSideTable";
import "./BatchAnnouncements.css";

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

const BatchAnnouncements = () => {

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchOptions, setBatchOptions] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [list, setList] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const isFetched = useRef(false);

  const getLoggedUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchBatches();
      fetchBatchAnnouncements();
    }
  }, []);

  const fetchBatches = async () => {
    const user = getLoggedUser();
    const userId = user?.USER_ID || user?.ID || user?.id;

    if (!userId) {
      setBatchOptions([]);
      return;
    }

    try {
      const res = await batchAnnouncementsApi.getBatches({ userId });

      if (res.data?.status === 1 && Array.isArray(res.data.data)) {
        const options = res.data.data.map((b) => ({
          value: b.ID,
          label: b.BATCH_CODE,
        }));

        setBatchOptions(options);
      } else {
        setBatchOptions([]);
      }
    } catch (err) {
      console.error("Failed to fetch batches", err);
      setBatchOptions([]);
    }
  };

  const fetchBatchAnnouncements = async () => {
    const user = getLoggedUser();
    const userId = user?.USER_ID || user?.ID || user?.id;

    if (!userId) {
      setList([]);
      return;
    }

    try {
      setLoading(true);

      const res = await batchAnnouncementsApi.getAll({ userId });

      if (res.data?.status === 1 && Array.isArray(res.data.data)) {
        setList(res.data.data || []);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error("Failed to fetch announcements", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!isFormValid || sending) return;

    const user = getLoggedUser();
    const userId = user?.USER_ID || user?.ID || user?.id;

    if (!userId) {
      toast.error("Unable to identify logged-in user. Please log in again.");
      return;
    }

    try {
      setSending(true);

      const res = await batchAnnouncementsApi.create({
        batchId: selectedBatch.value,
        title: title.trim(),
        message: message.trim(),
        userId: userId,
      });

      if (res.data?.status === 1) {
        toast.success(res.data.message || "Announcement sent");

        setTitle("");
        setMessage("");
        setSelectedBatch(null);

        fetchBatchAnnouncements();
      } else {
        toast.error(res.data?.message || "Failed to send announcement");
      }
    } catch (err) {
      console.error("Failed to send announcement:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send announcement";
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };
  const getTimeAgo = (date) => {
    if (!date) return "";
    const created = new Date(date);
    const now = new Date();
    const diffSec = Math.floor((now - created) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    return `${diffDay}d ago`;
  };
  const isFormValid =
    selectedBatch && title.trim() !== "" && message.trim() !== "";
  const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
  const paginatedList = list.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="batchannouncements-page">
      {/* ================= HEADER ================= */}
      <div className="batchannouncements-header">
        {" "}
        <div className="header-left">
          {" "}
          <div className="section-label">
            {" "}
            <Radio size={12} className="live-dot" /> <span>BROADCAST</span>{" "}
          </div>{" "}
          <h1 className="header-main-title">Batch Announcements</h1>{" "}
          <p className="header-subtitle">
            {" "}
            Send instant broadcast announcements to batches.{" "}
          </p>{" "}
        </div>{" "}
        <div className="header-right">
          {" "}
          <div className="header-stat-pill">
            {" "}
            <Megaphone size={16} color="#00f0ff" />{" "}
            <span>{list.length} Total Sent</span>{" "}
          </div>{" "}
        </div>{" "}
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="batchannouncements-grid">
        {/* ================= COMPOSER ================= */}
        <section className="batchannouncements-card composer-card">
          <div className="card-header">
            <div className="card-title-box">
              <Send size={18} color="#00f0ff" />
              <h2>New Broadcast</h2>
            </div>
          </div>

          {/* Audience */}
          <div className="batchannouncements-field">
            <label>BATCH</label>
            <Select
              options={batchOptions}
              value={selectedBatch}
              onChange={(option) => setSelectedBatch(option)}
              placeholder="Select Batch..."
              styles={selectStyles}
              isSearchable={true}
              noOptionsMessage={() => "No assigned batches found"}
            />
          </div>

          {/* Title */}
          <div className="batchannouncements-field">
            <div className="label-row">
              <label>Batch Announcements TITLE</label>
              <span className="char-count">{title.length}/120</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Live class resheduled"
              maxLength={120}
            />
          </div>

          {/* Message */}
          <div className="batchannouncements-field message-field">
            <div className="label-row">
              <label>MESSAGE BODY</label>
              <span className="char-count">{message.length}/1000</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type the batch announcements body here..."
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
            <span>{sending ? "Sending..." : "Send Announcement"}</span>
          </button>
        </section>

        {/* ================= HISTORY ================= */}
        <section className="batchannouncements-card history-card">
          <div className="history-header">
            <div className="card-title-box">
              <Clock size={18} color="#00f0ff" />
              <h2>Recent broadcasts</h2>
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
                  Fetching Announcement history...
                </span>
              </div>
            ) : list.length === 0 ? (
              <div className="empty-history">
                <div className="empty-icon-wrapper">
                  <Megaphone
                    className="empty-announcement-icon"
                    size={24}
                    strokeWidth={1.75}
                  />
                </div>
                <span className="empty-title">No BatchAnnouncements Sent</span>
                <span className="empty-subtitle">
                  Sent announcement messages and program updates will appear
                  here.
                </span>
              </div>
            ) : (
              paginatedList.map((item) => (
                <div className="history-item" key={item.ID}>
                  <div className="history-content">
                    <div className="history-title-row">
                      <div className="history-title">
                        <div className="history-bell-wrapper">
                          <Megaphone
                            className="announcement-icon"
                            size={14}
                            strokeWidth={2}
                          />
                        </div>
                        <h3>{item.TITLE}</h3>
                      </div>
                      <span className="audience-badge batch">
                        {" "}
                        {item.BATCH_CODE}{" "}
                      </span>
                    </div>
                    <p>{item.MESSAGE}</p>
                    <div className="history-meta">
                      <div className="meta-left">
                        <Clock size={12} className="time-icon" />
                        <span className="history-time">
                          {" "}
                          {getTimeAgo(item.CREATED_AT)}{" "}
                        </span>
                      </div>
                      <div className="meta-right">
                        <CheckCheck size={13} color="#00f0ff" />
                        <span className="delivered-tag">Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
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
    </div>
  );
};

export default BatchAnnouncements;
