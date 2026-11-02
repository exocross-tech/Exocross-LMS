import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, Plane, Award, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { loginApi } from '../../services/apiService';
import './Login.css';
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import logoNew from '../../assets/images/logo-new.png';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter your email/mobile and password.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        USERNAME: username.trim(),
        PASSWORD: password
      };

      const res = await loginApi.login(payload);

      if (res.data && res.data.status === 1) {
        sessionStorage.setItem(
          "ASA_LMSUser",
          JSON.stringify(res.data.data)
        );
        if (rememberMe) {
          localStorage.setItem("ASA_LMSUser", JSON.stringify(res.data.data));
        }
        toast.success(res.data.message || "Welcome back! Login successful.");
        const role = (
          res.data?.data?.USER_TYPE ||
          res.data?.data?.ROLE ||
          res.data?.data?.DESIGNATION ||
          ""
        ).toString().trim().toUpperCase();

        const targetPage =
          role === "STUDENT"
            ? "student-dashboard"
            : role === "TUTOR"
            ? "batch-dashboard"
            : "dashboard";

        if (onLoginSuccess) {
          onLoginSuccess(targetPage);
        } else {
          navigate(`/${targetPage}`);
        }
      } else {
        const errMsg = res.data?.message || "Invalid username or password.";
        toast.error(errMsg);
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Invalid credentials or server error. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background ambient lighting */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      <div className="bg-grid-pattern"></div>

      <div className="login-wrapper">
        {/* Left Side - Hero & Branding (Desktop) */}
        <div className="login-hero">
          <div className="hero-brand">
            <div className="hero-logo-wrapper">
              <img src={logoNew} alt="Exocross LMS" className="hero-logo-wide" />
            </div>
            <div className="hero-brand-badge">
              <span className="hero-tag">ENTERPRISE PORTAL</span>
              <span className="hero-sub-title">Learning Management System</span>
            </div>
          </div>

          <div className="hero-features">
            <div className="feature-item">
              <div className="feature-icon">
                <Plane size={20} />
              </div>
              <div className="feature-text">
                <h3>Aviation & Drone Academics</h3>
                <p>Structured curriculum, batch scheduling, and interactive course materials.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <Award size={20} />
              </div>
              <div className="feature-text">
                <h3>Ambassador & Tutor Management</h3>
                <p>Comprehensive dashboard for student allocation, progress review, and tracking.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <ShieldCheck size={20} />
              </div>
              <div className="feature-text">
                <h3>Encrypted & Secure Access</h3>
                <p>256-bit enterprise security safeguarding student & operational data.</p>
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <div className="security-badge">
              <CheckCircle2 size={16} className="text-cyan" />
              <span>Exocross LMS Enterprise Infrastructure</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Card */}
        <div className="login-card-container">
          <div className="login-card">
            {/* Header for Mobile/Responsive */}
            <div className="mobile-brand-header">
              <div className="mobile-logo-wrapper">
                <img src={logoNew} alt="Exocross LMS" className="mobile-logo-wide" />
              </div>
              <span className="hero-tag">ENTERPRISE PORTAL • LMS</span>
            </div>

            <div className="login-card-header">
              <div className="welcome-badge">
                <Sparkles size={14} />
                <span>Portal Sign In</span>
              </div>
              <h2 className="login-welcome-title">Welcome Back</h2>
              <p className="login-welcome-desc">
                Sign in with your credentials to access your portal.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username">Email or Mobile Number</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    id="username"
                    type="text"
                    className="login-input"
                    placeholder="Enter email or mobile no"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input login-input-pass"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="login-card-footer">
              <span className="system-status">
                <span className="status-dot"></span> System Operational
              </span>
              <span className="version-info">ASA LMS v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

