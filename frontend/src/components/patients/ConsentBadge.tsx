import React from "react";
import clsx from "clsx";
import { Lock, AlertCircle } from "lucide-react";

interface ConsentBadgeProps {
  status: "granted" | "pending" | "revoked";
  className?: string;
}

export const ConsentBadge: React.FC<ConsentBadgeProps> = ({ status, className }) => {
  const styles = {
    granted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    revoked: "bg-rose-500/10 text-rose-400 border-rose-500/30"
  };

  const label = status === "granted" ? "DPDP Consent Active" : status === "pending" ? "Consent Pending" : "Consent Revoked";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border rounded-md font-mono",
        styles[status] || styles.granted,
        className
      )}
    >
      {status === "granted" ? <Lock className="w-3 h-3 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />}
      {label}
    </span>
  );
};
