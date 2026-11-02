import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Clock,
  Download,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";
import { finalAssessmentApi } from "../../services/apiService";
import { formatStudentRollNo } from "../../utils/formatRollNo";
import "./Certificate.css";

// Asset imports
import certBackground from "../../assets/images/Certificate/aerospace_certificate_.png";
import faviconWatermark from "../../assets/images/Certificate/favicon.png";
import globalLogo from "../../assets/images/Certificate/globallogo.png";
import marsLogo from "../../assets/images/Certificate/marslogo.png";
import mrkSignature from "../../assets/images/Certificate/MRK Signature.png";
import jebaSignature from "../../assets/images/Certificate/Jebaselvan's Signature.png";

const Certificate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [certData, setCertData] = useState(null);
  const [certState, setCertState] = useState("NOT_COMPLETED"); // NOT_COMPLETED | NOT_EVALUATED | EVALUATED
  const isFetched = useRef(false);
  const certificateRef = useRef(null);

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

  const fetchCertificateDetails = async () => {
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
        setCertState(state);
        setCertData(res.data.data);
      } else {
        setCertState("NOT_COMPLETED");
        setCertData(null);
        toast.error(res?.data?.message || "Failed to load certificate information");
      }
    } catch (err) {
      console.error("Fetch certificate error:", err);
      setCertState("NOT_COMPLETED");
      setCertData(null);
      toast.error(
        err?.response?.data?.message || "Failed to load certificate information"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFetched.current) {
      isFetched.current = true;
      fetchCertificateDetails();
    }
  }, [studentId]);

  // Formatter for reviewed date: "03-09-2026" or "DD-MM-YYYY"
  const formatReviewedDate = (dateStr) => {
    if (!dateStr) return "03-09-2026";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return String(dateStr);
    }
  };

  // Helper to convert an image / canvas to clean base64 / binary for PDF
  const createPdfFromCanvas = (canvas) => {
    const imgDataUrl = canvas.toDataURL("image/jpeg", 0.98);
    const base64Data = imgDataUrl.split(",")[1];
    const binaryImg = atob(base64Data);
    const imgLength = binaryImg.length;
    const imgBytes = new Uint8Array(imgLength);
    for (let i = 0; i < imgLength; i++) {
      imgBytes[i] = binaryImg.charCodeAt(i);
    }

    // A4 landscape dimensions in PDF points (72 points/inch): 841.89 x 595.28 pt (297mm x 210mm)
    const pageWidth = 841.89;
    const pageHeight = 595.28;

    // Build standard conforming PDF document binary stream
    const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    
    // Object 1: Catalog
    const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    
    // Object 2: Pages
    const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
    
    // Object 3: Page (A4 landscape)
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Img1 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`;
    
    // Object 4: Image XObject (JPEG)
    const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLength} >>\nstream\n`;
    const obj4Footer = `\nendstream\nendobj\n`;
    
    // Object 5: Content stream placing the image to fill the exact A4 landscape page
    const contentStream = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Img1 Do\nQ\n`;
    const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

    const encoder = new TextEncoder();
    const hBytes = encoder.encode(header);
    const o1Bytes = encoder.encode(obj1);
    const o2Bytes = encoder.encode(obj2);
    const o3Bytes = encoder.encode(obj3);
    const o4hBytes = encoder.encode(obj4Header);
    const o4fBytes = encoder.encode(obj4Footer);
    const o5Bytes = encoder.encode(obj5);

    // Calculate xref byte offsets
    const offset1 = hBytes.length;
    const offset2 = offset1 + o1Bytes.length;
    const offset3 = offset2 + o2Bytes.length;
    const offset4 = offset3 + o3Bytes.length;
    const offset5 = offset4 + o4hBytes.length + imgBytes.length + o4fBytes.length;

    const xrefOffset = offset5 + o5Bytes.length;
    const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, "0")} 00000 n \n${String(offset2).padStart(10, "0")} 00000 n \n${String(offset3).padStart(10, "0")} 00000 n \n${String(offset4).padStart(10, "0")} 00000 n \n${String(offset5).padStart(10, "0")} 00000 n \n`;
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    
    const xrefBytes = encoder.encode(xref);
    const trailerBytes = encoder.encode(trailer);

    const totalLength =
      hBytes.length +
      o1Bytes.length +
      o2Bytes.length +
      o3Bytes.length +
      o4hBytes.length +
      imgBytes.length +
      o4fBytes.length +
      o5Bytes.length +
      xrefBytes.length +
      trailerBytes.length;

    const pdfBuffer = new Uint8Array(totalLength);
    let cur = 0;
    
    const append = (bytes) => {
      pdfBuffer.set(bytes, cur);
      cur += bytes.length;
    };

    append(hBytes);
    append(o1Bytes);
    append(o2Bytes);
    append(o3Bytes);
    append(o4hBytes);
    append(imgBytes);
    append(o4fBytes);
    append(o5Bytes);
    append(xrefBytes);
    append(trailerBytes);

    return new Blob([pdfBuffer], { type: "application/pdf" });
  };

  // High-Resolution PDF Generator / Downloader
  const handleDownloadPDF = async () => {
    if (certState !== "EVALUATED" || !certData) {
      toast.warning("Certificate is not ready for download.");
      return;
    }

    if (!certificateRef.current) {
      toast.error("Certificate element could not be located.");
      return;
    }

    try {
      setDownloading(true);
      toast.info("Generating high-quality certificate PDF...");

      // Ensure fonts and images in document are completely loaded
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Pre-check and ensure all images within the certificate are loaded
      const imgElements = certificateRef.current.querySelectorAll("img");
      const imgPromises = Array.from(imgElements).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imgPromises);

      // Render certificate element into a high-res canvas (2.5x scale for pristine print resolution)
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
        logging: false,
        onclone: (clonedDoc) => {
          // Ensure cloned certificate wrapper keeps exact dimensions
          const clonedCert = clonedDoc.querySelector(".certificate-wrapper");
          if (clonedCert) {
            clonedCert.style.width = "1123px";
            clonedCert.style.height = "794px";
            clonedCert.style.transform = "none";
          }
        },
      });

      // Convert canvas to valid, readable PDF Blob
      const pdfBlob = createPdfFromCanvas(canvas);

      // Create download filename: Certificate_<StudentName>.pdf
      const rawName = certData?.studentName || user?.USERNAME || "Student";
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `Certificate_${sanitizedName}.pdf`;

      // Trigger browser PDF download
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      toast.success("Certificate PDF downloaded successfully!");
    } catch (err) {
      console.error("Certificate PDF download error:", err);
      toast.error("Failed to generate certificate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="student-certificate-page">
      {/* ================= PAGE HEADER (MATCHES ASSESSMENT RESULTS STYLE) ================= */}
      <div className="certificate-page-header">
        <div className="certificate-section-label">
          <Award size={14} />
          <span>ACHIEVEMENT &amp; RECOGNITION</span>
        </div>
        <h1>Certificate of Achievement</h1>
        <p>
          View and download your certificate of achievement for successfully completing the required final assessment and evaluation.
        </p>
      </div>

      {/* ================= BODY CONTENT BY STATE ================= */}
      {loading ? (
        <div className="certificate-loading-box">
          <RefreshCw size={32} className="certificate-loading-spinner" />
          <span>Verifying your certificate eligibility...</span>
        </div>
      ) : certState === "NOT_COMPLETED" || certState === "NOT_EVALUATED" ? (
        /* ================= STATE 1: NOT AVAILABLE (NOT COMPLETED / NOT EVALUATED) ================= */
        <div className="certificate-state-wrapper">
          <div className="certificate-state-card">
            <div className="certificate-state-badge badge-warning">
              <span>🔒 Certificate - Not Yet Available</span>
            </div>

            <div className="certificate-state-icon-box">
              <div className="certificate-state-icon-glow" />
              <Award size={36} className="certificate-state-main-icon" />
            </div>

            <h2 className="certificate-state-title">
              Your Certificate Awaits!
            </h2>

            <p className="certificate-state-description">
              Your Certificate of Completion will be generated once you successfully complete all the required components of the Aerospace Intensive Certificate Program.
            </p>

            {certData?.assessmentTitle && (
              <div className="certificate-info-pill-grid">
                <div className="certificate-info-pill">
                  <span>Assigned Program:</span>
                  <strong>{certData.assessmentTitle}</strong>
                </div>
                {certData?.batchCode && (
                  <div className="certificate-info-pill">
                    <span>Batch:</span>
                    <strong>{certData.batchCode}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="certificate-state-actions">
              <button
                type="button"
                className="certificate-primary-btn"
                onClick={() => navigate("/student-final-assessment")}
              >
                <FileCheck size={16} />
                <span>Go to Final Assessment</span>
              </button>
              <button
                type="button"
                className="certificate-secondary-btn"
                onClick={fetchCertificateDetails}
              >
                <RefreshCw size={15} />
                <span>Check Status</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= STATE 2: COMPLETED & EVALUATED ================= */
        <div className="certificate-eligible-container">
          {/* Completed State Header Announcement */}
          <div className="certificate-completed-header-box">
            <div className="certificate-completed-badge">
              <span>🏆 Certificate of Completion</span>
            </div>
            <h2 className="certificate-congrats-title">Congratulations!</h2>
            <p className="certificate-congrats-subtitle">
              You have successfully completed the Aerospace Intensive Certificate Program.
            </p>
            <p className="certificate-congrats-desc">
              You have fulfilled all the required course components, including the learning sessions, activities, project submission, and final assessment.
            </p>
          </div>

          {/* Action Header with Download Certificate Button (Above Preview) */}
          <div className="certificate-top-actions-bar">
            <button
              type="button"
              className="certificate-main-download-btn"
              onClick={handleDownloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Generating Certificate PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Download Certificate</span>
                </>
              )}
            </button>
          </div>

          {/* Master Certificate Page Frame (Certificate Preview) */}
          <main className="certificate-page">
            <div className="certificate-preview-scaler">
              <div className="certificate-wrapper" ref={certificateRef}>
              <article className="certificate">
                {/* Master Background Image */}
                <img
                  src={certBackground}
                  alt="Certificate Background"
                  className="certificate-master-bg"
                  aria-hidden="true"
                />

                {/* Faint Background Watermark Logo */}
                <img
                  src={faviconWatermark}
                  alt=""
                  className="certificate-background-logo"
                  aria-hidden="true"
                />

                {/* Main Certificate Content */}
                <div className="certificate-content">
                  {/* Global Aero Sports Logo */}
                  <div className="certificate-logo-wrapper">
                    <img
                      src={globalLogo}
                      alt="Exocross LMS"
                      className="certificate-logo"
                    />
                  </div>

                  {/* MRS Partner Logo */}
                  <div className="certificate-partner-logo-wrapper">
                    <img
                      src={marsLogo}
                      alt="Model Rocketry Society"
                      className="certificate-partner-logo"
                    />
                  </div>

                  {/* Certificate Title */}
                  <div className="certificate-title-block">
                    <h1 className="certificate-title">CERTIFICATE</h1>
                    <h2 className="certificate-subtitle">OF ACHIEVEMENT</h2>
                  </div>

                  {/* Introduction */}
                  <p className="certificate-intro">
                    THIS IS TO PROUDLY CERTIFY THAT
                  </p>

                  {/* Student Name */}
                  <div className="certificate-student-name-wrapper">
                    <div className="certificate-student-name" id="studentName">
                      {(certData?.studentName || user?.USERNAME || "Student Name")?.toUpperCase()}
                    </div>
                    <div className="certificate-name-underline"></div>
                  </div>

                  {/* Description */}
                  <p className="certificate-description">
                    has successfully completed the{" "}
                    <strong id="programName">
                      {certData?.assessmentTitle || "Aerospace Intensive Certificate Program"}
                    </strong>{" "}
                    conducted by Exocross LMS, comprising 30 hours of intensive,
                    hands-on training in Aeromodelling, Model Rocketry, Drone
                    Technology, and RC Technology. We appreciate his/her dedication,
                    enthusiasm, and commitment throughout the program and believe that
                    this enriching experience will inspire him/her to explore new
                    horizons, develop their skills, and achieve greater heights in
                    their pursuit of excellence.
                  </p>

                  {/* Footer / Signature Row */}
                  <div className="certificate-footer-row">
                    {/* Date */}
                    <div className="certificate-meta-col col-date">
                      <div className="certificate-meta-val" id="reviewedDate">
                        {formatReviewedDate(certData?.reviewedDate)}
                      </div>
                      <div className="certificate-meta-divider"></div>
                      <div className="certificate-meta-label">DATE</div>
                    </div>

                    {/* Signatory 1: Dr. M.R.K. Menon */}
                    <div className="certificate-meta-col col-signatory col-mrk">
                      <div className="certificate-sig-wrapper">
                        <img
                          src={mrkSignature}
                          alt="Dr. M.R.K. Menon Signature"
                          className="certificate-signature-img cert-sig-mrk"
                        />
                      </div>
                      <div className="certificate-meta-divider"></div>
                      <div className="certificate-signer-name">DR. M.R.K. MENON</div>
                      <div className="certificate-signer-role">
                        FOUNDER &amp; CHIEF MENTOR
                      </div>
                    </div>

                    {/* Signatory 2: B.S. Jebaselvan */}
                    <div className="certificate-meta-col col-signatory col-jeba">
                      <div className="certificate-sig-wrapper">
                        <img
                          src={jebaSignature}
                          alt="B.S. Jebaselvan Signature"
                          className="certificate-signature-img cert-sig-jeba"
                        />
                      </div>
                      <div className="certificate-meta-divider"></div>
                      <div className="certificate-signer-name">B.S. JEBASELVAN</div>
                      <div className="certificate-signer-role">
                        DIRECTOR OF EXOCROSS LMS
                      </div>
                    </div>
                  </div>

                  {/* Student ID */}
                  <div className="certificate-student-id-block">
                    <span className="certificate-student-id" id="studentRollNo">
                      {certData?.rollNo ? formatStudentRollNo(certData.rollNo) : (studentId ? formatStudentRollNo(String(studentId)) : "01-AICP-26")}
                    </span>
                  </div>
                </div>
              </article>
            </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default Certificate;
