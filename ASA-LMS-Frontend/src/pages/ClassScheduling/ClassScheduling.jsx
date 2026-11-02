import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import Select from "react-select";
import {
  CalendarDays,
  Clock,
  Video,
  Link,
  Copy,
  Radio,
  Plus,
  Trash2,
  Edit3,
  X,
} from "lucide-react";
import "./ClassScheduling.css";
import {
  batchAnnouncementsApi,
  classScheduleApi,
} from "../../services/apiService";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
  }),
  singleValue: (base) => ({ ...base, color: "#f8fafc" }),
  placeholder: (base) => ({ ...base, color: "#64748b" }),
  input: (base) => ({ ...base, color: "#fff" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "#94a3b8" }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    overflow: "hidden",
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#06b6d4"
      : state.isFocused
        ? "rgba(0, 229, 255, 0.12)"
        : "transparent",
    color: state.isSelected ? "#001018" : "#f8fafc",
    padding: "10px 12px",
    cursor: "pointer",
  }),
};

const ClassScheduling = () => {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchOptions, setBatchOptions] = useState([]);
  const [assignedBatchIds, setAssignedBatchIds] = useState([]);
  const [classes, setClasses] = useState([]);
  const [slots, setSlots] = useState([
    { id: Date.now(), topic: "", date: null, time: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const isFetched = useRef(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Format date using local timezone
  const formatLocalDate = (date) => {
    if (!date) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Parse YYYY-MM-DD or ISO string to local Date without UTC shift
  const parseLocalDateOnly = (str) => {
    if (!str) return null;
    if (typeof str === "string") {
      const clean = str.split("T")[0];
      const parts = clean.split("-");
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m, d);
        }
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  // Edit Modal State
  const [editingClass, setEditingClass] = useState(null);
  const [editBatch, setEditBatch] = useState(null);
  const [editTopic, setEditTopic] = useState("");
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      initializeScheduling();
    }
  }, []);

  const initializeScheduling = async () => {
    try {
      const user = JSON.parse(
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        "{}"
      );

      const userId = user?.USER_ID;

      if (!userId) {
        toast.error("User information not found");
        return;
      }

      // 1. Get batches (role-aware: all active for ADMIN, assigned HOST batches for TUTOR)
      const batchRes = await classScheduleApi.getTutorBatches(userId);

      if (batchRes.data.status !== 1) {
        toast.error(
          batchRes.data.message || "Failed to fetch batches"
        );
        return;
      }

      const batches = batchRes.data.data || [];

      const options = batches.map((b) => ({
        value: Number(b.ID),
        label: b.BATCH_CODE,
        batchCode: b.BATCH_CODE,
      }));

      setBatchOptions(options);

      const batchIds = batches.map((b) => Number(b.ID));

      setAssignedBatchIds(batchIds);

      // 2. Get upcoming classes (role-aware: all upcoming for ADMIN, HOST classes for TUTOR)
      const classRes = await classScheduleApi.getUpcoming(userId);

      if (classRes.data.status === 1) {
        const scheduledClasses = classRes.data.data || [];

        setClasses(scheduledClasses);
        setCurrentPage(1);
      }

    } catch (error) {
      console.error("Failed to initialize scheduling:", error);

      toast.error(
        error?.response?.data?.message ||
        "Failed to load scheduling data"
      );
    }
  };
  const handleAddSlot = () => {
    setSlots((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), topic: "", date: null, time: null },
    ]);
  };

  const handleRemoveSlot = (id) => {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSlotChange = (id, field, value) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const handleOpenEditModal = (item) => {
    setEditingClass(item);
    setEditTopic(item.TOPIC || "");
    const dateVal = item.CLASS_DATE_STR || item.CLASS_DATE;
    setEditDate(parseLocalDateOnly(dateVal));

    // Preselect current batch using batchOptions or item data
    const matchedBatch =
      batchOptions.find((b) => Number(b.value) === Number(item.BATCH_ID)) ||
      (item.BATCH_ID
        ? {
            value: Number(item.BATCH_ID),
            label: item.BATCH_CODE || `Batch #${item.BATCH_ID}`,
            batchCode: item.BATCH_CODE,
          }
        : null);
    setEditBatch(matchedBatch);

    if (item.CLASS_TIME) {
      const parts = item.CLASS_TIME.split(":");
      const t = new Date();
      t.setHours(
        Number(parts[0] || 0),
        Number(parts[1] || 0),
        Number(parts[2] || 0),
        0,
      );
      setEditTime(t);
    } else {
      setEditTime(null);
    }
  };

  const handleCloseEditModal = () => {
    setEditingClass(null);
    setEditBatch(null);
    setEditTopic("");
    setEditDate(null);
    setEditTime(null);
  };

  const handleSaveEdit = async () => {
    if (
      !editingClass ||
      !editBatch ||
      !editTopic.trim() ||
      !editDate ||
      !editTime
    ) {
      toast.error("Please fill batch, topic, date and time");
      return;
    }

    const dateStr = formatLocalDate(editDate);

    const timeStr = editTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    setEditLoading(true);

    try {
      const res = await classScheduleApi.update(editingClass.ID, {
        topic: editTopic.trim(),
        batch_id: editBatch.value,
        batchId: editBatch.value,
        classDate: dateStr,
        classTime: timeStr,
      });

      if (res.data.status === 1) {
        toast.success(
          res.data.message || "Class schedule updated successfully",
        );

        handleCloseEditModal();

        await fetchUpcomingClasses();
      } else {
        toast.error(res.data.message || "Failed to update class");
      }
    } catch (err) {
      console.error("UPDATE ERROR:", err?.response?.data || err);

      toast.error(
        err?.response?.data?.message || "Failed to update class",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (
      !selectedBatch ||
      slots.length === 0 ||
      slots.some((s) => !s.topic.trim() || !s.date || !s.time)
    ) {
      toast.error(
        "Please select batch and fill all slot topics, dates & times",
      );
      return;
    }

    const slotKeys = slots.map((s) => {
      const dStr = formatLocalDate(s.date);
      const tStr = s.time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${dStr}_${tStr}`;
    });

    if (new Set(slotKeys).size !== slotKeys.length) {
      toast.error("Duplicate date and time slot found in your list");
      return;
    }
    const formattedSlotsHtml = slots
      .map((s, index) => {
        const dDisplay = s.date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const tDisplay = s.time.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.15); padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 0.85rem;">
            <div style="margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 600;">Slot ${index + 1}:</span>
              <span style="color: #00f0ff; font-weight: 600;">${s.topic}</span>
            </div>
            <div style="color: #f8fafc;">${dDisplay} at <strong style="color: #00e5ff;">${tDisplay}</strong></div>
          </div>
        `;
      })
      .join("");

    const result = await Swal.fire({
      title:
        slots.length > 1
          ? `Schedule ${slots.length} Live Classes?`
          : "Schedule Live Class?",
      html: `
        <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; color: #cbd5e1;">
          <p style="margin-bottom: 12px; color: #94a3b8;">Are you sure you want to schedule ${slots.length > 1 ? "these classes" : "this class"} and generate meeting links?</p>
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); padding: 14px; border-radius: 10px; margin-top: 8px;">
            <div style="margin-bottom: 10px;"><strong>Batch:</strong> <span style="color: #f8fafc;">${selectedBatch.label}</span></div>
            <div>
              <strong style="display: block; margin-bottom: 6px; color: #94a3b8;">Schedule Slots (${slots.length}):</strong>
              ${formattedSlotsHtml}
            </div>
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#06b6d4",
      cancelButtonColor: "#64748b",
      confirmButtonText:
        slots.length > 1
          ? `Yes, Schedule ${slots.length} Classes`
          : "Yes, Schedule Class",
      cancelButtonText: "Cancel",
      background: "#0f172a",
      color: "#f8fafc",
    });

    if (!result.isConfirmed) return;

    setLoading(true);

    const slotsPayload = slots.map((slot) => ({
      topic: slot.topic.trim(),
      classDate: formatLocalDate(slot.date),
      classTime: slot.time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    }));

    try {
      const user = JSON.parse(
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        "{}"
      );

      const res = await classScheduleApi.create({
        batchId: selectedBatch.value,
        createdBy: String(user?.USER_ID || "1"),
        slots: slotsPayload,
      });

      if (res.data.status === 1) {
        toast.success(res.data.message || "Class(es) scheduled successfully!");

        // Keep selectedBatch
        // setSelectedBatch(null); ❌ REMOVE

        // Reset only the class slot fields
        setSlots([
          {
            id: Date.now(),
            topic: "",
            date: null,
            time: null,
          },
        ]);

        fetchUpcomingClasses();
      } else {
        toast.error(res.data.message || "Failed to schedule classes");
      }
    } catch (err) {
      console.error(err);

      toast.error(err?.response?.data?.message || "Failed to schedule classes");
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingClasses = async () => {
    try {
      const user = JSON.parse(
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        "{}"
      );

      const userId = user?.USER_ID;

      if (!userId) {
        toast.error("User information not found");
        return;
      }

      const res =
        await classScheduleApi.getUpcoming(userId);

      if (res.data.status === 1) {
        const scheduledClasses =
          res.data.data || [];

        setClasses(scheduledClasses);
        setCurrentPage(1);
      }

    } catch (error) {
      console.error(
        "Failed to fetch upcoming classes:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
        "Failed to fetch upcoming classes"
      );
    }
  };
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied");
  };

  const isFormValid =
    selectedBatch &&
    slots.length > 0 &&
    slots.every(
      (s) =>
        s.topic && s.topic.trim() !== "" && s.date !== null && s.time !== null,
    );

  const formatClassDay = (dateString) => {
    if (!dateString) return "";
    const target = parseLocalDateOnly(dateString);
    if (!target) return "";
    const today = new Date();
    const tomorrow = new Date();
    today.setHours(0, 0, 0, 0);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const targetDate = new Date(target);
    targetDate.setHours(0, 0, 0, 0);
    if (targetDate.getTime() === today.getTime()) {
      return "Today";
    }
    if (targetDate.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    }
    return target.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const totalPages = Math.ceil(classes.length / itemsPerPage);
  const paginatedClasses = classes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const formatClassTime = (timeValue) => {
    if (!timeValue) return "";
    if (typeof timeValue === "string") {
      const parts = timeValue.split(":");
      const date = new Date();
      date.setHours(Number(parts[0] || 0));
      date.setMinutes(Number(parts[1] || 0));
      date.setSeconds(Number(parts[2] || 0));
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    return new Date(timeValue).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="classschedule-page">
      <div className="classschedule-header">
        <div className="header-left">
          <div className="section-label">
            <Radio size={12} className="live-dot" />
            <span>LIVE SESSIONS</span>
          </div>

          <h1 className="header-main-title">Class Scheduling</h1>

          <p className="header-subtitle">
            Create a new class and auto-generate a secure join link for the
            batch.
          </p>
        </div>
      </div>

      <div className="classschedule-grid">
        <section className="classschedule-card schedule-card">
          <div className="card-title-box">
            <CalendarDays size={18} color="#00f0ff" />
            <h2>Schedule New Class</h2>
          </div>
          <div className="classschedule-field">
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

          <div className="slots-header">
            <label>CLASS SLOTS</label>
            <button
              type="button"
              className="add-slot-btn-top"
              onClick={handleAddSlot}
            >
              <Plus size={13} />
              <span>Add Slot</span>
            </button>
          </div>

          <div className="slots-container">
            {slots.map((slot, index) => (
              <div key={slot.id} className="slot-item-card">
                <div className="slot-card-header">
                  <span className="slot-number-badge">Slot #{index + 1}</span>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      className="slot-remove-btn"
                      onClick={() => handleRemoveSlot(slot.id)}
                      title="Remove slot"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="classschedule-field">
                  <label>TOPIC</label>
                  <input
                    type="text"
                    value={slot.topic}
                    onChange={(e) =>
                      handleSlotChange(slot.id, "topic", e.target.value)
                    }
                    placeholder="e.g. Aerodynamics Lab"
                  />
                </div>

                <div className="date-time-row">
                  {/* DATE */}
                  <div className="classschedule-field">
                    <label>DATE</label>
                    <div className="picker-wrapper">
                      <DatePicker
                        selected={slot.date}
                        onChange={(date) =>
                          handleSlotChange(slot.id, "date", date)
                        }
                        dateFormat="dd-MM-yyyy"
                        placeholderText="dd-mm-yyyy"
                        className="datetime-picker-input"
                        minDate={tomorrow}
                        portalId="root"
                      />
                      <CalendarDays size={18} className="picker-icon" />
                    </div>
                  </div>
                  {/* TIME */}
                  <div className="classschedule-field">
                    <label>TIME</label>
                    <div className="picker-wrapper">
                      <DatePicker
                        selected={slot.time}
                        onChange={(time) =>
                          handleSlotChange(slot.id, "time", time)
                        }
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="hh:mm aa"
                        placeholderText="--:-- --"
                        className="datetime-picker-input"
                        portalId="root"
                      />
                      <Clock size={18} className="picker-icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-slot-btn-full"
            onClick={handleAddSlot}
          >
            <Plus size={15} />
            <span>Add Another Slot</span>
          </button>

          <button
            className={`schedule-btn ${isFormValid && !loading ? "active" : "disabled"}`}
            onClick={handleSchedule}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <Video size={16} />
                <span>
                  {slots.length > 1
                    ? `Schedule ${slots.length} Classes & Generate Links`
                    : "Schedule & Generate Link"}
                </span>
              </>
            )}
          </button>
        </section>

        <section className="classschedule-card upcoming-card">
          <div className="card-title-box">
            <Clock size={18} color="#00f0ff" />
            <h2>Upcoming Scheduled Classes</h2>
          </div>

          {classes.length === 0 ? (
            <div className="no-classes-container">
              <div className="no-classes-icon-box">
                <CalendarDays size={36} className="no-classes-icon" />
              </div>
              <h3 className="no-classes-title">No Class Scheduled</h3>
              <p className="no-classes-desc">
                There are no upcoming live sessions scheduled. Select a topic
                and batch to schedule a new class.
              </p>
            </div>
          ) : (
            <>
              <div className="upcoming-list">
                {paginatedClasses.map((item) => (
                  <div className="upcoming-item" key={item.ID}>
                    <div className="upcoming-top">
                      <div className="upcoming-title-row">
                        <h3>{item.TOPIC}</h3>
                        <button
                          type="button"
                          className="edit-schedule-btn"
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit Class Schedule"
                        >
                          <Edit3 size={15} />
                        </button>
                      </div>

                      <div className="upcoming-meta">
                        <span className="batch-pill">{item.BATCH_CODE}</span>
                        <span className="class-day">
                          {formatClassDay(item.CLASS_DATE)}
                        </span>
                        <span className="class-time">
                          {formatClassTime(item.CLASS_TIME)}
                        </span>
                      </div>
                    </div>

                    <div className="link-box">
                      <div className="link-left">
                        <Link size={15} />
                        <span>{item.MEET_LINK}</span>
                      </div>

                      <button
                        className="copy-btn"
                        onClick={() => handleCopy(item.MEET_LINK)}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pagination-bar">
                <div className="pagination-info">
                  Showing {currentPage} of {totalPages || 1}
                </div>
                <div className="pagination-actions">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* EDIT MODAL */}
      {editingClass && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-content">
            <div className="edit-modal-header">
              <div className="edit-modal-title-box">
                <Edit3 size={18} color="#00f0ff" />
                <h3>Edit Scheduled Class</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseEditModal}
              >
                <X size={18} />
              </button>
            </div>

            <div className="edit-modal-body">
              <div className="classschedule-field">
                <label>BATCH</label>
                <Select
                  options={batchOptions}
                  value={editBatch}
                  onChange={(option) => setEditBatch(option)}
                  placeholder="Select Batch..."
                  styles={selectStyles}
                  isSearchable={true}
                  noOptionsMessage={() => "No assigned batches found"}
                />
              </div>

              <div className="classschedule-field">
                <label>TOPIC / TITLE</label>
                <input
                  type="text"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Class Topic"
                />
              </div>

              <div className="date-time-row">
                {/* DATE */}
                <div className="classschedule-field">
                  <label>DATE</label>
                  <div className="picker-wrapper">
                    <DatePicker
                      selected={editDate}
                      onChange={(date) => setEditDate(date)}
                      dateFormat="dd-MM-yyyy"
                      placeholderText="dd-mm-yyyy"
                      className="datetime-picker-input"
                      minDate={tomorrow}
                      portalId="root"
                    />
                    <CalendarDays size={18} className="picker-icon" />
                  </div>
                </div>

                {/* TIME */}
                <div className="classschedule-field">
                  <label>TIME</label>
                  <div className="picker-wrapper">
                    <DatePicker
                      selected={editTime}
                      onChange={(time) => setEditTime(time)}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="hh:mm aa"
                      placeholderText="--:-- --"
                      className="datetime-picker-input"
                      portalId="root"
                    />
                    <Clock size={18} className="picker-icon" />
                  </div>
                </div>
              </div>
            </div>

            <div className="edit-modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={handleCloseEditModal}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-save-btn"
                onClick={handleSaveEdit}
                disabled={
                  editLoading ||
                  !editBatch ||
                  !editTopic.trim() ||
                  !editDate ||
                  !editTime
                }
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassScheduling;
