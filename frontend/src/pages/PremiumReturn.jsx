import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ReusableBottomSheet from '../components/ReusableBottomSheet';

function PremiumReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [planCode, setPlanCode] = useState('');
  const [saveCardConsent, setSaveCardConsent] = useState(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const paymentId = params.get('paymentId');

  useEffect(() => {
    let active = true;
    let timer = null;

    const poll = async () => {
      if (!paymentId) {
        setStatus('error');
        setMessage('Payment ID bulunamadi.');
        return;
      }
      if (attempts >= 12) {
        setStatus('timeout');
        setMessage('Odeme dogrulanamadi, birazdan tekrar dene.');
        return;
      }
      try {
        const response = await api.get(`/billing/payment/${paymentId}`);
        const paymentStatus = response.data?.data?.status;
        const responsePlanCode = response.data?.data?.planCode || '';
        const responseConsent = response.data?.data?.saveCardConsent ?? null;
        setPlanCode(responsePlanCode);
        setSaveCardConsent(responseConsent);
        if (paymentStatus === 'paid') {
          await api.get('/billing/me');
          await checkAuth();
          if (active) {
            setStatus('success');
            setMessage('Odeme basarili.');
            if (responsePlanCode === 'payment_method_setup' && responseConsent === null) {
              setSavePromptOpen(true);
            } else {
              timer = window.setTimeout(() => {
                navigate('/premium');
              }, 1500);
            }
          }
          return;
        }
        if (paymentStatus === 'failed') {
          if (active) {
            setStatus('error');
            setMessage('Odeme basarisiz.');
          }
          return;
        }
        if (active) {
          setAttempts((prev) => prev + 1);
          timer = window.setTimeout(poll, 1500);
        }
      } catch (requestError) {
        if (active) {
          setStatus('error');
          setMessage(requestError.response?.data?.message || 'Sunucuya baglanilamadi.');
        }
      }
    };

    poll();

    return () => {
      active = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [attempts, checkAuth, navigate, paymentId]);

  const handleSaveDecision = async (shouldSave) => {
    if (!paymentId || saveLoading) {
      return;
    }
    try {
      setSaveLoading(true);
      await api.post('/billing/payment-method/consent', {
        paymentId,
        saveCard: shouldSave
      });
      setSaveCardConsent(shouldSave);
      setSavePromptOpen(false);
      navigate('/profile');
    } catch (requestError) {
      setSaveLoading(false);
      setMessage(requestError.response?.data?.message || 'Kart kaydi guncellenemedi.');
    }
  };

  return (
    <div className="page premium-return">
      <section className="card">
        <h1>Premium Durumu</h1>
        {status === 'checking' ? <p>{message || 'Odeme kontrol ediliyor...'}</p> : null}
        {status === 'success' ? <p>{message || 'Odemen alindi.'}</p> : null}
        {status === 'error' ? <p>{message || 'Odeme dogrulanamadi. Daha sonra tekrar dene.'}</p> : null}
        {status === 'timeout' ? (
          <>
            <p>{message}</p>
            <button type="button" className="secondary-btn" onClick={() => window.location.reload()}>
              Yenile
            </button>
          </>
        ) : null}
        {paymentId ? <div className="rfq-sub">Payment ID: {paymentId}</div> : null}
        <button
          type="button"
          className="primary-btn"
          onClick={() => navigate(planCode === 'payment_method_setup' ? '/profile' : '/premium')}
        >
          Profile don
        </button>
      </section>

      <ReusableBottomSheet
        open={savePromptOpen}
        onClose={() => setSavePromptOpen(false)}
        title="Kart Kaydet"
        contentClassName="payment-sheet"
        headerRight={
          <button type="button" className="offer-sheet-close" onClick={() => setSavePromptOpen(false)} aria-label="Kapat">
            ✕
          </button>
        }
        initialSnap="mid"
      >
        <div className="payment-sheet-body">
          <div className="account-muted">
            Bu karti sonraki odemeler icin kaydetmek ister misin?
          </div>
          <div className="payment-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => handleSaveDecision(true)}
              disabled={saveLoading}
            >
              {saveLoading ? 'Kaydediliyor...' : 'Evet, Kaydet'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => handleSaveDecision(false)}
              disabled={saveLoading}
            >
              Hayir, Kaydetme
            </button>
          </div>
        </div>
      </ReusableBottomSheet>
    </div>
  );
}

export default PremiumReturn;
