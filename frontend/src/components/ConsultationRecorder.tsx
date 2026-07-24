"use client";

import React, { useState, useRef } from "react";
import { Mic, Square, Loader2, Sparkles, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";

export function ConsultationRecorder({
  consultationId,
  appointmentId,
  onTranscribed
}: {
  consultationId: string;
  appointmentId: string;
  onTranscribed: (data: any) => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [chunkPaths, setChunkPaths] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunkIndexRef.current = 0;
      setChunkPaths([]);

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && clinicId) {
          const formData = new FormData();
          const blob = new Blob([e.data], { type: "audio/webm" });
          formData.append("file", blob, `chunk_${chunkIndexRef.current}.webm`);

          try {
            const res = await api.post(
              `/consultations/upload-chunk?consultation_id=${consultationId}&clinic_id=${clinicId}&chunk_index=${chunkIndexRef.current}`,
              formData,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (res.data.chunk_path) {
              setChunkPaths((prev) => [...prev, res.data.chunk_path]);
            }
            chunkIndexRef.current += 1;
          } catch (err) {
            console.error("Chunk upload failed:", err);
          }
        }
      };

      // Slice audio every 10 seconds
      mediaRecorder.start(10000);
      setRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission required for ambient scribe.");
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setTranscribing(true);

      // Give 1s for last chunk upload to settle
      setTimeout(async () => {
        try {
          const res = await api.post("/consultations/transcribe", {
            clinic_id: clinicId,
            consultation_id: consultationId,
            appointment_id: appointmentId,
            chunk_paths: chunkPaths.length > 0 ? chunkPaths : ["mock_chunk.webm"]
          });
          onTranscribed(res.data);
        } catch (e) {
          console.error("Transcription error:", e);
          alert("Transcription failed. Try again.");
        } finally {
          setTranscribing(false);
        }
      }, 1000);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
        <Sparkles className="w-4 h-4" /> Agent 2: ClinicalScribe (Ambient Scribe)
      </div>

      {!recording && !transcribing ? (
        <button
          onClick={startRecording}
          className="w-full py-4 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-teal-500/20 text-base"
        >
          <Mic className="w-6 h-6 animate-pulse" /> Start Ambient Recording
        </button>
      ) : recording ? (
        <div className="w-full flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-rose-400 font-mono text-sm animate-pulse">
            <span className="w-3 h-3 bg-rose-500 rounded-full"></span> Live Audio Ambient Recording Active ({chunkPaths.length} Chunks Uploaded)
          </div>
          <button
            onClick={stopRecordingAndTranscribe}
            className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors text-sm"
          >
            <Square className="w-5 h-5 fill-current" /> Stop & Generate SOAP Note
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-teal-400 font-medium">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Agent 2 processing audio, running Speech-to-Text & Gemini 1.5 Pro SOAP generation...</p>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center max-w-sm">
        Listens to Doctor-Patient conversation in Telugu, Hindi, or English, separates speakers automatically, and drafts SOAP notes.
      </p>
    </div>
  );
}
