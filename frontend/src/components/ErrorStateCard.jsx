function ErrorStateCard({
  title = 'Bağlantı sorunu',
  message = 'Talepler yüklenemedi. İnternet bağlantısını kontrol edip tekrar deneyin.',
  onRetry,
  variant = 'app'
}) {
  return (
    <div className={`card error-state-card ${variant === 'web' ? 'error-state-card--web' : ''}`}>
      <div className="error-icon">Uyarı</div>
      <h3>{title}</h3>
      <p>{message}</p>
      <button type="button" className="ghost-btn" onClick={onRetry}>
        Tekrar dene
      </button>
    </div>
  );
}

export default ErrorStateCard;
