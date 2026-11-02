import React, { useEffect, useState, useRef } from "react";
import "./StudentCreation.css";
import { studentsApi, usermananagementApi } from "../../services/apiService";
import { Eye, EyeOff, X, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Select from "react-select";
import { State, City } from "country-state-city";
import * as XLSX from "xlsx";
import { studentsTableHeading } from "../../services/tableHeading";

import ClientSideTable from "../../components/ClientSideTable/ClientSideTable";
import InputField from "../../components/InputField/InputField";
import BtnAdd from "../../components/Btn-Add/BtnAdd";
import BtnSubmit from "../../components/Btn-Submit/Btn-Submit";
import BtnClear from "../../components/Btn-Clear/Btn-Clear";
import formatDate from "../../utils/formatDate";

const StudentCreation = () => {
  const [loading, setLoading] = useState(false);
  const [stateOptions, setStateOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [btnLoading, setBtnLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkBtnLoading, setBulkBtnLoading] = useState(false);
  const [bulkValidationErrors, setBulkValidationErrors] = useState([]);
  const [bulkPreviewStudents, setBulkPreviewStudents] = useState([]);
  const [isValidatingFile, setIsValidatingFile] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: "",
    username: "",
    emailId: "",
    mobileNo: "",
    addressLine1: "",
    addressLine2: "",
    state: "",
    district: "",
    city: "",
    pincode: "",
    landmark: "",
    userType: "STUDENT",
    password: "",
    confirmPassword: "",
  });
  const gradeOptions = [
    { value: 6, label: "Grade 6" },
    { value: 7, label: "Grade 7" },
    { value: 8, label: "Grade 8" },
    { value: 9, label: "Grade 9" },
    { value: 10, label: "Grade 10" },
    { value: 11, label: "Grade 11" },
    { value: 12, label: "Grade 12" },
  ];
  const submitButtonRef = useRef(null);
  const isFetched = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    reset,
    watch,
    formState: { errors },
  } = useForm();

  const clearForm = () => {
    reset({
      schoolName: "",
      username: "",
      emailId: "",
      mobileNo: "",
      addressLine1: "",
      addressLine2: "",
      state: "",
      district: "",
      city: "",
      pincode: "",
      landmark: "",
      grade: "",
      password: "",
      confirmPassword: "",
    });

    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedCity(null);

    setDistrictOptions([]);
    setCityOptions([]);
  };

  const handleEnterFocus = (e, nextFieldName) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setFocus(nextFieldName);
    }
  };

  useEffect(() => {
    const states = State.getStatesOfCountry("IN").map((state) => ({
      value: state.isoCode,
      label: state.name,
    }));

    setStateOptions(states);

    if (!isFetched.current) {
      isFetched.current = true;
      fetchStudents();
    }
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await usermananagementApi.getStudents();
      if (res?.data?.status == 1) {
        const allUsers = res?.data?.data || [];
        const studentList = allUsers
          .filter((u) => u.USER_TYPE === "STUDENT" || !u.USER_TYPE)
          .map((u) => ({
            ...u,
            ID: u.USER_ID,
            LAST_LOGIN: u.LAST_LOGIN ? formatDate(u.LAST_LOGIN) : "Never",
          }));
        setStudents(studentList.length > 0 ? studentList : allUsers);
      } else {
        setStudents([]);
        toast.error(res?.data?.message || "Failed to fetch students");
      }
    } catch (err) {
      toast.error("Failed to fetch students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setEditingStudent(null);
    clearForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    clearForm();
    setEditingStudent(null);
    setIsModalOpen(false);
  };

  const handleOpenBulkModal = () => {
    setBulkFile(null);
    setBulkValidationErrors([]);
    setBulkPreviewStudents([]);
    setIsBulkModalOpen(true);
  };

  const handleCloseBulkModal = () => {
    setBulkFile(null);
    setBulkValidationErrors([]);
    setBulkPreviewStudents([]);
    setIsBulkModalOpen(false);
  };

  const normalizeKey = (key) => {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  };

  const FIELD_ALIASES = {
    USER_NAME: [
      "username",
      "user_name",
      "studentname",
      "student_name",
      "name",
      "student",
      "studentfullname",
      "student_full_name",
      "fullname",
      "full_name",
    ],
    GRADE: [
      "grade",
      "class",
      "schoolgrade",
      "school_grade",
      "gradelevel",
      "grade_level",
      "classgrade",
      "class_grade",
      "standard",
      "std",
    ],
    SCHOOL_NAME: [
      "schoolname",
      "school_name",
      "school",
      "institutionname",
      "institution_name",
      "institution",
    ],
    MOBILE_NO: [
      "mobileno",
      "mobile_no",
      "mobilenumber",
      "mobile_number",
      "mobile",
      "phone",
      "phoneno",
      "phone_no",
      "phonenumber",
      "phone_number",
      "contactnumber",
      "contact_number",
      "contactno",
      "contact_no",
      "contact",
    ],
    EMAIL: [
      "email",
      "emailid",
      "email_id",
      "emailaddress",
      "email_address",
      "e_mail",
      "e_mailid",
      "e_mail_id",
    ],
  };

  const detectHeaderColumns = (headerKeys) => {
    const normKeys = headerKeys.map(normalizeKey);

    const checkField = (aliasList) => {
      return aliasList.some((alias) => normKeys.includes(normalizeKey(alias)));
    };

    const detected = {
      USER_NAME: checkField(FIELD_ALIASES.USER_NAME),
      GRADE: checkField(FIELD_ALIASES.GRADE),
      SCHOOL_NAME: checkField(FIELD_ALIASES.SCHOOL_NAME),
      MOBILE_NO: checkField(FIELD_ALIASES.MOBILE_NO),
      EMAIL: checkField(FIELD_ALIASES.EMAIL),
    };

    const missing = [];
    if (!detected.USER_NAME) missing.push("User Name");
    if (!detected.GRADE) missing.push("Grade");
    if (!detected.SCHOOL_NAME) missing.push("School Name");
    if (!detected.MOBILE_NO) missing.push("Mobile No");
    if (!detected.EMAIL) missing.push("Email");

    return { detected, missing, isValid: missing.length === 0 };
  };

  const extractStudentFromRow = (row) => {
    if (!row || typeof row !== "object") return null;

    const normalizedEntries = Object.entries(row).map(([origKey, val]) => ({
      normKey: normalizeKey(origKey),
      val: val !== null && val !== undefined ? String(val).trim() : "",
    }));

    const getFieldValue = (aliasList) => {
      for (const alias of aliasList) {
        const normAlias = normalizeKey(alias);
        const match = normalizedEntries.find((entry) => entry.normKey === normAlias);
        if (match && match.val !== "") {
          return match.val;
        }
      }
      for (const alias of aliasList) {
        const normAlias = normalizeKey(alias);
        const match = normalizedEntries.find((entry) => entry.normKey === normAlias);
        if (match) {
          return match.val;
        }
      }
      return "";
    };

    return {
      userName: getFieldValue(FIELD_ALIASES.USER_NAME),
      rawGrade: getFieldValue(FIELD_ALIASES.GRADE),
      schoolName: getFieldValue(FIELD_ALIASES.SCHOOL_NAME),
      rawMobile: getFieldValue(FIELD_ALIASES.MOBILE_NO),
      email: getFieldValue(FIELD_ALIASES.EMAIL),
    };
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setBulkFile(file);
    setBulkValidationErrors([]);
    setBulkPreviewStudents([]);
    setIsValidatingFile(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
        setBulkValidationErrors([
          { row: "-", studentName: "-", errors: ["Excel sheet is empty or invalid."] },
        ]);
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const nonEmptyRows = jsonRows.filter((row) => {
        if (!row || typeof row !== "object") return false;
        return Object.values(row).some((v) => v !== null && String(v).trim() !== "");
      });

      if (nonEmptyRows.length === 0) {
        setBulkValidationErrors([
          { row: "-", studentName: "-", errors: ["Excel sheet contains no student rows."] },
        ]);
        return;
      }

      // 1. Validate Headers (Order-agnostic, alias-aware, ignoring extra columns like S.No)
      const rawKeys = Object.keys(nonEmptyRows[0] || {});
      const { missing: missingHeaders, isValid: isHeaderValid } = detectHeaderColumns(rawKeys);

      if (!isHeaderValid) {
        setBulkValidationErrors([
          {
            row: "Header",
            studentName: "Column Headers",
            errors: [
              `Invalid Excel format. Required columns are: User Name, Grade, School Name, Mobile No, Email. Missing: ${missingHeaders.join(", ")}`,
            ],
          },
        ]);
        return;
      }

      // 2. Validate Rows
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\d{10}$/;
      const allowedGrades = [6, 7, 8, 9, 10, 11, 12];

      const rowErrors = [];
      const parsedStudents = [];
      const seenEmails = new Map();
      const seenMobiles = new Map();

      nonEmptyRows.forEach((row, idx) => {
        const excelDisplayRow = idx + 2;
        const extracted = extractStudentFromRow(row);
        const { userName, rawGrade, schoolName, rawMobile, email } = extracted;

        const issues = [];

        // USER NAME
        if (!userName) {
          issues.push("User Name is required");
        }

        // GRADE
        let numGrade = null;
        if (!rawGrade) {
          issues.push("Grade is required");
        } else {
          numGrade = Number(rawGrade);
          if (isNaN(numGrade) || !allowedGrades.includes(numGrade)) {
            issues.push(`Grade must be numeric and between 6 and 12 (received: "${rawGrade}")`);
          }
        }

        // SCHOOL NAME
        if (!schoolName) {
          issues.push("School Name is required");
        }

        // MOBILE NO
        const cleanMobile = rawMobile.replace(/\D/g, "");
        if (!rawMobile) {
          issues.push("Mobile No is required");
        } else if (!phoneRegex.test(cleanMobile)) {
          issues.push("Mobile number must be exactly 10 digits");
        }

        // EMAIL
        if (!email) {
          issues.push("Email is required");
        } else if (!emailRegex.test(email.toLowerCase())) {
          issues.push("Invalid email address format");
        }

        // Check internal duplicate email
        const cleanEmail = email.toLowerCase().trim();
        if (cleanEmail && emailRegex.test(cleanEmail)) {
          if (seenEmails.has(cleanEmail)) {
            issues.push(
              `Duplicate email "${cleanEmail}" found in sheet (matches Row ${seenEmails.get(cleanEmail)})`
            );
          } else {
            seenEmails.set(cleanEmail, excelDisplayRow);
          }
        }

        // Check internal duplicate mobile
        if (cleanMobile && phoneRegex.test(cleanMobile)) {
          if (seenMobiles.has(cleanMobile)) {
            issues.push(
              `Duplicate mobile number "${cleanMobile}" found in sheet (matches Row ${seenMobiles.get(cleanMobile)})`
            );
          } else {
            seenMobiles.set(cleanMobile, excelDisplayRow);
          }
        }

        if (issues.length > 0) {
          rowErrors.push({
            row: excelDisplayRow,
            studentName: userName || `Row ${excelDisplayRow}`,
            errors: issues,
          });
        } else {
          parsedStudents.push({
            userName: userName,
            grade: numGrade,
            schoolName: schoolName,
            mobileNo: cleanMobile,
            email: cleanEmail,
          });
        }
      });

      if (rowErrors.length > 0) {
        setBulkValidationErrors(rowErrors);
        setBulkPreviewStudents([]);
      } else {
        setBulkValidationErrors([]);
        setBulkPreviewStudents(parsedStudents);
      }
    } catch (err) {
      console.error("Excel parse error:", err);
      setBulkValidationErrors([
        { row: "-", studentName: "-", errors: ["Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file."] },
      ]);
    } finally {
      setIsValidatingFile(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!bulkFile) {
      toast.error("Please select an Excel sheet file");
      return;
    }

    if (bulkValidationErrors.length > 0) {
      toast.error("Please fix all validation errors before adding students.");
      return;
    }

    if (!bulkPreviewStudents || bulkPreviewStudents.length === 0) {
      toast.error("No valid students ready for upload.");
      return;
    }

    setBulkBtnLoading(true);

    try {
      const payload = {
        students: bulkPreviewStudents,
      };

      const res = await usermananagementApi.bulkAddStudents(payload);

      if (res.data.status === 1) {
        toast.success(res.data.message || `Successfully added ${bulkPreviewStudents.length} students.`);
        await fetchStudents();
        handleCloseBulkModal();
      } else {
        if (res.data.errors && Array.isArray(res.data.errors)) {
          setBulkValidationErrors(res.data.errors);
          setBulkPreviewStudents([]);
        }
        toast.error(res.data.message || "Bulk student creation failed");
      }
    } catch (err) {
      console.error("Bulk upload error:", err);
      const resData = err.response?.data;
      if (resData?.errors && Array.isArray(resData.errors)) {
        setBulkValidationErrors(resData.errors);
        setBulkPreviewStudents([]);
      }
      toast.error(
        resData?.message ||
          err.message ||
          "Failed to upload students",
      );
    } finally {
      setBulkBtnLoading(false);
    }
  };

  const handleStateChange = (selected) => {
    setSelectedState(selected);
    setSelectedDistrict(null);
    setSelectedCity(null);
    setValue("state", selected?.label || "");
    setValue("district", "");
    setValue("city", "");
    const cities = City.getCitiesOfState("IN", selected.value).map((c) => ({
      value: c.name,
      label: c.name,
    }));
    setDistrictOptions(cities);
    setCityOptions(cities);
  };

  const handleDistrictChange = (selected) => {
    setSelectedDistrict(selected);
    setValue("district", selected?.label || "");
  };

  const handleCityChange = (selected) => {
    setSelectedCity(selected);
    setValue("city", selected?.label || "");
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    const stateObj = stateOptions.find((s) => s.label === student.STATE);
    setSelectedState(stateObj || null);
    if (stateObj) {
      const cities = City.getCitiesOfState("IN", stateObj.value).map((c) => ({
        value: c.name,
        label: c.name,
      }));
      setDistrictOptions(cities);
      setCityOptions(cities);
      setSelectedDistrict(
        cities.find((c) => c.label === student.DISTRICT) || null,
      );
      setSelectedCity(cities.find((c) => c.label === student.CITY) || null);
    }
    reset({
      schoolName: student.SCHOOL_NAME || "",
      username: student.USERNAME || "",
      emailId: student.EMAIL_ID || "",
      mobileNo: student.MOBILE_NO || "",
      addressLine1: student.ADDRESS_LINE1 || "",
      addressLine2: student.ADDRESS_LINE2 || "",
      state: student.STATE || "",
      district: student.DISTRICT || "",
      city: student.CITY || "",
      pincode: student.PINCODE || "",
      landmark: student.LANDMARK || "",
      grade: student.GRADE || "",
      password: "",
      confirmPassword: "",
    });
    setIsModalOpen(true);
  };

  const handleToggle = async (id, checked) => {
    try {
      const result = await Swal.fire({
        title: checked ? "Activate Student?" : "Deactivate Student?",
        text: checked
          ? "Do you want to activate this student?"
          : "Do you want to deactivate this student?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: checked ? "#2563eb" : "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: checked ? "Yes, Activate" : "Yes, Deactivate",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) return;

      const res = await studentsApi.updateStudentStatus(id, {
        isActive: checked ? 1 : 0,
      });

      // Student has batch allocation
      if (res.data.status === 3) {
        const allocation = res.data.allocations || [];

        const allocationText = allocation.length
          ? allocation
              .map(
                (item) =>
                  item.BATCH_CODE || "Batch",
              )
              .join("\n")
          : "";

        const confirm = await Swal.fire({
          title: "Student Already Assigned",
          text:
            res.data.message + (allocationText ? `\n\n${allocationText}` : ""),
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#64748b",
          confirmButtonText: "Yes, Deactivate",
          cancelButtonText: "Cancel",
        });

        if (!confirm.isConfirmed) return;

        // Force deactivation and remove allocation
        const forceRes = await studentsApi.updateStudentStatus(id, {
          isActive: 0,
          force: true,
        });

        if (forceRes.data.status === 1) {
          toast.success(
            forceRes.data.message || "Student deactivated successfully",
          );
          await fetchStudents();
        }

        return;
      }

      if (res.data.status === 1) {
        toast.success(
          checked
            ? "Student activated successfully"
            : "Student deactivated successfully",
        );

        await fetchStudents();
      } else {
        toast.error(res.data.message || "Unable to update student status");
      }
    } catch (err) {
      console.error("Student status update error:", err);

      toast.error(
        err.response?.data?.message || "Unable to update student status",
      );
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await usermananagementApi.deleteUser(id);
      if (res?.data?.status === 1) {
        toast.success(res.data.message || "Student deleted successfully");
        fetchStudents();
      } else {
        toast.error(res?.data?.message || "Failed to delete student");
      }
    } catch (err) {
      console.error("Delete student error:", err);
      toast.error(
        err.response?.data?.message || "Failed to delete student",
      );
    }
  };

  const handleSubmitForm = async (data) => {
    let obj = {
      SCHOOL_NAME: data.schoolName || "",
      USERNAME: data.username || "",
      EMAIL_ID: data.emailId || "",
      MOBILE_NO: data.mobileNo || "",
      ADDRESS_LINE1: data.addressLine1 || "",
      ADDRESS_LINE2: data.addressLine2 || "",
      CITY: data.city || "",
      DISTRICT: data.district || "",
      STATE: data.state || "",
      PINCODE: data.pincode || "",
      LANDMARK: data.landmark || "",
      GRADE: data.grade ? Number(data.grade) : null,
      USER_TYPE: "STUDENT",
    };
    setBtnLoading(true);
    try {
      if (editingStudent) {
        await usermananagementApi.updateUser({
          USER_ID: editingStudent.USER_ID || editingStudent.USER_ID,
          ...obj,
        });
        toast.success("Student updated successfully");
      } else {
        await usermananagementApi.addUser(obj);
        toast.success("Student created successfully");
      }
      fetchStudents();
      setIsModalOpen(false);
      clearForm();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          (editingStudent
            ? "Failed to update student"
            : "Failed to create student"),
      );
    } finally {
      setBtnLoading(false);
    }
  };

  const mobileValidation = {
    required: "Phone number is required",
    minLength: { value: 10, message: "Phone number must be 10 digits" },
    maxLength: { value: 10, message: "Phone number must be 10 digits" },
    pattern: { value: /^[0-9]+$/, message: "Only numbers are allowed" },
  };
  const mobileInputProps = {
    maxLength: 10,
    inputMode: "numeric",
    onInput: (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
    },
  };

  return (
    <div className="bc-container">
      <div className="bc-header-section">
        <div className="bc-breadcrumb">STUDENT MANAGEMENT</div>

        <div className="bc-title-row">
          <div className="bc-title-left">
            <h1 className="bc-title">Student Creation</h1>
            <p className="bc-subtitle">Create and manage student records.</p>
          </div>
          <div className="title-actions-group">
            <button
              type="button"
              className="btn-bulk-add"
              onClick={handleOpenBulkModal}
            >
              <Upload size={18} />
              <span>Bulk Add Students</span>
            </button>
            <BtnAdd name="Add Student" onClick={handleOpenModal} />
          </div>
        </div>
      </div>
      <ClientSideTable
        title=""
        columns={studentsTableHeading}
        data={students}
        loading={loading}
        actions={true}
        onEdit={handleEdit}
        handleDelete={handleDelete}
        onChangeStatus={handleToggle}
        keysToSearch={["USERNAME", "SCHOOL_NAME", "EMAIL_ID", "MOBILE_NO"]}
        pagination={false}
      />
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingStudent ? "Edit Student" : "Add New Student"}</h2>
              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseModal}
              >
                <X size={20} color="#ffffff" />
              </button>
            </div>
            <div className="student-form-wrapper">
              <div className="user-form-grid">
                <div className="form-group">
                  <InputField
                    name="username"
                    label="User Name "
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                    handleEnterFocus={handleEnterFocus}
                    nextFieldName="schoolName"
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="schoolName"
                    label="School Name"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                    handleEnterFocus={handleEnterFocus}
                    nextFieldName="emailId"
                  />
                </div>
                <div className="form-group">
                  <label>
                    Grade <span>*</span>
                  </label>

                  <Select
                    value={
                      gradeOptions.find(
                        (option) =>
                          Number(option.value) === Number(watch("grade")),
                      ) || null
                    }
                    options={gradeOptions}
                    onChange={(selected) => {
                      setValue("grade", selected?.value || "", {
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Select Grade"
                    className="user-react-select"
                    classNamePrefix="react-select"
                    isSearchable={false}
                  />

                  {errors.grade && (
                    <span className="error-text">{errors.grade.message}</span>
                  )}

                  <input
                    type="hidden"
                    {...register("grade", {
                      required: "Grade is required",
                    })}
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="emailId"
                    label="Email"
                    required={true}
                    type="email"
                    register={register}
                    errors={errors}
                    handleEnterFocus={handleEnterFocus}
                    nextFieldName="mobileNo"
                  />
                </div>
                <div className="form-group">
                  {" "}
                  <InputField
                    name="mobileNo"
                    label="Phone Number"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                    validation={mobileValidation}
                    inputProps={mobileInputProps}
                    handleEnterFocus={handleEnterFocus}
                    nextFieldName="addressLine1"
                  />{" "}
                </div>

                <div className="form-group">
                  <label>Address Line 1</label>
                  <textarea
                    {...register("addressLine1")}
                    placeholder="Enter Address Line 1"
                    rows={3}
                  />
                  {errors.addressLine1 && (
                    <span className="error-text">
                      {errors.addressLine1.message}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Address Line 2</label>
                  <textarea
                    {...register("addressLine2")}
                    placeholder="Enter Address Line 2"
                    rows={3}
                  />
                  {errors.addressLine2 && (
                    <span className="error-text">
                      {errors.addressLine2.message}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>State</label>
                  <Select
                    value={selectedState}
                    options={stateOptions}
                    onChange={handleStateChange}
                    placeholder="Select State"
                    className="user-react-select"
                    classNamePrefix="react-select"
                    isSearchable={false}
                  />
                </div>
                {/* DISTRICT */}
                <div className="form-group">
                  <label>District</label>
                  <Select
                    value={selectedDistrict}
                    options={districtOptions}
                    onChange={handleDistrictChange}
                    placeholder="Select District"
                    className="user-react-select"
                    classNamePrefix="react-select"
                    isSearchable={false}
                    isDisabled={!selectedState}
                  />
                </div>
                {/* CITY */}
                <div className="form-group">
                  <label>City</label>
                  <Select
                    value={selectedCity}
                    options={cityOptions}
                    onChange={handleCityChange}
                    placeholder="Select City"
                    className="user-react-select"
                    classNamePrefix="react-select"
                    isSearchable={false}
                    isDisabled={!selectedState}
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="pincode"
                    label="Pincode"
                    type="number"
                    register={register}
                    errors={errors}
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="landmark"
                    label="Landmark"
                    type="text"
                    register={register}
                    errors={errors}
                  />
                </div>
              </div>
              <div className="modal-actions right-align">
                <BtnClear formReset={clearForm} />
                <BtnSubmit
                  onClick={handleSubmit(handleSubmitForm)}
                  btnLoading={btnLoading}
                  ref={submitButtonRef}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content bulk-modal-content">
            <div className="modal-header">
              <h2>Bulk Add Students</h2>
              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseBulkModal}
              >
                <X size={20} color="#ffffff" />
              </button>
            </div>
            <form onSubmit={handleBulkSubmit}>
              <div className="bulk-form-body">
                {/* File Upload Box */}
                <div className="form-group">
                  <label>
                    Upload Excel Sheet{" "}
                    <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div className="excel-file-upload-box">
                    <input
                      type="file"
                      id="excelFileInput"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="excelFileInput"
                      className="file-upload-label"
                    >
                      <Upload size={28} color="#38bdf8" />
                      <span>
                        {bulkFile
                          ? bulkFile.name
                          : "Click to select Excel file (.xlsx, .xls, .csv)"}
                      </span>
                    </label>
                  </div>
                  {bulkFile && (
                    <span className="file-selected-text">
                      Selected file: <strong>{bulkFile.name}</strong> (
                      {Math.round(bulkFile.size / 1024)} KB)
                    </span>
                  )}
                </div>

                {/* Validation Errors Display */}
                {bulkValidationErrors.length > 0 && (
                  <div className="bulk-errors-box">
                    <div className="bulk-errors-header">
                      <span className="error-title">
                        ❌ Excel Validation Failed ({bulkValidationErrors.length} issues)
                      </span>
                      <span className="error-subtitle">
                        Zero students were inserted. Please fix the errors in your Excel file and upload again.
                      </span>
                    </div>
                    <div className="bulk-errors-list">
                      {bulkValidationErrors.map((errItem, idx) => (
                        <div key={idx} className="bulk-error-item">
                          <span className="bulk-error-row-badge">
                            Row {errItem.row}
                          </span>
                          <div className="bulk-error-details">
                            {errItem.studentName && errItem.studentName !== "-" && (
                              <span className="bulk-error-student-name">
                                {errItem.studentName}:
                              </span>
                            )}
                            <ul className="bulk-error-ul">
                              {errItem.errors.map((msg, mIdx) => (
                                <li key={mIdx}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bulk Preview Section */}
                {bulkPreviewStudents.length > 0 && bulkValidationErrors.length === 0 && (
                  <div className="bulk-preview-section">
                    <div className="bulk-preview-header">
                      <span className="bulk-ready-badge">
                        ✓ {bulkPreviewStudents.length} student{bulkPreviewStudents.length > 1 ? "s" : ""} ready to insert
                      </span>
                    </div>
                    <div className="bulk-preview-table-wrapper">
                      <table className="bulk-preview-table">
                        <thead>
                          <tr>
                            <th style={{ width: "40px" }}>#</th>
                            <th>User Name</th>
                            <th>Grade</th>
                            <th>School Name</th>
                            <th>Mobile No</th>
                            <th>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreviewStudents.map((st, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td><strong>{st.userName}</strong></td>
                              <td>
                                <span className="grade-pill">Grade {st.grade}</span>
                              </td>
                              <td>{st.schoolName}</td>
                              <td>{st.mobileNo}</td>
                              <td>{st.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions right-align">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCloseBulkModal}
                >
                  Cancel
                </button>

                {bulkPreviewStudents.length > 0 && bulkValidationErrors.length === 0 && (
                  <button
                    type="button"
                    className="btn-add-students-submit"
                    onClick={handleBulkSubmit}
                    disabled={bulkBtnLoading || isValidatingFile}
                  >
                    {bulkBtnLoading ? "Adding Students..." : `Add Students (${bulkPreviewStudents.length})`}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCreation;
