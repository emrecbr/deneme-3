import type { ActionPlan } from "@jarvis/core";

export interface SecurityPolicy {
  allowedDomains: string[];
  allowedFolders: string[];
  allowedApps: string[];
  allowedCommands: string[];
}

function normalizeUrlHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isFolderAllowed(folderPath: string, allowedFolders: string[]): boolean {
  const normalized = folderPath.toLowerCase();
  return allowedFolders.some((allowedFolder) => normalized.startsWith(allowedFolder.toLowerCase()));
}

function isUrlAllowed(rawUrl: string, allowedDomains: string[]): boolean {
  const hostname = normalizeUrlHost(rawUrl);
  if (!hostname) {
    return false;
  }

  return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isAppAllowed(appIdentifier: string, allowedApps: string[]): boolean {
  const normalized = appIdentifier.toLowerCase();
  return allowedApps.some((allowedApp) => normalized === allowedApp.toLowerCase());
}

function isCommandAllowed(command: string, allowedCommands: string[]): boolean {
  const normalized = command.trim().toLowerCase();
  return allowedCommands.some((allowedCommand) => normalized === allowedCommand.toLowerCase());
}

export function validateActionAgainstPolicy(action: ActionPlan, policy: SecurityPolicy): string | null {
  if (action.type === "open_folder" || action.type === "open_project" || action.type === "search_files" || action.type === "create_note") {
    const targetPath = action.args.path || action.args.rootPath;
    if (!targetPath) {
      return "Folder tabanli action hedefi eksik.";
    }

    return isFolderAllowed(targetPath, policy.allowedFolders)
      ? null
      : "Bu klasor allowlist disinda.";
  }

  if (action.type === "open_url") {
    if (!action.args.url) {
      return "URL action adresi eksik.";
    }

    return isUrlAllowed(action.args.url, policy.allowedDomains)
      ? null
      : "Bu alan adi allowlist disinda.";
  }

  if (action.type === "open_app") {
    if (!action.args.appIdentifier) {
      return "Uygulama tanimi eksik.";
    }

    return isAppAllowed(action.args.appIdentifier, policy.allowedApps)
      ? null
      : "Bu uygulama allowlist disinda.";
  }

  if (action.type === "run_safe_command") {
    if (!action.args.command) {
      return "Komut tanimi eksik.";
    }

    return isCommandAllowed(action.args.command, policy.allowedCommands)
      ? null
      : "Bu komut allowlist disinda.";
  }

  return null;
}
