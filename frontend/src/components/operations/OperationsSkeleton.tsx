import React from "react";

export const OperationsSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-800/60 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-800/60 rounded-2xl" />
        ))}
      </div>
      <div className="h-48 bg-slate-800/60 rounded-2xl" />
    </div>
  );
};
