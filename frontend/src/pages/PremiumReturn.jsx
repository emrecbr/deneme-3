import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function PremiumReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
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
        if (paymentStatus === 'paid') {
          await api.get('/billing/me');
          await checkAuth();
          if (active) {
            setStatus('success');
            setMessage('Odeme basarili.');
            timer = window.setTimeout(() => {
              navigate('/premium');
            }, 1500);
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

  return (
    <div className="page premium-return">
      <section className="card">
        <h1>Premium Durumu</h1>
        {status === 'checking' ? <p>{message || 'Odeme kontrol ediliyor...'}</p> : null}
        {status === 'success' ? <p>{message || 'Odemen alindi. Premium aktif.'}</p> : null}
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
        <button type="button" className="primary-btn" onClick={() => navigate('/profile')}>
          Profile don
        </button>
      </section>
    </div>
  );
}

export default PremiumReturn;
