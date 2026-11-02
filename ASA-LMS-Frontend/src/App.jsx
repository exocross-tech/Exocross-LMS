import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./index.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Batches from "./Masters/Batches/Batches";
import Tutors from "./Masters/Tutors/Tutors";
import Students from "./Masters/Students/Students";
import StudentAllocation from "./pages/Student-Allocation/StudentAllocation";
import StudentCreation from "./Masters/Student-Creation/StudentCreation";
import TutorAllocation from "./pages/Tutor-Allocation/TutorAllocation";
import Login from "./pages/Login/Login";
import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import UserManagement from "./pages/User-Management/UserManagement";
import UserLog from "./pages/UserLog/UserLog";
import Notifications from "./pages/Notifications/Notifications";
import FeePaymentTracking from "./pages/Fee-Payment-Tracking/FeePaymentTracking";
import BatchAnnouncements from "./pages/Batch-Announcements/BatchAnnouncements";
import CourseMaterial from "./pages/Course-Material/CourseMaterial";
import BatchCreation from "./Masters/Batch-Creation/BatchCreation";
import ChatRoom from "./pages/Chat-Room/ChatRoom";
import TutorChatroom from "./pages/Tutor-Chatroom/TutorChatroom";
import StudentChatroom from "./pages/Student-Chatroom/StudentChatroom";
import ClassScheduling from "./pages/ClassScheduling/ClassScheduling";
import LiveClass from "./pages/Live-Class/LiveClass";
import Profile from "./pages/Profile/Profile";
import ClassDetails from "./pages/ClassDetails/ClassDetails";
import SessionReview from "./pages/SessionReview/SessionReview";
import AttendanceMarking from "./pages/Attendance-Marking/AttendanceMarking";
import QuestionBank from "./pages/QuestionBank/QuestionBank";
import StudentAttendance from "./pages/Student-Attendance/StudentAttendance";
import QuestionList from "./pages/QuestionList/QuestionList";
import Module from "./pages/Module/Module";
import QuestionSets from "./pages/Question-Sets/QuestionSets";
import QuestionSetsList from "./pages/QuestionSetsList/QuestionSetsList";
import AssignmentAlert from "./pages/AssignmentAlert/AssignmentAlert";
import AssignmentPage from "./pages/AssignmentPage/AssignmentPage";
import PracticeExam from "./pages/PracticeExam/PracticeExam";
import AssessmentResults from "./pages/Assessment-Results/AssessmentResults";
import FinalAssessment from "./pages/FinalAssessment/FinalAssessment";
import FinalAssessmentAlert from "./pages/FinalAssessment/FinalAssessmentAlert";
import FinalAssessmentTheory from "./pages/FinalAssessment/FinalAssessmentTheory";
import FinalAssessmentPractical from "./pages/FinalAssessment/FinalAssessmentPractical";
import ProjectSubmission from "./pages/ProjectSubmission/ProjectSubmission";
import StudentFinalAssessment from "./pages/StudentFinalAssessment/StudentFinalAssessment";
import AssessmentEvaluation from "./pages/AssessmentEvaluation/AssessmentEvaluation";
import Certificate from "./pages/Certificate/Certificate";
import ReportCard from "./pages/ReportCard/ReportCard";
import Calendar from "./pages/Calendar/Calendar";
import ProjectKits from "./pages/ProjectKits/ProjectKits";
import ProjectKitEvaluation from "./pages/ProjectKitEvaluation/ProjectKitEvaluation";
import PracticeTestAnalysis from "./pages/Practice-Test-Analysis/PracticeTestAnalysis";
import BatchDashboard from "./pages/Batch-Dashboard/BatchDashboard";
import StudentendDashboard from "./pages/Student-Dashboard/StudentendDashboard";
import StudentsReviews from "./pages/StudentsReviews/StudentsReviews";

// Helper to check if user is logged in
const checkIsAuthenticated = () => {
  try {
    const user =
      sessionStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("user");
    return !!user;
  } catch (e) {
    return false;
  }
};

