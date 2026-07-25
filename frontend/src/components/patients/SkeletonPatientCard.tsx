import React from "react";

export const SkeletonPatientCard: React.FC = () => {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700/60 rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-slate-700/60 rounded" />
            <div className="h-3 w-48 bg-slate-700/40 rounded" />
          </div>
        </div>
        <div className="h-5 w-20 bg-slate-700/60 rounded-md" />
      </div>

      <div className="flex gap-2">
        <div className="h-4 w-24 bg-slate-700/40 rounded" />
        <div className="h-4 w-32 bg-slate-700/40 rounded" />
        <div className="h-4 w-28 bg-slate-700/40 rounded" />
      </div>

      <div className="pt-2 border-t border-slate-700/40 flex justify-between">
        <div className="h-6 w-40 bg-slate-700/40 rounded-xl" />
        <div className="h-6 w-24 bg-slate-700/40 rounded-xl" />
      </div>
    </div>
  );
};
