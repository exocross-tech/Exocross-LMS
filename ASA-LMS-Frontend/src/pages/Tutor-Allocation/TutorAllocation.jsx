import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./TutorAllocation.css";
import { UserCheck } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Select from "react-select";
import { tutorAllocationApi } from "../../services/apiService";

const TutorAllocations = () => {
  const HOST_ROLE = 1;
  const SUPPORT_ROLE = 2;
  const [tutors, setTutors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedTutors, setSelectedTutors] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const isFetched = useRef(false);

  useEffect(() => {
    if (isFetched.current) {
      return;
    }
    isFetched.current = true;
    fetchTutors();
    fetchBatches();
  }, []);

  const normalizeTutors = (tutorData) => {
    if (!Array.isArray(tutorData)) {
      return [];
    }

    return tutorData.map((tutor) => ({
      ...tutor,

      USER_ID: Number(
        tutor.USER_ID
      ),

      assignedBatches:
        Array.isArray(
          tutor.assignedBatches
        )
          ? tutor.assignedBatches.map(
            (batch) => ({
              ...batch,

              ID: Number(
                batch.ID
              ),

              ALLOCATION_ID:
                batch.ALLOCATION_ID
                  ? Number(
                    batch.ALLOCATION_ID
                  )
                  : null,

              ROLE: Number(
                batch.ROLE
              ),
            })
          )
          : [],
    }));
  };


  const fetchTutors = async () => {
    try {
      setLoading(true);
      const res = await tutorAllocationApi.getTutorAllocation({ status: "ACTIVE" });
      if (res?.data?.status !== 1 || !Array.isArray(res?.data?.data)) {
        setTutors([]);
        setSelectedTutors([]);

        toast.error(
          res?.data?.message ||
          "Failed to fetch tutors"
        );

        return [];
      }
      const normalizedTutors = normalizeTutors(res.data.data);
      setTutors(normalizedTutors);


      setSelectedTutors([]);

      return normalizedTutors;
    } catch (err) {
      console.error(
        "Fetch tutors error:",
        err
      );

      setTutors([]);
      setSelectedTutors([]);

      toast.error(
        err?.response?.data?.message ||
        "Failed to fetch tutors"
      );

      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const res =
        await tutorAllocationApi.getActiveBatches();

      console.log(
        "Active batches API:",
        res?.data
      );

      if (
        res?.data?.status === 1 &&
        Array.isArray(
          res?.data?.data
        )
      ) {
        setBatches(
          res.data.data
        );
      } else {
        setBatches([]);

        toast.error(
          res?.data?.message ||
          "Failed to fetch batches"
        );
      }
    } catch (err) {
      console.error(
        "Fetch batches error:",
        err
      );

      setBatches([]);

      toast.error(
        err?.response?.data?.message ||
        "Failed to fetch batches"
      );
    }
  };

  // =====================================================
  // GET TUTOR BY ID
  // =====================================================

  const getTutorById = (
    tutorId
  ) => {
    return tutors.find(
      (tutor) =>
        Number(
          tutor.USER_ID
        ) ===
        Number(tutorId)
    );
  };

  // =====================================================
  // GET ASSIGNMENT FOR CURRENT BATCH
  // =====================================================

  const getTutorAssignment = (
    tutorId,
    batchId = selectedBatch
  ) => {
    /*
     * No batch selected means there is no
     * batch-specific assignment to check.
     */
    if (!batchId) {
      return null;
    }

    const tutor =
      getTutorById(
        tutorId
      );

    if (!tutor) {
      return null;
    }

    const assignedBatches =
      Array.isArray(
        tutor.assignedBatches
      )
        ? tutor.assignedBatches
        : [];

    return (
      assignedBatches.find(
        (batch) =>
          Number(
            batch.ID
          ) ===
          Number(batchId)
      ) || null
    );
  };

  // =====================================================
  // CHECK WHETHER TUTOR IS ASSIGNED TO ANY BATCH
  // =====================================================

  const hasAnyAssignment = (
    tutor
  ) => {
    if (!tutor) {
      return false;
    }

    return (
      Array.isArray(
        tutor.assignedBatches
      ) &&
      tutor.assignedBatches.length >
      0
    );
  };

  // =====================================================
  // LOAD ASSIGNED TUTORS FOR SELECTED BATCH
  // =====================================================

  const loadBatchAssignments = (
    batchId,
    tutorList = tutors
  ) => {
    /*
     * If batch is cleared,
     * nobody remains selected.
     */
    if (!batchId) {
      setSelectedTutors([]);
      return;
    }

    /*
     * Only tutors assigned to THIS batch
     * are automatically selected.
     */
    const assignedTutors =
      tutorList
        .map((tutor) => {
          const assignment =
            Array.isArray(
              tutor.assignedBatches
            )
              ? tutor.assignedBatches.find(
                (batch) =>
                  Number(
                    batch.ID
                  ) ===
                  Number(batchId)
              )
              : null;

          if (!assignment) {
            return null;
          }

          return {
            tutorId: Number(
              tutor.USER_ID
            ),

            role:
              Number(
                assignment.ROLE
              ) === HOST_ROLE
                ? HOST_ROLE
                : SUPPORT_ROLE,
          };
        })
        .filter(Boolean);

    console.log(
      "Selected batch:",
      batchId
    );

    console.log(
      "Already assigned tutors:",
      assignedTutors
    );

    setSelectedTutors(
      assignedTutors
    );
  };

  // =====================================================
  // BATCH CHANGE
  // =====================================================

  const handleBatchChange = (
    selected
  ) => {
    const batchId =
      selected?.value || "";

    console.log(
      "Batch selected:",
      batchId
    );

    setSelectedBatch(
      batchId
    );

    /*
     * When a batch is selected:
     * automatically select only tutors
     * assigned to that batch.
     */
    loadBatchAssignments(
      batchId,
      tutors
    );
  };

  // =====================================================
  // TUTOR CHECKBOX
  // =====================================================

  const handleTutorSelect = (
    tutorId
  ) => {
    /*
     * Batch is mandatory.
     */
    if (!selectedBatch) {
      toast.warning(
        "Please select a batch first"
      );

      return;
    }

    setSelectedTutors(
      (prev) => {
        const exists =
          prev.some(
            (item) =>
              Number(
                item.tutorId
              ) ===
              Number(tutorId)
          );

        // =================================================
        // UNSELECT
        // =================================================

        if (exists) {
          return prev.filter(
            (item) =>
              Number(
                item.tutorId
              ) !==
              Number(tutorId)
          );
        }

        // =================================================
        // SELECT
        // =================================================

        /*
         * Preserve existing role if already
         * assigned to this batch.
         *
         * New tutors default to SUPPORT.
         */
        const assignment =
          getTutorAssignment(
            tutorId,
            selectedBatch
          );

        const role =
          Number(
            assignment?.ROLE
          ) === HOST_ROLE
            ? HOST_ROLE
            : SUPPORT_ROLE;

        return [
          ...prev,

          {
            tutorId: Number(
              tutorId
            ),

            role,
          },
        ];
      }
    );
  };

  // =====================================================
  // ROLE TOGGLE
  //
  // HOST -> SUPPORT
  // SUPPORT -> HOST
  // =====================================================

  const handleRoleToggle = async (tutorId) => {
    if (!selectedBatch) {
      toast.warning("Please select a batch first");
      return;
    }

    const current = selectedTutors.find(
      (item) =>
        Number(item.tutorId) === Number(tutorId)
    );

    if (!current) {
      return;
    }

    const currentRole =
      Number(current.role) === HOST_ROLE
        ? HOST_ROLE
        : SUPPORT_ROLE;

    const newRole =
      currentRole === HOST_ROLE
        ? SUPPORT_ROLE
        : HOST_ROLE;

    // =================================================
    // ONLY ONE HOST PER BATCH
    // =================================================

    if (newRole === HOST_ROLE) {
      const existingHost = selectedTutors.find(
        (item) =>
          Number(item.tutorId) !== Number(tutorId) &&
          Number(item.role) === HOST_ROLE
      );

      if (existingHost) {
        const existingHostTutor =
          getTutorById(existingHost.tutorId);

        const existingHostName =
          existingHostTutor?.USERNAME ||
          existingHostTutor?.NAME ||
          "another tutor";

        toast.warning(
          `${existingHostName} is already HOST for this batch.`
        );

        return;
      }
    }

    const tutor = getTutorById(tutorId);

    const tutorName =
      tutor?.USERNAME ||
      tutor?.NAME ||
      "Tutor";

    // =================================================
    // EXISTING ASSIGNMENT
    // =================================================

    const existingAssignment =
      getTutorAssignment(
        tutorId,
        selectedBatch
      );

    // =================================================
    // NOT YET ASSIGNED
    // =================================================

    if (!existingAssignment) {
      setSelectedTutors((prev) =>
        prev.map((item) =>
          Number(item.tutorId) === Number(tutorId)
            ? {
              ...item,
              role: newRole,
            }
            : item
        )
      );

      return;
    }

    // =================================================
    // UPDATE EXISTING ASSIGNMENT
    // =================================================

    try {
      setAssigning(true);

      const res =
        await tutorAllocationApi.updateTutorRole({
          batchId: Number(selectedBatch),
          tutorId: Number(tutorId),
          role: newRole,
        });

      console.log(
        "Update tutor role response:",
        res?.data
      );

      if (res?.data?.status !== 1) {
        toast.error(
          res?.data?.message ||
          "Failed to update tutor role"
        );

        return;
      }

      // =================================================
      // UPDATE UI
      // =================================================

      setSelectedTutors((prev) =>
        prev.map((item) =>
          Number(item.tutorId) === Number(tutorId)
            ? {
              ...item,
              role: newRole,
            }
            : item
        )
      );

      // =================================================
      // UPDATE LOCAL TUTOR DATA
      // =================================================

      setTutors((prev) =>
        prev.map((item) => {
          if (
            Number(item.USER_ID) !==
            Number(tutorId)
          ) {
            return item;
          }

          const existingBatches =
            Array.isArray(item.assignedBatches)
              ? item.assignedBatches
              : [];

          return {
            ...item,

            assignedBatches:
              existingBatches.map((batch) =>
                Number(batch.ID) ===
                  Number(selectedBatch)
                  ? {
                    ...batch,
                    ROLE: newRole,
                  }
                  : batch
              ),
          };
        })
      );

      toast.success(
        `${tutorName} changed to ${newRole === HOST_ROLE
          ? "Host"
          : "Support"
        }`
      );

    } catch (err) {
      console.error(
        "Update tutor role error:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
        "Failed to update tutor role"
      );
    } finally {
      setAssigning(false);
    }
  };

  // =====================================================
  // BATCH OPTIONS
  // =====================================================

  const batchOptions =
    useMemo(() => {
      return batches.map(
        (batch) => ({
          value: Number(
            batch.ID
          ),

          label:
            batch.BATCH_CODE || "",
        })
      );
    }, [batches]);

  // =====================================================
  // SELECTED BATCH OPTION
  // =====================================================

  const selectedBatchOption =
    batchOptions.find(
      (option) =>
        Number(
          option.value
        ) ===
        Number(
          selectedBatch
        )
    ) || null;

  // =====================================================
  // SORT TUTORS
  // =====================================================

  const displayedTutors =
    useMemo(() => {
      return [...tutors].sort(
        (a, b) =>
          String(
            a.USERNAME ||
            a.NAME ||
            ""
          ).localeCompare(
            String(
              b.USERNAME ||
              b.NAME ||
              ""
            ),
            undefined,
            {
              sensitivity:
                "base",
            }
          )
      );
    }, [tutors]);

  // =====================================================
  // SELECT ALL STATUS
  // =====================================================

  const allTutorsSelected =
    Boolean(selectedBatch) &&
    displayedTutors.length > 0 &&
    displayedTutors.every(
      (tutor) =>
        selectedTutors.some(
          (selected) =>
            Number(
              selected.tutorId
            ) ===
            Number(
              tutor.USER_ID
            )
        )
    );

  // =====================================================
  // SELECT / UNSELECT ALL
  // =====================================================

  const handleSelectAllTutors = () => {
    /*
     * Batch is mandatory.
     */
    if (!selectedBatch) {
      toast.warning(
        "Please select a batch first"
      );

      return;
    }

    // =================================================
    // UNSELECT ALL
    // =================================================

    if (allTutorsSelected) {
      setSelectedTutors([]);

      return;
    }

    // =================================================
    // SELECT ALL
    // =================================================

    const allSelectedTutors =
      displayedTutors.map(
        (tutor) => {
          const tutorId =
            Number(
              tutor.USER_ID
            );

          const assignment =
            getTutorAssignment(
              tutorId,
              selectedBatch
            );

          /*
           * Preserve existing role.
           */
          if (assignment) {
            return {
              tutorId,

              role:
                Number(
                  assignment.ROLE
                ) === HOST_ROLE
                  ? HOST_ROLE
                  : SUPPORT_ROLE,
            };
          }

          /*
           * New tutor defaults
           * to SUPPORT.
           */
          return {
            tutorId,
            role: SUPPORT_ROLE,
          };
        }
      );

    setSelectedTutors(
      allSelectedTutors
    );
  };

  // =====================================================
  // ASSIGN TUTORS
  // =====================================================

  const handleAssign = async () => {
    // =================================================
    // VALIDATION
    // =================================================

    if (!selectedBatch) {
      toast.warning(
        "Please select a batch first"
      );

      return;
    }

    if (
      selectedTutors.length ===
      0
    ) {
      toast.warning(
        "Please select at least one tutor"
      );

      return;
    }

    const batch =
      batches.find(
        (item) =>
          Number(
            item.ID
          ) ===
          Number(
            selectedBatch
          )
      );

    if (!batch) {
      toast.error(
        "Invalid batch selected"
      );

      return;
    }

    // =================================================
    // FIND HOST & VALIDATE
    // =================================================

    const host =
      selectedTutors.find(
        (item) =>
          Number(
            item.role
          ) === HOST_ROLE
      );

    if (!host) {
      toast.warning(
        "Please select one tutor as Host"
      );

      return;
    }

    const hostTutor = getTutorById(host.tutorId);

    const hostName =
      hostTutor?.USERNAME ||
      hostTutor?.NAME ||
      "No Host";

    // =================================================
    // CONFIRMATION ROWS
    // =================================================

    const tutorRows = selectedTutors
      .map((item) => {
        const tutor = getTutorById(item.tutorId);
        const isHost = Number(item.role) === HOST_ROLE;
        const name = tutor?.USERNAME || tutor?.NAME || "Unknown Tutor";
        const email = tutor?.EMAIL || tutor?.USER_EMAIL || "";
        const initial = name.charAt(0).toUpperCase();

        return `
          <div class="ta-confirm-tutor-card ${isHost ? "is-host-card" : ""}">
            <div class="ta-confirm-tutor-avatar ${isHost ? "is-host-avatar" : ""}">
              ${initial}
            </div>
            <div class="ta-confirm-tutor-info">
              <span class="ta-confirm-tutor-name">${name}</span>
              ${email ? `<span class="ta-confirm-tutor-email">${email}</span>` : ""}
            </div>
            <div class="ta-confirm-role-pill ${isHost ? "role-host" : "role-support"}">
              ${isHost ? "★ HOST" : "SUPPORT"}
            </div>
          </div>
        `;
      })
      .join("");

    // =================================================
    // CONFIRMATION POPUP
    // =================================================

    const confirmResult = await Swal.fire({
      html: `
        <div class="ta-confirm-modal-wrapper">
          <div class="ta-confirm-modal-header">
            <div class="ta-confirm-modal-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <polyline points="16 11 18 13 22 9"></polyline>
              </svg>
            </div>
            <h3 class="ta-confirm-modal-title">Confirm Tutor Allocation</h3>
            <p class="ta-confirm-modal-sub">Review tutor assignments and roles before committing to this batch.</p>
          </div>

          <div class="ta-confirm-batch-banner">
            <div class="ta-confirm-batch-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
              </svg>
            </div>
            <div class="ta-confirm-batch-details">
              <span class="ta-confirm-batch-label">Target Batch</span>
              <strong class="ta-confirm-batch-name">${batch.BATCH_CODE || "Selected Batch"}</strong>
            </div>
          </div>

          <div class="ta-confirm-tutors-section">
            <div class="ta-confirm-tutors-header">
              <span>Allocated Tutors (${selectedTutors.length})</span>
            </div>
            <div class="ta-confirm-tutor-list">
              ${tutorRows}
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Yes, Assign",
      cancelButtonText: "Cancel",
      buttonsStyling: false,
      background: "transparent",
      width: "500px",
      customClass: {
        popup: "ta-confirm-popup",
        actions: "ta-confirm-actions",
        confirmButton: "ta-confirm-btn-primary",
        cancelButton: "ta-confirm-btn-cancel",
      },
    });

    if (
      !confirmResult.isConfirmed
    ) {
      return;
    }

    // =================================================
    // ASSIGN API
    // =================================================

    try {
      setAssigning(true);

      const payload = {
        tutorIds:
          selectedTutors.map(
            (item) => ({
              tutorId: Number(
                item.tutorId
              ),

              role:
                Number(
                  item.role
                ) === HOST_ROLE
                  ? HOST_ROLE
                  : SUPPORT_ROLE,
            })
          ),

        batchId:
          Number(
            selectedBatch
          ),

        createdBy:
          "Admin",
      };

      console.log(
        "Assign payload:",
        payload
      );

      const res =
        await tutorAllocationApi.assignTutors(
          payload
        );

      console.log(
        "Assign response:",
        res?.data
      );

      if (
        res?.data?.status ===
        1
      ) {
        toast.success(
          res.data.message ||
          "Tutors assigned successfully"
        );

        // =================================================
        // REFRESH TUTORS
        // =================================================

        const refreshed =
          await tutorAllocationApi.getTutorAllocation(
            {
              status:
                "ACTIVE",
            }
          );

        if (
          refreshed?.data?.status ===
          1 &&
          Array.isArray(
            refreshed?.data?.data
          )
        ) {
          const refreshedTutors =
            normalizeTutors(
              refreshed.data.data
            );

          setTutors(
            refreshedTutors
          );

          /*
           * After assignment:
           *
           * Select ONLY tutors assigned
           * to the current batch.
           */
          const currentBatchTutors =
            refreshedTutors
              .map(
                (tutor) => {
                  const assignment =
                    tutor.assignedBatches.find(
                      (batch) =>
                        Number(
                          batch.ID
                        ) ===
                        Number(
                          selectedBatch
                        )
                    );

                  if (
                    !assignment
                  ) {
                    return null;
                  }

                  return {
                    tutorId:
                      Number(
                        tutor.USER_ID
                      ),

                    role:
                      Number(
                        assignment.ROLE
                      ) ===
                        HOST_ROLE
                        ? HOST_ROLE
                        : SUPPORT_ROLE,
                  };
                }
              )
              .filter(Boolean);

          setSelectedTutors(
            currentBatchTutors
          );
        }

        // =================================================
        // REFRESH BATCHES
        // =================================================

        await fetchBatches();
      } else {
        toast.error(
          res?.data?.message ||
          "Failed to assign tutors"
        );
      }
    } catch (err) {
      console.error(
        "Assign tutors error:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
        "Failed to assign tutors"
      );
    } finally {
      setAssigning(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="ta-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="ta-header-section">

        <div className="ta-breadcrumb">
          OPERATIONS
        </div>

        <div className="ta-title-row">

          <div className="ta-title-left">

            <h1 className="ta-title">
              Tutor Allocations
            </h1>

            <p className="ta-subtitle">
              Assign tutors to batches and
              manage host/support roles.
            </p>

          </div>

          <button
            className="ta-btn-commit"
            onClick={
              handleAssign
            }
            disabled={
              assigning ||
              !selectedBatch ||
              selectedTutors.length ===
              0
            }
          >
            <UserCheck
              size={16}
            />

            {assigning
              ? "Assigning..."
              : "Assign"}
          </button>

        </div>

      </div>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="ta-main-content">

        <div className="ta-panel ta-enrollment-queue">

          {/* =================================================
              PANEL HEADER
          ================================================= */}

          <div className="ta-panel-header">

            <div className="ta-enrollment-header-left">

              <h2 className="ta-panel-title">
                Tutor Assignment Queue
              </h2>

              <div className="ta-result-count-row">

                {/* =================================================
                    SELECT ALL
                ================================================= */}

                <label className="ta-select-all-wrapper">

                  <input
                    type="checkbox"
                    className="ta-select-all-checkbox"
                    checked={
                      Boolean(
                        allTutorsSelected
                      )
                    }
                    onChange={
                      handleSelectAllTutors
                    }
                    disabled={
                      !selectedBatch ||
                      displayedTutors.length ===
                      0
                    }
                  />

                </label>

                {/* =================================================
                    COUNT
                ================================================= */}

                <p className="ta-result-count">

                  {
                    displayedTutors.length
                  }{" "}
                  tutor(s) found

                  {" • "}

                  {
                    selectedTutors.length
                  }{" "}
                  selected

                </p>

              </div>

            </div>

            {/* =================================================
                BATCH SELECT
            ================================================= */}

            <div className="ta-pick-batch">

              <Select
                value={
                  selectedBatchOption
                }
                options={
                  batchOptions
                }
                onChange={
                  handleBatchChange
                }
                placeholder="Select Batch"
                isClearable
                isSearchable
                className="ta-react-select"
                classNamePrefix="react-select"
              />

            </div>

          </div>

          {/* =================================================
              TUTOR LIST
          ================================================= */}

          <div className="ta-queue-list">

            {loading ? (

              <div className="ta-empty">
                Loading tutors...
              </div>

            ) : displayedTutors.length ===
              0 ? (

              <div className="ta-empty">
                No active tutors found.
              </div>

            ) : (

              displayedTutors.map(
                (tutor) => {

                  const tutorId =
                    Number(
                      tutor.USER_ID
                    );

                  // =================================================
                  // CURRENT BATCH ASSIGNMENT
                  // =================================================

                  const assignment =
                    getTutorAssignment(
                      tutorId,
                      selectedBatch
                    );

                  /*
                   * IMPORTANT:
                   *
                   * When batch IS selected:
                   *   Assigned = assigned to that batch.
                   *
                   * When batch is NOT selected:
                   *   Assigned = assigned to ANY batch.
                   */
                  const isAssigned =
                    selectedBatch
                      ? Boolean(
                        assignment
                      )
                      : hasAnyAssignment(
                        tutor
                      );

                  // =================================================
                  // CURRENT UI SELECTION
                  // =================================================

                  const selectedTutor =
                    selectedTutors.find(
                      (item) =>
                        Number(
                          item.tutorId
                        ) ===
                        tutorId
                    );

                  const isSelected =
                    Boolean(
                      selectedTutor
                    );

                  // =================================================
                  // ROLE
                  // =================================================

                  const role =
                    Number(
                      selectedTutor?.role ??
                      assignment?.ROLE ??
                      SUPPORT_ROLE
                    );

                  const isHost =
                    role ===
                    HOST_ROLE;

                  return (
                    <div
                      className={`ta-queue-row ${isAssigned
                        ? "is-assigned"
                        : "is-not-assigned"
                        } ${isSelected
                          ? "is-selected"
                          : ""
                        }`}
                      key={
                        tutorId
                      }
                    >

                      {/* =================================================
                          CHECKBOX
                      ================================================= */}

                      <input
                        type="checkbox"
                        className="ta-tutor-checkbox"
                        checked={
                          isSelected
                        }
                        onChange={() =>
                          handleTutorSelect(
                            tutorId
                          )
                        }
                        disabled={
                          !selectedBatch
                        }
                      />

                      {/* =================================================
                          TUTOR CARD
                      ================================================= */}

                      <div className="ta-queue-item">

                        <div className="ta-tutor-content">

                          <h4 className="ta-tutor-name">
                            {
                              tutor.USERNAME ||
                              tutor.NAME ||
                              "Unknown Tutor"
                            }
                          </h4>

                          <span className="ta-tutor-details">

                            {
                              tutor.SCHOOL_NAME
                            }

                            {
                              tutor.SCHOOL_NAME &&
                              tutor.EMAIL_ID && (
                                <span className="ta-detail-separator">
                                  {" • "}
                                </span>
                              )
                            }

                            {
                              tutor.EMAIL_ID
                            }

                          </span>

                        </div>

                        {/* =================================================
                            RIGHT SIDE
                        ================================================= */}

                        <div className="ta-action-cell">

                          {/* =================================================
                              ASSIGNED STATUS
                          ================================================= */}

                          <span
                            className={`ta-badge-assigned ${isAssigned
                              ? "assigned"
                              : "not-assigned"
                              }`}
                          >
                            {isAssigned
                              ? "Assigned"
                              : "Not Assigned"}
                          </span>

                          {/* =================================================
                              ROLE
                          ================================================= */}

                          {selectedBatch &&
                            isSelected && (
                              <div className="ta-role-wrapper">

                                <span className="ta-role-label">

                                  {isHost
                                    ? "Host"
                                    : "Support"}

                                </span>

                                <label className="toggle-switch">

                                  <input
                                    type="checkbox"
                                    checked={
                                      isHost
                                    }
                                    onChange={() =>
                                      handleRoleToggle(
                                        tutorId
                                      )
                                    }
                                  />

                                  <span className="slider" />

                                </label>

                              </div>
                            )}

                        </div>

                      </div>

                    </div>
                  );
                }
              )
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default TutorAllocations;