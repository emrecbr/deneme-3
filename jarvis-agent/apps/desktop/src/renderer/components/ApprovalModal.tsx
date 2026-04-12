import type { ActionPlan, CommandResult, PendingApprovalContext } from "@jarvis/core";

interface Props {
  action: ActionPlan | null;
  result: CommandResult | null;
  pendingApproval: PendingApprovalContext | null;
  actionState?: {
    state: "pending-approval" | "rejected" | "executed" | "failed";
    message: string;
  };
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function ApprovalModal({ action, result, pendingApproval, actionState, onApprove, onReject, onClose }: Props) {
  if (!action || !result) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">Approval Required</p>
        <h2>{action.label}</h2>
        <p>{result.plan.previewText}</p>

        <dl className="detail-grid">
          <div>
            <dt>Komut</dt>
            <dd>{result.plan.originalCommand}</dd>
          </div>
          <div>
            <dt>Intent</dt>
            <dd>{result.plan.detectedIntent}</dd>
          </div>
          <div>
            <dt>Hedef</dt>
            <dd>{result.plan.target?.label ?? action.label}</dd>
          </div>
          <div>
            <dt>Risk</dt>
            <dd>{action.riskLevel}</dd>
          </div>
          <div>
            <dt>Aksiyon</dt>
            <dd>{action.type}</dd>
          </div>
          <div>
            <dt>Durum</dt>
            <dd>{actionState?.state ?? "pending-approval"}</dd>
          </div>
        </dl>

        <article className="summary-card">
          <h3>Planlanan aksiyonlar</h3>
          {result.plan.proposedActions.map((plannedAction) => (
            <p key={plannedAction.id} className="modal-plan-line">
              {plannedAction.label}: {plannedAction.reason}
            </p>
          ))}
        </article>

        <article className="summary-card">
          <h3>Son sonuc</h3>
          <p>{actionState?.message ?? "Henuz yurutulmedi."}</p>
        </article>

        {pendingApproval ? (
          <article className="summary-card">
            <h3>Sesli onay</h3>
            <p>Onay bekleniyor. Sesli olarak "onayla" veya "iptal et" diyebilirsiniz.</p>
            <p className="modal-plan-line">Bekleyen ozet: {pendingApproval.pendingActionSummary}</p>
          </article>
        ) : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onReject}>
            Reject
          </button>
          <button className="primary-button" onClick={onApprove}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
