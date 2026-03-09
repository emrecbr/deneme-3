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
          Yakin talepleri gosterebilmek icin konum bilgisine ihtiyacimiz var. Konumu aktif edebilir veya sehri manuel
          secerek devam edebilirsin.
        </p>

        <div className="ux-modal-actions">
          <button type="button" className="primary-btn" onClick={onEnableLocation} disabled={loading}>
            {loading ? 'Konum aliniyor...' : 'Konumumu Aktif Et'}
          </button>
          <button type="button" className="secondary-btn" onClick={onManualSelect}>
            Manuel Sec
          </button>
        </div>

        {warningMessage ? <div className="error">{warningMessage}</div> : null}

        {denied ? (
          <div className="modal-hint">
            <p>Konum izni kapali. Tarayici ayarlarindan izin verip tekrar deneyebilirsin.</p>
            <ul>
              <li>Chrome: kilit ikonu → Site settings → Location → Allow</li>
              <li>iOS Safari: Ayarlar → Safari → Konum → Sor / Izin ver</li>
            </ul>
          </div>
        ) : null}

        <button type="button" className="link-btn" onClick={onClose}>
          Simdilik gec
        </button>
      </div>
    </div>
  );
}

export default LocationPermissionModal;
