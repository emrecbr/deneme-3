import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { isAbsoluteHref, resolvePostAuthHref } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

const normalizeTrMobileTo10Digits = (v) => {
  let d = onlyDigits(v);
  if (d.startsWith('90')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length > 10) d = d.slice(0, 10);
  return d;
};

const toE164TR = (d10) => {
  if (!/^[5]\d{9}$/.test(d10)) return null;
  return `+90${d10}`;
};

function SmsVerify() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [code, setCode] = useState('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const completeAuthRedirect = () => {
    const nextHref = resolvePostAuthHref('user', window.location.hostname);
    if (isAbsoluteHref(nextHref)) {
      window.location.href = nextHref;
      return;
    }
    navigate(nextHref, { replace: true });
  };

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const resetMessages = () => {
    setError('');
    setInfo('');
  };

  const goBackToPhoneEntry = () => {
    setStep(1);
    setCode('');
    resetMessages();
  };

  const send = async () => {
    resetMessages();
    const e164 = toE164TR(phoneDigits);
    if (!e164) {
      setError('Telefon 10 haneli olmali ve 5 ile baslamali.');
      return;
    }
    setLoadingSend(true);
    try {
      await api.post('/auth/sms/send', { phone: e164 });
      setStep(2);
      setResendSeconds(60);
      setInfo('Kod gonderildi.');
    } catch (err) {
      if (err?.response?.data?.code === 'TWILIO_TRIAL_UNVERIFIED') {
        setError('SMS gonderilemedi. Trial hesap sadece dogrulanmis numaralara SMS gonderir.');
      } else if (err?.response?.data?.code === 'TWILIO_GEO_BLOCKED') {
        setError('Bu ulkeye SMS gonderimi kapali.');
      } else if (err?.response?.data?.code === 'TWILIO_INVALID_PHONE') {
        setError('Numara formati hatali (5XXXXXXXXX).');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Baglanti hatasi');
      }
    } finally {
      setLoadingSend(false);
    }
  };

  const verify = async () => {
    resetMessages();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Kod 6 haneli olmali.');
      return;
    }
    setLoadingVerify(true);
    try {
      const e164 = toE164TR(phoneDigits);
      if (!e164) {
        setError('Telefon 10 haneli olmali ve 5 ile baslamali.');
        return;
      }
      const res = await api.post('/auth/sms/verify', {
        phone: e164,
        code: code.trim()
      });
      const data = res?.data;

      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        completeAuthRedirect();
        return;
      }

      if (data?.signup_required) {
        setSignupToken(data.signupToken || '');
        setModalOpen(true);
        return;
      }

      setInfo(data?.message || 'Dogrulandi.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Baglanti hatasi');
    } finally {
      setLoadingVerify(false);
    }
  };

  const completeSignup = async () => {
    resetMessages();
    if (!signupName.trim()) {
      setError('Ad Soyad zorunlu.');
      return;
    }
    if (!signupPassword.trim()) {
      setError('Sifre zorunlu.');
      return;
    }
    if (!signupToken) {
      setError('Signup token bulunamadi.');
      return;
    }
    setLoadingSignup(true);
    try {
      const res = await api.post('/auth/sms/complete-signup', {
        signupToken,
        name: signupName.trim(),
        password: signupPassword
      });
      const data = res?.data;
      if (data?.token) {
        localStorage.setItem('token', data.token);
        await login(data.token);
        completeAuthRedirect();
        return;
      }
      setInfo(data?.message || 'Kayit tamamlandi.');
      setModalOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Baglanti hatasi');
    } finally {
      setLoadingSignup(false);
    }
  };

  const resend = async () => {
    if (resendSeconds > 0 || loadingSend) {
      return;
    }
    await send();
  };

  return (
    <div className="otp-page">
      <div className="card otp-card">
        <h2>SMS Dogrulama</h2>
        <p className="muted">Telefon numaran ile giris yap.</p>

        {step === 1 && (
          <>
            <div className="form-group">
              <label>Telefon</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(normalizeTrMobileTo10Digits(e.target.value))}
                placeholder="5xx xxx xx xx"
              />
            </div>
            <div className="input-helper">Sadece 10 hane yaz (5 ile baslayan).</div>
            <button
              type="button"
              className="primary-btn"
              onClick={send}
              disabled={loadingSend}
            >
              {loadingSend ? 'Gonderiliyor...' : 'Kod Gonder'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted small">
              Kod su numaraya gonderildi: <strong>{toE164TR(phoneDigits) || ''}</strong>
            </p>
            <div className="form-group">
              <label>Dogrulama Kodu</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={verify}
              disabled={loadingVerify}
            >
              {loadingVerify ? 'Dogrulaniyor...' : 'Dogrula'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={resend}
              disabled={resendSeconds > 0 || loadingSend}
            >
              {resendSeconds > 0 ? `Tekrar gonder (${resendSeconds}s)` : 'Kodu tekrar gonder'}
            </button>
            <button type="button" className="link-btn" onClick={goBackToPhoneEntry}>
              Numarayi duzenle
            </button>
          </>
        )}

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert success">{info}</div>}
      </div>

      {modalOpen && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h3>Hesap Olustur</h3>
            <p className="muted">Bu numara kayitli degil. Yeni hesap olusturmak ister misin?</p>
            <div className="form-group">
              <label>Ad Soyad</label>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="form-group">
              <label>Sifre</label>
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Sifre"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setModalOpen(false)}
                disabled={loadingSignup}
              >
                Hayir
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={completeSignup}
                disabled={loadingSignup}
              >
                {loadingSignup ? 'Kaydediliyor...' : 'Hesap Olustur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmsVerify;
