import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig } from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import ReusableBottomSheet from '../components/ReusableBottomSheet';
import { useAuth } from '../context/AuthContext';

const formatPhone = (digits) => {
  const value = String(digits || '').slice(0, 10);
  if (!value) {
    return '';
  }
  const part1 = value.slice(0, 3);
  const part2 = value.slice(3, 6);
  const part3 = value.slice(6, 8);
  const part4 = value.slice(8, 10);
  return [part1, part2, part3, part4].filter(Boolean).join(' ');
};

const normalizePhoneInput = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) {
    digits = digits.slice(0, 10);
  }
  return digits;
};

const passwordPolicy = (value) => {
  const text = String(value || '');
  return text.length >= 3 && /[A-Z]/.test(text) && /[0-9]/.test(text) && /[^A-Za-z0-9]/.test(text);
};

const formatCardNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiry = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const formatCvv = (value) => String(value || '').replace(/\D/g, '').slice(0, 4);

function ProfileAccount() {
  const { checkAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneDigits: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [listingQuota, setListingQuota] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    name: '',
    number: '',
    expiry: '',
    cvv: ''
  });
  const [paymentFormError, setPaymentFormError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');
  const [alertsSheetOpen, setAlertsSheetOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({
    type: 'category',
    categoryId: '',
    cityId: '',
    districtId: '',
    keyword: ''
  });
  const [alertFormLoading, setAlertFormLoading] = useState(false);
  const [alertFormError, setAlertFormError] = useState('');
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const showToast = (message) => {
    if (!message) {
      return;
    }
    setToast(message);
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    if (location.state?.openPassword) {
      setPasswordOpen(true);
    }
    if (location.state?.openAlerts) {
      setAlertsSheetOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!passwordOpen) {
      return;
    }
    api.get('/auth/me').catch((error) => {
      if (error?.response?.status === 401) {
        window.location.href = '/login';
      }
    });
  }, [passwordOpen]);

  useEffect(() => {
    if (!paymentSheetOpen) {
      return;
    }
    setPaymentForm({
      name: '',
      number: '',
      expiry: '',
      cvv: ''
    });
    setPaymentFormError('');
  }, [paymentSheetOpen]);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);
        const [response, billingRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/billing/me', buildProtectedRequestConfig())
        ]);
        const payload = response.data?.data || {};
        const billingPayload = billingRes.data?.data || {};
        const phoneValue = String(payload.phone || '');
        const phoneDigits = phoneValue.startsWith('+90') ? phoneValue.slice(3) : normalizePhoneInput(phoneValue);
        setForm({
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          email: payload.email || '',
          phoneDigits
        });
        setListingQuota(payload.listingQuota || null);
        setPaymentMethod(payload.paymentMethod || null);
        setPaymentProvider(payload.paymentProvider || '');
        setBillingSummary(billingPayload);
        setError('');
        const methodsRes = await api.get('/users/me/payment-methods');
        setPaymentMethods(methodsRes.data?.items || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Bilgiler alinamadi.');
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  useEffect(() => {
    if (!alertsSheetOpen) {
      return;
    }
    let active = true;
    const fetchAlerts = async () => {
      try {
        setAlertsLoading(true);
        const response = await api.get('/me/alerts');
        if (!active) return;
        setAlerts(response.data?.items || []);
        setAlertsError('');
      } catch (requestError) {
        if (!active) return;
        setAlertsError(requestError.response?.data?.message || 'Takip listesi alinamadi.');
      } finally {
        if (active) setAlertsLoading(false);
      }
    };
    const fetchMeta = async () => {
      try {
        const [categoryRes, cityRes] = await Promise.all([
          api.get('/categories'),
          api.get('/location/cities?limit=200')
        ]);
        if (!active) return;
        setCategories(categoryRes.data?.data || []);
        setCities(cityRes.data?.items || []);
      } catch (_error) {
        // ignore
      }
    };
    fetchAlerts();
    fetchMeta();
    return () => {
      active = false;
    };
  }, [alertsSheetOpen]);

  useEffect(() => {
    if (!alertsSheetOpen) {
      return;
    }
    if (!alertForm.cityId) {
      setDistricts([]);
      return;
    }
    let active = true;
    const fetchDistricts = async () => {
      try {
        const response = await api.get(`/location/districts?cityId=${alertForm.cityId}&limit=200`);
        if (!active) return;
        setDistricts(response.data?.data || []);
      } catch (_error) {
        if (!active) return;
        setDistricts([]);
      }
    };
    fetchDistricts();
    return () => {
      active = false;
    };
  }, [alertForm.cityId, alertsSheetOpen]);

  const phoneDisplay = useMemo(() => formatPhone(form.phoneDigits), [form.phoneDigits]);
  const phoneError =
    form.phoneDigits && form.phoneDigits.length !== 10 ? 'Telefon 10 hane olmalı (5xx...)' : '';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (event) => {
    const digits = normalizePhoneInput(event.target.value);
    setForm((prev) => ({ ...prev, phoneDigits: digits }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');

    if (phoneError) {
      setError(phoneError);
      showToast(phoneError);
      return;
    }

    try {
      setSaving(true);
      const response = await api.patch('/users/me', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phoneDigits
      });
      if (response.data?.data) {
        setForm((prev) => ({
          ...prev,
          firstName: response.data.data.firstName || prev.firstName,
          lastName: response.data.data.lastName || prev.lastName,
          email: response.data.data.email || prev.email,
          phoneDigits: response.data.data.phone ? response.data.data.phone.replace('+90', '') : prev.phoneDigits
        }));
      }
      showToast('Bilgilerin güncellendi');
      await checkAuth();
    } catch (requestError) {
      const status = requestError.response?.status;
      const message = requestError.response?.data?.message || 'Güncelleme başarısız';
      if (!requestError.response) {
        setError('Sunucuya baglanilamadi');
        showToast('Sunucuya bağlanılamadı');
      } else if (status === 409) {
        setError('Bu e-posta zaten kullaniliyor');
        showToast('Bu e-posta zaten kullanılıyor');
      } else {
        setError(message);
        showToast(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tüm alanları doldur');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni sifreler eslesmiyor');
      return;
    }
    if (!passwordPolicy(newPassword)) {
      setPasswordError('Şifre en az 3 karakter, 1 büyük harf, 1 sayı ve 1 özel karakter içermeli');
      return;
    }

    try {
      setPasswordLoading(true);
      await api.post('/users/me/change-password', {
        currentPassword,
        newPassword
      });
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Şifre güncellendi');
    } catch (requestError) {
      const code = requestError.response?.data?.code;
      if (code === 'BAD_PASSWORD') {
        setPasswordError('Mevcut sifre yanlis');
      } else if (code === 'WEAK_PASSWORD') {
        setPasswordError('Şifre kurallarını sağlamıyor');
      } else if (code === 'SAME_PASSWORD') {
        setPasswordError('Yeni sifre eski sifre ile ayni olamaz');
      } else if (!requestError.response) {
        setPasswordError('Sunucuya baglanilamadi');
      } else {
        setPasswordError(requestError.response?.data?.message || 'Şifre güncellenemedi');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExtraListingPayment = async () => {
    try {
      setPaymentLoading(true);
      const response = await api.post('/billing/listing-extra/checkout', {}, buildProtectedRequestConfig());
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Ödeme başlatılamadı.';
      setError(message);
      showToast(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    setPaymentError('');
    setPaymentFormError('');
    const rawNumber = paymentForm.number.replace(/\s/g, '');
    const expiryParts = paymentForm.expiry.split('/');
    const expMonth = Number(expiryParts[0] || 0);
    const expYear = Number(expiryParts[1] || 0);
    if (paymentForm.name.trim().length < 2) {
      setPaymentFormError('Kart üzerindeki isim en az 2 karakter olmalı.');
      return;
    }
    if (rawNumber.length < 12) {
      setPaymentFormError('Kart numarası geçersiz.');
      return;
    }
    if (!expMonth || expMonth < 1 || expMonth > 12 || expiryParts[1]?.length !== 2) {
      setPaymentFormError('Son kullanma tarihi geçersiz.');
      return;
    }
    if (paymentForm.cvv.length < 3) {
      setPaymentFormError('CVV geçersiz.');
      return;
    }
    try {
      setPaymentLoading(true);
      const response = await api.post('/billing/payment-method/checkout', {}, buildProtectedRequestConfig());
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Kart ekleme başlatılamadı.';
      setPaymentError(message);
      showToast(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSetDefault = async (methodId) => {
    try {
      setPaymentError('');
      await api.patch(`/users/me/payment-methods/${methodId}/default`);
      const methodsRes = await api.get('/users/me/payment-methods');
      setPaymentMethods(methodsRes.data?.items || []);
      showToast('Varsayılan kart güncellendi');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Varsayılan kart güncellenemedi.';
      setPaymentError(message);
    }
  };

  const handleRemoveMethod = async (methodId) => {
    const confirmed = window.confirm('Bu kartı kaldırmak istediğine emin misin?');
    if (!confirmed) return;
    try {
      setPaymentError('');
      await api.delete(`/users/me/payment-methods/${methodId}`);
      const methodsRes = await api.get('/users/me/payment-methods');
      setPaymentMethods(methodsRes.data?.items || []);
      showToast('Kart kaldırıldı');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Kart kaldırılamadı.';
      setPaymentError(message);
    }
  };

  const buildAlertLabel = (item) => {
    if (item.type === 'keyword') {
      return item.keyword ? `"${item.keyword}" geçen ilanlar` : 'Anahtar kelime';
    }
    const parts = [];
    if (item.categoryName) parts.push(item.categoryName);
    if (item.cityName) parts.push(item.cityName);
    if (item.districtName) parts.push(item.districtName);
    return parts.length ? parts.join(' / ') : 'Kategori takibi';
  };

  const buildMatchReason = (match) => {
    if (match?.matchedBy === 'keyword') return 'Anahtar kelime eşleşti';
    if (match?.matchedBy === 'category_city_district') return 'Kategori + şehir + ilçe eşleşti';
    if (match?.matchedBy === 'category_city') return 'Kategori + şehir eşleşti';
    if (match?.matchedBy === 'category') return 'Kategori eşleşti';
    return 'Takip eşleşmesi';
  };

  const toggleAlert = async (alertId, isActive) => {
    try {
      const response = await api.patch(`/me/alerts/${alertId}`, { isActive: !isActive });
      const updated = response.data?.data;
      setAlerts((prev) => prev.map((item) => (item._id === alertId ? updated : item)));
      showToast(!isActive ? 'Takip aktif edildi' : 'Takip pasif edildi');
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Takip güncellenemedi.');
    }
  };

  const deleteAlert = async (alertId) => {
    const confirmed = window.confirm('Bu takibi silmek istediğine emin misin?');
    if (!confirmed) return;
    try {
      await api.delete(`/me/alerts/${alertId}`);
      setAlerts((prev) => prev.filter((item) => item._id !== alertId));
      showToast('Takip silindi');
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Takip silinemedi.');
    }
  };

  const handleOpenMatch = async (match) => {
    if (!match?.rfqId) {
      return;
    }
    if (!match.isSeen) {
      try {
        await api.patch(`/me/alert-matches/${match._id}/seen`);
        setAlerts((prev) => prev.map((alert) => {
          if (String(alert._id) !== String(match.subscriptionId || alert._id)) {
            return alert;
          }
          const nextMatches = (alert.matches || []).map((m) => (m._id === match._id ? { ...m, isSeen: true } : m));
          const nextUnread = Math.max((alert.unreadCount || 0) - 1, 0);
          return { ...alert, matches: nextMatches, unreadCount: nextUnread };
        }));
      } catch (_error) {
        // ignore
      }
    }
    navigate(`/rfq/${match.rfqId}`);
  };

  const resetAlertForm = () => {
    setAlertForm({
      type: 'category',
      categoryId: '',
      cityId: '',
      districtId: '',
      keyword: ''
    });
    setAlertFormError('');
  };

  const handleCreateAlert = async () => {
    try {
      setAlertFormError('');
      setAlertFormLoading(true);
      const payload = {
        type: alertForm.type,
        categoryId: alertForm.categoryId || undefined,
        cityId: alertForm.cityId || undefined,
        districtId: alertForm.districtId || undefined,
        keyword: alertForm.keyword || undefined
      };
      const response = await api.post('/me/alerts', payload);
      if (response.data?.data) {
        setAlerts((prev) => [response.data.data, ...prev]);
      }
      const backfilledCount = Number(response.data?.backfilledCount || 0);
      showToast(
        backfilledCount > 0
          ? `Takip eklendi. ${backfilledCount} uygun talep listene eklendi.`
          : 'Takip eklendi.'
      );
      resetAlertForm();
    } catch (requestError) {
      const status = requestError.response?.status;
      if (status === 409) {
        setAlertFormError('Bu takip zaten mevcut.');
      } else {
        setAlertFormError(requestError.response?.data?.message || 'Takip eklenemedi.');
      }
    } finally {
      setAlertFormLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <BackIconButton />
        <h1>Hesabım</h1>
      </div>

      <section className="card account-card">
        <div className="account-highlight">
          <div>
            <h2>Takiplerim</h2>
            <div className="account-muted">
              İlgilendiğin kategori ve aramalar için yeni ilan bildirimlerini yönet.
            </div>
          </div>
          <button type="button" className="primary-btn account-entry-btn" onClick={() => setAlertsSheetOpen(true)}>
            Takiplerimi Aç
          </button>
        </div>
      </section>

      <section className="card account-card">
        <h2>Bilgilerim</h2>
        {loading ? <div className="refresh-text">Yükleniyor...</div> : null}
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={handleSave} className="account-form">
          <label className="account-field">
            <span>Ad</span>
            <input name="firstName" value={form.firstName} onChange={handleChange} />
          </label>
          <label className="account-field">
            <span>Soyad</span>
            <input name="lastName" value={form.lastName} onChange={handleChange} />
          </label>
          <label className="account-field">
            <span>Telefon</span>
            <div className="account-phone-input">
              <span className="account-prefix">+90</span>
              <input
                name="phone"
                inputMode="tel"
                placeholder="5xx xxx xx xx"
                value={phoneDisplay}
                onChange={handlePhoneChange}
              />
            </div>
            {phoneError ? <small className="account-helper error">{phoneError}</small> : null}
          </label>
          <label className="account-field">
            <span>E-posta</span>
            <input name="email" inputMode="email" value={form.email} onChange={handleChange} />
          </label>
          <div className="account-save-bar">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </section>

      <section className="card account-card">
        <h2>Paket Durumum</h2>
        {billingSummary ? (
          <div className="account-rows">
            <div className="account-row">
              <span>Premium durumu</span>
              <strong>{billingSummary.premiumActive ? 'Aktif' : 'Pasif'}</strong>
            </div>
            <div className="account-row">
              <span>Premium bitiş</span>
              <strong>
                {billingSummary.premiumUntil
                  ? new Date(billingSummary.premiumUntil).toLocaleDateString('tr-TR')
                  : 'Aktif paket yok'}
              </strong>
            </div>
            <div className="account-row">
              <span>Öne çıkarma kredisi</span>
              <strong>{Number(billingSummary.featuredCredits || 0)}</strong>
            </div>
            {billingSummary.subscription?.cancelAtPeriodEnd ? (
              <div className="account-muted">
                Abonelik dönem sonunda iptal olacak. Bitiş tarihi:{' '}
                {billingSummary.subscription.currentPeriodEnd
                  ? new Date(billingSummary.subscription.currentPeriodEnd).toLocaleDateString('tr-TR')
                  : 'Belirtilmedi'}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="refresh-text">Paket bilgisi alınamadı.</div>
        )}
      </section>

      <section className="card account-card">
        <h2>İlan Hakkım</h2>
        {listingQuota ? (
          <div className="account-rows">
            <div className="account-row">
              <span>Kalan ücretsiz hak</span>
              <strong>
                {listingQuota.remainingFree}/{listingQuota.maxFree}
              </strong>
            </div>
            <div className="account-row">
              <span>Dönem bitiş</span>
              <strong>
                {listingQuota.windowEnd
                  ? new Date(listingQuota.windowEnd).toLocaleDateString('tr-TR')
                  : 'İlk ilanla başlar'}
              </strong>
            </div>
            <div className="account-row">
              <span>Ücretli ilan hakkı</span>
              <strong>{listingQuota.paidListingCredits || 0}</strong>
            </div>
            {listingQuota.remainingFree === 0 ? (
              <div className="account-muted">
                Bu dönem için ücretsiz hakkın doldu. Ek ilan ücreti: {listingQuota.extraPrice} {listingQuota.currency}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="refresh-text">Kota bilgisi alınamadı.</div>
        )}
      </section>

      <section className="card account-card">
        <h2>Ödeme Yöntemi</h2>
        {paymentMethod && !paymentMethods.length ? (
          <div className="account-muted">
            Kayıtlı ödeme özeti: {paymentMethod.brand || 'Kart'} •••• {paymentMethod.last4 || '----'}
          </div>
        ) : null}
        {paymentMethods.length ? (
          <div className="payment-method-list">
            {paymentMethods.map((method) => (
              <div key={method._id} className={`payment-card ${method.isDefault ? 'is-default' : ''}`}>
                <div className="payment-card-head">
                  <div className="payment-card-brand">{method.brand || 'Kart'}</div>
                  {method.isDefault ? <span className="payment-default">Varsayılan</span> : null}
                </div>
                <div className="payment-card-number">•••• {method.last4 || '----'}</div>
                <div className="payment-card-meta">
                  <span>SKT {method.expMonth || '--'}/{method.expYear || '--'}</span>
                  <span>{paymentProvider || method.provider}</span>
                </div>
                <div className="payment-card-actions">
                  {!method.isDefault ? (
                    <button type="button" className="secondary-btn" onClick={() => handleSetDefault(method._id)}>
                      Varsayılan Yap
                    </button>
                  ) : null}
                  <button type="button" className="link-btn" onClick={() => handleRemoveMethod(method._id)}>
                    Kaldır
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="payment-empty">
            <div>Henüz kayıtlı kart yok.</div>
            <div className="account-muted">Kart eklemek için güvenli ödeme ekranına yönlendirileceksin.</div>
          </div>
        )}

        {paymentError ? <div className="error">{paymentError}</div> : null}

        <div className="payment-actions">
          <button type="button" className="secondary-btn" onClick={() => setPaymentSheetOpen(true)}>
            Kart Ekle
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleExtraListingPayment}
            disabled={paymentLoading || listingQuota?.extraEnabled === false}
          >
            {paymentLoading ? 'Ödeme başlatılıyor…' : listingQuota?.extraEnabled === false ? 'Ek ilan kapalı' : 'Ek ilan için ödeme yap'}
          </button>
        </div>
      </section>

      <ReusableBottomSheet
        open={alertsSheetOpen}
        onClose={() => setAlertsSheetOpen(false)}
        title="Takiplerim"
        contentClassName="alerts-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setAlertsSheetOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
        initialSnap="mid"
      >
        <div className="alert-form">
          <div className="alert-form-title">Yeni takip ekle</div>
          <div className="alert-form-grid">
            <label className="account-field">
              <span>Takip tipi</span>
              <select
                value={alertForm.type}
                onChange={(event) => {
                  const value = event.target.value;
                  setAlertForm((prev) => ({
                    ...prev,
                    type: value,
                    cityId: value === 'category' ? '' : prev.cityId,
                    districtId: value !== 'category_city_district' ? '' : prev.districtId
                  }));
                }}
              >
                <option value="category">Kategori</option>
                <option value="category_city">Kategori + Şehir</option>
                <option value="category_city_district">Kategori + Şehir + İlçe</option>
                <option value="keyword">Anahtar Kelime</option>
              </select>
            </label>

            {alertForm.type !== 'keyword' ? (
              <label className="account-field">
                <span>Kategori</span>
                <select
                  value={alertForm.categoryId}
                  onChange={(event) => setAlertForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">Kategori seç</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="account-field">
                <span>Anahtar kelime</span>
                <input
                  value={alertForm.keyword}
                  placeholder="Örn: iPhone"
                  onChange={(event) => setAlertForm((prev) => ({ ...prev, keyword: event.target.value }))}
                />
              </label>
            )}

            {alertForm.type === 'category_city' || alertForm.type === 'category_city_district' ? (
              <label className="account-field">
                <span>Şehir</span>
                <select
                  value={alertForm.cityId}
                  onChange={(event) => setAlertForm((prev) => ({ ...prev, cityId: event.target.value, districtId: '' }))}
                >
                  <option value="">Şehir seç</option>
                  {cities.map((city) => (
                    <option key={city._id || city.id} value={city._id || city.id}>{city.name || city}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {alertForm.type === 'category_city_district' ? (
              <label className="account-field">
                <span>İlçe</span>
                <select
                  value={alertForm.districtId}
                  onChange={(event) => setAlertForm((prev) => ({ ...prev, districtId: event.target.value }))}
                >
                  <option value="">İlçe seç</option>
                  {districts.map((district) => (
                    <option key={district._id || district.id} value={district._id || district.id}>{district.name || district}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {alertFormError ? <div className="error">{alertFormError}</div> : null}
          <button type="button" className="primary-btn" onClick={handleCreateAlert} disabled={alertFormLoading}>
            {alertFormLoading ? 'Ekleniyor…' : 'Takip Ekle'}
          </button>
        </div>

        {alertsLoading ? <div className="refresh-text">Yükleniyor...</div> : null}
        {alertsError ? <div className="error">{alertsError}</div> : null}
        {!alertsLoading && !alertsError ? (
          alerts.length ? (
            <div className="alert-list">
              {alerts.map((item) => (
                <div key={item._id} className="alert-item">
                  <div>
                    <div className="alert-title">
                      {buildAlertLabel(item)}
                      {item.unreadCount ? <span className="alert-badge">{item.unreadCount} yeni</span> : null}
                    </div>
                    <div className="alert-meta">
                      {item.type === 'keyword' ? 'Anahtar Kelime' : 'Kategori'}
                      {item.lastTriggeredAt ? ` • Son tetiklenme: ${new Date(item.lastTriggeredAt).toLocaleDateString('tr-TR')}` : ''}
                    </div>
                    {item.matches?.length ? (
                      <div className="alert-matches">
                        {item.matches.map((match) => (
                          <button
                            key={match._id}
                            type="button"
                            className={`alert-match ${match.isSeen ? '' : 'is-unseen'}`}
                            onClick={() => handleOpenMatch(match)}
                          >
                            <div className="alert-match-title">{match.title}</div>
                            {match.categoryName ? <div className="alert-match-meta">{match.categoryName}</div> : null}
                            <div className="alert-match-meta">
                              {match.cityName || match.districtName ? `${match.cityName}${match.districtName ? ` / ${match.districtName}` : ''}` : ''}
                              {match.createdAt ? ` • ${new Date(match.createdAt).toLocaleDateString('tr-TR')}` : ''}
                            </div>
                            <div className="alert-match-meta">{buildMatchReason(match)}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="alert-empty">Henüz bu takip için yeni talep yok.</div>
                    )}
                  </div>
                  <div className="alert-actions">
                    <button type="button" className="secondary-btn" onClick={() => toggleAlert(item._id, item.isActive)}>
                      {item.isActive ? 'Pasif Yap' : 'Aktif Et'}
                    </button>
                    <button type="button" className="link-btn" onClick={() => deleteAlert(item._id)}>
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="account-muted">Henüz takip kaydın yok.</div>
          )
        ) : null}
      </ReusableBottomSheet>

      <ReusableBottomSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        title="Kart Ekle"
        contentClassName="payment-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setPaymentSheetOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
        initialSnap="mid"
      >
        <div className="payment-sheet-body">
          <div className="payment-sheet-card">
            <div className="payment-sheet-brand">Talepet</div>
            <div className="payment-sheet-number">
              {paymentForm.number ? paymentForm.number : '•••• •••• •••• 1234'}
            </div>
            <div className="payment-sheet-meta">
              <span>{paymentForm.name || 'Ad Soyad'}</span>
              <span>{paymentForm.expiry || 'MM/YY'}</span>
            </div>
          </div>
          <div className="payment-sheet-form">
            <label className="account-field">
              <span>Kart Üzerindeki İsim</span>
              <input
                name="cardName"
                placeholder="Ad Soyad"
                value={paymentForm.name}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>
            <label className="account-field">
              <span>Kart Numarası</span>
              <input
                name="cardNumber"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                value={paymentForm.number}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, number: formatCardNumber(event.target.value) }))
                }
              />
            </label>
            <div className="payment-sheet-row">
              <label className="account-field">
                <span>Son Kullanma (AA/YY)</span>
                <input
                  name="cardExpiry"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={paymentForm.expiry}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, expiry: formatExpiry(event.target.value) }))
                  }
                />
              </label>
              <label className="account-field">
                <span>CVV</span>
                <input
                  name="cardCvv"
                  inputMode="numeric"
                  placeholder="123"
                  value={paymentForm.cvv}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, cvv: formatCvv(event.target.value) }))
                  }
                />
              </label>
            </div>
          </div>
          <div className="account-muted">
            Kart bilgilerin uygulamada saklanmaz. Güvenli ödeme sağlayıcısının ekranında tekrar doğrulanacaktır.
          </div>
          {paymentFormError ? <div className="error">{paymentFormError}</div> : null}
          {paymentError ? <div className="error">{paymentError}</div> : null}
          <button type="button" className="primary-btn" onClick={handleAddPaymentMethod} disabled={paymentLoading}>
            {paymentLoading ? 'Yönlendiriliyor…' : 'Ödemeye Geç'}
          </button>
        </div>
      </ReusableBottomSheet>

      <section className="card account-card">
        <h2>Şifre</h2>
        <p className="rfq-sub">Şifreni güvenli tutmak için düzenli olarak değiştir.</p>
        <button type="button" className="secondary-btn" onClick={() => setPasswordOpen(true)}>
          Şifreyi Değiştir
        </button>
        <button type="button" className="link-btn" onClick={() => navigate('/forgot-password')}>
          Şifremi unuttum / Şifre oluştur
        </button>
      </section>

      <ReusableBottomSheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Şifreyi Değiştir"
        contentClassName="offer-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setPasswordOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
      >
        <form className="offer-sheet-form" onSubmit={handlePasswordSubmit}>
          <label className="offer-field">
            <span>Mevcut Şifre</span>
            <input
              type="password"
              name="currentPassword"
              placeholder="Eski sifre"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              autoComplete="current-password"
            />
          </label>
          <label className="offer-field">
            <span>Yeni Şifre</span>
            <input
              type="password"
              name="newPassword"
              placeholder="Yeni sifre"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
            />
          </label>
          <div className="rfq-sub">
            Şifre en az 3 karakter olmalı, 1 büyük harf, 1 sayı ve 1 özel karakter içermeli.
          </div>
          <label className="offer-field">
            <span>Yeni Şifre (Tekrar)</span>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Yeni sifre (tekrar)"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
            />
          </label>
          {passwordError ? <div className="error">{passwordError}</div> : null}
          <div className="offer-sheet-footer">
            <div className="offer-sheet-actions">
              <button type="submit" className="primary-btn" disabled={passwordLoading}>
                {passwordLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
              <button type="button" className="secondary-btn" onClick={() => setPasswordOpen(false)}>
                Vazgec
              </button>
            </div>
          </div>
        </form>
      </ReusableBottomSheet>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default ProfileAccount;
