import React, { useEffect, useState, useRef } from "react";
import "./UserManagement.css";
import { usermananagementApi } from "../../services/apiService";
import { Edit, Eye, EyeOff, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Select from "react-select";
import { State, City } from "country-state-city";
import { usersTableHeading } from "../../services/tableHeading";
import { userTypeData } from "../../services/dataService";

import ClientSideTable from "../../components/ClientSideTable/ClientSideTable";
import InputField from "../../components/InputField/InputField";
import BtnAdd from "../../components/Btn-Add/BtnAdd";
import BtnSubmit from "../../components/Btn-Submit/Btn-Submit";
import BtnClear from "../../components/Btn-Clear/Btn-Clear";
import formatDate from "../../utils/formatDate";

const UserManagement = () => {
  const [loading, setLoading] = useState(false);
  const [stateOptions, setStateOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [btnLoading, setBtnLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const submitButtonRef = useRef(null);
  const isFetched = useRef(false);

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
      userType: "",
      password: "",
      confirmPassword: "",
    });

    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedCity(null);

    setDistrictOptions([]);
    setCityOptions([]);
  };
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    reset,
    watch,
    formState: { errors },
  } = useForm();

  const selectedUserType = watch("userType");

  useEffect(() => {
    if (selectedUserType === "ADMIN" || selectedUserType === "TUTOR") {
      setValue("schoolName", "");
    }
  }, [selectedUserType, setValue]);

  const handleEnterFocus = (e, nextFieldName) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setFocus(nextFieldName);
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
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
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usermananagementApi.getUsers();
      if (res?.data?.status == 1) {
        const userList = (res?.data?.data || []).map((u) => ({
          ...u,
          ID: u.USER_ID,
          LAST_LOGIN: u.LAST_LOGIN ? formatDate(u.LAST_LOGIN) : "Never",
        }));
        setUsers(userList);
      } else {
        setUsers([]);
        toast.error(res?.data?.message || "Failed to fetch users");
      }
    } catch (err) {
      toast.error("Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setEditingUser(null);
    clearForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    clearForm();
    setEditingUser(null);
    setIsModalOpen(false);
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

  const handleEdit = (user) => {
    setEditingUser(user);
    const stateObj = stateOptions.find((s) => s.label === user.STATE);
    setSelectedState(stateObj || null);
    if (stateObj) {
      const cities = City.getCitiesOfState("IN", stateObj.value).map((c) => ({
        value: c.name,
        label: c.name,
      }));
      setDistrictOptions(cities);
      setCityOptions(cities);
      setSelectedDistrict(
        cities.find((c) => c.label === user.DISTRICT) || null,
      );
      setSelectedCity(cities.find((c) => c.label === user.CITY) || null);
    }
    reset({
      schoolName: user.SCHOOL_NAME || "",
      username: user.USERNAME || "",
      emailId: user.EMAIL_ID || "",
      mobileNo: user.MOBILE_NO || "",
      addressLine1: user.ADDRESS_LINE1 || "",
      addressLine2: user.ADDRESS_LINE2 || "",
      state: user.STATE || "",
      district: user.DISTRICT || "",
      city: user.CITY || "",
      pincode: user.PINCODE || "",
      landmark: user.LANDMARK || "",
      userType: user.USER_TYPE || "",
      password: "",
      confirmPassword: "",
    });
    setIsModalOpen(true);
  };
  const handleToggle = async (id, checked) => {
    try {
      const result = await Swal.fire({
        title: checked ? "Activate User?" : "Deactivate User?",
        text: checked
          ? "Do you want to activate this user?"
          : "Do you want to deactivate this user?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: checked ? "#2563eb" : "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: checked ? "Yes, Activate" : "Yes, Deactivate",
        cancelButtonText: "Cancel",
      });
      if (!result.isConfirmed) return;
      await usermananagementApi.updateUserStatus({
        USER_ID: id,
        IS_ACTIVE: checked ? 1 : 0,
      });
      fetchUsers();
      toast.success(
        checked
          ? "User activated successfully"
          : "User deactivated successfully",
      );
    } catch (err) {
      console.log(err);
      toast.error("Unable to update user status");
    }
  };
  const handleSubmitForm = async (data) => {
    if (!editingUser && data.password !== data.confirmPassword) {
      toast.error("Password and Confirm Password must match");
      return;
    }
    const obj = {
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
      USER_TYPE: data.userType || "",
      PASSWORD: data.password || "",
    };
    setBtnLoading(true);
    try {
      if (editingUser) {
        const updateObj = { USER_ID: editingUser.USER_ID, ...obj };
        await usermananagementApi.updateUser(updateObj);
        toast.success("User updated successfully");
      } else {
        await usermananagementApi.addUser(obj);
        toast.success("User created successfully");
      }
      fetchUsers();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || err.message || "Failed to save user",
      );
    } finally {
      setBtnLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await usermananagementApi.deleteUser(id);
      if (res?.data?.status === 1) {
        toast.success(res?.data?.message || "User deleted successfully");
        fetchUsers();
      } else {
        toast.error(res?.data?.message || "Failed to delete user");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete user");
    }
  };

  return (
    <div className="bc-container">
      <div className="bc-header-section">
        <div className="bc-breadcrumb">USER MANAGEMENT</div>

        <div className="bc-title-row">
          <div className="bc-title-left">
            <h1 className="bc-title">User Management</h1>
            <p className="bc-subtitle">Manage and monitor system users.</p>
          </div>
          <BtnAdd name="Add User" onClick={handleOpenModal} />
        </div>
      </div>
      <ClientSideTable
        title=""
        columns={usersTableHeading}
        data={users}
        loading={loading}
        actions={true}
        onEdit={handleEdit}
        handleDelete={handleDelete}
        onChangeStatus={handleToggle}
        keysToSearch={["USERNAME", "EMAIL_ID", "MOBILE_NO"]}
      />
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingUser ? "Edit User" : "Add New User"}</h2>
              <button
                type="button"
                className="batch-modal-close-btn"
                onClick={handleCloseModal}
              >
                <X size={20} color="#ffffff" />
              </button>
            </div>
            <div>
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
                    nextFieldName="userType"
                  />
                </div>
                <div className="form-group">
                  <label>User Type *</label>
                  <select
                    className="user-type-select"
                    {...register("userType", {
                      required: "User type is required",
                    })}
                  >
                    {" "}
                    {userTypeData.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {" "}
                        {option.label}{" "}
                      </option>
                    ))}{" "}
                  </select>
                  {errors.userType && (
                    <span className="error-text">
                      {errors.userType.message}
                    </span>
                  )}
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
                  <InputField
                    name="mobileNo"
                    label="Phone Number"
                    required={true}
                    type="text"
                    register={register}
                    errors={errors}
                    handleEnterFocus={handleEnterFocus}
                    nextFieldName="schoolName"
                    validation={{
                      required: "Phone number is required",
                      pattern: {
                        value: /^[0-9]{10}$/,
                        message: "Phone number must be exactly 10 digits",
                      },
                      // validate: (value) => {
                      //   const exists = users.some(
                      //     (u) =>
                      //       u.MOBILE_NO === value &&
                      //       (!editingUser || u.USER_ID !== editingUser.USER_ID),
                      //   );
                      //   return exists
                      //     ? "This phone number is already registered"
                      //     : true;
                      // },
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
                    name="schoolName"
                    label="School Name"
                    type="text"
                    register={register}
                    errors={errors}
                    disabled={
                      selectedUserType === "ADMIN" ||
                      selectedUserType === "TUTOR"
                    }
                  />
                </div>
                <div className="form-group">
                  <InputField
                    name="landmark"
                    label="Landmark"
                    type="text"
                    register={register}
                    errors={errors}
                  />{" "}
                </div>{" "}
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
                {!editingUser && (
                  <>
                    <div className="form-group">
                      <label>
                        Password <span>*</span>
                      </label>

                      <div className="password-box">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter Password"
                          {...register("password", {
                            required: "Password is required",
                          })}
                        />

                        <button
                          type="button"
                          className="eye-icon"
                          onClick={() => setShowPassword((prev) => !prev)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {errors.password && (
                        <span className="error-text">
                          {errors.password.message}
                        </span>
                      )}
                    </div>
                    <div className="form-group">
                      {" "}
                      <label>
                        {" "}
                        Confirm Password <span>*</span>{" "}
                      </label>{" "}
                      <div className="password-box">
                        {" "}
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Enter Confirm Password"
                          {...register("confirmPassword", {
                            required: "Confirm password is required",
                            validate: (value) =>
                              value === watch("password") ||
                              "Password and Confirm Password must match",
                          })}
                        />{" "}
                        <button
                          type="button"
                          className="eye-icon"
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          tabIndex={-1}
                        >
                          {" "}
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}{" "}
                        </button>{" "}
                      </div>{" "}
                      {errors.confirmPassword && (
                        <span className="error-text">
                          {" "}
                          {errors.confirmPassword.message}{" "}
                        </span>
                      )}{" "}
                    </div>
                  </>
                )}
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
    </div>
  );
};

export default UserManagement;
