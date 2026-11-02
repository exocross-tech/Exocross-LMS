import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  X,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  questionsApi,
  templateApi,
  moduleApi,
} from "../../services/apiService";
import { moduleCodeData } from "../../services/dataService";
import Select from "react-select";
import { normalizeCKEditorImages } from "../../utils/imageUtils";
import "./QuestionSetsList.css";
import Swal from "sweetalert2";

const QuestionSetsList = () => {
  const navigate = useNavigate();

  const [questionSets, setQuestionSets] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // =====================================================
  // MODAL
  // =====================================================

  const [modalType, setModalType] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);

  // =====================================================
  // EDIT
  // =====================================================

  const [editName, setEditName] = useState("");
  const [editSelectedQuestions, setEditSelectedQuestions] =
    useState([]);

  const [editSelectedModule, setEditSelectedModule] =
    useState(null);

  const [editSelectedDifficulty, setEditSelectedDifficulty] =
    useState(null);

  const [saving, setSaving] = useState(false);

  // =====================================================
  // MODULES
  // =====================================================

  const [moduleOptions, setModuleOptions] = useState([]);

  // =====================================================
  // MAIN TABLE PAGINATION
  // =====================================================

  const [currentPage, setCurrentPage] = useState(1);

  const QUESTION_SETS_PER_PAGE = 10;

  // =====================================================
  // EDIT QUESTIONS PAGINATION
  // =====================================================

  const [editCurrentPage, setEditCurrentPage] = useState(1);

  const QUESTIONS_PER_PAGE = 10;

  // =====================================================
  // USER
  // =====================================================

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
      sessionStorage.getItem("SmartExamUser") ||
      localStorage.getItem("user") ||
      "{}"
  );

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    fetchQuestionSets();
    fetchQuestions();
    fetchModules();
  }, []);

  // =====================================================
  // LOAD QUESTION SETS
  // =====================================================

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);

      const res = await templateApi.getAll({ type: "ASSESSMENT" });

      if (res.data.status === 1) {
        const data = (res.data.data || []).filter(
          (set) => !set.SET_TYPE || String(set.SET_TYPE).toUpperCase() === "ASSESSMENT"
        );
        setQuestionSets(data);
      } else {
        toast.error(
          res.data.message ||
            "Failed to fetch question sets"
        );
      }
    } catch (error) {
      console.error(
        "Fetch question sets error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to fetch question sets"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOAD ALL QUESTIONS
  // =====================================================

  const fetchQuestions = async () => {
    try {
      setQuestionsLoading(true);

      const res = await questionsApi.getQuestions({
        page: 1,
        limit: 1000,
        search: "",
        QUESTION_TYPE: "",
      });

      if (res.data.status === 1) {
        setQuestions(res.data.data || []);
      } else {
        toast.error(
          res.data.message ||
            "Failed to fetch questions"
        );
      }
    } catch (error) {
      console.error(
        "Fetch questions error:",
        error
      );

      toast.error(
        "Failed to fetch questions"
      );
    } finally {
      setQuestionsLoading(false);
    }
  };

  // =====================================================
  // LOAD ACTIVE MODULES
  // =====================================================

  const fetchModules = async () => {
    try {
      const res = await moduleApi.getActive();

      if (res.data.status === 1) {
        const options = (res.data.data || []).map(
          (module) => ({
            value: Number(module.ID),
            label: module.MODULE_NAME,
          })
        );

        setModuleOptions(options);
      } else {
        toast.error(
          res.data.message ||
            "Failed to load modules"
        );
      }
    } catch (error) {
      console.error(
        "Fetch modules error:",
        error
      );

      toast.error(
        "Failed to load modules"
      );
    }
  };

  // =====================================================
  // PARSE QUESTION IDS
  // =====================================================

  const parseQuestionIds = (questionIds) => {
    try {
      const ids =
        typeof questionIds === "string"
          ? JSON.parse(questionIds)
          : questionIds;

      if (!Array.isArray(ids)) {
        return [];
      }

      return ids.map(Number);
    } catch {
      return [];
    }
  };

  // =====================================================
  // QUESTION COUNT
  // =====================================================

  const getQuestionCount = (questionIds) => {
    return parseQuestionIds(questionIds).length;
  };

  // =====================================================
  // MAIN TABLE PAGINATION
  // =====================================================

  const totalPages = Math.ceil(
    questionSets.length /
      QUESTION_SETS_PER_PAGE
  );

  const paginatedQuestionSets = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      QUESTION_SETS_PER_PAGE;

    return questionSets.slice(
      startIndex,
      startIndex + QUESTION_SETS_PER_PAGE
    );
  }, [questionSets, currentPage]);

  // =====================================================
  // KEEP MAIN PAGE VALID
  // =====================================================

  useEffect(() => {
    if (
      totalPages > 0 &&
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }

    if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // =====================================================
  // SHORT QUESTION
  // =====================================================

  const shortQuestion = (html) => {
    if (!html) return "-";

    const text = html
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    const words = text.split(/\s+/);

    return words.length <= 10
      ? text
      : words.slice(0, 10).join(" ") + "...";
  };

  // =====================================================
  // OPEN VIEW MODAL
  // =====================================================

  const handleView = (questionSet) => {
    setSelectedSet(questionSet);
    setModalType("view");
  };

  // =====================================================
  // FIND MODULE OF QUESTION
  // =====================================================

  const getQuestionModule = (questionId) => {
    const question = questions.find(
      (item) =>
        Number(item.ID) === Number(questionId)
    );

    if (!question) {
      return null;
    }

    return Number(question.MODULE_ID);
  };

  // =====================================================
  // OPEN EDIT MODAL
  // =====================================================

  const handleEdit = (questionSet) => {
    const selectedIds = parseQuestionIds(
      questionSet.QUESTION_IDS
    );

    setSelectedSet(questionSet);
    setEditName(
      questionSet.TEMPLATE_NAME || ""
    );

    /*
     * Detect module from the first selected question.
     *
     * Question Set should contain questions
     * from only one module.
     */
    let detectedModule = null;

    if (selectedIds.length > 0) {
      const firstQuestionModule =
        getQuestionModule(selectedIds[0]);

      if (firstQuestionModule) {
        detectedModule =
          moduleOptions.find(
            (module) =>
              Number(module.value) ===
              Number(firstQuestionModule)
          ) || null;
      }
    }

    setEditSelectedModule(
      detectedModule
    );

    /*
     * Keep only questions belonging to
     * the detected module.
     */
    if (detectedModule) {
      const validSelectedIds =
        selectedIds.filter((id) => {
          return (
            getQuestionModule(id) ===
            Number(detectedModule.value)
          );
        });

      setEditSelectedQuestions(
        validSelectedIds
      );
    } else {
      setEditSelectedQuestions(
        selectedIds
      );
    }

    const savedDiff = questionSet.DIFFICULTY_LEVEL && questionSet.DIFFICULTY_LEVEL !== "-"
      ? moduleCodeData.find((d) => d.value === questionSet.DIFFICULTY_LEVEL) || { label: questionSet.DIFFICULTY_LEVEL, value: questionSet.DIFFICULTY_LEVEL }
      : null;

    setEditSelectedDifficulty(savedDiff || null);

    setEditCurrentPage(1);

    setModalType("edit");
  };

  // =====================================================
  // CLOSE MODAL
  // =====================================================

  const closeModal = () => {
    if (saving) return;

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
    /*
     * IMPORTANT:
     *
     * When module changes:
     *
     * Pencil -> Pen
     *
     * Previously selected Pencil questions
     * are completely removed.
     */
    setEditSelectedModule(option);

    // Empty selected questions array
    setEditSelectedQuestions([]);

    // Reset pagination
    setEditCurrentPage(1);
  };

  // =====================================================
  // FILTER EDIT QUESTIONS BY MODULE
  // =====================================================

  const editFilteredQuestions = useMemo(() => {
    if (!editSelectedModule) {
      return [];
    }

    let filtered = questions.filter(
      (question) =>
        Number(question.MODULE_ID) ===
        Number(editSelectedModule.value)
    );

    if (editSelectedDifficulty) {
      filtered = filtered.filter(
        (question) =>
          String(question.DIFFICULTY_LEVEL || "").toUpperCase() ===
          String(editSelectedDifficulty.value).toUpperCase()
      );
    }

    return filtered;
  }, [
    questions,
    editSelectedModule,
    editSelectedDifficulty,
  ]);

  // =====================================================
  // EDIT QUESTION PAGINATION
  // =====================================================

  const editTotalPages = Math.ceil(
    editFilteredQuestions.length /
      QUESTIONS_PER_PAGE
  );

  const editPaginatedQuestions = useMemo(() => {
    const startIndex =
      (editCurrentPage - 1) *
      QUESTIONS_PER_PAGE;

    return editFilteredQuestions.slice(
      startIndex,
      startIndex + QUESTIONS_PER_PAGE
    );
  }, [
    editFilteredQuestions,
    editCurrentPage,
  ]);

  // =====================================================
  // KEEP EDIT PAGE VALID
  // =====================================================

  useEffect(() => {
    if (
      editTotalPages > 0 &&
      editCurrentPage > editTotalPages
    ) {
      setEditCurrentPage(
        editTotalPages
      );
    }

    if (editTotalPages === 0) {
      setEditCurrentPage(1);
    }
  }, [
    editTotalPages,
    editCurrentPage,
  ]);

  // =====================================================
  // TOGGLE EDIT QUESTION
  // =====================================================

  const toggleEditQuestion = (id) => {
    const questionId = Number(id);

    setEditSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter(
            (item) =>
              item !== questionId
          )
        : [
            ...prev,
            questionId,
          ]
    );
  };

  // =====================================================
  // SAVE EDIT
  // =====================================================

  const handleSaveEdit = async () => {
    if (!selectedSet) return;

    if (!editName.trim()) {
      toast.error(
        "Question Set name is required"
      );
      return;
    }

    if (!editSelectedModule) {
      toast.error(
        "Please select a module"
      );
      return;
    }

    if (
      editSelectedQuestions.length === 0
    ) {
      toast.error(
        "Select at least one question"
      );
      return;
    }

    try {
      setSaving(true);

      const res =
        await templateApi.update(
          selectedSet.ID,
          {
            TEMPLATE_NAME:
              editName.trim(),

            DIFFICULTY_LEVEL:
              editSelectedDifficulty?.value || null,

            QUESTION_IDS:
              JSON.stringify(
                editSelectedQuestions
              ),

            UPDATED_BY:
              userData.USER_ID || 1,
          }
        );

      if (res.data.status === 1) {
        toast.success(
          "Question Set updated successfully"
        );

        await fetchQuestionSets();

        closeModal();
      } else {
        toast.error(
          res.data.message ||
            "Failed to update Question Set"
        );
      }
    } catch (error) {
      console.error(
        "Update question set error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to update Question Set"
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (
    id,
    name
  ) => {
    const result =
      await Swal.fire({
        title:
          "Delete Question Set?",

        text: `Are you sure you want to delete "${name}"?`,

        icon: "warning",

        showCancelButton: true,

        confirmButtonText:
          "Yes, Delete",

        cancelButtonText:
          "Cancel",

        confirmButtonColor:
          "#ef4444",
      });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const res =
        await templateApi.delete(id);

      if (res.data.status === 1) {
        toast.success(
          "Question Set deleted successfully"
        );

        setQuestionSets(
          (prev) =>
            prev.filter(
              (item) =>
                item.ID !== id
            )
        );
      } else {
        toast.error(
          res.data.message ||
            "Failed to delete Question Set"
        );
      }
    } catch (error) {
      console.error(
        "Delete question set error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to delete Question Set"
      );
    }
  };

  // =====================================================
  // GET QUESTIONS FOR CURRENT SET
  // =====================================================

  const getSelectedQuestionObjects = () => {
    if (!selectedSet) {
      return [];
    }

    const ids =
      parseQuestionIds(
        selectedSet.QUESTION_IDS
      );

    return ids
      .map((id) =>
        questions.find(
          (question) =>
            Number(question.ID) ===
            Number(id)
        )
      )
      .filter(Boolean);
  };

  // =====================================================
  // SELECT STYLES
  // =====================================================

  const moduleSelectStyles = {
    control: (
      base,
      state
    ) => ({
      ...base,
      width: "280px",
      minHeight: "38px",
      height: "38px",
      background: "#111827",
      borderColor:
        state.isFocused
          ? "#00e5ff"
          : "#334155",
      borderRadius: "6px",
      boxShadow: "none",
      cursor: "pointer",
      fontSize: "13px",
    }),

    valueContainer: (
      base
    ) => ({
      ...base,
      height: "38px",
      padding: "0 10px",
    }),

    indicatorsContainer: (
      base
    ) => ({
      ...base,
      height: "38px",
    }),

    menu: (base) => ({
      ...base,
      width: "280px",
      background: "#111827",
      zIndex: 9999,
      fontSize: "13px",
    }),

    menuList: (base) => ({
      ...base,
      background: "#111827",
    }),

    option: (
      base,
      state
    ) => ({
      ...base,
      background:
        state.isFocused
          ? "#1e293b"
          : "#111827",
      color: "#fff",
      cursor: "pointer",
      padding: "8px 10px",
    }),

    singleValue: (
      base
    ) => ({
      ...base,
      color: "#fff",
    }),

    input: (base) => ({
      ...base,
      color: "#fff",
    }),

    placeholder: (
      base
    ) => ({
      ...base,
      color: "#94a3b8",
    }),

    dropdownIndicator: (
      base
    ) => ({
      ...base,
      color: "#94a3b8",
      padding: "6px",
    }),

    clearIndicator: (
      base
    ) => ({
      ...base,
      color: "#94a3b8",
      padding: "6px",
    }),
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="question-sets-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="question-sets-header">

        <div>
          <span className="question-sets-breadcrumb">
            OVERSIGHT / QUESTION SETS
          </span>

          <h1>
            Question Sets
          </h1>

          <p>
            Manage your created question sets.
          </p>
        </div>

        <button
          className="question-sets-create-btn"
          onClick={() =>
            navigate(
              "/question-sets"
            )
          }
        >
          <Plus size={17} />
          Create Question Set
        </button>

      </div>

      {/* =================================================
          MAIN TABLE
      ================================================= */}

      <div className="question-sets-table-container">

        <table className="question-sets-table">

          <thead>
            <tr>
              <th>ID</th>
              <th>
                QUESTION SET NAME
              </th>
              <th>
                DIFFICULTY
              </th>
              <th>
                QUESTIONS
              </th>
              <th className="center">
                ACTION
              </th>
            </tr>
          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td
                  colSpan="5"
                  className="question-sets-message"
                >
                  Loading...
                </td>
              </tr>

            ) : questionSets.length ===
              0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="question-sets-message"
                >
                  No question sets found
                </td>
              </tr>

            ) : (
              paginatedQuestionSets.map(
                (
                  item,
                  index
                ) => {

                  const serialNumber =
                    (currentPage -
                      1) *
                      QUESTION_SETS_PER_PAGE +
                    index +
                    1;

                  return (
                    <tr
                      key={
                        item.ID
                      }
                    >

                      {/* SERIAL NUMBER */}
                      <td>
                        {
                          serialNumber
                        }
                      </td>

                      {/* NAME */}
                      <td className="question-set-name">
                        {
                          item.TEMPLATE_NAME
                        }
                      </td>

                      {/* DIFFICULTY */}
                      <td>
                        <span className="qs-difficulty">
                          {
                            item.DIFFICULTY_LEVEL || "-"
                          }
                        </span>
                      </td>

                      {/* COUNT */}
                      <td>
                        <span className="question-count">
                          {
                            getQuestionCount(
                              item.QUESTION_IDS
                            )
                          }{" "}
                          Questions
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="center">

                        <div className="question-set-actions">

                          <button
                            className="action-view"
                            title="View Questions"
                            onClick={() =>
                              handleView(
                                item
                              )
                            }
                          >
                            <Eye
                              size={16}
                            />
                          </button>

                          <button
                            className="action-edit"
                            title="Edit Question Set"
                            onClick={() =>
                              handleEdit(
                                item
                              )
                            }
                          >
                            <Pencil
                              size={16}
                            />
                          </button>

                          <button
                            className="action-delete"
                            title="Delete Question Set"
                            onClick={() =>
                              handleDelete(
                                item.ID,
                                item.TEMPLATE_NAME
                              )
                            }
                          >
                            <Trash2
                              size={16}
                            />
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                }
              )
            )}

          </tbody>

        </table>

      </div>

      {/* =================================================
          MAIN PAGINATION
      ================================================= */}

      {totalPages > 1 && (
        <div className="question-sets-pagination">

          <button
            type="button"
            className="pagination-btn"
            disabled={
              currentPage === 1
            }
            onClick={() =>
              setCurrentPage(
                (prev) =>
                  prev - 1
              )
            }
          >
            <ChevronLeft
              size={16}
            />
            Previous
          </button>

          <div className="pagination-pages">

            {Array.from(
              {
                length:
                  totalPages,
              },
              (_, index) =>
                index + 1
            ).map(
              (page) => (
                <button
                  type="button"
                  key={page}
                  className={`pagination-number ${
                    currentPage ===
                    page
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setCurrentPage(
                      page
                    )
                  }
                >
                  {page}
                </button>
              )
            )}

          </div>

          <button
            type="button"
            className="pagination-btn"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              setCurrentPage(
                (prev) =>
                  prev + 1
              )
            }
          >
            Next
            <ChevronRight
              size={16}
            />
          </button>

        </div>
      )}

      {/* =================================================
          VIEW MODAL
      ================================================= */}

      {modalType ===
        "view" &&
        selectedSet && (
          <div
            className="qs-modal-overlay"
            onMouseDown={(e) => {
              if (
                e.target ===
                e.currentTarget
              ) {
                closeModal();
              }
            }}
          >

            <div className="qs-modal qs-view-modal">

              <div className="qs-modal-header">

                <div>
                  <span className="qs-modal-label">
                    QUESTION SET
                  </span>

                  <h2>
                    {
                      selectedSet.TEMPLATE_NAME
                    }
                  </h2>

                  <p>
                    {
                      getQuestionCount(
                        selectedSet.QUESTION_IDS
                      )
                    }{" "}
                    selected questions
                    {selectedSet.DIFFICULTY_LEVEL && selectedSet.DIFFICULTY_LEVEL !== "-" && (
                      <span
                        className="qs-difficulty"
                        style={{ marginLeft: "10px" }}
                      >
                        {selectedSet.DIFFICULTY_LEVEL}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  className="qs-modal-close"
                  onClick={
                    closeModal
                  }
                >
                  <X
                    size={20}
                  />
                </button>

              </div>

              <div className="qs-modal-body">

                {questionsLoading ? (
                  <div className="qs-empty">
                    Loading questions...
                  </div>

                ) : getSelectedQuestionObjects()
                    .length ===
                  0 ? (
                  <div className="qs-empty">
                    No questions found.
                  </div>

                ) : (
                  <div className="qs-view-question-list">

                    {getSelectedQuestionObjects().map(
                      (
                        question,
                        index
                      ) => (
                        <div
                          className="qs-view-question"
                          key={
                            question.ID
                          }
                        >

                          <div className="qs-question-top">

                            <span className="qs-question-number">
                              {
                                index +
                                1
                              }
                            </span>

                            <span className="qs-question-id">
                              ID:{" "}
                              {
                                question.ID
                              }
                            </span>

                            <span className="qs-type-pill">
                              {
                                question.QUESTION_TYPE
                              }
                            </span>

                            <span className="qs-difficulty">
                              {
                                question.DIFFICULTY_LEVEL
                              }
                            </span>

                            <span className="qs-mark">
                              {
                                question.MARK
                              }{" "}
                              Mark
                            </span>

                          </div>

                          <div
                            className="qs-question-content"
                            dangerouslySetInnerHTML={{
                              __html: normalizeCKEditorImages(
                                question.QUESTION || "-"
                              ),
                            }}
                          />

                          {question.QUESTION_TYPE ===
                            "MULTIPLE CHOICE" && (
                            <div className="qs-options">

                              {[
                                [
                                  "A",
                                  question.OPTION_A,
                                ],
                                [
                                  "B",
                                  question.OPTION_B,
                                ],
                                [
                                  "C",
                                  question.OPTION_C,
                                ],
                                [
                                  "D",
                                  question.OPTION_D,
                                ],
                              ].map(
                                ([
                                  key,
                                  value,
                                ]) =>
                                  value && (
                                    <div
                                      className="qs-option"
                                      key={
                                        key
                                      }
                                    >
                                      <span>
                                        {
                                          key
                                        }.
                                      </span>

                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html: normalizeCKEditorImages(value),
                                        }}
                                      />
                                    </div>
                                  )
                              )}

                            </div>
                          )}

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

              <div className="qs-modal-footer">

                <button
                  className="qs-close-btn"
                  onClick={
                    closeModal
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

      {/* =================================================
          EDIT MODAL
      ================================================= */}

      {modalType ===
        "edit" &&
        selectedSet && (
          <div
            className="qs-modal-overlay"
            onMouseDown={(e) => {
              if (
                e.target ===
                  e.currentTarget &&
                !saving
              ) {
                closeModal();
              }
            }}
          >

            <div className="qs-modal qs-edit-modal">

              {/* EDIT HEADER */}

              <div className="qs-modal-header">

                <div>
                  <span className="qs-modal-label">
                    EDIT QUESTION SET
                  </span>

                  <h2>
                    Edit Question Set
                  </h2>

                  <p>
                    Update the name and
                    selected questions.
                  </p>
                </div>

                <button
                  className="qs-modal-close"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                >
                  <X
                    size={20}
                  />
                </button>

              </div>

              {/* EDIT BODY */}

              <div className="qs-modal-body">

                {/* NAME */}

                <div className="qs-edit-name-section">

                  <label>
                    Question Set Name
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    value={
                      editName
                    }
                    onChange={(e) =>
                      setEditName(
                        e.target.value
                      )
                    }
                    placeholder="Enter question set name"
                  />

                </div>

                {/* MODULE */}

                <div
                  className="qs-edit-module-section"
                  style={{
                    marginBottom:
                      "20px",
                  }}
                >

                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "8px",
                      fontWeight:
                        600,
                    }}
                  >
                    Module
                    <span
                      style={{
                        color:
                          "#ef4444",
                        marginLeft:
                          "3px",
                      }}
                    >
                      *
                    </span>
                  </label>

                  <Select
                    options={
                      moduleOptions
                    }
                    value={
                      editSelectedModule
                    }
                    onChange={
                      handleEditModuleChange
                    }
                    isClearable
                    isSearchable
                    placeholder="Select Module"
                    styles={
                      moduleSelectStyles
                    }
                  />

                </div>

                {/* DIFFICULTY LEVEL */}

                <div
                  className="qs-edit-module-section"
                  style={{
                    marginBottom:
                      "20px",
                  }}
                >

                  <label
                    style={{
                      display:
                        "block",
                      marginBottom:
                        "8px",
                      fontWeight:
                        600,
                    }}
                  >
                    Difficulty Level
                  </label>

                  <Select
                    options={
                      moduleCodeData
                    }
                    value={
                      editSelectedDifficulty
                    }
                    onChange={(option) => {
                      setEditSelectedDifficulty(option);
                      setEditCurrentPage(1);
                    }}
                    isClearable
                    placeholder="-- Select Difficulty Level --"
                    styles={
                      moduleSelectStyles
                    }
                  />

                </div>

                {/* SELECTED COUNT */}

                <div className="qs-selection-bar">

                  <div>
                    <strong>
                      Select Questions
                    </strong>

                    <span>
                      Choose questions
                      from the selected
                      module.
                    </span>
                  </div>

                  <div className="qs-selected-count">

                    <CheckCircle2
                      size={16}
                    />

                    {
                      editSelectedQuestions.length
                    }{" "}
                    Selected

                  </div>

                </div>

                {/* QUESTION TABLE */}

                <div className="qs-edit-table-container">

                  {questionsLoading ? (
                    <div className="qs-empty">
                      Loading questions...
                    </div>

                  ) : !editSelectedModule ? (
                    <div className="qs-empty">
                      Please select a module
                      to view questions.
                    </div>

                  ) : editFilteredQuestions.length ===
                    0 ? (
                    <div className="qs-empty">
                      No questions found for{" "}
                      {
                        editSelectedModule.label
                      }.
                    </div>

                  ) : (
                    <>

                      <table className="qs-edit-table">

                        <thead>
                          <tr>

                            <th className="center">
                              SELECT
                            </th>

                            <th>
                              ID
                            </th>

                            <th>
                              QUESTION
                            </th>

                            <th>
                              TYPE
                            </th>

                            <th>
                              DIFFICULTY
                            </th>

                            <th>
                              MARK
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {editPaginatedQuestions.map(
                            (
                              question,
                              index
                            ) => {

                              const isSelected =
                                editSelectedQuestions.includes(
                                  Number(
                                    question.ID
                                  )
                                );

                              /*
                               * Serial number across
                               * pagination.
                               */
                              const serialNumber =
                                (editCurrentPage -
                                  1) *
                                  QUESTIONS_PER_PAGE +
                                index +
                                1;

                              return (
                                <tr
                                  key={
                                    question.ID
                                  }
                                  className={
                                    isSelected
                                      ? "selected-question-row"
                                      : ""
                                  }
                                >

                                  {/* SELECT */}

                                  <td className="center">

                                    <input
                                      type="checkbox"
                                      checked={
                                        isSelected
                                      }
                                      onChange={() =>
                                        toggleEditQuestion(
                                          question.ID
                                        )
                                      }
                                    />

                                  </td>

                                  {/* SERIAL NUMBER */}

                                  <td>
                                    {
                                      serialNumber
                                    }
                                  </td>

                                  {/* QUESTION */}

                                  <td className="edit-question-text">
                                    {shortQuestion(
                                      question.QUESTION
                                    )}
                                  </td>

                                  {/* TYPE */}

                                  <td>
                                    <span className="qs-type-pill">
                                      {
                                        question.QUESTION_TYPE
                                      }
                                    </span>
                                  </td>

                                  {/* DIFFICULTY */}

                                  <td>
                                    {
                                      question.DIFFICULTY_LEVEL
                                    }
                                  </td>

                                  {/* MARK */}

                                  <td>
                                    {
                                      question.MARK
                                    }
                                  </td>

                                </tr>
                              );
                            }
                          )}

                        </tbody>

                      </table>

                      {/* EDIT PAGINATION */}

                      {editTotalPages >
                        1 && (
                        <div className="question-sets-pagination">

                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={
                              editCurrentPage ===
                              1
                            }
                            onClick={() =>
                              setEditCurrentPage(
                                (
                                  prev
                                ) =>
                                  prev -
                                  1
                              )
                            }
                          >
                            <ChevronLeft
                              size={
                                16
                              }
                            />

                            Previous
                          </button>

                          <div className="pagination-pages">

                            {Array.from(
                              {
                                length:
                                  editTotalPages,
                              },
                              (
                                _,
                                index
                              ) =>
                                index +
                                1
                            ).map(
                              (
                                page
                              ) => (
                                <button
                                  type="button"
                                  key={
                                    page
                                  }
                                  className={`pagination-number ${
                                    editCurrentPage ===
                                    page
                                      ? "active"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setEditCurrentPage(
                                      page
                                    )
                                  }
                                >
                                  {
                                    page
                                  }
                                </button>
                              )
                            )}

                          </div>

                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={
                              editCurrentPage ===
                              editTotalPages
                            }
                            onClick={() =>
                              setEditCurrentPage(
                                (
                                  prev
                                ) =>
                                  prev +
                                  1
                              )
                            }
                          >
                            Next

                            <ChevronRight
                              size={
                                16
                              }
                            />
                          </button>

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
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  className="qs-save-btn"
                  onClick={
                    handleSaveEdit
                  }
                  disabled={
                    saving
                  }
                >
                  <Save
                    size={17}
                  />

                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
};

export default QuestionSetsList;