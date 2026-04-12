export type ActionType =
  | "open_url"
  | "open_folder"
  | "open_app"
  | "open_project"
  | "create_note"
  | "search_files"
  | "run_safe_command";

export type RiskLevel = "low" | "medium" | "high";
export type IntentType =
  | "open_target"
  | "open_folder"
  | "open_app"
  | "open_url"
  | "open_provider_dashboard"
  | "start_dns_flow"
  | "start_domain_flow"
  | "create_note"
  | "search_files"
  | "run_safe_command"
  | "general_assistance";
export type PlanSource = "text" | "voice" | "wake_word" | "quick-task";
export type ManagedTargetType = "project" | "folder" | "app" | "provider";
export type VoiceControlMode = "text" | "push_to_talk" | "wake_word";
export type VoiceErrorCode =
  | "permission_denied"
  | "device_unavailable"
  | "capture_failed"
  | "audio_too_short"
  | "stt_backend_unavailable"
  | "stt_timeout"
  | "transcript_timeout"
  | "transcript_empty"
  | "wake_word_unsupported"
  | "wake_word_timeout"
  | "bridge_unavailable"
  | "unknown_voice_error";

export interface ManagedTarget {
  id: string;
  type: ManagedTargetType;
  label: string;
  description: string;
  path?: string;
  url?: string;
  appIdentifier?: string;
  approvalPolicy: "always";
  enabled: boolean;
  tags: string[];
}

export interface ActionPlan {
  id: string;
  type: ActionType;
  label: string;
  targetId?: string;
  args: {
    url?: string;
    path?: string;
    appIdentifier?: string;
    noteTitle?: string;
    noteContent?: string;
    query?: string;
    rootPath?: string;
    command?: string;
  };
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  reversible: boolean;
  reason: string;
}

export interface WizardScenario {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  suggestedActions: ActionPlan[];
}

export interface PlannedCommand {
  originalCommand: string;
  detectedIntent: IntentType;
  target?: ManagedTarget;
  proposedActions: ActionPlan[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  previewText: string;
}

export interface PendingApprovalContext {
  pendingApprovalId: string;
  pendingPlan: PlannedCommand;
  pendingActionSummary: string;
  pendingSource: PlanSource;
  pendingSince: string;
  pendingTimeoutMs: number;
  pendingRiskLevel: RiskLevel;
}

export interface CommandResult {
  transcript: string;
  intent: IntentType;
  source: PlanSource;
  summary: string;
  actions: ActionPlan[];
  wizard?: WizardScenario;
  plan: PlannedCommand;
}

export interface AgentSettings {
  appName: string;
  defaultMode: "approval" | "dry-run";
  allowedDomains: string[];
  allowedFolders: string[];
  allowedApps: string[];
  allowedCommands: string[];
  targets: ManagedTarget[];
  voiceStubEnabled: boolean;
  sttProvider: "openai" | "disabled";
  wakeWordEnabled: boolean;
}

export interface VoiceSessionStatus {
  available: boolean;
  mode: VoiceControlMode;
  backend: "openai" | "disabled";
  status:
    | "idle"
    | "requesting_permission"
    | "mic_ready"
    | "listening"
    | "wake_detected"
    | "transcribing"
    | "transcript_ready"
    | "planning"
    | "approval_pending"
    | "executing"
    | "success"
    | "ready"
    | "error";
  note: string;
  errorCode?: VoiceErrorCode | null;
  lastTranscript?: string;
  fallbackMode?: Exclude<VoiceControlMode, "text"> | null;
}

export interface ActivityLogEntry {
  id: string;
  kind:
    | "mic_permission_requested"
    | "mic_permission_granted"
    | "mic_permission_denied"
    | "voice_started"
    | "voice_stopped"
    | "voice_capture_started"
    | "voice_capture_stopped"
    | "stt_request_started"
    | "stt_request_succeeded"
    | "stt_request_failed"
    | "wake_word_detected"
    | "transcript_received"
    | "transcript_failed"
    | "voice_fallback"
    | "command_received"
    | "plan_created"
    | "approval_requested"
    | "approval_granted"
    | "approval_rejected"
    | "approval_voice_prompted"
    | "approval_voice_received"
    | "approval_granted_voice"
    | "approval_rejected_voice"
    | "approval_detail_requested"
    | "approval_expired"
    | "tts_started"
    | "tts_completed"
    | "tts_failed"
    | "tts_skipped"
    | "tts_muted"
    | "approval_prompt_spoken"
    | "approval_result_spoken"
    | "approval_summary_spoken"
    | "action_started"
    | "action_succeeded"
    | "action_failed"
    | "info";
  message: string;
  timestamp: string;
  source?: "text" | "voice" | "wake_word" | "system" | "system_tts";
}

export interface ApprovalDecision {
  actionId: string;
  approved: boolean;
}

export interface QuickTaskRequest {
  taskId:
    | "open-talepet-folder"
    | "open-downloads-folder"
    | "open-vscode"
    | "open-chrome"
    | "open-render-dashboard"
    | "open-cloudflare"
    | "start-dns-wizard"
    | "start-domain-wizard";
}
