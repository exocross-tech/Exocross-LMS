import React, { useEffect, useState, useRef } from "react";
import "./Students.css";
import { studentsApi, batchesApi } from "../../services/apiService";
import { Search, Download } from "lucide-react";
import { toast } from "react-toastify";
import Select from "react-select";
import { formatStudentRollNo } from "../../utils/formatRollNo";

const Students = () => {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const isFetched = useRef(false);
  const prevDepsRef = useRef({ page: 1, searchQuery: "", selectedBatch: null });
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolOptions, setSchoolOptions] = useState([
    { value: "", label: "All Schools" },
  ]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // =====================================================
  // FETCH SCHOOLS
  // =====================================================

  const fetchSchools = async () => {
    try {
      const res = await studentsApi.getSchools();
      if (res?.data?.status === 1) {
        const schoolList = res.data.data || [];
        setSchoolOptions([
          { value: "", label: "All Schools" },
          ...schoolList.map((school) => ({
            value: school,
            label: school,
          })),
        ]);
      }
    } catch (err) {
      console.error("Fetch schools error:", err);
    }
  };

  // =====================================================
  // FETCH BATCHES
  // =====================================================

  const fetchBatches = async () => {
    try {
      const res = await batchesApi.getBatches();

      if (res?.data?.status === 1) {
        const activeBatches = (res.data.data || []).filter(
          (batch) => Number(batch.IS_ACTIVE) === 1
        );

        setBatches(activeBatches);
      } else {
        setBatches([]);
        toast.error(res?.data?.message || "Failed to fetch batches");
      }
    } catch (err) {
      console.error("Fetch batches error:", err);

      setBatches([]);

      toast.error(
        err?.response?.data?.message || "Failed to fetch batches"
      );
    }
  };

  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents = async () => {
    try {
      setLoading(true);

      const res = await studentsApi.getStudents({
        page,
        limit: 10,

        // Search only student name
        search: searchQuery.trim(),

        // Send selected batch to backend. Empty string = All Batches
        batchId: selectedBatch?.value || "",

        // Send selected school name to backend. Empty string = All Schools
        schoolName: selectedSchool?.value || "",
      });

      if (res?.data?.status === 1) {
        setStudents(res.data.data || []);

        setTotalPages(
          Number(res.data.pagination?.totalPages || 1)
        );

        setTotalRecords(
          Number(res.data.pagination?.total || 0)
        );
      } else {
        setStudents([]);
        setTotalPages(1);
        setTotalRecords(0);

        toast.error(
          res?.data?.message || "Failed to fetch students"
        );
      }
    } catch (err) {
      console.error("Fetch students error:", err);

      setStudents([]);
      setTotalPages(1);
      setTotalRecords(0);

      toast.error(
        err?.response?.data?.message || "Failed to fetch students"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchSchools();
      fetchBatches();
      fetchStudents();
      return;
    }

    const prev = prevDepsRef.current;
    if (
      prev.page !== page ||
      prev.searchQuery !== searchQuery ||
      prev.selectedBatch !== selectedBatch ||
      prev.selectedSchool !== selectedSchool
    ) {
      prevDepsRef.current = { page, searchQuery, selectedBatch, selectedSchool };
      fetchStudents();
    }
  }, [page, searchQuery, selectedBatch, selectedSchool]);

  const handleSearchChange = (e) => {
    const value = e.target.value;

    setSearchQuery(value);

    // Always go back to first page
    // when search changes.
    setPage(1);
  };

  // =====================================================
  // BATCH CHANGE
  // =====================================================

  const handleBatchChange = (selected) => {
    setSelectedBatch(selected);

    // Always go back to first page
    // when batch changes.
    setPage(1);
  };

  // =====================================================
  // SCHOOL CHANGE
  // =====================================================

  const handleSchoolChange = (selected) => {
    setSelectedSchool(selected);

    // Always go back to first page
    // when school changes.
    setPage(1);
  };

  // =====================================================
  // EXPORT CSV
  // =====================================================

  const handleExportCSV = async () => {
    try {
      const res = await studentsApi.getStudents({
        page: 1,
        limit: 10000,

        search: searchQuery.trim(),

        batchId: selectedBatch?.value || "",
        schoolName: selectedSchool?.value || "",
      });

      if (res?.data?.status !== 1) {
        toast.error(
          res?.data?.message || "Failed to export students"
        );
        return;
      }

      const rows = res.data.data || [];

      if (rows.length === 0) {
        toast.warning("No students available to export");
        return;
      }

      const headers = [
        "Student No",
        "Name",
        "School Name",
        "Email",
        "Phone",
        "Batch",
        "Status",
      ];

      const csvRows = rows.map((student) => {
        const batchCode = student.BATCH_CODE || "Not Assigned";

        return [
          `"${String(formatStudentRollNo(student.ROLL_NO) === "-" ? "" : formatStudentRollNo(student.ROLL_NO)).replace(/"/g, '""')}"`,
          `"${String(student.USERNAME || "").replace(/"/g, '""')}"`,
          `"${String(student.SCHOOL_NAME || "").replace(/"/g, '""')}"`,
          `"${String(student.EMAIL_ID || "").replace(/"/g, '""')}"`,
          `"${student.MOBILE_NO || ""}"`,
          `"${batchCode.replace(/"/g, '""')}"`,
          Number(student.IS_ACTIVE) === 1
            ? "ACTIVE"
            : "INACTIVE",
        ].join(",");
      });

      const csv = [
        headers.join(","),
        ...csvRows,
      ].join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = selectedBatch
        ? `students_${selectedBatch.code}.csv`
        : "all_students.csv";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast.success("Students exported successfully");
    } catch (err) {
      console.error("Export CSV error:", err);

      toast.error("Failed to export CSV");
    }
  };

  // =====================================================
  // BATCH OPTIONS
  // =====================================================

  const batchOptions = [
    {
      value: "",
      code: "",
      label: "All Batches",
    },

    ...batches.map((batch) => ({
      value: batch.ID,
      code: String(batch.BATCH_CODE || ""),
      label: batch.BATCH_CODE || "",
    })),
  ];

  // =====================================================
  // CURRENT RANGE
  // =====================================================

  const startRecord =
    totalRecords === 0
      ? 0
      : (page - 1) * 10 + 1;

  const endRecord =
    Math.min(page * 10, totalRecords);

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="students-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="students-header-section">

        <div className="breadcrumb">
          FULL ACCESS
        </div>

        <div className="students-title-row">

          <div className="title-left">

            <h1 className="welcome-text">
              All Students
            </h1>

            <p className="welcome-subtext">

              {selectedBatch?.value
                ? `${totalRecords} student${totalRecords !== 1 ? "s" : ""
                } in ${selectedBatch.code}`
                : `${totalRecords} enrolled ambassadors across batches.`}

            </p>

          </div>

          <div className="title-actions">

            <button
              className="btn-outline"
              onClick={handleExportCSV}
            >
              <Download size={16} />
              Export CSV
            </button>

          </div>

        </div>

      </div>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="students-toolbar">

        {/* SEARCH */}

        <div className="search-bar">

          <Search
            size={17}
            className="search-icon"
          />

          <input
            type="text"
            placeholder="Search student name..."
            value={searchQuery}
            onChange={handleSearchChange}
          />

        </div>

        {/* BATCH FILTER */}

        <div className="batch-filter">

          <Select
            value={selectedBatch}
            options={batchOptions}
            onChange={handleBatchChange}
            placeholder="All Batches"
            className="batch-select"
            classNamePrefix="react-select"
            isSearchable={true}
            isClearable={false}
            menuPlacement="auto"
            menuPosition="fixed"
          />

        </div>

        {/* SCHOOL NAME FILTER */}

        <div className="batch-filter">

          <Select
            value={selectedSchool}
            options={schoolOptions}
            onChange={handleSchoolChange}
            placeholder="All Schools"
            className="batch-select"
            classNamePrefix="react-select"
            isSearchable={true}
            isClearable={false}
            menuPlacement="auto"
            menuPosition="fixed"
          />

        </div>

        {/* RESULTS */}

        <div className="results-count">

          {totalRecords}{" "}
          {totalRecords === 1
            ? "result"
            : "results"}

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="students-table-container">

        <table className="students-table">

          <thead>

            <tr>
              <th>STUDENT NO</th>
              <th>NAME</th>
              <th>SCHOOL NAME</th>
              <th>BATCH</th>
              <th>STATUS</th>
            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td
                  colSpan="5"
                  className="table-message"
                >
                  Loading students...
                </td>

              </tr>

            ) : students.length === 0 ? (

              <tr>

                <td
                  colSpan="5"
                  className="table-message"
                >
                  {searchQuery || selectedBatch || selectedSchool
                    ? "No students found for the selected filters."
                    : "No students found."}
                </td>

              </tr>

            ) : (

              students.map((student) => (

                <tr key={student.USER_ID}>

                  {/* STUDENT NO */}

                  <td className="col-callsign">
                    {formatStudentRollNo(student.ROLL_NO)}
                  </td>

                  {/* NAME */}

                  <td className="col-name">

                    <span className="student-name">
                      {student.USERNAME}
                    </span>

                  </td>

                  {/* SCHOOL NAME */}

                  <td className="col-school">

                    <span className="student-school">
                      {student.SCHOOL_NAME || "-"}
                    </span>

                  </td>

                  {/* BATCH */}

                  <td className="col-batch">

                    {student.BATCH_CODE ? (

                      <span className="batch-code-pill">

                        {student.BATCH_CODE}

                      </span>

                    ) : (

                      <span className="not-assigned">
                        Not Assigned
                      </span>

                    )}

                  </td>

                  {/* STATUS */}

                  <td className="col-status">

                    <span
                      className={`status-pill ${Number(student.IS_ACTIVE) === 1
                        ? "active"
                        : "inactive"
                        }`}
                    >

                      {Number(student.IS_ACTIVE) === 1
                        ? "ACTIVE"
                        : "INACTIVE"}

                    </span>

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

      {/* =================================================
          PAGINATION
      ================================================= */}

      {totalRecords > 0 && (

        <div className="pagination-bar">

          <div className="pagination-info">

            Showing{" "}
            <strong>{startRecord}</strong>
            {" - "}
            <strong>{endRecord}</strong>
            {" of "}
            <strong>{totalRecords}</strong>

          </div>

          <div className="pagination-actions">

            <button
              disabled={
                loading ||
                page === 1
              }
              onClick={() =>
                setPage((prev) => prev - 1)
              }
            >
              Previous
            </button>

            <span className="page-number">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={
                loading ||
                page >= totalPages
              }
              onClick={() =>
                setPage((prev) => prev + 1)
              }
            >
              Next
            </button>

          </div>

        </div>

      )}

    </div>
  );
};

export default Students;