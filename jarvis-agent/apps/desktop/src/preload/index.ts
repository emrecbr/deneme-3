import { contextBridge, ipcRenderer } from "electron";
import type { ActionPlan, ApprovalDecision, QuickTaskRequest } from "@jarvis/core";
import type { JarvisBridge } from "../shared/bridge";

console.info("[jarvis-agent] preload loaded");

const api: JarvisBridge = {
  getBootstrap: () => ipcRenderer.invoke("agent:get-bootstrap"),
  submitCommand: (transcript: string) => ipcRenderer.invoke("agent:submit-command", transcript),
  submitVoiceCommand: (payload) => ipcRenderer.invoke("agent:submit-voice-command", payload),
  queueQuickTask: (request: QuickTaskRequest) => ipcRenderer.invoke("agent:queue-quick-task", request),
  startVoiceCapture: () => ipcRenderer.invoke("agent:start-voice-capture"),
  stopVoiceCapture: () => ipcRenderer.invoke("agent:stop-voice-capture"),
  transcribeAudio: (payload) => ipcRenderer.invoke("agent:transcribe-audio", payload),
  getVoiceStatus: () => ipcRenderer.invoke("agent:get-voice-status"),
  reportVoiceEvent: (payload) => ipcRenderer.invoke("agent:report-voice-event", payload),
  reportTtsEvent: (payload) => ipcRenderer.invoke("agent:report-tts-event", payload),
  reportApprovalExpired: (payload) => ipcRenderer.invoke("agent:report-approval-expired", payload),
  resolveApproval: (decision: ApprovalDecision & { action?: ActionPlan }) =>
    ipcRenderer.invoke("agent:resolve-approval", decision)
};

contextBridge.exposeInMainWorld("jarvis", api);
console.info("[jarvis-agent] bridge exposed", { name: "jarvis" });
