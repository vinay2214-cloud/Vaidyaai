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

  const uploadedChunkPathsRef = useRef<string[]>([]);
  const pendingUploadsRef = useRef<Promise<any>[]>([]);

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
    uploadedChunkPathsRef.current = [];
    pendingUploadsRef.current = [];
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
    uploadedChunkPathsRef.current = [];
    pendingUploadsRef.current = [];
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
      uploadedChunkPathsRef.current = [];
      pendingUploadsRef.current = [];
      setChunkPaths([]);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && clinicId) {
          const currentIndex = chunkIndexRef.current;
          chunkIndexRef.current += 1;
          const formData = new FormData();
          const blob = new Blob([e.data], { type: mimeType });
          formData.append("file", blob, `chunk_${currentIndex}.webm`);

          const uploadPromise = api.post(
            `/consultations/upload-chunk?consultation_id=${consultationId}&clinic_id=${clinicId}&chunk_index=${currentIndex}`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          ).then((res) => {
            if (res.data.chunk_path) {
              uploadedChunkPathsRef.current.push(res.data.chunk_path);
              setChunkPaths((prev) => [...prev, res.data.chunk_path]);
            }
            return res.data;
          }).catch((err) => {
            console.error(`Chunk ${currentIndex} upload failed:`, err);
            return null;
          });

          pendingUploadsRef.current.push(uploadPromise);
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
    const recorder = mediaRecorderRef.current;
    if (recorder && recording) {
      setRecording(false);
      setTranscribing(true);

      try {
        // 1. Stop recorder and wait for final onstop event
        await new Promise<void>((resolve) => {
          if (recorder.state === "inactive") {
            resolve();
          } else {
            recorder.onstop = () => resolve();
            recorder.stop();
          }
        });

        // 2. Stop audio tracks
        try {
          recorder.stream.getTracks().forEach((t) => t.stop());
        } catch (e) {}

        // 3. Await all pending chunk upload network requests
        await Promise.all(pendingUploadsRef.current);

        // 4. Trigger backend Speech-to-Text & ClinicalScribe
        const res = await api.post("/consultations/transcribe", {
          clinic_id: clinicId,
          consultation_id: consultationId,
          appointment_id: appointmentId,
          chunk_paths: uploadedChunkPathsRef.current
        });

        onTranscribed(res.data);
      } catch (e: any) {
        const errorDetail = e?.response?.data?.detail || e?.message || "Transcription failed";
        console.error("Transcription error:", errorDetail, e);
        toast(`Transcription failed: ${errorDetail}`, "error");
      } finally {
        setTranscribing(false);
      }
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
          <p className="text-sm">Processing audio, running Speech-to-Text & Clinical AI SOAP generation...</p>
        </div>
      )}

      <p className="text-xs text-foreground-subtle text-center max-w-sm">
        Listens to Doctor-Patient conversation in Telugu, Hindi, or English, separates speakers automatically, and drafts SOAP notes.
      </p>
    </div>
  );
}
