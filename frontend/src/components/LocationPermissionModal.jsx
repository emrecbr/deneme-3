function LocationPermissionModal({
  open,
  denied = false,
  loading = false,
  warningMessage = '',
  cityOptions = [],
  selectedCity = '',
  onSelectCity,
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
        </div>

        {warningMessage ? <div className="error">{warningMessage}</div> : null}

        {denied ? (
          <div className="form-group">
            <label htmlFor="manualCity">Manuel Sehir Secimi</label>
            <select id="manualCity" value={selectedCity} onChange={(event) => onSelectCity(event.target.value)}>
              <option value="">Sehir secin</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
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
