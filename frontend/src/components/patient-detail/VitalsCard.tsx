import React from "react";
import { Activity, Heart, Thermometer, Wind, Gauge, Scale, AlertTriangle } from "lucide-react";
import clsx from "clsx";

export interface VitalsData {
  bp_sys: number;
  bp_dia: number;
  pulse: number;
  temperature: number;
  spo2: number;
  resp_rate: number;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  recorded_at: string;
}

interface VitalsCardProps {
  vitals: VitalsData;
  className?: string;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({ vitals, className }) => {
  const isBpAbnormal = vitals.bp_sys > 130 || vitals.bp_dia > 85;
  const isSpo2Abnormal = vitals.spo2 < 95;

  return (
    <div className={clsx("bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-3.5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Vitals & Biometrics</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Last Recorded: <strong className="text-slate-200">{vitals.recorded_at}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* BP */}
        <div
          className={clsx(
            "border rounded-xl p-3 space-y-1",
            isBpAbnormal ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-900/60 border-slate-700/50"
          )}
        >
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
            Blood Pressure
            {isBpAbnormal && <AlertTriangle className="w-3 h-3 text-amber-400" />}
          </span>
          <p className={clsx("text-lg font-bold font-mono", isBpAbnormal ? "text-amber-400" : "text-teal-400")}>
            {vitals.bp_sys}/{vitals.bp_dia} <span className="text-xs font-normal text-slate-400">mmHg</span>
          </p>
        </div>

        {/* Pulse */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Pulse Rate</span>
          <p className="text-lg font-bold text-emerald-400 font-mono">
            {vitals.pulse} <span className="text-xs font-normal text-slate-400">bpm</span>
          </p>
        </div>

        {/* SpO2 */}
        <div
          className={clsx(
            "border rounded-xl p-3 space-y-1",
            isSpo2Abnormal ? "bg-rose-500/10 border-rose-500/30" : "bg-slate-900/60 border-slate-700/50"
          )}
        >
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
            SpO₂ Saturation
            {isSpo2Abnormal && <AlertTriangle className="w-3 h-3 text-rose-400" />}
          </span>
          <p className={clsx("text-lg font-bold font-mono", isSpo2Abnormal ? "text-rose-400" : "text-teal-400")}>
            {vitals.spo2}%
          </p>
        </div>

        {/* Temperature */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Temperature</span>
          <p className="text-lg font-bold text-purple-300 font-mono">
            {vitals.temperature}°F
          </p>
        </div>

        {/* Weight & BMI */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1 col-span-2 sm:col-span-4 flex items-center justify-between text-xs font-mono">
          <span>Weight: <strong className="text-white">{vitals.weight_kg} kg</strong></span>
          <span>Height: <strong className="text-white">{vitals.height_cm} cm</strong></span>
          <span>BMI: <strong className="text-teal-400">{vitals.bmi} kg/m²</strong> (Normal)</span>
        </div>
      </div>
    </div>
  );
};
