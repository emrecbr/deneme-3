import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig, buildPublicRequestConfig } from '../api/axios';
import ProfileLegalSection from '../components/ProfileLegalSection';
import { useAuth } from '../context/AuthContext';
import BackIconButton from '../components/BackIconButton';
import {
  PREMIUM_PURCHASE_DISABLED_MESSAGE,
  PREMIUM_PURCHASES_ENABLED
} from '../config/featureFlags';

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
    return durations.monthly || '30 gün';
  }
  if (modes.includes('yearly')) {
    return durations.yearly || '365 gün';
  }
  return durations.monthly || durations.yearly || 'Tek seferlik';
};

const getCheckoutLabel = (plan, mode) => {
  if (plan.key === 'listing_extra') {
    return 'Ek İlan Hakkını Başlat';
  }
  if (plan.key === 'featured_listing') {
    return mode === 'yearly' ? 'Yıllık Öne Çıkarma Paketini Aktifleştir' : 'Aylık Öne Çıkarma Paketini Aktifleştir';
  }
  return mode === 'yearly' ? 'Yıllık Premium Paketini Aktifleştir' : 'Aylık Premium Paketini Aktifleştir';
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
    return 'Yıllık';
  }
  if (mode === 'one_time') {
    return 'Tek Seferlik';
  }
  return 'Aylık';
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
    return labels.yearly || '365 gün';
  }
  if (mode === 'one_time') {
    return labels.monthly || labels.yearly || 'Tek seferlik hak';
  }
  return labels.monthly || '30 gün';
};

const getFeaturedSummary = (plan, mode) => {
  const durations = plan.entitlements?.featuredDurationDays || {};
  const value = mode === 'yearly' ? durations.yearly : durations.monthly;
  return value ? `${value} gün öne çıkarma` : 'Öne çıkarma dahil değil';
};

const PREMIUM_BENEFITS = [
  'Dijital hizmet paketi olarak premium görünürlük',
  'Profilde premium rozet ve güven sinyali',
  'Ek ilan hakkı ve öne çıkarma kredisi takibi',
  'Kullanıcılar arası ödeme değil, yalnızca üyelik ve görünürlük modeli'
];

