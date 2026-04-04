function LocationPermissionModal({
  open,
  denied = false,
  loading = false,
  warningMessage = '',
  onManualSelect,
  onEnableLocation,
  onClose
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="ux-modal-overlay">
      <div className="ux-modal-card">
        <h2>Konum izni gerekli</h2>
        <p>
          Yakın talepleri gösterebilmek için konum bilgisine ihtiyacımız var. Konumu aktif edebilir veya şehri manuel
          seçerek devam edebilirsin.
        </p>

        <div className="ux-modal-actions">
          <button type="button" className="primary-btn" onClick={onEnableLocation} disabled={loading}>
            {loading ? 'Konum alınıyor...' : 'Konumumu Aktif Et'}
          </button>
          <button type="button" className="secondary-btn" onClick={onManualSelect}>
            Manuel Seç
          </button>
        </div>

        {warningMessage ? <div className="error">{warningMessage}</div> : null}

        {denied ? (
          <div className="modal-hint">
            <p>Konum izni kapalı. Tarayıcı ayarlarından izin verip tekrar deneyebilirsin.</p>
            <ul>
              <li>Chrome: kilit ikonu → Site settings → Location → Allow</li>
              <li>iOS Safari: Ayarlar → Safari → Konum → Sor / İzin ver</li>
            </ul>
          </div>
        ) : null}

        <button type="button" className="link-btn" onClick={onClose}>
          Şimdilik geç
        </button>
      </div>
    </div>
  );
}

export default LocationPermissionModal;
