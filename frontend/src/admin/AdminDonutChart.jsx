const CHART_SIZE = 160;
const STROKE_WIDTH = 18;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DEFAULT_RENDER_SIZE = 200;
const MIN_RENDER_SIZE = 160;
const MAX_RENDER_SIZE = 220;

const clampRenderSize = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RENDER_SIZE;
  return Math.min(Math.max(parsed, MIN_RENDER_SIZE), MAX_RENDER_SIZE);
};

const formatPercent = (value, total) => {
  if (!Number.isFinite(total) || total <= 0) return '0%';
  return `${Math.round((Number(value) / total) * 100)}%`;
};

export default function AdminDonutChart({
  title,
  subtitle,
  segments = [],
  totalLabel = 'Toplam',
  loading = false,
  error = '',
  emptyMessage = 'Grafik verisi bulunamadi.',
  onRetry,
  note,
  size = DEFAULT_RENDER_SIZE
}) {
  const renderSize = clampRenderSize(size);
  const chartStyle = {
    '--admin-donut-size': `${renderSize}px`
  };

  const normalizedSegments = segments
    .map((segment) => ({
      ...segment,
      value: Number(segment?.value || 0)
    }))
    .filter((segment) => segment.value > 0);

  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);

  let progressOffset = 0;
  const chartSegments = normalizedSegments.map((segment) => {
    const dashLength = (segment.value / total) * CIRCUMFERENCE;
    const currentOffset = progressOffset;
    progressOffset += dashLength;

    return {
      ...segment,
      dashArray: `${dashLength} ${CIRCUMFERENCE - dashLength}`,
      dashOffset: -currentOffset
    };
  });

  return (
    <article className="admin-panel admin-chart-card">
      <div className="admin-panel-body admin-chart-card__body">
        <div className="admin-chart-card__header">
          <div>
            <h3 className="admin-panel-title">{title}</h3>
            {subtitle ? <p className="admin-chart-card__subtitle">{subtitle}</p> : null}
          </div>
        </div>

        {loading ? (
          <div className="admin-chart-card__state">
            <div className="admin-empty">Grafik verisi yukleniyor...</div>
          </div>
        ) : error ? (
          <div className="admin-chart-card__state">
            <div className="admin-warning">
              <div>{error}</div>
              {onRetry ? (
                <div className="admin-action-row" style={{ marginTop: 12 }}>
                  <button type="button" className="admin-btn" onClick={onRetry}>
                    Tekrar dene
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : total <= 0 ? (
          <div className="admin-chart-card__state">
            <div className="admin-empty">{emptyMessage}</div>
          </div>
        ) : (
          <div className="admin-chart-card__content">
            <div className="admin-chart-card__slot">
              <div className="admin-donut-chart" aria-hidden="true" style={chartStyle}>
                <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} className="admin-donut-chart__svg">
                  <circle
                    className="admin-donut-chart__track"
                    cx={CHART_SIZE / 2}
                    cy={CHART_SIZE / 2}
                    r={RADIUS}
                    strokeWidth={STROKE_WIDTH}
                  />
                  {chartSegments.map((segment) => (
                    <circle
                      key={segment.label}
                      className="admin-donut-chart__segment"
                      cx={CHART_SIZE / 2}
                      cy={CHART_SIZE / 2}
                      r={RADIUS}
                      strokeWidth={STROKE_WIDTH}
                      stroke={segment.color}
                      strokeDasharray={segment.dashArray}
                      strokeDashoffset={segment.dashOffset}
                    />
                  ))}
                </svg>
                <div className="admin-donut-chart__center">
                  <strong>{total}</strong>
                  <span>{totalLabel}</span>
                </div>
              </div>
            </div>

            <ul className="admin-chart-legend">
              {chartSegments.map((segment) => (
                <li key={segment.label} className="admin-chart-legend__item">
                  <span className="admin-chart-legend__swatch" style={{ backgroundColor: segment.color }} />
                  <div className="admin-chart-legend__text">
                    <strong>{segment.label}</strong>
                    <span>
                      {segment.value} · {formatPercent(segment.value, total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {note ? <div className="admin-chart-card__note">{note}</div> : null}
      </div>
    </article>
  );
}
