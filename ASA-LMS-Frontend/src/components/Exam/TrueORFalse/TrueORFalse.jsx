import React from "react";

const TrueORFalse = React.memo(({ questionId, selected, onAnswerSelect }) => {
  return (
    <div className="d-flex justify-content-center gap-4 my-4">
      <button
        type="button"
        onClick={() => onAnswerSelect(questionId, "True")}
        className={`btn px-5 py-3 fw-bold rounded-3 transition-all ${
          String(selected).toLowerCase() === "true"
            ? "btn-success text-white shadow-lg border-2 border-light"
            : "btn-outline-light bg-dark text-white opacity-75 hover-opacity-100"
        }`}
        style={{ minWidth: "150px", fontSize: "16px", letterSpacing: "1px" }}
      >
        ✓ TRUE
      </button>

      <button
        type="button"
        onClick={() => onAnswerSelect(questionId, "False")}
        className={`btn px-5 py-3 fw-bold rounded-3 transition-all ${
          String(selected).toLowerCase() === "false"
            ? "btn-danger text-white shadow-lg border-2 border-light"
            : "btn-outline-light bg-dark text-white opacity-75 hover-opacity-100"
        }`}
        style={{ minWidth: "150px", fontSize: "16px", letterSpacing: "1px" }}
      >
        ✕ FALSE
      </button>
    </div>
  );
});

export default TrueORFalse;
