import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  List,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle2,
  Search,
  X,
  Save,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  questionsApi,
  moduleApi,
  finalAssessmentApi,
} from "../../services/apiService";
import { moduleCodeData } from "../../services/dataService";
import Select from "react-select";
import { normalizeCKEditorImages } from "../../utils/imageUtils";
import "./FinalAssessmentTheory.css";

const FinalAssessmentTheory = ({ onBack }) => {
  const navigate = useNavigate();

  // Mode: "create" or "list"
  const [viewMode, setViewMode] = useState("create");

  // =====================================================
  // CREATE STATE (EXACT QUESTION SET LOGIC)
  // =====================================================
  const [templateName, setTemplateName] = useState("");
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  const [moduleOptions, setModuleOptions] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectionModuleId, setSelectionModuleId] = useState(null);

  // =====================================================
  // LIST & EDIT STATE (COPIED FROM QUESTION SETS LIST)
  // =====================================================
  const [theorySets, setTheorySets] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listCurrentPage, setListCurrentPage] = useState(1);

  // Modals: "view" or "edit"
  const [modalType, setModalType] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editSelectedQuestions, setEditSelectedQuestions] = useState([]);
  const [editSelectedModule, setEditSelectedModule] = useState(null);
  const [editSelectedDifficulty, setEditSelectedDifficulty] = useState(null);
  const [editCurrentPage, setEditCurrentPage] = useState(1);
  const [savingEdit, setSavingEdit] = useState(false);

  const QUESTIONS_PER_PAGE = 10;
  const LIST_ITEMS_PER_PAGE = 10;

  // =====================================================
  // USER DATA
  // =====================================================
  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
      sessionStorage.getItem("SmartExamUser") ||
      localStorage.getItem("user") ||
      "{}"
  );
  const userId = userData?.USER_ID || userData?.ID || userData?.id || 1;

  // =====================================================
  // INITIAL DATA FETCH
  // =====================================================
  useEffect(() => {
    fetchQuestions();
    fetchModules();
    fetchTheorySets();
  }, [userId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await questionsApi.getQuestions({
        page: 1,
        limit: 1000,
        search: "",
        QUESTION_TYPE: "",
      });

      if (res.data.status === 1) {
        setQuestions(res.data.data || []);
      } else {
        toast.error(res.data.message || "Failed to fetch questions");
      }
    } catch (error) {
      console.error("Fetch questions error:", error);
      toast.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await moduleApi.getActive();
      if (res.data.status === 1) {
        setModuleOptions(
          (res.data.data || []).map((m) => ({
            value: Number(m.ID),
            label: m.MODULE_NAME,
          }))
        );
      } else {
        toast.error(res.data.message || "Failed to load modules");
      }
    } catch (error) {
      console.error("Fetch modules error:", error);
      toast.error("Failed to load modules");
    }
  };

  const fetchTheorySets = async () => {
    try {
      setLoadingList(true);
      const res = await finalAssessmentApi.getTheoryByTutor(userId);
      if (res.data?.status === 1) {
        const raw = Array.isArray(res.data?.data) ? res.data.data : [];
        const filtered = raw.filter(
          (s) => !s.SET_TYPE || String(s.SET_TYPE).toUpperCase() === "FINAL_ASSESSMENT"
        );
        setTheorySets(filtered);
      } else {
        setTheorySets([]);
      }
    } catch (error) {
      console.error("Fetch theory sets error:", error);
      setTheorySets([]);
    } finally {
      setLoadingList(false);
    }
  };

  // =====================================================
  // DIFFICULTY OPTIONS (MODULE CODES M1 - M8)
  // =====================================================
  const difficultyOptions = moduleCodeData;

  // =====================================================
  // MODULE CHANGE
  // =====================================================
  const handleModuleChange = (newModule) => {
    setSelectedModule(newModule);
    setSelectedDifficulty(null);
    setCurrentPage(1);
  };

  // =====================================================
  // DIFFICULTY CHANGE
  // =====================================================
  const handleDifficultyChange = (newDifficulty) => {
    setSelectedDifficulty(newDifficulty);
    setCurrentPage(1);
  };

  // =====================================================
  // FILTER QUESTIONS (EXACT QUESTION SET FILTER LOGIC)
  // =====================================================
  const filteredQuestions = useMemo(() => {
    if (!selectedModule) {
      return [];
    }

    let filtered = questions.filter(
      (q) => Number(q.MODULE_ID) === Number(selectedModule.value)
    );

    if (selectedDifficulty) {
      filtered = filtered.filter(
        (q) =>
          String(q.DIFFICULTY_LEVEL || "").toUpperCase() ===
          String(selectedDifficulty.value).toUpperCase()
      );
    }

    return filtered;
  }, [questions, selectedModule, selectedDifficulty]);

  // =====================================================
  // PAGINATION
  // =====================================================
  const totalPages = Math.ceil(
    filteredQuestions.length / QUESTIONS_PER_PAGE
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
    return filteredQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [filteredQuestions, currentPage]);

  // =====================================================
  // SELECT ALL
  // =====================================================
  const allSelected =
    paginatedQuestions.length > 0 &&
    paginatedQuestions.every((q) =>
      selectedQuestions.includes(Number(q.ID))
    );

  const toggleSelectAll = () => {
    if (!selectedModule) {
      return;
    }

    const currentModuleId = Number(selectedModule.value);
    const ids = paginatedQuestions.map((q) => Number(q.ID));

    if (allSelected) {
      setSelectedQuestions((prev) =>
        prev.filter((id) => !ids.includes(id))
      );

      if (selectionModuleId === currentModuleId) {
        setSelectionModuleId(null);
      }
      return;
    }

    if (
      selectedQuestions.length > 0 &&
      selectionModuleId !== null &&
      selectionModuleId !== currentModuleId
    ) {
      setSelectedQuestions(ids);
      setSelectionModuleId(currentModuleId);
      return;
    }

    setSelectedQuestions((prev) => [...new Set([...prev, ...ids])]);
    setSelectionModuleId(currentModuleId);
  };

  // =====================================================
  // TOGGLE SINGLE QUESTION
  // =====================================================
  const toggleQuestion = (id) => {
    if (!selectedModule) {
      return;
    }

    const currentModuleId = Number(selectedModule.value);
    const qid = Number(id);
    const isAlreadySelected = selectedQuestions.includes(qid);

    if (isAlreadySelected) {
      const updatedQuestions = selectedQuestions.filter((x) => x !== qid);
      setSelectedQuestions(updatedQuestions);

      if (updatedQuestions.length === 0) {
        setSelectionModuleId(null);
      }
      return;
    }

    if (
      selectedQuestions.length > 0 &&
      selectionModuleId !== null &&
      selectionModuleId !== currentModuleId
    ) {
      setSelectedQuestions([qid]);
      setSelectionModuleId(currentModuleId);
      return;
    }

    setSelectedQuestions((prev) => [...prev, qid]);
    setSelectionModuleId(currentModuleId);
  };

  // =====================================================
  // SHORT QUESTION
  // =====================================================
  const shortQuestion = (html) => {
    if (!html) {
      return "-";
    }
    const text = html
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    const words = text.split(/\s+/);
    return words.length <= 3 ? text : words.slice(0, 3).join(" ") + "...";
  };

  // =====================================================
  // CLEAR FORM
  // =====================================================
  const clearForm = () => {
    setTemplateName("");
    setSelectedQuestions([]);
    setSelectedModule(null);
    setSelectedDifficulty(null);
    setSelectionModuleId(null);
    setCurrentPage(1);
  };

  // =====================================================
  // SUBMIT TEMPLATE (FINAL_ASSESSMENT)
  // =====================================================
  const submitTemplate = async () => {
    if (!templateName.trim()) {
      return toast.error("Enter Question Set name");
    }

    if (!selectedModule) {
      return toast.error("Please select a Module");
    }

    if (selectedQuestions.length === 0) {
      return toast.error("Select at least one question");
    }

    try {
      const res = await finalAssessmentApi.createTheory({
        TEMPLATE_NAME: templateName.trim(),
        QUESTION_IDS: JSON.stringify(selectedQuestions),
        CREATED_BY: userId,
        DIFFICULTY_LEVEL: selectedDifficulty?.value || null,
      });

      if (res.data.status === 1) {
        toast.success("Theory Final Assessment Question Set created successfully");
        clearForm();
        fetchTheorySets();
      } else {
        toast.error(
          res.data.message || "Failed to create Question Set"
        );
      }
    } catch (error) {
      console.error("Create question set error:", error);
      toast.error("Failed to create Question Set");
    }
  };

  // =====================================================
  // BACK HANDLER
  // =====================================================
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/final-assessment");
    }
  };

  // =====================================================
  // LIST ACTIONS: PARSE QUESTION IDS & MODULE
  // =====================================================
  const parseQuestionIds = (jsonStr) => {
    try {
      const p = JSON.parse(jsonStr || "[]");
      return Array.isArray(p) ? p.map(Number) : [];
    } catch {
      return [];
    }
  };

  const getQuestionModule = (questionId) => {
    const q = questions.find((item) => Number(item.ID) === Number(questionId));
    return q ? Number(q.MODULE_ID) : null;
  };

  // =====================================================
  // OPEN VIEW MODAL (COPIED FROM QUESTION SETS LIST)
  // =====================================================
  const handleView = (item) => {
    setSelectedSet(item);
    setModalType("view");
  };

  // =====================================================
  // OPEN EDIT MODAL (EXACT COPY FROM QUESTION SETS LIST)
  // =====================================================
  const handleEdit = (questionSet) => {
    const selectedIds = parseQuestionIds(questionSet.QUESTION_IDS);

    setSelectedSet(questionSet);
    setEditName(questionSet.TEMPLATE_NAME || "");

    const diffCode = questionSet.DIFFICULTY_LEVEL;
    const foundDiff = diffCode
      ? difficultyOptions.find(
          (d) =>
            String(d.value).toUpperCase() === String(diffCode).toUpperCase()
        ) || { label: diffCode, value: diffCode }
      : null;
    setEditSelectedDifficulty(foundDiff);

    let detectedModule = null;
    if (selectedIds.length > 0) {
      const firstQuestionModule = getQuestionModule(selectedIds[0]);
      if (firstQuestionModule) {
        detectedModule =
          moduleOptions.find(
            (module) => Number(module.value) === Number(firstQuestionModule)
          ) || null;
      }
    }

    setEditSelectedModule(detectedModule);

    if (detectedModule) {
      const validSelectedIds = selectedIds.filter((id) => {
        return getQuestionModule(id) === Number(detectedModule.value);
      });
      setEditSelectedQuestions(validSelectedIds);
    } else {
      setEditSelectedQuestions(selectedIds);
    }

    setEditCurrentPage(1);
    setModalType("edit");
  };

  // =====================================================
  // CLOSE MODAL
  // =====================================================
  const closeModal = () => {
    if (savingEdit) return;

    setModalType(null);
    setSelectedSet(null);
    setEditName("");
    setEditSelectedQuestions([]);
    setEditSelectedModule(null);
    setEditSelectedDifficulty(null);
    setEditCurrentPage(1);
  };

  // =====================================================
  // EDIT MODULE CHANGE
  // =====================================================
  const handleEditModuleChange = (option) => {
    setEditSelectedModule(option);
    setEditSelectedQuestions([]);
    setEditCurrentPage(1);
  };

  // =====================================================
  // FILTER EDIT QUESTIONS BY MODULE & DIFFICULTY
  // =====================================================
  const editFilteredQuestions = useMemo(() => {
    if (!editSelectedModule) {
      return [];
    }
    let filtered = questions.filter(
      (question) =>
        Number(question.MODULE_ID) === Number(editSelectedModule.value)
    );
    if (editSelectedDifficulty) {
      filtered = filtered.filter(
        (question) =>
          String(question.DIFFICULTY_LEVEL || "").toUpperCase() ===
          String(editSelectedDifficulty.value).toUpperCase()
      );
    }
    return filtered;
  }, [questions, editSelectedModule, editSelectedDifficulty]);

  const editTotalPages = Math.ceil(
    editFilteredQuestions.length / QUESTIONS_PER_PAGE
  );

  const editPaginatedQuestions = useMemo(() => {
    const startIndex = (editCurrentPage - 1) * QUESTIONS_PER_PAGE;
    return editFilteredQuestions.slice(
      startIndex,
      startIndex + QUESTIONS_PER_PAGE
    );
  }, [editFilteredQuestions, editCurrentPage]);

  useEffect(() => {
    if (editTotalPages > 0 && editCurrentPage > editTotalPages) {
      setEditCurrentPage(editTotalPages);
    }
    if (editTotalPages === 0) {
      setEditCurrentPage(1);
    }
  }, [editTotalPages, editCurrentPage]);

  // Toggle edit question
  const toggleEditQuestion = (id) => {
    const questionId = Number(id);
    setEditSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((item) => item !== questionId)
        : [...prev, questionId]
    );
  };

  // =====================================================
  // SAVE EDIT (FINAL ASSESSMENT THEORY)
  // =====================================================
  const handleSaveEdit = async () => {
    if (!selectedSet) return;

    if (!editName.trim()) {
      toast.error("Question Set name is required");
      return;
    }

    if (!editSelectedModule) {
      toast.error("Please select a module");
      return;
    }

    if (editSelectedQuestions.length === 0) {
      toast.error("Select at least one question");
      return;
    }

    try {
      setSavingEdit(true);

      const res = await finalAssessmentApi.updateTheory(selectedSet.ID, {
        TEMPLATE_NAME: editName.trim(),
        QUESTION_IDS: JSON.stringify(editSelectedQuestions),
        DIFFICULTY_LEVEL: editSelectedDifficulty?.value || null,
        UPDATED_BY: userId,
      });

      if (res.data.status === 1) {
        toast.success("Question Set updated successfully");
        await fetchTheorySets();
        closeModal();
      } else {
        toast.error(res.data.message || "Failed to update Question Set");
      }
    } catch (error) {
      console.error("Update question set error:", error);
      toast.error(
        error?.response?.data?.message || "Failed to update Question Set"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // =====================================================
  // DELETE (EXACT SWEETALERT PATTERN)
  // =====================================================
  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: "Delete Question Set?",
      text: `Are you sure you want to delete "${name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#334155",
      confirmButtonText: "Yes, delete",
      background: "#0f172a",
      color: "#f8fafc",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await finalAssessmentApi.deleteTheory(id);
      if (res.data?.status === 1) {
        toast.success("Question set deleted successfully");
        fetchTheorySets();
      } else {
        toast.error(res.data?.message || "Failed to delete");
      }
    } catch (e) {
      console.error("Delete error:", e);
      toast.error("Failed to delete");
    }
  };

  // =====================================================
  // LIST FILTER & PAGINATION (SEARCH ONLY, NO "TOTAL:")
  // =====================================================
  const filteredTheorySets = useMemo(() => {
    if (!listSearch.trim()) return theorySets;
    const term = listSearch.toLowerCase();
    return theorySets.filter((s) =>
      (s.TEMPLATE_NAME || "").toLowerCase().includes(term)
    );
  }, [theorySets, listSearch]);

  const listTotalPages =
    Math.ceil(filteredTheorySets.length / LIST_ITEMS_PER_PAGE) || 1;

  const paginatedTheorySets = useMemo(() => {
    const start = (listCurrentPage - 1) * LIST_ITEMS_PER_PAGE;
    return filteredTheorySets.slice(start, start + LIST_ITEMS_PER_PAGE);
  }, [filteredTheorySets, listCurrentPage]);

  // =====================================================
  // SELECT STYLES (EXACT MATCH)
  // =====================================================
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      height: 40,
      background: "#111827",
      borderColor: state.isFocused ? "#00e5ff" : "#334155",
      boxShadow: "none",
      "&:hover": {
        borderColor: "#00e5ff",
      },
    }),
    menu: (base) => ({
      ...base,
      background: "#111827",
      zIndex: 999,
    }),
    menuList: (base) => ({
      ...base,
      background: "#111827",
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? "#1e293b" : "#111827",
      color: "#fff",
      cursor: "pointer",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#fff",
    }),
    input: (base) => ({
      ...base,
      color: "#fff",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#94a3b8",
    }),
    clearIndicator: (base) => ({
      ...base,
      color: "#94a3b8",
      cursor: "pointer",
      "&:hover": {
        color: "#fff",
      },
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "#94a3b8",
      "&:hover": {
        color: "#00e5ff",
      },
    }),
  };

  return (
    <div className="template-container">
      {/* =================================================
          HEADER
      ================================================= */}
      <div className="template-header">
        <div className="template-breadcrumb-group">
          <button
            type="button"
            className="template-back-btn"
            onClick={handleBack}
          >
            <ArrowLeft size={15} />
            <span>Back to Final Assessments</span>
          </button>

          <span className="template-breadcrumb">
            FINAL ASSESSMENT / THEORY
          </span>

          <h1>
            {viewMode === "create"
              ? "Theory Final Assessment"
              : "Theory Final Assessment Sets"}
          </h1>

          <p>
            {viewMode === "create"
              ? "Create Final Assessment Question Sets by selecting multiple questions."
              : "Manage your created Final Assessment Theory Question Sets."}
          </p>
        </div>

        <div className="template-header-actions">
          {viewMode === "create" ? (
            <button
              type="button"
              className="template-list-btn"
              onClick={() => setViewMode("list")}
            >
              <List size={17} />
              Theory Sets List
            </button>
          ) : (
            <button
              type="button"
              className="template-list-btn"
              onClick={() => setViewMode("create")}
            >
              <Plus size={17} />
              Create Question Set
            </button>
          )}
        </div>
      </div>

      {/* =================================================
          VIEW 1: CREATE QUESTION SET (EXACT MATCH)
      ================================================= */}
      {viewMode === "create" && (
        <>
          {/* QUESTION SET NAME */}
          <div className="template-card">
            <label className="template-label">
              Question Set Name <span>*</span>
            </label>
            <input
              type="text"
              className="template-name-input"
              placeholder="Enter Question Set name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>

          {/* FILTERS (MODULE & DIFFICULTY) */}
          <div className="filter-row">
            {/* MODULE */}
            <div className="filter-item">
              <label className="template-label">
                Module <span>*</span>
              </label>
              <Select
                options={moduleOptions}
                value={selectedModule}
                onChange={handleModuleChange}
                placeholder="Select Module"
                styles={selectStyles}
                isClearable
              />
            </div>

            {/* DIFFICULTY (WORKING QUESTION SET FILTER LOGIC) */}
            <div className="filter-item">
              <label className="template-label">Difficulty</label>
              <Select
                options={difficultyOptions}
                value={selectedDifficulty}
                onChange={handleDifficultyChange}
                placeholder="All"
                styles={selectStyles}
                isClearable
              />
            </div>
          </div>

          {/* QUESTION TABLE */}
          <div className="template-table-container">
            <table className="template-table">
              <thead>
                <tr>
                  <th className="center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>ID</th>
                  <th className="question-header-cell">
                    <div className="question-header-content">
                      <span className="question-header-title">QUESTIONS</span>
                      {selectedQuestions.length > 0 && (
                        <span className="question-count">
                          {selectedQuestions.length}
                        </span>
                      )}
                    </div>
                  </th>
                  <th>QUESTION TYPE</th>
                  <th>DIFFICULTY</th>
                  <th>MARK</th>
                  <th className="center">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="table-message">
                      Loading...
                    </td>
                  </tr>
                ) : !selectedModule ? (
                  <tr>
                    <td colSpan="7" className="table-message">
                      Please select a Module to view questions.
                    </td>
                  </tr>
                ) : paginatedQuestions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="table-message">
                      No questions found.
                    </td>
                  </tr>
                ) : (
                  paginatedQuestions.map((q, index) => (
                    <tr key={q.ID}>
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={selectedQuestions.includes(Number(q.ID))}
                          onChange={() => toggleQuestion(q.ID)}
                        />
                      </td>
                      <td>
                        {(currentPage - 1) * QUESTIONS_PER_PAGE + index + 1}
                      </td>
                      <td>{shortQuestion(q.QUESTION || q.QUESTION_TEXT)}</td>
                      <td>
                        <span className="type-pill">{q.QUESTION_TYPE}</span>
                      </td>
                      <td>{q.DIFFICULTY_LEVEL}</td>
                      <td>{q.MARK}</td>
                      <td className="center">
                        <button
                          type="button"
                          className="eye-btn"
                          onClick={() => setPreviewQuestion(q)}
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan="7">
                      <div className="table-pagination">
                        <div className="pagination-info">
                          Page <strong>{currentPage}</strong> of{" "}
                          <strong>{totalPages}</strong>
                        </div>

                        <div className="pagination-buttons">
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>

                          <div className="pagination-pages">
                            {Array.from({ length: totalPages }, (_, index) => {
                              const page = index + 1;
                              return (
                                <button
                                  type="button"
                                  key={page}
                                  className={`pagination-number ${
                                    currentPage === page ? "active" : ""
                                  }`}
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* FOOTER */}
          <div className="template-footer">
            <button
              type="button"
              className="template-clear-btn"
              onClick={clearForm}
            >
              Clear
            </button>

            <button
              type="button"
              className="template-submit-bottom"
              onClick={submitTemplate}
            >
              Save
            </button>
          </div>
        </>
      )}

      {/* =================================================
          VIEW 2: THEORY QUESTION SETS LIST TABLE
          (NO TYPE, NO STATUS, NO TOTAL: TEXT)
      ================================================= */}
      {viewMode === "list" && (
        <div style={{ marginTop: "10px" }}>
          {/* SEARCH BAR (NO TOTAL: TEXT) */}
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "280px",
                maxWidth: "100%",
              }}
            >
              <input
                type="text"
                className="template-name-input"
                placeholder="Search question sets..."
                value={listSearch}
                onChange={(e) => {
                  setListSearch(e.target.value);
                  setListCurrentPage(1);
                }}
                style={{ paddingLeft: "34px" }}
              />
              <Search
                size={16}
                color="#94a3b8"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "10px",
                }}
              />
            </div>
          </div>

          {/* LIST TABLE (ID, SET NAME, DIFFICULTY, QUESTIONS, ACTION) */}
          <div className="template-table-container">
            <table className="template-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>ID</th>
                  <th>QUESTION SET NAME</th>
                  <th>DIFFICULTY</th>
                  <th>QUESTIONS</th>
                  <th className="center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan="5" className="table-message">
                      Loading theory question sets...
                    </td>
                  </tr>
                ) : filteredTheorySets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="table-message">
                      No Theory Final Assessment question sets found.
                    </td>
                  </tr>
                ) : (
                  paginatedTheorySets.map((item, index) => {
                    const qIds = parseQuestionIds(item.QUESTION_IDS);

                    return (
                      <tr key={item.ID}>
                        <td>
                          {(listCurrentPage - 1) * LIST_ITEMS_PER_PAGE +
                            index +
                            1}
                        </td>
                        <td>
                          <strong style={{ color: "#f8fafc" }}>
                            {item.TEMPLATE_NAME}
                          </strong>
                        </td>
                        <td>
                          <span className="qs-difficulty">
                            {item.DIFFICULTY_LEVEL || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="question-count">
                            {qIds.length} Questions
                          </span>
                        </td>
                        <td className="center">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              gap: "8px",
                            }}
                          >
                            <button
                              type="button"
                              className="eye-btn"
                              onClick={() => handleView(item)}
                              title="View Question Set"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="eye-btn"
                              onClick={() => handleEdit(item)}
                              title="Edit Question Set"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="eye-btn"
                              onClick={() =>
                                handleDelete(item.ID, item.TEMPLATE_NAME)
                              }
                              title="Delete Question Set"
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* LIST PAGINATION */}
              {listTotalPages > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan="5">
                      <div className="table-pagination">
                        <div className="pagination-info">
                          Page <strong>{listCurrentPage}</strong> of{" "}
                          <strong>{listTotalPages}</strong>
                        </div>
                        <div className="pagination-buttons">
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={listCurrentPage === 1}
                            onClick={() =>
                              setListCurrentPage((p) => Math.max(1, p - 1))
                            }
                          >
                            <ChevronLeft size={16} /> Previous
                          </button>
                          <div className="pagination-pages">
                            {Array.from(
                              { length: listTotalPages },
                              (_, i) => (
                                <button
                                  type="button"
                                  key={i + 1}
                                  className={`pagination-number ${
                                    listCurrentPage === i + 1 ? "active" : ""
                                  }`}
                                  onClick={() => setListCurrentPage(i + 1)}
                                >
                                  {i + 1}
                                </button>
                              )
                            )}
                          </div>
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={listCurrentPage === listTotalPages}
                            onClick={() =>
                              setListCurrentPage((p) =>
                                Math.min(listTotalPages, p + 1)
                              )
                            }
                          >
                            Next <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* =================================================
          PREVIEW MODAL
      ================================================= */}
      {previewQuestion && (
        <div
          className="qs-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewQuestion(null);
            }
          }}
        >
          <div className="qs-modal" style={{ maxWidth: "600px" }}>
            <div className="qs-modal-header">
              <div className="qs-modal-title-box">
                <span className="template-breadcrumb">QUESTION PREVIEW</span>
                <h2>Question Preview</h2>
              </div>
              <button
                type="button"
                className="qs-modal-close"
                onClick={() => setPreviewQuestion(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="qs-modal-body"
              dangerouslySetInnerHTML={{
                __html: normalizeCKEditorImages(
                  previewQuestion.QUESTION ||
                  previewQuestion.QUESTION_TEXT ||
                  ""
                ),
              }}
            />
          </div>
        </div>
      )}

      {/* =================================================
          VIEW QUESTION SET MODAL (COPIED FROM QUESTION SETS LIST)
      ================================================= */}
      {modalType === "view" && selectedSet && (
        <div
          className="qs-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="qs-modal">
            <div className="qs-modal-header">
              <div className="qs-modal-title-box">
                <span className="template-breadcrumb">QUESTION SET DETAILS</span>
                <h2>{selectedSet.TEMPLATE_NAME}</h2>
                <p>
                  {parseQuestionIds(selectedSet.QUESTION_IDS).length} questions
                  in this set.
                  {selectedSet.DIFFICULTY_LEVEL && selectedSet.DIFFICULTY_LEVEL !== "-" && (
                    <span
                      style={{
                        marginLeft: "12px",
                        color: "#00e5ff",
                        fontWeight: 600,
                      }}
                    >
                      • Difficulty: {selectedSet.DIFFICULTY_LEVEL}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="qs-modal-close"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>
            <div className="qs-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {parseQuestionIds(selectedSet.QUESTION_IDS).map(
                  (qid, idx) => {
                    const qObj = questions.find(
                      (q) => Number(q.ID) === Number(qid)
                    );
                    return (
                      <div
                        key={qid}
                        style={{
                          padding: "14px",
                          background: "#111b27",
                          border: "1px solid #263445",
                          borderRadius: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "6px",
                            fontSize: "11px",
                            color: "#00e5ff",
                            fontWeight: 700,
                          }}
                        >
                          <span>QUESTION #{idx + 1}</span>
                          <span>
                            {qObj?.QUESTION_TYPE || "MCQ"} • {qObj?.MARK || 1}{" "}
                            Mark(s) • {qObj?.DIFFICULTY_LEVEL || "-"}
                          </span>
                        </div>
                        <div
                          style={{ color: "#f8fafc", fontSize: "13px", lineHeight: "1.6" }}
                          dangerouslySetInnerHTML={{
                            __html: normalizeCKEditorImages(
                              qObj?.QUESTION ||
                              qObj?.QUESTION_TEXT ||
                              `Question ID: ${qid}`
                            ),
                          }}
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
            <div className="qs-modal-footer">
              <button
                type="button"
                className="qs-close-btn"
                onClick={closeModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          EDIT MODAL (EXACT COPY OF QUESTION SETS LIST EDIT)
      ================================================= */}
      {modalType === "edit" && selectedSet && (
        <div
          className="qs-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingEdit) closeModal();
          }}
        >
          <div className="qs-modal qs-edit-modal">
            {/* EDIT HEADER */}
            <div className="qs-modal-header">
              <div className="qs-modal-title-box">
                <span className="template-breadcrumb">EDIT QUESTION SET</span>
                <h2>Edit Question Set</h2>
                <p>Update the name and selected questions.</p>
              </div>

              <button
                className="qs-modal-close"
                onClick={closeModal}
                disabled={savingEdit}
              >
                <X size={20} />
              </button>
            </div>

            {/* EDIT BODY */}
            <div className="qs-modal-body">
              {/* NAME */}
              <div className="qs-edit-name-section">
                <label>
                  Question Set Name <span>*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter question set name"
                />
              </div>

              {/* MODULE */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "#e2e8f0",
                  }}
                >
                  Module{" "}
                  <span style={{ color: "#ef4444", marginLeft: "3px" }}>
                    *
                  </span>
                </label>
                <Select
                  options={moduleOptions}
                  value={editSelectedModule}
                  onChange={handleEditModuleChange}
                  isClearable
                  isSearchable
                  placeholder="Select Module"
                  styles={selectStyles}
                />
              </div>

              {/* DIFFICULTY LEVEL */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "#e2e8f0",
                  }}
                >
                  Difficulty Level
                </label>
                <Select
                  options={difficultyOptions}
                  value={editSelectedDifficulty}
                  onChange={(option) => {
                    setEditSelectedDifficulty(option);
                    setEditCurrentPage(1);
                  }}
                  isClearable
                  isSearchable
                  placeholder="All / Select Module Code (M1 - M8)"
                  styles={selectStyles}
                />
              </div>

              {/* SELECTION BAR */}
              <div className="qs-selection-bar">
                <div>
                  <strong>Select Questions</strong>
                  <span>Choose questions from the selected module.</span>
                </div>
                <div className="qs-selected-count">
                  <CheckCircle2 size={16} />
                  {editSelectedQuestions.length} Selected
                </div>
              </div>

              {/* QUESTION TABLE */}
              <div className="qs-edit-table-container">
                {loading ? (
                  <div className="qs-empty">Loading questions...</div>
                ) : !editSelectedModule ? (
                  <div className="qs-empty">
                    Please select a module to view questions.
                  </div>
                ) : editFilteredQuestions.length === 0 ? (
                  <div className="qs-empty">
                    No questions found for {editSelectedModule.label}.
                  </div>
                ) : (
                  <>
                    <table className="qs-edit-table">
                      <thead>
                        <tr>
                          <th className="center" style={{ width: "50px" }}>
                            SELECT
                          </th>
                          <th style={{ width: "50px" }}>ID</th>
                          <th>QUESTION</th>
                          <th>TYPE</th>
                          <th>DIFFICULTY</th>
                          <th>MARK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editPaginatedQuestions.map((question, index) => {
                          const isSelected = editSelectedQuestions.includes(
                            Number(question.ID)
                          );
                          const serialNumber =
                            (editCurrentPage - 1) * QUESTIONS_PER_PAGE +
                            index +
                            1;

                          return (
                            <tr
                              key={question.ID}
                              className={
                                isSelected ? "selected-question-row" : ""
                              }
                            >
                              <td className="center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleEditQuestion(question.ID)
                                  }
                                />
                              </td>
                              <td>{serialNumber}</td>
                              <td>
                                {shortQuestion(
                                  question.QUESTION || question.QUESTION_TEXT
                                )}
                              </td>
                              <td>
                                <span className="type-pill">
                                  {question.QUESTION_TYPE}
                                </span>
                              </td>
                              <td>{question.DIFFICULTY_LEVEL}</td>
                              <td>{question.MARK}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* EDIT PAGINATION */}
                    {editTotalPages > 1 && (
                      <div className="table-pagination">
                        <div className="pagination-info">
                          Page <strong>{editCurrentPage}</strong> of{" "}
                          <strong>{editTotalPages}</strong>
                        </div>
                        <div className="pagination-buttons">
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={editCurrentPage === 1}
                            onClick={() =>
                              setEditCurrentPage((prev) => prev - 1)
                            }
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>
                          <div className="pagination-pages">
                            {Array.from(
                              { length: editTotalPages },
                              (_, i) => (
                                <button
                                  type="button"
                                  key={i + 1}
                                  className={`pagination-number ${
                                    editCurrentPage === i + 1 ? "active" : ""
                                  }`}
                                  onClick={() => setEditCurrentPage(i + 1)}
                                >
                                  {i + 1}
                                </button>
                              )
                            )}
                          </div>
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={editCurrentPage === editTotalPages}
                            onClick={() =>
                              setEditCurrentPage((prev) => prev + 1)
                            }
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* EDIT FOOTER */}
            <div className="qs-modal-footer">
              <button
                className="qs-close-btn"
                onClick={closeModal}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                className="qs-save-btn"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                <Save size={17} />
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalAssessmentTheory;
