import React from "react";
import clsx from "clsx";

export type PatientStatusType = 
  | "TODAY"
  | "NEW"
  | "CHRONIC"
  | "FOLLOW-UP"
  | "OVERDUE"
  | "HIGH RISK";

interface PatientBadgeProps {
  status: PatientStatusType;
  className?: string;
}

export const PatientBadge: React.FC<PatientBadgeProps> = ({ status, className }) => {
  const styles: Record<PatientStatusType, string> = {
    TODAY: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    NEW: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    CHRONIC: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    "FOLLOW-UP": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    OVERDUE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    "HIGH RISK": "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse"
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold border rounded-md uppercase font-mono tracking-wider",
        styles[status] || styles.TODAY,
        className
      )}
    >
      {status}
    </span>
  );
};
