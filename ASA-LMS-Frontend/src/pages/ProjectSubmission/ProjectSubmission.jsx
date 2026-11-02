import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Award,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import "./ProjectSubmission.css";

const ProjectSubmission = ({ onNavigateToAssessment, onNavigateToFinalAssessment }) => {
  const navigate = useNavigate();

  const handleNavigateAssessment = () => {
    if (onNavigateToAssessment) {
      onNavigateToAssessment();
    } else {
      navigate("/assignment-page");
    }
  };

  const handleNavigateFinalAssessment = () => {
    if (onNavigateToFinalAssessment) {
      onNavigateToFinalAssessment();
    } else {
      navigate("/student-final-assessment");
    }
  };

  return (
    <div className="student-assignment-page project-submission-page">
      {/* 3-Level Standard Header matching Student Assessment Page */}
      <div className="assignment-page-header">
        <div className="assignment-section-label">
          <Sparkles size={13} />
          <span>PROJECT SUBMISSION</span>
        </div>
        <h1>Project Submission</h1>
        <p>Choose an assessment option to proceed with your coursework submission.</p>
      </div>

      {/* Two Main Option Cards: Assessment vs Final Assessment */}
      <div className="submission-options-container">
        {/* Option 1: Assessment */}
        <div
          className="submission-option-tab"
          onClick={handleNavigateAssessment}
        >
          <div className="option-tab-icon">
            <FileText size={24} />
          </div>
          <div className="option-tab-text">
            <span className="option-tab-title">Assessment</span>
            <span className="option-tab-sub">
              View and take regular module assessments and question sets
            </span>
          </div>
          <ArrowRight size={18} className="option-tab-arrow" />
        </div>

        {/* Option 2: Final Assessment */}
        <div
          className="submission-option-tab"
          onClick={handleNavigateFinalAssessment}
        >
          <div className="option-tab-icon">
            <Award size={24} />
          </div>
          <div className="option-tab-text">
            <span className="option-tab-title">Final Assessment</span>
            <span className="option-tab-sub">
              Upload and submit your 5 practical final assessment files
            </span>
          </div>
          <ArrowRight size={18} className="option-tab-arrow" />
        </div>
      </div>
    </div>
  );
};

export default ProjectSubmission;
