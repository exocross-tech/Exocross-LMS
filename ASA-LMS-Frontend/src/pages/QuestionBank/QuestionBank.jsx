import React, { useState, useEffect, useRef } from "react";
import {
  questionsApi,
  moduleApi,
} from "../../services/apiService";

import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import QuestionEditor from "../../components/ClassicEditor/ClassicEditor";
import { IoCloseCircleSharp } from "react-icons/io5";
import { ansOptionData, moduleCodeData, difficultyData } from "../../services/dataService";
import "./QuestionBank.css";
import { useNavigate, useLocation } from "react-router-dom";
import { List, UploadCloud, Image as ImageIcon, Trash2, Eye, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import Select from "react-select";
import { extractImagesFromHtml, normalizeCKEditorImages, normalizeImageUrl } from "../../utils/imageUtils";

const DEFAULT_QUESTION_TYPES = [
  { QUESTION_TYPE: "MULTIPLE CHOICE" },
  { QUESTION_TYPE: "FILL IN THE BLANKS" },
  { QUESTION_TYPE: "SHORT ESSAY" },
  { QUESTION_TYPE: "PICTURE LABELLING" },
];

function QuestionBank() {
  const [questionTypeList, setQuestionTypeList] = useState(
    DEFAULT_QUESTION_TYPES,
  );

  const [selectedQuesType, setSelectedQuesType] = useState("");
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const isFetched = useRef(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState(null);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [existingQuestionList, setExistingQuestionList] = useState([]);
  const [moduleOptions, setModuleOptions] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const editQuestion = location.state?.editQuestion;
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [diagramImages, setDiagramImages] = useState([]);

  const userData = JSON.parse(
    sessionStorage.getItem("ASA_LMSUser") ||
    sessionStorage.getItem("SmartExamUser") ||
    localStorage.getItem("user") ||
    "{}",
  );

  const [questionForm, setQuestionForm] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    fillBlankAnswer: [""],
    leftItems: [""],
    multiOptions: [""],
    multiAnswers: [],
    essayAnswer: "",
    labellingAnswer: [],
    sequenceAnswer: [],
    missingWordAnswer: "",
    identifyAnswer: [""],
    jumbleAnswer: "",
  });

  const {
    register,
    setFocus,
    watch,
    reset,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      mark: "",
      difficultyLevel: "",
      multipleChoiceAnswer: "",
      leftItemHeading: "Column A",
      rightItemHeading: "Column B",
    },
  });

  const fetchModules = async () => {
    try {
      const res = await moduleApi.getActive();

      if (res.data.status === 1) {
        const options = res.data.data.map((m) => ({
          value: m.ID,
          label: m.MODULE_NAME,
        }));

        setModuleOptions(options);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load categories");
    }
  };
  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchModules();
    }
  }, []);

  useEffect(() => {
    if (!editQuestion) return;

    console.log("Editing question:", editQuestion);

    setIsEditMode(true);
    setEditQuestionId(editQuestion.ID);

    const selected = moduleOptions.find(
      (m) => Number(m.value) === Number(editQuestion.MODULE_ID)
    );

    setSelectedModule(selected || null);


    reset({
      mark: editQuestion.MARK || "",
      difficultyLevel: editQuestion.DIFFICULTY_LEVEL || "",
      multipleChoiceAnswer: editQuestion.CORRECT_ANSWER || "",
      leftItemHeading: "Column A",
      rightItemHeading: "Column B",
    });

    setSelectedQuesType(editQuestion.QUESTION_TYPE || "");

    setIsCaseSensitive(
      String(editQuestion.IS_CASE_SENSITIVE).toLowerCase() === "true",
    );

    const parseArray = (value, fallback = []) => {
      if (!value) return fallback;

      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;

        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    };

    const parsedLabelling = parseArray(editQuestion.LABELLING_ANSWER, []);

    setQuestionForm({
      question: normalizeCKEditorImages(editQuestion.QUESTION || ""),

      optionA: editQuestion.OPTION_A || "",
      optionB: editQuestion.OPTION_B || "",
      optionC: editQuestion.OPTION_C || "",
      optionD: editQuestion.OPTION_D || "",

      fillBlankAnswer: parseArray(editQuestion.FILLBLANK_ANSWER, [""]),

      leftItems:
        parsedLabelling.length > 0
          ? parsedLabelling.map((_, i) => `Label ${i + 1}`)
          : ["Label 1"],

      multiOptions: parseArray(editQuestion.MULTIPLE_RESPONSE_OPTIONS, [""]),

      multiAnswers: parseArray(editQuestion.MULTIPLE_RESPONSE_ANSWER, []),

      essayAnswer: editQuestion.ESSAY_ANSWER || "",

      labellingAnswer: parsedLabelling,

      sequenceAnswer: parseArray(editQuestion.SEQUENCE_ANSWER, []),

      missingWordAnswer: editQuestion.CORRECT_ANSWER || "",

      identifyAnswer: parseArray(editQuestion.FILLBLANK_ANSWER, [""]),

      jumbleAnswer: editQuestion.CORRECT_ANSWER || "",
    });
    if (editQuestion?.QUESTION) {
      setDiagramImages(extractImagesFromHtml(editQuestion.QUESTION));
    }
  }, [editQuestion, moduleOptions, reset]);

  const formSubmit = async (data) => {
    const obj = {
      ID: editQuestionId,

      MODULE_ID: selectedModule?.value || null,

      QUESTION_TYPE: selectedQuesType,

      MARK: data.mark,

      DIFFICULTY_LEVEL: data.difficultyLevel,

      QUESTION: questionForm.question,

      IS_CASE_SENSITIVE:
        String(isCaseSensitive).charAt(0).toUpperCase() +
        String(isCaseSensitive).slice(1).toLowerCase(),

      OPTION_A: questionForm.optionA || "",
      OPTION_B: questionForm.optionB || "",
      OPTION_C: questionForm.optionC || "",
      OPTION_D: questionForm.optionD || "",

      FILLBLANK_ANSWER:
        selectedQuesType === "FILL IN THE BLANKS"
          ? JSON.stringify(questionForm.fillBlankAnswer || [])
          : selectedQuesType === "SHORT ESSAY" ||
            selectedQuesType === "LONG ESSAY"
            ? JSON.stringify(questionForm.fillBlankAnswer || [])
            : "",

      MULTIPLE_RESPONSE_OPTIONS: questionForm.multiOptions?.length
        ? JSON.stringify(questionForm.multiOptions)
        : "",

      MULTIPLE_RESPONSE_ANSWER: questionForm.multiAnswers?.length
        ? JSON.stringify(questionForm.multiAnswers)
        : "",

      SEQUENCE_ANSWER: questionForm.sequenceAnswer?.length
        ? JSON.stringify(questionForm.sequenceAnswer)
        : "",

      ESSAY_ANSWER: questionForm.essayAnswer || "",

      LABELLING_ANSWER: questionForm.labellingAnswer?.length
        ? JSON.stringify(questionForm.labellingAnswer)
        : "",

      CORRECT_ANSWER: data.multipleChoiceAnswer || "",

      USER_ID: userData?.USER_ID || userData?.userId || userData?.id || 1,
    };

    setBtnLoading(true);

    try {
      let res;

      if (isEditMode) {
        res = await questionsApi.updateQuestion(obj);
      } else {
        res = await questionsApi.addQuestion(obj);
      }

      if (res?.data?.status === 1) {
        toast.success(
          res?.data?.message ||
          (isEditMode
            ? "Question updated successfully!"
            : "Question created successfully!"),
        );

        if (isEditMode) {
          navigate("/question-list");
        } else {
          clearForm();
        }
      } else {
        toast.error(
          res?.data?.message ||
          (isEditMode
            ? "Failed to update question"
            : "Failed to create question"),
        );
      }
    } catch (error) {
      console.error(
        isEditMode ? "Update question error:" : "Create question error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
        (isEditMode
          ? "Failed to update question"
          : "Failed to create question"),
      );
    } finally {
      setBtnLoading(false);
    }
  };

  const clearForm = () => {
    reset({
      mark: "",
      difficultyLevel: "",
      multipleChoiceAnswer: "",
      leftItemHeading: "Column A",
      rightItemHeading: "Column B",
    });

    setSelectedQuesType("");
    setSelectedModule(null);

    setSubmitAttempted(false);

    setQuestionForm({
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      fillBlankAnswer: [""],
      leftItems: [""],
      multiOptions: [""],
      multiAnswers: [],
      essayAnswer: "",
      labellingAnswer: [],
      sequenceAnswer: [],
      missingWordAnswer: "",
      identifyAnswer: [""],
      jumbleAnswer: "",
    });

    setExistingQuestionList([]);
    setIsCaseSensitive(false);
    setDiagramImages([]);
  };


  const openExistingQuestionModal = () => {
    setShowExistingModal(true);
  };

  const closeExistingQuestionModal = () => {
    setShowExistingModal(false);
  };

  const handleEditorChange = (field, value) => {
    setQuestionForm((prev) => ({
      ...prev,
      [field]: normalizeCKEditorImages(value),
    }));
  };

  const [isUploadingDiagram, setIsUploadingDiagram] = useState(false);
  const [activeDiagramIndex, setActiveDiagramIndex] = useState(0);

  // Sync diagramImages if questionForm.question has images and diagramImages is empty
  useEffect(() => {
    if (questionForm.question && diagramImages.length === 0) {
      const extracted = extractImagesFromHtml(questionForm.question);
      if (extracted.length > 0) {
        setDiagramImages(extracted);
      }
    }
  }, [questionForm.question, diagramImages.length]);

  // Combined diagrams list: prefer persistent diagramImages state, fallback to regex extraction
  const currentDiagrams =
    diagramImages.length > 0
      ? diagramImages
      : extractImagesFromHtml(questionForm.question);

  // Synchronize activeDiagramIndex if diagrams are deleted or list changes
  useEffect(() => {
    if (activeDiagramIndex >= currentDiagrams.length && currentDiagrams.length > 0) {
      setActiveDiagramIndex(currentDiagrams.length - 1);
    }
  }, [currentDiagrams.length, activeDiagramIndex]);

  const handleDiagramFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingDiagram(true);
    let successCount = 0;
    const uploadedUrls = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image file`);
        continue;
      }
      try {
        const base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await questionsApi.uploadImage({ image: base64String });
        const rawUrl = res?.data?.default || res?.data?.url || res?.data?.relativeUrl;
        const normalizedUrl = normalizeImageUrl(rawUrl);

        if (normalizedUrl) {
          uploadedUrls.push(normalizedUrl);
          successCount++;
        }
      } catch (err) {
        console.error("Diagram upload error:", err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploadedUrls.length > 0) {
      // 1. Permanently retain previous diagrams and append the new ones!
      setDiagramImages((prev) => {
        const updated = [...prev];
        uploadedUrls.forEach((url) => {
          if (!updated.includes(url)) {
            updated.push(url);
          }
        });
        return updated;
      });

      // 2. Also append <img> tags to questionForm.question so backend saves the full question statement
      const newImgTags = uploadedUrls
        .map((url) => `<p><img src="${url}" alt="Diagram" /></p>`)
        .join("");
      setQuestionForm((prev) => ({
        ...prev,
        question: (prev.question || "") + newImgTags,
      }));

      toast.success(`Added ${successCount} diagram${successCount > 1 ? "s" : ""} successfully!`);
    }

    setIsUploadingDiagram(false);
    e.target.value = "";
  };

  const handleRemoveDiagram = (imgSrcToRemove) => {
    // 1. Remove from persistent diagramImages array
    setDiagramImages((prev) => prev.filter((u) => u !== imgSrcToRemove));

    // 2. Remove from questionForm.question
    if (questionForm.question) {
      const fileNameMatch = imgSrcToRemove.match(/([^\/\s"'?#]+\.(?:png|jpe?g|webp|gif|svg))/i);
      const identifier = fileNameMatch ? fileNameMatch[1] : imgSrcToRemove;

      let html = questionForm.question;
      const figurePattern = new RegExp(`<figure[^>]*>[\\s\\S]*?${identifier}[\\s\\S]*?<\\/figure>`, "gi");
      const pPattern = new RegExp(`<p[^>]*>[\\s\\S]*?<img[^>]+[^>]*${identifier}[^>]*>[\\s\\S]*?<\\/p>`, "gi");
      const imgPattern = new RegExp(`<img[^>]+[^>]*${identifier}[^>]*>`, "gi");

      html = html.replace(figurePattern, "").replace(pPattern, "").replace(imgPattern, "").trim();

      setQuestionForm((prev) => ({
        ...prev,
        question: html,
      }));
    }

    toast.info("Diagram removed");
    setActiveDiagramIndex(0);
  };
  const handleQuestionSubmit = (data) => {
    setSubmitAttempted(true);

    // Category validation
    if (!selectedModule?.value) {
      toast.error("Category is required");
      return;
    }

    formSubmit(data);
  };

  const changeQuestionType = async (type) => {
    setSelectedQuesType(type);
  };

  return (
    <div className="qb-container">
      {/* Page Header */}
      <div className="qb-header-section">
        <div className="qb-header-title-box">
          <span className="qb-breadcrumb">OVERSIGHT / QUESTION BANK</span>

          <div className="qb-header-top">
            <div>
              <h1 className="qb-title">
                {isEditMode ? "Edit Question" : "Create Question"}
              </h1>

              <p className="qb-subtitle">
                {isEditMode
                  ? "Update the existing assessment question."
                  : "Structure and manage high-quality assessment questions for students."}
              </p>
            </div>

            <button
              type="button"
              className="qb-question-list-btn"
              onClick={() => navigate("/question-list")}
            >
              <List size={16} />
              <span>Question List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Parameters Panel */}
      <div className="qb-panel">
        <div className="row g-4">
          <div className="col-md-4">
            <label className="form-label">
              Category <span className="text-danger">*</span>
            </label>

            <Select
              options={moduleOptions}
              value={selectedModule}
              onChange={(option) => {
                setSelectedModule(option);

                // Hide validation message after selecting category
                if (option) {
                  setSubmitAttempted(false);
                }
              }}
              placeholder="Select Category"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: "42px",
                  background: "#111827",

                  borderColor:
                    submitAttempted && !selectedModule?.value
                      ? "#dc3545"
                      : state.isFocused
                        ? "#00e5ff"
                        : "#334155",

                  boxShadow: "none",
                  color: "#fff",
                }),

                menu: (base) => ({
                  ...base,
                  background: "#111827",
                  zIndex: 9999,
                }),

                option: (base, state) => ({
                  ...base,
                  background: state.isFocused
                    ? "#1e293b"
                    : "#111827",
                  color: "#fff",
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
              }}
            />

            {/* Category validation message */}
            {submitAttempted && !selectedModule?.value && (
              <span className="text-danger small mt-1 d-block">
                Category is required
              </span>
            )}
          </div>
          <div className="col-md-4">
            <label className="form-label">
              Question Type <span className="text-danger">*</span>
            </label>
            <select
              className="form-select"
              value={selectedQuesType}
              onChange={(e) => changeQuestionType(e.target.value)}
            >
              <option value="">-- Select Question Type --</option>
              {questionTypeList.map((item, index) => (
                <option value={item.QUESTION_TYPE} key={index}>
                  {item.QUESTION_TYPE}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">
              Give mark for the Question <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min="1"
              className="form-control"
              placeholder="Enter marks (e.g. 5)"
              {...register("mark", { required: "Mark is required" })}
            />
            {errors.mark && (
              <span className="text-danger small mt-1 d-block">
                {errors.mark.message}
              </span>
            )}
          </div>

          <div className="col-md-4 mt-3">
            <label className="form-label">
              Module <span className="text-danger">*</span>
            </label>
            <select
              className="form-select"
              {...register("difficultyLevel", {
                required: "Module is required",
              })}
            >
              <option value="">-- Select Module --</option>
              {moduleCodeData.map((item, index) => (
                <option key={index} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {errors.difficultyLevel && (
              <span className="text-danger small mt-1 d-block">
                {errors.difficultyLevel.message}
              </span>
            )}
          </div>

          {existingQuestionList.length > 0 && (
            <div className="col-md-4 my-auto">
              <button
                type="button"
                className="btn btn-outline-info w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
                onClick={openExistingQuestionModal}
              >
                Existing Questions{" "}
                <span className="badge bg-cyan text-dark fw-bold ms-1">
                  {existingQuestionList.length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Question Rich Editor */}
        {selectedQuesType !== "" && (
          <div className="mt-4">
            <QuestionEditor
              label="Question Statement"
              placeholder="Type your detailed question here..."
              value={questionForm.question}
              onChange={(val) => handleEditorChange("question", val)}
              required={true}
              minHeight="180px"
            />
          </div>
        )}

        {/* Question Type - Multiple Choice */}
        {selectedQuesType === "MULTIPLE CHOICE" && (
          <div className="qb-subcard">
            <div className="qb-subcard-title">Answer Options & Key</div>
            <div className="row g-3">
              <div className="col-md-6">
                <QuestionEditor
                  label="Option A"
                  placeholder="Type Option A..."
                  value={questionForm.optionA}
                  onChange={(val) => handleEditorChange("optionA", val)}
                  minHeight="120px"
                />
              </div>
              <div className="col-md-6">
                <QuestionEditor
                  label="Option B"
                  placeholder="Type Option B..."
                  value={questionForm.optionB}
                  onChange={(val) => handleEditorChange("optionB", val)}
                  minHeight="120px"
                />
              </div>
              <div className="col-md-6">
                <QuestionEditor
                  label="Option C"
                  placeholder="Type Option C..."
                  value={questionForm.optionC}
                  onChange={(val) => handleEditorChange("optionC", val)}
                  minHeight="120px"
                />
              </div>
              <div className="col-md-6">
                <QuestionEditor
                  label="Option D"
                  placeholder="Type Option D..."
                  value={questionForm.optionD}
                  onChange={(val) => handleEditorChange("optionD", val)}
                  minHeight="120px"
                />
              </div>
            </div>
            <div className="col-md-4 mt-3">
              <label className="form-label">
                Correct Answer Option <span className="text-danger">*</span>
              </label>
              <select
                className="form-select upperCase"
                {...register("multipleChoiceAnswer")}
              >
                <option value="">-- Select Answer Option --</option>
                {ansOptionData.map((item, index) => (
                  <option key={index} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Question Type - Fill in the Blanks */}
        {selectedQuesType === "FILL IN THE BLANKS" && (
          <div className="qb-subcard">
            <h6 className="qb-subcard-title">Enter Expected Blank Answers</h6>
            {questionForm.fillBlankAnswer.map((item, index) => (
              <div key={index} className="mb-3 d-flex align-items-center gap-2">
                <input
                  type="text"
                  className="form-control"
                  value={item}
                  placeholder="Enter expected answer phrase"
                  onChange={(e) => {
                    const updated = [...questionForm.fillBlankAnswer];
                    updated[index] = e.target.value;
                    setQuestionForm((prev) => ({
                      ...prev,
                      fillBlankAnswer: updated,
                    }));
                  }}
                />
                <IoCloseCircleSharp
                  size={24}
                  className="cursor-pointer text-danger cursor-pointer"
                  onClick={() => {
                    setQuestionForm((prev) => ({
                      ...prev,
                      fillBlankAnswer: prev.fillBlankAnswer.filter(
                        (_, i) => i !== index,
                      ),
                    }));
                  }}
                />
              </div>
            ))}
            <button
              className="btn btn-sm btn-outline-white mt-2"
              type="button"
              onClick={() =>
                setQuestionForm((prev) => ({
                  ...prev,
                  fillBlankAnswer: [...prev.fillBlankAnswer, ""],
                }))
              }
            >
              + Add Answer Tag
            </button>
          </div>
        )}

        {/* Question Type - Short Essay / Long Essay */}
        {selectedQuesType === "SHORT ESSAY" && (
          <div className="qb-subcard">
            <QuestionEditor
              label="Evaluation Guideline / Model Answer"
              placeholder="Type descriptive model answer or evaluation rubrics..."
              value={questionForm.essayAnswer}
              onChange={(val) => handleEditorChange("essayAnswer", val)}
              minHeight="180px"
            />
            <div className="mt-4">
              <h6 className="qb-subcard-title">Keywords for Auto-Evaluation</h6>
              {questionForm.fillBlankAnswer.map((item, index) => (
                <div
                  key={index}
                  className="mb-3 d-flex align-items-center gap-2"
                >
                  <input
                    type="text"
                    className="form-control"
                    value={item}
                    placeholder="Enter key evaluation phrase"
                    onChange={(e) => {
                      const updated = [...questionForm.fillBlankAnswer];
                      updated[index] = e.target.value;
                      setQuestionForm((prev) => ({
                        ...prev,
                        fillBlankAnswer: updated,
                      }));
                    }}
                  />
                  <IoCloseCircleSharp
                    size={24}
                    className="cursor-pointer text-danger"
                    onClick={() => {
                      setQuestionForm((prev) => ({
                        ...prev,
                        fillBlankAnswer: prev.fillBlankAnswer.filter(
                          (_, i) => i !== index,
                        ),
                      }));
                    }}
                  />
                </div>
              ))}
              <button
                className="btn btn-sm btn-outline-cyan"
                type="button"
                onClick={() =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    fillBlankAnswer: [...prev.fillBlankAnswer, ""],
                  }))
                }
              >
                + Add Keyword
              </button>
            </div>
          </div>
        )}

        {/* Question Type - Picture Labelling */}
        {selectedQuesType === "PICTURE LABELLING" && (
          <>
            {/* 1. Dedicated Multi-Diagram Upload & Management Tray */}
            <div className="qb-subcard">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <UploadCloud className="text-cyan" size={20} />
                    <h6 className="mb-0 fw-bold text-white fs-6">
                      Diagram & Picture Management
                    </h6>
                  </div>
                  <small className="text-secondary d-block">
                    Attach one or multiple diagrams for this question (2 per row: Left & Right).
                  </small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label
                    htmlFor="diagram-file-input"
                    className={`btn btn-sm btn-cyan text-dark fw-bold mb-0 d-flex align-items-center gap-2 ${
                      isUploadingDiagram ? "disabled opacity-75" : ""
                    }`}
                    style={{ cursor: isUploadingDiagram ? "not-allowed" : "pointer" }}
                  >
                    <Plus size={16} />
                    {isUploadingDiagram ? "Uploading..." : "Upload Diagram(s)"}
                  </label>
                  <input
                    id="diagram-file-input"
                    type="file"
                    multiple
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    style={{ display: "none" }}
                    disabled={isUploadingDiagram}
                    onChange={handleDiagramFilesSelected}
                  />
                </div>
              </div>

              {/* Diagrams 2-Column Grid (Left / Right per row) */}
              {currentDiagrams.length > 0 ? (
                <div className="row g-3">
                  {currentDiagrams.map((imgSrc, idx) => {
                    const isSelected = activeDiagramIndex === idx;
                    return (
                      <div key={idx} className="col-12 col-md-6">
                        <div
                          className={`qb-diagram-card ${isSelected ? "is-active" : ""}`}
                          onClick={() => setActiveDiagramIndex(idx)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            backgroundColor: isSelected ? "#0c172e" : "#080e1a",
                            border: isSelected ? "2px solid #00f0ff" : "1px solid #1e293b",
                            borderRadius: "12px",
                            overflow: "hidden",
                            boxShadow: isSelected ? "0 0 16px rgba(0, 240, 255, 0.25)" : "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {/* TOP HEADER: Diagram #, Active in Preview, Delete */}
                          <div
                            className="qb-diagram-card-top"
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "10px 16px",
                              backgroundColor: "#0d1527",
                              borderBottom: "1px solid #1e293b",
                              boxSizing: "border-box",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span
                                className="badge px-2 py-1 fw-bold"
                                style={{
                                  backgroundColor: isSelected ? "#00f0ff" : "#1e293b",
                                  color: isSelected ? "#000" : "#94a3b8",
                                  fontSize: "0.8rem",
                                  borderRadius: "6px",
                                }}
                              >
                                Diagram {idx + 1}
                              </span>
                              {isSelected ? (
                                <span
                                  className="badge small fw-semibold"
                                  style={{
                                    backgroundColor: "rgba(0, 240, 255, 0.15)",
                                    color: "#00f0ff",
                                    border: "1px solid rgba(0, 240, 255, 0.4)",
                                    fontSize: "0.75rem",
                                    borderRadius: "6px",
                                    padding: "3px 8px",
                                  }}
                                >
                                  Active in Live Preview
                                </span>
                              ) : (
                                <span
                                  className="badge small"
                                  style={{
                                    backgroundColor: "rgba(30, 41, 59, 0.6)",
                                    color: "#94a3b8",
                                    border: "1px dashed rgba(148, 163, 184, 0.3)",
                                    fontSize: "0.72rem",
                                    borderRadius: "6px",
                                    padding: "2px 7px",
                                    cursor: "pointer",
                                  }}
                                  title="Click to view this diagram in Live Preview below"
                                >
                                  Click to View in Preview
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm d-inline-flex align-items-center gap-1"
                              title="Delete this diagram"
                              style={{
                                fontSize: "0.75rem",
                                borderRadius: "6px",
                                padding: "4px 10px",
                                backgroundColor: "rgba(239, 68, 68, 0.12)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.35)",
                                fontWeight: 600,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDiagram(imgSrc);
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>

                          {/* CANVAS (BELOW HEADER): 230px height, centered image */}
                          <div
                            className="qb-diagram-canvas"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "100%",
                              height: "230px",
                              backgroundColor: "#040711",
                              padding: "12px",
                              boxSizing: "border-box",
                            }}
                          >
                            <img
                              src={imgSrc}
                              alt={`Diagram ${idx + 1}`}
                              style={{
                                maxHeight: "100%",
                                maxWidth: "100%",
                                objectFit: "contain",
                                borderRadius: "4px",
                              }}
                              onError={(e) => {
                                console.error("Diagram thumbnail load error:", imgSrc);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="p-4 rounded border text-center"
                  style={{
                    backgroundColor: "#070c18",
                    borderColor: "#1e293b",
                    borderStyle: "dashed",
                  }}
                >
                  <ImageIcon size={32} className="text-secondary mb-2" />
                  <p className="text-white fw-semibold mb-1">No diagrams attached yet</p>
                  <p className="text-secondary small mb-3">
                    Click "Upload Diagram(s)" above or select images from your computer. Uploading multiple images will arrange them 2 per line (Left & Right).
                  </p>
                  <label
                    htmlFor="diagram-file-input"
                    className="btn btn-outline-cyan btn-sm px-3"
                    style={{ cursor: "pointer" }}
                  >
                    Select Images from Computer
                  </label>
                </div>
              )}
            </div>

            {/* 2. Responsive 2-Column Label Answers Grid */}
            <div className="qb-subcard mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="qb-subcard-title mb-0">Label Answers & Key Mapping</h6>
                <span className="badge bg-secondary text-light fw-normal">
                  {questionForm.leftItems?.length || 0} Labels Configured
                </span>
              </div>
              <div className="row g-3">
                {questionForm?.leftItems?.map((_, index) => (
                  <div key={index} className="col-md-6">
                    <div
                      className="p-2 rounded border d-flex align-items-center gap-2"
                      style={{ backgroundColor: "#0b1220", borderColor: "#1e293b" }}
                    >
                      <span
                        className="qb-option-badge flex-shrink-0"
                        style={{
                          background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(0, 240, 255, 0.05))",
                          border: "1px solid rgba(0, 240, 255, 0.4)",
                          color: "#00f0ff",
                          fontWeight: 700,
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        placeholder={`Answer key for label ${index + 1}`}
                        value={questionForm.labellingAnswer[index] || ""}
                        onChange={(e) => {
                          const updated = [...questionForm.labellingAnswer];
                          updated[index] = e.target.value;
                          setQuestionForm((prev) => ({
                            ...prev,
                            labellingAnswer: updated,
                          }));
                        }}
                      />
                      {questionForm.leftItems.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-1 flex-shrink-0"
                          title="Remove label"
                          onClick={() => {
                            setQuestionForm((prev) => ({
                              ...prev,
                              leftItems: prev.leftItems.filter((_, i) => i !== index),
                              labellingAnswer: prev.labellingAnswer.filter(
                                (_, i) => i !== index,
                              ),
                            }));
                          }}
                        >
                          <IoCloseCircleSharp size={22} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-sm btn-outline-cyan mt-3 d-inline-flex align-items-center gap-1"
                type="button"
                onClick={() =>
                  setQuestionForm((prev) => ({
                    ...prev,
                    leftItems: [
                      ...prev.leftItems,
                      `Label ${prev.leftItems.length + 1}`,
                    ],
                    labellingAnswer: [...prev.labellingAnswer, ""],
                  }))
                }
              >
                <Plus size={16} /> Add Label Key
              </button>
            </div>

            {/* 3. Dedicated Picture & Labelling Live Preview */}
            <div id="qb-live-preview-section" className="qb-subcard mt-4">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: "1.25rem",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid #1e293b",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Eye className="text-cyan" size={20} />
                  <h6 className="mb-0 fw-bold text-white fs-6">
                    Picture Labelling Live Preview
                  </h6>
                </div>
                <span
                  className="badge px-3 py-1 fw-bold"
                  style={{
                    backgroundColor: "#00f0ff",
                    color: "#000",
                    fontSize: "0.8rem",
                    borderRadius: "6px",
                  }}
                >
                  Interactive Preview
                </span>
              </div>

              {currentDiagrams.length > 0 ? (
                <>
                  {/* Multi-diagram switcher tabs if > 1 image */}
                  {currentDiagrams.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="text-secondary small fw-semibold me-1">Showing:</span>
                      {currentDiagrams.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`btn btn-sm ${
                            activeDiagramIndex === idx
                              ? "btn-cyan text-dark fw-bold"
                              : "btn-outline-secondary text-white"
                          }`}
                          style={{ borderRadius: "6px", fontSize: "0.8rem", padding: "4px 10px" }}
                          onClick={() => setActiveDiagramIndex(idx)}
                        >
                          Diagram {idx + 1}
                        </button>
                      ))}
                      <span className="badge bg-dark border border-secondary text-cyan ms-auto">
                        Diagram {activeDiagramIndex + 1} of {currentDiagrams.length}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                      gap: "1.5rem",
                      alignItems: "start",
                      width: "100%",
                    }}
                  >
                    {/* Diagram Preview Column */}
                    <div
                      style={{
                        backgroundColor: "#060910",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "16px",
                        minHeight: "340px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                        width: "100%",
                      }}
                    >
                      <img
                        src={currentDiagrams[activeDiagramIndex] || currentDiagrams[0]}
                        alt={`Diagram ${activeDiagramIndex + 1}`}
                        style={{
                          maxHeight: "380px",
                          maxWidth: "100%",
                          objectFit: "contain",
                          boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
                          borderRadius: "8px",
                        }}
                        onError={(e) => {
                          console.error(
                            "Preview image load error:",
                            currentDiagrams[activeDiagramIndex] || currentDiagrams[0]
                          );
                        }}
                      />
                    </div>

                    {/* Configured Keys Column */}
                    <div
                      style={{
                        backgroundColor: "#0d1527",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "16px",
                        boxSizing: "border-box",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem",
                          paddingBottom: "0.5rem",
                          borderBottom: "1px solid #1e293b",
                        }}
                      >
                        <h6 className="fw-semibold text-white mb-0" style={{ fontSize: "0.95rem" }}>
                          Configured Label Keys
                        </h6>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: "#070c18",
                            border: "1px solid #00f0ff",
                            color: "#00f0ff",
                            fontSize: "0.75rem",
                            borderRadius: "6px",
                            padding: "4px 8px",
                          }}
                        >
                          {questionForm.leftItems?.length || 0} Keys
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          maxHeight: "380px",
                          overflowY: "auto",
                          paddingRight: "4px",
                        }}
                      >
                        {questionForm.leftItems?.map((_, idx) => {
                          const ansKey = questionForm.labellingAnswer[idx];
                          const hasKey = Boolean(ansKey && ansKey.trim());
                          return (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                backgroundColor: "#060910",
                                border: hasKey
                                  ? "1px solid rgba(0, 240, 255, 0.35)"
                                  : "1px solid #1e293b",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                gap: "10px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  overflow: "hidden",
                                  flex: 1,
                                }}
                              >
                                <span
                                  style={{
                                    backgroundColor: hasKey ? "#00f0ff" : "#1e293b",
                                    color: hasKey ? "#000" : "#94a3b8",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    borderRadius: "6px",
                                    width: "28px",
                                    height: "28px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                <span
                                  className="text-truncate"
                                  style={{
                                    color: hasKey ? "#ffffff" : "#94a3b8",
                                    fontWeight: 500,
                                    fontSize: "0.85rem",
                                  }}
                                  title={ansKey || "Pending"}
                                >
                                  {hasKey ? (
                                    ansKey
                                  ) : (
                                    <span style={{ color: "#f59e0b", fontStyle: "italic", fontSize: "0.8rem" }}>
                                      Answer key pending
                                    </span>
                                  )}
                                </span>
                              </div>
                              {hasKey ? (
                                <span
                                  style={{
                                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                                    color: "#10b981",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    fontSize: "0.75rem",
                                    borderRadius: "6px",
                                    padding: "3px 8px",
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  Ready
                                </span>
                              ) : (
                                <span
                                  style={{
                                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                                    color: "#f59e0b",
                                    border: "1px solid rgba(245, 158, 11, 0.25)",
                                    fontSize: "0.75rem",
                                    borderRadius: "6px",
                                    padding: "3px 8px",
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  Empty
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className="p-4 rounded border text-center"
                  style={{
                    backgroundColor: "#070c18",
                    borderColor: "#1e293b",
                    color: "#94a3b8",
                  }}
                >
                  <p className="mb-1 fw-semibold fs-6">📷 No Diagram Image Detected</p>
                  <small>
                    Upload one or more diagrams above. Once added, the live interactive preview will automatically display here.
                  </small>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Bar */}
        {selectedQuesType !== "" && (
          <div className="qb-actions-bar">
            <button type="button" className="qb-btn-clear" onClick={clearForm}>
              Clear Form
            </button>
            <button
              type="button"
              className="qb-btn-preview"
              onClick={handleSubmit(handleQuestionSubmit)}
              disabled={btnLoading}
            >
              {btnLoading
                ? isEditMode
                  ? "Updating..."
                  : "Submitting..."
                : isEditMode
                  ? "Update Question"
                  : "Submit Question"}
            </button>
          </div>
        )}
      </div>

      {/* Existing Questions Modal */}
      {showExistingModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content qb-modal-content">
              <div className="modal-header qb-modal-header">
                <h5 className="modal-title">
                  Existing Questions ({existingQuestionList.length})
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeExistingQuestionModal}
                ></button>
              </div>
              <div
                className="modal-body qb-modal-body"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                <table className="qb-matching-table">
                  <thead>
                    <tr>
                      <th className="p-3 bg-dark text-white">#</th>
                      <th className="p-3 bg-dark text-white">Question</th>
                      <th className="p-3 bg-dark text-white">Mark</th>
                      <th className="p-3 bg-dark text-white">Module</th>
                      <th className="p-3 bg-dark text-white">Answer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingQuestionList.map((q, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td
                          dangerouslySetInnerHTML={{
                            __html: normalizeCKEditorImages(
                              q.QUESTION || q.question || ""
                            ),
                          }}
                        />
                        <td>{q.MARK || q.mark}</td>
                        <td>{q.DIFFICULTY_LEVEL || q.difficultyLevel}</td>
                        <td>{q.CORRECT_ANSWER || q.correctAnswer || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer qb-modal-footer">
                <button
                  type="button"
                  className="qb-btn-clear"
                  onClick={closeExistingQuestionModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionBank;
