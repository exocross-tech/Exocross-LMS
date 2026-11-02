import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const ExamTimer = ({ duration = 30, onTimeUp, hideIcon = false }) => {
  // duration is in minutes
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeUp?.();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onTimeUp]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <span className="exam-timer">
      {!hideIcon && <Clock size={16} />}
      {String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  );
};

export default ExamTimer;