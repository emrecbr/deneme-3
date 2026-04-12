import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { config as loadEnv } from "dotenv";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type ActionPlan,
  type ActivityLogEntry,
  type AgentSettings,
  type ApprovalDecision,
  type CommandResult,
  type IntentType,
  type ManagedTarget,
  type PendingApprovalContext,
  type PlannedCommand,
  type QuickTaskRequest,
  type RiskLevel,
  type VoiceControlMode,
  type VoiceErrorCode,
  type VoiceSessionStatus,
  type WizardScenario
} from "@jarvis/core";
import { createVoiceStub } from "@jarvis/audio";
import { previewAction } from "@jarvis/executor";
import { validateActionAgainstPolicy } from "@jarvis/security";
import { configureLogger, installProcessErrorHandlers, logger } from "./logger";

installProcessErrorHandlers();

interface EnvLoadDiagnostics {
  attemptedPaths: string[];
  loadedPath: string | null;
  apiKeySource: "OPENAI_API_KEY" | "JARVIS_OPENAI_API_KEY" | "missing";
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values.map((value) => path.normalize(value)))];
}

function loadEnvChain(): EnvLoadDiagnostics {
  const candidatePaths = uniquePaths([
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", "..", ".env")
  ]);

  let loadedPath: string | null = null;

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    const result = loadEnv({ path: candidatePath, override: false });
    if (!result.error) {
      loadedPath = candidatePath;
      break;
    }
  }

  const apiKeySource =
    process.env.JARVIS_OPENAI_API_KEY ? "JARVIS_OPENAI_API_KEY" :
    process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" :
    "missing";

  return {
    attemptedPaths: candidatePaths,
    loadedPath,
    apiKeySource
  };
}

const envDiagnostics = loadEnvChain();

const isDev = !app.isPackaged;
const activityLog: ActivityLogEntry[] = [];
const pendingActions = new Map<string, ActionPlan>();
let mainWindow: BrowserWindow | null = null;
let startupLogged = false;
let voiceRuntimeStatus = createVoiceStub(true);
let pendingApprovalContext: PendingApprovalContext | null = null;
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

class SttBackendError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SttBackendError";
  }
}

function ensureDirectory(targetPath: string): string {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

function resolveWritableRuntimeRoot(): string {
  const preferredRoot = path.join(app.getPath("appData"), "JarvisAgent");
  const fallbackRoot = path.join(app.getPath("temp"), "JarvisAgent");

  try {
    return ensureDirectory(preferredRoot);
  } catch (error) {
    logger.warn("runtime", "appData runtime root kullanilamadi, temp klasorune geciliyor.", error);
    return ensureDirectory(fallbackRoot);
  }
}

function configureRuntimePaths(): { runtimeRoot: string; userDataPath: string; sessionDataPath: string; cachePath: string } {
  const runtimeRoot = resolveWritableRuntimeRoot();
  const modeFolder = isDev ? "dev-runtime" : "runtime";
  const basePath = ensureDirectory(path.join(runtimeRoot, modeFolder));
  const userDataPath = ensureDirectory(path.join(basePath, "user-data"));
  const sessionDataPath = ensureDirectory(path.join(basePath, "session-data"));
  const cachePath = ensureDirectory(path.join(basePath, "cache"));
  const mediaCachePath = ensureDirectory(path.join(cachePath, "media"));
  const gpuCachePath = ensureDirectory(path.join(cachePath, "gpu"));

  app.setPath("userData", userDataPath);
  app.setPath("sessionData", sessionDataPath);
  app.setPath("logs", ensureDirectory(path.join(basePath, "logs")));

  app.commandLine.appendSwitch("disk-cache-dir", cachePath);
  app.commandLine.appendSwitch("media-cache-dir", mediaCachePath);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
  app.commandLine.appendSwitch("disable-features", "GPUCacheServiceInProcess");

  if (isDev) {
    app.disableHardwareAcceleration();
  }

  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

  return {
    runtimeRoot: basePath,
    userDataPath,
    sessionDataPath,
    cachePath: gpuCachePath
  };
}

function createLog(kind: ActivityLogEntry["kind"], message: string, source: ActivityLogEntry["source"] = "system"): ActivityLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind,
    message,
    timestamp: new Date().toISOString(),
    source
  };
}

function pushLog(kind: ActivityLogEntry["kind"], message: string, source: ActivityLogEntry["source"] = "system"): ActivityLogEntry[] {
  activityLog.unshift(createLog(kind, message, source));
  return activityLog.slice(0, 30);
}

function setPendingApprovalContext(plan: PlannedCommand, source: "text" | "voice" | "wake_word" | "quick-task"): PendingApprovalContext | null {
  const firstAction = plan.proposedActions[0];
  if (!firstAction) {
    pendingApprovalContext = null;
    return null;
  }

  pendingApprovalContext = {
    pendingApprovalId: firstAction.id,
    pendingPlan: plan,
    pendingActionSummary: `${firstAction.label}: ${firstAction.reason}`,
    pendingSource: source,
    pendingSince: new Date().toISOString(),
    pendingTimeoutMs: APPROVAL_TIMEOUT_MS,
    pendingRiskLevel: plan.riskLevel
  };
  return pendingApprovalContext;
}

function clearPendingApprovalContext(): void {
  pendingApprovalContext = null;
}

function getActivePendingApprovalContext(): PendingApprovalContext | null {
  if (!pendingApprovalContext) {
    return null;
  }

  const elapsedMs = Date.now() - new Date(pendingApprovalContext.pendingSince).getTime();
  if (elapsedMs > pendingApprovalContext.pendingTimeoutMs) {
    pushLog("approval_expired", "Onay suresi doldu.");
    clearPendingApprovalContext();
    return null;
  }

  return pendingApprovalContext;
}

