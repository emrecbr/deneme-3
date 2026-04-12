import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

let logFilePath = path.join(os.tmpdir(), "jarvis-agent-main.log");
let stdoutBroken = false;
let stderrBroken = false;
let processHandlersInstalled = false;

function serializePart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (part instanceof Error) {
    return `${part.name}: ${part.message}\n${part.stack ?? ""}`.trim();
  }

  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

function safeWriteToStream(level: LogLevel, message: string): void {
  const stream = level === "error" ? process.stderr : process.stdout;
  const line = `${message}\n`;

  try {
    if (
      !stream ||
      stream.destroyed ||
      stream.writableEnded ||
      (level === "error" ? stderrBroken : stdoutBroken)
    ) {
      return;
    }

    stream.write(line);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "EPIPE") {
      if (level === "error") {
        stderrBroken = true;
      } else {
        stdoutBroken = true;
      }
      return;
    }
  }
}

function safeAppendToFile(message: string): void {
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.appendFileSync(logFilePath, `${message}\n`, "utf8");
  } catch {
    // File logging best effort; intentionally ignore.
  }
}

function write(level: LogLevel, scope: string, parts: unknown[]): void {
  const rendered = parts.map(serializePart).join(" ");
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${rendered}`;
  safeAppendToFile(line);
  if (process.env.NODE_ENV !== "production") {
    safeWriteToStream(level, line);
  }
}

export function configureLogger(targetPath: string): void {
  logFilePath = targetPath;
  safeAppendToFile(`[${new Date().toISOString()}] [INFO] [logger] configured ${targetPath}`);
}

export const logger = {
  info(scope: string, ...parts: unknown[]) {
    write("info", scope, parts);
  },
  warn(scope: string, ...parts: unknown[]) {
    write("warn", scope, parts);
  },
  error(scope: string, ...parts: unknown[]) {
    write("error", scope, parts);
  }
};

export function installProcessErrorHandlers(): void {
  if (processHandlersInstalled) {
    return;
  }
  processHandlersInstalled = true;

  process.setUncaughtExceptionCaptureCallback((error) => {
    if ((error as NodeJS.ErrnoException).code === "EPIPE") {
      stdoutBroken = true;
      stderrBroken = true;
      safeAppendToFile(`[${new Date().toISOString()}] [WARN] [process] Captured EPIPE before Electron dialog. ${error.message}`);
      return;
    }

    safeAppendToFile(
      `[${new Date().toISOString()}] [ERROR] [process] Captured uncaught exception before Electron dialog. ${serializePart(error)}`
    );
  });

  process.on("uncaughtException", (error) => {
    if ((error as NodeJS.ErrnoException).code === "EPIPE") {
      stdoutBroken = true;
      stderrBroken = true;
      safeAppendToFile(`[${new Date().toISOString()}] [WARN] [process] Suppressed EPIPE from main process logging. ${error.message}`);
      return;
    }

    logger.error("process", "Uncaught exception in main process.", error);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("process", "Unhandled rejection in main process.", reason);
  });

  process.stdout?.on?.("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") {
      stdoutBroken = true;
      safeAppendToFile(`[${new Date().toISOString()}] [WARN] [process] Suppressed stdout EPIPE.`);
    }
  });

  process.stderr?.on?.("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") {
      stderrBroken = true;
      safeAppendToFile(`[${new Date().toISOString()}] [WARN] [process] Suppressed stderr EPIPE.`);
    }
  });
}
