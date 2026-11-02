import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../services/apiService";
import "./Header.css";
import { toast } from "react-toastify";
import {
  PanelLeft,
  User,
  Bell,
  ChevronDown,
  UserCheck,
  KeyRound,
  LogOut,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

const Header = ({ onToggleSidebar }) => {
  const [username, setUsername] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  {
    /*useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await API.get("/notifications/1");

        const notifications = res.data.notifications || [];

        const unread = notifications.filter((n) => !n.IS_READ).length;

        setUnreadCount(unread);
      } catch (err) {
        console.error("Failed to fetch unread notifications", err);
      }
    };

    fetchUnreadCount();

    // optional: refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);*/
  }

  useEffect(() => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const name =
          parsedUser?.USERNAME ||
          parsedUser?.USER_NAME ||
          parsedUser?.FIRST_NAME ||
          parsedUser?.email ||
          "User";
        setUsername(name);
      }
    } catch (e) {
      console.error("Error reading user data from storage:", e);
    }
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openLogoutModal = () => {
    setIsDropdownOpen(false);
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    sessionStorage.removeItem("ASA_LMSUser");
    localStorage.removeItem("ASA_LMSUser");
    localStorage.removeItem("user");
    setShowLogoutModal(false);
    navigate("/login");
    window.location.reload();
  };

  const handleChangePassword = async () => {
    if (!password || !confirmPassword) {
      toast.error("Please enter both passwords");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsChangingPassword(true);

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
        parsedUser?.USER_ID ||
        parsedUser?.userId ||
        parsedUser?.id;

      if (!userId) {
        toast.error("User ID not found");
        return;
      }

      const res = await usersApi.changePassword({
        userId,
        password,
        confirmPassword,
      });

      if (res.data.status === 1) {
        toast.success("Password changed successfully");

        setPassword("");
        setConfirmPassword("");
        setPasswordMismatch(false);
        setShowChangePasswordModal(false);
      } else {
        toast.error(
          res.data.message || "Failed to change password"
        );
      }
    } catch (err) {
      console.error("Change password error:", err);

      toast.error(
        err.response?.data?.message ||
        "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle Navigation Menu">
            <PanelLeft size={20} color="var(--text-secondary)" />
          </button>
        </div>

        <div className="header-right">
          <button
            className="notification-btn"
            onClick={() => navigate("/notifications")}
          >
            {" "}
            <Bell size={18} color="var(--text-secondary)" />{" "}
            {/*{unreadCount > 0 && (
              <span className="notification-badge">
                {" "}
                {unreadCount > 99 ? "99+" : unreadCount}{" "}
              </span>
            )}{" "}*/}
          </button>

          {username && (
            <div className="profile-menu-container" ref={dropdownRef}>
              <div
                className={`user-profile-badge ${isDropdownOpen ? "active" : ""}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="user-avatar-small">
                  <User size={16} />
                </div>
                <span className="user-name-text">{username}</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${isDropdownOpen ? "open" : ""}`}
                />
              </div>

              {isDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <UserCheck size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setPassword("");
                      setConfirmPassword("");
                      setPasswordMismatch(false);
                      setShowChangePasswordModal(true);
                    }}
                  >
                    <KeyRound size={16} />
                    <span>Change Password</span>
                  </button>

                  <div className="dropdown-divider"></div>

                  <button
                    className="dropdown-item logout"
                    onClick={openLogoutModal}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button
              className="modal-close-btn"
              onClick={() => setShowLogoutModal(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
            <div className="modal-icon-wrapper danger">
              <LogOut size={28} />
            </div>
            <h3 className="modal-title">Confirm Logout</h3>
            <p className="modal-message">
              Are you sure you want to log out? You will need to sign in again
              to access the portal.
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn confirm-danger"
                onClick={confirmLogout}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
      {showChangePasswordModal && (
        <div className="modal-backdrop">
          <div className="modal-card change-password-modal">
            <button
              className="modal-close-btn"
              onClick={() => {
                if (!isChangingPassword) {
                  setShowChangePasswordModal(false);
                  setPassword("");
                  setConfirmPassword("");
                  setPasswordMismatch(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="change-password-header">
              <div className="change-password-icon">
                <KeyRound size={24} />
              </div>
              <h3 className="modal-title">Change Password</h3>
              <p className="modal-message">
                Create a strong new password to protect your account.
              </p>
            </div>

            <div className="password-form">
              {/* New Password */}
              <div className="password-field">
                <label>NEW PASSWORD</label>
                <div className="modal-input-wrapper">
                  <Lock className="modal-input-icon" size={17} />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPassword(value);
                      if (confirmPassword) {
                        setPasswordMismatch(value !== confirmPassword);
                      }
                    }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="modal-input-field"
                  />
                  <button
                    type="button"
                    className="modal-password-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {password && password.length < 6 && (
                  <span className="password-hint error">
                    <AlertCircle size={13} />
                    <span>Password must be at least 6 characters</span>
                  </span>
                )}

                {password && password.length >= 6 && (
                  <span className="password-hint success">
                    <CheckCircle2 size={13} />
                    <span>Password length is valid</span>
                  </span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="password-field">
                <label>CONFIRM PASSWORD</label>
                <div className="modal-input-wrapper">
                  <Lock className="modal-input-icon" size={17} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    className={`modal-input-field ${passwordMismatch
                      ? "input-error"
                      : confirmPassword && password === confirmPassword
                        ? "input-success"
                        : ""
                      }`}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfirmPassword(value);
                      setPasswordMismatch(
                        password !== "" && value !== "" && password !== value
                      );
                    }}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="modal-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {passwordMismatch && (
                  <span className="password-hint error">
                    <AlertCircle size={13} />
                    <span>Passwords do not match</span>
                  </span>
                )}

                {!passwordMismatch && confirmPassword && password === confirmPassword && (
                  <span className="password-hint success">
                    <CheckCircle2 size={13} />
                    <span>Passwords match</span>
                  </span>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPassword("");
                  setConfirmPassword("");
                  setPasswordMismatch(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
                disabled={isChangingPassword}
              >
                Cancel
              </button>

              <button
                className="modal-btn change-password-submit"
                onClick={handleChangePassword}
                disabled={
                  isChangingPassword ||
                  !password ||
                  !confirmPassword ||
                  passwordMismatch ||
                  password.length < 6
                }
              >
                {isChangingPassword ? (
                  <>
                    <span className="modal-spinner"></span>
                    <span>Updating...</span>
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </div>
        </div>

      )}
    </>
  );
};

export default Header;