function normalizeApprovalInput(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseApprovalIntent(input: string): "approve" | "reject" | "detail" | "none" {
  const normalized = normalizeApprovalInput(input);

  if (["onayla", "evet", "uygula", "devam et", "tamam"].includes(normalized)) {
    return "approve";
  }

  if (["iptal et", "hayir", "vazgec", "durdur", "reddet"].includes(normalized)) {
    return "reject";
  }

  if (["tekrar et", "neyi onayliyorum", "detay goster", "hangi islem", "ne yapacaksin"].includes(normalized)) {
    return "detail";
  }

  return "none";
}

function updateVoiceRuntimeStatus(
  status: VoiceSessionStatus["status"],
  note: string,
  options?: {
    mode?: VoiceControlMode;
    errorCode?: VoiceErrorCode | null;
    lastTranscript?: string;
    fallbackMode?: "push_to_talk" | "wake_word" | null;
  }
): void {
  voiceRuntimeStatus = {
    ...voiceRuntimeStatus,
    available: true,
    backend: "openai",
    mode: options?.mode ?? voiceRuntimeStatus.mode ?? "push_to_talk",
    status,
    note,
    errorCode: options?.errorCode ?? null,
    lastTranscript: options?.lastTranscript ?? voiceRuntimeStatus.lastTranscript ?? "",
    fallbackMode: options?.fallbackMode ?? voiceRuntimeStatus.fallbackMode ?? "push_to_talk"
  };
}

function isTrustedLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://localhost:") || origin.startsWith("file://");
}

function configurePermissionHandlers(): void {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (permission === "media") {
      logger.info("voice", "mic permission check", { requestingOrigin });
      return isTrustedLocalOrigin(requestingOrigin);
    }

    return true;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === "media") {
      const origin =
        ("requestingOrigin" in details && typeof details.requestingOrigin === "string" ? details.requestingOrigin : "") ||
        ("securityOrigin" in details && typeof details.securityOrigin === "string" ? details.securityOrigin : "") ||
        "";
      logger.info("voice", "mic permission request", { origin });
      pushLog("mic_permission_requested", `Mikrofon izni istendi: ${origin}`);
      const allowed = isTrustedLocalOrigin(origin);
      if (allowed) {
        logger.info("voice", "mic granted");
        updateVoiceRuntimeStatus("mic_ready", "Mikrofon izni verildi.", {
          errorCode: null,
          fallbackMode: "push_to_talk"
        });
        pushLog("mic_permission_granted", "Mikrofon izni verildi.");
      } else {
        logger.info("voice", "mic denied");
        updateVoiceRuntimeStatus("error", "Mikrofon izni reddedildi.", {
          errorCode: "permission_denied",
          fallbackMode: "push_to_talk"
        });
        pushLog("mic_permission_denied", "Mikrofon izni reddedildi.");
      }
      callback(allowed);
      return;
    }

    callback(false);
  });
}

function getManagedTargets(): ManagedTarget[] {
  const desktopPath = app.getPath("desktop");
  const downloadsPath = app.getPath("downloads");
  const documentsPath = app.getPath("documents");
  const talepetPath = "C:\\Users\\C1\\Desktop\\talepet";
  const vscodePath = process.env.JARVIS_VSCODE_PATH || "C:\\Users\\C1\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe";
  const chromePath = process.env.JARVIS_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  return [
    {
      id: "project-talepet",
      type: "project",
      label: "Talepet project",
      description: "Yonetilen yerel proje klasoru.",
      path: talepetPath,
      approvalPolicy: "always",
      enabled: true,
      tags: ["talepet", "project", "repo"]
    },
    {
      id: "folder-downloads",
      type: "folder",
      label: "Downloads folder",
      description: "Indirilen dosyalar klasoru.",
      path: downloadsPath,
      approvalPolicy: "always",
      enabled: true,
      tags: ["downloads", "indirilenler", "folder"]
    },
    {
      id: "folder-desktop",
      type: "folder",
      label: "Desktop folder",
      description: "Masaustu klasoru.",
      path: desktopPath,
      approvalPolicy: "always",
      enabled: true,
      tags: ["desktop", "masaustu", "folder"]
    },
    {
      id: "folder-documents",
      type: "folder",
      label: "Documents folder",
      description: "Belgeler klasoru.",
      path: documentsPath,
      approvalPolicy: "always",
      enabled: true,
      tags: ["documents", "belgeler", "folder"]
    },
    {
      id: "app-vscode",
      type: "app",
      label: "VS Code",
      description: "Kod editoru.",
      path: vscodePath,
      appIdentifier: "vscode",
      approvalPolicy: "always",
      enabled: true,
      tags: ["vs code", "vscode", "code", "editor"]
    },
    {
      id: "app-chrome",
      type: "app",
      label: "Chrome",
      description: "Varsayilan web gelistirme tarayicisi.",
      path: chromePath,
      appIdentifier: "chrome",
      approvalPolicy: "always",
      enabled: true,
      tags: ["chrome", "google chrome", "browser", "tarayici"]
    },
    {
      id: "provider-render",
      type: "provider",
      label: "Render dashboard",
      description: "Hosting ve deploy paneli.",
      url: "https://dashboard.render.com",
      approvalPolicy: "always",
      enabled: true,
      tags: ["render", "dashboard", "deploy", "hosting"]
    },
    {
      id: "provider-cloudflare",
      type: "provider",
      label: "Cloudflare",
      description: "DNS ve domain paneli.",
      url: "https://dash.cloudflare.com",
      approvalPolicy: "always",
      enabled: true,
      tags: ["cloudflare", "dns", "domain"]
    }
  ];
}

