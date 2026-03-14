export default function LoadingOverlay({ visible }) {
  return (
    <div className={`loading-overlay ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <div className="loading-overlay-card" role="status" aria-live="polite">
        <div className="loading-overlay-spinner" aria-hidden="true" />
        <div className="loading-overlay-text">Yükleniyor...</div>
      </div>
    </div>
  );
}
