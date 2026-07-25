import React from "react";
import { Download, FileText, Pill, Share2, CreditCard } from "lucide-react";
import clsx from "clsx";

export interface ClinicalDocument {
  id: string;
  name: string;
  type: "SOAP PDF" | "Prescription Rx" | "Referral Letter" | "Invoice PDF" | "Visit Summary";
  date: string;
  size: string;
}

interface DocumentCardProps {
  documents: ClinicalDocument[];
  onDownload?: (doc: ClinicalDocument) => void;
  className?: string;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ documents, onDownload, className }) => {
  const iconMap = {
    "SOAP PDF": FileText,
    "Prescription Rx": Pill,
    "Referral Letter": Share2,
    "Invoice PDF": CreditCard,
    "Visit Summary": FileText
  };

  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Clinical Document Center</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Total Files: {documents.length}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {documents.map((doc) => {
          const Icon = iconMap[doc.type] || FileText;

          return (
            <div
              key={doc.id}
              className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 text-xs hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-teal-400 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-xs truncate">{doc.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {doc.type} • {doc.date} • {doc.size}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDownload && onDownload(doc)}
                className="p-1.5 text-slate-400 hover:text-teal-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