function getSettings(): AgentSettings {
  const targets = getManagedTargets();
  const defaultFolders = targets
    .filter((target) => target.path)
    .map((target) => target.path as string);
  const defaultDomains = ["render.com", "dashboard.render.com", "cloudflare.com", "dash.cloudflare.com"];

  return {
    appName: process.env.JARVIS_APP_NAME || "Jarvis Agent",
    defaultMode: process.env.JARVIS_DEFAULT_MODE === "dry-run" ? "dry-run" : "approval",
    allowedDomains: (process.env.JARVIS_ALLOWED_DOMAINS || defaultDomains.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedFolders: (process.env.JARVIS_ALLOWED_FOLDERS || defaultFolders.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedApps: (process.env.JARVIS_ALLOWED_APPS || "vscode,chrome")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedCommands: (process.env.JARVIS_ALLOWED_COMMANDS || "whoami,ipconfig,pwd,list-home")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    targets,
    voiceStubEnabled: process.env.JARVIS_ENABLE_VOICE_STUB !== "false",
    sttProvider: process.env.JARVIS_STT_PROVIDER === "disabled" ? "disabled" : "openai",
    wakeWordEnabled: process.env.JARVIS_ENABLE_WAKE_WORD === "true"
  };
}

function getSttConfig() {
  return {
    provider: process.env.JARVIS_STT_PROVIDER === "disabled" ? "disabled" : "openai",
    apiKey: process.env.JARVIS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.JARVIS_STT_BASE_URL || "https://api.openai.com/v1",
    model: process.env.JARVIS_STT_MODEL || "gpt-4o-mini-transcribe",
    language: process.env.JARVIS_STT_LANGUAGE || "tr",
    timeoutMs: Number(process.env.JARVIS_STT_TIMEOUT_MS || "20000")
  };
}

async function transcribeAudioWithBackend(audio: ArrayBuffer, mimeType: string): Promise<string> {
  const config = getSttConfig();

  if (config.provider === "disabled") {
    throw new SttBackendError("stt_backend_unavailable", "STT backend kapali.");
  }

  if (!config.apiKey) {
    throw new SttBackendError("stt_backend_unavailable", "OPENAI_API_KEY veya JARVIS_OPENAI_API_KEY bulunamadi.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const form = new FormData();
    const audioBlob = new Blob([audio], { type: mimeType || "audio/webm" });
    const extension =
      mimeType.includes("mp4") ? "m4a" :
      mimeType.includes("wav") ? "wav" :
      "webm";

    form.set("file", audioBlob, `jarvis-capture.${extension}`);
    form.set("model", config.model);
    form.set("language", config.language);

    const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        response.status === 400 &&
        body.includes("audio duration") &&
        body.includes("shorter than")
      ) {
        throw new SttBackendError("audio_too_short", "Kayit cok kisa. Mikrofonu biraz daha uzun basili tutun.");
      }
      if (response.status === 408 || response.status === 504) {
        throw new SttBackendError("stt_timeout", "STT backend yanit vermedi.");
      }
      throw new SttBackendError("stt_backend_unavailable", `STT backend hatasi: ${response.status} ${body}`);
    }

    const payload = await response.json() as { text?: string };
    const transcript = payload.text?.trim() ?? "";

    if (!transcript) {
      throw new SttBackendError("transcript_empty", "Ses kaydi alindi ama transcript bos dondu.");
    }

    return transcript;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new SttBackendError("stt_timeout", "STT backend yanit vermedi.");
    }
    if (error instanceof SttBackendError) {
      throw error;
    }
    throw new SttBackendError("unknown_voice_error", error instanceof Error ? error.message : "Bilinmeyen STT hatasi.");
  } finally {
    clearTimeout(timeout);
  }
}

