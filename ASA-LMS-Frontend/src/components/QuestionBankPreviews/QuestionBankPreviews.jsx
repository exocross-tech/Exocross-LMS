import React from "react";
import { FaCheckCircle } from "react-icons/fa";
import { normalizeCKEditorImages } from "../../utils/imageUtils";

export const TrueFalsePreview = ({ question, answer }) => {
  return (
    <div className="preview-box p-3 border rounded bg-light">
      <div className="fw-semibold mb-3" dangerouslySetInnerHTML={{ __html: normalizeCKEditorImages(question || "Question Text") }} />
      <div className="d-flex gap-4">
        <div className={`p-2 px-4 rounded border d-flex align-items-center gap-2 ${answer === "True" ? "btn-success text-white fw-bold" : "bg-white text-muted"}`}>
          True {answer === "True" && <FaCheckCircle />}
        </div>
        <div className={`p-2 px-4 rounded border d-flex align-items-center gap-2 ${answer === "False" ? "btn-danger text-white fw-bold" : "bg-white text-muted"}`}>
          False {answer === "False" && <FaCheckCircle />}
        </div>
      </div>
    </div>
  );
};

export const MatchPuzzle = ({ leftHeading, rightHeading, leftItems, rightItems, matches }) => {
  return (
    <div className="preview-box p-3 border rounded bg-light">
      <div className="row">
        <div className="col-6">
          <h6 className="fw-bold text-primary">{leftHeading || "Column A"}</h6>
          {leftItems && leftItems.map((item, idx) => (
            <div key={idx} className="p-2 mb-2 bg-white rounded border d-flex justify-content-between align-items-center">
              <span dangerouslySetInnerHTML={{ __html: item || `Left Item ${idx + 1}` }} />
              <span className="badge bg-secondary ms-2">{matches && matches[idx] !== undefined ? `Matched with ${matches[idx] + 1}` : "Unmatched"}</span>
            </div>
          ))}
        </div>
        <div className="col-6">
          <h6 className="fw-bold text-primary">{rightHeading || "Column B"}</h6>
          {rightItems && rightItems.map((item, idx) => (
            <div key={idx} className="p-2 mb-2 bg-white rounded border">
              <span className="fw-bold me-2">{idx + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: item || `Right Item ${idx + 1}` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PictureMatch = ({ question, items, answers }) => {
  return (
    <div className="preview-box p-3 border rounded" style={{ backgroundColor: "#0b1220", borderColor: "#1e293b", color: "#f8fafc" }}>
      <div className="fw-semibold mb-3 question-text" dangerouslySetInnerHTML={{ __html: normalizeCKEditorImages(question || "Picture Match Question") }} />
      <div className="row g-2">
        {items && items.map((item, idx) => (
          <div key={idx} className="col-md-6">
            <div className="p-2 rounded border" style={{ backgroundColor: "#111c33", borderColor: "#1e293b" }}>
              <div className="fw-bold mb-1 text-cyan">Label {idx + 1}</div>
              <div className="fw-semibold" style={{ color: "#10b981" }}>Answer: {answers && answers[idx] ? answers[idx] : "N/A"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  TrueFalsePreview,
  MatchPuzzle,
  PictureMatch,
};
