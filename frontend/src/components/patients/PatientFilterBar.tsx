import React from "react";
import clsx from "clsx";

export type PatientFilterType = 
  | "ALL"
  | "TODAY"
  | "NEW"
  | "CHRONIC"
  | "FOLLOW_UP"
  | "OVERDUE"
  | "CONSENT_PENDING"
  | "HIGH_RISK"
  | "RECENTLY_ADDED";

interface PatientFilterBarProps {
  activeFilter: PatientFilterType;
  onFilterChange: (filter: PatientFilterType) => void;
  counts?: Record<PatientFilterType, number>;
  className?: string;
}

export const PatientFilterBar: React.FC<PatientFilterBarProps> = ({
  activeFilter,
  onFilterChange,
  counts,
  className
}) => {
  const filters: { id: PatientFilterType; label: string }[] = [
    { id: "ALL", label: "All Patients" },
    { id: "TODAY", label: "Today's Patients" },
    { id: "HIGH_RISK", label: "High Risk" },
    { id: "CHRONIC", label: "Chronic Diseases" },
    { id: "FOLLOW_UP", label: "Follow-Up Due" },
    { id: "OVERDUE", label: "Overdue" },
    { id: "NEW", label: "New Patients" },
    { id: "CONSENT_PENDING", label: "Consent Pending" },
    { id: "RECENTLY_ADDED", label: "Recently Added" }
  ];

  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none ${className || ""}`}>
      {filters.map((f) => {
        const isSelected = activeFilter === f.id;
        const count = counts?.[f.id];

        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5",
              isSelected
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            )}
          >
            <span>{f.label}</span>
            {count !== undefined && (
              <span
                className={clsx(
                  "px-1.5 py-0.2 text-[10px] font-bold rounded-full font-mono",
                  isSelected ? "bg-teal-400 text-slate-950" : "bg-slate-700 text-slate-300"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