function createAction(input: Omit<ActionPlan, "id">): ActionPlan {
  return {
    ...input,
    id: `action-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
  };
}

function registerPendingActions(actions: ActionPlan[]): void {
  actions.forEach((action) => {
    pendingActions.set(action.id, action);
    pushLog("approval_requested", `${action.label} onay bekliyor.`);
  });
}

function buildWizard(title: string, summary: string, steps: string[], actions: ActionPlan[]): WizardScenario {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    summary,
    steps,
    suggestedActions: actions
  };
}

function buildPlan(
  originalCommand: string,
  detectedIntent: IntentType,
  target: ManagedTarget | undefined,
  proposedActions: ActionPlan[],
  previewText: string,
  riskLevel: RiskLevel = "low"
): PlannedCommand {
  return {
    originalCommand,
    detectedIntent,
    target,
    proposedActions,
    riskLevel,
    requiresApproval: true,
    previewText
  };
}

function buildResponse(
  transcript: string,
  source: "text" | "voice" | "wake_word" | "quick-task",
  plan: PlannedCommand,
  summary: string,
  wizard?: WizardScenario
): CommandResult {
  if (plan.proposedActions.length) {
    registerPendingActions(plan.proposedActions);
    setPendingApprovalContext(plan, source);
    if (source === "voice" || source === "wake_word") {
      pushLog("approval_voice_prompted", `${plan.proposedActions[0]?.label ?? "Aksiyon"} icin sesli onay bekleniyor.`, "voice");
    }
  } else {
    clearPendingApprovalContext();
  }

  pushLog("plan_created", `${plan.detectedIntent} icin ${plan.proposedActions.length} aksiyon planlandi.`);

  return {
    transcript,
    intent: plan.detectedIntent,
    source,
    summary,
    actions: plan.proposedActions,
    wizard,
    plan
  };
}

function findTarget(settings: AgentSettings, matcher: (target: ManagedTarget) => boolean): ManagedTarget | undefined {
  return settings.targets.find((target) => target.enabled && matcher(target));
}

function findTargetByInput(input: string, settings: AgentSettings): ManagedTarget | undefined {
  return settings.targets.find((target) =>
    target.enabled &&
    [target.label.toLowerCase(), ...target.tags.map((tag) => tag.toLowerCase())].some((token) => input.includes(token))
  );
}

function buildOpenTargetPlan(target: ManagedTarget, command: string): PlannedCommand {
  if (target.type === "project") {
    return buildPlan(
      command,
      "open_target",
      target,
      [
        createAction({
          type: "open_project",
          label: `${target.label} ac`,
          targetId: target.id,
          args: { path: target.path },
          requiresConfirmation: true,
          riskLevel: "low",
          reversible: true,
          reason: `${target.label} icin proje klasorunu Windows Explorer'da acar.`
        })
      ],
      `${target.label} icin proje acma plani hazir.`
    );
  }

  if (target.type === "folder") {
    return buildPlan(
      command,
      "open_folder",
      target,
      [
        createAction({
          type: "open_folder",
          label: `${target.label} ac`,
          targetId: target.id,
          args: { path: target.path },
          requiresConfirmation: true,
          riskLevel: "low",
          reversible: true,
          reason: `${target.label} klasorunu Windows Explorer'da acar.`
        })
      ],
      `${target.label} klasoru icin acma plani hazir.`
    );
  }

  if (target.type === "app") {
    return buildPlan(
      command,
      "open_app",
      target,
      [
        createAction({
          type: "open_app",
          label: `${target.label} ac`,
          targetId: target.id,
          args: { path: target.path, appIdentifier: target.appIdentifier },
          requiresConfirmation: true,
          riskLevel: "low",
          reversible: false,
          reason: `${target.label} uygulamasini baslatir.`
        })
      ],
      `${target.label} uygulamasi icin acma plani hazir.`
    );
  }

  return buildPlan(
    command,
    "open_provider_dashboard",
    target,
    [
      createAction({
        type: "open_url",
        label: `${target.label} ac`,
        targetId: target.id,
        args: { url: target.url },
        requiresConfirmation: true,
        riskLevel: "low",
        reversible: true,
        reason: `${target.label} panelini varsayilan tarayicida acar.`
      })
    ],
    `${target.label} paneli icin acma plani hazir.`
  );
}

function buildDnsWizard(settings: AgentSettings, command: string): { plan: PlannedCommand; wizard: WizardScenario } {
  const cloudflare = findTarget(settings, (target) => target.id === "provider-cloudflare");
  const render = findTarget(settings, (target) => target.id === "provider-render");
  const actions = [cloudflare, render]
    .filter(Boolean)
    .map((target) =>
      createAction({
        type: "open_url",
        label: `${target?.label} ac`,
        targetId: target?.id,
        args: { url: target?.url },
        requiresConfirmation: true,
        riskLevel: "low",
        reversible: true,
        reason: `${target?.label} panelini DNS akisinda kullanmak icin acar.`
      })
    );
  const wizard = buildWizard(
    "DNS Wizard",
    "DNS degisikligi icin checklist, onayli panel linkleri ve guvenli ilerleme akisi hazir.",
    [
      "Hedef domain veya subdomain adini netlestir.",
      "Mevcut DNS kaydini ve yeni hedef degerini karsilastir.",
      "Render veya ilgili panelden beklenen CNAME/A kaydini dogrula.",
      "Degisikligi yapmadan once onay ver, sonra propagation kontrolu yap."
    ],
    actions
  );

  return {
    plan: buildPlan(command, "start_dns_flow", cloudflare, actions, wizard.summary),
    wizard
  };
}

function buildDomainWizard(settings: AgentSettings, command: string): { plan: PlannedCommand; wizard: WizardScenario } {
  const cloudflare = findTarget(settings, (target) => target.id === "provider-cloudflare");
  const render = findTarget(settings, (target) => target.id === "provider-render");
  const actions = [render, cloudflare]
    .filter(Boolean)
    .map((target) =>
      createAction({
        type: "open_url",
        label: `${target?.label} ac`,
        targetId: target?.id,
        args: { url: target?.url },
        requiresConfirmation: true,
        riskLevel: "low",
        reversible: true,
        reason: `${target?.label} panelini domain baglama akisinda kullanmak icin acar.`
      })
    );
  const wizard = buildWizard(
    "Domain Baglama Akisi",
    "Custom domain baglama sureci icin kullanilabilir checklist ve panel gecisleri hazir.",
    [
      "Baglanacak domain ve hedef servisi sec.",
      "Hosting panelinden beklenen hedef kaydi kopyala.",
      "DNS panelinde gerekli CNAME veya A kaydini hazirla.",
      "SSL ve propagation durumunu son kontrolde dogrula."
    ],
    actions
  );

  return {
    plan: buildPlan(command, "start_domain_flow", render, actions, wizard.summary),
    wizard
  };
}

function resolveSearchRoot(input: string, settings: AgentSettings): ManagedTarget | undefined {
  return findTarget(settings, (target) =>
    (target.type === "folder" || target.type === "project") &&
    [target.label.toLowerCase(), ...target.tags.map((tag) => tag.toLowerCase())].some((token) => input.includes(token))
  );
}

