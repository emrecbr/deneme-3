import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import BackIconButton from '../components/BackIconButton';

function Premium() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState('');
  const [billing, setBilling] = useState(null);

  const formatPrice = (value, currency) =>
    `${Number.isFinite(Number(value)) ? Number(value) : 0} ${currency || 'TRY'}`;

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/app/monetization/plans');
      const items = response.data?.items || [];
      setPlans(items.filter((plan) => plan.key === 'premium_listing' || plan.key === 'featured_listing'));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Planlar alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBilling = async () => {
    try {
      const response = await api.get('/billing/me', buildProtectedRequestConfig());
      setBilling(response.data?.data || null);
    } catch (requestError) {
      if (requestError?.response?.status === 401 || requestError?.response?.status === 403) {
        console.warn('PREMIUM_AUTH_MISSING', {
          source: 'premium_page_fetch',
          status: requestError?.response?.status,
          hasUser: Boolean(user),
          hasStoredToken: Boolean(localStorage.getItem('token'))
        });
      }
      setBilling(null);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchBilling();
  }, []);

  const handleCheckout = async (planCode) => {
    const hasStoredToken = Boolean(localStorage.getItem('token'));
    console.info('PREMIUM_CHECKOUT_START', {
      source: 'premium_page',
      planCode,
      hasUser: Boolean(user),
      hasStoredToken
    });

    if (!hasStoredToken && !user) {
      console.warn('PREMIUM_AUTH_MISSING', {
        source: 'premium_page',
        planCode,
        hasUser: false,
        hasStoredToken: false
      });
      console.info('PREMIUM_REDIRECT_TO_LOGIN', {
        source: 'premium_page',
        planCode,
        reason: 'missing_local_auth'
      });
      navigate('/login');
      return;
    }

    try {
      setProcessing(planCode);
      console.info('PREMIUM_CHECKOUT_REQUEST', {
        source: 'premium_page',
        endpoint: '/billing/checkout',
        planCode,
        hasUser: Boolean(user),
        hasStoredToken
      });
      const response = await api.post('/billing/checkout', { planCode }, buildProtectedRequestConfig());
      const url = response.data?.checkoutUrl;
      console.info('PREMIUM_CHECKOUT_RESPONSE_STATUS', {
        source: 'premium_page',
        planCode,
        status: response.status
      });
      console.info('PREMIUM_CHECKOUT_RESPONSE_BODY_SHAPE', {
        source: 'premium_page',
        planCode,
        hasSuccess: Object.prototype.hasOwnProperty.call(response.data || {}, 'success'),
        hasCheckoutUrl: Object.prototype.hasOwnProperty.call(response.data || {}, 'checkoutUrl'),
        hasPaymentId: Object.prototype.hasOwnProperty.call(response.data || {}, 'paymentId'),
        hasCode: Object.prototype.hasOwnProperty.call(response.data || {}, 'code')
      });
      console.info('PREMIUM_CHECKOUT_RESPONSE', {
        source: 'premium_page',
        planCode,
        status: response.status,
        hasCheckoutUrl: Boolean(url),
        bodyKeys: Object.keys(response.data || {})
      });
      if (url) {
        console.info('PREMIUM_POST_CHECKOUT_NAVIGATION', {
          source: 'premium_page',
          planCode,
          target: url
        });
        window.location.href = url;
      }
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar dene; sorun sürerse yeniden giriş yap.'
          : requestError.response?.data?.message || 'Ödeme başlatılamadı.';

      console.warn('PREMIUM_CHECKOUT_FAILURE', {
        source: 'premium_page',
        planCode,
        status: status || null,
        reason: status === 401 || status === 403 ? 'auth_failed' : 'payment_init_failed',
        responseKeys: requestError?.response?.data ? Object.keys(requestError.response.data) : [],
        responseCode: requestError?.response?.data?.code || null,
        hasUser: Boolean(user),
        hasStoredToken
      });
      setError(message);
    } finally {
      setProcessing('');
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    if (!billing?.subscription?._id) {
      return;
    }
    try {
      await api.post('/billing/subscription/cancel', { subscriptionId: billing.subscription._id }, buildProtectedRequestConfig());
      await fetchBilling();
      await checkAuth();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'İptal isteği alınamadı.');
    }
  };

  const premiumActive = Boolean(
    billing?.premiumActive ||
      (user?.isPremium && (!user?.premiumUntil || new Date(user.premiumUntil) > new Date()))
  );
  const featuredCredits = Number(billing?.featuredCredits ?? user?.featuredCredits ?? 0);

  return (
    <div className="page premium-page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Premium</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>

      {error ? <div className="card ux-error-state">{error}</div> : null}

      <section className="card premium-status-card">
        <h2>{premiumActive ? 'Premium Aktif' : 'Premium Değil'}</h2>
        {billing?.premiumUntil ? <p>Premium bitiş: {new Date(billing.premiumUntil).toLocaleDateString('tr-TR')}</p> : null}
        {billing?.subscription ? (
          <div className="premium-subscription-box">
            <div>Plan: {billing.subscription.planCode}</div>
            <div>
              Dönem sonu:{' '}
              {billing.subscription.currentPeriodEnd
                ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('tr-TR')
                : '-'}
            </div>
            {billing.subscription.cancelAtPeriodEnd ? (
              <div className="status-pill pending">Dönem sonunda iptal</div>
            ) : (
              <button type="button" className="secondary-btn" onClick={handleCancelAtPeriodEnd}>
                Dönem sonunda iptal et
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section className="card premium-plans">
        <h2>Premium Paket</h2>
        {loading ? <div>Yükleniyor...</div> : null}
        {!loading && plans.length ? (
          <div className="premium-plan-grid">
            {plans
              .filter((plan) => plan.key === 'premium_listing')
              .map((plan) => (
                <article key={plan._id} className="premium-plan-card">
                  <div className="premium-plan-title">{plan.title}</div>
                  <div className="premium-plan-desc">{plan.shortDescription}</div>
                  {plan.billingModes?.includes('monthly') ? (
                    <div className="premium-plan-price">{formatPrice(plan.monthlyPrice, plan.currency)} / ay</div>
                  ) : null}
                  {plan.billingModes?.includes('yearly') ? (
                    <div className="premium-plan-price">{formatPrice(plan.yearlyPrice, plan.currency)} / yıl</div>
                  ) : null}
                  <div className="premium-cta-actions">
                    {plan.billingModes?.includes('monthly') ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleCheckout(plan.metadata?.planCodes?.monthly || 'premium_monthly')}
                        disabled={processing === (plan.metadata?.planCodes?.monthly || 'premium_monthly')}
                      >
                        {processing === (plan.metadata?.planCodes?.monthly || 'premium_monthly')
                          ? 'Yönlendiriliyor...'
                          : 'Aylık Satın Al'}
                      </button>
                    ) : null}
                    {plan.billingModes?.includes('yearly') ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleCheckout(plan.metadata?.planCodes?.yearly || 'premium_yearly')}
                        disabled={processing === (plan.metadata?.planCodes?.yearly || 'premium_yearly')}
                      >
                        {processing === (plan.metadata?.planCodes?.yearly || 'premium_yearly')
                          ? 'Yönlendiriliyor...'
                          : 'Yıllık Satın Al'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
          </div>
        ) : null}
      </section>

      <section className="card premium-plans">
        <h2>Öne Çıkarılan İlan</h2>
        {plans
          .filter((plan) => plan.key === 'featured_listing')
          .map((plan) => (
            <div key={plan._id} className="premium-subscription-box">
              <p>{plan.shortDescription}</p>
              {plan.billingModes?.includes('monthly') ? (
                <div className="premium-plan-price">{formatPrice(plan.monthlyPrice, plan.currency)} / ay</div>
              ) : null}
              {plan.billingModes?.includes('yearly') ? (
                <div className="premium-plan-price">{formatPrice(plan.yearlyPrice, plan.currency)} / yıl</div>
              ) : null}
              <div className="premium-cta-actions">
                {plan.billingModes?.includes('monthly') ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => handleCheckout(plan.metadata?.planCodes?.monthly || 'featured_monthly')}
                    disabled={processing === (plan.metadata?.planCodes?.monthly || 'featured_monthly')}
                  >
                    {processing === (plan.metadata?.planCodes?.monthly || 'featured_monthly')
                      ? 'Yönlendiriliyor...'
                      : 'Aylık Öne Çıkar'}
                  </button>
                ) : null}
                {plan.billingModes?.includes('yearly') ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => handleCheckout(plan.metadata?.planCodes?.yearly || 'featured_yearly')}
                    disabled={processing === (plan.metadata?.planCodes?.yearly || 'featured_yearly')}
                  >
                    {processing === (plan.metadata?.planCodes?.yearly || 'featured_yearly')
                      ? 'Yönlendiriliyor...'
                      : 'Yıllık Öne Çıkar'}
                  </button>
                ) : null}
                {featuredCredits > 0 ? (
                  <button type="button" className="secondary-btn" onClick={() => navigate('/profile/requests')}>
                    İlanları Yönet
                  </button>
                ) : null}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}

export default Premium;
