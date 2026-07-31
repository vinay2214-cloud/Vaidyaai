"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Sparkles, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";

export function ConsultationRecorder({
  consultationId,
  appointmentId,
  onTranscribed,
  onClear
}: {
  consultationId: string;
  appointmentId: string;
  onTranscribed: (data: any) => void;
  onClear?: () => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [chunkPaths, setChunkPaths] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);

  // Cleanup old session on consultationId change
  useEffect(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    chunkIndexRef.current = 0;
    setChunkPaths([]);
    setRecording(false);
    setTranscribing(false);
  }, [consultationId]);

  const handleClear = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    chunkIndexRef.current = 0;
    setChunkPaths([]);
    setRecording(false);
    setTranscribing(false);
    if (onClear) onClear();
  };

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return "audio/webm";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunkIndexRef.current = 0;
      setChunkPaths([]);

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && clinicId) {
          const formData = new FormData();
          const blob = new Blob([e.data], { type: mimeType });
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
      toast("Microphone permission required for ambient scribe.", "warning");
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setTranscribing(true);

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
          toast("Transcription failed. Try again.", "error");
        } finally {
          setTranscribing(false);
        }
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-400">
          <Sparkles className="w-4 h-4" /> Agent 2: ClinicalScribe
        </div>
        <button
          onClick={handleClear}
          title="Clear Session State"
          className="btn-ghost text-xs"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" /> Clear
        </button>
      </div>

      {!recording && !transcribing ? (
        <button
          onClick={startRecording}
          className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-background font-bold rounded-2xl flex items-center justify-center gap-3 transition-all duration-250 shadow-glow-teal text-base focus-ring"
        >
          <Mic className="w-6 h-6 animate-pulse" /> Start Ambient Recording
        </button>
      ) : recording ? (
        <div className="w-full flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-red-400 font-mono text-sm animate-pulse">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span> Live Audio Ambient Recording Active ({chunkPaths.length} Chunks Uploaded)
          </div>
          <button
            onClick={stopRecordingAndTranscribe}
            className="w-full py-3.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-250 text-sm focus-ring"
          >
            <Square className="w-5 h-5 fill-current" /> Stop & Generate SOAP Note
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-teal-400 font-medium">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Processing audio, running Speech-to-Text & Gemini 1.5 Pro SOAP generation...</p>
        </div>
      )}

      <p className="text-xs text-foreground-subtle text-center max-w-sm">
        Listens to Doctor-Patient conversation in Telugu, Hindi, or English, separates speakers automatically, and drafts SOAP notes.
      </p>
    </div>
  );
}
