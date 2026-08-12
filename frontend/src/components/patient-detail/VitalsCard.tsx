"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { Panel, SectionHeader } from "@/components/design-system";
import { Activity, Heart, Thermometer, Wind, Scale, Ruler } from "lucide-react";

export interface VitalsData {
  bp_sys: number;
  bp_dia: number;
  pulse: number;
  temperature: number;
  spo2: number;
  resp_rate?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  recorded_at?: string;
}

interface VitalsCardProps {
  vitals: VitalsData;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({ vitals }) => {
  const isUnrecorded = !vitals.bp_sys && !vitals.pulse && !vitals.temperature && !vitals.spo2;

  const items = isUnrecorded
    ? [
        { icon: Activity, label: "Blood Pressure", value: "--", color: "text-foreground-subtle" },
        { icon: Heart, label: "Pulse", value: "--", color: "text-foreground-subtle" },
        { icon: Thermometer, label: "Temperature", value: "--", color: "text-foreground-subtle" },
        { icon: Wind, label: "SpO2", value: "--", color: "text-foreground-subtle" },
        { icon: Activity, label: "Respiratory Rate", value: "--", color: "text-foreground-subtle" },
        { icon: Scale, label: "Weight", value: "--", color: "text-foreground-subtle" },
        { icon: Ruler, label: "Height", value: "--", color: "text-foreground-subtle" },
        { icon: Activity, label: "BMI", value: "--", color: "text-foreground-subtle" },
      ]
    : [
        { icon: Activity, label: "Blood Pressure", value: vitals.bp_sys ? `${vitals.bp_sys}/${vitals.bp_dia} mmHg` : "--", color: vitals.bp_sys > 140 ? "text-red-400" : "text-foreground" },
        { icon: Heart, label: "Pulse", value: vitals.pulse ? `${vitals.pulse} bpm` : "--", color: "text-foreground" },
        { icon: Thermometer, label: "Temperature", value: vitals.temperature ? `${vitals.temperature}°F` : "--", color: vitals.temperature > 99.5 ? "text-orange-400" : "text-foreground" },
        { icon: Wind, label: "SpO2", value: vitals.spo2 ? `${vitals.spo2}%` : "--", color: "text-foreground" },
        { icon: Activity, label: "Respiratory Rate", value: vitals.resp_rate ? `${vitals.resp_rate}/min` : "--", color: "text-foreground" },
        { icon: Scale, label: "Weight", value: vitals.weight_kg ? `${vitals.weight_kg} kg` : "--", color: "text-foreground" },
        { icon: Ruler, label: "Height", value: vitals.height_cm ? `${vitals.height_cm} cm` : "--", color: "text-foreground" },
        { icon: Activity, label: "BMI", value: vitals.bmi ? `${vitals.bmi}` : "--", color: "text-foreground" },
      ];

  return (
    <Panel padding="md">
      <SectionHeader
        icon={Activity}
        title="Vitals"
        subtitle={isUnrecorded ? "Not Recorded • Pending Physical Examination" : (vitals.recorded_at ? `Recorded ${vitals.recorded_at}` : undefined)}
      />
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="panel p-3 border border-border bg-background-elevated/50">
              <div className="flex items-center gap-1.5 text-foreground-subtle mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-semibold">{item.label}</span>
              </div>
              <div className={cn("text-lg font-semibold", item.color)}>{item.value}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
