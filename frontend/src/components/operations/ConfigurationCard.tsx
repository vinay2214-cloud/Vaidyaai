import React, { useState } from "react";
import { Settings, Save, Globe, Clock, MessageSquare, Bot } from "lucide-react";
import clsx from "clsx";

export const ConfigurationCard: React.FC = () => {
  const [clinicName, setClinicName] = useState("Vaidya Care Multi-Specialty Clinic");
  const [timezone, setTimezone] = useState("Asia/Kolkata (IST)");
  const [language, setLanguage] = useState("English & Hindi (Auto-detect)");
  const [autoScribe, setAutoScribe] = useState(true);
  const [autoBilling, setAutoBilling] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4.5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Platform & AI Automation Configuration</h3>
        </div>

        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" /> {saved ? "Saved!" : "Save Configuration"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Clinic & Regional Settings */}
        <div className="space-y-3 bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clinic & Regional Settings</span>

          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Clinic Name:</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-teal-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Time Zone:</label>
              <input
                type="text"
                value={timezone}
                disabled
                className="w-full px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-slate-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">AI Language:</label>
              <input
                type="text"
                value={language}
                disabled
                className="w-full px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-slate-400 font-mono"
              />
            </div>
          </div>
        </div>

        {/* AI Workforce Automation Preferences */}
        <div className="space-y-3 bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Automation Preferences</span>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-xs">Agent 2 (ClinicalScribe) Auto-Diarization</h4>
              <p className="text-[10px] text-slate-400">Automatically convert consult audio to SOAP note</p>
            </div>
            <button
              onClick={() => setAutoScribe(!autoScribe)}
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative p-0.5",
                autoScribe ? "bg-teal-500" : "bg-slate-700"
              )}
            >
              <div className={clsx("w-4 h-4 bg-white rounded-full transition-transform", autoScribe ? "translate-x-5" : "translate-x-0")} />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-2">
            <div>
              <h4 className="font-bold text-white text-xs">Agent 3 (BillingPulse) Auto WhatsApp Invoice</h4>
              <p className="text-[10px] text-slate-400">Instantly send Razorpay UPI payment links</p>
            </div>
            <button
              onClick={() => setAutoBilling(!autoBilling)}
              className={clsx(
                "w-10 h-5 rounded-full transition-colors relative p-0.5",
                autoBilling ? "bg-teal-500" : "bg-slate-700"
              )}
            >
              <div className={clsx("w-4 h-4 bg-white rounded-full transition-transform", autoBilling ? "translate-x-5" : "translate-x-0")} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
