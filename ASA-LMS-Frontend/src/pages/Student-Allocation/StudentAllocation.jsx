import React, { useEffect, useState, useRef } from "react";
import "./StudentAllocation.css";
import { UserCheck, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Select, { components } from "react-select";
import { studentAllocationApi } from "../../services/apiService";

// =====================================================
// GRADE OPTIONS - MUST BE OUTSIDE COMPONENT
// =====================================================
const gradeOptions = [
  { value: "ALL", label: "All" },
  { value: 6, label: "Grade 6" },
  { value: 7, label: "Grade 7" },
  { value: 8, label: "Grade 8" },
  { value: 9, label: "Grade 9" },
  { value: 10, label: "Grade 10" },
  { value: 11, label: "Grade 11" },
  { value: 12, label: "Grade 12" },
];

// Custom Option component with checkbox
const GradeOption = (props) => {
  const isChecked = props.isSelected;
  return (
    <div
      {...props.innerProps}
      className={`bc-grade-option ${props.isFocused ? "bc-grade-option--is-focused" : ""} ${props.isSelected ? "bc-grade-option--is-selected" : ""}`}
    >
      <input
        type="checkbox"
        className="bc-grade-checkbox"
        checked={isChecked}
        onChange={() => {}} // React-select handles the click on parent div
      />
      <span className="bc-grade-option-label">{props.label}</span>
    </div>
  );
};

// Custom component to render selected grades as clean text: e.g. "Grade 6, Grade 8, Grade 10"
const GradeValueContainer = ({ children, getValue, ...props }) => {
  const selectedValues = getValue();
  const hasValue = selectedValues && selectedValues.length > 0;
  const isAll = selectedValues && selectedValues.some((v) => v.value === "ALL");
  const displayLabel = isAll
    ? "All"
    : selectedValues && selectedValues.length > 0
    ? selectedValues.map((v) => v.label).join(", ")
    : "";

  return (
    <components.ValueContainer {...props}>
      {hasValue && displayLabel && (
        <span className="react-select__single-value">{displayLabel}</span>
      )}
      {React.Children.map(children, (child) => {
        // Suppress individual MultiValue tag elements so only displayLabel is rendered
        if (child && child.type && child.type.name === "MultiValue") {
          return null;
        }
        return child;
      })}
    </components.ValueContainer>
  );
};

const StudentAllocations = () => {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedCapacityBatch, setSelectedCapacityBatch] = useState(null);

  // Filters
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState([gradeOptions[0]]);

  const [filteredStudents, setFilteredStudents] = useState([]);

  const isFetched = useRef(false);

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // =====================================================
  // READ CURRENT USER & INITIAL LOAD
  // =====================================================

  useEffect(() => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (storedUser) {
        const parsed =
          typeof storedUser === "string" ? JSON.parse(storedUser) : storedUser;
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.error("Error reading user data in StudentAllocations:", e);
    }
  }, []);

  const userType = String(
    currentUser?.USER_TYPE || currentUser?.ROLE || ""
  ).toUpperCase();
  const isAdmin = userType === "ADMIN";
  const isStudent = userType === "STUDENT";
  const isTutor = !isAdmin && !isStudent && (userType === "TUTOR" || !!currentUser);
  const currentUserId = currentUser?.USER_ID || currentUser?.id;

  useEffect(() => {
    if (currentUser !== null && !isFetched.current) {
      isFetched.current = true;

      fetchStudents();
      fetchBatches();
    }
  }, [currentUser]);

  // =====================================================
  // FETCH STUDENTS
  // =====================================================

  const fetchStudents = async () => {
    try {
      setLoading(true);

      const res = await studentAllocationApi.getStudents();

      if (res?.data?.status === 1) {
        const studentList = res.data.data || [];

        setStudents(studentList);

        // Prepare unique school options
        prepareSchoolOptions(studentList);

        // Initially show all students
        setFilteredStudents(studentList);
      } else {
        setStudents([]);
        setFilteredStudents([]);

        toast.error(res?.data?.message || "Failed to fetch students");
      }
    } catch (err) {
      console.error("Fetch students error:", err);

      setStudents([]);
      setFilteredStudents([]);

      toast.error(err?.response?.data?.message || "Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FETCH BATCHES (HOST ONLY FOR TUTORS)
  // =====================================================

  const fetchBatches = async () => {
    try {
      const params = {};
      if (isTutor && currentUserId) {
        // Tutors only see and allocate to batches where they are HOST
        params.tutorId = currentUserId;
      }

      const res = await studentAllocationApi.getBatches(params);

      if (res?.data?.status === 1) {
        setBatches(res.data.data || []);
      } else {
        setBatches([]);

        toast.error(res?.data?.message || "Failed to fetch batches");
      }
    } catch (err) {
      console.error("Fetch batches error:", err);

      setBatches([]);

      toast.error(err?.response?.data?.message || "Failed to fetch batches");
    }
  };

  // =====================================================
  // UNIQUE SCHOOL OPTIONS
  // =====================================================

  const prepareSchoolOptions = (studentList) => {
    const uniqueSchools = [
      ...new Set(
        studentList
          .map((student) => student.SCHOOL_NAME)
          .filter((school) => school && String(school).trim() !== "")
          .map((school) => String(school).trim()),
      ),
    ];

    const options = uniqueSchools
      .sort((a, b) => a.localeCompare(b))
      .map((school) => ({
        value: school,
        label: school,
      }));

    setSchoolOptions(options);
  };

  // =====================================================
  // STUDENT SELECT
  // =====================================================

  const handleStudentSelect = (studentId) => {
    setSelectedStudents((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      }

      return [...prev, studentId];
    });
  };

  const handleCapacityBatchSelect = (batchId) => {
    setSelectedCapacityBatch((prev) => {
      // Click same batch again → clear selection
      if (String(prev) === String(batchId)) {
        return null;
      }

      // Select new batch
      return batchId;
    });

    // Clear student selection when changing capacity batch
    setSelectedStudents([]);
  };

  const displayedStudents = selectedCapacityBatch
    ? students
        .filter(
          (student) =>
            Number(student.BATCH_ID) === Number(selectedCapacityBatch),
        )
        .sort((a, b) =>
          String(a.USERNAME || "").localeCompare(
            String(b.USERNAME || ""),
            undefined,
            { sensitivity: "base" },
          ),
        )
    : filteredStudents;

  const selectableStudents = displayedStudents.filter(
    (student) => student.ALLOCATION_STATUS !== "Assigned",
  );

  const allStudentsSelected =
    selectableStudents.length > 0 &&
    selectableStudents.every((student) =>
      selectedStudents.includes(student.USER_ID),
    );

  const handleSelectAllStudents = () => {
    if (allStudentsSelected) {
      // Deselect all displayed students
      setSelectedStudents((prev) =>
        prev.filter(
          (id) => !selectableStudents.some((student) => student.USER_ID === id),
        ),
      );
    } else {
      // Select all displayed unassigned students
      setSelectedStudents((prev) => {
        const existingIds = new Set(prev);

        selectableStudents.forEach((student) => {
          existingIds.add(student.USER_ID);
        });

        return Array.from(existingIds);
      });
    }
  };

  // =====================================================
  // GRADE CHANGE (MULTI-SELECT WITH "ALL" LOGIC)
  // =====================================================

  const handleGradeChange = (selected) => {
    if (!selected || selected.length === 0) {
      setSelectedGrade([]);
      return;
    }

    const hadAll = selectedGrade.some((item) => item.value === "ALL");
    const hasAll = selected.some((item) => item.value === "ALL");

    if (hasAll && !hadAll) {
      // User just checked "All" -> clear individual grades and set only "All"
      setSelectedGrade([gradeOptions[0]]);
    } else if (hasAll && hadAll && selected.length > 1) {
      // User already had "All" and checked a specific grade -> remove "All"
      setSelectedGrade(selected.filter((item) => item.value !== "ALL"));
    } else if (!hasAll && hadAll) {
      // User unchecked "All" -> clear selection completely
      setSelectedGrade([]);
    } else {
      // Check if all individual numeric grades are selected
      const individualOptions = gradeOptions.filter((opt) => opt.value !== "ALL");
      const selectedIndividuals = selected.filter((item) => item.value !== "ALL");

      if (selectedIndividuals.length === individualOptions.length) {
        setSelectedGrade([gradeOptions[0]]);
      } else {
        setSelectedGrade(selectedIndividuals);
      }
    }
  };

  // =====================================================
  // SHOW RESULTS
  // =====================================================

  const handleShowResults = () => {
    let result = [...students];

    // =====================================================
    // FILTER BY SCHOOL
    // =====================================================

    if (selectedSchool?.value) {
      result = result.filter(
        (student) =>
          String(student.SCHOOL_NAME || "")
            .trim()
            .toLowerCase() ===
          String(selectedSchool.value).trim().toLowerCase(),
      );
    }

    // =====================================================
    // FILTER BY GRADE (SINGLE OR MULTIPLE GRADES OR ALL)
    // =====================================================

    const isAllGrades =
      !selectedGrade ||
      selectedGrade.length === 0 ||
      selectedGrade.some((g) => g.value === "ALL" || g.value === "");

    if (!isAllGrades) {
      const selectedGradeValues = selectedGrade.map((g) => Number(g.value));
      result = result.filter(
        (student) =>
          student.GRADE !== null &&
          student.GRADE !== undefined &&
          selectedGradeValues.includes(Number(student.GRADE)),
      );
    }

    // =====================================================
    // SORTING - LOGICAL GRADE THEN NAME
    // =====================================================

    result.sort((a, b) => {
      const gradeA = a.GRADE != null ? Number(a.GRADE) : 999;
      const gradeB = b.GRADE != null ? Number(b.GRADE) : 999;
      if (gradeA !== gradeB) {
        return gradeA - gradeB;
      }
      return String(a.USERNAME || "").localeCompare(
        String(b.USERNAME || ""),
        undefined,
        { sensitivity: "base" },
      );
    });

    // =====================================================
    // APPLY SCHOOL / GRADE FILTER
    // =====================================================

    setFilteredStudents(result);

    // =====================================================
    // CLEAR BATCH SELECTION
    // =====================================================

    setSelectedCapacityBatch(null);

    // Clear selected students
    setSelectedStudents([]);
  };

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  const handleClearFilters = () => {
    setSelectedSchool(null);

    setSelectedGrade([gradeOptions[0]]);

    // Clear selected batch
    setSelectedCapacityBatch(null);

    setSelectedBatch("");

    // Show all students
    setFilteredStudents(students);

    // Clear selected students
    setSelectedStudents([]);
  };

  // =====================================================
  // ASSIGN STUDENTS
  // =====================================================

  const handleAssign = async () => {
    if (selectedStudents.length === 0) {
      toast.warning("Please select at least one student");
      return;
    }

    if (!selectedBatch) {
      toast.warning("Please select a batch");
      return;
    }

    const batch = batches.find((b) => String(b.ID) === String(selectedBatch));

    if (!batch) {
      toast.error("Invalid batch selected");
      return;
    }

    const currentCount = Number(batch.CURRENT_COUNT || 0);

    if (currentCount + selectedStudents.length > 50) {
      toast.error(
        `Only ${50 - currentCount} student(s) can be added to ${
          batch.BATCH_CODE
        }`,
      );
      return;
    }

    const confirmResult = await Swal.fire({
      title: "Confirm Allocation",

      text: `Are you sure you want to assign ${
        selectedStudents.length
      } selected student(s) to batch "${
        batch.BATCH_CODE
      }"?`,

      icon: "warning",

      showCancelButton: true,

      confirmButtonColor: "#00aeffff",

      cancelButtonColor: "#64748b",

      confirmButtonText: "Yes, Assign!",

      cancelButtonText: "Cancel",

      background: "#0f172a",

      color: "#e2e8f0",
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      setAssigning(true);

      const res = await studentAllocationApi.assignStudents({
        studentIds: selectedStudents,
        batchId: Number(selectedBatch),
        createdBy: currentUser?.USERNAME || "Admin",
        tutorId: isTutor ? currentUserId : undefined,
        userType: userType || undefined,
      });

      if (res?.data?.status === 1) {
        toast.success(res.data.message);

        setSelectedStudents([]);
        setSelectedBatch("");

        await fetchStudents();
        await fetchBatches();
      } else {
        toast.error(res?.data?.message || "Failed to assign students");
      }
    } catch (err) {
      console.error("Assign students error:", err);

      toast.error(err?.response?.data?.message || "Failed to assign students");
    } finally {
      setAssigning(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="bc-container">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="bc-header-section">
        <div className="bc-breadcrumb">OPERATIONS</div>

        <div className="bc-title-row">
          <div className="bc-title-left">
            <h1 className="bc-title">Student Allocations</h1>

            <p className="bc-subtitle">Assign enrolled students to batches.</p>
          </div>

          <button
            className="bc-btn-commit"
            onClick={handleAssign}
            disabled={assigning || selectedStudents.length === 0}
          >
            <UserCheck size={16} />

            {assigning ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>

      <div className="bc-main-content">
        {/* =================================================
    FILTER CARD
================================================= */}

        <div className="bc-filter-row">
          {/* SCHOOL */}

          <div className="bc-filter-group bc-school-filter-group">
            <label className="bc-filter-label">School</label>

            <Select
              value={selectedSchool}
              options={schoolOptions}
              onChange={setSelectedSchool}
              placeholder="All Schools"
              isClearable
              isSearchable
              className="bc-react-select"
              classNamePrefix="react-select"
            />
          </div>

          {/* GRADE */}

          <div className="bc-filter-group bc-grade-filter-group">
            <label className="bc-filter-label">Grade</label>

            <Select
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              value={selectedGrade}
              options={gradeOptions}
              onChange={handleGradeChange}
              placeholder="Select Grade"
              isSearchable={false}
              className="bc-react-select"
              classNamePrefix="react-select"
              components={{
                ValueContainer: GradeValueContainer,
                Option: GradeOption,
              }}
            />
          </div>

          {/* PROCEED */}

          <div className="bc-filter-buttons">
            <button
              type="button"
              className="bc-btn-show-results"
              onClick={handleShowResults}
            >
              Proceed
            </button>
          </div>
        </div>
        {/* =================================================
            ENROLLMENT QUEUE
        ================================================= */}

        <div className="bc-panel bc-enrollment-queue">
          <div className="bc-panel-header">
            {/* LEFT - ENROLLMENT QUEUE */}
            <div className="bc-enrollment-header-left">
              <h2 className="bc-panel-title">Enrollment queue</h2>

              <div className="bc-result-count-row">
                <label className="bc-select-all-wrapper">
                  <input
                    type="checkbox"
                    className="bc-select-all-checkbox"
                    checked={allStudentsSelected}
                    onChange={handleSelectAllStudents}
                    disabled={selectableStudents.length === 0}
                  />
                </label>

                <p className="bc-result-count">
                  {displayedStudents.length} student(s) found
                </p>
              </div>
            </div>

            {/* RIGHT - PICK BATCH */}
            <div className="bc-pick-batch">
              <Select
                value={
                  batches
                    .filter(
                      (batch) => String(batch.ID) === String(selectedBatch),
                    )
                    .map((batch) => ({
                      value: batch.ID,
                      label: batch.BATCH_CODE,
                    }))[0] || null
                }
                options={batches.map((batch) => ({
                   value: batch.ID,
                   label: batch.BATCH_CODE,
                }))}
                onChange={(selected) =>
                  setSelectedBatch(selected ? selected.value : "")
                }
                placeholder="Pick Batch"
                isClearable
                isSearchable
                className="bc-react-select"
                classNamePrefix="react-select"
              />
            </div>
          </div>

          {/* =================================================
              STUDENTS
          ================================================= */}

          <div className="bc-queue-list">
            {loading ? (
              <div className="bc-empty">Loading students...</div>
            ) : displayedStudents.length === 0 ? (
              <div className="bc-empty">
                {selectedCapacityBatch
                  ? "No students assigned to this batch."
                  : "No students found for the selected filters."}
              </div>
            ) : (
              displayedStudents.map((student) => (
                <div className="bc-queue-row" key={student.USER_ID}>
                  {/* CHECKBOX */}

                  {student.ALLOCATION_STATUS !== "Assigned" ? (
                    <input
                      type="checkbox"
                      className="bc-student-checkbox"
                      checked={selectedStudents.includes(student.USER_ID)}
                      onChange={() => handleStudentSelect(student.USER_ID)}
                    />
                  ) : (
                    <div className="bc-student-checkbox-placeholder" />
                  )}

                  {/* STUDENT CARD */}

                  <div className="bc-queue-item">
                    <div className="bc-student-content">
                      <h4 className="bc-student-name">{student.USERNAME}</h4>

                      <span className="bc-student-details">
                        {student.EMAIL_ID}
                      </span>

                      {/* SCHOOL + GRADE */}

                      <div className="bc-student-meta">
                        {student.SCHOOL_NAME && (
                          <span className="bc-student-school">
                            {student.SCHOOL_NAME}
                          </span>
                        )}

                        {student.GRADE && (
                          <span className="bc-student-grade">
                            Grade {student.GRADE}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* STATUS */}

                    {student.ALLOCATION_STATUS && (
                      <div className="bc-action-cell">
                        <span
                          className={`bc-badge-assigned ${
                            student.ALLOCATION_STATUS === "Assigned"
                              ? "assigned"
                              : "not-assigned"
                          }`}
                        >
                          {student.ALLOCATION_STATUS}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =================================================
    CAPACITY PREVIEW
================================================= */}

        {/* =================================================
    CAPACITY PREVIEW
================================================= */}

        <div className="bc-panel bc-capacity-preview">
          {/* HEADER */}

          <div className="bc-capacity-header">
            <div className="bc-capacity-title-wrapper">
              <div>
                <h2 className="bc-panel-title">Capacity preview</h2>

                <p className="bc-capacity-subtitle">
                  {selectedCapacityBatch
                    ? "Showing students assigned to selected batch"
                    : "Select a batch to view its students"}
                </p>

                {/* TOP TICK - SHOW ONLY WHEN NO BATCH IS SELECTED */}
                {selectedCapacityBatch === null && (
                  <div className="bc-capacity-top-checkbox">
                    <span className="bc-capacity-top-tick">✓</span>
                    <span className="bc-capacity-top-text">ALL</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CAPACITY LIST */}

          <div className="bc-capacity-list">
            {batches.map((batch) => {
              const currentCount = Number(batch.CURRENT_COUNT || 0);

              const percent = Math.min(
                Math.round((currentCount / 50) * 100),
                100,
              );

              const isSelected =
                String(selectedCapacityBatch) === String(batch.ID);

              return (
                <div
                  key={batch.ID}
                  className={`bc-capacity-item ${
                    isSelected ? "bc-capacity-item-selected" : ""
                  }`}
                  onClick={() => handleCapacityBatchSelect(batch.ID)}
                >
                  {/* CONTENT */}

                  <div className="bc-capacity-content">
                    <div className="bc-capacity-labels">
                      {/* BATCH CODE + TICK */}
                      <span className="bc-batch-code">
                        {isSelected && (
                          <span className="bc-capacity-tick">✓</span>
                        )}

                        {batch.BATCH_CODE}
                      </span>

                      <span className="bc-count-text">{currentCount}/50</span>
                    </div>

                    <div className="bc-progress-bar-container">
                      <div
                        className="bc-progress-bar"
                        style={{
                          width: `${percent}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAllocations;
