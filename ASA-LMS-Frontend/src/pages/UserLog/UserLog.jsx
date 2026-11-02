import React, { useEffect, useState, useRef } from "react";
import "./UserLog.css";
import { usermananagementApi } from "../../services/apiService";
import { toast } from "react-toastify";
import Select from "react-select";
import { RotateCcw } from "lucide-react";
import { userLogsTableHeading } from "../../services/tableHeading";
import ClientSideTable from "../../components/ClientSideTable/ClientSideTable";
import formatDate from "../../utils/formatDate";

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
    fontSize: "0.85rem",
    fontWeight: 500,
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b",
    fontSize: "0.85rem",
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#00e5ff"
      : state.isFocused
      ? "rgba(0, 229, 255, 0.15)"
      : "#0f172a",
    color: state.isSelected ? "#000000" : "#f8fafc",
    fontSize: "0.85rem",
    cursor: "pointer",
  }),
};

const userTypeOptions = [
  { value: "ALL", label: "All" },
  { value: "STUDENT", label: "Student" },
  { value: "TUTOR", label: "Tutor" },
];

const dateFilterOptions = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "past15days", label: "Past 15 Days" },
  { value: "lastmonth", label: "Last Month" },
  { value: "custom", label: "Custom Date" },
];

const UserLog = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedUserType, setSelectedUserType] = useState(userTypeOptions[0]);
  const [selectedDateFilter, setSelectedDateFilter] = useState(dateFilterOptions[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const isFetched = useRef(false);

  const fetchUserLogs = async (userTypeVal, dateFilterVal, fromVal, toVal) => {
    try {
      setLoading(true);
      const params = {
        userType: userTypeVal !== undefined ? userTypeVal : selectedUserType.value,
        dateFilter: dateFilterVal !== undefined ? dateFilterVal : selectedDateFilter.value,
      };

      const activeDateFilter = dateFilterVal !== undefined ? dateFilterVal : selectedDateFilter.value;
      if (activeDateFilter === "custom") {
        const activeFrom = fromVal !== undefined ? fromVal : fromDate;
        const activeTo = toVal !== undefined ? toVal : toDate;
        if (activeFrom) params.fromDate = activeFrom;
        if (activeTo) params.toDate = activeTo;
      }

      const res = await usermananagementApi.getUserActivityLogs(params);
      if (res?.data?.status === 1) {
        const formattedList = (res?.data?.data || []).map((item) => ({
          ...item,
          LOGIN_DATE: formatDate(item.ACTIVITY_DATE, "date"),
          LOGIN_TIME: formatDate(item.ACTIVITY_DATE, "time"),
        }));
        setLogs(formattedList);
      } else {
        setLogs([]);
        toast.error(res?.data?.message || "Failed to fetch user logs");
      }
    } catch (err) {
      console.error("fetchUserLogs error:", err);
      toast.error(err?.response?.data?.message || "Failed to fetch user logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchUserLogs(userTypeOptions[0].value, dateFilterOptions[0].value);
    }
  }, []);

  const handleUserTypeChange = (selected) => {
    setSelectedUserType(selected);
    fetchUserLogs(selected?.value, selectedDateFilter.value);
  };

  const handleDateFilterChange = (selected) => {
    setSelectedDateFilter(selected);
    if (selected?.value !== "custom") {
      fetchUserLogs(selectedUserType.value, selected?.value);
    }
  };

  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      toast.error("Please select both From Date and To Date");
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      toast.error("From Date cannot be later than To Date");
      return;
    }
    fetchUserLogs(selectedUserType.value, "custom", fromDate, toDate);
  };

  const handleReset = () => {
    setSelectedUserType(userTypeOptions[0]);
    setSelectedDateFilter(dateFilterOptions[0]);
    setFromDate("");
    setToDate("");
    fetchUserLogs(userTypeOptions[0].value, dateFilterOptions[0].value);
  };

  return (
    <div className="bc-container user-log-page-container">
      <div className="bc-header-section">
        <div className="bc-breadcrumb">USER LOG</div>

        <div className="bc-title-row">
          <div className="bc-title-left">
            <h1 className="bc-title">User Log</h1>
            <p className="bc-subtitle">
              Monitor and review the latest login activity of students and tutors.
            </p>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="user-log-filter-card">
        <div className="user-log-filter-group">
          <label className="user-log-filter-label">User Type</label>
          <div className="user-log-select-wrapper">
            <Select
              styles={selectStyles}
              options={userTypeOptions}
              value={selectedUserType}
              onChange={handleUserTypeChange}
              isSearchable={false}
            />
          </div>
        </div>

        <div className="user-log-filter-group">
          <label className="user-log-filter-label">Date</label>
          <div className="user-log-select-wrapper">
            <Select
              styles={selectStyles}
              options={dateFilterOptions}
              value={selectedDateFilter}
              onChange={handleDateFilterChange}
              isSearchable={false}
            />
          </div>
        </div>

        {selectedDateFilter.value === "custom" && (
          <>
            <div className="user-log-filter-group">
              <label className="user-log-filter-label">From Date</label>
              <input
                type="date"
                className="user-log-date-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="user-log-filter-group">
              <label className="user-log-filter-label">To Date</label>
              <input
                type="date"
                className="user-log-date-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="user-log-btn-group">
              <button
                type="button"
                className="btn-primary user-log-apply-btn"
                onClick={handleApplyCustomDate}
              >
                Apply
              </button>
            </div>
          </>
        )}

        <div className="user-log-reset-wrapper">
          <button
            type="button"
            className="user-log-reset-btn"
            onClick={handleReset}
            title="Reset Filters"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <ClientSideTable
        title=""
        columns={userLogsTableHeading}
        data={logs}
        loading={loading}
        actions={false}
        keysToSearch={["USERNAME", "LOGIN_DATE", "LOGIN_TIME"]}
      />
    </div>
  );
};

export default UserLog;
