"use client";

import { useState, useEffect } from "react";
import { HiClock } from "react-icons/hi2";

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  className?: string;
}

export function CountdownTimer({
  seconds,
  onComplete,
  className = "",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  // Pattern C: reset timeLeft when seconds prop changes (during render)
  const [prevSeconds, setPrevSeconds] = useState(seconds);
  if (prevSeconds !== seconds) {
    setPrevSeconds(seconds);
    setTimeLeft(seconds);
  }

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const remainingSeconds = timeLeft % 60;

  if (timeLeft <= 0) {
    return null;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <HiClock className="w-4 h-4" />
      <span>
        {minutes > 0 ? `${minutes} menit` : ""}
        {remainingSeconds > 0 && (minutes > 0 ? " " : "")}
        {remainingSeconds > 0 ? `${remainingSeconds} detik` : ""}
      </span>
    </span>
  );
}
