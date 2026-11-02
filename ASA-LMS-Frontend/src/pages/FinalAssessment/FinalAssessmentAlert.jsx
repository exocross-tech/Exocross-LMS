import React, { useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Layers,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  finalAssessmentApi,
  questionsApi,
  moduleApi,
} from "../../services/apiService";
import "./FinalAssessmentAlert.css";

const FinalAssessmentAlert = ({ onBack }) => {
  const navigate = useNavigate();

  // =====================================================
  // STATE
  // =====================================================
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [modules, setModules] = useState([]); // Grouped module sections
  const [selectedCard, setSelectedCard] = useState(null); // Selected Final Question Set
  const [expandedSets, setExpandedSets] = useState({});
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
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

      if (!storedUser) return null;
      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    } catch (error) {
      console.error("Get logged user error:", error);
      return null;
    }
  };

  const user = getLoggedUser();
  const userId =
    user?.USER_ID ||
    user?.ID ||
    user?.USERID ||
    user?.id;

  // =====================================================
  // FETCH DATA
  // =====================================================
  useEffect(() => {
    if (!userId) {
      setLoadingBatches(false);
      setLoadingModules(false);
      toast.error("Unable to identify the logged-in tutor");
      return;
    }
    if (!isFetched.current) {
      isFetched.current = true;
      fetchTheoryFinalAssessmentSets();
      fetchTutorBatches();
    }
  }, [userId]);

  const fetchTutorBatches = async () => {
    try {
      setLoadingBatches(true);
      // Fetch only tutor's authorized HOST batches
      const response = await finalAssessmentApi.getTutorBatches(userId);

      if (response.data?.status === 1) {
        const data = Array.isArray(response.data?.data) ? response.data.data : [];
        setBatches(data);
        if (data.length === 1) {
          setSelectedBatch(data[0]);
        }
      } else {
        setBatches([]);
        toast.error(response.data?.message || "No authorized batches found");
      }
    } catch (error) {
      console.error("Get tutor batches error:", error);
      setBatches([]);
      toast.error(error?.response?.data?.message || "Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  };

  // Helper to parse question IDs JSON
  const parseQuestionIds = (jsonStr) => {
    try {
      const p = typeof jsonStr === "string" ? JSON.parse(jsonStr || "[]") : jsonStr;
      return Array.isArray(p) ? p.map(Number) : [];
    } catch {
      return [];
    }
  };

  const fetchTheoryFinalAssessmentSets = async () => {
    try {
      setLoadingModules(true);

      // Fetch Theory Final Assessment templates list which includes pre-joined questions
      const theoryRes = await finalAssessmentApi.getTheoryTemplates();

      const rawTheorySets =
        theoryRes.data?.status === 1 && Array.isArray(theoryRes.data?.data)
          ? theoryRes.data.data.filter(
              (set) =>
                !set.SET_TYPE ||
                String(set.SET_TYPE).toUpperCase() === "FINAL_ASSESSMENT"
            )
          : [];

      // Group Theory Final Assessment Sets by their associated Module
      const groupedMap = new Map();

      rawTheorySets.forEach((set) => {
        const setQuestions = Array.isArray(set.questions) ? set.questions : [];

        // Find associated module from questions
        let detectedModuleId = null;
        let detectedModuleName = "General";

        for (const q of setQuestions) {
          if (q.MODULE_ID) {
            detectedModuleId = Number(q.MODULE_ID);
            detectedModuleName =
              q.MODULE_NAME || `Module ${detectedModuleId}`;
            break;
          }
        }

        if (!detectedModuleId) {
          detectedModuleId = 0;
          detectedModuleName = "General Theory Sets";
        }

        if (!groupedMap.has(detectedModuleId)) {
          groupedMap.set(detectedModuleId, {
            MODULE_ID: detectedModuleId,
            MODULE_NAME: detectedModuleName,
            sets: [],
          });
        }

        groupedMap.get(detectedModuleId).sets.push({
          SET_ID: set.ID,
          SET_NAME: set.TEMPLATE_NAME,
          QUESTION_COUNT: set.QUESTION_COUNT || setQuestions.length,
          TOTAL_MARKS: set.TOTAL_MARKS || 0,
          questions: setQuestions.map((q) => ({
            QUESTION_ID: q.ID,
            QUESTION_TEXT: q.QUESTION || q.QUESTION_TEXT || "Question not available",
            QUESTION_TYPE: q.QUESTION_TYPE || "MCQ",
            MARK: q.MARK || 1,
            DIFFICULTY_LEVEL: q.DIFFICULTY_LEVEL || "M1",
          })),
        });
      });

      const structuredModules = Array.from(groupedMap.values());
      setModules(structuredModules);
    } catch (error) {
      console.error("Fetch Theory Final Assessment sets error:", error);
      setModules([]);
      toast.error("Failed to load Theory Final Assessment Sets");
    } finally {
      setLoadingModules(false);
    }
  };

  // =====================================================
  // SELECT BATCH
  // =====================================================
  const handleBatchChange = (event) => {
    const batchId = Number(event.target.value);

    if (!batchId) {
      setSelectedBatch(null);
      setSelectedCard(null);
      setExpandedSets({});
      return;
    }

    const batch = batches.find((item) => Number(item.BATCH_ID || item.ID) === batchId) || null;
    setSelectedBatch(batch);
    setSelectedCard(null);
    setExpandedSets({});
  };

  // =====================================================
  // TOGGLE & SELECT QUESTION SET
  // =====================================================
  const toggleSet = (moduleId, setId) => {
    const key = `${moduleId}-${setId}`;
    setExpandedSets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectSet = (module, questionSet) => {
    if (!module || !questionSet) return;

    const moduleId = Number(module.MODULE_ID);
    const setId = Number(questionSet.SET_ID);
    const cardId = `${moduleId}-${setId}`;

    if (selectedCard?.cardId === cardId) {
      setSelectedCard(null);
      return;
    }

    setSelectedCard({
      cardId,
      moduleId,
      setId,
      moduleName: module.MODULE_NAME || "",
      setName: questionSet.SET_NAME || "",
      questionCount: Number(questionSet.QUESTION_COUNT) || 0,
    });
  };

  // =====================================================
  // CLEAR ENTIRE FORM
  // =====================================================
  const clearAssignmentForm = () => {
    setSelectedBatch(batches.length === 1 ? batches[0] : null);
    setSelectedCard(null);
    setExpandedSets({});
  };

  // =====================================================
  // ASSIGN FINAL ASSESSMENT
  // =====================================================
  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Unable to identify the logged-in tutor");
      return;
    }

    if (!selectedBatch) {
      toast.warning("Please select a batch");
      return;
    }

    if (!selectedCard) {
      toast.warning("Please select a Final Question Set to assign.");
      return;
    }

    const assignedBatchId = Number(selectedBatch.BATCH_ID || selectedBatch.ID);
    const assignedSetId = Number(selectedCard.setId);

    try {
      setSaving(true);

      const payload = {
        TYPE: "THEORY",
        SET_ID: assignedSetId,
        BATCH_ID: assignedBatchId,
        TUTOR_ID: Number(userId),
        TITLE: selectedCard.setName || "Theory Final Assessment",
        DESCRIPTION: `Final Assessment (Theory): ${selectedCard.setName}`,
      };

      console.log("Assign Theory Final Assessment payload:", payload);

      const response = await finalAssessmentApi.assignFinalAssessment(payload);

      if (response.data?.status === 1) {
        toast.success(
          response.data?.message || "Final Assessment assigned successfully!"
        );
        clearAssignmentForm();
      } else {
        toast.error(
          response.data?.message || "Failed to assign Final Assessment"
        );
      }
    } catch (error) {
      console.error("Assign final assessment error:", error);
      const message =
        error?.response?.data?.message ||
        "Failed to assign Final Assessment";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // TOTAL COUNTS
  // =====================================================
  const totalQuestionSets = modules.reduce(
    (total, module) =>
      total + (Array.isArray(module?.sets) ? module.sets.length : 0),
    0
  );

  const totalQuestions = modules.reduce((moduleTotal, module) => {
    const sets = Array.isArray(module?.sets) ? module.sets : [];
    return (
      moduleTotal +
      sets.reduce(
        (setTotal, set) => setTotal + (Number(set.QUESTION_COUNT) || 0),
        0
      )
    );
  }, 0);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/final-assessment");
    }
  };

  return (
    <div className="assignment-alert-page fa-alert-page">
      {/* =================================================
          PAGE HEADER (MATCHING ASSESSMENT ALERT EXACTLY)
      ================================================= */}
      <div className="classschedule-header">
        <div className="header-left1">
          <button
            type="button"
            className="fa-alert-back-btn"
            onClick={handleBack}
          >
            ← Back to Final Assessments
          </button>

          <div className="section-label">
            <Award size={14} className="live-dot" />
            FINAL ASSESSMENT ALERT
          </div>

          <h1 className="header-main-title">Final Assessment Alert</h1>

          <p className="header-subtitle">
            Select a batch and choose a Final Question Set to immediately assign the Final Assessment to students.
          </p>
        </div>
      </div>

      {/* =================================================
          CONTENT
      ================================================= */}
      <div className="assignment-content">
        {/* =================================================
            BATCH SELECTION (EXACT ASSESSMENT ALERT CARD)
        ================================================= */}
        <div className="assignment-selection-card">
          <div className="assignment-select-group">
            <label>
              <span className="selection-label-icon">
                <Layers size={14} />
              </span>
              BATCH
            </label>

            <div className="assignment-select-wrapper">
              <select
                value={selectedBatch?.BATCH_ID || selectedBatch?.ID || ""}
                onChange={handleBatchChange}
                disabled={loadingBatches || saving}
              >
                <option value="">
                  {loadingBatches
                    ? "Loading batches..."
                    : batches.length === 0
                      ? "No authorized batches found"
                      : "Select Batch"}
                </option>

                {batches.map((batch) => {
                  const bId = batch.BATCH_ID || batch.ID;
                  return (
                    <option key={bId} value={bId}>
                      {batch.BATCH_CODE}
                    </option>
                  );
                })}
              </select>

              <ChevronDown size={17} className="assignment-select-icon" />
            </div>
          </div>
        </div>

        {/* =================================================
            NOTICE
        ================================================= */}
        {!selectedBatch && (
          <div className="selection-notice">
            <Layers size={17} />
            <span>Please select a batch to assign a Final Assessment.</span>
          </div>
        )}

        {/* =================================================
            FINAL QUESTION SETS WORKSPACE (FULL WIDTH SINGLE COLUMN)
        ================================================= */}
        <div className="assignment-dual-columns fa-alert-single-column">
          <div className="assignment-column question-sets-column" style={{ width: "100%" }}>
            <div className="column-header">
              <div className="column-header-title">
                <BookOpen size={18} className="column-icon" />
                <div>
                  <h3>Final Question Sets</h3>
                  <p>Select a Final Question Set to assign to the batch</p>
                </div>
              </div>
              <div className="column-badge">
                <span>{totalQuestionSets} Sets</span>
              </div>
            </div>

            {loadingModules && (
              <div className="assignment-empty-mini">
                <div className="assignment-spinner" />
                <span>Loading Final Question Sets...</span>
              </div>
            )}

            {!loadingModules && modules.length === 0 && (
              <div className="assignment-empty-mini">
                <BookOpen size={24} />
                <strong>No Final Question Sets Available</strong>
              </div>
            )}

            {!loadingModules && modules.length > 0 && (
              <div className="module-card-list">
                {modules.map((module) => {
                  const moduleSets = Array.isArray(module?.sets)
                    ? module.sets
                    : [];
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
                              {moduleSets.length}{" "}
                              {moduleSets.length === 1
                                ? "Question Set"
                                : "Question Sets"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="question-set-list">
                        {moduleSets.map((questionSet) => {
                          const setId = Number(questionSet.SET_ID);
                          const moduleId = Number(module.MODULE_ID);
                          const cardId = `${moduleId}-${setId}`;
                          const isSelected =
                            selectedCard?.cardId === cardId;
                          const isExpanded =
                            expandedSets[cardId] || false;

                          return (
                            <div
                              className={`question-set-item ${isSelected ? "selected" : ""
                                }`}
                              key={cardId}
                            >
                              <div className="question-set-header">
                                <button
                                  type="button"
                                  className={`set-select-box ${isSelected ? "checked" : ""
                                    }`}
                                  onClick={() =>
                                    handleSelectSet(module, questionSet)
                                  }
                                  disabled={saving}
                                  aria-label={
                                    isSelected
                                      ? "Deselect question set"
                                      : "Select question set"
                                  }
                                >
                                  {isSelected && <Check size={14} />}
                                </button>

                                <div
                                  className="question-set-info"
                                  onClick={() =>
                                    handleSelectSet(module, questionSet)
                                  }
                                >
                                  <span className="set-label">
                                    FINAL QUESTION SET
                                  </span>
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
                                  onClick={() =>
                                    toggleSet(moduleId, setId)
                                  }
                                  aria-label={
                                    isExpanded
                                      ? "Collapse questions"
                                      : "Expand questions"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronUp size={16} />
                                  ) : (
                                    <ChevronDown size={16} />
                                  )}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="question-set-questions">
                                  {Array.isArray(questionSet.questions) &&
                                    questionSet.questions.length > 0 ? (
                                    questionSet.questions.map(
                                      (question, index) => (
                                        <div
                                          className="question-set-question"
                                          key={
                                            question.QUESTION_ID || index
                                          }
                                        >
                                          <div className="question-number">
                                            {String(index + 1).padStart(
                                              2,
                                              "0"
                                            )}
                                          </div>
                                          <div
                                            className="question-text"
                                            dangerouslySetInnerHTML={{
                                              __html:
                                                question.QUESTION_TEXT ||
                                                "Question not available",
                                            }}
                                          />
                                        </div>
                                      )
                                    )
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
        </div>

        {/* =================================================
            ACTION FOOTER (MATCHING ASSESSMENT ALERT EXACTLY)
        ================================================= */}
        <div className="assignment-footer">
          <div className="selected-info">
            {!selectedBatch && <span>Select a batch</span>}

            {selectedBatch && !selectedCard && (
              <span className="footer-warning">
                Select a Final Question Set to assign
              </span>
            )}

            {selectedCard && (
              <div className="footer-selection-summary">
                <span className="summary-pill question-set-pill">
                  <BookOpen size={13} />
                  <strong>{selectedCard.setName}</strong>
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="assignment-submit-btn"
            disabled={
              saving ||
              !userId ||
              !selectedBatch ||
              !selectedCard
            }
            onClick={handleSubmit}
          >
            {saving ? "Assigning..." : "Assign Final Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalAssessmentAlert;
