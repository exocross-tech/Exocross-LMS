import React, { useState, useMemo, useEffect } from "react";
import { normalizeCKEditorImages } from "../../../utils/imageUtils";
import { X, GripVertical, CheckCircle2, Tag } from "lucide-react";
import "./PictureMatching.css";

const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

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

const PictureMatching = React.memo(
  ({ answers = [], studentAnswer = [], onSequenceSelect }) => {
    const rawAnswers = useMemo(() => safeParseArray(answers), [answers]);

    const normalizedAnswers = useMemo(
      () =>
        rawAnswers.map((a, i) =>
          typeof a === "object" && a !== null && a.id
            ? a
            : { id: `ans-${i}-${String(a).slice(0, 15)}`, text: String(a || "") }
        ),
      [rawAnswers]
    );

    const [placed, setPlaced] = useState({});
    const [pool, setPool] = useState([]);
    const [selectedChipId, setSelectedChipId] = useState(null);

    const findAnswer = (id) => normalizedAnswers.find((a) => a.id === id);

    // Sync studentAnswer when placed changes
    const emitUpdate = (newPlaced) => {
      const orderedArray = normalizedAnswers.map((_, index) => {
        const id = newPlaced[index];
        return id && findAnswer(id) ? findAnswer(id).text : "";
      });
      if (onSequenceSelect) {
        onSequenceSelect(orderedArray);
      }
    };

    // Initialize or restore state when answers or studentAnswer changes
    useEffect(() => {
      const parsedStudentAns = safeParseArray(studentAnswer);
      const newPlaced = {};
      const usedIds = new Set();

      parsedStudentAns.forEach((text, index) => {
        if (!text) return;
        const match = normalizedAnswers.find(
          (a) => a.text === text && !usedIds.has(a.id)
        );
        if (match) {
          newPlaced[index] = match.id;
          usedIds.add(match.id);
        }
      });

      setPlaced(newPlaced);
      const remaining = normalizedAnswers.filter((a) => !usedIds.has(a.id));
      setPool(shuffleArray(remaining));
    }, [normalizedAnswers, studentAnswer]);

    // Handle HTML5 Drag and Drop
    const handleDragStart = (e, id, fromSlot = null) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ id, fromSlot }));
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDropOnSlot = (e, slotIndex) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { id, fromSlot } = data;
        if (!id) return;

        setPlaced((prev) => {
          const updated = { ...prev };
          const previousOccupant = updated[slotIndex];

          if (fromSlot !== null && fromSlot !== undefined && fromSlot !== slotIndex) {
            updated[fromSlot] = previousOccupant || undefined;
          } else if (previousOccupant && previousOccupant !== id) {
            setPool((p) => [...p, findAnswer(previousOccupant)]);
          }

          updated[slotIndex] = id;
          if (fromSlot === null || fromSlot === undefined) {
            setPool((p) => p.filter((a) => a.id !== id));
          }

          emitUpdate(updated);
          return updated;
        });
        setSelectedChipId(null);
      } catch (err) {
        console.error("Drop error:", err);
      }
    };

    const handleDropOnPool = (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        const { fromSlot } = data;
        if (fromSlot !== null && fromSlot !== undefined) {
          handleRemoveFromSlot(fromSlot);
        }
      } catch (err) {
        console.error("Pool drop error:", err);
      }
    };

    // Click to select & place
    const handleChipClick = (id) => {
      if (selectedChipId === id) {
        setSelectedChipId(null);
        return;
      }
      setSelectedChipId(id);
    };

    const handleSlotClick = (slotIndex) => {
      // If a chip is currently selected from the pool
      if (selectedChipId) {
        setPlaced((prev) => {
          const updated = { ...prev };
          const previousOccupant = updated[slotIndex];

          updated[slotIndex] = selectedChipId;
          setPool((p) => {
            const filtered = p.filter((a) => a.id !== selectedChipId);
            return previousOccupant ? [...filtered, findAnswer(previousOccupant)] : filtered;
          });

          emitUpdate(updated);
          return updated;
        });
        setSelectedChipId(null);
        return;
      }

      // If no chip selected, but slot has an item, remove it
      if (placed[slotIndex]) {
        handleRemoveFromSlot(slotIndex);
      }
    };

    const handleRemoveFromSlot = (slotIndex) => {
      setPlaced((prev) => {
        const updated = { ...prev };
        const removedId = updated[slotIndex];
        if (removedId) {
          delete updated[slotIndex];
          setPool((p) => [...p, findAnswer(removedId)]);
          emitUpdate(updated);
        }
        return updated;
      });
      setSelectedChipId(null);
    };

    const assignedCount = Object.keys(placed).filter((k) => placed[k]).length;
    const totalCount = normalizedAnswers.length;
    const allAssigned = assignedCount === totalCount && totalCount > 0;

    return (
      <div className="pm-container">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-title-group">
            <h6 className="pm-title">
              <Tag size={18} />
              Label Matching Slots
            </h6>
            <p className="pm-subtitle">
              Drag answers or click to place in the corresponding numbered diagram slots
            </p>
          </div>

          <div className={`pm-status-badge ${allAssigned ? "all-assigned" : ""}`}>
            {allAssigned ? <CheckCircle2 size={14} /> : null}
            {assignedCount} of {totalCount} Assigned
          </div>
        </div>

        {/* Numbered Slots Grid */}
        <div className="pm-slots-grid">
          {normalizedAnswers.map((_, i) => {
            const occupantId = placed[i];
            const occupant = occupantId ? findAnswer(occupantId) : null;
            const isTarget = selectedChipId && !occupant;

            return (
              <div
                key={i}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSlot(e, i)}
                onClick={() => handleSlotClick(i)}
                className={`pm-slot-card ${occupant ? "occupied" : "empty"} ${
                  isTarget ? "target-active" : ""
                }`}
                title={
                  occupant
                    ? "Click to remove label from slot"
                    : selectedChipId
                    ? "Click to place selected answer here"
                    : `Slot ${i + 1} - Drag or click an answer to assign`
                }
              >
                <div className="pm-slot-left">
                  <span className="pm-slot-badge">{i + 1}</span>
                  {occupant ? (
                    <span
                      className="pm-slot-text"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, occupant.id, i)}
                      dangerouslySetInnerHTML={{
                        __html: normalizeCKEditorImages(occupant.text),
                      }}
                    />
                  ) : (
                    <span
                      className={`pm-slot-text ${
                        isTarget ? "target-text" : "empty-text"
                      }`}
                    >
                      {isTarget ? "Click to place here" : `Empty Slot ${i + 1}`}
                    </span>
                  )}
                </div>

                {occupant && (
                  <button
                    type="button"
                    className="pm-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromSlot(i);
                    }}
                    title="Remove from slot"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Available Answers Pool */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDropOnPool}
          className="pm-pool-card"
        >
          <div className="pm-pool-header">
            <h6 className="pm-pool-title">
              Available Answer Options
              <span className="pm-pool-count">{pool.length}</span>
            </h6>

            {selectedChipId && (
              <span className="pm-selection-banner">
                Option Selected! Click any slot above to place
              </span>
            )}
          </div>

          {pool.length > 0 ? (
            <div className="pm-chips-list">
              {pool.map((a) => {
                const isSelected = selectedChipId === a.id;
                return (
                  <div
                    key={a.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, a.id, null)}
                    onClick={() => handleChipClick(a.id)}
                    className={`pm-chip ${isSelected ? "selected" : ""}`}
                    title="Drag to slot or click to select"
                  >
                    <span className="pm-chip-icon">
                      <GripVertical size={14} />
                    </span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: normalizeCKEditorImages(a.text),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="pm-all-assigned-msg">
              <CheckCircle2 size={16} color="#10b981" />
              All labels have been assigned! Click any slot above to re-adjust if needed.
            </p>
          )}
        </div>
      </div>
    );
  }
);

export default PictureMatching;
