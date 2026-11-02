import React, { useEffect, useState } from "react";
import { Search, Pencil, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { questionsApi } from "../../services/apiService";
import { normalizeCKEditorImages } from "../../utils/imageUtils";
import "./QuestionList.css";

const QuestionList = () => {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
      sessionStorage.getItem("SmartExamUser") ||
      localStorage.getItem("user") ||
      "{}"
  );

  // =====================================================
  // FETCH QUESTIONS
  // =====================================================

  const fetchQuestions = async () => {
    try {
      setLoading(true);

      const SCHOOL_ID =
        userData?.USER_TYPE === "ADMIN"
          ? 0
          : userData?.SCHOOL_ID || 1;

      const res = await questionsApi.getQuestions({
        page,
        limit,
        search,
        SCHOOL_ID,
        BOOK_ID: 0,
        CHAPTER: "",
        QUESTION_TYPE: "",
      });

      if (res?.data?.status === 1) {
        setQuestions(res.data.data || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setQuestions([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error("Fetch questions error:", error);
      toast.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOAD QUESTIONS
  // =====================================================

  useEffect(() => {
    fetchQuestions();
  }, [page, search]);

  // =====================================================
  // SEARCH
  // =====================================================

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // =====================================================
  // EDIT
  // =====================================================

  const handleEdit = (question) => {
    navigate("/question-bank", {
      state: {
        editQuestion: question,
      },
    });
  };

  // =====================================================
  // STATUS CHANGE
  // =====================================================

  const handleStatusChange = async (question) => {
    const newStatus =
      Number(question.IS_ACTIVE) === 1 ? 0 : 1;

    const result = await Swal.fire({
      title:
        newStatus === 1
          ? "Activate question?"
          : "Deactivate question?",

      text:
        newStatus === 1
          ? "This question will become active."
          : "This question will become inactive.",

      icon: "warning",

      showCancelButton: true,

      confirmButtonText:
        newStatus === 1
          ? "Yes, activate"
          : "Yes, deactivate",

      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res =
        await questionsApi.updateQuestionStatus({
          ID: question.ID,
          IS_ACTIVE: newStatus,
        });

      if (res?.data?.status === 1) {
        toast.success(
          res.data.message ||
            "Status updated successfully"
        );

        setQuestions((prev) =>
          prev.map((item) =>
            item.ID === question.ID
              ? {
                  ...item,
                  IS_ACTIVE: newStatus,
                }
              : item
          )
        );
      } else {
        toast.error(
          res?.data?.message ||
            "Failed to update status"
        );
      }
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      toast.error(
        "Failed to update question status"
      );
    }
  };

  return (
    <div className="question-list-container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="question-list-header">

        <div>

          <span className="question-list-breadcrumb">
            OVERSIGHT / QUESTION LIST
          </span>

          <h1>Question List</h1>

          <p>
            Manage, edit and activate or deactivate
            assessment questions.
          </p>

        </div>

        <button
          type="button"
          className="question-create-btn"
          onClick={() =>
            navigate("/question-bank")
          }
        >
          <Plus size={17} />
          Create Question
        </button>

      </div>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="question-list-toolbar">

        <div className="question-search">

          <Search size={18} />

          <input
            type="text"
            placeholder="Search question, category, module or answer..."
            value={search}
            onChange={handleSearch}
          />

        </div>

        <div className="question-total">
          {total} questions
        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="question-table-container">

        <table className="question-table">

          <thead>

            <tr>

              <th>ID</th>

              <th>CATEGORY</th>

              <th>QUESTION</th>

              <th>TYPE</th>

              <th>MARK</th>

              <th>MODULE</th>

              <th className="action-column">
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
                  Loading questions...
                </td>

              </tr>

            ) : questions.length === 0 ? (

              /* NO QUESTIONS */

              <tr>

                <td
                  colSpan="7"
                  className="table-message"
                >
                  No questions found
                </td>

              </tr>

            ) : (

              questions.map(
                (question, index) => {

                  /*
                   * NORMAL SERIAL NUMBER
                   *
                   * Page 1:
                   * 1 - 10
                   *
                   * Page 2:
                   * 11 - 20
                   *
                   * Page 3:
                   * 21 - 30
                   */

                  const serialNumber =
                    (page - 1) * limit +
                    index +
                    1;

                  return (

                    <tr
                      key={question.ID}
                    >

                      {/* SERIAL NUMBER */}

                      <td>
                        {serialNumber}
                      </td>

                      {/* MODULE */}

                      <td>
                        {question.MODULE_NAME || "-"}
                      </td>

                      {/* QUESTION */}

                      <td className="question-preview">

                        <div
                          dangerouslySetInnerHTML={{
                            __html: normalizeCKEditorImages(
                              question.QUESTION_TEXT ||
                              question.QUESTION ||
                              "-"
                            ),
                          }}
                        />

                      </td>

                      {/* QUESTION TYPE */}

                      <td>

                        <span className="type-pill">
                          {question.QUESTION_TYPE ||
                            "-"}
                        </span>

                      </td>

                      {/* MARK */}

                      <td>
                        {question.MARK || "-"}
                      </td>

                      {/* DIFFICULTY */}

                      <td>
                        {question.DIFFICULTY_LEVEL ||
                          "-"}
                      </td>

                      {/* ACTION */}

                      <td className="action-column">

                        <div className="question-action-buttons">

                          {/* EDIT */}

                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() =>
                              handleEdit(question)
                            }
                            title="Edit Question"
                          >
                            <Pencil size={17} />
                          </button>

                          {/* STATUS */}

                          <button
                            type="button"
                            className={`status-switch ${
                              Number(
                                question.IS_ACTIVE
                              ) === 1
                                ? "on"
                                : "off"
                            }`}
                            onClick={() =>
                              handleStatusChange(
                                question
                              )
                            }
                            title={
                              Number(
                                question.IS_ACTIVE
                              ) === 1
                                ? "Deactivate Question"
                                : "Activate Question"
                            }
                            aria-label={
                              Number(
                                question.IS_ACTIVE
                              ) === 1
                                ? "Deactivate Question"
                                : "Activate Question"
                            }
                          >

                            <span className="status-switch-knob"></span>

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
          PAGINATION
      ================================================= */}

      {totalPages > 1 && (

        <div className="question-pagination">

          {/* PAGE INFO */}

          <div className="pagination-info">

            Showing page{" "}
            <strong>{page}</strong>{" "}
            of{" "}
            <strong>{totalPages}</strong>

          </div>

          {/* PAGINATION BUTTONS */}

          <div className="pagination-buttons">

            <button
              type="button"
              disabled={
                page === 1 || loading
              }
              onClick={() =>
                setPage(
                  (prev) => prev - 1
                )
              }
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                page === totalPages ||
                loading
              }
              onClick={() =>
                setPage(
                  (prev) => prev + 1
                )
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

export default QuestionList;