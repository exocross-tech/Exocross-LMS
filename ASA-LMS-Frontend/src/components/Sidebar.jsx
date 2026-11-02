import React, { useState, useEffect } from "react";
import "./Sidebar.css";
import {
  Rocket,
  LayoutDashboard,
  Radio,
  CalendarCheck,
  Calendar,
  LineChart,
  BookOpen,
  FileText,
  Upload,
  CheckCircle,
  FileBarChart,
  Award,
  Bell,
  User,
  Star,
  MessageSquare,
  Layers,
  ClipboardCheck,
  History,
  Package,
  FileCheck,
} from "lucide-react";

import logoNew from "../assets/images/logo-new.png";

const Sidebar = ({ activePage = "dashboard", setActivePage, isOpen = false, onClose }) => {
  const [username, setUsername] = useState("User");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    try {
      const storedUser =
        sessionStorage.getItem("ASA_LMSUser") ||
        sessionStorage.getItem("USERNAME") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("ASA_LMSUser") ||
        localStorage.getItem("user");

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          const name =
            parsedUser?.USERNAME ||
            parsedUser?.USER_NAME ||
            parsedUser?.FIRST_NAME ||
            parsedUser?.email ||
            "User";
          const role =
            parsedUser?.USER_TYPE ||
            parsedUser?.ROLE ||
            parsedUser?.DESIGNATION ||
            parsedUser?.EMAIL_ID ||
            "";
          setUsername(name);
          if (role) setUserRole(role);
        } catch {
          setUsername(storedUser);
        }
      }
    } catch (e) {
      console.error("Error reading user data from storage:", e);
    }
  }, []);

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const normalizedRole = userRole?.trim()?.toUpperCase() || "";
  const isAdmin = normalizedRole === "ADMIN";
  const isStudent = normalizedRole === "STUDENT";
  const isTutor = normalizedRole === "TUTOR";

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-logo">
        <img
          src={logoNew}
          alt="Exocross LMS"
          className="sidebar-logo-img"
        />
      </div>

      <nav className="sidebar-nav">
        {/* ========================================================= */}
        {/* ===================== ADMIN SIDEBAR ===================== */}
        {/* ========================================================= */}
        {isAdmin && (
          <>
            {/* 1. COHORT */}
            <div className="nav-group">
              <div className="nav-group-title">COHORT</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "dashboard" || activePage === "master-dashboard"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("dashboard");
                }}
              >
                <LayoutDashboard size={18} />
                <span>Master Dashboard</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "calendar" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("calendar");
                }}
              >
                <Calendar size={18} />
                <span>Calendar</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "class-scheduling" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("class-scheduling");
                }}
              >
                <CalendarCheck size={18} />
                <span>Class Scheduling</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batches" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batches");
                }}
              >
                <LineChart size={18} />
                <span>Batches</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "students" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("students");
                }}
              >
                <Radio size={18} />
                <span>Students</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "tutors" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("tutors");
                }}
              >
                <CalendarCheck size={18} />
                <span>Tutors</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "course-material" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("course-material");
                }}
              >
                <BookOpen size={18} />
                <span>Course Material</span>
              </a>
            </div>

            {/* 2. COMMUNICATION */}
            <div className="nav-group">
              <div className="nav-group-title">COMMUNICATION</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "chat-room" || activePage === "chatroom"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("chat-room");
                }}
              >
                <MessageSquare size={18} />
                <span>Chatroom</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batch-announcements" ||
                  activePage === "batchannouncements"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batch-announcements");
                }}
              >
                <Radio size={18} />
                <span>Batch Announcements</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "notifications" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("notifications");
                }}
              >
                <Bell size={18} />
                <span>Notifications</span>
              </a>
            </div>

            {/* 3. ASSESSMENT CENTER */}
            <div className="nav-group">
              <div className="nav-group-title">ASSESSMENT CENTER</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "question-bank" ||
                  activePage === "question-list"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("question-bank");
                }}
              >
                <FileText size={18} />
                <span>Question Bank</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "question-sets" ||
                  activePage === "question-sets-list"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("question-sets");
                }}
              >
                <Layers size={18} />
                <span>Question Sets</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assignment-alert" ||
                  activePage === "assessment-alert" ||
                  activePage === "assignmentalert" ||
                  activePage === "assessmentalert"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assignment-alert");
                }}
              >
                <ClipboardCheck size={18} />
                <span>Assessment Alert</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "final-assessment" ||
                  activePage === "final-assessment-practical" ||
                  activePage === "final-assessment-theory" ||
                  activePage === "finalassessment"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("final-assessment");
                }}
              >
                <Award size={18} />
                <span>Final Assessment</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "final-assessment-alert" ||
                  activePage === "final-assessment/alert" ||
                  activePage === "finalassessmentalert"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("final-assessment-alert");
                }}
              >
                <Award size={18} />
                <span>Final Assessment Alert</span>
              </a>
            </div>

            {/* 4. EVALUATION & PERFORMANCE */}
            <div className="nav-group">
              <div className="nav-group-title">EVALUATION & PERFORMANCE</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "practice-test-analysis" ||
                  activePage === "practicetestanalysis" ||
                  activePage === "practice-test" ||
                  activePage === "practicetest"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("practice-test-analysis");
                }}
              >
                <FileCheck size={18} />
                <span>Assessment Analysis</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "project-kit-evaluation" ||
                  activePage === "projectkitevaluation" ||
                  activePage === "project-kit-evaluations"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("project-kit-evaluation");
                }}
              >
                <Package size={18} />
                <span>Project Kit Evaluation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assessment-evaluation" ||
                  activePage === "assessmentevaluation" ||
                  activePage === "assessment-evaluations"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assessment-evaluation");
                }}
              >
                <ClipboardCheck size={18} />
                <span>Final Assessment Evaluation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "students-reviews" ||
                  activePage === "student-reviews" ||
                  activePage === "studentsreviews"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("students-reviews");
                }}
              >
                <Star size={18} />
                <span>Students Reviews</span>
              </a>
            </div>

            {/* 5. ADMINISTRATION */}
            <div className="nav-group">
              <div className="nav-group-title">ADMINISTRATION</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batch-creation" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batch-creation");
                }}
              >
                <User size={18} />
                <span>Batch Creation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "student-creation" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-creation");
                }}
              >
                <User size={18} />
                <span>Student Creation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "student-allocation" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-allocation");
                }}
              >
                <LayoutDashboard size={18} />
                <span>Student Allocation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "tutor-allocation" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("tutor-allocation");
                }}
              >
                <Radio size={18} />
                <span>Tutor Allocation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "user-management" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("user-management");
                }}
              >
                <CalendarCheck size={18} />
                <span>User Management</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "user-log" || activePage === "user-logs"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("user-log");
                }}
              >
                <History size={18} />
                <span>User Log</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "module" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("module");
                }}
              >
                <BookOpen size={18} />
                <span>Modules</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "project-kits" ||
                  activePage === "projectkits"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("project-kits");
                }}
              >
                <Package size={18} />
                <span>Project Kits</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "profile" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("profile");
                }}
              >
                <User size={18} />
                <span>Profile</span>
              </a>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* ===================== TUTOR SIDEBAR ===================== */}
        {/* ========================================================= */}
        {isTutor && (
          <>
            {/* 1. COHORT */}
            <div className="nav-group">
              <div className="nav-group-title">COHORT</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batch-dashboard" ||
                  activePage === "batchdashboard" ||
                  activePage === "dashboard"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batch-dashboard");
                }}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "calendar" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("calendar");
                }}
              >
                <Calendar size={18} />
                <span>Calendar</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "class-scheduling" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("class-scheduling");
                }}
              >
                <CalendarCheck size={18} />
                <span>Class Scheduling</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "live-class" || activePage === "liveclass"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("live-class");
                }}
              >
                <Radio size={18} />
                <span>Live Class</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "attendance-marking" ||
                  activePage === "attendancemarking"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("attendance-marking");
                }}
              >
                <CalendarCheck size={18} />
                <span>Attendance Marking</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batches" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batches");
                }}
              >
                <LineChart size={18} />
                <span>Batch Overview</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "course-material" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("course-material");
                }}
              >
                <BookOpen size={18} />
                <span>Course Material</span>
              </a>
            </div>

            {/* 2. COMMUNICATION */}
            <div className="nav-group">
              <div className="nav-group-title">COMMUNICATION</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "tutor-chatroom" ||
                  activePage === "tutor-chat-room" ||
                  activePage === "tutorchatroom" ||
                  activePage === "chat-room"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("tutor-chatroom");
                }}
              >
                <MessageSquare size={18} />
                <span>Chatroom</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "batch-announcements" ||
                  activePage === "batchannouncements"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("batch-announcements");
                }}
              >
                <Radio size={18} />
                <span>Announcements</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "notifications" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("notifications");
                }}
              >
                <Bell size={18} />
                <span>Notifications</span>
              </a>
            </div>

            {/* 3. ASSESSMENT CENTER */}
            <div className="nav-group">
              <div className="nav-group-title">ASSESSMENT CENTER</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "question-bank" ||
                  activePage === "question-list"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("question-bank");
                }}
              >
                <FileText size={18} />
                <span>Question Bank</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "question-sets" ||
                  activePage === "question-sets-list"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("question-sets");
                }}
              >
                <Layers size={18} />
                <span>Question Set</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assignment-alert" ||
                  activePage === "assessment-alert" ||
                  activePage === "assignmentalert" ||
                  activePage === "assessmentalert"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assignment-alert");
                }}
              >
                <ClipboardCheck size={18} />
                <span>Assessment Alert</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "final-assessment" ||
                  activePage === "final-assessment-practical" ||
                  activePage === "final-assessment-theory" ||
                  activePage === "finalassessment"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("final-assessment");
                }}
              >
                <Award size={18} />
                <span>Final Assessment</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "final-assessment-alert" ||
                  activePage === "final-assessment/alert" ||
                  activePage === "finalassessmentalert"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("final-assessment-alert");
                }}
              >
                <Award size={18} />
                <span>Final Assessment Alert</span>
              </a>
            </div>

            {/* 4. EVALUATION & PERFORMANCE */}
            <div className="nav-group">
              <div className="nav-group-title">EVALUATION & PERFORMANCE</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "practice-test-analysis" ||
                  activePage === "practicetestanalysis" ||
                  activePage === "practice-test" ||
                  activePage === "practicetest"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("practice-test-analysis");
                }}
              >
                <FileCheck size={18} />
                <span>Assessment Analysis</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "project-kit-evaluation" ||
                  activePage === "projectkitevaluation" ||
                  activePage === "project-kit-evaluations"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("project-kit-evaluation");
                }}
              >
                <Package size={18} />
                <span>Project Kit Evaluation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assessment-evaluation" ||
                  activePage === "assessmentevaluation" ||
                  activePage === "assessment-evaluations"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assessment-evaluation");
                }}
              >
                <ClipboardCheck size={18} />
                <span>Final Assessment Evaluation</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "students-reviews" ||
                  activePage === "student-reviews" ||
                  activePage === "studentsreviews"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("students-reviews");
                }}
              >
                <Star size={18} />
                <span>Students Reviews</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "profile" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("profile");
                }}
              >
                <User size={18} />
                <span>Profile</span>
              </a>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* ==================== STUDENT SIDEBAR ==================== */}
        {/* ========================================================= */}
        {isStudent && (
          <>
            {/* 1. COHORT */}
            <div className="nav-group">
              <div className="nav-group-title">COHORT</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "dashboard" ||
                  activePage === "student-dashboard" ||
                  activePage === "studentenddashboard" ||
                  activePage === "studentdashboard"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-dashboard");
                }}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "calendar" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("calendar");
                }}
              >
                <Calendar size={18} />
                <span>Calendar</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "live-class" || activePage === "liveclass"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("live-class");
                }}
              >
                <Radio size={18} />
                <span>Live Class</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "student-attendance" ||
                  activePage === "studentattendance" ||
                  activePage === "attendance"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-attendance");
                }}
              >
                <CalendarCheck size={18} />
                <span>Attendance</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "class-details" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("class-details");
                }}
              >
                <CalendarCheck size={18} />
                <span>Class Details</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "course-material" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("course-material");
                }}
              >
                <BookOpen size={18} />
                <span>Course Material</span>
              </a>
            </div>

            {/* 2. COMMUNICATION */}
            <div className="nav-group">
              <div className="nav-group-title">COMMUNICATION</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "student-chatroom" ||
                  activePage === "student-chat-room" ||
                  activePage === "studentchatroom" ||
                  activePage === "chat-room"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-chatroom");
                }}
              >
                <MessageSquare size={18} />
                <span>Chatroom</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "notifications" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("notifications");
                }}
              >
                <Bell size={18} />
                <span>Notifications</span>
              </a>
            </div>

            {/* 3. ASSESSMENT CENTER */}
            <div className="nav-group">
              <div className="nav-group-title">ASSESSMENT CENTER</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assignment-page" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assignment-page");
                }}
              >
                <CheckCircle size={18} />
                <span>Assessment</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "project-submission" ||
                  activePage === "projectsubmission"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("project-submission");
                }}
              >
                <Upload size={18} />
                <span>Project Submission</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "student-final-assessment" ||
                  activePage === "student-finalassessment" ||
                  activePage === "studentfinalassessment"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("student-final-assessment");
                }}
              >
                <Award size={18} />
                <span>Final Assessment</span>
              </a>
            </div>

            {/* 4. EVALUATION & PERFORMANCE */}
            <div className="nav-group">
              <div className="nav-group-title">EVALUATION & PERFORMANCE</div>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "assessment-results" ||
                  activePage === "assessmentresults"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("assessment-results");
                }}
              >
                <CheckCircle size={18} />
                <span>Assessment Results</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "report-card" || activePage === "reportcard"
                    ? "active"
                    : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("report-card");
                }}
              >
                <FileBarChart size={18} />
                <span>Report Card</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "certificate" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("certificate");
                }}
              >
                <Award size={18} />
                <span>Certificate</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "session-review" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("session-review");
                }}
              >
                <Star size={18} />
                <span>Session Review</span>
              </a>
              <a
                href="#"
                className={`nav-item ${
                  activePage === "profile" ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (setActivePage) setActivePage("profile");
                }}
              >
                <User size={18} />
                <span>Profile</span>
              </a>
            </div>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">{getInitials(username)}</div>
        <div className="user-info">
          <div className="user-name">{username}</div>
          {userRole && <div className="user-role">{userRole}</div>}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
