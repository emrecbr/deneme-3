import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig, buildPublicRequestConfig } from '../api/axios';
import ProfileLegalSection from '../components/ProfileLegalSection';
import { useAuth } from '../context/AuthContext';
import BackIconButton from '../components/BackIconButton';

const formatPrice = (value, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const getPlanPriceSummary = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${formatPrice(plan.monthlyPrice, plan.currency)} / ay - ${formatPrice(plan.yearlyPrice, plan.currency)} / yil`;
  }
  if (modes.includes('monthly')) {
    return `${formatPrice(plan.monthlyPrice, plan.currency)} / ay`;
  }
  if (modes.includes('yearly')) {
    return `${formatPrice(plan.yearlyPrice, plan.currency)} / yil`;
  }
  return formatPrice(plan.monthlyPrice || plan.yearlyPrice, plan.currency);
};

const getDurationSummary = (plan) => {
  const durations = plan.entitlements?.durationLabels || {};
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${durations.monthly || '30 gun'} / ${durations.yearly || '365 gun'}`;
  }
  if (modes.includes('monthly')) {
    return durations.monthly || '30 gun';
  }
  if (modes.includes('yearly')) {
    return durations.yearly || '365 gun';
  }
  return durations.monthly || durations.yearly || 'Tek seferlik';
};

const getCheckoutLabel = (plan, mode) => {
  if (plan.key === 'listing_extra') {
    return 'Ek Ilan Hakkini Baslat';
  }
  if (plan.key === 'featured_listing') {
    return mode === 'yearly' ? 'Yillik One Cikarma Paketini Aktiflestir' : 'Aylik One Cikarma Paketini Aktiflestir';
  }
  return mode === 'yearly' ? 'Yillik Premium Paketini Aktiflestir' : 'Aylik Premium Paketini Aktiflestir';
};

const PREMIUM_BENEFITS = [
  'Dijital hizmet paketi olarak premium gorunurluk',
  'Profilde premium rozet ve guven sinyali',
  'Ek ilan hakki ve one cikarma kredisi takibi',
  'Kullanicilar arasi odeme degil, yalnizca uyelik ve gorunurluk modeli'
];

