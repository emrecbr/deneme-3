import type { ActivityLogEntry, AgentSettings, QuickTaskRequest } from "@jarvis/core";

interface Props {
  settings: AgentSettings | null;
  activity: ActivityLogEntry[];
  onQuickTask: (taskId: QuickTaskRequest["taskId"]) => Promise<void>;
}

const quickTasks: Array<{
  id: string;
  taskId: QuickTaskRequest["taskId"];
  group: string;
  label: string;
  reason: string;
}> = [
  { id: "qt-talepet", taskId: "open-talepet-folder", group: "Klasorler", label: "Talepet project", reason: "Yonetilen proje klasorunu acar." },
  { id: "qt-downloads", taskId: "open-downloads-folder", group: "Klasorler", label: "Downloads", reason: "Indirilen dosyalar klasorunu acar." },
  { id: "qt-vscode", taskId: "open-vscode", group: "Uygulamalar", label: "VS Code", reason: "Kod editorunu baslatir." },
  { id: "qt-chrome", taskId: "open-chrome", group: "Uygulamalar", label: "Chrome", reason: "Tarayiciyi baslatir." },
  { id: "qt-render", taskId: "open-render-dashboard", group: "Web panelleri", label: "Render dashboard", reason: "Hosting panelini acar." },
  { id: "qt-cloudflare", taskId: "open-cloudflare", group: "Web panelleri", label: "Cloudflare", reason: "DNS ve domain panelini acar." },
  { id: "qt-dns", taskId: "start-dns-wizard", group: "Wizard'lar", label: "DNS wizard", reason: "DNS degisikligi adimlarini planlar." },
  { id: "qt-domain", taskId: "start-domain-wizard", group: "Wizard'lar", label: "Domain baglama", reason: "Custom domain akisini baslatir." }
];

export function ScenarioPanel({ settings, activity, onQuickTask }: Props) {
  const groups = [...new Set(quickTasks.map((task) => task.group))];
  const recentTargets = settings?.targets.filter((target) => target.enabled).slice(0, 8) ?? [];

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Managed Targets</p>
            <h2>Yonetilen hedefler</h2>
          </div>
        </div>

        <div className="target-list">
          {recentTargets.map((target) => (
            <article key={target.id} className="scenario-card">
              <h3>{target.label}</h3>
              <p>{target.description}</p>
              <span className="muted">{target.type} · {target.tags.join(", ")}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Quick Tasks</p>
            <h2>Genel gorev gruplari</h2>
          </div>
        </div>

        <div className="task-group-list">
          {groups.map((group) => (
            <div key={group} className="task-group">
              <h3>{group}</h3>
              <div className="action-list">
                {quickTasks.filter((task) => task.group === group).map((task) => (
                  <article key={task.id} className="action-card">
                    <div>
                      <h3>{task.label}</h3>
                      <p>{task.reason}</p>
                    </div>
                    <button className="secondary-button" onClick={() => onQuickTask(task.taskId)}>
                      Queue
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Audit Trail</p>
            <h2>Gercek olaylar</h2>
          </div>
        </div>

        <div className="log-list">
          {activity.length ? (
            activity.map((entry) => (
              <article key={entry.id} className={`log-entry log-${entry.kind}`}>
                <strong>{entry.kind}</strong>
                <p>{entry.message}</p>
                <span>{new Date(entry.timestamp).toLocaleTimeString()} · {entry.source ?? "system"}</span>
              </article>
            ))
          ) : (
            <p className="empty-state">Henuz olay kaydi yok.</p>
          )}
        </div>
      </section>
    </>
  );
}
