import type { VoiceAdapter } from "@jarvis/audio";
import type { VoiceErrorCode, VoiceSessionStatus } from "@jarvis/core";

type VoiceControlMode = "push_to_talk" | "wake_word";

export interface VoiceAdapterOptions {
  onStatusChange: (status: VoiceSessionStatus["status"], note: string) => void;
  onAudioCaptured: (payload: { audio: ArrayBuffer; mimeType: string }) => Promise<void>;
  onError: (payload: { code: VoiceErrorCode; message: string; fallbackMode?: "push_to_talk" | "wake_word" }) => void;
}

declare global {
  interface Window {
    MediaRecorder?: typeof MediaRecorder;
  }
}

export function isMediaRecorderAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

export function createMediaRecorderVoiceAdapter(options: VoiceAdapterOptions): VoiceAdapter {
  const minimumCaptureDurationMs = 600;
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let lastTranscript = "";
  let status: VoiceSessionStatus["status"] = "idle";
  let mode: VoiceControlMode = "push_to_talk";
  let chunks: Blob[] = [];
  let captureStartedAt = 0;

  function emitStatus(nextStatus: VoiceSessionStatus["status"], note: string): void {
    status = nextStatus;
    options.onStatusChange(nextStatus, note);
  }

  function stopTracks(): void {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function emitVoiceError(code: VoiceErrorCode, message: string, fallbackMode: "push_to_talk" | "wake_word" = "push_to_talk"): void {
    stopTracks();
    mediaRecorder = null;
    emitStatus("error", message);
    options.onError({ code, message, fallbackMode });
  }

  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"
    ];

    for (const candidate of candidates) {
      if (window.MediaRecorder?.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return "audio/webm";
  }

  function mapGetUserMediaError(error: unknown): { code: VoiceErrorCode; message: string } {
    const name = (error as DOMException | undefined)?.name;

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { code: "permission_denied", message: "Mikrofon izni reddedildi." };
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { code: "device_unavailable", message: "Mikrofon cihazi bulunamadi." };
    }

    return { code: "capture_failed", message: "Ses kaydi baslatilamadi." };
  }

  return {
    async startListening(nextMode?: VoiceControlMode) {
      mode = nextMode || "push_to_talk";
      lastTranscript = "";
      chunks = [];

      if (mode === "wake_word") {
        emitVoiceError("wake_word_unsupported", "Wake word bu surumde kapali. Push-to-talk kullan.", "push_to_talk");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        emitVoiceError("stt_backend_unavailable", "Bu ortamda ses kaydi icin MediaRecorder kullanilamiyor.");
        return;
      }

      emitStatus("requesting_permission", "Mikrofon izni isteniyor...");

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.info("[jarvis-agent] getUserMedia success");
      } catch (error) {
        console.info("[jarvis-agent] getUserMedia failed", error);
        const mapped = mapGetUserMediaError(error);
        emitVoiceError(mapped.code, mapped.message);
        return;
      }

      emitStatus("mic_ready", "Mikrofon hazir");

      const mimeType = pickMimeType();
      try {
        mediaRecorder = new window.MediaRecorder(mediaStream, { mimeType });
      } catch {
        emitVoiceError("capture_failed", "MediaRecorder baslatilamadi.");
        return;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        emitVoiceError("capture_failed", "Ses kaydi sirasinda bir hata olustu.");
      };

      mediaRecorder.onstart = () => {
        captureStartedAt = Date.now();
        console.info("[jarvis-agent] capture started");
        emitStatus("listening", "Dinleniyor...");
      };

      mediaRecorder.onstop = async () => {
        const durationMs = Math.max(0, Date.now() - captureStartedAt);
        console.info(`[jarvis-agent] capture stopped durationMs=${durationMs}`);
        stopTracks();

        if (!chunks.length) {
          console.info("[jarvis-agent] transcript empty");
          emitVoiceError("transcript_empty", "Ses kaydi alindi ama transcript bos dondu.");
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        console.info(`[jarvis-agent] capture blobSize=${blob.size}`);
        chunks = [];

        if (durationMs < minimumCaptureDurationMs) {
          console.info(`[jarvis-agent] stt request skipped short audio durationMs=${durationMs} blobSize=${blob.size}`);
          emitVoiceError("audio_too_short", "Kayit cok kisa. Mikrofonu biraz daha uzun basili tutun.");
          return;
        }

        emitStatus("transcribing", "Ses kaydi STT backend'e gonderiliyor...");

        try {
          await options.onAudioCaptured({
            audio: await blob.arrayBuffer(),
            mimeType: blob.type || mimeType
          });
        } catch (error) {
          const code = (error as { code?: VoiceErrorCode } | undefined)?.code ?? "unknown_voice_error";
          const message = (error as { message?: string } | undefined)?.message ?? "STT backend islenemedi.";
          emitVoiceError(code, message);
        }
      };

      mediaRecorder.start();
    },
    stopListening() {
      if (!mediaRecorder) {
        emitStatus("idle", "Hazir");
        return;
      }

      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    },
    getTranscript() {
      return lastTranscript;
    },
    getStatus() {
      return status;
    }
  };
}
