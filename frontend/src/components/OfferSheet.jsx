import { useEffect, useMemo, useState } from 'react';
import ReusableBottomSheet from './ReusableBottomSheet';

const formatPrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return new Intl.NumberFormat('tr-TR').format(numeric);
};

const parsePrice = (value) => {
  if (!value) {
    return 0;
  }
  const digits = String(value).replace(/[^0-9]/g, '');
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : 0;
};

function OfferSheet({
  open,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
  onWithdraw,
  submitting,
  isAuction
}) {
  const initialState = useMemo(
    () => ({
      priceText: formatPrice(initialValues?.price),
      message: initialValues?.message ?? ''
    }),
    [initialValues]
  );

  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [priceValue, setPriceValue] = useState(parsePrice(initialState.priceText));

  useEffect(() => {
    if (open) {
      setForm(initialState);
      setError('');
      setPriceValue(parsePrice(initialState.priceText));
    }
  }, [initialState, open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'priceText') {
      const numeric = parsePrice(value);
      if (numeric > 999999999) {
        return;
      }
      setForm((prev) => ({ ...prev, priceText: formatPrice(numeric) }));
      setPriceValue(numeric);
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const price = priceValue;
    const fallbackDeliveryTime = Number(initialValues?.deliveryTime ?? 1);
    if (!price || price <= 0) {
      setError('Gecerli fiyat girin.');
      return;
    }
    setError('');
    onSubmit?.({
      price,
      message: form.message,
      deliveryTime: Number.isFinite(fallbackDeliveryTime) && fallbackDeliveryTime > 0 ? fallbackDeliveryTime : 1,
      quantity: initialValues?.quantity ?? undefined
    });
  };

  const title = mode === 'edit' ? 'Teklifi Duzenle' : 'Teklif Ver';
  const primaryLabel = mode === 'edit' ? 'Kaydet' : 'Teklifi Gonder';
  const isValid = priceValue > 0;

  return (
    <ReusableBottomSheet
      open={open}
      onClose={onClose}
      title={title}
      contentClassName="offer-sheet"
      headerRight={
        <button type="button" className="offer-sheet-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
      }
    >
      <form className="offer-sheet-form" onSubmit={handleSubmit}>
        {isAuction ? (
          <div className="rfq-sub">Acik arttirma: Yeni teklif mevcut en iyi tekliften dusuk olmali.</div>
        ) : null}
        <label className="offer-field">
          <span>Fiyat</span>
          <div className={`offer-input ${!isValid && error ? 'is-error' : ''}`}>
            <input
              type="text"
              name="priceText"
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="Orn: 1.000"
              value={form.priceText}
              onChange={handleChange}
              disabled={submitting}
              autoComplete="off"
            />
            <span className="offer-input-suffix">₺</span>
          </div>
          {!isValid ? <span className="offer-field-error">Fiyat zorunlu</span> : null}
        </label>
        <label className="offer-field">
          <span>Aciklama</span>
          <textarea
            name="message"
            rows={3}
            placeholder="Kisa bir aciklama yaz..."
            value={form.message}
            onChange={handleChange}
            disabled={submitting}
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <div className="offer-sheet-footer">
          <div className="offer-sheet-actions">
            <button type="submit" className="primary-btn" disabled={submitting || !isValid}>
              {submitting ? 'Gonderiliyor...' : primaryLabel}
            </button>
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              Vazgec
            </button>
          </div>
        </div>
        {onWithdraw && mode === 'edit' ? (
          <button type="button" className="danger-btn" onClick={onWithdraw} disabled={submitting}>
            Teklifi geri cek
          </button>
        ) : null}
      </form>
    </ReusableBottomSheet>
  );
}

export default OfferSheet;
