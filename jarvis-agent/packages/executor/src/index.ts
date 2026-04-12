import type { ActionPlan } from "@jarvis/core";
import { validateActionAgainstPolicy, type SecurityPolicy } from "@jarvis/security";

export interface ExecutionPreview {
  allowed: boolean;
  mode: "dry-run" | "approval";
  message: string;
}

export function previewAction(
  action: ActionPlan,
  policy: SecurityPolicy,
  mode: "dry-run" | "approval"
): ExecutionPreview {
  const validationError = validateActionAgainstPolicy(action, policy);

  if (validationError) {
    return {
      allowed: false,
      mode,
      message: validationError
    };
  }

  return {
    allowed: true,
    mode,
    message: mode === "dry-run" ? "Dry-run olarak hazir." : "Onay sonrasi uygulanabilir."
  };
}