function Premium({ surfaceVariant = 'app' }) {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const isWebSurface = surfaceVariant === 'web';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchaseNotice, setPurchaseNotice] = useState('');
  const [processing, setProcessing] = useState('');
  const [subscriptionSummary, setSubscriptionSummary] = useState(null);
  const [quotaSummary, setQuotaSummary] = useState(null);
  const [selectedModes, setSelectedModes] = useState({});

  const loadPageData = useCallback(async (options = {}) => {
    const { isActive = () => true } = options;
    try {
      if (!isActive()) {
        return;
      }
      setLoading(true);
      const [plansRes, subscriptionRes, quotaRes] = await Promise.all([
        api.get('/public/plans', buildPublicRequestConfig()),
        api.get('/me/subscription', buildProtectedRequestConfig()),
        api.get('/me/listing-quota', buildProtectedRequestConfig())
      ]);
      if (!isActive()) {
        return;
      }
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
      if (!isActive()) {
        return;
      }
      setError(requestError.response?.data?.message || 'Paket bilgileri alinamadi.');
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadPageData({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [loadPageData]);

  const handleCheckout = async (planCode) => {
    if (!PREMIUM_PURCHASES_ENABLED) {
      setPurchaseNotice(PREMIUM_PURCHASE_DISABLED_MESSAGE);
      return;
    }

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
          ? 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar dene; sorun sürerse yeniden giriş yap.'
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
  const activePlanCode = subscriptionSummary?.subscription?.planCode || 'Aktif üyelik yok';
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
              Talepet kullanıcılar arasında ödeme aracılığı yapmaz. Buradaki ödemeler yalnızca
              dijital görünürlük, premium hak ve ek ilan paketleri içindir.
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

      {error ? (
        <div className="card ux-error-state">
          <p>{error}</p>
          <button type="button" className="secondary-btn" onClick={() => loadPageData()}>
            Tekrar Dene
          </button>
        </div>
      ) : null}
      {!error && purchaseNotice ? (
        <div className="website-profile-state-card">
          <strong>Yakinda aktif</strong>
          <p>{purchaseNotice}</p>
        </div>
      ) : null}

      <section className="card premium-membership-hero">
        <div className="premium-membership-hero__header">
          <div>
            <p className="premium-membership-hero__eyebrow">Dijital üyelik ve görünürlük hizmeti</p>
            <h2>Premium üyelik özeti</h2>
            <p>
              Talepet kullanıcılar arasında ödeme aracılığı yapmaz. Talepet yalnızca premium
              görünürlük, üyelik ve ilan hizmetleri sunar.
            </p>
          </div>
          <div className={`premium-membership-hero__status ${premiumActive ? 'is-active' : ''}`}>
            <span className="premium-membership-hero__status-label">Üyelik durumu</span>
            <strong>{premiumActive ? 'Premium aktif' : 'Standart hesap'}</strong>
          </div>
        </div>

        <div className="premium-membership-hero__stats">
          <article className="premium-membership-hero__stat">
            <span>Kalan ilan hakkı</span>
            <strong>{planCountLabel}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>Ek ilan kredisi</span>
            <strong>{paidListingCredits}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>Öne çıkarma kredisi</span>
            <strong>{featuredCredits}</strong>
          </article>
          <article className="premium-membership-hero__stat">
            <span>Premium badge</span>
            <strong>{premiumActive ? 'Aktif' : 'Kapalı'}</strong>
          </article>
        </div>

        <div className="premium-membership-hero__meta">
          <div className="premium-membership-hero__meta-item">
            <span>Aktif paket</span>
            <strong>{activePlanCode}</strong>
          </div>
          <div className="premium-membership-hero__meta-item">
            <span>Üyelik bitişi</span>
            <strong>{premiumUntilLabel}</strong>
          </div>
          <div className="premium-membership-hero__meta-item">
            <span>Dijital hizmet etiketi</span>
            <strong>Premium üyelik ve görünürlük hizmeti</strong>
          </div>
        </div>

        <div className="premium-disclaimer-inline">
          <span>Talepet kullanıcılar arasında ödeme aracılığı yapmaz.</span>
          <span>Bu ödeme dijital platform hizmeti içindir.</span>
          <span>Talepet yalnızca premium görünürlük, üyelik ve ilan hizmetleri sunar.</span>
        </div>
      </section>

      <section className="card premium-status-card">
        <h2>{premiumActive ? 'Üyelik yönetimi' : 'Üyelik durumu'}</h2>
        <div className="premium-subscription-box">
          <div>Aktif plan: {activePlanCode}</div>
          <div>Premium bitisi: {premiumUntilLabel}</div>
          <div>Kalan ek ilan kredisi: {paidListingCredits}</div>
          <div>Kalan öne çıkarma kredisi: {featuredCredits}</div>
          <div>Dijital hizmet etiketi: Premium üyelik ve görünürlük hizmeti</div>
          {subscriptionSummary?.subscription ? (
            subscriptionSummary.subscription.cancelAtPeriodEnd ? (
              <div className="status-pill pending">Dönem sonunda iptal</div>
            ) : (
              <button type="button" className="secondary-btn" onClick={handleCancelAtPeriodEnd}>
                Dönem sonunda iptal et
              </button>
            )
          ) : null}
        </div>
      </section>

      <section className="card premium-plans">
        <h2>Paketler ve fiyatlandırma</h2>
        <p className="premium-plans__lead">
          Aşağıdaki tüm seçenekler dijital platform hizmetidir. Tek bir checkout akışı kullanılır;
          ikinci bir paket ekranı açılmaz.
        </p>
        {!PREMIUM_PURCHASES_ENABLED ? (
          <div className="website-profile-state-card">
            <strong>Geçici olarak pasif</strong>
            <p>
              Premium paket satın alma yakında aktif olacak. Paket hakları ve fiyatlar şu anda
              inceleme amaçlı gösterilmektedir.
            </p>
          </div>
        ) : null}
        {loading ? <div className="website-profile-state-card">Paketler yükleniyor...</div> : null}
        {!loading && !visiblePlans.length ? (
          <div className="website-profile-state-card">
            <p>Gösterilecek dijital paket bulunamadı.</p>
            <button type="button" className="secondary-btn" onClick={() => loadPageData()}>
              Yeniden dene
            </button>
          </div>
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
                      <span>İlan hakkı</span>
                      <strong>{plan.entitlements?.listingRights || 'Belirtilmedi'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Premium badge</span>
                      <strong>{plan.entitlements?.premiumBadgeIncluded ? 'Var' : 'Yok'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Öne çıkarma hakkı</span>
                      <strong>{getFeaturedSummary(plan, selectedMode)}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Görünürlük</span>
                      <strong>{plan.entitlements?.visibilityBoostLabel || 'Belirtilmedi'}</strong>
                    </div>
                    <div className="premium-plan-fact">
                      <span>Teklif önceliği</span>
                      <strong>{plan.entitlements?.offerPriorityLabel || 'Dahil değil'}</strong>
                    </div>
                  </div>
                  <div className="premium-plan-note">
                    {plan.disclaimer ||
                      'Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme aracılığı yapmaz.'}
                  </div>
                  <div className="premium-plan-checkout-note">
                    Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme
                    aracılığı yapmaz.
                  </div>
                  <div className="premium-cta-actions">
                    <button
                      type="button"
                      className="primary-btn premium-plan-action"
                      onClick={() => handleCheckout(selectedPlanCode)}
                      disabled={processing === selectedPlanCode}
                    >
                      {processing === selectedPlanCode
                        ? 'Yönlendiriliyor...'
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
