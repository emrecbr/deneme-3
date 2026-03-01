import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
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
    const fetchMe = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users/me');
        const payload = response.data?.data || {};
        const phoneValue = String(payload.phone || '');
        const phoneDigits = phoneValue.startsWith('+90') ? phoneValue.slice(3) : normalizePhoneInput(phoneValue);
        setForm({
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          email: payload.email || '',
          phoneDigits
        });
        setError('');
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Bilgiler alinamadi.');
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

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
      const message = requestError.response?.data?.message || 'Guncelleme basarisiz';
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
      setPasswordError('Tum alanlari doldur');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni sifreler eslesmiyor');
      return;
    }
    if (!passwordPolicy(newPassword)) {
      setPasswordError('Sifre en az 3 karakter, 1 buyuk harf, 1 sayi ve 1 ozel karakter icermeli');
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
      showToast('Sifre guncellendi');
    } catch (requestError) {
      const code = requestError.response?.data?.code;
      if (code === 'BAD_PASSWORD') {
        setPasswordError('Mevcut sifre yanlis');
      } else if (code === 'WEAK_PASSWORD') {
        setPasswordError('Sifre kurallarini saglamiyor');
      } else if (code === 'SAME_PASSWORD') {
        setPasswordError('Yeni sifre eski sifre ile ayni olamaz');
      } else if (!requestError.response) {
        setPasswordError('Sunucuya baglanilamadi');
      } else {
        setPasswordError(requestError.response?.data?.message || 'Sifre guncellenemedi');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <BackIconButton />
        <h1>Hesabım</h1>
      </div>

      <section className="card account-card">
        <h2>Bilgilerim</h2>
        {loading ? <div className="refresh-text">Yukleniyor...</div> : null}
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
        <h2>Sifre</h2>
        <p className="rfq-sub">Sifreni guvenli tutmak icin duzenli olarak degistir.</p>
        <button type="button" className="secondary-btn" onClick={() => setPasswordOpen(true)}>
          Sifreyi Degistir
        </button>
        <button type="button" className="link-btn" onClick={() => navigate('/forgot-password')}>
          Sifremi unuttum / Sifre olustur
        </button>
      </section>

      <ReusableBottomSheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Sifreyi Degistir"
        contentClassName="offer-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setPasswordOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
      >
        <form className="offer-sheet-form" onSubmit={handlePasswordSubmit}>
          <label className="offer-field">
            <span>Mevcut Sifre</span>
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
            <span>Yeni Sifre</span>
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
            Sifre en az 3 karakter olmali, 1 buyuk harf, 1 sayi ve 1 ozel karakter icermeli.
          </div>
          <label className="offer-field">
            <span>Yeni Sifre (Tekrar)</span>
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
                {passwordLoading ? 'Guncelleniyor...' : 'Sifreyi Guncelle'}
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
