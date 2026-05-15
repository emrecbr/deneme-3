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

const getPreferredMode = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (plan.key === 'listing_extra') {
    return 'one_time';
  }
  if (modes.includes('monthly')) {
    return 'monthly';
  }
  if (modes.includes('yearly')) {
    return 'yearly';
  }
  return modes[0] || 'monthly';
};

const getModeLabel = (mode) => {
  if (mode === 'yearly') {
    return 'Yillik';
  }
  if (mode === 'one_time') {
    return 'Tek Seferlik';
  }
  return 'Aylik';
};

const getModePrice = (plan, mode) => {
  if (mode === 'yearly') {
    return formatPrice(plan.yearlyPrice, plan.currency);
  }
  return formatPrice(plan.monthlyPrice || plan.yearlyPrice, plan.currency);
};

const getModeDuration = (plan, mode) => {
  const labels = plan.entitlements?.durationLabels || {};
  if (mode === 'yearly') {
    return labels.yearly || '365 gun';
  }
  if (mode === 'one_time') {
    return labels.monthly || labels.yearly || 'Tek seferlik hak';
  }
  return labels.monthly || '30 gun';
};

const getFeaturedSummary = (plan, mode) => {
  const durations = plan.entitlements?.featuredDurationDays || {};
  const value = mode === 'yearly' ? durations.yearly : durations.monthly;
  return value ? `${value} gun one cikarma` : 'One cikarma dahil degil';
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
  const [selectedModes, setSelectedModes] = useState({});

  const loadPageData = async () => {
    try {
      setLoading(true);
      const [plansRes, subscriptionRes, quotaRes] = await Promise.all([
        api.get('/public/plans', buildPublicRequestConfig()),
        api.get('/me/subscription', buildProtectedRequestConfig()),
        api.get('/me/listing-quota', buildProtectedRequestConfig())
      ]);
      const nextPlans = plansRes.data?.data?.items || [];
      setPlans(nextPlans);
      setSubscriptionSummary(subscriptionRes.data?.data || null);
      setQuotaSummary(quotaRes.data?.data || null);
      setSelectedModes((prev) => {
        const next = { ...prev };
        nextPlans.forEach((plan) => {
          const key = plan.id || plan.key;
          if (!next[key]) {
            next[key] = getPreferredMode(plan);
          }
        });
        return next;
      });
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

  const planCountLabel = quotaSummary ? `${quotaSummary.remaining}/${quotaSummary.limit}` : '-';
  const featuredCredits = subscriptionSummary?.featuredCredits ?? user?.featuredCredits ?? 0;
  const paidListingCredits = subscriptionSummary?.paidListingCredits ?? quotaSummary?.paidCredits ?? 0;
  const activePlanCode = subscriptionSummary?.subscription?.planCode || 'Aktif uyelik yok';
  const premiumUntilLabel = subscriptionSummary?.premiumUntil
    ? new Date(subscriptionSummary.premiumUntil).toLocaleDateString('tr-TR')
    : 'Aktif sure yok';

  const updateSelectedMode = (plan, mode) => {
    const key = plan.id || plan.key;
    setSelectedModes((prev) => ({
      ...prev,
      [key]: mode
    }));
  };

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

      {error ? <div className="card ux-error-state">{error}</div> : null}

      <section className="card premium-membership-hero">
        <div className="premium-membership-hero__header">
          <div>
            <p className="premium-membership-hero__eyebrow">Dijital uyelik ve gorunurluk hizmeti</p>
            <h2>Premium uyelik ozeti</h2>
            <p>
              Talepet kullanicilar arasinda odeme araciligi yapmaz. Talepet yalnizca premium
              gorunurluk, uyelik ve ilan hizmetleri sunar.
            </p>
          </div>
          <div className={`premium-membership-hero__status ${premiumActive ? 'is-active' : ''}`}>
            <span className="premium-membership-hero__status-label">Uyelik durumu</span>
            <strong>{premiumActive ? 'Premium aktif' : 'Standart hesap'}</strong>
          </div>
        </div>

        <div className="premium-membership-hero__stats">
          <article className="premium-membership-hero__stat">
            <span>Kalan ilan hakki</span>
            <strong>{planCountLabel}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>Ek ilan kredisi</span>
            <strong>{paidListingCredits}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>One cikarma kredisi</span>
            <strong>{featuredCredits}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>Premium badge</span>
            <strong>{premiumActive ? 'Aktif' : 'Kapali'}</strong>
          </article>
        </div>

        <div className="premium-membership-hero__meta">
          <div className="premium-membership-hero__meta-item">
            <span>Aktif paket</span>
            <strong>{activePlanCode}</strong>
          </div>
          <div className="premium-membership-hero__meta-item">
            <span>Uyelik bitisi</span>
            <strong>{premiumUntilLabel}</strong>
          </div>
          <div className="premium-membership-hero__meta-item">
            <span>Dijital hizmet etiketi</span>
            <strong>Premium uyelik ve gorunurluk hizmeti</strong>
          </div>
        </div>

        <div className="premium-disclaimer-inline">
          <span>Talepet kullanicilar arasinda odeme araciligi yapmaz.</span>
          <span>Bu odeme dijital platform hizmeti icindir.</span>
          <span>Talepet yalnizca premium gorunurluk, uyelik ve ilan hizmetleri sunar.</span>
        </div>
      </section>

      <section className="card premium-status-card">
        <h2>{premiumActive ? 'Uyelik yonetimi' : 'Uyelik durumu'}</h2>
        <div className="premium-subscription-box">
          <div>Aktif plan: {activePlanCode}</div>
          <div>Premium bitisi: {premiumUntilLabel}</div>
          <div>Kalan ek ilan kredisi: {paidListingCredits}</div>
          <div>Kalan one cikarma kredisi: {featuredCredits}</div>
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
        <h2>Paketler ve fiyatlandirma</h2>
        <p className="premium-plans__lead">
          Asagidaki tum secenekler dijital platform hizmetidir. Tek bir checkout akisi kullanilir;
          ikinci bir paket ekrani acilmaz.
        </p>
        {loading ? <div>Yukleniyor...</div> : null}
        {!loading && !visiblePlans.length ? (
          <div className="account-muted">Gosterilecek dijital paket bulunamadi.</div>
        ) : null}
        {!loading && visiblePlans.length ? (
          <div className="premium-plan-grid">
            {visiblePlans.map((plan) => {
              const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
              const planStateKey = plan.id || plan.key;
              const selectedMode = selectedModes[planStateKey] || getPreferredMode(plan);
              const selectedPlanCode =
                selectedMode === 'yearly'
                  ? plan.planCodes?.yearly || 'premium_yearly'
                  : plan.key === 'listing_extra'
                    ? 'listing_extra'
                    : plan.planCodes?.monthly || 'premium_monthly';
              return (
                <article key={plan.id || plan.key} className="premium-plan-card premium-plan-card--detailed">
                  <div className="premium-plan-head">
                    <div className="premium-plan-head__copy">
                      <span className="premium-plan-badge">
                        {plan.entitlements?.digitalServiceLabel || 'Dijital hizmet paketi'}
                      </span>
                      <div className="premium-plan-title-row">
                        <div className="premium-plan-title">{plan.title}</div>
                        {plan.badgeLabel ? <span className="premium-plan-accent">{plan.badgeLabel}</span> : null}
                      </div>
                      <div className="premium-plan-desc">{plan.shortDescription}</div>
                    </div>
                    {modes.length > 1 ? (
                      <div className="premium-plan-mode-switch" aria-label={`${plan.title} paket tipi`}>
                        {modes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`premium-plan-mode ${selectedMode === mode ? 'is-active' : ''}`}
                            onClick={() => updateSelectedMode(plan, mode)}
                          >
                            {getModeLabel(mode)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="premium-plan-price-block">
                    <div className="premium-plan-price">{getModePrice(plan, selectedMode)}</div>
                    <div className="premium-plan-duration">
                      {getModeLabel(selectedMode)} · {getModeDuration(plan, selectedMode)}
                    </div>
                  </div>

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
                      <span>Featured hakki</span>
                      <strong>{getFeaturedSummary(plan, selectedMode)}</strong>
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
                    <button
                      type="button"
                      className="primary-btn premium-plan-action"
                      onClick={() => handleCheckout(selectedPlanCode)}
                      disabled={processing === selectedPlanCode}
                    >
                      {processing === selectedPlanCode
                        ? 'Yonlendiriliyor...'
                        : getCheckoutLabel(plan, selectedMode)}
                    </button>
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
