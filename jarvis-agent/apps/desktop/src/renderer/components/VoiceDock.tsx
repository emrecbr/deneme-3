import type { VoiceSessionStatus } from "@jarvis/core";

interface Props {
  voice: VoiceSessionStatus | null;
  mode: "push_to_talk" | "wake_word";
  lastTranscript: string;
  voiceError: string | null;
  ttsStatus: "idle" | "speaking" | "muted" | "error";
  lastTtsMessage: string;
  ttsError: string | null;
  wakeWordSupported: boolean;
  speechFeedbackEnabled: boolean;
  autoListenWindowMs: number;
  onSelectMode: (mode: "push_to_talk" | "wake_word") => void;
  onToggleSpeechFeedback: () => void;
  onToggleVoice: () => Promise<void>;
}

export function VoiceDock({
  voice,
  mode,
  lastTranscript,
  voiceError,
  ttsStatus,
  lastTtsMessage,
  ttsError,
  wakeWordSupported,
  speechFeedbackEnabled,
  autoListenWindowMs,
  onSelectMode,
  onToggleSpeechFeedback,
  onToggleVoice
}: Props) {
  return (
    <aside className="voice-dock">
      <div className="voice-dock-header">
        <div>
          <p className="eyebrow">Voice Dock</p>
          <h3>Her zaman gorunur denetim</h3>
        </div>
        <span className={`voice-pill pill-${voice?.status ?? "idle"}`}>
          {voice?.status ?? "idle"}
        </span>
      </div>

      <div className="voice-dock-actions">
        <button className={`voice-orb orb-${voice?.status ?? "idle"}`} onClick={() => void onToggleVoice()}>
          {voice?.status === "listening" ? "Stop" : "Mic"}
        </button>
        <div className="voice-dock-copy">
          <strong>{mode === "push_to_talk" ? "Push-to-talk" : "Wake word"}</strong>
          <p>{voice?.note ?? "Mikrofon hazir"}</p>
          <p className="muted">STT backend: {voice?.backend ?? "disabled"}</p>
        </div>
      </div>

      <div className="dock-mode-row">
        <button
          className={`chip ${mode === "push_to_talk" ? "chip-active" : ""}`}
          onClick={() => onSelectMode("push_to_talk")}
          type="button"
        >
          Push-to-talk
        </button>
        <button
          className={`chip ${mode === "wake_word" ? "chip-active" : ""}`}
          onClick={() => onSelectMode("wake_word")}
          type="button"
          disabled={!wakeWordSupported}
        >
          Wake word
        </button>
      </div>

      <div className="voice-dock-settings">
        <label className="voice-toggle">
          <input type="checkbox" checked={speechFeedbackEnabled} onChange={onToggleSpeechFeedback} />
          <span>Sesli geri bildirim</span>
        </label>
        <p className="muted">Wake window: {Math.round(autoListenWindowMs / 1000)} saniye</p>
        <p className="muted">Fallback mod: {voice?.fallbackMode ?? "push_to_talk"}</p>
        {!wakeWordSupported ? (
          <p className="voice-error">Wake word desteklenmiyor. Push-to-talk kullan.</p>
        ) : mode === "wake_word" ? (
          <p className="muted">Jarvis wake word bekleniyor.</p>
        ) : null}
      </div>

      <div className="voice-dock-transcript">
        <p className="eyebrow">Son transcript</p>
        <p>{lastTranscript || voice?.lastTranscript || "Henuz transcript yok."}</p>
      </div>

      <div className="voice-dock-transcript">
        <p className="eyebrow">Son hata nedeni</p>
        <p>{voice?.errorCode ?? "Yok"}</p>
      </div>

      <div className="voice-dock-transcript">
        <p className="eyebrow">TTS durumu</p>
        <p>{ttsStatus}</p>
        <p className="muted">{lastTtsMessage || "Son sesli geri bildirim yok."}</p>
      </div>

      {voiceError ? <p className="voice-error">{voiceError}</p> : null}
      {ttsError ? <p className="voice-error">{ttsError}</p> : null}
    </aside>
  );
}
