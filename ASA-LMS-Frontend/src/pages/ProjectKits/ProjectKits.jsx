import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { projectKitsApi } from "../../services/apiService";
import "./ProjectKits.css";

const ITEMS_PER_PAGE = 8;

const ProjectKits = () => {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Form Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKit, setEditingKit] = useState(null);
  const [kitName, setKitName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    kit: null,
  });
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const isFetched = useRef(false);

  const getStoredUser = () => {
    try {
      const stored =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  const fetchProjectKits = async () => {
    try {
      setLoading(true);
      const res = await projectKitsApi.getAll();
      if (res?.data?.status === 1 && Array.isArray(res.data.data)) {
        setKits(res.data.data);
      } else {
        setKits([]);
      }
    } catch (err) {
      console.error("Failed to load project kits:", err);
      toast.error(err?.response?.data?.message || "Failed to load project kits");
      setKits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchProjectKits();
    }
  }, []);

  // Filtered & Paginated list
  const filteredKits = useMemo(() => {
    if (!searchTerm.trim()) return kits;
    const term = searchTerm.toLowerCase();
    return kits.filter((k) =>
      String(k.KIT_NAME || "").toLowerCase().includes(term)
    );
  }, [kits, searchTerm]);

  const totalPages = Math.ceil(filteredKits.length / ITEMS_PER_PAGE) || 1;

  const paginatedKits = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredKits.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredKits, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Construct absolute URL for image preview in modal
  const getFullImageUrl = (imagePath) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      window.location.origin ||
      "";
    const cleanBase = baseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    const cleanPath = imagePath.replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingKit(null);
    setKitName("");
    setSelectedFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (kit) => {
    setIsEditMode(true);
    setEditingKit(kit);
    setKitName(kit.KIT_NAME || "");
    setSelectedFile(null);
    setImagePreview(kit.IMAGE_URL ? getFullImageUrl(kit.IMAGE_URL) : null);
    setIsModalOpen(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingKit(null);
    setKitName("");
    setSelectedFile(null);
    setImagePreview(null);
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type (JPG, JPEG, PNG, WEBP)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Please upload an image file (JPG, JPEG, PNG, or WEBP)");
      return;
    }

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size should not exceed 10MB");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  // Remove previewed/selected file
  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle Submit (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kitName.trim()) {
      toast.error("Kit Name is required");
      return;
    }

    if (!isEditMode && !selectedFile) {
      toast.error("Image is required when creating a Project Kit");
      return;
    }

    try {
      setSubmitting(true);
      const user = getStoredUser();
      const userId = user?.USER_ID || user?.userId || user?.id || 1;

      const formData = new FormData();
      formData.append("kit_name", kitName.trim());
      formData.append("userId", userId);
      formData.append("createdBy", userId);
      formData.append("updatedBy", userId);

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      if (isEditMode && editingKit) {
        const res = await projectKitsApi.update(editingKit.ID, formData);
        if (res?.data?.status === 1) {
          toast.success(res.data.message || "Project Kit updated successfully");
          handleCloseModal();
          fetchProjectKits();
        } else {
          toast.error(res?.data?.message || "Failed to update Project Kit");
        }
      } else {
        const res = await projectKitsApi.create(formData);
        if (res?.data?.status === 1) {
          toast.success(res.data.message || "Project Kit created successfully");
          handleCloseModal();
          fetchProjectKits();
          setCurrentPage(1);
        } else {
          toast.error(res?.data?.message || "Failed to create Project Kit");
        }
      }
    } catch (err) {
      console.error("Submit project kit error:", err);
      toast.error(err?.response?.data?.message || "An error occurred while saving Project Kit");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (kit) => {
    setDeleteConfirm({
      open: true,
      kit,
    });
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirm.kit) return;
    try {
      setDeleting(true);
      const user = getStoredUser();
      const userId = user?.USER_ID || user?.userId || user?.id || 1;

      const res = await projectKitsApi.delete(deleteConfirm.kit.ID, { userId });
      if (res?.data?.status === 1) {
        toast.success(res.data.message || "Project Kit deleted successfully");
        setDeleteConfirm({ open: false, kit: null });
        fetchProjectKits();
      } else {
        toast.error(res?.data?.message || "Failed to delete Project Kit");
      }
    } catch (err) {
      console.error("Delete project kit error:", err);
      toast.error(err?.response?.data?.message || "Failed to delete Project Kit");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pk-page">
      {/* 1. Page Header */}
      <div className="pk-header">
        <div className="pk-title-area">
          <div className="pk-breadcrumb">
            <Package size={14} />
            OPERATIONS / PROJECT KITS
          </div>
          <h1>Project Kits</h1>
          <p>Manage your project kits.</p>
        </div>

        <button
          type="button"
          className="btn-create-kit"
          onClick={handleOpenCreateModal}
        >
          <Plus size={18} />
          <span>Create Project Kit</span>
        </button>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="pk-filter-bar">
        <div className="pk-search-box">
          <Search size={18} color="#64748b" />
          <input
            type="text"
            className="pk-search-input"
            placeholder="Search by kit name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <span className="pk-total-badge">
          Total: {filteredKits.length} {filteredKits.length === 1 ? "Kit" : "Kits"}
        </span>
      </div>

      {/* 3. Table Card */}
      <div className="pk-table-card">
        <table className="pk-table">
          <thead>
            <tr>
              <th className="pk-id-cell">ID</th>
              <th>KIT NAME</th>
              <th className="center pk-actions-cell">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="3">
                  <div className="pk-loading-state">
                    <div className="pk-spinner" />
                    <p>Loading...</p>
                  </div>
                </td>
              </tr>
            ) : filteredKits.length === 0 ? (
              <tr>
                <td colSpan="3">
                  <div className="pk-empty-state">
                    <Package size={40} color="#475569" />
                    <h3>No Project Kits found</h3>
                    <p>
                      {searchTerm
                        ? "No project kits match your search criteria."
                        : "Click 'Create Project Kit' above to add your first project kit."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedKits.map((kit, index) => {
                const serialNum =
                  (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                return (
                  <tr key={kit.ID}>
                    {/* ID */}
                    <td className="pk-id-cell">{serialNum}</td>

                    {/* Kit Name */}
                    <td className="pk-name-cell">{kit.KIT_NAME}</td>

                    {/* Actions */}
                    <td className="center pk-actions-cell">
                      <div className="pk-action-buttons">
                        <button
                          type="button"
                          className="pk-btn-edit"
                          title="Edit Project Kit"
                          onClick={() => handleOpenEditModal(kit)}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          className="pk-btn-delete"
                          title="Delete Project Kit"
                          onClick={() => handleOpenDelete(kit)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Pagination Footer */}
          {!loading && filteredKits.length > 0 && totalPages > 1 && (
            <tfoot>
              <tr>
                <td colSpan="3" style={{ padding: 0 }}>
                  <div className="pk-table-pagination">
                    <div className="pk-pagination-info">
                      Showing page <strong>{currentPage}</strong> of{" "}
                      <strong>{totalPages}</strong>
                    </div>

                    <div className="pk-pagination-buttons">
                      <button
                        type="button"
                        className="pk-pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <button
                        type="button"
                        className="pk-pagination-btn"
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        title="Next Page"
                      >
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

      {/* =========================================================
          4. CREATE / EDIT MODAL
          ========================================================= */}
      {isModalOpen && (
        <div className="pk-modal-overlay" onClick={handleCloseModal}>
          <div className="pk-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="pk-modal-header">
              <div>
                <h2 className="pk-modal-title">
                  {isEditMode ? "Edit Project Kit" : "Create Project Kit"}
                </h2>
                <p className="pk-modal-subtitle">
                  {isEditMode
                    ? "Update kit name or replace kit image"
                    : "Enter project kit details and upload image"}
                </p>
              </div>

              <button
                type="button"
                className="pk-close-btn"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="pk-modal-body">
                {/* Kit Name Field */}
                <div className="pk-form-group">
                  <label htmlFor="kitName">Kit Name *</label>
                  <input
                    id="kitName"
                    type="text"
                    className="pk-input"
                    placeholder="Enter kit name (e.g. Arduino Starter Kit)"
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    disabled={submitting}
                    autoFocus
                  />
                </div>

                {/* Image Upload Field */}
                <div className="pk-form-group">
                  <label>
                    Image {isEditMode ? "(Optional if keeping existing)" : "*"}
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    style={{ display: "none" }}
                    disabled={submitting}
                  />

                  {imagePreview ? (
                    <div className="pk-preview-box">
                      <img
                        src={imagePreview}
                        alt="Kit Preview"
                        className="pk-preview-img"
                      />
                      <button
                        type="button"
                        className="pk-btn-remove-img"
                        onClick={handleRemoveImage}
                        disabled={submitting}
                        title="Remove image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="pk-dropzone"
                      onClick={() =>
                        !submitting && fileInputRef.current?.click()
                      }
                    >
                      <Upload size={28} className="pk-dropzone-icon" />
                      <span className="pk-dropzone-text">
                        Click to select and upload image
                      </span>
                      <span className="pk-dropzone-hint">
                        Supports JPG, JPEG, PNG, WEBP (Max: 10MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pk-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={submitting}
                >
                  {submitting
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                    ? "Update Project Kit"
                    : "Create Project Kit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          5. DELETE CONFIRMATION MODAL
          ========================================================= */}
      {deleteConfirm.open && (
        <div
          className="pk-modal-overlay"
          onClick={() => !deleting && setDeleteConfirm({ open: false, kit: null })}
        >
          <div className="pk-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pk-delete-icon-box">
              <Trash2 size={26} />
            </div>

            <h3>Delete Project Kit?</h3>

            <p>
              Are you sure you want to delete this project kit? This action
              cannot be undone.
            </p>

            <div className="pk-delete-target-name">
              {deleteConfirm.kit?.KIT_NAME}
            </div>

            <div className="pk-delete-actions">
              <button
                type="button"
                className="btn-delete-cancel"
                onClick={() =>
                  setDeleteConfirm({ open: false, kit: null })
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-delete-confirm"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectKits;
