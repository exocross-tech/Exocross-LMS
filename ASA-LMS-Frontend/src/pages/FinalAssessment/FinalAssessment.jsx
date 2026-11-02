import React from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import "./FinalAssessment.css";

const FinalAssessment = ({
  onNavigateToTheory,
  onNavigateToPractical,
}) => {
  const navigate = useNavigate();

  const handleOpenTheory = () => {
    if (onNavigateToTheory) {
      onNavigateToTheory();
    } else {
      navigate("/final-assessment/theory");
    }
  };

  const handleOpenPractical = () => {
    if (onNavigateToPractical) {
      onNavigateToPractical();
    } else {
      navigate("/final-assessment/practical");
    }
  };

  return (
    <div className="final-assessment-container">
      {/* HEADER */}
      <div className="fa-header-section">
        <span className="fa-section-label">ASSESSMENTS / FINAL ASSESSMENT</span>
        <h1>Final Assessment</h1>
        <p>Create, select, and assign final assessments for your batch students.</p>
      </div>

      {/* TWO ACTION CARDS: THEORY & PRACTICAL */}
      <div className="fa-cards-grid">
        {/* THEORY CARD */}
        <div className="fa-mode-card">
          <div className="fa-card-top">
            <div className="fa-card-icon-box">
              <BookOpen size={24} />
            </div>
            <div className="fa-card-content">
              <h3>Theory Assessment</h3>
              <p>
                Create, view, and manage Theory Final Assessment Question Sets.
                Build question sets by selecting multiple questions across modules.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="fa-mode-btn"
            onClick={handleOpenTheory}
          >
            <span>Theory</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* PRACTICAL CARD */}
        <div className="fa-mode-card">
          <div className="fa-card-top">
            <div className="fa-card-icon-box">
              <FlaskConical size={24} />
            </div>
            <div className="fa-card-content">
              <h3>Practical Assessment</h3>
              <p>
                Select and assign a Practical Assessment / Project Kit to your batch.
                Practical marks are evaluated strictly manually by the tutor (no automated calculation).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="fa-mode-btn"
            onClick={handleOpenPractical}
          >
            <span>Practical</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalAssessment;

