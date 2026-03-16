import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
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
      setError(requestError.response?.data?.message || 'Planlar alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBilling = async () => {
    try {
      const response = await api.get('/billing/me');
      setBilling(response.data?.data || null);
    } catch (_error) {
      setBilling(null);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchBilling();
  }, []);

  const handleCheckout = async (planCode) => {
    try {
      setProcessing(planCode);
      const response = await api.post('/billing/checkout', { planCode });
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Odeme baslatilamadi.');
    } finally {
      setProcessing('');
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    if (!billing?.subscription?._id) {
      return;
    }
    try {
      await api.post('/billing/subscription/cancel', { subscriptionId: billing.subscription._id });
      await fetchBilling();
      await checkAuth();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Iptal istegi alinmadi.');
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
        <h2>{premiumActive ? 'Premium Aktif' : 'Premium Degil'}</h2>
        {billing?.premiumUntil ? <p>Premium bitis: {new Date(billing.premiumUntil).toLocaleDateString('tr-TR')}</p> : null}
        {billing?.subscription ? (
          <div className="premium-subscription-box">
            <div>Plan: {billing.subscription.planCode}</div>
            <div>
              Donem sonu: {billing.subscription.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('tr-TR') : '-'}
            </div>
            {billing.subscription.cancelAtPeriodEnd ? (
              <div className="status-pill pending">Donem sonunda iptal</div>
            ) : (
              <button type="button" className="secondary-btn" onClick={handleCancelAtPeriodEnd}>
                Donem sonunda iptal et
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section className="card premium-plans">
        <h2>Premium Paket</h2>
        {loading ? <div>Yukleniyor...</div> : null}
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
                    <div className="premium-plan-price">{formatPrice(plan.yearlyPrice, plan.currency)} / yil</div>
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
                          ? 'Yonlendiriliyor...'
                          : 'Aylik Satin Al'}
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
                          ? 'Yonlendiriliyor...'
                          : 'Yillik Satin Al'}
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
                <div className="premium-plan-price">{formatPrice(plan.yearlyPrice, plan.currency)} / yil</div>
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
                      ? 'Yonlendiriliyor...'
                      : 'Aylik Öne Çıkar'}
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
                      ? 'Yonlendiriliyor...'
                      : 'Yillik Öne Çıkar'}
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
