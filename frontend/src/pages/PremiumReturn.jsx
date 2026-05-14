import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { buildProtectedRequestConfig } from '../api/axios';
import { WEBSITE_PACKAGES_PATH } from '../config/surfaces';
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
        console.info('PREMIUM_CHECKOUT_RESPONSE', {
          source: 'premium_return_poll',
          endpoint: `/billing/payment/${paymentId}`
        });
        const response = await api.get(`/billing/payment/${paymentId}`, buildProtectedRequestConfig());
        const paymentStatus = response.data?.data?.status;
        const responsePlanCode = response.data?.data?.planCode || '';
        const responseConsent = response.data?.data?.saveCardConsent ?? null;
        setPlanCode(responsePlanCode);
        setSaveCardConsent(responseConsent);
        if (paymentStatus === 'paid') {
          console.info('PREMIUM_BILLING_ME_REFRESH_START', {
            source: 'premium_return_poll',
            paymentId
          });
          await api.get('/billing/me', buildProtectedRequestConfig());
          await checkAuth();
          if (active) {
            setStatus('success');
            setMessage('Odeme basarili.');
            if (responsePlanCode === 'payment_method_setup' && responseConsent === null) {
              setSavePromptOpen(true);
            } else {
              timer = window.setTimeout(() => {
                console.info('PREMIUM_POST_CHECKOUT_NAVIGATION', {
                  source: 'premium_return_poll',
                  paymentId,
                  target: WEBSITE_PACKAGES_PATH
                });
                navigate(WEBSITE_PACKAGES_PATH);
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
        if (requestError?.response?.status === 401 || requestError?.response?.status === 403) {
          console.warn('PREMIUM_BILLING_ME_REFRESH_FAILURE', {
            source: 'premium_return_poll',
            paymentId,
            status: requestError?.response?.status,
            reason: 'auth_failed'
          });
        }
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
      await api.post(
        '/billing/payment-method/consent',
        {
          paymentId,
          saveCard: shouldSave
        },
        buildProtectedRequestConfig()
      );
      setSaveCardConsent(shouldSave);
      setSavePromptOpen(false);
      console.info('PREMIUM_POST_CHECKOUT_NAVIGATION', {
        source: 'premium_return_consent',
        paymentId,
        target: WEBSITE_PACKAGES_PATH
      });
      navigate(WEBSITE_PACKAGES_PATH);
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
          onClick={() => navigate(WEBSITE_PACKAGES_PATH)}
        >
          Paketlere don
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
        <div className="payment-sheet-body" data-rb-no-drag="true">
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
