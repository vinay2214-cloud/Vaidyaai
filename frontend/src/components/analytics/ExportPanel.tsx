import React, { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileCode, ChevronDown } from "lucide-react";

interface ExportPanelProps {
  onExport: (type: "csv" | "json" | "pdf") => void;
  className?: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ onExport, className }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className || ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
      >
        <Download className="w-4 h-4 text-teal-400" /> Export Reports <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 p-1.5 space-y-1 text-xs">
          <button
            onClick={() => {
              onExport("json");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 rounded-lg flex items-center gap-2 font-mono"
          >
            <FileCode className="w-3.5 h-3.5 text-teal-400" /> Export Audit JSON
          </button>
          <button
            onClick={() => {
              onExport("csv");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 rounded-lg flex items-center gap-2 font-mono"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export Revenue CSV
          </button>
          <button
            onClick={() => {
              onExport("pdf");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 rounded-lg flex items-center gap-2 font-mono"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" /> Practice Summary PDF
          </button>
        </div>
      )}
    </div>
  );
};