function Premium({ surfaceVariant = 'app' }) {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const isWebSurface = surfaceVariant === 'web';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState('');
  const [subscriptionSummary, setSubscriptionSummary] = useState(null);
  const [quotaSummary, setQuotaSummary] = useState(null);

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [plansRes, subscriptionRes, quotaRes] = await Promise.all([
        api.get('/public/plans', buildPublicRequestConfig()),
        api.get('/me/subscription', buildProtectedRequestConfig()),
        api.get('/me/listing-quota', buildProtectedRequestConfig())
      ]);
      setPlans(plansRes.data?.data?.items || []);
      setSubscriptionSummary(subscriptionRes.data?.data || null);
      setQuotaSummary(quotaRes.data?.data || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Paket bilgileri alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const handleCheckout = async (planCode) => {
    const hasStoredToken = Boolean(localStorage.getItem('token'));
    if (!hasStoredToken && !user) {
      navigate('/login');
      return;
    }

    try {
      setProcessing(planCode);
      const response = await api.post(
        '/billing/checkout',
        { planCode },
        buildProtectedRequestConfig()
      );
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const status = requestError?.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Oturum dogrulanamadi. Lutfen sayfayi yenileyip tekrar dene; sorun surerse yeniden giris yap.'
          : requestError.response?.data?.message || 'Dijital paket baslatilamadi.';
      setError(message);
    } finally {
      setProcessing('');
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    if (!subscriptionSummary?.subscription?._id) {
      return;
    }
    try {
      await api.post(
        '/billing/subscription/cancel',
        { subscriptionId: subscriptionSummary.subscription._id },
        buildProtectedRequestConfig()
      );
      await loadPageData();
      await checkAuth();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Iptal istegi alinamadi.');
    }
  };

  const premiumActive = Boolean(
    subscriptionSummary?.premiumActive ||
      (user?.isPremium && (!user?.premiumUntil || new Date(user.premiumUntil) > new Date()))
  );

  const visiblePlans = useMemo(
    () => plans.filter((plan) => ['listing_extra', 'featured_listing', 'premium_listing'].includes(plan.key)),
    [plans]
  );

  return (
    <div className={`page premium-page ${isWebSurface ? 'premium-page--web website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modulu</p>
            <h2>Premium ve Paketler</h2>
            <p>
              Talepet kullanicilar arasinda odeme araciligi yapmaz. Buradaki odemeler yalnizca
              dijital gorunurluk, premium hak ve ek ilan paketleri icindir.
            </p>
          </div>
        </div>
      ) : (
        <div className="profile-topbar">
          <BackIconButton />
          <h1>Premium</h1>
          <span className="topbar-spacer" aria-hidden="true" />
        </div>
      )}

      <section className="card premium-status-card premium-status-card--notice">
        <h2>Dijital hizmet modeli</h2>
        <p>
          Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi
          yapmaz ve komisyon almaz.
        </p>
        <div className="premium-disclaimer-inline">
          {PREMIUM_BENEFITS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      {error ? <div className="card ux-error-state">{error}</div> : null}

      <section className={isWebSurface ? 'premium-web-summary' : 'premium-web-summary premium-web-summary--stacked'}>
        <article className="card premium-web-summary__card">
          <span>Premium durumu</span>
          <strong>{premiumActive ? 'Aktif' : 'Pasif'}</strong>
        </article>
        <article className="card premium-web-summary__card">
          <span>Kalan ilan hakki</span>
          <strong>
            {quotaSummary ? `${quotaSummary.remaining}/${quotaSummary.limit}` : '-'}
          </strong>
        </article>
        <article className="card premium-web-summary__card">
          <span>Ek ilan kredisi</span>
          <strong>{subscriptionSummary?.paidListingCredits ?? quotaSummary?.paidCredits ?? 0}</strong>
        </article>
        <article className="card premium-web-summary__card">
          <span>One cikarma kredisi</span>
          <strong>{subscriptionSummary?.featuredCredits ?? user?.featuredCredits ?? 0}</strong>
        </article>
      </section>

      <section className="card premium-status-card">
        <h2>{premiumActive ? 'Aktif Dijital Paket' : 'Aktif Premium Paket Yok'}</h2>
        <div className="premium-subscription-box">
          <div>Plan: {subscriptionSummary?.subscription?.planCode || 'Aktif plan yok'}</div>
          <div>
            Premium bitisi:{' '}
            {subscriptionSummary?.premiumUntil
              ? new Date(subscriptionSummary.premiumUntil).toLocaleDateString('tr-TR')
              : '-'}
          </div>
          <div>
            Kalan ek ilan kredisi: {subscriptionSummary?.paidListingCredits ?? quotaSummary?.paidCredits ?? 0}
          </div>
          <div>
            Kalan one cikarma kredisi: {subscriptionSummary?.featuredCredits ?? user?.featuredCredits ?? 0}
          </div>
          <div>Dijital hizmet etiketi: Premium uyelik ve gorunurluk hizmeti</div>
          {subscriptionSummary?.subscription ? (
            subscriptionSummary.subscription.cancelAtPeriodEnd ? (
              <div className="status-pill pending">Donem sonunda iptal</div>
            ) : (
              <button type="button" className="secondary-btn" onClick={handleCancelAtPeriodEnd}>
                Donem sonunda iptal et
              </button>
            )
          ) : null}
        </div>
      </section>

      <section className="card premium-plans">
        <h2>Paket karsilastirma alani</h2>
        <p className="premium-plans__lead">
          Asagidaki tum secenekler dijital platform hizmetidir. Kullanicilar arasi odeme, wallet,
          transfer veya escrow mantigi bulunmaz.
        </p>
        {loading ? <div>Yukleniyor...</div> : null}
        {!loading && !visiblePlans.length ? (
          <div className="account-muted">Gosterilecek dijital paket bulunamadi.</div>
        ) : null}
        {!loading && visiblePlans.length ? (
          <div className="premium-plan-grid">
            {visiblePlans.map((plan) => {
              const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
              return (
                <article key={plan.id || plan.key} className="premium-plan-card premium-plan-card--detailed">
                  <div className="premium-plan-title">{plan.title}</div>
                  <div className="premium-plan-desc">{plan.shortDescription}</div>
                  <div className="premium-plan-price">{getPlanPriceSummary(plan)}</div>
                  <div className="premium-plan-duration">{getDurationSummary(plan)}</div>
                  <div className="premium-plan-facts">
                    <div className="premium-plan-fact">
                      <span>Ilan hakki</span>
                      <strong>{plan.entitlements?.listingRights || 'Belirtilmedi'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Premium badge</span>
                      <strong>{plan.entitlements?.premiumBadgeIncluded ? 'Var' : 'Yok'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>One cikarma</span>
                      <strong>
                        {plan.entitlements?.featuredDurationDays?.monthly || plan.entitlements?.featuredDurationDays?.yearly
                          ? `${plan.entitlements?.featuredDurationDays?.monthly || 0} / ${plan.entitlements?.featuredDurationDays?.yearly || 0} gun`
                          : 'Yok'}
                      </strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Gorunurluk</span>
                      <strong>{plan.entitlements?.visibilityBoostLabel || 'Belirtilmedi'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Teklif onceligi</span>
                      <strong>{plan.entitlements?.offerPriorityLabel || 'Dahil degil'}</strong>
                    </div>
                  </div>
                  <div className="premium-plan-note">
                    {plan.disclaimer ||
                      'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'}
                  </div>
                  <div className="premium-plan-checkout-note">
                    Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme
                    araciligi yapmaz.
                  </div>
                  <div className="premium-cta-actions">
                    {modes.includes('monthly') ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleCheckout(plan.planCodes?.monthly || 'premium_monthly')}
                        disabled={processing === (plan.planCodes?.monthly || 'premium_monthly')}
                      >
                        {processing === (plan.planCodes?.monthly || 'premium_monthly')
                          ? 'Yonlendiriliyor...'
                          : getCheckoutLabel(plan, 'monthly')}
                      </button>
                    ) : null}
                    {modes.includes('yearly') ? (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleCheckout(plan.planCodes?.yearly || 'premium_yearly')}
                        disabled={processing === (plan.planCodes?.yearly || 'premium_yearly')}
                      >
                        {processing === (plan.planCodes?.yearly || 'premium_yearly')
                          ? 'Yonlendiriliyor...'
                          : getCheckoutLabel(plan, 'yearly')}
                      </button>
                    ) : null}
                    {plan.key === 'listing_extra' ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleCheckout('listing_extra')}
                        disabled={processing === 'listing_extra'}
                      >
                        {processing === 'listing_extra' ? 'Yonlendiriliyor...' : getCheckoutLabel(plan, 'one_time')}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {isWebSurface ? <ProfileLegalSection /> : null}
    </div>
  );
}

export default Premium;
