import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  List,
  Search,
  Pencil,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { finalAssessmentApi } from "../../services/apiService";
import "./FinalAssessmentPractical.css";

const FinalAssessmentPractical = ({ onBack }) => {
  const navigate = useNavigate();

  // Mode: "form" or "list"
  const [viewMode, setViewMode] = useState("form");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // List state
  const [practicalList, setPracticalList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    TITLE: "",
    DESCRIPTION: "",
    BATCH_ID: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedForView, setSelectedForView] = useState(null);

  const isFetched = useRef(false);
  const LIST_ITEMS_PER_PAGE = 10;

  const getLoggedUser = () => {
    try {
      const storageKeys = ["ASA_LMSUser", "LMSUser", "user"];
      for (const key of storageKeys) {
        const sessionVal = sessionStorage.getItem(key);
        if (sessionVal) {
          const parsed = JSON.parse(sessionVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
        const localVal = localStorage.getItem(key);
        if (localVal) {
          const parsed = JSON.parse(localVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
      }
      return {};
    } catch (e) {
      console.error("Failed to read user:", e);
      return {};
    }
  };

  const user = getLoggedUser();
  const userId = user?.USER_ID || user?.ID || user?.TUTOR_ID || user?.id || 1;

  useEffect(() => {
    if (userId) {
      if (!isFetched.current) {
        isFetched.current = true;
        fetchTutorBatches();
        fetchPracticalList();
      }
    } else {
      setLoadingBatches(false);
      toast.error("Unable to identify logged-in tutor");
    }
  }, [userId]);

  const fetchTutorBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await finalAssessmentApi.getTutorBatches(userId);
      if (res.data?.status === 1) {
        const batchList = Array.isArray(res.data?.data) ? res.data.data : [];
        setBatches(batchList);
        if (batchList.length === 1) {
          setBatchId(String(batchList[0].BATCH_ID));
        }
      } else {
        setBatches([]);
      }
    } catch (err) {
      console.error("Error fetching tutor batches:", err);
      setBatches([]);
      toast.error("Failed to load your assigned batches");
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchPracticalList = async () => {
    try {
      setLoadingList(true);
      const res = await finalAssessmentApi.getPracticalByTutor(userId);
      if (res.data?.status === 1) {
        setPracticalList(res.data?.data || []);
      } else {
        setPracticalList([]);
      }
    } catch (err) {
      console.error("Error fetching practical list:", err);
      setPracticalList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/final-assessment");
    }
  };

  const handleClear = () => {
    setTitle("");
    setDescription("");
    setBatchId(batches.length === 1 ? String(batches[0].BATCH_ID) : "");
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      return toast.error("Please enter a Title");
    }

    if (cleanTitle.length > 255) {
      return toast.error("Title must be 255 characters or fewer");
    }

    if (!cleanDesc) {
      return toast.error("Please enter a Description");
    }

    if (!batchId) {
      return toast.error("Please select a Batch");
    }

    try {
      setSubmitting(true);

      const payload = {
        TITLE: cleanTitle,
        DESCRIPTION: cleanDesc,
        BATCH_ID: Number(batchId),
        CREATED_BY: Number(userId),
      };

      const res = await finalAssessmentApi.createPractical(payload);

      if (res.data?.status === 1) {
        toast.success("Practical final assessment created successfully");
        handleClear();
        fetchPracticalList();
        setViewMode("list");
      } else {
        toast.error(
          res.data?.message || "Failed to create practical final assessment"
        );
      }
    } catch (err) {
      console.error("Error creating practical final assessment:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to create practical final assessment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: "Delete Practical Assessment?",
      text: `Are you sure you want to delete "${item.TITLE}"?`,
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
      const res = await finalAssessmentApi.deletePractical(item.ID);
      if (res.data?.status === 1) {
        toast.success("Practical assessment deleted successfully");
        fetchPracticalList();
      } else {
        toast.error(res.data?.message || "Failed to delete");
      }
    } catch (e) {
      console.error("Delete error:", e);
      toast.error("Failed to delete assessment");
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      TITLE: item.TITLE || "",
      DESCRIPTION: item.DESCRIPTION || "",
      BATCH_ID: item.BATCH_ID || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.TITLE.trim()) {
      return toast.error("Title is required");
    }
    if (!editForm.DESCRIPTION.trim()) {
      return toast.error("Description is required");
    }
    if (!editForm.BATCH_ID) {
      return toast.error("Please select a batch");
    }

    try {
      setSavingEdit(true);
      const res = await finalAssessmentApi.updatePractical(editingItem.ID, {
        TITLE: editForm.TITLE.trim(),
        DESCRIPTION: editForm.DESCRIPTION.trim(),
        BATCH_ID: Number(editForm.BATCH_ID),
        UPDATED_BY: userId,
      });

      if (res.data?.status === 1) {
        toast.success("Practical final assessment updated successfully");
        setEditingItem(null);
        fetchPracticalList();
      } else {
        toast.error(res.data?.message || "Failed to update");
      }
    } catch (e) {
      console.error("Error updating:", e);
      toast.error("Failed to update practical assessment");
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered List Search
  const filteredPracticalList = useMemo(() => {
    if (!listSearch.trim()) return practicalList;
    const term = listSearch.toLowerCase();
    return practicalList.filter(
      (p) =>
        (p.TITLE || "").toLowerCase().includes(term) ||
        (p.DESCRIPTION || "").toLowerCase().includes(term) ||
        (p.BATCH_CODE || "").toLowerCase().includes(term)
    );
  }, [practicalList, listSearch]);

  const listTotalPages =
    Math.ceil(filteredPracticalList.length / LIST_ITEMS_PER_PAGE) || 1;

  const paginatedPracticalList = useMemo(() => {
    const start = (listCurrentPage - 1) * LIST_ITEMS_PER_PAGE;
    return filteredPracticalList.slice(start, start + LIST_ITEMS_PER_PAGE);
  }, [filteredPracticalList, listCurrentPage]);

  return (
    <div className="fa-practical-page">
      {/* =================================================
          EXISTING PAGE HEADER (PRESERVED UNCHANGED)
      ================================================= */}
      <div className="fa-practical-header">
        <div className="fa-practical-breadcrumb-group">
          <button
            type="button"
            className="fa-practical-back-btn"
            onClick={handleBack}
          >
            <ArrowLeft size={15} />
            <span>Back to Final Assessments</span>
          </button>

          <h1>
            {viewMode === "form"
              ? "Practical Final Assessment"
              : "Practical Final Assessments"}
          </h1>

          <p>
            {viewMode === "form"
              ? "Create and manage practical final assessments for students."
              : "Manage your created Practical Final Assessments."}
          </p>
        </div>

        <div>
          {viewMode === "form" ? (
            <button
              type="button"
              className="fa-practical-list-btn"
              onClick={() => setViewMode("list")}
            >
              <List size={17} />
              Practical List
            </button>
          ) : (
            <button
              type="button"
              className="fa-practical-list-btn"
              onClick={() => setViewMode("form")}
            >
              <Plus size={17} />
              Create Practical
            </button>
          )}
        </div>
      </div>

      {/* =================================================
          VIEW 1: FORM WITH CLEAN ORDER & HELPER DESCRIPTIONS
      ================================================= */}
      {viewMode === "form" && (
        <div className="fa-practical-center-wrapper">
          <form className="fa-practical-form-card" onSubmit={handleSubmit}>
            {/* FORM HEADER */}
            <div className="fa-practical-card-header">
              <h2>Create Practical Final Assessment</h2>
              <p>
                Create and manage practical final assessments for students.
              </p>
            </div>

            {/* TITLE */}
            <div className="fa-practical-field-group">
              <label className="fa-practical-label">
                Title <span>*</span>
              </label>
              <p className="fa-practical-field-hint">
                Add a clear title for the practical final assessment.
              </p>
              <input
                type="text"
                className="fa-practical-input"
                placeholder="Enter practical assessment title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                disabled={submitting}
              />
            </div>

            {/* DESCRIPTION */}
            <div className="fa-practical-field-group">
              <label className="fa-practical-label">
                Description <span>*</span>
              </label>
              <p className="fa-practical-field-hint">
                Add instructions and task objectives for students.
              </p>
              <textarea
                className="fa-practical-textarea"
                placeholder="Enter instructions, task objectives..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* BATCH SELECT */}
            <div className="fa-practical-field-group">
              <label className="fa-practical-label">
                Batch <span>*</span>
              </label>
              <p className="fa-practical-field-hint">
                Choose the batch for which you want to create the practical final assessment.
              </p>
              <select
                className="fa-practical-select"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={submitting || loadingBatches}
              >
                <option value="">
                  {loadingBatches
                    ? "Loading your hosted batches..."
                    : batches.length === 0
                    ? "No active hosted batches found"
                    : "Select Batch"}
                </option>
                {batches.map((b) => (
                  <option key={b.BATCH_ID} value={b.BATCH_ID}>
                    {b.BATCH_CODE}
                  </option>
                ))}
              </select>
              {batches.length === 0 && !loadingBatches && (
                <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                  Note: Only batches where your assigned role is HOST are
                  available.
                </span>
              )}
            </div>

            {/* FORM BUTTONS (CLEAR & SUBMIT) */}
            <div className="fa-practical-form-actions">
              <button
                type="button"
                className="fa-practical-clear-btn"
                onClick={handleClear}
                disabled={submitting}
              >
                Clear
              </button>
              <button
                type="submit"
                className="fa-practical-submit-btn"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================
          VIEW 2: PRACTICAL ASSESSMENT LIST
      ================================================= */}
      {viewMode === "list" && (
        <div style={{ marginTop: "10px" }}>
          {/* SEARCH BAR */}
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
                className="fa-practical-input"
                placeholder="Search practical assessments..."
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
                  top: "11px",
                }}
              />
            </div>
          </div>

          {/* LIST TABLE (#, TITLE, DESCRIPTION, BATCH, CREATED AT, ACTION) */}
          <div className="fa-practical-table-container">
            <table className="fa-practical-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>ID</th>
                  <th>TITLE</th>
                  <th>DESCRIPTION</th>
                  <th>BATCH</th>
                  <th>CREATED AT</th>
                  <th className="center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td
                      colSpan="6"
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "#94a3b8",
                      }}
                    >
                      Loading practical assessments...
                    </td>
                  </tr>
                ) : filteredPracticalList.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "#94a3b8",
                      }}
                    >
                      No Practical Final Assessments found.
                    </td>
                  </tr>
                ) : (
                  paginatedPracticalList.map((item, index) => {
                    return (
                      <tr key={item.ID}>
                        <td>
                          {(listCurrentPage - 1) * LIST_ITEMS_PER_PAGE +
                            index +
                            1}
                        </td>
                        <td>
                          <strong style={{ color: "#f8fafc" }}>
                            {item.TITLE}
                          </strong>
                        </td>
                        <td
                          style={{
                            maxWidth: "280px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.DESCRIPTION || "-"}
                        </td>
                        <td>
                          <span style={{ color: "#cbd5e1" }}>
                            {item.BATCH_CODE ||
                              "All Batches"}
                          </span>
                        </td>
                        <td style={{ color: "#94a3b8", fontSize: "12px" }}>
                          {item.CREATED_AT
                            ? new Date(item.CREATED_AT).toLocaleDateString()
                            : "-"}
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
                              className="fa-practical-eye-btn"
                              onClick={() => setSelectedForView(item)}
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="fa-practical-eye-btn"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="fa-practical-eye-btn"
                              onClick={() => handleDelete(item)}
                              title="Delete"
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

              {/* PAGINATION */}
              {listTotalPages > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan="6">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: "#090f18",
                        }}
                      >
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                          Page <strong>{listCurrentPage}</strong> of{" "}
                          <strong>{listTotalPages}</strong>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="fa-practical-clear-btn"
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            disabled={listCurrentPage === 1}
                            onClick={() =>
                              setListCurrentPage((p) => Math.max(1, p - 1))
                            }
                          >
                            <ChevronLeft size={16} /> Previous
                          </button>
                          <button
                            type="button"
                            className="fa-practical-clear-btn"
                            style={{ padding: "6px 12px", fontSize: "12px" }}
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
          VIEW DETAILS MODAL
      ================================================= */}
      {selectedForView && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedForView(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0b1222",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#00e5ff",
                    letterSpacing: "1px",
                  }}
                >
                  PRACTICAL FINAL ASSESSMENT
                </span>
                <h3
                  style={{
                    margin: "4px 0 0",
                    color: "#fff",
                    fontSize: "16px",
                  }}
                >
                  {selectedForView.TITLE}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForView(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "20px",
                color: "#cbd5e1",
                fontSize: "14px",
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#94a3b8" }}>Batch: </strong>
                <span>
                  {selectedForView.BATCH_CODE}
                </span>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong style={{ color: "#94a3b8" }}>Description:</strong>
              </div>
              <div
                style={{
                  background: "#090e1a",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedForView.DESCRIPTION || "No description provided."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          EDIT MODAL
      ================================================= */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0b1222",
              }}
            >
              <h3 style={{ margin: 0, color: "#fff", fontSize: "16px" }}>
                Edit Practical Final Assessment
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div className="fa-practical-field-group">
                <label className="fa-practical-label">
                  Title <span>*</span>
                </label>
                <input
                  type="text"
                  className="fa-practical-input"
                  value={editForm.TITLE}
                  onChange={(e) =>
                    setEditForm({ ...editForm, TITLE: e.target.value })
                  }
                  maxLength={255}
                />
              </div>

              <div className="fa-practical-field-group">
                <label className="fa-practical-label">
                  Description <span>*</span>
                </label>
                <textarea
                  className="fa-practical-textarea"
                  value={editForm.DESCRIPTION}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      DESCRIPTION: e.target.value,
                    })
                  }
                />
              </div>

              <div className="fa-practical-field-group">
                <label className="fa-practical-label">
                  Batch <span>*</span>
                </label>
                <select
                  className="fa-practical-select"
                  value={editForm.BATCH_ID}
                  onChange={(e) =>
                    setEditForm({ ...editForm, BATCH_ID: e.target.value })
                  }
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b.BATCH_ID} value={b.BATCH_ID}>
                      {b.BATCH_CODE}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  className="fa-practical-clear-btn"
                  onClick={() => setEditingItem(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fa-practical-submit-btn"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalAssessmentPractical;
