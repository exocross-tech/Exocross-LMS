import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { moduleApi } from "../../services/apiService";
import "./Module.css";

const Module = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const isFetched = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [editModule, setEditModule] = useState(null);
  const [editName, setEditName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const MODULES_PER_PAGE = 10;

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
    localStorage.getItem("ASA_LMSUser") ||
    "{}"
  );

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchModules();
    }
  }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);

      const res = await moduleApi.getAll();

      if (res.data.status === 1) {
        setModules(res.data.data || []);
      } else {
        toast.error(
          res.data.message || "Failed to load modules"
        );
      }
    } catch (err) {
      console.error("Fetch modules error:", err);

      toast.error("Failed to load modules");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(
    modules.length / MODULES_PER_PAGE
  );

  const paginatedModules = useMemo(() => {
    const startIndex =
      (currentPage - 1) * MODULES_PER_PAGE;

    return modules.slice(
      startIndex,
      startIndex + MODULES_PER_PAGE
    );
  }, [modules, currentPage]);

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

  const handleCreate = async () => {
    if (!moduleName.trim()) {
      toast.error("Module name is required");
      return;
    }

    try {
      const res = await moduleApi.create({
        MODULE_NAME: moduleName.trim(),
        CREATED_BY: userData.USER_ID || 1,
      });

      if (res.data.status === 1) {
        toast.success(
          "Module created successfully"
        );

        setModuleName("");
        setShowModal(false);

        // Refresh modules
        fetchModules();

        // Go to first page
        setCurrentPage(1);
      } else {
        toast.error(
          res.data.message ||
          "Failed to create module"
        );
      }
    } catch (err) {
      console.error(
        "Create module error:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
        "Failed to create module"
      );
    }
  };

  const handleToggle = async (item) => {
    const nextStatus = item.IS_ACTIVE ? 0 : 1;

    const result = await Swal.fire({
      title: nextStatus
        ? "Activate Module?"
        : "Deactivate Module?",

      text: `Do you want to ${nextStatus
        ? "activate"
        : "deactivate"
        } "${item.MODULE_NAME}"?`,

      icon: "question",

      background: "#0f172a",
      color: "#fff",

      confirmButtonColor: "#06b6d4",
      cancelButtonColor: "#64748b",

      showCancelButton: true,

      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const res =
        await moduleApi.updateStatus({
          ID: item.ID,
          IS_ACTIVE: nextStatus,
          UPDATED_BY:
            userData.USER_ID || 1,
        });

      if (res.data.status === 1) {
        toast.success(
          res.data.message ||
          "Module status updated"
        );

        fetchModules();
      } else {
        toast.error(
          res.data.message ||
          "Failed to update status"
        );
      }
    } catch (err) {
      console.error(
        "Update module status error:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
        "Failed to update status"
      );
    }
  };

  const openEdit = (item) => {
    setEditModule(item);
    setEditName(item.MODULE_NAME);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
  if (!editName.trim()) {
    toast.error("Module name is required");
    return;
  }

  try {
    const res = await moduleApi.update(editModule.ID, {
      ID: editModule.ID,
      MODULE_NAME: editName.trim(),
      UPDATED_BY: userData.USER_ID || 1,
    });

    if (res.data.status === 1) {
      toast.success(res.data.message);

      setShowEditModal(false);
      setEditModule(null);
      setEditName("");

      fetchModules(); // reload updated data from DB
    } else {
      toast.error(res.data.message || "Failed to update module");
    }
  } catch (err) {
    console.error("Update module error:", err);
    toast.error(
      err?.response?.data?.message || "Failed to update module"
    );
  }
};

  const handleDeleteModule = async (item) => {
    const result = await Swal.fire({
      title: "Delete Module?",
      text: `Are you sure you want to delete "${item.MODULE_NAME}"? Once deleted cannot be recovered again!`,
      icon: "warning",
      background: "#0f172a",
      color: "#fff",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const res = await moduleApi.delete(item.ID);
      if (res.data.status === 1) {
        toast.success(res.data.message || "Module deleted successfully");
        fetchModules();
      } else {
        toast.error(res.data.message || "Failed to delete module");
      }
    } catch (err) {
      console.error("Delete module error:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete module"
      );
    }
  };

  const closeAddModal = () => {
    setShowModal(false);
    setModuleName("");
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditModule(null);
    setEditName("");
  };

  return (
    <div className="module-page">
      <div className="module-header">

        <div>
          <span className="module-label">
            OVERSIGHT / MODULES
          </span>

          <h1>Modules</h1>

          <p>
            Manage your modules.
          </p>
        </div>

        <button
          type="button"
          className="add-module-btn"
          onClick={() =>
            setShowModal(true)
          }
        >
          <Plus size={17} />

          Add Module
        </button>

      </div>
      <div className="module-table-card">
        <table className="module-table">
          <thead>
            <tr>
              <th>
                ID
              </th>
              <th>
                MODULE NAME
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
                  colSpan="3"
                  className="table-message"
                >
                  Loading...
                </td>
              </tr>

            ) : modules.length === 0 ? (
              <tr>
                <td
                  colSpan="3"
                  className="table-message"
                >
                  No modules found
                </td>
              </tr>
            ) : (


              paginatedModules.map(
                (item, index) => {

                  const serialNumber =
                    (currentPage - 1) *
                    MODULES_PER_PAGE +
                    index +
                    1;

                  return (
                    <tr
                      key={item.ID}
                    >

                      {/* ID */}

                      <td>
                        {serialNumber}
                      </td>

                      {/* MODULE NAME */}

                      <td className="module-name">
                        {item.MODULE_NAME}
                      </td>

                      {/* ACTION */}

                      <td className="center">

                        <div className="action-buttons">

                          {/* EDIT */}

                          <button
                            type="button"
                            className="edit-btn"
                            title="Edit Module"
                            onClick={() =>
                              openEdit(item)
                            }
                          >
                            <Pencil
                              size={16}
                            />
                          </button>

                          {/* DELETE */}

                          <button
                            type="button"
                            className="delete-module-btn"
                            title="Delete Module"
                            onClick={() =>
                              handleDeleteModule(item)
                            }
                          >
                            <Trash2
                              size={16}
                            />
                          </button>

                          {/* STATUS */}

                          <button
                            type="button"
                            className={`status-switch ${item.IS_ACTIVE
                              ? "on"
                              : "off"
                              }`}
                            title={
                              item.IS_ACTIVE
                                ? "Deactivate"
                                : "Activate"
                            }
                            onClick={() =>
                              handleToggle(
                                item
                              )
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

          {/* =====================================================
              PAGINATION
          ===================================================== */}

          {!loading &&
            modules.length > 0 &&
            totalPages > 1 && (

              <tfoot>

                <tr>

                  <td colSpan="3">

                    <div className="module-table-pagination">

                      {/* =========================
                          PAGINATION INFO
                      ========================= */}

                      <div className="module-pagination-info">

                        Showing page{" "}

                        <strong>
                          {currentPage}
                        </strong>

                        {" "}of{" "}

                        <strong>
                          {totalPages}
                        </strong>

                      </div>

                      {/* =========================
                          PAGINATION BUTTONS
                      ========================= */}

                      <div className="module-pagination-buttons">

                        {/* PREVIOUS */}

                        <button
                          type="button"
                          className="module-pagination-btn"
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

                        {/* PAGE NUMBERS */}

                        <div className="module-pagination-pages">

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
                                className={`module-pagination-number ${currentPage ===
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

                        {/* NEXT */}

                        <button
                          type="button"
                          className="module-pagination-btn"
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

                    </div>

                  </td>

                </tr>

              </tfoot>

            )}

        </table>

      </div>

      {/* =====================================================
          ADD MODULE MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="module-modal-overlay"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeAddModal();
            }

          }}
        >

          <div className="module-modal">

            {/* HEADER */}

            <div className="modal-header">

              <h3>
                Add Module
              </h3>

              <button
                type="button"
                onClick={closeAddModal}
              >
                <X size={18} />
              </button>

            </div>

            {/* BODY */}

            <div className="modal-body">

              <label>
                Module Name *
              </label>

              <input
                type="text"
                placeholder="Enter module name"
                value={moduleName}
                onChange={(e) =>
                  setModuleName(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    handleCreate();
                  }
                }}
              />

            </div>

            {/* FOOTER */}

            <div className="modal-footer">

              <button
                type="button"
                className="cancel-btn"
                onClick={closeAddModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="submit-btn"
                onClick={handleCreate}
              >
                <Save size={15} />

                Submit
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          EDIT MODULE MODAL
      ===================================================== */}

      {showEditModal && (

        <div
          className="module-modal-overlay"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeEditModal();
            }

          }}
        >

          <div className="module-modal">

            {/* HEADER */}

            <div className="modal-header">

              <h3>
                Edit Module
              </h3>

              <button
                type="button"
                onClick={
                  closeEditModal
                }
              >
                <X size={18} />
              </button>

            </div>

            {/* BODY */}

            <div className="modal-body">

              <label>
                Module Name *
              </label>

              <input
                type="text"
                value={editName}
                onChange={(e) =>
                  setEditName(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    handleEditSave();
                  }
                }}
              />

            </div>

            {/* FOOTER */}

            <div className="modal-footer">

              <button
                type="button"
                className="cancel-btn"
                onClick={
                  closeEditModal
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="submit-btn"
                onClick={
                  handleEditSave
                }
              >
                <Save size={15} />

                Save
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

export default Module;