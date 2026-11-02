import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Eye,
  List,
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
import "./QuestionSets.css";

const QuestionSets = () => {
  const navigate = useNavigate();

  const [templateName, setTemplateName] = useState("");
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  const [moduleOptions, setModuleOptions] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const isFetched = useRef(false);

  const [selectionModuleId, setSelectionModuleId] =
    useState(null);

  const QUESTIONS_PER_PAGE = 10;

  // =====================================================
  // USER DATA
  // =====================================================

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
    sessionStorage.getItem("SmartExamUser") ||
    localStorage.getItem("user") ||
    "{}"
  );

  // =====================================================
  // FETCH DATA
  // =====================================================

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchQuestions();
      fetchModules();
    }
  }, []);

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
        toast.error(
          res.data.message || "Failed to fetch questions"
        );
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
        toast.error(
          res.data.message || "Failed to load modules"
        );
      }
    } catch (error) {
      console.error("Fetch modules error:", error);
      toast.error("Failed to load modules");
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
    /*
     * IMPORTANT:
     *
     * Do NOT clear selectedQuestions here.
     *
     * The user may only be changing the filter.
     *
     * Previous selected questions will be cleared ONLY
     * when the user actually selects a question from
     * another module.
     */

    setSelectedModule(newModule);

    /*
     * Difficulty belongs to the current filter.
     *
     * Reset difficulty when changing module so the
     * new module starts with "All".
     *
     * This DOES NOT affect selected questions.
     */
    setSelectedDifficulty(null);

    setCurrentPage(1);
  };

  // =====================================================
  // DIFFICULTY CHANGE
  // =====================================================

  const handleDifficultyChange = (newDifficulty) => {
    /*
     * Difficulty is only a filter.
     *
     * NEVER clear selected questions here.
     */

    setSelectedDifficulty(newDifficulty);
    setCurrentPage(1);
  };

  // =====================================================
  // FILTER QUESTIONS
  // =====================================================

  const filteredQuestions = useMemo(() => {
    if (!selectedModule) {
      return [];
    }

    let filtered = questions.filter(
      (q) =>
        Number(q.MODULE_ID) ===
        Number(selectedModule.value)
    );

    if (selectedDifficulty) {
      filtered = filtered.filter(
        (q) =>
          String(
            q.DIFFICULTY_LEVEL || ""
          ).toUpperCase() ===
          selectedDifficulty.value
      );
    }

    return filtered;
  }, [
    questions,
    selectedModule,
    selectedDifficulty,
  ]);

  // =====================================================
  // PAGINATION
  // =====================================================

  const totalPages = Math.ceil(
    filteredQuestions.length / QUESTIONS_PER_PAGE
  );

  useEffect(() => {
    if (
      totalPages > 0 &&
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }

    if (
      totalPages === 0 &&
      currentPage !== 1
    ) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedQuestions = useMemo(() => {
    const start =
      (currentPage - 1) *
      QUESTIONS_PER_PAGE;

    return filteredQuestions.slice(
      start,
      start + QUESTIONS_PER_PAGE
    );
  }, [
    filteredQuestions,
    currentPage,
  ]);

  // =====================================================
  // SELECT ALL
  // =====================================================

  const allSelected =
    paginatedQuestions.length > 0 &&
    paginatedQuestions.every((q) =>
      selectedQuestions.includes(
        Number(q.ID)
      )
    );

  const toggleSelectAll = () => {
    if (!selectedModule) {
      return;
    }

    const currentModuleId =
      Number(selectedModule.value);

    const ids = paginatedQuestions.map((q) =>
      Number(q.ID)
    );

    // ===================================================
    // UNSELECT ALL
    // ===================================================

    if (allSelected) {
      setSelectedQuestions((prev) =>
        prev.filter(
          (id) => !ids.includes(id)
        )
      );

      /*
       * If all selected questions of the current module
       * have now been removed, reset selectionModuleId.
       */
      if (
        selectionModuleId ===
        currentModuleId
      ) {
        setSelectionModuleId(null);
      }

      return;
    }

    // ===================================================
    // SELECT ALL FROM ANOTHER MODULE
    // ===================================================

    /*
     * If questions were already selected from another
     * module and the user now selects questions from
     * this module, clear the old module's selections.
     */
    if (
      selectedQuestions.length > 0 &&
      selectionModuleId !== null &&
      selectionModuleId !== currentModuleId
    ) {
      setSelectedQuestions(ids);
      setSelectionModuleId(
        currentModuleId
      );

      return;
    }

    // ===================================================
    // SELECT ALL IN SAME MODULE
    // ===================================================

    setSelectedQuestions((prev) => [
      ...new Set([
        ...prev,
        ...ids,
      ]),
    ]);

    setSelectionModuleId(
      currentModuleId
    );
  };

  // =====================================================
  // SELECT QUESTION
  // =====================================================

  const toggleQuestion = (id) => {
    if (!selectedModule) {
      return;
    }

    const qid = Number(id);

    const currentModuleId =
      Number(selectedModule.value);

    const isAlreadySelected =
      selectedQuestions.includes(qid);

    // ===================================================
    // UNSELECT QUESTION
    // ===================================================

    if (isAlreadySelected) {
      const updatedQuestions =
        selectedQuestions.filter(
          (x) => x !== qid
        );

      setSelectedQuestions(
        updatedQuestions
      );

      /*
       * If there are no selected questions left,
       * reset the selection module.
       */
      if (
        updatedQuestions.length === 0
      ) {
        setSelectionModuleId(null);
      }

      return;
    }

    // ===================================================
    // SELECT QUESTION FROM ANOTHER MODULE
    // ===================================================

    /*
     * IMPORTANT:
     *
     * The Module Select itself does NOT clear anything.
     *
     * Only when the user actually clicks a question
     * from another module, clear the previous selection.
     */

    if (
      selectedQuestions.length > 0 &&
      selectionModuleId !== null &&
      selectionModuleId !== currentModuleId
    ) {
      setSelectedQuestions([qid]);
      setSelectionModuleId(
        currentModuleId
      );

      return;
    }

    // ===================================================
    // SELECT QUESTION
    // ===================================================

    setSelectedQuestions((prev) => [
      ...prev,
      qid,
    ]);

    setSelectionModuleId(
      currentModuleId
    );
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

    return words.length <= 3
      ? text
      : `${words
        .slice(0, 3)
        .join(" ")}...`;
  };

  // =====================================================
  // CLEAR FORM
  // =====================================================

  const clearForm = () => {
    setTemplateName("");
    setSelectedModule(null);
    setSelectedDifficulty(null);
    setSelectedQuestions([]);
    setSelectionModuleId(null);
    setCurrentPage(1);
    setPreviewQuestion(null);
  };

  // =====================================================
  // SUBMIT TEMPLATE
  // =====================================================

  const submitTemplate = async () => {
    if (!templateName.trim()) {
      return toast.error(
        "Enter Question Set name"
      );
    }

    if (!selectedModule) {
      return toast.error(
        "Please select a Module"
      );
    }

    if (selectedQuestions.length === 0) {
      return toast.error(
        "Select at least one question"
      );
    }

    try {
      const res =
        await templateApi.create({
          TEMPLATE_NAME:
            templateName.trim(),

          MODULE_ID:
            selectedModule.value,

          DIFFICULTY_LEVEL:
            selectedDifficulty?.value || null,

          SET_TYPE:
            "ASSESSMENT",

          QUESTION_IDS:
            JSON.stringify(
              selectedQuestions
            ),

          CREATED_BY:
            userData.USER_ID || 1,
        });

      if (res.data.status === 1) {
        toast.success(
          "Question Set created successfully"
        );

        clearForm();
      } else {
        toast.error(
          res.data.message ||
          "Failed to create Question Set"
        );
      }
    } catch (error) {
      console.error(
        "Create question set error:",
        error
      );

      toast.error(
        "Failed to create Question Set"
      );
    }
  };

  // =====================================================
  // SELECT STYLES
  // =====================================================

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      height: 40,
      background: "#111827",
      borderColor: state.isFocused
        ? "#00e5ff"
        : "#334155",
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
      background: state.isFocused
        ? "#1e293b"
        : "#111827",
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

  // =====================================================
  // JSX
  // =====================================================

  return (
    <div className="template-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="template-header">

        <div>

          <span className="template-breadcrumb">
            OVERSIGHT / QUESTION SETS
          </span>

          <h1>Question Sets</h1>

          <p>
            Create Question Sets by selecting
            multiple questions.
          </p>

        </div>

        <button
          type="button"
          className="template-list-btn"
          onClick={() =>
            navigate(
              "/question-sets-list"
            )
          }
        >
          <List size={17} />
          Question Sets List
        </button>

      </div>

      {/* =================================================
          QUESTION SET NAME
      ================================================= */}

      <div className="template-card">

        <label className="template-label">
          Question Set Name{" "}
          <span>*</span>
        </label>

        <input
          type="text"
          className="template-name-input"
          placeholder="Enter Question Set name"
          value={templateName}
          onChange={(e) =>
            setTemplateName(
              e.target.value
            )
          }
        />

      </div>

      {/* =================================================
          FILTERS
      ================================================= */}

      <div className="filter-row">

        {/* MODULE */}

        <div className="filter-item">

          <label className="template-label">
            Module <span>*</span>
          </label>

          <Select
            options={moduleOptions}
            value={selectedModule}
            onChange={
              handleModuleChange
            }
            placeholder="Select Module"
            styles={selectStyles}
            isClearable
          />

        </div>

        {/* DIFFICULTY */}

        <div className="filter-item">

          <label className="template-label">
            Difficulty
          </label>

          <Select
            options={difficultyOptions}
            value={
              selectedDifficulty
            }
            onChange={
              handleDifficultyChange
            }
            placeholder="All"
            styles={selectStyles}
            isClearable
          />

        </div>

      </div>

      {/* =================================================
          QUESTION TABLE
      ================================================= */}

      <div className="template-table-container">

        <table className="template-table">

          <thead>

            <tr>

              <th className="center">

                <input
                  type="checkbox"
                  checked={
                    allSelected
                  }
                  onChange={
                    toggleSelectAll
                  }
                />

              </th>

              <th>ID</th>

              <th className="question-header-cell">
                <div className="question-header-content">
                  <span className="question-header-title">
                    QUESTIONS
                  </span>
                  {selectedQuestions.length > 0 && (
                    <span className="question-count">
                      {selectedQuestions.length}
                    </span>
                  )}
                </div>
              </th>

              <th>
                QUESTION TYPE
              </th>

              <th>
                DIFFICULTY
              </th>

              <th>
                MARK
              </th>

              <th className="center">
                ACTION
              </th>

            </tr>

          </thead>

          <tbody>

            {/* LOADING */}

            {loading ? (

              <tr>

                <td
                  colSpan="7"
                  className="table-message"
                >
                  Loading...
                </td>

              </tr>

            ) : !selectedModule ? (

              <tr>

                <td
                  colSpan="7"
                  className="table-message"
                >
                  Please select a Module
                  to view questions.
                </td>

              </tr>

            ) : paginatedQuestions.length ===
              0 ? (

              <tr>

                <td
                  colSpan="7"
                  className="table-message"
                >
                  No questions found.
                </td>

              </tr>

            ) : (

              paginatedQuestions.map(
                (q, index) => (

                  <tr key={q.ID}>

                    <td className="center">

                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(
                          Number(q.ID)
                        )}
                        onChange={() =>
                          toggleQuestion(
                            q.ID
                          )
                        }
                      />

                    </td>

                    <td>

                      {(currentPage -
                        1) *
                        QUESTIONS_PER_PAGE +
                        index +
                        1}

                    </td>

                    <td>

                      {shortQuestion(
                        q.QUESTION
                      )}

                    </td>

                    <td>

                      <span className="type-pill">
                        {
                          q.QUESTION_TYPE
                        }
                      </span>

                    </td>

                    <td>
                      {
                        q.DIFFICULTY_LEVEL
                      }
                    </td>

                    <td>
                      {q.MARK}
                    </td>

                    <td className="center">

                      <button
                        type="button"
                        className="eye-btn"
                        onClick={() =>
                          setPreviewQuestion(
                            q
                          )
                        }
                      >
                        <Eye size={17} />
                      </button>

                    </td>

                  </tr>

                )
              )

            )}

          </tbody>

          {/* =================================================
              PAGINATION
          ================================================= */}

          {totalPages > 1 && (

            <tfoot>

              <tr>

                <td colSpan="7">

                  <div className="table-pagination">

                    <div className="pagination-info">

                      Page{" "}

                      <strong>
                        {currentPage}
                      </strong>{" "}

                      of{" "}

                      <strong>
                        {totalPages}
                      </strong>

                    </div>

                    <div className="pagination-buttons">

                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={
                          currentPage ===
                          1
                        }
                        onClick={() =>
                          setCurrentPage(
                            (p) =>
                              p - 1
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
                          (
                            _,
                            index
                          ) => {

                            const page =
                              index +
                              1;

                            return (

                              <button
                                type="button"
                                key={
                                  page
                                }
                                className={`pagination-number ${currentPage ===
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
                                {
                                  page
                                }
                              </button>

                            );

                          }
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
                            (p) =>
                              p + 1
                          )
                        }
                      >

                        Next

                        <ChevronRight
                          size={16}
                        />

                      </button>

                    </div>

                  </div>

                </td>

              </tr>

            </tfoot>

          )}

        </table>

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

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

      {/* =================================================
          PREVIEW MODAL
      ================================================= */}

      {previewQuestion && (

        <div
          className="preview-overlay"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              setPreviewQuestion(
                null
              );
            }

          }}
        >

          <div className="preview-box">

            <div className="preview-header">

              <div>

                <span className="preview-label">
                  QUESTION PREVIEW
                </span>

                <h3>
                  Question Preview
                </h3>

              </div>

              <button
                type="button"
                onClick={() =>
                  setPreviewQuestion(
                    null
                  )
                }
              >
                ✕
              </button>

            </div>

            <div
              className="preview-content"
              dangerouslySetInnerHTML={{
                __html: normalizeCKEditorImages(previewQuestion.QUESTION || ""), 
              }}
            />

          </div>

        </div>

      )}

    </div>
  );
};

export default QuestionSets;