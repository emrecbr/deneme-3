import { useEffect, useMemo, useState } from "react";
import type {
  ActionPlan,
  ActivityLogEntry,
  AgentSettings,
  CommandResult,
  PendingApprovalContext,
  QuickTaskRequest,
  VoiceErrorCode,
  VoiceSessionStatus
} from "@jarvis/core";
import { ApprovalModal } from "./components/ApprovalModal";
import { CommandComposer } from "./components/CommandComposer";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { StatusStrip } from "./components/StatusStrip";
import { TaskBoard } from "./components/TaskBoard";
import { VoiceDock } from "./components/VoiceDock";
import type { ActionPreview } from "../shared/bridge";
import { createMediaRecorderVoiceAdapter, isMediaRecorderAvailable } from "./lib/voice";
import { createSpeechSynthesisTtsAdapter, type TtsStatus } from "./lib/tts";

type AppStatus = "loading" | "ready" | "bridge-error" | "bootstrap-error";
type ActionLifecycle = "pending-approval" | "rejected" | "executed" | "failed";
type VoiceControlMode = "push_to_talk" | "wake_word";

interface ActionRunState {
  state: ActionLifecycle;
  message: string;
}

const VOICE_MODE_KEY = "jarvis.voice.mode";
const SPEECH_FEEDBACK_KEY = "jarvis.voice.feedback";
const WAKE_WINDOW_KEY = "jarvis.voice.wakeWindowMs";
const TTS_GUARD_COOLDOWN_MS = 1200;

function formatVoiceFailure(code: VoiceErrorCode, fallbackMode?: "push_to_talk" | "wake_word"): string {
  const fallbackSuffix = fallbackMode === "push_to_talk" ? " Push-to-talk aktif kalacak." : "";
  switch (code) {
    case "permission_denied":
      return "Mikrofon izni reddedildi." + fallbackSuffix;
    case "device_unavailable":
      return "Mikrofon cihazi bulunamadi." + fallbackSuffix;
    case "capture_failed":
      return "Ses yakalama baslatilamadi." + fallbackSuffix;
    case "audio_too_short":
      return "Kayit cok kisa. Mikrofonu biraz daha uzun basili tutun." + fallbackSuffix;
    case "stt_backend_unavailable":
      return "STT backend kullanilamiyor." + fallbackSuffix;
    case "stt_timeout":
      return "STT backend yanit vermedi." + fallbackSuffix;
    case "transcript_timeout":
      return "Ses kaydi tamamlandi ama transcript zamaninda donmedi." + fallbackSuffix;
    case "transcript_empty":
      return "Ses kaydi alindi ama transcript bos dondu." + fallbackSuffix;
    case "wake_word_unsupported":
      return "Wake word bu surumde kapali. Push-to-talk kullan.";
    case "wake_word_timeout":
      return "Jarvis algilandi ama devam komutu gelmedi. Push-to-talk'a donuldu.";
    case "bridge_unavailable":
      return "Voice bridge kullanilamiyor.";
    default:
      return "Bilinmeyen bir voice hatasi olustu." + fallbackSuffix;
  }
}

