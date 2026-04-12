import type { ActionPlan, CommandResult, PendingApprovalContext } from "@jarvis/core";

interface ActionPreview {
  action: ActionPlan;
  preview: {
    allowed: boolean;
    mode: "dry-run" | "approval";
    message: string;
  };
}

interface Props {
  result: CommandResult | null;
  previews: ActionPreview[];
  pendingApproval: PendingApprovalContext | null;
  actionStates: Record<string, { state: "pending-approval" | "rejected" | "executed" | "failed"; message: string }>;
  onApproveRequest: (action: ActionPlan) => void;
}

export function TaskBoard({ result, previews, pendingApproval, actionStates, onApproveRequest }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Execution Preview</p>
          <h2>Plan, onay ve sonuc</h2>
        </div>
      </div>

      {result ? (
        <div className="task-board">
          <article className="summary-card">
            <h3>Plan ozeti</h3>
            <p>{result.plan.previewText}</p>
            <span className="muted">Komut: {result.plan.originalCommand}</span>
            <span className="muted">Intent: {result.plan.detectedIntent}</span>
            <span className="muted">Hedef: {result.plan.target?.label ?? "Genel agent"}</span>
            <span className="muted">Risk: {result.plan.riskLevel} | Approval: {result.plan.requiresApproval ? "zorunlu" : "yok"}</span>
            {pendingApproval ? (
              <span className="muted">
                Onay bekleniyor | Sesli olarak "onayla", "iptal et" veya "neyi onayliyorum" diyebilirsiniz.
              </span>
            ) : null}
          </article>

          {result.wizard && (
            <article className="summary-card">
              <h3>{result.wizard.title}</h3>
              <p>{result.wizard.summary}</p>
              <ul className="step-list">
                {result.wizard.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          )}

          <div className="action-list">
            {previews.length ? (
              previews.map(({ action, preview }) => (
                <article key={action.id} className="action-card">
                  <div>
                    <h3>{action.label}</h3>
                    <p>{action.reason}</p>
                    <span className="muted">{action.type} | {preview.message}</span>
                    <span className="muted">
                      Approval state: {actionStates[action.id]?.state ?? "pending-approval"} | Execution result: {actionStates[action.id]?.message ?? "Onay bekleniyor."}
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => onApproveRequest(action)}
                    disabled={!preview.allowed || actionStates[action.id]?.state === "executed"}
                  >
                    {actionStates[action.id]?.state === "executed" ? "Done" : "Review"}
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-state">Bu komut icin uygulanabilir aksiyon uretilmedi.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="empty-state">
          Jarvis burada parsed intent, action plan, approval state ve execution sonucunu gosterecek.
        </p>
      )}
    </section>
  );
}