function parseSearchQuery(input: string): string {
  const match = input.match(/(?:pdf|txt|docx|xlsx|jpg|png|dosya|file|ara)\s+(.+)/);
  return match?.[1]?.trim() || input.replace(/ara|bul|search/g, "").trim() || "*";
}

function routeCommand(transcript: string, settings: AgentSettings, source: "text" | "voice" | "wake_word" = "text"): CommandResult {
  const input = transcript.toLowerCase().trim();
  pushLog("command_received", transcript, source);

  if (input.includes("dns")) {
    const { plan, wizard } = buildDnsWizard(settings, transcript);
    return buildResponse(transcript, source, plan, "DNS wizard baslatildi. Approval bekleyen panel aksiyonlari hazir.", wizard);
  }

  if (input.includes("domain")) {
    const { plan, wizard } = buildDomainWizard(settings, transcript);
    return buildResponse(transcript, source, plan, "Domain baglama akisi hazirlandi.", wizard);
  }

  if (input.includes("not")) {
    const documents = findTarget(settings, (target) => target.id === "folder-documents");
    const notesRoot = documents?.path ? path.join(documents.path, "Jarvis Notes") : app.getPath("documents");
    const action = createAction({
      type: "create_note",
      label: "Yeni not olustur",
      targetId: documents?.id,
      args: {
        path: notesRoot,
        noteTitle: `jarvis-note-${Date.now()}.md`,
        noteContent: `# Jarvis Note\n\nKomut: ${transcript}\n`
      },
      requiresConfirmation: true,
      riskLevel: "low",
      reversible: true,
      reason: "Belgeler altinda yeni bir not dosyasi olusturur ve acar."
    });
    const plan = buildPlan(transcript, "create_note", documents, [action], "Not olusturma plani hazir.");
    return buildResponse(transcript, source, plan, "Yeni not olusturmak icin approval bekleniyor.");
  }

  if (input.includes("ara") || input.includes("search")) {
    const rootTarget = resolveSearchRoot(input, settings) || findTarget(settings, (target) => target.id === "folder-documents");
    const query = parseSearchQuery(input);
    const action = createAction({
      type: "search_files",
      label: `${rootTarget?.label ?? "klasor"} icinde dosya ara`,
      targetId: rootTarget?.id,
      args: {
        rootPath: rootTarget?.path,
        query
      },
      requiresConfirmation: true,
      riskLevel: "low",
      reversible: true,
      reason: "Izinli kok klasor icinde dosya arar ve sonucu audit trail'e yazar."
    });
    const plan = buildPlan(transcript, "search_files", rootTarget, [action], "Dosya arama plani hazir.");
    return buildResponse(transcript, source, plan, "Dosya arama icin approval bekleniyor.");
  }

  if (input.includes("whoami") || input.includes("ipconfig") || input.includes("pwd") || input.includes("listele")) {
    const command =
      input.includes("ipconfig") ? "ipconfig" :
      input.includes("whoami") ? "whoami" :
      input.includes("pwd") ? "pwd" :
      "list-home";
    const action = createAction({
      type: "run_safe_command",
      label: `Guvenli komut calistir: ${command}`,
      args: { command },
      requiresConfirmation: true,
      riskLevel: "medium",
      reversible: true,
      reason: "Dar allowlist icindeki salt-okunur bir komutu calistirir."
    });
    const plan = buildPlan(transcript, "run_safe_command", undefined, [action], "Guvenli komut plani hazir.", "medium");
    return buildResponse(transcript, source, plan, "Guvenli komut icin approval bekleniyor.");
  }

  const target = findTargetByInput(input, settings);
  if (target && (input.includes("ac") || input.includes("open") || input.includes("başlat") || input.includes("baslat"))) {
    const plan = buildOpenTargetPlan(target, transcript);
    return buildResponse(transcript, source, plan, plan.previewText);
  }

  const fallbackPlan = buildPlan(
    transcript,
    "general_assistance",
    undefined,
    [],
    "Bu komut icin henuz otomatik aksiyon cikarilmadi. Daha net bir hedef veya eylem soyleyebilirsin."
  );
  const wizard = buildWizard(
    "Komut Rehberi",
    "Jarvis su an klasor, uygulama, panel, not, dosya arama ve guvenli komut akislarini destekliyor.",
    [
      "Ornek: Downloads klasorunu ac",
      "Ornek: Chrome'u ac",
      "Ornek: Render dashboard ac",
      "Ornek: Desktop'ta pdf ara"
    ],
    []
  );
  return buildResponse(transcript, source, fallbackPlan, fallbackPlan.previewText, wizard);
}

function routeQuickTask(request: QuickTaskRequest, settings: AgentSettings): CommandResult {
  const quickTaskCommands: Record<QuickTaskRequest["taskId"], string> = {
    "open-talepet-folder": "Talepet klasorunu ac",
    "open-downloads-folder": "Downloads klasorunu ac",
    "open-vscode": "VS Code'u ac",
    "open-chrome": "Chrome'u ac",
    "open-render-dashboard": "Render dashboard ac",
    "open-cloudflare": "Cloudflare'i ac",
    "start-dns-wizard": "DNS wizard baslat",
    "start-domain-wizard": "Domain baglama baslat"
  };

  const result = routeCommand(quickTaskCommands[request.taskId], settings, "text");
  return {
    ...result,
    source: "quick-task"
  };
}

function executeApp(targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = exec(`powershell -NoProfile -Command "Start-Process -FilePath '${targetPath.replace(/'/g, "''")}'"`, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    child.unref();
  });
}