// Helper to check logged in user role
const getLoggedInUserRole = () => {
  try {
    const user =
      sessionStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("ASA_LMSUser") ||
      localStorage.getItem("user");
    if (user) {
      const parsed = JSON.parse(user);
      return (
        parsed?.USER_TYPE ||
        parsed?.ROLE ||
        parsed?.DESIGNATION ||
        parsed?.userType ||
        ""
      ).toString().trim().toUpperCase();
    }
  } catch (e) {
    return "";
  }
  return "";
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState(() => {
    const isAuth = checkIsAuthenticated();
    const route = location.pathname.replace("/", "").toLowerCase();

    if (!isAuth) return "login";

    return route && route !== "login"
      ? route
      : "dashboard";
  });

  const [selectedAssignment, setSelectedAssignment] =
    useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // =====================================================
  // START PRACTICE EXAM
  // =====================================================

  const handleStartPracticeExam = (assignment) => {
    console.log(
      "Opening Practice Exam:",
      assignment
    );

    setSelectedAssignment(assignment);

    navigate("/practice-exam");
  };

  // =====================================================
  // PAGE CHANGE
  // =====================================================

  const handlePageChange = (page) => {
    setActivePage(page);
    setIsMobileSidebarOpen(false);
    navigate(`/${page}`);
  };

  useEffect(() => {
    const isAuth = checkIsAuthenticated();
    const route = location.pathname.replace("/", "").toLowerCase();

    if (!isAuth) {
      // If not logged in and attempting to access protected route, redirect to /login
      if (route !== "login" && location.pathname !== "/login") {
        setActivePage("login");
        navigate("/login", { replace: true });
      } else {
        setActivePage("login");
      }
    } else {
      // If logged in and visiting / or /login, redirect to role dashboard
      if (!route || route === "login" || location.pathname === "/") {
        const role = getLoggedInUserRole();
        const defaultPage =
          role === "STUDENT"
            ? "student-dashboard"
            : role === "TUTOR"
            ? "batch-dashboard"
            : "dashboard";
        setActivePage(defaultPage);
        navigate(`/${defaultPage}`, { replace: true });
      } else {
        setActivePage((prev) => (prev !== route ? route : prev));
      }
    }
  }, [location.pathname, navigate]);



  const isLoginPage = activePage === "login";

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        transition={Zoom}
        theme="light"
      />
      {isLoginPage ? (
        <Login
          onLoginSuccess={(target) => {
            const role = getLoggedInUserRole();
            const page =
              target ||
              (role === "STUDENT"
                ? "student-dashboard"
                : role === "TUTOR"
                ? "batch-dashboard"
                : "dashboard");
            handlePageChange(page);
          }}
        />
      ) : (
        <div className="app-layout">
          <Sidebar
            activePage={activePage}
            setActivePage={handlePageChange}
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
          <main className="main-content">
            <Header onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)} />
            {activePage === "dashboard" && getLoggedInUserRole() !== "STUDENT" && (
              <Dashboard onNavigate={handlePageChange} />
            )}
            {((activePage === "dashboard" && getLoggedInUserRole() === "STUDENT") ||
              activePage === "student-dashboard" ||
              activePage === "studentenddashboard" ||
              activePage === "studentdashboard") && (
              <StudentendDashboard key="student-dashboard-main" onNavigate={handlePageChange} />
            )}
            {(activePage === "batch-dashboard" || activePage === "batchdashboard") && (
              <BatchDashboard onNavigate={handlePageChange} />
            )}
            {activePage === "batches" && <Batches />}
            {activePage === "tutors" && <Tutors />}
            {activePage === "batch-creation" && <BatchCreation />}
            {activePage === "students" && <Students />}
            {activePage === "student-allocation" && <StudentAllocation />}
            {activePage === "student-creation" && <StudentCreation />}
            {activePage === "tutor-allocation" && <TutorAllocation />}
            {activePage === "user-management" && <UserManagement />}
            {(activePage === "user-log" || activePage === "user-logs") && (
              <UserLog />
            )}
            {activePage === "notifications" && <Notifications />}
            {activePage === "fee-payment-tracking" && <FeePaymentTracking />}
            {activePage === "batch-announcements" && <BatchAnnouncements />}
            {activePage === "calendar" && <Calendar />}
            {activePage === "class-scheduling" && <ClassScheduling />}
            {(activePage === "live-class" || activePage === "liveclass") && (
              <LiveClass />
            )}
            {activePage === "course-material" && <CourseMaterial />}
            {(activePage === "assignment-alert" ||
              activePage === "assessment-alert" ||
              activePage === "assignmentalert" ||
              activePage === "assessmentalert") && <AssignmentAlert />}
            {(activePage === "practice-test-analysis" ||
              activePage === "practicetestanalysis" ||
              activePage === "practice-test" ||
              activePage === "practicetest") && <PracticeTestAnalysis />}
            {activePage === "assignment-page" && (
              <AssignmentPage
                onStartPracticeExam={handleStartPracticeExam}
                onStartFinalAssessment={() => {
                  setActivePage("student-final-assessment");
                  navigate("/student-final-assessment");
                }}
              />
            )}

{activePage === "practice-exam" && (
  <PracticeExam
    assignment={selectedAssignment}
    onBack={() => {
      setSelectedAssignment(null);
      navigate("/assignment-page");
    }}
  />
)}
            {activePage === "profile" && <Profile />}
            {activePage === "class-details" && <ClassDetails />}
            {(activePage === "chat-room" || activePage === "chatroom") && (
              <ChatRoom />
            )}
            {(activePage === "tutor-chatroom" ||
              activePage === "tutor-chat-room" ||
              activePage === "tutorchatroom") && <TutorChatroom />}
            {(activePage === "student-chatroom" ||
              activePage === "student-chat-room" ||
              activePage === "studentchatroom") && <StudentChatroom />}
            {activePage === "session-review" && <SessionReview />}
            {activePage === "module" && <Module />}
            {(activePage === "project-kits" || activePage === "projectkits") && (
              <ProjectKits />
            )}
            {activePage === "question-bank" && <QuestionBank />}
            {activePage === "question-list" && <QuestionList />}

            {activePage === "question-sets" && <QuestionSets />}
            {activePage === "question-sets-list" && <QuestionSetsList />}
            {(activePage === "attendance-marking" ||
              activePage === "attendancemarking") && <AttendanceMarking />}
            {(activePage === "student-attendance" ||
              activePage === "studentattendance" ||
              activePage === "attendance") && <StudentAttendance />}
            {(activePage === "assessment-results" ||
              activePage === "assessmentresults") && (
              <AssessmentResults
                onNavigateToAssessments={() => handlePageChange("assignment-page")}
              />
            )}
            {(activePage === "final-assessment" ||
              activePage === "finalassessment") && (
              <FinalAssessment
                onNavigateToTheory={() => {
                  setActivePage("final-assessment-theory");
                  navigate("/final-assessment/theory");
                }}
                onNavigateToPractical={() => {
                  setActivePage("final-assessment-practical");
                  navigate("/final-assessment/practical");
                }}
              />
            )}
            {(activePage === "final-assessment-theory" ||
              activePage === "final-assessment/theory" ||
              activePage === "finalassessmenttheory") && (
              <FinalAssessmentTheory
                onBack={() => {
                  setActivePage("final-assessment");
                  navigate("/final-assessment");
                }}
              />
            )}
            {(activePage === "final-assessment-alert" ||
              activePage === "final-assessment/alert" ||
              activePage === "finalassessmentalert") && (
              <FinalAssessmentAlert
                onBack={() => {
                  setActivePage("final-assessment");
                  navigate("/final-assessment");
                }}
              />
            )}
            {(activePage === "final-assessment-practical" ||
              activePage === "final-assessment/practical" ||
              activePage === "finalassessmentpractical") && (
              <FinalAssessmentPractical
                onBack={() => {
                  setActivePage("final-assessment");
                  navigate("/final-assessment");
                }}
              />
            )}
            {(activePage === "project-submission" ||
              activePage === "projectsubmission") && (
              <ProjectSubmission
                onNavigateToAssessment={() => {
                  setActivePage("assignment-page");
                  navigate("/assignment-page");
                }}
                onNavigateToFinalAssessment={() => {
                  setActivePage("student-final-assessment");
                  navigate("/student-final-assessment");
                }}
              />
            )}
            {(activePage === "student-final-assessment" ||
              activePage === "student-finalassessment" ||
              activePage === "studentfinalassessment") && (
              <StudentFinalAssessment
                onBack={() => {
                  setActivePage("project-submission");
                  navigate("/project-submission");
                }}
                onNavigateToAssessment={() => {
                  setActivePage("assignment-page");
                  navigate("/assignment-page");
                }}
                onStartPracticeExam={handleStartPracticeExam}
              />
            )}
            {(activePage === "assessment-evaluation" ||
              activePage === "assessmentevaluation" ||
              activePage === "assessment-evaluations") && (
              <AssessmentEvaluation />
            )}
            {(activePage === "project-kit-evaluation" ||
              activePage === "projectkitevaluation" ||
              activePage === "project-kit-evaluations") && (
              <ProjectKitEvaluation />
            )}
            {activePage === "certificate" && <Certificate />}
            {(activePage === "report-card" || activePage === "reportcard") && (
              <ReportCard />
            )}
            {(activePage === "students-reviews" ||
              activePage === "student-reviews" ||
              activePage === "studentsreviews") && (
              <StudentsReviews />
            )}
          </main>
        </div>
      )}
    </>
  );
}

export default App;
