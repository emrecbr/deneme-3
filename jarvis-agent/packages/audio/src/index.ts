import type { VoiceSessionStatus } from "@jarvis/core";

export interface VoiceAdapter {
  startListening: (mode?: "push_to_talk" | "wake_word") => Promise<void>;
  stopListening: () => void;
  getTranscript: () => string;
  getStatus: () => VoiceSessionStatus["status"];
}

export function createVoiceStub(enabled: boolean): VoiceSessionStatus {
  return {
    available: enabled,
    mode: enabled ? "push_to_talk" : "text",
    backend: enabled ? "openai" : "disabled",
    status: enabled ? "idle" : "error",
    note: enabled
      ? "Push-to-talk ses kaydi hazir. Transcript STT backend ile olusturulacak."
      : "Ses ozelligi kapali. Metin girisi aktif.",
    errorCode: enabled ? null : "stt_backend_unavailable",
    lastTranscript: "",
    fallbackMode: enabled ? "push_to_talk" : null
  };
}
