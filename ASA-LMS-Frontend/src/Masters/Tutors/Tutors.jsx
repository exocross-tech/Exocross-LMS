import React, { useState, useRef, useEffect } from "react";
import { tutorsApi, usermananagementApi } from "../../services/apiService";
import "./Tutors.css";
import { UserPlus, Star, Mail, Edit, Trash2, X, UserX, Calendar as CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import InputField from "../../components/InputField/InputField";
import BtnSubmit from "../../components/Btn-Submit/Btn-Submit";
import TutorCalendarModal from "./TutorCalendarModal";

import { toast } from "react-toastify";

const Tutors = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState(null);
  const [selectedTutorForCalendar, setSelectedTutorForCalendar] = useState(null);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      designation: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      image: null,
    },
  });

  const handleOpenModal = () => {
    setEditingTutor(null);
    clearForm();
    setIsModalOpen(true);
    setTimeout(() => setFocus("name"), 100);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTutor(null);
    clearForm();
  };
  const submitButtonRef = useRef(null);
  const isFetched = useRef(false);
  const clearForm = () => {
    reset({
      name: "",
      designation: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      image: null,
    });
  };

  const formSubmit = async (data) => {
    if (!editingTutor && data.password !== data.confirmPassword) {
      toast.error("Password and Confirm Password must match");
      return;
    }

    // const payload = new FormData();

    // payload.append("NAME", data.name);
    // payload.append("SCHOOL_NAME", data.designation);
    // payload.append("PHONE", data.phone);
    // payload.append("EMAIL", data.email);

    // if (data.password) {
    //   payload.append("PASSWORD", data.password);
    // }

    // if (data.image && data.image.length > 0) {
    //   payload.append("IMAGE", data.image[0]);
    // }

    let obj = {
      SCHOOL_NAME: data.designation,
      USERNAME: data.name,
      EMAIL_ID: data.email,
      MOBILE_NO: data.phone,
      ADDRESS_LINE1: data.addressLine1 || null,
      ADDRESS_LINE2: data.addressLine2 || null,
      CITY: data.city || null,
      DISTRICT: data.district || null,
      STATE: data.state || null,
      PINCODE: data.pincode || null,
      LANDMARK: data.landmark || null,
      PASSWORD: data.password || null,
      USER_TYPE: "TUTOR",
    };

    try {
      setBtnLoading(true);
      const res = editingTutor
        ? await usermananagementApi.updateUser({
          USER_ID: editingTutor.USER_ID,
          ...obj,
        })
        : await usermananagementApi.addUser(obj);

      if (res?.data?.status == 1) {
        toast.success(
          res?.data?.message ||
          (editingTutor
            ? "Tutor updated successfully"
            : "Tutor added successfully"),
        );

        fetchTutors();
        handleCloseModal();
      } else {
        toast.error(
          res?.data?.message ||
          (editingTutor ? "Failed to update tutor" : "Failed to add tutor"),
        );
      }
    } catch (err) {
      const serverMessage =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.errors) ? err.response.data.errors[0] : null) ||
        err.message ||
        (editingTutor ? "Failed to update tutor" : "Failed to add tutor");
      toast.error(serverMessage);
    } finally {
      setBtnLoading(false);
    }
  };

  const handleEdit = (tutor) => {
    setEditingTutor(tutor);

    reset({
      name: tutor.USERNAME || "",
      designation: tutor.SCHOOL_NAME || "",
      phone: tutor.MOBILE_NO || "",
      email: tutor.EMAIL_ID || "",
      password: "",
      confirmPassword: "",
    });

    setIsModalOpen(true);
  };

  const handleStatusChange = async (id, status) => {
  try {
    // =====================================================
    // ACTIVATE
    // =====================================================

    if (status) {
      const result = await Swal.fire({
        title: "Activate Tutor?",
        text: "This tutor will be activated again.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, activate",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#00c8e8",
        cancelButtonColor: "#64748b",
        background: "#0b1018",
        color: "#e8edf5",
      });

      if (!result.isConfirmed) {
        fetchTutors();
        return;
      }

      const res = await tutorsApi.updateTutorStatus(id, {
        IS_ACTIVE: 1,
      });

      if (res?.data?.status === 1) {
        toast.success(
          res?.data?.message ||
          "Tutor activated successfully"
        );

        fetchTutors();
      } else {
        toast.error(
          res?.data?.message ||
          "Failed to activate tutor"
        );
      }

      return;
    }

    // =====================================================
    // DEACTIVATE - FIRST CHECK
    // =====================================================

    const res = await tutorsApi.updateTutorStatus(id, {
      IS_ACTIVE: 0,
      force: false,
    });

    // =====================================================
    // NO BATCH
    // =====================================================

    if (res?.data?.status === 1) {
      toast.success(
        res?.data?.message ||
        "Tutor deactivated successfully"
      );

      fetchTutors();
      return;
    }

    // =====================================================
    // HAS BATCH - STATUS 3
    // =====================================================

    if (res?.data?.status === 3) {
      const allocations =
        res?.data?.allocations || [];

      const batchList = allocations
        .map((batch) => `
          <div style="
            padding:10px 12px;
            margin:6px 0;
            background:#111923;
            border:1px solid #263445;
            border-radius:7px;
            text-align:left;
          ">
            <div style="
              color:#00c8e8;
              font-weight:700;
              font-size:13px;
            ">
              ${batch.BATCH_CODE || "Unknown Batch"}
            </div>
          </div>
        `)
        .join("");

      const result = await Swal.fire({
  title: "Tutor Already Assigned",

  html: `
    <div style="
      color:#aeb9c8;
      font-size:14px;
      line-height:1.5;
      margin-bottom:12px;
    ">
      This tutor is already assigned to
      <strong style="color:#ffffff;">
        ${allocations.length}
        ${allocations.length === 1 ? "batch" : "batches"}
      </strong>.
    </div>

    <div>
      ${batchList}
    </div>

    <div style="
      margin-top:15px;
      padding:12px;
      border-radius:7px;
      background:#21181a;
      border:1px solid #553036;
      color:#f2a7ad;
      font-size:12px;
      line-height:1.5;
      text-align:left;
    ">
      If you deactivate this tutor,
      Allocation batch data can be deleted.
    </div>

    <div style="
      margin-top:14px;
      color:#d7dde6;
      font-size:13px;
    ">
      Do you want to continue?
    </div>
  `,

  icon: "warning",

  showCancelButton: true,

  confirmButtonText: "Yes, deactivate",
  cancelButtonText: "Cancel",

  confirmButtonColor: "#ef5350",
  cancelButtonColor: "#64748b",

  background: "#0b1018",
  color: "#e8edf5",

  width: "480px",
});

      // ===================================================
      // NO
      // ===================================================

      if (!result.isConfirmed) {
        fetchTutors();
        return;
      }

      // ===================================================
      // YES - REMOVE ALLOCATION + DEACTIVATE
      // ===================================================

      const finalRes =
        await tutorsApi.updateTutorStatus(id, {
          IS_ACTIVE: 0,
          force: true,
        });

      if (finalRes?.data?.status === 1) {
        toast.success(
          finalRes?.data?.message ||
          "Tutor deactivated and batch allocation removed successfully"
        );

        fetchTutors();
      } else {
        toast.error(
          finalRes?.data?.message ||
          "Failed to deactivate tutor"
        );
      }

      return;
    }

    // =====================================================
    // ERROR
    // =====================================================

    toast.error(
      res?.data?.message ||
      "Failed to update tutor status"
    );

    fetchTutors();

  } catch (error) {
    console.error(
      "Tutor status change error:",
      error
    );

    toast.error(
      error?.response?.data?.message ||
      error?.message ||
      "An error occurred while updating tutor status"
    );

    fetchTutors();
  }
};

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchTutors();
    }
  }, []);

  const handleDeleteTutor = async (tutor) => {
    const result = await Swal.fire({
      title: "Delete Tutor?",
      text: `Are you sure you want to delete ${tutor.USERNAME || "this tutor"}? Once deleted cannot be recovered again!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      background: "#0b1018",
      color: "#e8edf5",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const res = await usermananagementApi.deleteUser(tutor.USER_ID);
      if (res?.data?.status === 1) {
        toast.success(res?.data?.message || "Tutor deleted successfully");
        fetchTutors();
      } else {
        toast.error(res?.data?.message || "Failed to delete tutor");
      }
    } catch (err) {
      console.error("Delete tutor error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete tutor");
    }
  };

  const fetchTutors = async () => {
    try {
      setLoading(true);
      const res = await usermananagementApi.getTutors();
      if (res?.data?.status == 1) {
        setTutors(res?.data?.data || []);
      } else {
        setTutors([]);
        toast.error(res?.data?.message || "Failed to fetch tutors");
      }
    } catch (err) {
      toast.error("Failed to fetch tutors");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tutors-container">
      <div className="tutors-header-section">
        <div className="breadcrumb">FULL ACCESS</div>
        <div className="tutors-title-row">
          <h1 className="welcome-text">Tutor Directory</h1>
          <button className="btn-primary" onClick={handleOpenModal}>
            <UserPlus size={18} /> Add tutor
          </button>
        </div>
        <p className="welcome-subtext">
          View, contact and manage every tutor across the program.
        </p>
      </div>

      {loading ? (
        <div className="no-tutors-found">
          <p>Loading tutors...</p>
        </div>
      ) : tutors.length === 0 ? (
        <div className="no-tutors-found">
          <UserX size={48} className="no-tutors-icon" />
          <h3>No Tutors Found</h3>
          <p>There are currently no tutors registered in the system.</p>
          <button className="btn-primary" onClick={handleOpenModal}>
            <UserPlus size={18} /> Add tutor
          </button>
        </div>
      ) : (
        <div className="tutors-grid">
          {tutors.map((tutor) => (
            <div className="tutor-card" key={tutor.USER_ID}>
              {/* <span>{tutor.rating}</span> */}
              <div className="tutor-card-header">
                <div className="tutor-info">
                  <h3>{tutor.USERNAME}</h3>
                  <span className="designation">{tutor.SCHOOL_NAME}</span>
                </div>

                <div className="header-actions">
                  <div
                    className={`status-badge ${tutor.IS_ACTIVE ? "active" : "inactive"}`}
                  >
                    {tutor.IS_ACTIVE ? "ACTIVE" : "INACTIVE"}
                  </div>
                  <button
                    className="icon-btn"
                    title="Edit Tutor"
                    onClick={() => handleEdit(tutor)}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="icon-btn delete-btn"
                    title="Delete Tutor"
                    onClick={() => handleDeleteTutor(tutor)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="tutor-details">
                {/* <div className="tutor-stat">
                  <Star size={14} className="star-icon" />
                  <span>{tutor.rating}</span>
                </div> */}
                <div className="tutor-stat">
                  <Mail size={14} />
                  <span>{tutor.EMAIL_ID}</span>
                </div>
              </div>

              <div className="tutor-actions">
                <div className="tutor-status-toggle">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!tutor.IS_ACTIVE}
                      onChange={(e) =>
                        handleStatusChange(tutor.USER_ID, e.target.checked)
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <button
                  type="button"
                  className="tutor-calendar-toggle-btn"
                  title={`View ${tutor.USERNAME}'s Schedule / Calendar`}
                  onClick={() => setSelectedTutorForCalendar(tutor)}
                >
                  <CalendarIcon size={14} />
                  <span>Calendar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          {" "}
          <div className="modal-content">
            {" "}
            <div className="modal-header">
              {" "}
              <h2>{editingTutor ? "Edit Tutor" : "Add New Tutor"}</h2>{" "}
              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                {" "}
                <X size={20} color="#ffffff" />{" "}
              </button>{" "}
            </div>
            <form onSubmit={handleSubmit(formSubmit)}>
              {" "}
              <div className="tutor-form-grid">
                {" "}
                <div className="form-group full-width">
                  {" "}
                  <InputField
                    name="name"
                    label="Name"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                  />{" "}
                </div>{" "}
                <div className="form-group full-width">
                  {" "}
                  <InputField
                    name="designation"
                    label="Designation"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                  />{" "}
                </div>{" "}
                <div className="form-group">
                  <InputField
                    name="phone"
                    label="Phone Number"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                    validation={{
                      pattern: {
                        value: /^[0-9]{10}$/,
                        message: "Phone number must be exactly 10 digits",
                      },
                      validate: (value) => {
                        const exists = tutors.some(
                          (t) =>
                            String(t.PHONE) === value &&
                            (!editingTutor ||
                              t.USER_ID !== editingTutor.USER_ID),
                        );

                        return exists
                          ? "This phone number is already registered"
                          : true;
                      },
                    }}
                    inputProps={{
                      maxLength: 10,
                      inputMode: "numeric",
                      onInput: (e) => {
                        e.target.value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                      },
                    }}
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="email"
                    label="Mail ID"
                    required={true}
                    type="email"
                    register={register}
                    errors={errors}
                  />
                </div>{" "}
                <div className="form-group full-width">
                  {" "}
                  <InputField
                    name="password"
                    label="Password"
                    required={!editingTutor}
                    type="password"
                    register={register}
                    errors={errors}
                  />{" "}
                </div>{" "}
                <div className="form-group full-width">
                  {" "}
                  <InputField
                    name="confirmPassword"
                    label="Confirm Password"
                    required={!editingTutor}
                    type="password"
                    register={register}
                    errors={errors}
                  />{" "}
                </div>{" "}
                {/*<div className="form-group full-width image-upload-group">
                  <label>Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="file-input"
                    {...register("image")}
                  />
                </div>*/}
              </div>{" "}
              <div className="modal-actions">
                {" "}
                <button
                  type="button"
                  className="btn-clear-custom"
                  onClick={clearForm}
                >
                  {" "}
                  Clear{" "}
                </button>{" "}
                <BtnSubmit
                  type="submit"
                  btnLoading={false}
                  ref={submitButtonRef}
                />{" "}
              </div>{" "}
            </form>
          </div>{" "}
        </div>
      )}

      {selectedTutorForCalendar && (
        <TutorCalendarModal
          tutor={selectedTutorForCalendar}
          onClose={() => setSelectedTutorForCalendar(null)}
        />
      )}
    </div>
  );
};

export default Tutors;
