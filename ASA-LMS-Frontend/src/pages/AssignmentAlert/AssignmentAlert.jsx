import React, { useEffect, useRef, useState } from "react";

import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Layers,
  Package,
  Sparkles,
} from "lucide-react";

import { toast } from "react-toastify";

import { assignmentAlertApi } from "../../services/apiService";

import "./AssignmentAlert.css";

const AssignmentAlert = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [modules, setModules] = useState([]);
  const [projectKits, setProjectKits] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null); // Question Set
  const [selectedKit, setSelectedKit] = useState(null); // Project Kit
  const [expandedSets, setExpandedSets] = useState({});
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingKits, setLoadingKits] = useState(true);
  const [saving, setSaving] = useState(false);
  const isFetched = useRef(false);

  // =====================================================
  // GET LOGGED USER
  // =====================================================

  const getLoggedUser = () => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      if (!storedUser) {
        return null;
      }

      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    } catch (error) {
      console.error(
        "Get logged user error:",
        error
      );

      return null;
    }
  };

  const user = getLoggedUser();

  const userId =
    user?.USER_ID ||
    user?.ID ||
    user?.USERID ||
    user?.id;

  const getKitImageUrl = (imgUrl) => {
    if (!imgUrl) return "";
    if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) return imgUrl;
    const cleanPath = imgUrl.startsWith("/") ? imgUrl.substring(1) : imgUrl;
    const base = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "")
      : window.location.origin;
    return `${base.replace(/\/+$/, "")}/${cleanPath}`;
  };

  const getImageFileName = (pathOrUrl) => {
    if (!pathOrUrl) return "";
    const clean = String(pathOrUrl).replace(/\\/g, "/");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  };

  // =====================================================
  // FETCH DATA
  // =====================================================

  useEffect(() => {
    if (!userId) {
      setLoadingBatches(false);

      toast.error(
        "Unable to identify the logged-in user"
      );

      return;
    }
    if (!isFetched.current) {
      isFetched.current = true;
      fetchModules();
      fetchAvailableProjectKits();
      fetchTutorBatches();
    }
  }, [userId]);

  const fetchTutorBatches = async () => {
    try {
      setLoadingBatches(true);

      const response =
        await assignmentAlertApi.getTutorBatch(
          userId
        );

      if (response.data?.status === 1) {
        const data = Array.isArray(
          response.data?.data
        )
          ? response.data.data
          : [];

        setBatches(data);
      } else {
        setBatches([]);

        toast.error(
          response.data?.message ||
          "No batches found"
        );
      }
    } catch (error) {
      console.error(
        "Get tutor batches error:",
        error
      );

      setBatches([]);

      toast.error(
        error?.response?.data?.message ||
        "Failed to load batches"
      );
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchModules = async (batchId = selectedBatch?.BATCH_ID) => {
    try {
      setLoadingModules(true);

      const response =
        await assignmentAlertApi.getModules(batchId ? { batchId } : undefined);

      if (response.data?.status === 1) {
        const data = Array.isArray(
          response.data?.data
        )
          ? response.data.data
          : [];

        // Frontend safety filter: Ensure each module only contains ASSESSMENT question sets
        const filteredData = data
          .map((mod) => ({
            ...mod,
            sets: (mod.sets || []).filter(
              (set) =>
                !set.SET_TYPE ||
                String(set.SET_TYPE).toUpperCase() === "ASSESSMENT"
            ),
          }))
          .filter((mod) => (mod.sets || []).length > 0 || !batchId);

        setModules(filteredData);
      } else {
        setModules([]);

        toast.error(
          response.data?.message ||
          "Failed to load question sets"
        );
      }
    } catch (error) {
      console.error(
        "Get assignment modules error:",
        error
      );

      setModules([]);

      toast.error(
        error?.response?.data?.message ||
        "Failed to load question sets"
      );
    } finally {
      setLoadingModules(false);
    }
  };

  const fetchAvailableProjectKits = async (batchId = selectedBatch?.BATCH_ID) => {
    try {
      setLoadingKits(true);
      const response = await assignmentAlertApi.getAvailableProjectKits(batchId ? { batchId } : undefined);

      if (response.data?.status === 1) {
        setProjectKits(Array.isArray(response.data.data) ? response.data.data : []);
      } else {
        setProjectKits([]);
      }
    } catch (error) {
      console.error("Get available project kits error:", error);
      setProjectKits([]);
    } finally {
      setLoadingKits(false);
    }
  };

  // =====================================================
  // SELECT BATCH
  // =====================================================

  const handleBatchChange = (event) => {
    const batchId = Number(
      event.target.value
    );

    if (!batchId) {
      setSelectedBatch(null);
      setSelectedCard(null);
      setSelectedKit(null);
      setExpandedSets({});
      fetchModules(null);
      fetchAvailableProjectKits(null);

      return;
    }

    const batch =
      batches.find(
        (item) =>
          Number(item.BATCH_ID) === batchId
      ) || null;

    setSelectedBatch(batch);
    setSelectedCard(null);
    setSelectedKit(null);
    setExpandedSets({});

    // Immediately recalculate available balance for the newly selected batch
    fetchModules(batchId);
    fetchAvailableProjectKits(batchId);
  };

  // =====================================================
  // TOGGLE & SELECT QUESTION SET
  // =====================================================

  const toggleSet = (moduleId, setId) => {
    const key = `${moduleId}-${setId}`;

    setExpandedSets((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleSelectSet = (
    module,
    questionSet
  ) => {
    if (!module || !questionSet) {
      return;
    }

    const moduleId = Number(
      module.MODULE_ID
    );

    const setId = Number(
      questionSet.SET_ID
    );

    const cardId =
      `${moduleId}-${setId}`;

    if (
      selectedCard?.cardId === cardId
    ) {
      setSelectedCard(null);
      return;
    }

    setSelectedCard({
      cardId,
      moduleId,
      setId,
      moduleName:
        module.MODULE_NAME || "",
      setName:
        questionSet.SET_NAME || "",
      questionCount:
        Number(
          questionSet.QUESTION_COUNT
        ) || 0,
    });
  };

  // =====================================================
  // SELECT PROJECT KIT
  // =====================================================

  const handleSelectProjectKit = (kit) => {
    if (!kit) return;
    const kitId = Number(kit.ID);

    if (selectedKit?.ID === kitId) {
      setSelectedKit(null);
      return;
    }

    setSelectedKit({
      ID: kitId,
      KIT_NAME: kit.KIT_NAME,
      IMAGE_URL: kit.IMAGE_URL,
    });
  };

  // =====================================================
  // CLEAR ENTIRE FORM
  // =====================================================

  const clearAssignmentForm = () => {
    setSelectedBatch(null);
    setSelectedCard(null);
    setSelectedKit(null);
    setExpandedSets({});
  };

  // =====================================================
  // REMOVE ASSIGNED PROJECT KIT LOCALLY
  // =====================================================

  const removeAssignedProjectKit = (kitId) => {
    setProjectKits((prev) => prev.filter((k) => Number(k.ID) !== Number(kitId)));
  };

  // =====================================================
  // CREATE ASSIGNMENT
  // =====================================================

  const handleSubmit = async () => {
    if (!userId) {
      toast.error(
        "Unable to identify the logged-in user"
      );
      return;
    }

    if (!selectedBatch) {
      toast.warning(
        "Please select a batch"
      );
      return;
    }

    if (!selectedCard && !selectedKit) {
      toast.warning(
        "Please select a Question Set, a Project Kit, or both."
      );
      return;
    }

    const assignedBatchId = Number(selectedBatch.BATCH_ID);
    const assignedKitId = selectedKit ? Number(selectedKit.ID) : null;

    try {
      setSaving(true);

      const payload = {
        batchId: assignedBatchId,
        createdBy: Number(userId),
        setId: selectedCard ? Number(selectedCard.setId) : null,
        moduleId: selectedCard ? Number(selectedCard.moduleId) : null,
        projectKitId: assignedKitId,
      };

      console.log(
        "Create assignment payload:",
        payload
      );

      const response =
        await assignmentAlertApi.create(
          payload
        );

      if (response.data?.status === 1) {
        toast.success(
          response.data?.message ||
          "Assessment alert created successfully"
        );

        setSelectedCard(null);
        setSelectedKit(null);
        setExpandedSets({});

        // Immediately refresh available question sets and project kits for this batch
        if (assignedBatchId) {
          fetchModules(assignedBatchId);
          fetchAvailableProjectKits(assignedBatchId);
        }
      } else if (response.data?.kitAlreadyAssigned) {
        toast.error(
          response.data?.message ||
          "This Project Kit has already been assigned to this batch."
        );
        if (assignedBatchId) {
          await fetchAvailableProjectKits(assignedBatchId);
        }
      } else if (response.data?.setAlreadyAssigned) {
        toast.error(
          response.data?.message ||
          "This Question Set has already been assigned to this batch."
        );
        if (assignedBatchId) {
          await fetchModules(assignedBatchId);
        }
      } else {
        toast.error(
          response.data?.message ||
          "Failed to create assessment alert"
        );
      }
    } catch (error) {
      console.error(
        "Create assessment alert error:",
        error
      );

      const message =
        error?.response?.data?.message ||
        "Failed to create assessment alert";

      toast.error(message);

      if (error?.response?.data?.kitAlreadyAssigned && assignedBatchId) {
        await fetchAvailableProjectKits(assignedBatchId);
      }
      if (error?.response?.data?.setAlreadyAssigned && assignedBatchId) {
        await fetchModules(assignedBatchId);
      }
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // TOTAL COUNTS
  // =====================================================

  const totalQuestionSets =
    modules.reduce(
      (total, module) =>
        total +
        (Array.isArray(module?.sets)
          ? module.sets.length
          : 0),
      0
    );

  const totalQuestions =
    modules.reduce(
      (moduleTotal, module) => {
        const sets =
          Array.isArray(module?.sets)
            ? module.sets
            : [];

        return (
          moduleTotal +
          sets.reduce(
            (setTotal, set) =>
              setTotal +
              (Number(
                set.QUESTION_COUNT
              ) || 0),
            0
          )
        );
      },
      0
    );

  return (
    <div className="assignment-alert-page">
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="classschedule-header">
        <div className="header-left1">
          <div className="section-label">
            <Bell size={14} className="live-dot" />
            ASSESSMENT ALERT
          </div>

          <h1 className="header-main-title">
            Assessment Alert
          </h1>

          <p className="header-subtitle">
            Select a batch, and choose a Question Set and/or Project Kit to immediately assign an assessment.
          </p>
        </div>
      </div>

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="assignment-content">

        {/* =================================================
            BATCH SELECTION & ASSIGNMENT
        ================================================= */}

        <div className="assignment-selection-card">

          <div className="assignment-select-group">

            <label>
              <span className="selection-label-icon">
                <Layers size={14} />
              </span>

              BATCH
            </label>

            <div className="assignment-batch-row">

              <div className="assignment-select-wrapper">

                <select
                  value={
                    selectedBatch?.BATCH_ID || ""
                  }
                  onChange={
                    handleBatchChange
                  }
                  disabled={
                    loadingBatches ||
                    saving
                  }
                >

                  <option value="">
                    {loadingBatches
                      ? "Loading batches..."
                      : "Select Batch"}
                  </option>

                  {batches.map(
                    (batch) => (
                      <option
                        key={
                          batch.BATCH_ID
                        }
                        value={
                          batch.BATCH_ID
                        }
                      >
                        {
                          batch.BATCH_CODE
                        }
                      </option>
                    )
                  )}

                </select>

                <ChevronDown
                  size={17}
                  className="assignment-select-icon"
                />

              </div>

              <button
                type="button"
                className="assignment-submit-btn"
                disabled={
                  saving ||
                  !userId ||
                  !selectedBatch ||
                  (!selectedCard && !selectedKit)
                }
                onClick={handleSubmit}
              >
                {saving ? "Assigning..." : "Assign"}
              </button>

            </div>

          </div>

        </div>

        {/* =================================================
            NOTICE
        ================================================= */}

        {!selectedBatch && (
          <div className="selection-notice">
            <Layers size={17} />
            <span>
              Please select a batch to assign an assessment alert.
            </span>
          </div>
        )}

        {/* =================================================
            TWO-COLUMN WORKSPACE: LEFT (QUESTION SETS) | RIGHT (PROJECT KITS)
        ================================================= */}

        <div className="assignment-dual-columns">

          {/* ----------------- LEFT COLUMN: QUESTION SETS ----------------- */}
          <div className="assignment-column question-sets-column">
            <div className="column-header">
              <div className="column-header-title">
                <BookOpen size={18} className="column-icon" />
                <div>
                  <h3>Question Sets</h3>
                  <p>Select a question set (optional if Project Kit selected)</p>
                </div>
              </div>
              <div className="column-badge">
                <span>{totalQuestionSets} Sets</span>
              </div>
            </div>

            {loadingModules && (
              <div className="assignment-empty-mini">
                <div className="assignment-spinner" />
                <span>Loading question sets...</span>
              </div>
            )}

            {!loadingModules && modules.length === 0 && (
              <div className="assignment-empty-mini">
                <BookOpen size={24} />
                <strong>No Question Sets Available</strong>
              </div>
            )}

            {!loadingModules && modules.length > 0 && (
              <div className="module-card-list">
                {modules.map((module) => {
                  const moduleSets = Array.isArray(module?.sets) ? module.sets : [];
                  if (moduleSets.length === 0) return null;

                  return (
                    <div className="module-card" key={module.MODULE_ID}>
                      <div className="module-card-header">
                        <div className="module-card-title">
                          <div className="module-icon">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <h4>{module.MODULE_NAME}</h4>
                            <span>
                              {moduleSets.length} {moduleSets.length === 1 ? "Question Set" : "Question Sets"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="question-set-list">
                        {moduleSets.map((questionSet) => {
                          const setId = Number(questionSet.SET_ID);
                          const moduleId = Number(module.MODULE_ID);
                          const cardId = `${moduleId}-${setId}`;
                          const isSelected = selectedCard?.cardId === cardId;
                          const isExpanded = expandedSets[cardId] || false;

                          return (
                            <div
                              className={`question-set-item ${isSelected ? "selected" : ""}`}
                              key={cardId}
                            >
                              <div className="question-set-header">
                                <button
                                  type="button"
                                  className={`set-select-box ${isSelected ? "checked" : ""}`}
                                  onClick={() => handleSelectSet(module, questionSet)}
                                  disabled={saving}
                                  aria-label={isSelected ? "Deselect question set" : "Select question set"}
                                >
                                  {isSelected && <Check size={14} />}
                                </button>

                                <div
                                  className="question-set-info"
                                  onClick={() => handleSelectSet(module, questionSet)}
                                >
                                  <span className="set-label">QUESTION SET</span>
                                  <h5>{questionSet.SET_NAME}</h5>
                                </div>

                                <div className="question-set-count">
                                  <ClipboardCheck size={14} />
                                  <span>
                                    {questionSet.QUESTION_COUNT} Qs
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className="set-expand-btn"
                                  onClick={() => toggleSet(moduleId, setId)}
                                  aria-label={isExpanded ? "Collapse questions" : "Expand questions"}
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="question-set-questions">
                                  {Array.isArray(questionSet.questions) && questionSet.questions.length > 0 ? (
                                    questionSet.questions.map((question, index) => (
                                      <div
                                        className="question-set-question"
                                        key={question.QUESTION_ID || index}
                                      >
                                        <div className="question-number">
                                          {String(index + 1).padStart(2, "0")}
                                        </div>
                                        <div
                                          className="question-text"
                                          dangerouslySetInnerHTML={{
                                            __html: question.QUESTION_TEXT || "Question not available",
                                          }}
                                        />
                                      </div>
                                    ))
                                  ) : (
                                    <div className="no-question">
                                      No active questions found in this set.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ----------------- RIGHT COLUMN: PROJECT KITS ----------------- */}
          <div className="assignment-column project-kits-column">
            <div className="column-header">
              <div className="column-header-title">
                <Package size={18} className="column-icon kit-accent-icon" />
                <div>
                  <h3>Project Kits</h3>
                  <p>Select a Project Kit (optional if Question Set selected)</p>
                </div>
              </div>
              <div className="column-badge kit-badge">
                <span>{projectKits.length} Available</span>
              </div>
            </div>

            {loadingKits && (
              <div className="assignment-empty-mini">
                <div className="assignment-spinner" />
                <span>Loading available project kits...</span>
              </div>
            )}

            {!loadingKits && projectKits.length === 0 && (
              <div className="assignment-empty-mini">
                <Package size={24} />
                <strong>No Available Project Kits</strong>
                <span>All project kits have been assigned or none are created yet.</span>
              </div>
            )}

            {!loadingKits && projectKits.length > 0 && (
              <div className="project-kits-table-wrapper">
                <table className="project-kits-table">
                  <thead>
                    <tr>
                      <th className="pk-th-select">Select</th>
                      <th className="pk-th-id">ID</th>
                      <th className="pk-th-image">Image</th>
                      <th className="pk-th-name">Kit Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectKits.map((kit, index) => {
                      const isSelected = Number(selectedKit?.ID) === Number(kit.ID);
                      const imageUrl = getKitImageUrl(kit.IMAGE_URL);
                      const sequenceNumber = index + 1;

                      return (
                        <tr
                          key={kit.ID}
                          className={`project-kit-table-row ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSelectProjectKit(kit)}
                        >
                          <td className="pk-td-select" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`set-select-box kit-action-select-btn ${isSelected ? "checked" : ""}`}
                              onClick={() => handleSelectProjectKit(kit)}
                              disabled={saving}
                              title={isSelected ? "Unselect Kit" : "Select Kit"}
                            >
                              {isSelected && <Check size={14} />}
                            </button>
                          </td>
                          <td className="pk-td-id">
                            <span className="pk-num-id">{sequenceNumber}</span>
                          </td>
                          <td className="pk-td-image">
                            <div className="kit-avatar-box">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={kit.KIT_NAME || "Kit Image"}
                                  className="kit-avatar-img"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = "none";
                                    const fallback = e.target.parentElement?.querySelector(".kit-avatar-fallback");
                                    if (fallback) fallback.style.display = "flex";
                                  }}
                                />
                              ) : null}
                              <div
                                className="kit-avatar-fallback"
                                style={{ display: imageUrl ? "none" : "flex" }}
                              >
                                <Package size={18} />
                              </div>
                            </div>
                          </td>
                          <td className="pk-td-name">
                            <span className="pk-kitname-text">{kit.KIT_NAME || "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default AssignmentAlert;
