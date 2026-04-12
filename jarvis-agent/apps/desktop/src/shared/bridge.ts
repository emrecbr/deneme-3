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

export interface ActionPreview {
  action: ActionPlan;
  preview: {
    allowed: boolean;
    mode: "dry-run" | "approval";
    message: string;
  };
}

export interface BootstrapResponse {
  settings: AgentSettings;
  voice: VoiceSessionStatus;
  activity: ActivityLogEntry[];
  pendingApproval: PendingApprovalContext | null;
}

export interface ApprovalResponse {
  ok: boolean;
  message: string;
  activity: ActivityLogEntry[];
  pendingApproval: PendingApprovalContext | null;
}

export interface SubmitCommandResponse {
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
}

export interface TranscribeAudioResponse {
  ok: boolean;
  transcript?: string;
  code?: string;
  message?: string;
  activity: ActivityLogEntry[];
}

export interface JarvisBridge {
  getBootstrap: () => Promise<BootstrapResponse>;
  submitCommand: (transcript: string) => Promise<SubmitCommandResponse>;
  submitVoiceCommand: (payload: { transcript: string; source: "voice" | "wake_word" }) => Promise<SubmitCommandResponse>;
  queueQuickTask: (request: QuickTaskRequest) => Promise<SubmitCommandResponse>;
  startVoiceCapture: () => Promise<{ ok: boolean; status: VoiceSessionStatus["status"]; message: string }>;
  stopVoiceCapture: () => Promise<{ ok: boolean; status: VoiceSessionStatus["status"]; message: string }>;
  transcribeAudio: (payload: { audio: ArrayBuffer; mimeType: string }) => Promise<TranscribeAudioResponse>;
  getVoiceStatus: () => Promise<VoiceSessionStatus>;
  reportVoiceEvent: (payload: {
    kind: "transcript_failed" | "wake_word_detected";
    code?: VoiceErrorCode;
    message: string;
    fallbackMode?: "push_to_talk" | "wake_word";
  }) => Promise<{ ok: boolean }>;
  reportTtsEvent: (payload: {
    kind:
      | "tts_started"
      | "tts_completed"
      | "tts_failed"
      | "tts_skipped"
      | "tts_muted"
      | "approval_prompt_spoken"
      | "approval_result_spoken"
      | "approval_summary_spoken";
    message: string;
    reason?:
      | "approval_requested"
      | "approval_granted"
      | "approval_rejected"
      | "approval_detail_requested"
      | "approval_expired"
      | "guard_active";
  }) => Promise<{ ok: boolean }>;
  reportApprovalExpired: (payload: { message: string }) => Promise<{ ok: boolean }>;
  resolveApproval: (decision: {
    actionId: string;
    approved: boolean;
    action?: ActionPlan;
  }) => Promise<ApprovalResponse>;
}

declare global {
  interface Window {
    jarvis?: JarvisBridge;
  }
}

export {};
