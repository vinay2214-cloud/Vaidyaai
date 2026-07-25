import React from "react";

export const FinancialSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-slate-800/60 rounded-2xl" />
        ))}
      </div>
      <div className="h-48 bg-slate-800/60 rounded-2xl" />
      <div className="h-40 bg-slate-800/60 rounded-2xl" />
    </div>
  );
};
