import React, { useEffect, useRef, useState } from "react";
import "./CourseMaterial.css";

import {
  FileText,
  FolderOpen,
  Plus,
  Pencil,
  X,
  Upload,
  Download,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Play,
  Eye,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  Video,
} from "lucide-react";

import { toast } from "react-toastify";

import { courseMaterialApi, batchesApi, moduleApi } from "../../services/apiService";
import PdfThumbnail from "./PdfThumbnail";
import CleanVideoPlayer from "./CleanVideoPlayer";

const CourseMaterial = () => {
  /* =====================================================
     STATE
  ===================================================== */

  const [selectedMaterialId, setSelectedMaterialId] = useState(null);

  const [selectedMaterialData, setSelectedMaterialData] = useState(null);

  const [materialLoading, setMaterialLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  const [editingMaterial, setEditingMaterial] = useState(null);

  const isFetched = useRef(false);

  const [btnLoading, setBtnLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const [materials, setMaterials] = useState([]);

  const [userData, setUserData] = useState({});

  const [batches, setBatches] = useState([]);

  const [selectedBatches, setSelectedBatches] = useState([]);

  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);

  const [batchSearchTerm, setBatchSearchTerm] = useState("");

  const batchDropdownRef = useRef(null);

  const [modules, setModules] = useState([]);

  const [selectedModule, setSelectedModule] = useState("");

  /*
    false = PDF mode
    true  = URL mode
  */
  const [isUrlMode, setIsUrlMode] = useState(false);

  const [urlInput, setUrlInput] = useState("");

  /*
    formData.files
    Only actual PDF files are stored here.
  */
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    files: [],
  });

  /* =====================================================
     CLICK OUTSIDE BATCH DROPDOWN
  ===================================================== */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        batchDropdownRef.current &&
        !batchDropdownRef.current.contains(event.target)
      ) {
        setIsBatchDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* =====================================================
     DELETE CONFIRMATIONS
  ===================================================== */

  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    materialId: null,
    file: null,
  });

  const [materialDeleteConfirm, setMaterialDeleteConfirm] = useState({
    open: false,
    material: null,
  });

  /* =====================================================
     RESET FORM
  ===================================================== */

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      files: [],
    });

    setSelectedBatches([]);

    setIsBatchDropdownOpen(false);

    setBatchSearchTerm("");

    setSelectedModule("");

    setEditingMaterial(null);

    setIsEditMode(false);

    setIsUrlMode(false);

    setUrlInput("");
  };

  /* =====================================================
     GET LOGGED-IN USER
  ===================================================== */

  const getLoggedInUser = () => {
    try {
      const keys = ["ASA_LMSUser", "user", "LMSUser"];
      let storedUser = null;
      for (const k of keys) {
        storedUser = sessionStorage.getItem(k) || localStorage.getItem(k);
        if (storedUser) break;
      }

      if (!storedUser) {
        return null;
      }

      return typeof storedUser === "string" ? JSON.parse(storedUser) : storedUser;
    } catch (error) {
      console.error("Failed to get logged-in user:", error);

      return null;
    }
  };

  const normalizedRole = (
    userData?.USER_TYPE ||
    userData?.ROLE ||
    userData?.role ||
    userData?.userType ||
    userData?.DESIGNATION ||
    ""
  ).toString().trim().toUpperCase();

  const currentUserId =
    userData?.USER_ID ||
    userData?.userId ||
    userData?.id ||
    userData?.ID ||
    userData?.tutorId ||
    userData?.studentId ||
    null;

  const isAdmin = normalizedRole === "ADMIN";
  const isTutor = normalizedRole === "TUTOR";
  const isStudent = normalizedRole === "STUDENT";
  const canManageMaterial = isAdmin || isTutor;

  /* =====================================================
     FETCH MATERIALS
  ===================================================== */

  const fetchMaterials = async (user = userData) => {
    setLoading(true);

    try {
      const role = (
        user?.USER_TYPE ||
        user?.ROLE ||
        user?.role ||
        user?.userType ||
        user?.DESIGNATION ||
        ""
      ).toString().trim().toUpperCase();

      const uid =
        user?.USER_ID ||
        user?.userId ||
        user?.id ||
        user?.ID ||
        user?.tutorId ||
        user?.studentId;

      let res;

      if (role === "STUDENT") {
        if (!uid) {
          toast.error("Student USER_ID not found");

          setMaterials([]);

          return;
        }

        res = await courseMaterialApi.getStudentMaterials(uid);
      } else if (role === "TUTOR") {
        if (!uid) {
          toast.error("Tutor USER_ID not found");

          setMaterials([]);

          return;
        }

        res = await courseMaterialApi.getAll({ tutorId: uid, userType: "TUTOR" });
      } else {
        res = await courseMaterialApi.getAll({ userType: "ADMIN" });
      }

      if (res?.data?.status === 1) {
        setMaterials(res.data.data || []);
      } else {
        setMaterials([]);

        toast.error(res?.data?.message || "Failed to fetch course materials");
      }
    } catch (error) {
      console.error("Fetch course materials error:", error);

      console.error("Backend response:", error?.response?.data);

      setMaterials([]);

      toast.error(
        error?.response?.data?.message || "Failed to fetch course materials",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     FETCH BATCHES
  ===================================================== */

  const fetchBatches = async (user = userData) => {
    try {
      const role = (
        user?.USER_TYPE ||
        user?.ROLE ||
        user?.role ||
        user?.userType ||
        user?.DESIGNATION ||
        ""
      ).toString().trim().toUpperCase();

      const uid =
        user?.USER_ID ||
        user?.userId ||
        user?.id ||
        user?.ID ||
        user?.tutorId ||
        user?.studentId;

      const params = role === "TUTOR" && uid ? { tutorId: uid } : undefined;
      const res = await batchesApi.getBatches(params);

      if (res?.data?.status === 1) {
        setBatches(res.data.data || []);
      } else {
        setBatches([]);

        toast.error(res?.data?.message || "Failed to fetch batches");
      }
    } catch (error) {
      console.error("Fetch batches error:", error);

      setBatches([]);

      toast.error(error?.response?.data?.message || "Failed to fetch batches");
    }
  };

  /* =====================================================
     FETCH MODULES
  ===================================================== */

  const fetchModules = async () => {
    try {
      const res = await moduleApi.getActive();

      if (res?.data?.status === 1) {
        setModules(res.data.data || []);
      } else {
        setModules([]);

        toast.error(res?.data?.message || "Failed to fetch modules");
      }
    } catch (error) {
      console.error("Fetch modules error:", error);

      setModules([]);

      toast.error(error?.response?.data?.message || "Failed to fetch modules");
    }
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    if (isFetched.current) {
      return;
    }

    isFetched.current = true;

    const user = getLoggedInUser();

    if (!user) {
      console.warn("Logged-in user not found");

      return;
    }

    setUserData(user);

    const role = (
      user?.USER_TYPE ||
      user?.ROLE ||
      user?.role ||
      user?.userType ||
      user?.DESIGNATION ||
      ""
    ).toString().trim().toUpperCase();

    if (role === "ADMIN" || role === "TUTOR") {
      fetchMaterials(user);

      fetchBatches(user);

      fetchModules();
    } else if (role === "STUDENT") {
      fetchMaterials(user);

      fetchModules();
    } else {
      console.warn("Unknown user type, loading defaults:", role);
      fetchMaterials(user);
      fetchBatches(user);
      fetchModules();
    }
  }, []);

  /* =====================================================
     OPEN ADD MODAL
  ===================================================== */

  const handleOpenAddModal = () => {
    resetForm();
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  /* =====================================================
     OPEN EDIT MODAL
  ===================================================== */

  const handleOpenEditModal = (material) => {
    if (!material) {
      return;
    }

    setEditingMaterial(material);

    setIsEditMode(true);

    let existingBatchIds = [];
    if (Array.isArray(material.BATCH_IDS) && material.BATCH_IDS.length > 0) {
      existingBatchIds = material.BATCH_IDS.map(Number);
    } else if (Array.isArray(material.BATCHES) && material.BATCHES.length > 0) {
      existingBatchIds = material.BATCHES.map((b) => Number(b.ID));
    } else if (material.BATCH_ID) {
      existingBatchIds = [Number(material.BATCH_ID)];
    }

    setSelectedBatches(existingBatchIds);

    setIsBatchDropdownOpen(false);

    setBatchSearchTerm("");

    setSelectedModule(material.MODULE_ID ? String(material.MODULE_ID) : "");

    setFormData({
      title: material.TITLE || "",

      description: material.DESCRIPTION || "",

      files: [],
    });

    setIsUrlMode(false);

    setUrlInput("");

    setIsModalOpen(true);
  };

  /* =====================================================
     BATCH MULTI-SELECT HANDLERS
  ===================================================== */

  const handleToggleBatch = (batchId) => {
    const idNum = Number(batchId);
    setSelectedBatches((prev) =>
      prev.includes(idNum)
        ? prev.filter((id) => id !== idNum)
        : [...prev, idNum]
    );
  };

  const handleRemoveBatch = (batchId) => {
    const idNum = Number(batchId);
    setSelectedBatches((prev) => prev.filter((id) => id !== idNum));
  };

  const handleSelectAllBatches = () => {
    if (selectedBatches.length === batches.length) {
      setSelectedBatches([]);
    } else {
      setSelectedBatches(batches.map((b) => Number(b.ID)));
    }
  };

  /* =====================================================
     CLOSE MODAL
  ===================================================== */

  const handleCloseModal = () => {
    if (btnLoading) {
      return;
    }

    resetForm();

    setIsModalOpen(false);
  };

  /* =====================================================
     FILE FORMAT
  ===================================================== */

  const getFileFormat = (name) => {
    if (!name) {
      return "";
    }

    const ext = name.split(".").pop().toUpperCase();

    return ext;
  };

  /* =====================================================
     PDF FILE CHANGE
  ===================================================== */

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) {
      return;
    }

    const invalidFiles = selectedFiles.filter(
      (file) =>
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf"),
    );

    if (invalidFiles.length > 0) {
      toast.error("Only PDF files are allowed");

      e.target.value = "";

      return;
    }

    const formattedFiles = selectedFiles.map((file) => ({
      FILE: file,

      FORMAT: "PDF",

      FILE_PATH: URL.createObjectURL(file),

      FILE_NAME: file.name,

      TYPE: "PDF",

      IS_NEW: true,
    }));

    setFormData((prev) => ({
      ...prev,

      files: [...prev.files, ...formattedFiles],
    }));

    e.target.value = "";
  };

  /* =====================================================
     REMOVE NEW PDF
  ===================================================== */

  const handleRemoveNewFile = (index) => {
    setFormData((prev) => ({
      ...prev,

      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  /* =====================================================
     ADD URL
  ===================================================== */

  const handleAddUrl = () => {
    const url = urlInput.trim();

    if (!url) {
      toast.error("Please enter a URL");

      return;
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch (error) {
      toast.error("Please enter a valid URL");

      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      toast.error("Only HTTP and HTTPS URLs are allowed");

      return;
    }

    /*
      URL is stored temporarily in formData
      so PDF + URL resources can be displayed
      together.
    */
    setFormData((prev) => ({
      ...prev,

      files: [
        ...prev.files,

        {
          TYPE: "URL",

          FORMAT: "URL",

          URL: url,

          IS_NEW: true,
        },
      ],
    }));

    setUrlInput("");
  };

  /* =====================================================
     REMOVE NEW RESOURCE
  ===================================================== */

  const handleRemoveNewResource = (index) => {
    setFormData((prev) => ({
      ...prev,

      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  /* =====================================================
     DELETE SINGLE EXISTING FILE / URL
  ===================================================== */

  const handleDeleteFile = (materialId, file) => {
    setDeleteConfirm({
      open: true,

      materialId,

      file,
    });
  };

  /* =====================================================
     DELETE ENTIRE MATERIAL
  ===================================================== */

  const handleDeleteMaterial = (material) => {
    if (!material?.ID) {
      toast.error("Material ID not found");

      return;
    }

    setMaterialDeleteConfirm({
      open: true,

      material,
    });
  };

  /* =====================================================
     CONFIRM DELETE MATERIAL
  ===================================================== */

  const confirmDeleteMaterial = async () => {
    const material = materialDeleteConfirm.material;

    if (!material?.ID) {
      return;
    }

    try {
      setBtnLoading(true);

      const res = await courseMaterialApi.deleteMaterial(material.ID);

      if (res?.data?.status === 1) {
        toast.success(
          res.data.message || "Course material deleted successfully",
        );

        setMaterials((prev) => prev.filter((item) => item.ID !== material.ID));

        if (selectedMaterialId === material.ID) {
          setSelectedMaterialId(null);
          setSelectedMaterialData(null);
        }

        // Clear preview if this material was currently previewed
        setPreviewItem((prev) =>
          prev && prev.materialId === material.ID ? null : prev
        );

        setMaterialDeleteConfirm({
          open: false,

          material: null,
        });
      } else {
        toast.error(res?.data?.message || "Failed to delete course material");
      }
    } catch (error) {
      console.error(
        "Delete course material error:",
        error?.response?.data || error,
      );

      toast.error(
        error?.response?.data?.message || "Failed to delete course material",
      );
    } finally {
      setBtnLoading(false);
    }
  };

  /* =====================================================
     CONFIRM DELETE SINGLE RESOURCE
  ===================================================== */

  const confirmDeleteFile = async () => {
    const { materialId, file } = deleteConfirm;

    if (!materialId || !file) {
      return;
    }

    /*
      For both PDF and URL, backend receives
      FILE_PATH for PDF or URL for URL.
    */

    const resourcePath = file.TYPE === "URL" ? file.URL : file.FILE_PATH;

    if (!resourcePath) {
      toast.error("Resource path not found");

      return;
    }

    try {
      setBtnLoading(true);

      const res = await courseMaterialApi.deleteFile(materialId, resourcePath);

      if (res?.data?.status === 1) {
        toast.success(res.data.message || "Resource deleted successfully");

        const updatedFiles = res.data.data || [];

        setMaterials((prev) =>
          prev.map((item) =>
            item.ID === materialId
              ? {
                  ...item,

                  FILES: updatedFiles,
                }
              : item,
          ),
        );

        setSelectedMaterialData((prev) =>
          prev && prev.ID === materialId
            ? {
                ...prev,
                FILES: updatedFiles,
              }
            : prev,
        );

        setEditingMaterial((prev) =>
          prev && prev.ID === materialId
            ? {
                ...prev,

                FILES: updatedFiles,
              }
            : prev,
        );

        // Clear preview if this specific resource was being previewed
        setPreviewItem((prev) => {
          if (!prev || prev.materialId !== materialId) return prev;
          const prevPath =
            prev.file?.FILE_PATH || prev.file?.URL || prev.fileUrl;
          if (
            prevPath === resourcePath ||
            (file.URL && prev.file?.URL === file.URL) ||
            (file.FILE_PATH && prev.file?.FILE_PATH === file.FILE_PATH)
          ) {
            return null;
          }
          return prev;
        });
      } else {
        toast.error(res?.data?.message || "Failed to delete resource");
      }
    } catch (error) {
      console.error("Delete resource error:", error?.response?.data || error);

      toast.error(
        error?.response?.data?.message || "Failed to delete resource",
      );
    } finally {
      setBtnLoading(false);

      setDeleteConfirm({
        open: false,

        materialId: null,

        file: null,
      });
    }
  };

  /* =====================================================
     RESOURCE PREVIEW HELPERS & STATE (SINGLE RESOURCE)
  ===================================================== */

  const [previewItem, setPreviewItem] = useState(null);

  const getResourceUrl = (filePath) => {
    if (!filePath) return "";

    let baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "";
    if (
      typeof window !== "undefined" &&
      window.location &&
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      if (!baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl)) {
        baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
      }
    }
    const normalizedBase = baseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");

    // If already absolute
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      let absUrl = filePath;
      if (absUrl.includes("/uploads/") && !absUrl.includes("/api/uploads/")) {
        absUrl = absUrl.replace("/uploads/", "/api/uploads/");
      }
      return absUrl.replace(/\/api\/api\//g, "/api/");
    }

    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const targetPath = cleanPath.startsWith("uploads/")
      ? `api/${cleanPath}`
      : cleanPath.startsWith("api/uploads/")
      ? cleanPath
      : cleanPath;

    const resUrl = normalizedBase ? `${normalizedBase}/${targetPath}` : `/${targetPath}`;
    return resUrl.replace(/\/api\/api\//g, "/api/");
  };

  const getYouTubeEmbedInfo = (url) => {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();

    try {
      // Normalize URL if protocol missing
      const urlObj = new URL(
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`
      );

      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");
      let videoId = null;

      if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
        if (urlObj.pathname.startsWith("/watch")) {
          videoId = urlObj.searchParams.get("v");
        } else if (urlObj.pathname.startsWith("/embed/")) {
          videoId = urlObj.pathname.split("/embed/")[1]?.split("/")[0]?.split("?")[0];
        } else if (urlObj.pathname.startsWith("/shorts/")) {
          videoId = urlObj.pathname.split("/shorts/")[1]?.split("/")[0]?.split("?")[0];
        } else if (urlObj.pathname.startsWith("/v/")) {
          videoId = urlObj.pathname.split("/v/")[1]?.split("/")[0]?.split("?")[0];
        } else if (urlObj.pathname.startsWith("/live/")) {
          videoId = urlObj.pathname.split("/live/")[1]?.split("/")[0]?.split("?")[0];
        }
      } else if (hostname === "youtu.be") {
        videoId = urlObj.pathname.slice(1).split("/")[0]?.split("?")[0];
      }

      // Regex fallback if URL parser didn't match standard structure
      if (!videoId) {
        const regexPatterns = [
          /(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
        ];
        for (const pattern of regexPatterns) {
          const match = trimmed.match(pattern);
          if (match && match[1]) {
            videoId = match[1];
            break;
          }
        }
      }

      // Clean extracted videoId (ensure standard 11 chars or alphanumeric format)
      if (videoId) {
        videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
        if (videoId.length >= 10 && videoId.length <= 15) {
          // Check for start time parameter (e.g. ?t=30s or ?start=30)
          let startParam = "";
          const tParam = urlObj.searchParams.get("t") || urlObj.searchParams.get("start");
          if (tParam) {
            const cleanT = parseInt(tParam, 10);
            if (!isNaN(cleanT) && cleanT > 0) {
              startParam = `&start=${cleanT}`;
            }
          }

          return {
            videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0${startParam}`,
            thumbUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          };
        }
      }

      // Check if URL is definitely YouTube domain but has invalid/missing video ID
      if (hostname.includes("youtube.com") || hostname === "youtu.be") {
        return {
          videoId: null,
          embedUrl: null,
          thumbUrl: null,
          isInvalidYouTube: true,
        };
      }
    } catch {
      // ignore parsing error
    }

    return null;
  };

  const getDomainFromUrl = (urlString) => {
    if (!urlString || typeof urlString !== "string") return "Link";
    try {
      const parsed = new URL(
        urlString.startsWith("http://") || urlString.startsWith("https://")
          ? urlString
          : `https://${urlString}`,
      );
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "Web Link";
    }
  };

  const handleOpenSinglePreview = (material, file) => {
    if (!file) return;

    const isUrl = file.TYPE === "URL" || file.FORMAT === "URL";
    const ytInfo = isUrl ? getYouTubeEmbedInfo(file.URL) : null;
    const fileUrl = isUrl ? file.URL : getResourceUrl(file.FILE_PATH);
    const displayName = isUrl
      ? file.URL
      : file.FILE_NAME || getFileName(file.FILE_PATH);

    setPreviewItem({
      materialId: material?.ID,
      materialTitle: material?.TITLE,
      moduleName: material?.MODULE_NAME,
      file,
      isUrl,
      isYouTube: !!ytInfo,
      videoId: ytInfo ? ytInfo.videoId : null,
      embedUrl: ytInfo ? ytInfo.embedUrl : null,
      fileUrl,
      displayName,
      format: file.FORMAT || (isUrl ? "URL" : "PDF"),
    });
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
  };

  /* =====================================================
     GET FILE NAME
  ===================================================== */

  const getFileName = (filePath) => {
    if (!filePath) {
      return "PDF";
    }

    return filePath.split("/").pop();
  };

  /* =====================================================
     DOWNLOAD PDF
  ===================================================== */

  const handleDownloadFile = (file) => {
    if (file?.TYPE === "URL" || file?.FORMAT === "URL") {
      if (file.URL) {
        window.open(file.URL, "_blank", "noopener,noreferrer");
      }

      return;
    }

    if (!file?.FILE_PATH) {
      toast.error("File not available");

      return;
    }

    const link = document.createElement("a");

    link.href = getResourceUrl(file.FILE_PATH);

    link.download = file.FILE_NAME || getFileName(file.FILE_PATH);

    link.target = "_blank";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };

  /* =====================================================
     DOWNLOAD ZIP
  ===================================================== */

  const handleDownloadAll = async (material) => {
    const pdfFiles =
      material?.FILES?.filter(
        (file) => file.TYPE === "PDF" || file.FORMAT === "PDF",
      ) || [];

    if (!material?.ID || pdfFiles.length === 0) {
      toast.error("No PDF files available");

      return;
    }

    try {
      setBtnLoading(true);

      const res = await courseMaterialApi.downloadZip(material.ID);

      const blob = new Blob([res.data], {
        type: "application/zip",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      const safeTitle = (material.TITLE || "course-material")
        .replace(/[<>:"/\\|?*]/g, "")
        .trim();

      link.download = `${safeTitle || "course-material"}.zip`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download ZIP error:", error?.response?.data || error);

      toast.error("Failed to download PDF files");
    } finally {
      setBtnLoading(false);
    }
  };

  /* =====================================================
     SAVE MATERIAL
  ===================================================== */

  const handleSave = async () => {
    /* -----------------------------
       BATCH
    ----------------------------- */

    if (!selectedBatches || selectedBatches.length === 0) {
      toast.error("Please select at least one batch");

      return;
    }

    /* -----------------------------
       MODULE
    ----------------------------- */

    if (!selectedModule) {
      toast.error("Please select a module");

      return;
    }

    /* -----------------------------
       TITLE
    ----------------------------- */

    if (!formData.title.trim()) {
      toast.error("Title is required");

      return;
    }

    /*
      New resources include:
      - PDF files
      - URLs
    */
    const newResources = formData.files || [];

    /*
      In ADD mode at least one
      resource is required.
    */
    if (!isEditMode && newResources.length === 0) {
      toast.error("Please add at least one PDF or URL");

      return;
    }

    /*
      In EDIT mode:
      Existing resources + new resources
      must contain at least one.
    */
    if (isEditMode) {
      const existingCount = editingMaterial?.FILES?.length || 0;

      const newCount = newResources.length;

      if (existingCount + newCount === 0) {
        toast.error("At least one PDF or URL is required");

        return;
      }
    }

    try {
      setBtnLoading(true);

      const uploadData = new FormData();

      /* -----------------------------
         BASIC DATA
      ----------------------------- */

      uploadData.append("batchIds", JSON.stringify(selectedBatches));

      uploadData.append("batchId", selectedBatches[0]);

      uploadData.append("MODULE_ID", selectedModule);

      uploadData.append("title", formData.title.trim());

      uploadData.append("description", formData.description.trim());

      uploadData.append("createdBy", isTutor ? "TUTOR" : "ADMIN");

      uploadData.append("userType", isTutor ? "TUTOR" : "ADMIN");

      if (isTutor && currentUserId) {
        uploadData.append("tutorId", currentUserId);
      }

      /* -----------------------------
         PDF FILES
      ----------------------------- */

      const pdfFiles = newResources.filter(
        (resource) => resource.TYPE === "PDF",
      );

      pdfFiles.forEach((resource) => {
        if (resource.FILE) {
          uploadData.append("files", resource.FILE);
        }
      });

      /* -----------------------------
         URLS
      ----------------------------- */

      const urls = newResources
        .filter((resource) => resource.TYPE === "URL" && resource.URL)
        .map((resource) => resource.URL);

      /*
        Send URLs as JSON.
      */
      uploadData.append("urls", JSON.stringify(urls));

      /* =================================================
         ADD - POST
      ================================================= */

      if (!isEditMode) {
        const res = await courseMaterialApi.upload(uploadData);

        if (res?.data?.status === 1) {
          toast.success(
            res.data.message || "Course material uploaded successfully",
          );

          setIsModalOpen(false);

          resetForm();

          await fetchMaterials(userData);
        } else {
          toast.error(res?.data?.message || "Failed to upload course material");
        }

        return;
      }

      /* =================================================
         EDIT - PUT
      ================================================= */

      const res = await courseMaterialApi.update(
        editingMaterial.ID,
        uploadData,
      );

      if (res?.data?.status === 1) {
        toast.success(
          res.data.message || "Course material updated successfully",
        );

        setIsModalOpen(false);

        const updatedId = editingMaterial.ID;

        resetForm();

        await fetchMaterials(userData);

        if (selectedMaterialId === updatedId) {
          try {
            const singleRes = await courseMaterialApi.getById(updatedId);
            if (singleRes?.data?.status === 1 && singleRes.data.data) {
              setSelectedMaterialData(singleRes.data.data);
            }
          } catch {
            // ignore
          }
        }
      } else {
        toast.error(res?.data?.message || "Failed to update course material");
      }
    } catch (error) {
      console.error(
        "Save course material error:",
        error?.response?.data || error,
      );

      toast.error(
        error?.response?.data?.message || "Failed to save course material",
      );
    } finally {
      setBtnLoading(false);
    }
  };

  /* =====================================================
     MATERIAL DETAILS NAVIGATION
  ===================================================== */

  const handleOpenMaterialDetails = async (material) => {
    if (!material?.ID) return;
    setSelectedMaterialId(material.ID);
    setSelectedMaterialData(material);
    setMaterialLoading(true);

    try {
      const res = await courseMaterialApi.getById(material.ID);
      if (res?.data?.status === 1 && res.data.data) {
        setSelectedMaterialData(res.data.data);
      }
    } catch (error) {
      console.error("Fetch material by ID error:", error);
    } finally {
      setMaterialLoading(false);
    }
  };

  const handleBackToMaterials = () => {
    setSelectedMaterialId(null);
    setSelectedMaterialData(null);
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="cm-container">
      {/* =================================================
          VIEW 1: COURSE MATERIAL LIST (MATERIAL CARDS)
      ================================================= */}

      {!selectedMaterialId && (
        <>
          <div className="cm-header-section">
            <div className="cm-breadcrumb">OVERSIGHT</div>

            <div className="cm-title-row">
              <div className="cm-title-left">
                <h1 className="cm-title">Course Material</h1>

                <p className="cm-subtitle">
                  Upload and manage course material for student batches.
                </p>
              </div>

              {canManageMaterial && (
                <button className="cm-btn-add" onClick={handleOpenAddModal}>
                  <Plus size={17} />
                  Add Material
                </button>
              )}
            </div>
          </div>

          <div className="cm-panel">
            {loading ? (
              <div className="cm-state-container">
                <div className="cm-loading-spinner"></div>
                <p className="cm-state-text">Loading course materials...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="cm-state-container cm-empty-state">
                <div className="cm-empty-icon-box">
                  <FolderOpen size={40} className="cm-empty-icon" />
                </div>

                <h3 className="cm-empty-title">No Course Materials Found</h3>

                <p className="cm-empty-desc">
                  No study materials have been uploaded yet. Click below to add the
                  first resource for your student batches.
                </p>

                {canManageMaterial && (
                  <button className="cm-empty-btn" onClick={handleOpenAddModal}>
                    <Plus size={18} />
                    <span>Add Course Material</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="cm-list">
                {materials.map((item) => {
                  const files = item.FILES || [];
                  const pdfFiles = files.filter(
                    (f) => f.TYPE === "PDF" || f.FORMAT === "PDF"
                  );
                  const videoFiles = files.filter(
                    (f) => f.TYPE === "URL" || f.FORMAT === "URL"
                  );
                  const pdfCount = pdfFiles.length;
                  const videoCount = videoFiles.length;

                  return (
                    <div
                      className="cm-material-card"
                      key={item.ID}
                      onClick={() => handleOpenMaterialDetails(item)}
                    >
                      {/* 1. TOP ROW: MODULE/BATCH/RESOURCE BADGES & TOP-RIGHT ACTIONS */}
                      <div className="cm-card-top-header">
                        <div className="cm-card-top-badges">
                          {item.MODULE_NAME && (
                            <span className="cm-module-tag">
                              Module: {item.MODULE_NAME}
                            </span>
                          )}
                          {!isStudent &&
                            (item.BATCHES && item.BATCHES.length > 0 ? (
                              item.BATCHES.map((b) => (
                                <span
                                  key={`${item.ID}-batch-${b.ID || b.BATCH_CODE}`}
                                  className="cm-batch-tag"
                                >
                                  Batch: {b.BATCH_CODE}
                                </span>
                              ))
                            ) : item.BATCH_CODE ? (
                              <span className="cm-batch-tag">
                                Batch: {item.BATCH_CODE}
                              </span>
                            ) : null)}
                          <span className="cm-material-count-pill">
                            {files.length}{" "}
                            {files.length === 1 ? "Resource" : "Resources"}
                            {pdfCount > 0 || videoCount > 0 ? (
                              <>
                                {" "}
                                ({pdfCount > 0 ? `${pdfCount} PDF${pdfCount > 1 ? "s" : ""}` : ""}
                                {pdfCount > 0 && videoCount > 0 ? ", " : ""}
                                {videoCount > 0 ? `${videoCount} Video${videoCount > 1 ? "s" : ""}` : ""})
                              </>
                            ) : null}
                          </span>
                        </div>

                        {/* TOP-RIGHT ACTIONS: View, Edit, Delete (and Student Download if applicable) */}
                        <div
                          className="cm-card-top-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="cm-btn-action-view"
                            onClick={() => handleOpenMaterialDetails(item)}
                            title="View Material Details"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          {isStudent && pdfCount > 0 && (
                            <button
                              type="button"
                              className="cm-btn-student-download"
                              onClick={() => handleDownloadAll(item)}
                              title="Download all PDFs"
                            >
                              <Download size={14} />
                              <span>Download</span>
                            </button>
                          )}

                          {canManageMaterial && (
                            <>
                              <button
                                type="button"
                                className="cm-btn-action-edit"
                                onClick={() => handleOpenEditModal(item)}
                                title="Edit material"
                              >
                                <Pencil size={14} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="cm-btn-action-delete"
                                onClick={() => handleDeleteMaterial(item)}
                                title="Delete material"
                                disabled={btnLoading}
                              >
                                <Trash2 size={14} />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 2. MATERIAL INFO: TITLE & DESCRIPTION */}
                      <div className="cm-card-info-section">
                        <h3 className="cm-card-title">{item.TITLE}</h3>
                        <p className="cm-card-description">
                          {item.DESCRIPTION || "No additional description provided for this material."}
                        </p>
                      </div>

                      {/* 3. RESOURCE AREA: BELOW DESCRIPTION (TWO-COLUMN FOR EACH RESOURCE) */}
                      <div
                        className="cm-card-resources-section"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {files.length === 0 ? (
                          <div
                            className="cm-resource-item-empty"
                            onClick={() => handleOpenMaterialDetails(item)}
                          >
                            <FolderOpen size={24} className="cm-empty-res-icon" />
                            <span>No resources attached to this material.</span>
                          </div>
                        ) : (
                          <div className="cm-resource-rows-list">
                            {files.slice(0, 2).map((file, fIdx) => {
                              const isUrl =
                                file.TYPE === "URL" || file.FORMAT === "URL";
                              const ytInfo = isUrl
                                ? getYouTubeEmbedInfo(file.URL)
                                : null;
                              const fileName = isUrl
                                ? file.URL
                                : file.FILE_NAME || getFileName(file.FILE_PATH);

                              return (
                                <div
                                  className="cm-resource-row-box"
                                  key={`res-${fIdx}-${file.FILE_PATH || file.URL}`}
                                  onClick={() =>
                                    handleOpenSinglePreview(item, file)
                                  }
                                >
                                  {/* LEFT: LARGE THUMBNAIL (IDENTICAL FIXED DIMENSIONS) */}
                                  <div className="cm-resource-thumb-col">
                                    {isUrl ? (
                                      <div className="cm-resource-thumb-viewport cm-thumb-video-viewport">
                                        {ytInfo?.thumbUrl ? (
                                          <img
                                            src={ytInfo.thumbUrl}
                                            alt="Video thumbnail"
                                            className="cm-res-video-img"
                                          />
                                        ) : (
                                          <div className="cm-res-url-placeholder">
                                            <LinkIcon size={32} />
                                            <span>Web Resource</span>
                                          </div>
                                        )}
                                        <div className="cm-res-play-overlay">
                                          <div className="cm-res-play-btn">
                                            <Play size={20} fill="#ffffff" />
                                          </div>
                                        </div>
                                        <span className="cm-res-type-badge cm-badge-video">
                                          Video
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="cm-resource-thumb-viewport cm-thumb-pdf-viewport">
                                        <PdfThumbnail
                                          fileUrl={getResourceUrl(file.FILE_PATH)}
                                          className="cm-res-pdf-render"
                                        />
                                        <span className="cm-res-type-badge cm-badge-pdf">
                                          PDF Document
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* RIGHT: RESOURCE DETAILS */}
                                  <div className="cm-resource-details-col">
                                    <div className="cm-res-meta-label">
                                      {isUrl
                                        ? ytInfo
                                          ? "Video Resource"
                                          : "Web Link"
                                        : "Preview"}
                                    </div>
                                    <h4
                                      className="cm-res-title"
                                      title={isUrl && ytInfo ? (item.TITLE || "Video") : fileName}
                                    >
                                      {isUrl && ytInfo ? (item.TITLE || "Video") : fileName}
                                    </h4>
                                    <div className="cm-res-type-desc">
                                      {isUrl
                                        ? ytInfo
                                          ? "Video Lesson"
                                          : "External Web Resource"
                                        : `PDF Document · ${file.FORMAT || "PDF"}`}
                                    </div>
                                    <div className="cm-res-footer-action">
                                      <button
                                        type="button"
                                        className="cm-res-open-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenSinglePreview(item, file);
                                        }}
                                      >
                                        {isUrl ? (
                                          <>
                                            <Play size={13} fill="currentColor" />
                                            <span>Watch Video</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye size={13} />
                                            <span>Preview PDF</span>
                                          </>
                                        )}
                                      </button>
                                      {!isUrl && isStudent && (
                                        <button
                                          type="button"
                                          className="cm-res-download-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownloadFile(file);
                                          }}
                                          title="Download PDF"
                                        >
                                          <Download size={13} />
                                          <span>Download</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {files.length > 2 && (
                              <div
                                className="cm-more-resources-bar"
                                onClick={() => handleOpenMaterialDetails(item)}
                              >
                                <span>+{files.length - 2} more {files.length - 2 === 1 ? "resource" : "resources"} available. Click to view all.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* =================================================
          VIEW 2: SEPARATE MATERIAL DETAILS / PREVIEW PAGE
          (SHOWS ONLY THE SELECTED MATERIAL'S CONTENT)
      ================================================= */}

      {selectedMaterialId && (
        <>
          <div className="cm-header-section">
            <div className="cm-nav-header">
              <button
                type="button"
                className="cm-back-btn"
                onClick={handleBackToMaterials}
              >
                <ArrowLeft size={16} />
                <span>Back to Course Materials</span>
              </button>

              <div className="cm-breadcrumb-trail">
                <span
                  className="cm-breadcrumb-link"
                  onClick={handleBackToMaterials}
                >
                  Course Materials
                </span>
                <span className="cm-breadcrumb-sep">/</span>
                <span className="cm-breadcrumb-current">
                  {selectedMaterialData?.TITLE || "Material Details"}
                </span>
              </div>
            </div>

            <div className="cm-title-row">
              <div className="cm-title-left">
                <div className="cm-details-badge-row">
                  {selectedMaterialData?.MODULE_NAME && (
                    <span className="cm-module-tag">
                      Module: {selectedMaterialData.MODULE_NAME}
                    </span>
                  )}
                  {!isStudent &&
                    (selectedMaterialData?.BATCHES && selectedMaterialData.BATCHES.length > 0 ? (
                      selectedMaterialData.BATCHES.map((b) => (
                        <span
                          key={`details-batch-${b.ID || b.BATCH_CODE}`}
                          className="cm-batch-tag"
                        >
                          Batch: {b.BATCH_CODE}
                        </span>
                      ))
                    ) : selectedMaterialData?.BATCH_CODE ? (
                      <span className="cm-batch-tag">
                        Batch: {selectedMaterialData.BATCH_CODE}
                      </span>
                    ) : null)}
                </div>

                <h1 className="cm-title">
                  {selectedMaterialData?.TITLE || "Material Details"}
                </h1>

                {selectedMaterialData?.DESCRIPTION && (
                  <p className="cm-subtitle cm-details-desc">
                    {selectedMaterialData.DESCRIPTION}
                  </p>
                )}
              </div>

              <div className="cm-details-actions">
                {isStudent &&
                  selectedMaterialData?.FILES?.some(
                    (file) => file.TYPE === "PDF" || file.FORMAT === "PDF"
                  ) && (
                    <button
                      type="button"
                      className="cm-download-all-btn"
                      onClick={() => handleDownloadAll(selectedMaterialData)}
                      title="Download all PDFs in this material"
                    >
                      <Download size={15} />
                      <span>Download All PDFs</span>
                    </button>
                  )}

                {canManageMaterial &&
                  selectedMaterialData && (
                    <div className="cm-details-admin-btns">
                      <button
                        type="button"
                        className="cm-btn-edit-details"
                        onClick={() => handleOpenEditModal(selectedMaterialData)}
                      >
                        <Pencil size={15} />
                        <span>Edit Material</span>
                      </button>

                      <button
                        type="button"
                        className="cm-btn-delete-details"
                        onClick={() => handleDeleteMaterial(selectedMaterialData)}
                        disabled={btnLoading}
                      >
                        <Trash2 size={15} />
                        <span>Delete Material</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="cm-panel">
            {materialLoading && !selectedMaterialData ? (
              <div className="cm-state-container">
                <div className="cm-loading-spinner"></div>
                <p className="cm-state-text">Loading material details...</p>
              </div>
            ) : !selectedMaterialData?.FILES ||
              selectedMaterialData.FILES.length === 0 ? (
              <div className="cm-state-container cm-empty-state">
                <div className="cm-empty-icon-box">
                  <FolderOpen size={40} className="cm-empty-icon" />
                </div>

                <h3 className="cm-empty-title">No Resources in this Material</h3>

                <p className="cm-empty-desc">
                  No PDF files or video lessons are currently attached to this material.
                </p>

                {canManageMaterial && (
                  <button
                    className="cm-empty-btn"
                    onClick={() => handleOpenEditModal(selectedMaterialData)}
                  >
                    <Plus size={18} />
                    <span>Add Resources</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="cm-material-details-container">
                <div className="cm-details-section-heading">
                  <h3>Attached Resources ({selectedMaterialData.FILES.length})</h3>
                  <p>Preview and access the documents and video lessons for this material.</p>
                </div>

                {/* LARGE 2-COLUMN RESOURCE GRID FOR THIS MATERIAL */}
                <div className="cm-large-resource-grid">
                  {selectedMaterialData.FILES.map((file, index) => {
                    const isUrl =
                      file.TYPE === "URL" || file.FORMAT === "URL";
                    const ytInfo = isUrl
                      ? getYouTubeEmbedInfo(file.URL)
                      : null;
                    const fileName = isUrl
                      ? file.URL
                      : file.FILE_NAME || getFileName(file.FILE_PATH);
                    const domain = isUrl
                      ? ytInfo
                        ? "YouTube Video"
                        : getDomainFromUrl(file.URL)
                      : "PDF Document";

                    if (isUrl) {
                      return (
                        <div
                          className="cm-large-resource-card cm-large-video-card"
                          key={`${file.URL}-${index}`}
                          onClick={() =>
                            handleOpenSinglePreview(selectedMaterialData, file)
                          }
                        >
                          {/* TOP: MEDIUM/LARGE VIDEO PREVIEW CONTAINER */}
                          <div className="cm-large-thumb-container cm-large-video-thumb-container">
                            {ytInfo?.thumbUrl ? (
                              <div className="cm-large-video-wrap">
                                <img
                                  src={ytInfo.thumbUrl}
                                  alt="Video thumbnail"
                                  className="cm-large-video-img"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                                <div className="cm-large-video-overlay"></div>
                                <div className="cm-large-play-btn">
                                  <Play size={24} fill="#ffffff" />
                                </div>
                              </div>
                            ) : (
                              <div className="cm-large-url-fallback">
                                <LinkIcon size={36} />
                                <span>Web Resource</span>
                              </div>
                            )}
                            <span className="cm-large-type-badge cm-badge-video">
                              {ytInfo ? "Video" : "Link"}
                            </span>

                            {/* ADMIN / TUTOR DELETE BUTTON */}
                            {canManageMaterial && (
                              <button
                                type="button"
                                className="cm-large-card-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(selectedMaterialData.ID, file);
                                }}
                                title="Delete video resource"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* BOTTOM: INFO & ACTION */}
                          <div className="cm-large-card-footer">
                            <div className="cm-large-card-text">
                              <span className="cm-large-source-label">
                                {ytInfo ? "Video" : domain}
                              </span>
                              <h4
                                className="cm-large-card-title"
                                title={ytInfo ? (selectedMaterialData?.TITLE || "Video") : fileName}
                              >
                                {ytInfo ? (selectedMaterialData?.TITLE || "Video") : fileName}
                              </h4>
                            </div>

                            <div className="cm-large-card-actions">
                              <button
                                type="button"
                                className="cm-large-btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSinglePreview(
                                    selectedMaterialData,
                                    file
                                  );
                                }}
                              >
                                <Play size={14} fill="currentColor" />
                                <span>Watch Video</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // PDF DOCUMENT CARD
                    return (
                      <div
                        className="cm-large-resource-card cm-large-pdf-card"
                        key={`${file.FILE_PATH}-${index}`}
                        onClick={() =>
                          handleOpenSinglePreview(selectedMaterialData, file)
                        }
                      >
                        {/* TOP: MEDIUM/LARGE PDF PREVIEW CONTAINER */}
                        <div className="cm-large-thumb-container cm-large-pdf-thumb-container">
                          <PdfThumbnail
                            fileUrl={getResourceUrl(file.FILE_PATH)}
                            className="cm-large-pdf-preview"
                          />
                          <span className="cm-large-type-badge cm-badge-pdf">
                            PDF Document
                          </span>

                          {/* ADMIN / TUTOR DELETE BUTTON */}
                          {canManageMaterial && (
                            <button
                              type="button"
                              className="cm-large-card-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(selectedMaterialData.ID, file);
                              }}
                              title="Delete PDF resource"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* BOTTOM: INFO & ACTION */}
                        <div className="cm-large-card-footer">
                          <div className="cm-large-card-text">
                            <span className="cm-large-source-label">
                              Document · PDF
                            </span>
                            <h4 className="cm-large-card-title" title={fileName}>
                              {fileName}
                            </h4>
                          </div>

                          <div className="cm-large-card-actions">
                            {isStudent && (
                              <button
                                type="button"
                                className="cm-large-btn-icon-download"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file);
                                }}
                                title="Download PDF"
                              >
                                <Download size={15} />
                              </button>
                            )}

                            <button
                              type="button"
                              className="cm-large-btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSinglePreview(
                                  selectedMaterialData,
                                  file
                                );
                              }}
                            >
                              <Eye size={14} />
                              <span>View PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

        {/* =================================================
            PREVIEW MODAL (ASSESSMENT EVALUATION PATTERN)
        ================================================= */}

        {previewItem && (
          <div className="cm-modal-backdrop" onClick={handleClosePreview}>
            <div
              className="cm-preview-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER */}
              <div className="cm-preview-modal-header">
                <div className="cm-preview-header-left">
                  <div className="cm-preview-icon-wrap">
                    {previewItem.isUrl ? (
                      previewItem.isYouTube ? (
                        <Play size={22} />
                      ) : (
                        <LinkIcon size={22} />
                      )
                    ) : (
                      <FileText size={22} />
                    )}
                  </div>
                  <div>
                    <h2 className="cm-preview-modal-title">
                      {previewItem.isUrl
                        ? previewItem.isYouTube
                          ? "Video Preview"
                          : "URL Preview"
                        : "PDF Preview"}
                    </h2>
                    <p className="cm-preview-modal-subtitle">
                      {previewItem.moduleName
                        ? `${previewItem.moduleName} · `
                        : ""}
                      {previewItem.isYouTube
                        ? (previewItem.materialTitle || "Video")
                        : (previewItem.materialTitle || previewItem.displayName)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cm-preview-modal-close-btn"
                  onClick={handleClosePreview}
                  title="Close Preview"
                >
                  <X size={20} />
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="cm-preview-modal-body">
                <div className="cm-preview-resource-section">
                  {/* SECTION HEADER / TITLE BAR */}
                  {!previewItem.isYouTube && (
                    <div className="cm-preview-section-header">
                      <div className="cm-preview-section-title-wrap">
                        <span className="cm-preview-section-badge">
                          {previewItem.isUrl ? (
                            <>
                              <LinkIcon size={12} /> Web Resource
                            </>
                          ) : (
                            <>
                              <FileText size={12} /> PDF Document
                            </>
                          )}
                        </span>
                        <span className="cm-preview-section-name">
                          {previewItem.displayName}
                        </span>
                      </div>

                      <div className="cm-preview-section-actions">
                        {previewItem.isUrl && (
                          <a
                            href={previewItem.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cm-preview-action-btn"
                            title="Open link in new tab"
                          >
                            <ExternalLink size={13} />
                            <span>Open Link</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* EMBEDDED VIEWER (READ ONLY) */}
                  <div className="cm-preview-embed-box">
                    {previewItem.isUrl ? (
                      previewItem.isYouTube ? (
                        isStudent && previewItem.videoId ? (
                          <CleanVideoPlayer
                            videoId={previewItem.videoId}
                            title={previewItem.materialTitle}
                          />
                        ) : previewItem.embedUrl ? (
                          <div className="cm-preview-video-container">
                            <iframe
                              src={previewItem.embedUrl}
                              title={previewItem.materialTitle || "Video"}
                              className="cm-preview-video-iframe"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="cm-preview-error-box">
                            <p>Unable to load this video.</p>
                          </div>
                        )
                      ) : (
                        <div className="cm-preview-url-container">
                          <iframe
                            src={previewItem.fileUrl}
                            title={previewItem.displayName || "Web Resource"}
                            className="cm-preview-url-iframe"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                          />
                          <div className="cm-preview-url-fallback-bar">
                            <div className="cm-preview-url-fallback-text">
                              <strong>Notice:</strong> If this external website restricts in-frame preview (X-Frame-Options/CSP), you can click to open it directly.
                            </div>
                            <a
                              href={previewItem.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cm-preview-fallback-link-btn"
                            >
                              <ExternalLink size={13} />
                              <span>Open website directly</span>
                            </a>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="cm-preview-pdf-workspace">
                        <div className="cm-preview-pdf-a4-sheet">
                          <iframe
                            src={`${previewItem.fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                            title={previewItem.displayName || "PDF Document"}
                            className="cm-preview-pdf-iframe"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="cm-preview-modal-footer">
                <button
                  type="button"
                  className="cm-preview-modal-footer-close-btn"
                  onClick={handleClosePreview}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            ADD / EDIT MODAL
        ================================================= */}

        {isModalOpen && (
          <div className="cm-modal-overlay">
            <div className="cm-modal">
              {/* =========================
                  MODAL HEADER
              ========================= */}

              <div className="cm-modal-header">
                <div>
                  <h2 className="cm-modal-title">
                    {isEditMode
                      ? "Edit Course Material"
                      : "Add Course Material"}
                  </h2>

                  <p className="cm-modal-subtitle">
                    {isEditMode
                      ? "Update material details and manage resources"
                      : "Add PDF files or URLs"}
                  </p>
                </div>

                <button
                  type="button"
                  className="cm-close-btn"
                  onClick={handleCloseModal}
                  disabled={btnLoading}
                >
                  <X size={20} />
                </button>
              </div>

              {/* =========================
                  MODAL BODY
              ========================= */}

              <div className="cm-modal-body">
                {/* BATCH (MULTI-SELECT) */}

                <div className="cm-form-group" ref={batchDropdownRef}>
                  <div className="cm-batch-label-row">
                    <label>Select Batches *</label>
                    {batches.length > 0 && (
                      <button
                        type="button"
                        className="cm-batch-select-all-btn"
                        onClick={handleSelectAllBatches}
                        disabled={btnLoading}
                      >
                        {selectedBatches.length === batches.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  <div className="cm-multi-select-container">
                    <div
                      className={`cm-multi-select-trigger ${isBatchDropdownOpen ? "open" : ""}`}
                      onClick={() =>
                        !btnLoading && setIsBatchDropdownOpen((prev) => !prev)
                      }
                      tabIndex={0}
                    >
                      <div className="cm-multi-select-trigger-text">
                        {selectedBatches.length === 0 ? (
                          <span className="cm-multi-select-placeholder">
                            Select batches...
                          </span>
                        ) : (
                          <span className="cm-multi-select-count">
                            {selectedBatches.length}{" "}
                            {selectedBatches.length === 1 ? "batch" : "batches"}{" "}
                            selected
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={18}
                        className={`cm-multi-select-arrow ${isBatchDropdownOpen ? "open" : ""}`}
                      />
                    </div>

                    {isBatchDropdownOpen && (
                      <div className="cm-multi-select-menu">
                        {batches.length > 5 && (
                          <div className="cm-multi-select-search-wrap">
                            <input
                              type="text"
                              className="cm-multi-select-search"
                              placeholder="Search batches..."
                              value={batchSearchTerm}
                              onChange={(e) =>
                                setBatchSearchTerm(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        <div className="cm-multi-select-options-list">
                          {batches
                            .filter((b) => {
                              if (!batchSearchTerm.trim()) return true;
                              const term = batchSearchTerm.toLowerCase();
                              return (
                                b.BATCH_CODE &&
                                b.BATCH_CODE.toLowerCase().includes(term)
                              );
                            })
                            .map((batch) => {
                              const isSelected = selectedBatches.includes(
                                Number(batch.ID)
                              );
                              return (
                                <div
                                  key={batch.ID}
                                  className={`cm-multi-select-option ${isSelected ? "selected" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBatch(batch.ID);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="cm-multi-select-checkbox"
                                  />
                                  <div className="cm-multi-select-option-info">
                                    <span className="cm-multi-select-code">
                                      {batch.BATCH_CODE}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                          {batches.filter((b) => {
                            if (!batchSearchTerm.trim()) return true;
                            const term = batchSearchTerm.toLowerCase();
                            return (
                              b.BATCH_CODE &&
                              b.BATCH_CODE.toLowerCase().includes(term)
                            );
                          }).length === 0 && (
                            <div className="cm-multi-select-no-results">
                              No matching batches found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedBatches.length > 0 && (
                    <div className="cm-selected-batches-chips">
                      {selectedBatches.map((bId) => {
                        const batchObj = batches.find(
                          (b) => Number(b.ID) === Number(bId)
                        );
                        const label = batchObj
                          ? batchObj.BATCH_CODE || `Batch #${bId}`
                          : `Batch #${bId}`;
                        return (
                          <span
                            key={bId}
                            className="cm-selected-batch-chip"
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBatch(bId);
                              }}
                              disabled={btnLoading}
                              title={`Remove ${label}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MODULE */}

                <div className="cm-form-group">
                  <label>Module *</label>

                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    disabled={btnLoading}
                  >
                    <option value="">Select Module</option>

                    {modules.map((mod) => (
                      <option key={mod.ID} value={mod.ID}>
                        {mod.MODULE_NAME}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TITLE */}

                <div className="cm-form-group">
                  <label>Title *</label>

                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({
                        ...formData,

                        title: e.target.value,
                      })
                    }
                    placeholder="Enter material title"
                    disabled={btnLoading}
                  />
                </div>

                {/* DESCRIPTION */}

                <div className="cm-form-group">
                  <label>Description</label>

                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,

                        description: e.target.value,
                      })
                    }
                    placeholder="Enter description"
                    disabled={btnLoading}
                  />
                </div>

                {/* =================================================
                    RESOURCE TYPE TOGGLE
                ================================================= */}

                <div className="cm-form-group">
                  <label>Resource Type</label>

                  <div
                    style={{
                      display: "flex",

                      alignItems: "center",

                      justifyContent: "space-between",

                      gap: "15px",

                      padding: "12px 14px",

                      border: "1px solid rgba(255,255,255,0.08)",

                      borderRadius: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",

                        alignItems: "center",

                        gap: "10px",
                      }}
                    >
                      {isUrlMode ? (
                        <LinkIcon size={18} />
                      ) : (
                        <FileText size={18} />
                      )}

                      <div>
                        <strong>
                          {isUrlMode ? "URL Resource" : "PDF File"}
                        </strong>

                        <div
                          style={{
                            fontSize: "12px",

                            opacity: 0.65,

                            marginTop: "2px",
                          }}
                        >
                          {isUrlMode
                            ? "Add a website or learning resource URL"
                            : "Upload PDF files only"}
                        </div>
                      </div>
                    </div>

                    {/* TOGGLE */}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUrlMode((prev) => !prev);

                        setUrlInput("");
                      }}
                      disabled={btnLoading}
                      style={{
                        position: "relative",

                        width: "52px",

                        height: "28px",

                        border: "none",

                        borderRadius: "30px",

                        cursor: btnLoading ? "not-allowed" : "pointer",

                        background: isUrlMode ? "#00e5ff" : "#555",

                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",

                          top: "4px",

                          left: isUrlMode ? "28px" : "4px",

                          width: "20px",

                          height: "20px",

                          borderRadius: "50%",

                          background: "#fff",

                          transition: "0.2s",

                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* =================================================
                    PDF MODE
                ================================================= */}

                {!isUrlMode && (
                  <div className="cm-form-group">
                    <label>PDF Files *</label>

                    <label className="cm-upload-box">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,application/pdf"
                        onChange={handleFileChange}
                        hidden
                        disabled={btnLoading}
                      />

                      <div className="cm-upload-content">
                        <Upload size={28} />

                        <span>Click to upload PDF files</span>

                        <small>PDF files only</small>
                      </div>
                    </label>
                  </div>
                )}

                {/* =================================================
                    URL MODE
                ================================================= */}

                {isUrlMode && (
                  <div className="cm-form-group">
                    <label>URL *</label>

                    <div className="cm-url-row">
  <input
    type="url"
    value={urlInput}
    onChange={(e) => setUrlInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddUrl();
      }
    }}
    placeholder="https://example.com/resource"
    disabled={btnLoading}
    className="cm-url-input"
  />

  <button
    type="button"
    className="cm-url-add-btn"
    onClick={handleAddUrl}
    disabled={btnLoading || !urlInput.trim()}
  >
    <Plus size={16} />
    Add
  </button>
</div>

                    <small
                      style={{
                        display: "block",

                        marginTop: "6px",

                        opacity: 0.65,
                      }}
                    >
                      Only HTTP and HTTPS URLs are allowed.
                    </small>
                  </div>
                )}

                {/* =================================================
                    SELECTED NEW RESOURCES
                ================================================= */}

                {formData.files.length > 0 && (
                  <div className="cm-selected-files">
                    <div className="cm-selected-title">
                      New Resources ({formData.files.length})
                    </div>

                    {formData.files.map((resource, index) => (
                      <div
                        key={`${resource.FILE_NAME || resource.URL}-${index}`}
                        className="cm-selected-item"
                      >
                        <div className="cm-selected-left">
                          <div className="cm-selected-icon">
                            {resource.TYPE === "URL" ? (
                              <LinkIcon size={18} />
                            ) : (
                              <FileText size={18} />
                            )}
                          </div>

                          <div>
                            <div className="cm-selected-name">
                              {resource.TYPE === "URL"
                                ? resource.URL
                                : resource.FILE_NAME}
                            </div>

                            <div className="cm-selected-size">
                              {resource.TYPE === "URL"
                                ? "Web Resource"
                                : resource.FILE?.size
                                  ? `${(resource.FILE.size / 1024).toFixed(
                                      1,
                                    )} KB`
                                  : "PDF"}
                            </div>
                          </div>
                        </div>

                        <div className="cm-selected-right">
                          <span className="cm-file-format">
                            {resource.FORMAT}
                          </span>

                          <button
                            type="button"
                            className="cm-file-remove"
                            onClick={() => handleRemoveNewResource(index)}
                            disabled={btnLoading}
                            title="Remove"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* =================================================
                    EXISTING RESOURCES IN EDIT
                ================================================= */}

                {isEditMode && editingMaterial?.FILES?.length > 0 && (
                  <div className="cm-selected-files">
                    <div className="cm-selected-title">
                      Existing Resources ({editingMaterial.FILES.length})
                    </div>

                    {editingMaterial.FILES.map((file, index) => (
                      <div
                        key={`existing-${file.FILE_PATH || file.URL}-${index}`}
                        className="cm-selected-item"
                      >
                        <div className="cm-selected-left">
                          <div className="cm-selected-icon">
                            {file.TYPE === "URL" || file.FORMAT === "URL" ? (
                              <LinkIcon size={18} />
                            ) : (
                              <FileText size={18} />
                            )}
                          </div>

                          <div>
                            <div className="cm-selected-name">
                              {file.TYPE === "URL" || file.FORMAT === "URL"
                                ? file.URL
                                : file.FILE_NAME || getFileName(file.FILE_PATH)}
                            </div>

                            <div className="cm-selected-size">
                              Existing {file.FORMAT}
                            </div>
                          </div>
                        </div>

                        <div className="cm-selected-right">
                          <span className="cm-file-format">{file.FORMAT}</span>

                          <button
                            type="button"
                            className="cm-file-remove"
                            onClick={() =>
                              handleDeleteFile(editingMaterial.ID, file)
                            }
                            disabled={btnLoading}
                            title="Delete resource"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* =================================================
                  MODAL FOOTER
              ================================================= */}

              <div className="cm-modal-footer">
                <div className="cm-footer-actions">
                  <button
                    type="button"
                    className="cm-btn-clear"
                    onClick={() => {
                      setFormData({
                        title: "",
                        description: "",
                        files: [],
                      });

                      setSelectedBatches([]);

                      setIsBatchDropdownOpen(false);

                      setBatchSearchTerm("");

                      setSelectedModule("");

                      setIsUrlMode(false);

                      setUrlInput("");
                    }}
                    disabled={btnLoading}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className="cm-btn-submit"
                    onClick={handleSave}
                    disabled={btnLoading}
                  >
                    {btnLoading
                      ? "Saving..."
                      : isEditMode
                        ? "Update"
                        : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            DELETE MATERIAL MODAL
        ================================================= */}

        {materialDeleteConfirm.open && (
          <div className="cm-delete-overlay">
            <div className="cm-delete-modal">
              <div className="cm-delete-icon">
                <Trash2 size={24} />
              </div>

              <h3>Delete Course Material?</h3>

              <p>
                Are you sure you want to delete this entire course material?
              </p>

              <div className="cm-delete-material-name">
                {materialDeleteConfirm.material?.TITLE}
              </div>

              <p className="cm-delete-warning">
                This will permanently delete the material and all resources
                associated with it.
              </p>

              <div className="cm-delete-actions">
                <button
                  type="button"
                  className="cm-delete-cancel"
                  onClick={() =>
                    setMaterialDeleteConfirm({
                      open: false,
                      material: null,
                    })
                  }
                  disabled={btnLoading}
                >
                  No
                </button>

                <button
                  type="button"
                  className="cm-delete-confirm"
                  onClick={confirmDeleteMaterial}
                  disabled={btnLoading}
                >
                  {btnLoading ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            DELETE RESOURCE MODAL
        ================================================= */}

        {deleteConfirm.open && (
          <div className="cm-delete-overlay">
            <div className="cm-delete-modal">
              <div className="cm-delete-icon">
                {deleteConfirm.file?.TYPE === "URL" ? (
                  <LinkIcon size={24} />
                ) : (
                  <X size={24} />
                )}
              </div>

              <h3>Delete Resource?</h3>

              <p>Are you sure you want to delete this resource?</p>

              <div className="cm-delete-format">
                {deleteConfirm.file?.TYPE === "URL"
                  ? "URL"
                  : deleteConfirm.file?.FILE_NAME || "PDF"}
              </div>

              <div className="cm-delete-actions">
                <button
                  type="button"
                  className="cm-delete-cancel"
                  onClick={() =>
                    setDeleteConfirm({
                      open: false,

                      materialId: null,

                      file: null,
                    })
                  }
                  disabled={btnLoading}
                >
                  No
                </button>

                <button
                  type="button"
                  className="cm-delete-confirm"
                  onClick={confirmDeleteFile}
                  disabled={btnLoading}
                >
                  {btnLoading ? "Deleting..." : "Yes"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default CourseMaterial;
