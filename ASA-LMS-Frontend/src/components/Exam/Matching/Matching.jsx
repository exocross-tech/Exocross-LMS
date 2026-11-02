import React, { useState, useEffect, useMemo } from "react";
import { normalizeCKEditorImages } from "../../../utils/imageUtils";

const safeParseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const Matching = React.memo(
  ({
    questions = [],
    initialAnswers = [],
    studentAnswer = [],
    leftSideHeading = "Column A",
    rightSideHeading = "Column B",
    onMatchComplete,
  }) => {
    const rawQuestions = useMemo(() => safeParseArray(questions), [questions]);
    const rawAnswers = useMemo(() => safeParseArray(initialAnswers), [initialAnswers]);

    const normalizedQuestions = useMemo(
      () =>
        rawQuestions.map((q, i) =>
          typeof q === "object" && q !== null && q.id
            ? q
            : { id: `q-${i}`, text: String(q || "") }
        ),
      [rawQuestions]
    );

    const normalizedAnswers = useMemo(
      () =>
        rawAnswers.map((a, i) =>
          typeof a === "object" && a !== null && a.id
            ? a
            : { id: `a-${i}`, index: i, text: String(a || "") }
        ),
      [rawAnswers]
    );

    // placed maps leftIndex -> rightIndex
    const [placed, setPlaced] = useState({});
    const [selectedRightIndex, setSelectedRightIndex] = useState(null);

    // Sync studentAnswer
    useEffect(() => {
      const parsed = safeParseArray(studentAnswer);
      const newPlaced = {};
      parsed.forEach((ansIndex, leftIndex) => {
        if (ansIndex !== null && ansIndex !== undefined && ansIndex >= 0) {
          newPlaced[leftIndex] = ansIndex;
        }
      });
      setPlaced(newPlaced);
    }, [studentAnswer]);

    const emitUpdate = (newPlaced) => {
      if (!onMatchComplete) return;
      const studentOrder = normalizedQuestions.map((_, qIndex) => {
        return newPlaced[qIndex] !== undefined ? newPlaced[qIndex] : null;
      });
      onMatchComplete(studentOrder);
    };

    // Which right answers are placed already
    const usedRightIndices = useMemo(() => {
      return new Set(Object.values(placed));
    }, [placed]);

    // Handle HTML5 Drag and Drop
    const handleDragStart = (e, rightIndex) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ rightIndex }));
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDropOnLeftSlot = (e, leftIndex) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { rightIndex } = data;
        if (rightIndex === undefined) return;

        setPlaced((prev) => {
          const updated = { ...prev };
          // If rightIndex was used in another slot, clear it from there
          Object.keys(updated).forEach((k) => {
            if (updated[k] === rightIndex) delete updated[k];
          });
          updated[leftIndex] = rightIndex;
          emitUpdate(updated);
          return updated;
        });
        setSelectedRightIndex(null);
      } catch (err) {
        console.error("Matching drop error:", err);
      }
    };

    const handleSlotClick = (leftIndex) => {
      if (selectedRightIndex !== null) {
        setPlaced((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((k) => {
            if (updated[k] === selectedRightIndex) delete updated[k];
          });
          updated[leftIndex] = selectedRightIndex;
          emitUpdate(updated);
          return updated;
        });
        setSelectedRightIndex(null);
        return;
      }

      // If clicked on an already matched slot, clear it
      if (placed[leftIndex] !== undefined) {
        setPlaced((prev) => {
          const updated = { ...prev };
          delete updated[leftIndex];
          emitUpdate(updated);
          return updated;
        });
      }
    };

    const handleRightChipClick = (rightIndex) => {
      if (selectedRightIndex === rightIndex) {
        setSelectedRightIndex(null);
        return;
      }
      setSelectedRightIndex(rightIndex);
    };

    return (
      <div className="matching-component my-3 p-3 rounded border" style={{ backgroundColor: "#0b1220", borderColor: "#1e293b" }}>
        <div className="row g-4">
          {/* Left Side: Questions / Prompts */}
          <div className="col-md-6">
            <h6 className="fw-bold text-cyan mb-3">{leftSideHeading || "Column A"}</h6>
            <div className="d-flex flex-column gap-2">
              {normalizedQuestions.map((q, leftIndex) => {
                const matchedRightIndex = placed[leftIndex];
                const matchedAnswer =
                  matchedRightIndex !== undefined
                    ? normalizedAnswers[matchedRightIndex]
                    : null;

                return (
                  <div
                    key={q.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnLeftSlot(e, leftIndex)}
                    onClick={() => handleSlotClick(leftIndex)}
                    className="p-3 rounded border d-flex justify-content-between align-items-center transition-all"
                    style={{
                      backgroundColor: matchedAnswer ? "#111c33" : "#0d1527",
                      borderColor: matchedAnswer ? "#00e5ff" : "#334155",
                      cursor: "pointer",
                      minHeight: "56px",
                    }}
                    title={
                      matchedAnswer
                        ? "Click to unmatch"
                        : selectedRightIndex !== null
                        ? "Click to assign selected answer"
                        : "Drag matching answer here"
                    }
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-secondary">{leftIndex + 1}</span>
                      <span
                        className="text-white fw-medium"
                        dangerouslySetInnerHTML={{
                          __html: normalizeCKEditorImages(q.text),
                        }}
                      />
                    </div>

                    <div className="ms-2">
                      {matchedAnswer ? (
                        <span className="badge bg-cyan text-dark fw-bold px-2 py-1">
                          Matched: {matchedAnswer.text} ✕
                        </span>
                      ) : (
                        <span className="badge bg-dark text-secondary border border-secondary">
                          {selectedRightIndex !== null ? "Drop here" : "Unmatched"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Available Answers */}
          <div className="col-md-6">
            <h6 className="fw-bold text-cyan mb-3">{rightSideHeading || "Column B"}</h6>
            <div className="d-flex flex-column gap-2">
              {normalizedAnswers.map((a, rightIndex) => {
                const isUsed = usedRightIndices.has(rightIndex);
                const isSelected = selectedRightIndex === rightIndex;

                return (
                  <div
                    key={a.id}
                    draggable={!isUsed}
                    onDragStart={(e) => handleDragStart(e, rightIndex)}
                    onClick={() => handleRightChipClick(rightIndex)}
                    className={`p-3 rounded border d-flex align-items-center justify-content-between transition-all ${
                      isUsed ? "opacity-50" : "cursor-grab"
                    }`}
                    style={{
                      backgroundColor: isSelected ? "#00e5ff" : "#111c33",
                      borderColor: isSelected ? "#00e5ff" : "#334155",
                      color: isSelected ? "#000" : "#fff",
                      cursor: isUsed ? "not-allowed" : "pointer",
                      minHeight: "56px",
                    }}
                    title={isUsed ? "Already matched" : "Drag or click to select"}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${isSelected ? "bg-dark text-white" : "bg-secondary"}`}>
                        {String.fromCharCode(65 + rightIndex)}
                      </span>
                      <span
                        className="fw-medium"
                        dangerouslySetInnerHTML={{
                          __html: normalizeCKEditorImages(a.text),
                        }}
                      />
                    </div>
                    {isUsed && (
                      <span className="badge bg-success text-white small">Assigned</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default Matching;
