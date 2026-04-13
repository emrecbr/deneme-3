function EmptyStateCard({
  title = 'Bu bolgede talep yok',
  description,
  primaryLabel = 'Km artir',
  secondaryLabel = 'Talep olustur',
  onPrimary,
  onSecondary,
  variant = 'app'
}) {
  return (
    <div className={`card empty-state-card ${variant === 'web' ? 'empty-state-card--web' : ''}`}>
      <div className="empty-icon">Liste bos</div>
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
