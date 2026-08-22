"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Sparkles, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/errors";
import { useClinicStore } from "@/store/clinicStore";
import { useToast } from "@/components/design-system";
import { TranscriptionProgress } from "@/components/consultation/TranscriptionProgress";

export function ConsultationRecorder({
  consultationId,
  appointmentId,
  onTranscribed,
  onClear,
  onRecordingStateChange
}: {
  consultationId: string;
  appointmentId: string;
  onTranscribed: (data: any) => void;
  onClear?: () => void;
  /** Fires whenever capture actually starts or stops, so surrounding UI can
   *  reflect the true microphone state instead of guessing from elsewhere. */
  onRecordingStateChange?: (recording: boolean) => void;
}) {
  const clinicId = useClinicStore((state) => state.clinicId);
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [chunkPaths, setChunkPaths] = useState<string[]>([]);
  // A transcription failure has to persist in the panel. A toast auto-dismisses
  // after four seconds, which is how a failed generation previously became
  // indistinguishable from "nothing happened" — the button simply reverted to
  // Start and every SOAP field kept its placeholder text.
  const [error, setError] = useState<string | null>(null);

  // Route every recording-state change through one setter. The "AI Scribing
  // Active" badge previously read consultation.status, so it stayed lit after
  // the microphone had stopped — the badge claimed capture that was not
  // happening.
  const applyRecording = React.useCallback(
    (value: boolean) => {
      setRecording(value);
      onRecordingStateChange?.(value);
    },
    [onRecordingStateChange]
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);

  // Live input level, 0..1. Without this a muted or dead microphone looks
  // exactly like a working one: chunks still upload (they are just silence),
  // the timer still counts, and the failure only becomes visible minutes later
  // when the note comes back empty.
  const [level, setLevel] = useState(0);
  const [silentSeconds, setSilentSeconds] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

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
    applyRecording(false);
    setTranscribing(false);
    setError(null);
    teardownMeter();
  }, [consultationId, applyRecording]);

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
    applyRecording(false);
    setTranscribing(false);
    setError(null);
    teardownMeter();
    if (onClear) onClear();
  };

  const teardownMeter = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* already closed */
      }
      audioCtxRef.current = null;
    }
    setLevel(0);
    setSilentSeconds(0);
  };

  /** Drive the level meter from the same MediaStream the recorder is using. */
  const startMeter = (stream: MediaStream) => {
    try {
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      let quietFrames = 0;
      let lastTick = performance.now();

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS around the 128 midpoint of the unsigned 8-bit waveform.
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 4));

        const now = performance.now();
        if (now - lastTick >= 1000) {
          lastTick = now;
          // Below this the input is indistinguishable from a muted device.
          if (rms < 0.01) {
            quietFrames += 1;
            setSilentSeconds(quietFrames);
          } else {
            quietFrames = 0;
            setSilentSeconds(0);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      // A missing AudioContext must never block the recording itself.
      console.warn("Audio level meter unavailable:", e);
    }
  };

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return "audio/webm";
  };

  const startRecording = async () => {
    setError(null);
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
      startMeter(stream);
      applyRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      toast("Microphone permission required for ambient scribe.", "warning");
    }
  };

  const stopRecordingAndTranscribe = async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recording) {
      applyRecording(false);
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

        // 2. Stop audio tracks and the level meter together
        try {
          recorder.stream.getTracks().forEach((t) => t.stop());
        } catch (e) {}
        teardownMeter();

        // 3. Await all pending chunk upload network requests
        await Promise.all(pendingUploadsRef.current);

        // 4. Trigger backend Speech-to-Text & ClinicalScribe
        await runTranscription();
      } finally {
        setTranscribing(false);
      }
    }
  };

  /**
   * POST the already-uploaded chunks for transcription.
   *
   * Split out from the stop handler so a failure can be retried WITHOUT making
   * the doctor record the consultation again — the audio is already on the
   * server, so re-recording would discard a real patient encounter to work
   * around a transient backend error.
   */
  const runTranscription = async () => {
    setError(null);
    try {
      const res = await api.post("/consultations/transcribe", {
        clinic_id: clinicId,
        consultation_id: consultationId,
        appointment_id: appointmentId,
        chunk_paths: uploadedChunkPathsRef.current
      });
      onTranscribed(res.data);
    } catch (e: any) {
      // The backend returns a clinician-readable reason on 422 (recording too
      // short, no audio received). Prefer it over a generic message.
      const detail = e?.response?.data?.detail;
      const message = typeof detail === "string" && detail.trim()
        ? detail
        : apiErrorMessage(e, "generate the clinical note");
      console.error("Transcription error:", message, e);
      setError(message);
      toast(message, "error", "clinical");
    }
  };

  const retryTranscription = async () => {
    setTranscribing(true);
    try {
      await runTranscription();
    } finally {
      setTranscribing(false);
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

      {/* Persistent, inline failure state. Stays until the doctor acts on it. */}
      {error && !recording && !transcribing && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-200">Clinical note was not generated</p>
              <p className="text-xs text-red-100/90 leading-relaxed mt-1">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {uploadedChunkPathsRef.current.length > 0 && (
              <button
                onClick={retryTranscription}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors focus-ring"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Retry without re-recording
              </button>
            )}
            <button
              onClick={startRecording}
              className="px-3 py-2 bg-background-elevated hover:bg-background-hover border border-border text-foreground text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors focus-ring"
            >
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
              Record again
            </button>
          </div>
          <p className="text-[11px] text-red-100/70 leading-relaxed border-t border-red-500/20 pt-2">
            The SOAP fields below are still empty. Nothing has been written to this
            patient&apos;s record.
          </p>
        </div>
      )}

      {!recording && !transcribing ? (
        <button
          onClick={startRecording}
          className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-background font-bold rounded-2xl flex items-center justify-center gap-3 transition-all duration-250 shadow-glow-teal text-base focus-ring"
        >
          <Mic className="w-6 h-6 animate-pulse" />
          {error ? "Start New Recording" : "Start Ambient Recording"}
        </button>
      ) : recording ? (
        <div className="w-full flex flex-col items-center gap-3">
          {/* A breathing dot with an expanding ring: at a glance this is a live
              microphone, not a status label that happens to be red. */}
          <div className="flex items-center gap-2.5 text-red-400 font-mono text-sm" role="status" aria-live="polite">
            <span className="relative flex items-center justify-center w-3 h-3 shrink-0">
              <span className="absolute inline-flex w-3 h-3 rounded-full bg-red-500/60 animate-breathe-ring" aria-hidden="true" />
              <span className="relative inline-flex w-3 h-3 rounded-full bg-red-500 animate-breathe" aria-hidden="true" />
            </span>
            Live Audio Ambient Recording Active ({chunkPaths.length} Chunks Uploaded)
          </div>

          {/* Input level meter. Twelve bars lit proportionally to RMS input, so
              the doctor can see the microphone responding to the room rather
              than trusting a timer that ticks identically when muted. */}
          <div
            className="w-full flex items-center gap-1"
            role="meter"
            aria-label="Microphone input level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const lit = level * 12 > i;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className={
                    "flex-1 rounded-full transition-all duration-100 " +
                    (lit
                      ? i > 9
                        ? "h-4 bg-red-400"
                        : i > 6
                        ? "h-3.5 bg-amber-400"
                        : "h-3 bg-teal-400"
                      : "h-1.5 bg-background-input")
                  }
                />
              );
            })}
          </div>

          {silentSeconds >= 5 && (
            <div
              role="alert"
              className="w-full flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-xs leading-relaxed">
                No audio detected for {silentSeconds}s. Check that the correct microphone
                is selected and not muted — a silent recording cannot produce a clinical note.
              </span>
            </div>
          )}
          <button
            onClick={stopRecordingAndTranscribe}
            className="w-full py-3.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-250 text-sm focus-ring"
          >
            <Square className="w-5 h-5 fill-current" /> Stop & Generate SOAP Note
          </button>
        </div>
      ) : (
        <TranscriptionProgress />
      )}

      <p className="text-xs text-foreground-subtle text-center max-w-sm">
        Listens to Doctor-Patient conversation in Telugu, Hindi, or English, separates speakers automatically, and drafts SOAP notes.
      </p>
    </div>
  );
}
