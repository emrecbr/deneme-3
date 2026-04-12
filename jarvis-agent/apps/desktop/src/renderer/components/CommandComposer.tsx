import { FormEvent, useRef, useState } from "react";
import type { VoiceSessionStatus } from "@jarvis/core";

interface Props {
  onSubmit: (transcript: string) => Promise<void>;
  systemMessage: string;
  voice: VoiceSessionStatus | null;
  voiceTranscript: string;
  voiceError: string | null;
  onToggleVoice: () => Promise<void>;
  onVoicePressStart: () => Promise<void>;
  onVoicePressEnd: () => Promise<void>;
}

const suggestedCommands = [
  "Talepet klasorunu ac",
  "Downloads klasorunu ac",
  "Chrome'u ac",
  "Render dashboard ac"
];

export function CommandComposer({
  onSubmit,
  systemMessage,
  voice,
  voiceTranscript,
  voiceError,
  onToggleVoice,
  onVoicePressStart,
  onVoicePressEnd
}: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pressStartedRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }

    setSubmitting(true);
    await onSubmit(value.trim());
    setSubmitting(false);
  }

  async function handleVoicePressStart() {
    if (pressStartedRef.current) {
      return;
    }
    pressStartedRef.current = true;
    await onVoicePressStart();
  }

  async function handleVoicePressEnd() {
    if (!pressStartedRef.current) {
      return;
    }
    pressStartedRef.current = false;
    await onVoicePressEnd();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Command Center</p>
          <h2>Tek kutudan komut ver</h2>
        </div>
        <p className="muted">{systemMessage}</p>
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ornek: Downloads klasorunu ac, VS Code'u ac, Cloudflare'i ac, Desktop'ta pdf ara"
          rows={4}
        />
        <div className="composer-row">
          <div className="chips">
            {suggestedCommands.map((command) => (
              <button
                key={command}
                className="chip"
                type="button"
                onClick={() => setValue(command)}
              >
                {command}
              </button>
            ))}
          </div>
          <div className="composer-actions">
            <button
              className={`voice-button voice-${voice?.status ?? "idle"}`}
              type="button"
              onMouseDown={() => void handleVoicePressStart()}
              onMouseUp={() => void handleVoicePressEnd()}
              onMouseLeave={() => {
                if (voice?.status === "listening") {
                  void handleVoicePressEnd();
                }
              }}
              onTouchStart={() => void handleVoicePressStart()}
              onTouchEnd={() => void handleVoicePressEnd()}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  void onToggleVoice();
                }
              }}
            >
              {voice?.status === "listening" ? "Birak ve gonder" : "Basili tut konus"}
            </button>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Plan hazirlaniyor..." : "Plani olustur"}
            </button>
          </div>
        </div>
      </form>

      <div className="voice-panel">
        <div>
          <p className="eyebrow">Voice</p>
          <h3>Sesli komut</h3>
        </div>
        <p className="muted">Mod: {voice?.mode ?? "text"} | Durum: {voice?.status ?? "idle"} | {voice?.note ?? "Hazir"}</p>
        <p className="voice-transcript">{voiceTranscript || voice?.lastTranscript || "Transcript henuz yok."}</p>
        {voice?.errorCode ? <p className="muted">Hata kodu: {voice.errorCode}</p> : null}
        {voiceError ? <p className="voice-error">{voiceError}</p> : null}
      </div>
    </section>
  );
}
