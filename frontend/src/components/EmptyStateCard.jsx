function EmptyStateCard({
  title = 'Bu bölgede talep yok',
  description,
  primaryLabel = 'Km artır',
  secondaryLabel = 'Talep oluştur',
  onPrimary,
  onSecondary
}) {
  return (
    <div className="card empty-state-card">
      <div className="empty-icon">📭</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      <div className="empty-actions">
        {secondaryLabel && onSecondary ? (
          <button type="button" className="ghost-btn" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
        {primaryLabel && onPrimary ? (
          <button type="button" className="primary-btn" onClick={onPrimary}>
            {primaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default EmptyStateCard;
