import React, { useEffect, useState } from "react";
import Select from "react-select";
import {
  User,
  Mail,
  Phone,
  MapPin,
  School,
  Hash,
  MapPinned,
  Building2,
  Globe2,
  Pencil,
  Save,
  X,
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "react-toastify";
import { usersApi } from "../../services/apiService";
import { formatStudentRollNo } from "../../utils/formatRollNo";
import "./Profile.css";

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password Management State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCardPassword, setShowCardPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const gradeOptions = [
    { value: "6", label: "Grade 6" },
    { value: "7", label: "Grade 7" },
    { value: "8", label: "Grade 8" },
    { value: "9", label: "Grade 9" },
    { value: "10", label: "Grade 10" },
    { value: "11", label: "Grade 11" },
    { value: "12", label: "Grade 12" },
  ];

const [editForm, setEditForm] = useState({
  USERNAME: "",
  EMAIL_ID: "",
  MOBILE_NO: "",
  SCHOOL_NAME: "",
  ROLL_NO: "",
  GRADE: "",
  ADDRESS_LINE1: "",
  ADDRESS_LINE2: "",
  CITY: "",
  DISTRICT: "",
  STATE: "",
  PINCODE: "",
  LANDMARK: "",
});
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (!storedUser) {
        toast.error("User session not found");
        return;
      }

      const parsedUser = JSON.parse(storedUser);

      const userId =
        parsedUser?.USER_ID || parsedUser?.userId || parsedUser?.id;

      if (!userId) {
        toast.error("User ID not found");
        return;
      }

      const res = await usersApi.getProfile(userId);

      if (res.data.status === 1) {
        console.log("PROFILE DATA:", res.data.data);
  setProfile(res.data.data);

  setEditForm({
  USERNAME: res.data.data.USERNAME || "",
  EMAIL_ID: res.data.data.EMAIL_ID || "",
  MOBILE_NO: res.data.data.MOBILE_NO || "",
  SCHOOL_NAME: res.data.data.SCHOOL_NAME || "",
  ROLL_NO: res.data.data.ROLL_NO || "",
  GRADE: res.data.data.GRADE || "",
  ADDRESS_LINE1: res.data.data.ADDRESS_LINE1 || "",
  ADDRESS_LINE2: res.data.data.ADDRESS_LINE2 || "",
  CITY: res.data.data.CITY || "",
  DISTRICT: res.data.data.DISTRICT || "",
  STATE: res.data.data.STATE || "",
  PINCODE: res.data.data.PINCODE || "",
  LANDMARK: res.data.data.LANDMARK || "",
});
} else {
        toast.error(res.data.message || "Failed to load profile");
      }
    } catch (err) {
      console.error("Profile fetch error:", err);

      toast.error(err.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-loader"></div>
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

if (!profile) {
  return (
    <div className="profile-page">
      <div className="profile-empty">
        <User size={30} />
        <span>Profile information not available.</span>
      </div>
    </div>
  );
}

const isStudent =
  String(profile.USER_TYPE || "").trim().toUpperCase() === "STUDENT";

const fullAddress = [
  profile.ADDRESS_LINE1,
  profile.ADDRESS_LINE2,
  profile.LANDMARK,
  profile.CITY,
  profile.DISTRICT,
  profile.STATE,
  profile.PINCODE,
]
  .filter(Boolean)
  .join(", ");

  const getInitials = (name) => {
    if (!name) return "U";

    return name
      .trim()
      .split(" ")
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  };

  const handleSaveProfile = async () => {
  if (!editForm.USERNAME.trim()) {
    toast.error("Username is required");
    return;
  }

  if (!editForm.EMAIL_ID.trim()) {
    toast.error("Email is required");
    return;
  }

  if (!editForm.MOBILE_NO.trim()) {
    toast.error("Mobile number is required");
    return;
  }

  try {
    setSaving(true);

    const res = await usersApi.updateProfile(
      profile.USER_ID,
      editForm
    );

    if (res.data.status === 1) {
      toast.success(res.data.message);

      setIsEditing(false);

      // Reload latest profile from database
      await fetchProfile();
    } else {
      toast.error(
        res.data.message || "Failed to update profile"
      );
    }

  } catch (err) {
    console.error("Update profile error:", err);

    toast.error(
      err.response?.data?.message ||
      "Failed to update profile"
    );
  } finally {
    setSaving(false);
  }
};

const handleCancelEdit = () => {
  setIsEditing(false);

  setEditForm({
    USERNAME: profile.USERNAME || "",
    EMAIL_ID: profile.EMAIL_ID || "",
    MOBILE_NO: profile.MOBILE_NO || "",
    SCHOOL_NAME: profile.SCHOOL_NAME || "",
    ROLL_NO: profile.ROLL_NO || "",
    GRADE: profile.GRADE || "",
    ADDRESS_LINE1: profile.ADDRESS_LINE1 || "",
    ADDRESS_LINE2: profile.ADDRESS_LINE2 || "",
    CITY: profile.CITY || "",
    DISTRICT: profile.DISTRICT || "",
    STATE: profile.STATE || "",
    PINCODE: profile.PINCODE || "",
    LANDMARK: profile.LANDMARK || "",
  });
};

const handleClearForm = () => {
  setEditForm({
    USERNAME: "",
    EMAIL_ID: "",
    MOBILE_NO: "",
    SCHOOL_NAME: "",
    ROLL_NO: "",
    GRADE: "",
    ADDRESS_LINE1: "",
    ADDRESS_LINE2: "",
    CITY: "",
    DISTRICT: "",
    STATE: "",
    PINCODE: "",
    LANDMARK: "",
  });
};

const handleOpenPasswordModal = () => {
  setPasswordForm({ oldPassword: "", password: "", confirmPassword: "" });
  setShowOldPassword(false);
  setShowPassword(false);
  setShowConfirmPassword(false);
  setPasswordModalOpen(true);
};

const handleClosePasswordModal = () => {
  setPasswordModalOpen(false);
  setPasswordForm({ oldPassword: "", password: "", confirmPassword: "" });
  setShowOldPassword(false);
  setShowPassword(false);
  setShowConfirmPassword(false);
};

const handleSavePassword = async (e) => {
  if (e) e.preventDefault();

  if (profile?.IS_PASSWORD_CHANGED) {
    if (!passwordForm.oldPassword) {
      toast.error("Old password is required");
      return;
    }
  }

  if (!passwordForm.password) {
    toast.error("Password is required");
    return;
  }

  if (passwordForm.password.length < 6) {
    toast.error("Password must be at least 6 characters");
    return;
  }

  if (passwordForm.password !== passwordForm.confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }

  try {
    setPasswordSaving(true);
    const res = await usersApi.changePassword({
      userId: profile.USER_ID || profile.userId || profile.id,
      oldPassword: passwordForm.oldPassword,
      password: passwordForm.password,
      confirmPassword: passwordForm.confirmPassword,
    });

    if (res.data.status === 1) {
      toast.success(res.data.message || "Password updated successfully");
      handleClosePasswordModal();
      await fetchProfile();
    } else {
      toast.error(res.data.message || "Failed to update password");
    }
  } catch (err) {
    console.error("Save password error:", err);
    toast.error(err.response?.data?.message || "Failed to update password");
  } finally {
    setPasswordSaving(false);
  }
};
  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
  <div>
    <div className="profile-label">
      <User size={13} />
      <span>MY ACCOUNT</span>
    </div>

    <h1>My Profile</h1>

    <p>View and manage your account information.</p>
  </div>

  {!isEditing && (
    <button
      type="button"
      className="profile-edit-btn"
      onClick={() => setIsEditing(true)}
    >
      <Pencil size={16} />
      <span>Edit Profile</span>
    </button>
  )}
</div>

      {!isEditing && (
  <div className="profile-layout">
        {/* LEFT PROFILE CARD */}
        <aside className="profile-sidebar">
          <div className="profile-cover">
            <div className="profile-glow"></div>
          </div>

          <div className="profile-user">
            <div className="profile-avatar">
              {getInitials(profile.USERNAME)}
            </div>

            <h2>{profile.USERNAME || "User"}</h2>

            <p className="profile-email">
              {profile.EMAIL_ID || "Email not available"}
            </p>

            <div className="profile-id">
              <Hash size={13} />
              <span>User ID: {profile.USER_ID}</span>
            </div>
          </div>

          <div className="profile-divider"></div>

          <div className="profile-sidebar-info">
            <div className="sidebar-info-item">
              <div className="sidebar-icon">
                <Mail size={16} />
              </div>

              <div>
                <span>Email</span>
                <strong>{profile.EMAIL_ID || "-"}</strong>
              </div>
            </div>

            <div className="sidebar-info-item">
              <div className="sidebar-icon">
                <Phone size={16} />
              </div>

              <div>
                <span>Mobile</span>
                <strong>{profile.MOBILE_NO || "-"}</strong>
              </div>
            </div>
     </div>
        </aside>

        {/* RIGHT CONTENT */}
        <main className="profile-details">
          {/* Personal Information */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-icon">
                <User size={18} />
              </div>

              <div>
                <h2>Personal Information</h2>
                <p>Your basic account information</p>
              </div>
            </div>

            <div className="profile-grid">

  <div className="profile-field">
    <span>USERNAME</span>
    <div className="profile-value">
      <User size={15} />
      <strong>{profile.USERNAME || "-"}</strong>
    </div>
  </div>

  <div className="profile-field">
    <span>EMAIL ADDRESS</span>
    <div className="profile-value">
      <Mail size={15} />
      <strong>{profile.EMAIL_ID || "-"}</strong>
    </div>
  </div>

  <div className="profile-field">
    <span>MOBILE NUMBER</span>
    <div className="profile-value">
      <Phone size={15} />
      <strong>{profile.MOBILE_NO || "-"}</strong>
    </div>
  </div>

  <div className="profile-field">
    <span>USER ID</span>
    <div className="profile-value">
      <Hash size={15} />
      <strong>#{profile.USER_ID}</strong>
    </div>
  </div>

</div>
          </section>
{/* ================= SCHOOL INFORMATION ================= */}
{isStudent && (
  <section className="profile-card school-information-card">
    <div className="profile-card-header">
      <div className="profile-card-icon">
        <School size={18} />
      </div>

      <div>
        <h2>School Information</h2>
        <p>Institution details associated with your account</p>
      </div>
    </div>

    <div className="profile-grid">

      {/* SCHOOL NAME */}
      <div className="profile-field">
        <span>SCHOOL NAME</span>

        <div className="profile-value">
          <Building2 size={15} />
          <strong>
            {profile.SCHOOL_NAME || "-"}
          </strong>
        </div>
      </div>

      {/* ENROL ID */}
      <div className="profile-field">
        <span>ENROL ID</span>

        <div className="profile-value">
          <Hash size={15} />
          <strong>
            {formatStudentRollNo(profile.ROLL_NO)}
          </strong>
        </div>
      </div>

      {/* GRADE */}
      <div className="profile-field">
        <span>GRADE</span>

        <div className="profile-value">
          <School size={15} />
          <strong>
            {profile.GRADE !== null &&
            profile.GRADE !== undefined &&
            profile.GRADE !== ""
              ? `Grade ${profile.GRADE}`
              : "-"}
          </strong>
        </div>
      </div>

    </div>
  </section>
)}

{/* ================= SECURITY & CREDENTIALS ================= */}
<section className="profile-card security-credentials-card">
  <div className="profile-card-header">
    <div className="profile-card-icon">
      <ShieldCheck size={18} />
    </div>

    <div>
      <h2>Security & Credentials</h2>
      <p>Manage and update your account login password</p>
    </div>
  </div>

  <div className="security-credentials-grid">
    {/* ACCOUNT PASSWORD */}
    <div className="security-credential-card">
      <div className="credential-icon-title">
        <div className="credential-badge-icon">
          <Lock size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="credential-title-row">
            <h3>Account Password</h3>
            {profile.IS_PASSWORD_CHANGED ? (
              <span className="credential-status active">
                <CheckCircle2 size={12} /> Custom Set
              </span>
            ) : (
              <span className="credential-status default-badge">
                <Phone size={11} /> Default (Phone Number)
              </span>
            )}
          </div>
          <span className="credential-desc">
            {profile.IS_PASSWORD_CHANGED
              ? "Your primary account password has been personalized."
              : isStudent
              ? "Your primary login password (default is your registered mobile number)."
              : "Your primary account password for LMS login."}
          </span>

          {/* Current / Account Password Display with Eye Toggle */}
          <div className="credential-current-pass-box">
            <div className="current-pass-info">
              <span className="current-pass-lbl">
                {profile.IS_PASSWORD_CHANGED
                  ? "CURRENT PASSWORD"
                  : "CURRENT / DEFAULT PASSWORD"}
              </span>
              <span className="current-pass-val">
                {showCardPassword
                  ? (profile.PASSWORD || profile.MOBILE_NO || profile.DEFAULT_PASSWORD || "-")
                  : "••••••••••"}
              </span>
            </div>
            <button
              type="button"
              className="credential-pass-toggle"
              onClick={() => setShowCardPassword(!showCardPassword)}
              title={showCardPassword ? "Hide password" : "Show password"}
            >
              {showCardPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showCardPassword ? "Hide" : "Show"}</span>
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="security-btn-action"
        onClick={handleOpenPasswordModal}
      >
        <Lock size={14} />
        <span>Change Password</span>
      </button>
    </div>
  </div>
</section>
          {/* Address */}
          <section className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-icon">
                <MapPin size={18} />
              </div>

              <div>
                <h2>Address Information</h2>
                <p>Your registered address details</p>
              </div>
            </div>

            <div className="address-box">
              <div className="address-icon">
                <MapPinned size={20} />
              </div>

              <div>
                <span>REGISTERED ADDRESS</span>

                <strong>{fullAddress || "Address not available"}</strong>
              </div>
            </div>

            <div className="profile-grid address-grid">
              <div className="profile-field">
                <span>CITY</span>

                <div className="profile-value">
                  <MapPin size={15} />
                  <strong>{profile.CITY || "-"}</strong>
                </div>
              </div>

              <div className="profile-field">
                <span>DISTRICT</span>

                <div className="profile-value">
                  <MapPin size={15} />
                  <strong>{profile.DISTRICT || "-"}</strong>
                </div>
              </div>

              <div className="profile-field">
                <span>STATE</span>

                <div className="profile-value">
                  <Globe2 size={15} />
                  <strong>{profile.STATE || "-"}</strong>
                </div>
              </div>

              <div className="profile-field">
                <span>LANDMARK</span>

                <div className="profile-value">
                  <MapPinned size={15} />
                  <strong>{profile.LANDMARK || "-"}</strong>
                </div>
              </div>

              <div className="profile-field">
                <span>PINCODE</span>

                <div className="profile-value">
                  <Hash size={15} />
                  <strong>{profile.PINCODE || "-"}</strong>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      )}
{isEditing && (
  <div className="profile-edit-overlay">
    <div className="profile-edit-modal">

      {/* ================= FIXED HEADER ================= */}
      <div className="profile-edit-modal-header">
        <div>
          <h2>Edit User</h2>
          <p>Update your account information</p>
        </div>

        <button
          type="button"
          className="profile-modal-close"
          onClick={handleCancelEdit}
        >
          <X size={20} />
        </button>
      </div>


      {/* ================= SCROLLABLE FORM BODY ================= */}
      <div className="profile-edit-body">

        {/* ================= PERSONAL INFORMATION ================= */}
        <section className="edit-section">

          <div className="edit-section-header">
            <div className="edit-section-icon">
              <User size={18} />
            </div>

            <div>
              <h3>Personal Information</h3>
              <span>Update your personal account details</span>
            </div>
          </div>

          <div className="edit-form-grid">

            <div className="edit-form-field">
              <label>
                User Name <span>*</span>
              </label>

              <div className="edit-input-wrapper">
                <User size={16} />

                <input
                  type="text"
                  value={editForm.USERNAME}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      USERNAME: e.target.value,
                    })
                  }
                  placeholder="Enter User Name"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>
                Email <span>*</span>
              </label>

              <div className="edit-input-wrapper">
                <Mail size={16} />

                <input
                  type="email"
                  value={editForm.EMAIL_ID}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      EMAIL_ID: e.target.value,
                    })
                  }
                  placeholder="Enter Email"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>
                Phone Number <span>*</span>
              </label>

              <div className="edit-input-wrapper">
                <Phone size={16} />

                <input
                  type="text"
                  value={editForm.MOBILE_NO}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      MOBILE_NO: e.target.value,
                    })
                  }
                  placeholder="Enter Phone Number"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>User ID</label>

              <div className="edit-input-wrapper edit-disabled">
                <Hash size={16} />

                <input
                  type="text"
                  value={profile.USER_ID || ""}
                  disabled
                />
              </div>
            </div>

          </div>
        </section>

       {/* ================= SCHOOL INFORMATION ================= */}
{isStudent && (
  <section className="edit-section">

    <div className="edit-section-header">
      <div className="edit-section-icon">
        <School size={18} />
      </div>

      <div>
        <h3>School Information</h3>
        <span>Institutional & academic details (Managed by Administrator)</span>
      </div>
    </div>

    <div className="edit-form-grid">

      {/* ================= SCHOOL NAME ================= */}
      <div className="edit-form-field full-width">
        <label>School Name</label>

        <div className="edit-input-wrapper edit-disabled">
          <Building2 size={16} />

          <input
            type="text"
            value={editForm.SCHOOL_NAME || ""}
            disabled
            readOnly
          />
        </div>
      </div>


      {/* ================= ENROL ID ================= */}
      <div className="edit-form-field">
        <label>Enrol ID</label>

        <div className="edit-input-wrapper edit-disabled">
          <Hash size={16} />

          <input
            type="text"
            value={formatStudentRollNo(editForm.ROLL_NO) || ""}
            disabled
            readOnly
          />
        </div>
      </div>


      {/* ================= GRADE ================= */}
      <div className="edit-form-field">
        <label>Grade</label>

        <div className="edit-input-wrapper edit-disabled">
          <School size={16} />

          <input
            type="text"
            value={
              editForm.GRADE !== null &&
              editForm.GRADE !== undefined &&
              editForm.GRADE !== ""
                ? `Grade ${editForm.GRADE}`
                : "-"
            }
            disabled
            readOnly
          />
        </div>
      </div>

    </div>
  </section>
)}

        {/* ================= ADDRESS INFORMATION ================= */}
        <section className="edit-section">

          <div className="edit-section-header">
            <div className="edit-section-icon">
              <MapPin size={18} />
            </div>

            <div>
              <h3>Address Information</h3>
              <span>Update your registered address</span>
            </div>
          </div>

          <div className="edit-form-grid">

            <div className="edit-form-field">
              <label>Address Line 1</label>

              <div className="edit-input-wrapper">
                <MapPinned size={16} />

                <input
                  type="text"
                  value={editForm.ADDRESS_LINE1}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      ADDRESS_LINE1: e.target.value,
                    })
                  }
                  placeholder="Enter Address Line 1"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>Address Line 2</label>

              <div className="edit-input-wrapper">
                <MapPinned size={16} />

                <input
                  type="text"
                  value={editForm.ADDRESS_LINE2}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      ADDRESS_LINE2: e.target.value,
                    })
                  }
                  placeholder="Enter Address Line 2"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>State</label>

              <div className="edit-input-wrapper">
                <Globe2 size={16} />

                <input
                  type="text"
                  value={editForm.STATE}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      STATE: e.target.value,
                    })
                  }
                  placeholder="Enter State"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>District</label>

              <div className="edit-input-wrapper">
                <Building2 size={16} />

                <input
                  type="text"
                  value={editForm.DISTRICT}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      DISTRICT: e.target.value,
                    })
                  }
                  placeholder="Enter District"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>City</label>

              <div className="edit-input-wrapper">
                <MapPin size={16} />

                <input
                  type="text"
                  value={editForm.CITY}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      CITY: e.target.value,
                    })
                  }
                  placeholder="Enter City"
                />
              </div>
            </div>


            <div className="edit-form-field">
              <label>Pincode</label>

              <div className="edit-input-wrapper">
                <Hash size={16} />

                <input
                  type="text"
                  value={editForm.PINCODE}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      PINCODE: e.target.value,
                    })
                  }
                  placeholder="Enter Pincode"
                />
              </div>
            </div>


            <div className="edit-form-field full-width">
              <label>Landmark</label>

              <div className="edit-input-wrapper">
                <MapPinned size={16} />

                <input
                  type="text"
                  value={editForm.LANDMARK}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      LANDMARK: e.target.value,
                    })
                  }
                  placeholder="Enter Landmark"
                />
              </div>
            </div>

          </div>
        </section>

      </div>


      {/* ================= FIXED ACTIONS ================= */}
      <div className="profile-edit-actions">

        <button
          type="button"
          className="profile-cancel-btn"
          onClick={handleClearForm}
          disabled={saving}
        >
          <X size={16} />
          Clear
        </button>

        <button
          type="button"
          className="profile-save-btn"
          onClick={handleSaveProfile}
          disabled={saving}
        >
          <Save size={16} />

          {saving ? "Submitting..." : "Submit"}
        </button>

      </div>

    </div>
  </div>
)}

      {/* ================= PASSWORD MANAGEMENT MODAL ================= */}
      {passwordModalOpen && (
        <div className="password-modal-overlay">
          <div className="password-modal-card">
            <div className="password-modal-header">
              <div className="password-modal-header-icon">
                <Lock size={20} />
              </div>
              <div>
                <h2>Change Account Password</h2>
                <p>
                  {profile.IS_PASSWORD_CHANGED
                    ? "Update your customized account login password."
                    : isStudent
                    ? "Your initial password is your registered phone number. Set your personalized password below."
                    : "Update your account login password."}
                </p>
              </div>
              <button
                type="button"
                className="password-modal-close"
                onClick={handleClosePasswordModal}
                disabled={passwordSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="password-modal-form">
              {/* OLD PASSWORD FIELD (Required after password has been changed) */}
              {profile.IS_PASSWORD_CHANGED && (
                <div className="password-form-field">
                  <label>
                    Old Password <span className="req-star">*</span>
                  </label>
                  <div className="password-input-wrap">
                    <Lock size={16} className="input-icon-left" />
                    <input
                      type={showOldPassword ? "text" : "password"}
                      value={passwordForm.oldPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          oldPassword: e.target.value,
                        })
                      }
                      placeholder="Enter your current/old password"
                      disabled={passwordSaving}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-eye-btn"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      tabIndex={-1}
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* CURRENT DEFAULT PASSWORD NOTICE (Before password has been changed) */}
              {!profile.IS_PASSWORD_CHANGED && (
                <div className="old-password-default-wrap">
                  <div className="old-password-default-header">
                    <span className="old-password-default-lbl">Current Password (Default)</span>
                    <span className="credential-status default-badge">
                      <Phone size={11} /> Phone Number
                    </span>
                  </div>
                  <div className="old-password-readonly-input">
                    <Phone size={15} className="input-icon-left" />
                    <input
                      type="text"
                      value={profile.MOBILE_NO || profile.DEFAULT_PASSWORD || ""}
                      readOnly
                      disabled
                    />
                  </div>
                  <p className="old-password-hint">
                    <Info size={13} />
                    <span>Your account is currently using your phone number as password. Enter a new password below to change it.</span>
                  </p>
                </div>
              )}

              <div className="password-form-field">
                <label>
                  New Password <span className="req-star">*</span>
                </label>
                <div className="password-input-wrap">
                  <Lock size={16} className="input-icon-left" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.password}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        password: e.target.value,
                      })
                    }
                    placeholder="Enter at least 6 characters"
                    disabled={passwordSaving}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="password-form-field">
                <label>
                  Confirm Password <span className="req-star">*</span>
                </label>
                <div className="password-input-wrap">
                  <Lock size={16} className="input-icon-left" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Re-enter password"
                    disabled={passwordSaving}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="password-hint-box">
                <ShieldCheck size={15} />
                <span>
                  Password must be at least 6 characters long and securely hashed.
                </span>
              </div>

              <div className="password-modal-actions">
                <button
                  type="button"
                  className="password-btn-cancel"
                  onClick={handleClosePasswordModal}
                  disabled={passwordSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="password-btn-submit"
                  disabled={passwordSaving}
                >
                  <Save size={16} />
                  <span>
                    {passwordSaving ? "Saving..." : "Save Password"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
