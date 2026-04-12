import type { AgentSettings, VoiceSessionStatus } from "@jarvis/core";

interface Props {
  settings: AgentSettings | null;
  voice: VoiceSessionStatus | null;
}

export function StatusStrip({ settings, voice }: Props) {
  return (
    <div className="status-strip">
      <div className="status-card">
        <span>Security</span>
        <strong>{settings?.defaultMode ?? "loading"}</strong>
      </div>
      <div className="status-card">
        <span>Voice</span>
        <strong>{voice?.mode ?? "text"} / {voice?.status ?? "idle"}</strong>
      </div>
      <div className="status-card">
        <span>Targets</span>
        <strong>{settings?.targets.length ?? 0}</strong>
      </div>
      <div className="status-card">
        <span>Hotkey</span>
        <strong>stub ready</strong>
      </div>
    </div>
  );
}