function searchFiles(rootPath: string, query: string): string[] {
  const normalizedQuery = query.toLowerCase();
  const results: string[] = [];

  function walk(currentPath: string, depth: number): void {
    if (depth > 3 || results.length >= 20) {
      return;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (results.length >= 20) {
        return;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
        continue;
      }

      if (entry.name.toLowerCase().includes(normalizedQuery)) {
        results.push(fullPath);
      }
    }
  }

  walk(rootPath, 0);
  return results;
}

function runSafeCommand(command: string): Promise<string> {
  const commandMap: Record<string, string> = {
    whoami: "whoami",
    ipconfig: "ipconfig",
    pwd: "powershell -NoProfile -Command Get-Location",
    "list-home": `powershell -NoProfile -Command Get-ChildItem -Name '${app.getPath("home")}'`
  };

  return new Promise((resolve, reject) => {
    exec(commandMap[command], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve(stdout.trim() || "Komut cikti vermedi.");
    });
  });
}

async function executeApprovedAction(action: ActionPlan, settings: AgentSettings): Promise<string> {
  const validationError = validateActionAgainstPolicy(action, {
    allowedDomains: settings.allowedDomains,
    allowedFolders: settings.allowedFolders,
    allowedApps: settings.allowedApps,
    allowedCommands: settings.allowedCommands
  });

  if (validationError) {
    throw new Error(validationError);
  }

  pushLog("action_started", `${action.label} basladi.`);

  if ((action.type === "open_folder" || action.type === "open_project") && action.args.path) {
    await shell.openPath(action.args.path);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return `${action.args.path} acildi.`;
  }

  if (action.type === "open_url" && action.args.url) {
    await shell.openExternal(action.args.url);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return `${action.args.url} varsayilan tarayicida acildi.`;
  }

  if (action.type === "open_app" && action.args.path) {
    await executeApp(action.args.path);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return `${action.label} baslatildi.`;
  }

  if (action.type === "create_note" && action.args.path && action.args.noteTitle) {
    ensureDirectory(action.args.path);
    const notePath = path.join(action.args.path, action.args.noteTitle);
    fs.writeFileSync(notePath, action.args.noteContent || "# Jarvis Note\n", "utf8");
    await shell.openPath(notePath);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return `${notePath} olusturuldu ve acildi.`;
  }

  if (action.type === "search_files" && action.args.rootPath && action.args.query) {
    const matches = searchFiles(action.args.rootPath, action.args.query);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return matches.length
      ? `Eslesen dosyalar: ${matches.slice(0, 5).join(" | ")}`
      : "Eslesen dosya bulunamadi.";
  }

  if (action.type === "run_safe_command" && action.args.command) {
    const output = await runSafeCommand(action.args.command);
    pushLog("action_succeeded", `${action.label} basarili.`);
    return `Komut cikti: ${output}`;
  }

  throw new Error("Desteklenmeyen action tipi.");
}

