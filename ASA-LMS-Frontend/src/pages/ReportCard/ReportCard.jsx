import React, { useEffect, useState, useRef } from "react";
import {
  FileBarChart,
  Download,
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { finalAssessmentApi } from "../../services/apiService";
import { formatStudentRollNo } from "../../utils/formatRollNo";
import reportCardTemplate from "../../assets/images/Report-Card.png";
import "./ReportCard.css";

const ReportCard = () => {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reportState, setReportState] = useState("NOT_COMPLETED"); // NOT_COMPLETED | NOT_EVALUATED | EVALUATED
  const [studentData, setStudentData] = useState(null);
  const isFetched = useRef(false);
  const reportCardPrintRef = useRef(null);

  const getLoggedUser = () => {
    try {
      const storageKeys = ["ASA_LMSUser", "LMSUser", "user"];
      for (const key of storageKeys) {
        const sessionVal = sessionStorage.getItem(key);
        if (sessionVal) {
          const parsed = JSON.parse(sessionVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
        const localVal = localStorage.getItem(key);
        if (localVal) {
          const parsed = JSON.parse(localVal);
          if (parsed && Object.keys(parsed).length > 0) return parsed;
        }
      }
      return {};
    } catch (e) {
      console.error("Failed to read user data:", e);
      return {};
    }
  };

  const user = getLoggedUser();
  const studentId =
    user?.USER_ID || user?.ID || user?.STUDENT_ID || user?.id || user?.userId;

  const fetchReportCardDetails = async () => {
    if (!studentId) {
      setLoading(false);
      toast.error("Unable to identify logged-in student");
      return;
    }

    try {
      setLoading(true);
      const res = await finalAssessmentApi.getCertificate(studentId);

      if (res?.data?.status === 1) {
        const state = res.data.state || "NOT_COMPLETED";
        setReportState(state);
        setStudentData(res.data.data);
      } else {
        setReportState("NOT_COMPLETED");
        setStudentData(null);
      }
    } catch (err) {
      console.error("Fetch report card data error:", err);
      setReportState("NOT_COMPLETED");
      setStudentData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchReportCardDetails();
    }
  }, [studentId]);

  // Format Date Helper: DD/MM/YYYY
  const formatDisplayDate = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Check if student's assigned batch has ended (today >= batchEndDate)
  const isBatchEnded = (() => {
    if (reportState === "BATCH_NOT_ENDED") return false;
    const rawEndDate = studentData?.endDate || studentData?.batchEndDate;
    if (!rawEndDate) return true;
    const bEnd = new Date(rawEndDate);
    if (isNaN(bEnd.getTime())) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const batchEndDate = new Date(bEnd.getFullYear(), bEnd.getMonth(), bEnd.getDate());

    return today.getTime() >= batchEndDate.getTime();
  })();

  const isCompleted = reportState === "EVALUATED" && isBatchEnded;

  // Helper to format Course Duration from batch START_DATE and END_DATE: "MMM YY - MMM YY" (e.g. "AUG 26 - SEPT 26")
  const formatCourseDuration = (startDate, endDate) => {
    const monthNames = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUNE",
      "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"
    ];

    const formatSingleDate = (dateVal) => {
      if (!dateVal) return null;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return null;
      const m = monthNames[d.getMonth()];
      const y = String(d.getFullYear()).slice(-2);
      return `${m} ${y}`;
    };

    const formattedStart = formatSingleDate(startDate);
    const formattedEnd = formatSingleDate(endDate);

    if (formattedStart && formattedEnd) {
      return `${formattedStart} - ${formattedEnd}`;
    } else if (formattedStart) {
      return formattedStart;
    } else if (formattedEnd) {
      return formattedEnd;
    }

    return "SEPT 26 - OCT 26";
  };

  // Grade calculation helper based on LMS grading scale:
  // A+ : 90 - 100%
  // A  : 80 - 89%
  // B+ : 70 - 79%
  // B  : 60 - 69%
  // C  : 50 - 59%
  // D  : Below 50%
  const calculateGrade = (mark) => {
    if (mark === null || mark === undefined || isNaN(Number(mark))) return "";
    const m = Number(mark);
    if (m >= 90) return "A+";
    if (m >= 80) return "A";
    if (m >= 70) return "B+";
    if (m >= 60) return "B";
    if (m >= 50) return "C";
    return "D";
  };

  // Data fields mapping
  const infoName = studentData?.studentName || user?.USERNAME || user?.FIRST_NAME || "Student";
  const infoSchool = studentData?.schoolName || user?.SCHOOL_NAME || "—";
  const rawRoll = studentData?.rollNo || user?.ROLL_NO;
  const infoId = rawRoll ? formatStudentRollNo(rawRoll) : (studentData?.studentId || user?.USER_ID || "—");
  const infoGrade = studentData?.grade || user?.GRADE || "—";
  const infoBatch = studentData?.batchCode || "AICP-001";
  const infoCourseDuration = formatCourseDuration(studentData?.startDate, studentData?.endDate);
  const infoProgramDuration = "30 Hours";
  const infoMode = "Hands-on / Practical Training";

  // Academic / Assessment performance values
  const theoryGrade = studentData?.isTheoryEvaluated && studentData?.theoryMarks !== null && studentData?.theoryMarks !== undefined
    ? calculateGrade(studentData?.theoryMarks)
    : "";
  const practicalGrade = studentData?.isPracticalEvaluated && studentData?.practicalMarks !== null && studentData?.practicalMarks !== undefined
    ? calculateGrade(studentData?.practicalMarks)
    : (studentData?.marks !== null && studentData?.marks !== undefined ? calculateGrade(studentData?.marks) : "");
  const overallGrade = studentData?.overallMarks !== null && studentData?.overallMarks !== undefined
    ? calculateGrade(studentData?.overallMarks)
    : (practicalGrade || theoryGrade || "");
  const attendanceDisplay = studentData?.attendancePercentage !== null && studentData?.attendancePercentage !== undefined
    ? `${studentData?.attendancePercentage}%`
    : "";

  // 1. Internal Assessment helper (Dynamic query by module name)
  const findIAGrade = (regex) => {
    if (Array.isArray(studentData?.internalAssessments)) {
      const item = studentData.internalAssessments.find((ia) => regex.test(ia.moduleName || ""));
      if (item && item.grade) return item.grade;
      if (item && item.mark !== null && item.mark !== undefined) return calculateGrade(item.mark);
    }
    if (Array.isArray(studentData?.moduleGrades)) {
      const item = studentData.moduleGrades.find((mg) => regex.test(mg.MODULE_NAME || ""));
      if (item) {
        const val = item.MARK_PERCENTAGE ?? item.STUDENT_MARK;
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          return calculateGrade(val);
        }
      }
    }
    return "";
  };

  // Internal Assessment Grades (Table A)
  const iaGrade1 = findIAGrade(/aero/i);
  const iaGrade2 = findIAGrade(/rocket/i);
  const iaGrade3 = findIAGrade(/drone/i);
  const iaGrade4 = findIAGrade(/\brc\b|remote control/i);

  // 2. Practical Assessment helper (Dynamic query by evaluated project kit / model name)
  const findPAGrade = (regex) => {
    if (Array.isArray(studentData?.practicalAssessments)) {
      const item = studentData.practicalAssessments.find((pa) => regex.test(pa.kitName || ""));
      if (item && item.grade) return item.grade;
      if (item && item.projectKitMark !== null && item.projectKitMark !== undefined) return calculateGrade(item.projectKitMark);
    }
    return "";
  };

  // Practical Assessment Grades (Table B)
  const paGrade1 = findPAGrade(/static/i);
  const paGrade2 = findPAGrade(/diorama/i);
  const paGrade3 = findPAGrade(/chuck|junior|glider/i);
  const paGrade4 = findPAGrade(/rubber|powered/i);
  const paGrade5 = findPAGrade(/rocket/i);

  // 3. Skill Development Grades (Table C)
  const sdGrade1 = studentData?.skillDevelopment?.creativityGrade || studentData?.creativityGrade || "";
  const sdGrade2 = studentData?.skillDevelopment?.problemSolvingGrade || studentData?.problemSolvingGrade || "";
  const sdGrade3 = studentData?.skillDevelopment?.safetyGrade || studentData?.safetyGrade || "";
  const sdGrade4 = studentData?.skillDevelopment?.learningDisciplineGrade || studentData?.learningDisciplineGrade || "";

  // Download Report Card as PDF
  const handleDownload = async () => {
    if (!reportCardPrintRef.current) return;
    try {
      setDownloading(true);
      toast.info("Generating Report Card PDF...", { autoClose: 1800 });

      // Ensure fonts and images are fully loaded
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Pre-check and ensure all images within the print element are loaded
      const imgElements = reportCardPrintRef.current.querySelectorAll("img");
      const imgPromises = Array.from(imgElements).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imgPromises);

      // Render high-res canvas for crystal-clear print quality
      const canvas = await html2canvas(reportCardPrintRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");

      const safeName = infoName.replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`Report_Card_${safeName}.pdf`);

      toast.success("Report Card PDF downloaded successfully!");
    } catch (err) {
      console.error("Report Card PDF download error:", err);
      toast.error("Failed to generate report card PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Reusable Document Template View
  const renderReportCardDocument = (customClass = "") => (
    <div className={`report-card-document-wrapper ${customClass}`}>
      <img
        src={reportCardTemplate}
        alt="Student Report Card"
        className="report-card-template-img"
      />

      {/* OVERLAY: Dynamic Report Card Values */}
      <div className="report-card-overlay-container">
        {/* =========================================================
            1. STUDENT INFORMATION TABLE (4 Rows)
            ========================================================= */}
        {/* Row 1: Student Name & Grade / Class */}
        <div className="report-card-field field-student-name">
          <span>{infoName}</span>
        </div>
        <div className="report-card-field field-grade-class">
          <span>{infoGrade}</span>
        </div>

        {/* Row 2: School Name & Batch Code */}
        <div className="report-card-field field-school-name">
          <span>{infoSchool}</span>
        </div>
        <div className="report-card-field field-batch-code">
          <span>{infoBatch}</span>
        </div>

        {/* Row 3: Student ID & Course Duration */}
        <div className="report-card-field field-student-id">
          <span>{infoId}</span>
        </div>
        <div className="report-card-field field-course-duration">
          <span>{infoCourseDuration}</span>
        </div>

        {/* Row 4: Program Duration & Mode */}
        <div className="report-card-field field-program-duration">
          <span>{infoProgramDuration}</span>
        </div>
        <div className="report-card-field field-mode">
          <span>{infoMode}</span>
        </div>

        {/* =========================================================
            2. INTERNAL ASSESSMENT TABLE (4 Rows)
            ========================================================= */}
        <div className="report-card-field field-ia-row1-grade">
          <span>{iaGrade1}</span>
        </div>
        <div className="report-card-field field-ia-row2-grade">
          <span>{iaGrade2}</span>
        </div>
        <div className="report-card-field field-ia-row3-grade">
          <span>{iaGrade3}</span>
        </div>
        <div className="report-card-field field-ia-row4-grade">
          <span>{iaGrade4}</span>
        </div>

        {/* =========================================================
            3. PRACTICAL ASSESSMENT TABLE (5 Rows)
            ========================================================= */}
        <div className="report-card-field field-pa-row1-grade">
          <span>{paGrade1}</span>
        </div>
        <div className="report-card-field field-pa-row2-grade">
          <span>{paGrade2}</span>
        </div>
        <div className="report-card-field field-pa-row3-grade">
          <span>{paGrade3}</span>
        </div>
        <div className="report-card-field field-pa-row4-grade">
          <span>{paGrade4}</span>
        </div>
        <div className="report-card-field field-pa-row5-grade">
          <span>{paGrade5}</span>
        </div>

        {/* =========================================================
            4. SKILL DEVELOPMENT TABLE (4 Rows)
            ========================================================= */}
        <div className="report-card-field field-sd-row1-grade">
          <span>{sdGrade1}</span>
        </div>
        <div className="report-card-field field-sd-row2-grade">
          <span>{sdGrade2}</span>
        </div>
        <div className="report-card-field field-sd-row3-grade">
          <span>{sdGrade3}</span>
        </div>
        <div className="report-card-field field-sd-row4-grade">
          <span>{sdGrade4}</span>
        </div>

        {/* =========================================================
            5. FINAL ASSESSMENT TABLE (2 Rows)
            ========================================================= */}
        <div className="report-card-field field-fa-theory-grade">
          <span>{theoryGrade}</span>
        </div>
        <div className="report-card-field field-fa-practical-grade">
          <span>{practicalGrade}</span>
        </div>

        {/* =========================================================
            6. OVERALL GRADE BOX (Centered Highlight Box)
            ========================================================= */}
        <div className="report-card-field field-overall-grade-box">
          <span>{overallGrade}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="student-report-card-page">
      {/* PAGE HEADER */}
      <div className="report-card-page-header">
        <div className="report-card-section-label">
          <FileBarChart size={14} />
          <span>ACADEMIC PERFORMANCE</span>
        </div>
        <h1>Report Card</h1>
        <p>Review and download your official academic and practical performance report.</p>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="report-card-loading-box">
          <Loader2 size={36} className="report-card-loading-spinner" />
          <p>Checking your report card status...</p>
        </div>
      ) : !isBatchEnded || reportState === "BATCH_NOT_ENDED" ? (
        /* BATCH NOT ENDED STATE */
        <div className="report-card-state-wrapper">
          <div className="report-card-state-card not-completed">
            <div className="report-card-state-badge badge-pending">
              <Clock size={13} />
              <span>AVAILABLE AFTER BATCH END DATE</span>
            </div>

            <div className="report-card-state-icon-box">
              <div className="report-card-state-icon-glow"></div>
              <Clock size={40} className="report-card-state-main-icon" />
            </div>

            <h2 className="report-card-state-title">
              Your Report Card will be available after the batch end date.
            </h2>
            <p className="report-card-state-desc">
              Your Report Card will become accessible from{" "}
              <strong style={{ color: "#00e5ff" }}>
                {formatDisplayDate(studentData?.endDate || studentData?.batchEndDate) || "the batch end date"}
              </strong>{" "}
              onwards once your assigned batch ({studentData?.batchCode || "your batch"}) has concluded.
            </p>

            {(studentData?.endDate || studentData?.batchEndDate) && (
              <div
                style={{
                  marginTop: "6px",
                  padding: "8px 18px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(0, 229, 255, 0.25)",
                  borderRadius: "20px",
                  fontSize: "13px",
                  color: "#e2e8f0",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Batch End Date: </span>
                <strong style={{ color: "#00e5ff" }}>
                  {formatDisplayDate(studentData?.endDate || studentData?.batchEndDate)}
                </strong>
              </div>
            )}
          </div>
        </div>
      ) : !isCompleted ? (
        /* INITIAL / INCOMPLETE STATE */
        <div className="report-card-state-wrapper">
          <div className="report-card-state-card not-completed">
            <div className="report-card-state-badge badge-pending">
              <Clock size={13} />
              <span>AWAITING COURSE COMPLETION</span>
            </div>

            <div className="report-card-state-icon-box">
              <div className="report-card-state-icon-glow"></div>
              <Clock size={40} className="report-card-state-main-icon" />
            </div>

            <h2 className="report-card-state-title">
              Your report card will be generated after successful completion of the course.
            </h2>
            <p className="report-card-state-desc">
              Please complete all assigned curriculum modules, assignments, and the Final Assessment to receive your evaluated Report Card.
            </p>
          </div>
        </div>
      ) : (
        /* COMPLETED STATE: Inline Header, Download Button & Populated Report Card Preview */
        <div className="report-card-completed-container">
          <div className="report-card-state-card completed">
            <div className="report-card-state-badge badge-success">
              <Sparkles size={13} />
              <span>OFFICIALLY EVALUATED</span>
            </div>

            <div className="report-card-state-icon-box success">
              <div className="report-card-state-icon-glow success"></div>
              <CheckCircle2 size={40} className="report-card-state-main-icon success" />
            </div>

            <h2 className="report-card-state-title success">
              Your report card is ready!
            </h2>
            <p className="report-card-state-desc">
              View your academic progress and download your official performance report below.
            </p>

            {/* ACTION BUTTONS: Download only */}
            <div className="report-card-actions-row">
              <button
                type="button"
                className="report-card-btn btn-download"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Loader2 size={16} className="report-card-loading-spinner" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Download Report Card (PDF)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* INLINE REPORT CARD PREVIEW */}
          <div className="report-card-inline-preview-section">
            <div className="report-card-preview-frame">
              {renderReportCardDocument()}
            </div>
          </div>
        </div>
      )}

      {/* OFF-SCREEN CAPTURE ELEMENT FOR HIGH-RES DOWNLOAD */}
      {isCompleted && (
        <div className="report-card-hidden-render-container">
          <div ref={reportCardPrintRef} className="report-card-print-target">
            {renderReportCardDocument("print-mode")}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportCard;


