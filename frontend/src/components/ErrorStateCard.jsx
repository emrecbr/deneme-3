function ErrorStateCard({
  title = 'Bağlantı sorunu',
  message = 'Talepler yüklenemedi. İnterneti kontrol edip tekrar dene.',
  onRetry
}) {
  return (
    <div className="card error-state-card">
      <div className="error-icon">⚠️</div>
      <h3>{title}</h3>
      <p>{message}</p>
      <button type="button" className="ghost-btn" onClick={onRetry}>
        Tekrar dene
      </button>
    </div>
  );
}

export default ErrorStateCard;
