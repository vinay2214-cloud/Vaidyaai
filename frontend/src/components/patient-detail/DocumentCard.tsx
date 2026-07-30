"use client";

import React from "react";
import { Download, FileText, Pill, Share2, CreditCard } from "lucide-react";
import { Panel, SectionHeader, Badge } from "@/components/design-system";
import { cn } from "@/lib/cn";

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
    <Panel className={cn(className)} padding="md">
      <SectionHeader
        icon={Download}
        title="Clinical Document Center"
        action={<Badge variant="neutral">Total Files: {documents.length}</Badge>}
      />

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {documents.map((doc) => {
          const Icon = iconMap[doc.type] || FileText;

          return (
            <div
              key={doc.id}
              className="panel p-3 flex items-center justify-between gap-3 text-xs panel-hover"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-background-elevated border border-border rounded-lg text-teal-400 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground text-xs truncate">{doc.name}</h4>
                  <p className="text-[10px] text-foreground-subtle font-mono mt-0.5">
                    {doc.type} • {doc.date} • {doc.size}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDownload && onDownload(doc)}
                className="p-1.5 text-foreground-subtle hover:text-teal-400 bg-background-elevated hover:bg-background-hover border border-border rounded-lg transition-colors shrink-0 focus-ring"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