async function resolveApprovalDecision(
  decision: ApprovalDecision & { action?: ActionPlan },
  source: "text" | "voice" = "text"
): Promise<{
  ok: boolean;
  message: string;
  activity: ActivityLogEntry[];
  pendingApproval: PendingApprovalContext | null;
}> {
  const settings = getSettings();
  const action = pendingActions.get(decision.actionId) || decision.action;

  if (!action) {
    return {
      ok: false,
      message: "Bekleyen aksiyon bulunamadi.",
      activity: pushLog("action_failed", "Bekleyen aksiyon bulunamadi."),
      pendingApproval: getActivePendingApprovalContext()
    };
  }

  if (!decision.approved) {
    pendingActions.delete(action.id);
    clearPendingApprovalContext();
    return {
      ok: true,
      message: "Aksiyon reddedildi.",
      activity: pushLog(source === "voice" ? "approval_rejected_voice" : "approval_rejected", `${action.label} reddedildi.`, source),
      pendingApproval: null
    };
  }

  pushLog(source === "voice" ? "approval_granted_voice" : "approval_granted", `${action.label} icin onay verildi.`, source);

  try {
    const message = settings.defaultMode === "dry-run"
      ? `${action.label} dry-run modunda isaretlendi.`
      : await executeApprovedAction(action, settings);
    pendingActions.delete(action.id);
    clearPendingApprovalContext();
    return {
      ok: true,
      message,
      activity: activityLog.slice(0, 30),
      pendingApproval: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata.";
    pendingActions.delete(action.id);
    clearPendingApprovalContext();
    return {
      ok: false,
      message,
      activity: pushLog("action_failed", `${action.label} basarisiz oldu: ${message}`),
      pendingApproval: null
    };
  }
}

function createWindow(): void {
  const preloadFile = path.join(__dirname, "../preload/index.cjs");
  logger.info("window", "createWindow", {
    preloadFile,
    rendererUrl: process.env.ELECTRON_RENDERER_URL ?? "file://renderer"
  });

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1180,
    minHeight: 780,
    backgroundColor: "#0f172a",
    title: "Jarvis Agent",
    webPreferences: {
      preload: preloadFile,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logger.info("window", "renderer finished load");
  });

  mainWindow.webContents.on("console-message", (_, level, message) => {
    if (message.includes("[vite]")) {
      return;
    }
    logger.info("renderer", "console", { level, message });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

const runtimePaths = configureRuntimePaths();
configureLogger(path.join(app.getPath("logs"), "main.log"));
logger.info("env", "env load diagnostics", {
  attemptedPaths: envDiagnostics.attemptedPaths,
  loadedPath: envDiagnostics.loadedPath,
  apiKeyFound: envDiagnostics.apiKeySource !== "missing",
  apiKeySource: envDiagnostics.apiKeySource
});

app.whenReady().then(() => {
  configurePermissionHandlers();
  logger.info("runtime", "runtime paths", {
    runtimeRoot: runtimePaths.runtimeRoot,
    userData: app.getPath("userData"),
    sessionData: app.getPath("sessionData"),
    logs: app.getPath("logs"),
    cache: runtimePaths.cachePath
  });
  if (envDiagnostics.apiKeySource === "missing") {
    logger.warn("env", "api key bulunamadi", {
      checkedVars: ["JARVIS_OPENAI_API_KEY", "OPENAI_API_KEY"],
      loadedPath: envDiagnostics.loadedPath
    });
  } else {
    logger.info("env", "api key bulundu", {
      source: envDiagnostics.apiKeySource,
      loadedPath: envDiagnostics.loadedPath
    });
  }

  if (!startupLogged) {
    pushLog("info", "Jarvis agent hazirlandi.");
    startupLogged = true;
  }

  createWindow();

  ipcMain.handle("agent:get-bootstrap", () => {
    const settings = getSettings();
    if (!settings.voiceStubEnabled || settings.sttProvider === "disabled") {
      voiceRuntimeStatus = createVoiceStub(false);
    }
    return {
      settings,
      voice: voiceRuntimeStatus,
      activity: activityLog.slice(0, 30),
      pendingApproval: getActivePendingApprovalContext()
    };
  });

  ipcMain.handle("agent:submit-command", (_, transcript: string) => {
    const settings = getSettings();
    const result = routeCommand(transcript, settings, "text");
    const previews = result.actions.map((action) => ({
      action,
      preview: previewAction(
        action,
        {
          allowedDomains: settings.allowedDomains,
          allowedFolders: settings.allowedFolders,
          allowedApps: settings.allowedApps,
          allowedCommands: settings.allowedCommands
        },
        settings.defaultMode
      )
    }));

    return {
      result,
      previews,
      activity: activityLog.slice(0, 30),
      pendingApproval: getActivePendingApprovalContext()
    };
  });

  ipcMain.handle("agent:submit-voice-command", (_, payload: { transcript: string; source: "voice" | "wake_word" }) => {
    const pendingApproval = getActivePendingApprovalContext();
    if (pendingApproval) {
      const approvalIntent = parseApprovalIntent(payload.transcript);
      pushLog("approval_voice_received", payload.transcript, "voice");

      if (approvalIntent === "approve") {
        return resolveApprovalDecision({
          actionId: pendingApproval.pendingApprovalId,
          approved: true
        }, "voice").then((resolution) => ({
          result: {
            transcript: payload.transcript,
            intent: "general_assistance" as const,
            source: payload.source,
            summary: resolution.message,
            actions: [],
            plan: {
              originalCommand: payload.transcript,
              detectedIntent: "general_assistance",
              proposedActions: [],
              riskLevel: pendingApproval.pendingRiskLevel,
              requiresApproval: false,
              previewText: resolution.message
            }
          },
          previews: [],
          activity: resolution.activity,
          pendingApproval: resolution.pendingApproval,
          approvalResolution: {
            actionId: pendingApproval.pendingApprovalId,
            approved: true,
            ok: resolution.ok,
            message: resolution.message,
            source: "voice"
          }
        }));
      }

      if (approvalIntent === "reject") {
        return resolveApprovalDecision({
          actionId: pendingApproval.pendingApprovalId,
          approved: false
        }, "voice").then((resolution) => ({
          result: {
            transcript: payload.transcript,
            intent: "general_assistance" as const,
            source: payload.source,
            summary: resolution.message,
            actions: [],
            plan: {
              originalCommand: payload.transcript,
              detectedIntent: "general_assistance",
              proposedActions: [],
              riskLevel: pendingApproval.pendingRiskLevel,
              requiresApproval: false,
              previewText: resolution.message
            }
          },
          previews: [],
          activity: resolution.activity,
          pendingApproval: resolution.pendingApproval,
          approvalResolution: {
            actionId: pendingApproval.pendingApprovalId,
            approved: false,
            ok: resolution.ok,
            message: resolution.message,
            source: "voice"
          }
        }));
      }

      if (approvalIntent === "detail") {
        pushLog("approval_detail_requested", `${pendingApproval.pendingActionSummary}`, "voice");
        const summary = `${pendingApproval.pendingActionSummary} Onaylamak icin onayla, iptal etmek icin iptal et diyebilirsiniz.`;
        return {
          result: {
            transcript: payload.transcript,
            intent: "general_assistance" as const,
            source: payload.source,
            summary,
            actions: [],
            plan: {
              ...pendingApproval.pendingPlan,
              previewText: summary
            }
          },
          previews: [],
          activity: activityLog.slice(0, 30),
          pendingApproval
        };
      }

      const waitMessage = "Su anda bir onay bekleniyor. Once onayla veya iptal et diyebilirsiniz.";
      return {
        result: {
          transcript: payload.transcript,
          intent: "general_assistance" as const,
          source: payload.source,
          summary: waitMessage,
          actions: [],
          plan: {
            ...pendingApproval.pendingPlan,
            previewText: waitMessage
          }
        },
        previews: [],
        activity: activityLog.slice(0, 30),
        pendingApproval
      };
    }

    const settings = getSettings();
    updateVoiceRuntimeStatus("planning", "Transcript planner'a gonderiliyor...", {
      mode: payload.source === "wake_word" ? "wake_word" : "push_to_talk",
      errorCode: null,
      lastTranscript: payload.transcript
    });
    pushLog("transcript_received", payload.transcript, payload.source);
    const result = routeCommand(payload.transcript, settings, payload.source);
    const previews = result.actions.map((action) => ({
      action,
      preview: previewAction(
        action,
        {
          allowedDomains: settings.allowedDomains,
          allowedFolders: settings.allowedFolders,
          allowedApps: settings.allowedApps,
          allowedCommands: settings.allowedCommands
        },
        settings.defaultMode
      )
    }));

    return {
      result,
      previews,
      activity: activityLog.slice(0, 30),
      pendingApproval: getActivePendingApprovalContext()
    };
  });

  ipcMain.handle("agent:start-voice-capture", () => {
    logger.info("voice", "voice capture requested");
    updateVoiceRuntimeStatus("requesting_permission", "Mikrofon izni kontrol ediliyor...", {
      errorCode: null
    });
    pushLog("voice_capture_started", "Mikrofon kaydi baslatildi.");
    pushLog("voice_started", "Sesli komut baslatildi.");
    return {
      ok: true,
      status: voiceRuntimeStatus.status,
      message: voiceRuntimeStatus.note
    };
  });

  ipcMain.handle("agent:stop-voice-capture", () => {
    logger.info("voice", "voice capture stop requested");
    updateVoiceRuntimeStatus("transcribing", "Konusma sonlandirildi, transcript bekleniyor...", {
      errorCode: null
    });
    pushLog("voice_capture_stopped", "Mikrofon kaydi durduruldu.");
    pushLog("voice_stopped", "Sesli komut durduruldu.");
    return {
      ok: true,
      status: voiceRuntimeStatus.status,
      message: voiceRuntimeStatus.note
    };
  });

  ipcMain.handle("agent:transcribe-audio", async (_, payload: { audio: ArrayBuffer; mimeType: string }) => {
    pushLog("stt_request_started", "Ses kaydi STT backend'e gonderildi.", "voice");
    logger.info("voice", "stt_request_started", {
      bytes: payload.audio.byteLength,
      mimeType: payload.mimeType
    });

    try {
      const transcript = await transcribeAudioWithBackend(payload.audio, payload.mimeType);
      updateVoiceRuntimeStatus("transcript_ready", "Transcript hazir.", {
        errorCode: null,
        lastTranscript: transcript
      });
      pushLog("stt_request_succeeded", "STT backend transcript dondu.", "voice");
      pushLog("transcript_received", transcript, "voice");
      logger.info("voice", "stt_request_succeeded", { transcript });

      return {
        ok: true,
        transcript,
        activity: activityLog.slice(0, 30)
      };
    } catch (error) {
      const code = error instanceof SttBackendError ? error.code : "unknown_voice_error";
      const message = error instanceof Error ? error.message : "Bilinmeyen STT hatasi.";
      updateVoiceRuntimeStatus("error", message, {
        errorCode: code,
        fallbackMode: "push_to_talk"
      });
      pushLog("stt_request_failed", `${code}: ${message}`, "voice");
      pushLog("transcript_failed", `${code}: ${message}`, "voice");
      logger.warn("voice", "stt_request_failed", { code, message });

      return {
        ok: false,
        code,
        message,
        activity: activityLog.slice(0, 30)
      };
    }
  });

  ipcMain.handle("agent:get-voice-status", () => voiceRuntimeStatus);

  ipcMain.handle("agent:report-voice-event", (_, payload: {
    kind: "transcript_failed" | "wake_word_detected";
    code?: VoiceErrorCode;
    message: string;
    fallbackMode?: "push_to_talk" | "wake_word";
  }) => {
    if (payload.kind === "transcript_failed") {
      logger.warn("voice", "transcript_failed", payload);
      updateVoiceRuntimeStatus("error", payload.message, {
        errorCode: payload.code ?? "unknown_voice_error",
        fallbackMode: payload.fallbackMode ?? voiceRuntimeStatus.fallbackMode ?? "push_to_talk"
      });
      pushLog("transcript_failed", `${payload.code ?? "unknown_voice_error"}: ${payload.message}`, "voice");
      if (payload.fallbackMode) {
        pushLog("voice_fallback", `Voice fallback etkin: ${payload.fallbackMode}`);
      }
    }
    if (payload.kind === "wake_word_detected") {
      logger.info("voice", "wake_word_detected", payload);
      updateVoiceRuntimeStatus("wake_detected", payload.message, {
        mode: "wake_word",
        errorCode: null
      });
      pushLog("wake_word_detected", payload.message, "wake_word");
    }

    return { ok: true };
  });

  ipcMain.handle("agent:report-tts-event", (_, payload: {
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
  }) => {
    logger.info("tts", payload.kind, payload);
    pushLog(payload.kind, payload.reason ? `${payload.reason}: ${payload.message}` : payload.message, "system_tts");
    return { ok: true };
  });

  ipcMain.handle("agent:report-approval-expired", (_, payload: { message: string }) => {
    clearPendingApprovalContext();
    pushLog("approval_expired", payload.message);
    return { ok: true };
  });

  ipcMain.handle("agent:queue-quick-task", (_, request: QuickTaskRequest) => {
    const settings = getSettings();
    const result = routeQuickTask(request, settings);
    const previews = result.actions.map((action) => ({
      action,
      preview: previewAction(
        action,
        {
          allowedDomains: settings.allowedDomains,
          allowedFolders: settings.allowedFolders,
          allowedApps: settings.allowedApps,
          allowedCommands: settings.allowedCommands
        },
        settings.defaultMode
      )
    }));

    return {
      result,
      previews,
      activity: activityLog.slice(0, 30),
      pendingApproval: getActivePendingApprovalContext()
    };
  });

  ipcMain.handle("agent:resolve-approval", async (_, decision: ApprovalDecision & { action?: ActionPlan }) => {
    return resolveApprovalDecision(decision, "text");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
