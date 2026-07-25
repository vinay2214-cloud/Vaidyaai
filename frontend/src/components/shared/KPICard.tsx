import React from "react";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  color?: "teal" | "emerald" | "amber" | "blue" | "purple" | "indigo" | "rose" | "slate";
  trend?: string;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "teal",
  trend,
  className
}) => {
  const colorStyles = {
    teal: {
      text: "text-teal-400",
      bg: "bg-teal-500/10",
      border: "border-teal-500/20"
    },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    },
    blue: {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    purple: {
      text: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    indigo: {
      text: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20"
    },
    rose: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20"
    },
    slate: {
      text: "text-slate-300",
      bg: "bg-slate-700/30",
      border: "border-slate-700/50"
    }
  };

  const currentStyle = colorStyles[color] || colorStyles.teal;

  return (
    <div
      className={clsx(
        "bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col justify-between hover:border-slate-600/80 transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon && (
          <div className={clsx("p-1.5 rounded-lg border", currentStyle.bg, currentStyle.border)}>
            <Icon className={clsx("w-3.5 h-3.5", currentStyle.text)} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <p className={clsx("text-xl font-bold tracking-tight", currentStyle.text)}>{value}</p>
        {trend && (
          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</p>}
    </div>
  );
};