export function App() {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [voice, setVoice] = useState<VoiceSessionStatus | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [previews, setPreviews] = useState<ActionPreview[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalContext | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionRunState>>({});
  const [selectedAction, setSelectedAction] = useState<ActionPlan | null>(null);
  const [systemMessage, setSystemMessage] = useState("Jarvis baslatiliyor...");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [voicePressActive, setVoicePressActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceControlMode>(() =>
    (window.localStorage.getItem(VOICE_MODE_KEY) as VoiceControlMode | null) || "push_to_talk"
  );
  const [speechFeedbackEnabled, setSpeechFeedbackEnabled] = useState(() =>
    window.localStorage.getItem(SPEECH_FEEDBACK_KEY) === "true"
  );
  const [autoListenWindowMs, setAutoListenWindowMs] = useState(() =>
    Number(window.localStorage.getItem(WAKE_WINDOW_KEY) || "6000")
  );
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>("idle");
  const [lastTtsMessage, setLastTtsMessage] = useState("");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsGuardUntil, setTtsGuardUntil] = useState(0);

  const captureSupported = useMemo(() => isMediaRecorderAvailable(), []);

  const [ttsAdapter] = useState(() =>
    createSpeechSynthesisTtsAdapter({
      onStatusChange: (nextStatus, note) => {
        setTtsStatus(nextStatus);
        if (note) {
          setLastTtsMessage(note);
        }
      },
      onSpoken: (message) => {
        setLastTtsMessage(message);
        setTtsError(null);
        setTtsGuardUntil(Date.now() + TTS_GUARD_COOLDOWN_MS);
      },
      onError: (message) => {
        setTtsError(message);
      }
    })
  );

  async function speakSystemFeedback(
    message: string,
    reason: "approval_requested" | "approval_granted" | "approval_rejected" | "approval_detail_requested" | "approval_expired" | "guard_active",
    kind:
      | "approval_prompt_spoken"
      | "approval_result_spoken"
      | "approval_summary_spoken"
      | "tts_started"
      | "tts_completed"
      | "tts_failed"
      | "tts_skipped"
      | "tts_muted"
  ): Promise<void> {
    if (!speechFeedbackEnabled) {
      setTtsStatus("muted");
      setLastTtsMessage("Sesli geri bildirim kapali.");
      if (window.jarvis) {
        await window.jarvis.reportTtsEvent({ kind: "tts_muted", message: "Sesli geri bildirim kapali.", reason });
      }
      return;
    }

    if (window.jarvis) {
      await window.jarvis.reportTtsEvent({ kind: "tts_started", message, reason });
    }

    const ok = await ttsAdapter.speak(message);
    if (window.jarvis) {
      await window.jarvis.reportTtsEvent({
        kind: ok ? kind : "tts_failed",
        message: ok ? message : (ttsError ?? "Sesli geri bildirim oynatilamadi."),
        reason
      });
    }
  }

  async function handleVoiceSubmit(transcript: string, source: "voice" | "wake_word") {
    if (!window.jarvis) {
      setStatus("bridge-error");
      setBootstrapError("Bridge baglantisi mevcut degil.");
      setVoiceError(formatVoiceFailure("bridge_unavailable"));
      return;
    }

    try {
      applyResponse(await window.jarvis.submitVoiceCommand({ transcript, source }));
      setVoice((current) => current ? {
        ...current,
        mode: source === "wake_word" ? "wake_word" : "push_to_talk",
        status: "approval_pending",
        note: "Onay bekleniyor.",
        errorCode: null,
        lastTranscript: transcript
      } : current);
      setVoiceError(null);
      void speakSystemFeedback("Onay bekleniyor", "approval_requested", "approval_prompt_spoken");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sesli komut islenemedi.";
      setVoiceError(message);
      setVoice((current) => current ? {
        ...current,
        status: "error",
        note: "Sesli planner basarisiz oldu.",
        errorCode: "unknown_voice_error"
      } : current);
    }
  }

  const [voiceAdapter] = useState(() =>
    createMediaRecorderVoiceAdapter({
      onStatusChange: (nextStatus, note) => {
        setVoice((current) => current ? { ...current, status: nextStatus, note } : {
          available: captureSupported,
          mode: "push_to_talk",
          backend: "openai",
          status: nextStatus,
          note,
          errorCode: null,
          lastTranscript: "",
          fallbackMode: "push_to_talk"
        });
      },
      onAudioCaptured: async ({ audio, mimeType }) => {
        if (!window.jarvis) {
          throw new Error("Bridge baglantisi mevcut degil.");
        }

        const response = await window.jarvis.transcribeAudio({ audio, mimeType });
        setActivity(response.activity);

        if (!response.ok || !response.transcript) {
          throw {
            code: (response.code as VoiceErrorCode | undefined) ?? "unknown_voice_error",
            message: response.message || "STT backend transcript uretemedi."
          };
        }

        console.info("[jarvis-agent] transcript received", { transcript: response.transcript });
        console.info("[jarvis-agent] planner invoked from voice", { transcript: response.transcript, source: "voice" });
        setVoiceTranscript(response.transcript);
        setVoice((current) => current ? {
          ...current,
          status: "planning",
          note: "Transcript planner'a gonderiliyor...",
          errorCode: null,
          lastTranscript: response.transcript
        } : current);
        await handleVoiceSubmit(response.transcript, "voice");
      },
      onError: ({ code, message, fallbackMode }) => {
        const resolvedMessage = message || formatVoiceFailure(code, fallbackMode);
        setVoiceError(resolvedMessage);
        setSystemMessage(resolvedMessage);
        if ((code === "wake_word_unsupported" || code === "wake_word_timeout") && voiceMode === "wake_word") {
          setVoiceMode("push_to_talk");
        }
        setVoice((current) => current ? {
          ...current,
          status: "error",
          note: resolvedMessage,
          errorCode: code,
          fallbackMode: fallbackMode ?? current.fallbackMode ?? "push_to_talk",
          mode: (code === "wake_word_unsupported" || code === "wake_word_timeout") ? "push_to_talk" : current.mode
        } : current);
        if (window.jarvis) {
          void window.jarvis.reportVoiceEvent({
            kind: "transcript_failed",
            code,
            message: resolvedMessage,
            fallbackMode
          });
        }
      }
    })
  );

  useEffect(() => {
    console.info("[jarvis-agent] renderer boot", {
      bridgeAvailable: Boolean(window.jarvis)
    });

    if (!window.jarvis) {
      setStatus("bridge-error");
      setBootstrapError("Preload bridge yuklenemedi. contextBridge ve preload ayarlari kontrol edilmeli.");
      return;
    }

    console.info("[jarvis-agent] bridge available in renderer");

    window.jarvis.getBootstrap()
      .then((bootstrap) => {
        console.info("[jarvis-agent] bootstrap fetched");
        setSettings(bootstrap.settings);
        setVoice(bootstrap.voice);
        setActivity(bootstrap.activity);
        setPendingApproval(bootstrap.pendingApproval);
        setSystemMessage("Jarvis komut almaya hazir.");

        if (!captureSupported) {
          const message = formatVoiceFailure("capture_failed", "push_to_talk");
          setVoiceError(message);
          setVoice({
            ...bootstrap.voice,
            status: "error",
            note: message,
            errorCode: "capture_failed",
            fallbackMode: "push_to_talk"
          });
        }

        if (voiceMode === "wake_word" && !bootstrap.settings.wakeWordEnabled) {
          setVoiceMode("push_to_talk");
        }

        setStatus("ready");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Bootstrap cagrisinda bilinmeyen hata.";
        setBootstrapError(message);
        setStatus("bootstrap-error");
      });
  }, [captureSupported]);

  useEffect(() => {
    window.localStorage.setItem(VOICE_MODE_KEY, voiceMode);
  }, [voiceMode]);

  useEffect(() => {
    window.localStorage.setItem(SPEECH_FEEDBACK_KEY, String(speechFeedbackEnabled));
    ttsAdapter.setEnabled(speechFeedbackEnabled);
  }, [speechFeedbackEnabled, ttsAdapter]);

  useEffect(() => {
    window.localStorage.setItem(WAKE_WINDOW_KEY, String(autoListenWindowMs));
  }, [autoListenWindowMs]);

  useEffect(() => {
    if (!pendingApproval) {
      return;
    }

    const elapsedMs = Date.now() - new Date(pendingApproval.pendingSince).getTime();
    const remainingMs = Math.max(0, pendingApproval.pendingTimeoutMs - elapsedMs);
    const timer = window.setTimeout(() => {
      setPendingApproval(null);
      setSystemMessage("Onay suresi doldu, lutfen komutu tekrar verin.");
      if (window.jarvis) {
        void window.jarvis.reportApprovalExpired({ message: "Onay suresi doldu, lutfen komutu tekrar verin." });
      }
      void speakSystemFeedback("Onay suresi doldu, lutfen komutu tekrar verin.", "approval_expired", "approval_result_spoken");
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [pendingApproval]);

  function applyResponse(response: {
    result: CommandResult;
    previews: ActionPreview[];
    activity: ActivityLogEntry[];
    pendingApproval: PendingApprovalContext | null;
    approvalResolution?: {
      actionId: string;
      approved: boolean;
      ok: boolean;
      message: string;
      source: "text" | "voice";
    };
  }): void {
    setResult(response.result);
    setPreviews(response.previews);
    setActivity(response.activity);
    setPendingApproval(response.pendingApproval);
    setSystemMessage(response.result.summary);
    if (response.previews.length) {
      setActionStates(
        Object.fromEntries(
          response.previews.map(({ action, preview }) => [
            action.id,
            {
              state: preview.allowed ? "pending-approval" : "failed",
              message: preview.message
            } satisfies ActionRunState
          ])
        )
      );
    }

    if (response.approvalResolution) {
      setActionStates((current) => ({
        ...current,
        [response.approvalResolution!.actionId]: {
          state: response.approvalResolution!.approved
            ? (response.approvalResolution!.ok ? "executed" : "failed")
            : "rejected",
          message: response.approvalResolution!.message
        }
      }));
      void speakSystemFeedback(
        response.approvalResolution.approved
          ? (response.approvalResolution.ok ? "Aksiyon onaylandi" : "Aksiyon basarisiz oldu")
          : "Aksiyon iptal edildi",
        response.approvalResolution.approved ? "approval_granted" : "approval_rejected",
        "approval_result_spoken"
      );
    } else if (response.pendingApproval && (response.result.source === "voice" || response.result.source === "wake_word")) {
      const prompt = `${response.pendingApproval.pendingActionSummary} Onay bekleniyor. Sesli olarak onayla veya iptal et diyebilirsiniz.`;
      void speakSystemFeedback(prompt, "approval_requested", "approval_prompt_spoken");
    } else if (
      response.pendingApproval &&
      response.result.summary.includes("Onaylamak icin onayla")
    ) {
      void speakSystemFeedback(response.result.summary, "approval_detail_requested", "approval_summary_spoken");
    }
  }

  async function handleSubmit(transcript: string) {
    if (!window.jarvis) {
      setStatus("bridge-error");
      setBootstrapError("Bridge baglantisi mevcut degil.");
      return;
    }

    try {
      applyResponse(await window.jarvis.submitCommand(transcript));
      setVoiceError(null);
    } catch (error: unknown) {
      setSystemMessage(error instanceof Error ? error.message : "Komut islenemedi.");
    }
  }

  async function startVoiceCapture(mode: VoiceControlMode = "push_to_talk") {
    if (!voice?.available || !window.jarvis) {
      const message = formatVoiceFailure("bridge_unavailable");
      setVoiceError(message);
      return;
    }

    if (ttsStatus === "speaking" || Date.now() < ttsGuardUntil) {
      const message = "Kendi sesini algilamayi onlemek icin mikrofon kisa sure duraklatildi.";
      setVoiceError(message);
      setSystemMessage(message);
      if (window.jarvis) {
        void window.jarvis.reportTtsEvent({
          kind: "tts_skipped",
          message,
          reason: "guard_active"
        });
      }
      return;
    }

    if (mode === "wake_word" && !settings?.wakeWordEnabled) {
      const message = formatVoiceFailure("wake_word_unsupported");
      setVoiceError(message);
      setVoiceMode("push_to_talk");
      setVoice((current) => current ? {
        ...current,
        status: "error",
        note: message,
        errorCode: "wake_word_unsupported",
        fallbackMode: "push_to_talk",
        mode: "push_to_talk"
      } : current);
      if (window.jarvis) {
        void window.jarvis.reportVoiceEvent({
          kind: "transcript_failed",
          code: "wake_word_unsupported",
          message,
          fallbackMode: "push_to_talk"
        });
      }
      return;
    }

    try {
      console.info("[jarvis-agent] mic button pressed");
      setVoiceError(null);
      setVoiceTranscript("");
      const bridgeResponse = await window.jarvis.startVoiceCapture();
      setVoice((current) => current ? {
        ...current,
        mode,
        status: bridgeResponse.status,
        note: bridgeResponse.message,
        errorCode: null,
        lastTranscript: ""
      } : current);
      await voiceAdapter.startListening(mode);
      setVoicePressActive(mode === "push_to_talk");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sesli komut baslatilamadi.";
      setVoiceError(message);
      setVoice((current) => current ? {
        ...current,
        status: "error",
        note: "Sesli komut kullanilamiyor.",
        errorCode: "unknown_voice_error"
      } : current);
      if (window.jarvis) {
        void window.jarvis.reportVoiceEvent({
          kind: "transcript_failed",
          code: "unknown_voice_error",
          message
        });
      }
    }
  }

  async function stopVoiceCapture() {
    if (!window.jarvis) {
      return;
    }

    await window.jarvis.stopVoiceCapture();
    voiceAdapter.stopListening();
    setVoicePressActive(false);
  }

  async function handleToggleVoice() {
    if (voiceMode === "wake_word") {
      const message = formatVoiceFailure("wake_word_unsupported");
      setVoiceError(message);
      setVoiceMode("push_to_talk");
      return;
    }

    if (voice?.status === "listening" || voicePressActive) {
      await stopVoiceCapture();
      return;
    }

    await startVoiceCapture("push_to_talk");
  }

  async function handleQuickTask(taskId: QuickTaskRequest["taskId"]) {
    if (!window.jarvis) {
      setStatus("bridge-error");
      setBootstrapError("Bridge baglantisi mevcut degil.");
      return;
    }

    try {
      applyResponse(await window.jarvis.queueQuickTask({ taskId }));
    } catch (error: unknown) {
      setSystemMessage(error instanceof Error ? error.message : "Quick task islenemedi.");
    }
  }

  async function handleApproval(approved: boolean) {
    if (!window.jarvis || !selectedAction) {
      return;
    }

    const response = await window.jarvis.resolveApproval({
      actionId: selectedAction.id,
      approved,
      action: selectedAction
    });

    setActivity(response.activity);
    setPendingApproval(response.pendingApproval);
    setSystemMessage(response.message);
    setActionStates((current) => ({
      ...current,
      [selectedAction.id]: {
        state: approved ? (response.ok ? "executed" : "failed") : "rejected",
        message: response.message
      }
    }));
    setVoice((current) => {
      if (!current || current.status !== "approval_pending") {
        return current;
      }

      return {
        ...current,
        status: approved ? (response.ok ? "success" : "error") : "ready",
        note: response.message
      };
    });
    void speakSystemFeedback(
      approved
        ? (response.ok ? "Aksiyon onaylandi" : "Aksiyon basarisiz oldu")
        : "Aksiyon iptal edildi",
      approved ? "approval_granted" : "approval_rejected",
      "approval_result_spoken"
    );
    setSelectedAction(null);
  }

  if (status !== "ready") {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Bootstrap State</p>
          <h1>Jarvis Agent</h1>
          <p className="lede">
            {status === "loading" && "Bridge ve bootstrap yukleniyor..."}
            {status === "bridge-error" && "Bridge yuklenemedi."}
            {status === "bootstrap-error" && "Bootstrap verisi alinamadi."}
          </p>
          <div className="summary-card">
            <h3>Durum</h3>
            <p>{bootstrapError ?? "Yukleme devam ediyor."}</p>
            <span className="muted">Renderer state: {status}</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell-with-dock">
      <section className="hero">
        <div>
          <p className="eyebrow">Global Command Workspace</p>
          <h1>{settings?.appName ?? "Jarvis Agent"}</h1>
          <p className="lede">
            Windows genelinde komut alan, approval-first mantikla guvenli aksiyonlar yurutebilen desktop agent.
          </p>
          <p className="muted">{voice?.note}</p>
        </div>
        <StatusStrip settings={settings} voice={voice} />
      </section>

      <section className="grid">
        <div className="column column-main">
          <CommandComposer
            onSubmit={handleSubmit}
            systemMessage={systemMessage}
            voice={voice}
            voiceTranscript={voiceTranscript}
            voiceError={voiceError}
            onToggleVoice={handleToggleVoice}
            onVoicePressStart={() => startVoiceCapture("push_to_talk")}
            onVoicePressEnd={stopVoiceCapture}
          />
          <TaskBoard
            result={result}
            previews={previews}
            pendingApproval={pendingApproval}
            actionStates={actionStates}
            onApproveRequest={setSelectedAction}
          />
        </div>

        <div className="column column-side">
          <ScenarioPanel
            settings={settings}
            activity={activity}
            onQuickTask={handleQuickTask}
          />
        </div>
      </section>

      <VoiceDock
        voice={voice}
        mode={voiceMode}
        lastTranscript={voiceTranscript}
        voiceError={voiceError}
        ttsStatus={ttsStatus}
        lastTtsMessage={lastTtsMessage}
        ttsError={ttsError}
        wakeWordSupported={Boolean(settings?.wakeWordEnabled)}
        speechFeedbackEnabled={speechFeedbackEnabled}
        autoListenWindowMs={autoListenWindowMs}
        onSelectMode={(mode) => {
          if (mode === "wake_word" && !settings?.wakeWordEnabled) {
            setVoiceError(formatVoiceFailure("wake_word_unsupported"));
            setVoiceMode("push_to_talk");
            return;
          }
          if (voiceMode === "wake_word" && mode === "push_to_talk") {
            void stopVoiceCapture();
          }
          setVoiceMode(mode);
          if (mode === "wake_word") {
            setVoice((current) => current ? {
              ...current,
              mode: "wake_word",
              note: "Jarvis wake word bekleniyor"
            } : current);
          } else {
            setVoice((current) => current ? {
              ...current,
              mode: "push_to_talk",
              note: "Push-to-talk modu aktif",
              fallbackMode: "push_to_talk"
            } : current);
          }
        }}
        onToggleSpeechFeedback={() => setSpeechFeedbackEnabled((value) => !value)}
        onToggleVoice={handleToggleVoice}
      />

      <ApprovalModal
        action={selectedAction}
        result={result}
        pendingApproval={pendingApproval}
        actionState={selectedAction ? actionStates[selectedAction.id] : undefined}
        onApprove={() => handleApproval(true)}
        onReject={() => handleApproval(false)}
        onClose={() => setSelectedAction(null)}
      />
    </main>
  );
}
