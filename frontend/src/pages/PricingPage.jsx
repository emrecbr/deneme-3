import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig, buildPublicRequestConfig } from '../api/axios';
import PublicFooter from '../components/PublicFooter';
import PublicTopBar from '../components/PublicTopBar';
import { WEBSITE_PACKAGES_PATH, buildSurfaceHref, isWebSurfaceHost } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';
import {
  PREMIUM_PURCHASE_DISABLED_MESSAGE,
  PREMIUM_PURCHASES_ENABLED
} from '../config/featureFlags';

const PAGE_TITLE = 'Paketler ve Fiyatlandırma';

const formatMoney = (value, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const getPreferredMode = (plan) => {
  const modes = Array.isArray(plan?.billingModes) ? plan.billingModes : [];
  if (plan?.key === 'listing_extra') {
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

const getAvailableModes = (plan) => {
  const modes = Array.isArray(plan?.billingModes) ? plan.billingModes : [];
  if (plan?.key === 'listing_extra') {
    return ['one_time'];
  }
  return modes.length ? modes.filter((mode) => mode === 'monthly' || mode === 'yearly') : ['monthly'];
};

const getModeLabel = (mode) => {
  if (mode === 'yearly') {
    return 'Yıllık';
  }
  if (mode === 'one_time') {
    return 'Tek seferlik';
  }
  return 'Aylık';
};

const getModePrice = (plan, mode) => {
  if (!plan) {
    return 'Şu anda kullanılamıyor';
  }
  if (mode === 'yearly') {
    return formatMoney(plan.yearlyPrice, plan.currency);
  }
  return formatMoney(plan.monthlyPrice || plan.yearlyPrice, plan.currency);
};

const getModeDuration = (plan, mode) => {
  const labels = plan?.entitlements?.durationLabels || {};
  if (mode === 'yearly') {
    return labels.yearly || '365 gün';
  }
  if (mode === 'one_time') {
    return labels.monthly || labels.yearly || 'Hemen kullanılabilir';
  }
  return labels.monthly || '30 gün';
};

const getPlanCodes = (plan) => plan?.planCodes || plan?.metadata?.planCodes || {};

const getPlanCode = (plan, mode) => {
  if (!plan) {
    return '';
  }
  const codes = getPlanCodes(plan);
  if (plan.key === 'listing_extra') {
    return codes.one_time || 'listing_extra';
  }
  if (mode === 'yearly') {
    return codes.yearly || (plan.key === 'featured_listing' ? 'featured_yearly' : 'premium_yearly');
  }
  return codes.monthly || (plan.key === 'featured_listing' ? 'featured_monthly' : 'premium_monthly');
};

const PACKAGE_CONFIGS = [
  {
    id: 'premium',
    keys: ['premium_listing', 'premium'],
    title: 'Premium Talep',
    badge: 'En yüksek görünürlük',
    description: 'Talebin premium kart tasarımıyla listenin en üstünde yer alır.',
    cta: 'Premium Satın Al',
    unavailableCta: 'Premium kullanılamıyor',
    theme: 'premium',
    features: [
      'Listenin en üstünde görünür',
      'Premium Talep rozeti',
      'Altın premium kart tasarımı',
      'Maksimum görünürlük'
    ]
  },
  {
    id: 'featured',
    keys: ['featured_listing'],
    title: 'Öne Çıkan Talep',
    badge: 'Daha fazla görünürlük',
    description: 'Talebin standart taleplerden ayrılır ve premium taleplerden sonra öne çıkar.',
    cta: 'Öne Çıkar',
    unavailableCta: 'Öne çıkarma kullanılamıyor',
    theme: 'featured',
    features: [
      'Öne Çıkan Talep rozeti',
      'Mavi/turkuaz özel kart tasarımı',
      'Standart taleplerin üstünde görünür',
      'Daha fazla teklif alma şansı'
    ]
  },
  {
    id: 'extra',
    keys: ['listing_extra', 'paid_listing', 'extra_listing'],
    title: 'Ek Talep Hakkı',
    badge: 'Hemen kullanılabilir',
    description: 'Ücretsiz talep hakkın bittiğinde yeni talep oluşturmak için ek hak satın al.',
    cta: 'Ek Hak Satın Al',
    unavailableCta: 'Ek hak kullanılamıyor',
    theme: 'extra',
    features: [
      'Ek talep oluşturma hakkı',
      'Hemen kullanılabilir',
      'Hesabına otomatik tanımlanır'
    ]
  }
];

const COMPARISON_ROWS = [
  { label: 'Standart yayın', standard: true, featured: true, premium: true },
  { label: 'Standart taleplerin üstünde görünme', standard: false, featured: true, premium: true },
  { label: 'Premium taleplerin en üstte görünmesi', standard: false, featured: false, premium: true },
  { label: 'Özel rozet', standard: false, featured: true, premium: true },
  { label: 'Özel kart tasarımı', standard: false, featured: true, premium: true },
  { label: 'Daha fazla teklif alma şansı', standard: false, featured: true, premium: true }
];

const findPlan = (plans, keys) => plans.find((plan) => keys.includes(plan.key)) || null;

function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const marketingOnlySurface = isWebSurfaceHost();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState('');
  const [selectedModes, setSelectedModes] = useState({});
  const [subscriptionSummary, setSubscriptionSummary] = useState(null);
  const [quotaSummary, setQuotaSummary] = useState(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${PAGE_TITLE} | Talepet`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPlans = async () => {
      try {
        setLoading(true);
        const response = await api.get('/public/plans', buildPublicRequestConfig());
        if (!active) {
          return;
        }
        const items = response.data?.data?.items || [];
        setPlans(Array.isArray(items) ? items : []);
        setSelectedModes((prev) => {
          const next = { ...prev };
          (Array.isArray(items) ? items : []).forEach((plan) => {
            const key = plan.id || plan.key;
            if (!next[key]) {
              next[key] = getPreferredMode(plan);
            }
          });
          return next;
        });
        setError('');
      } catch (_requestError) {
        if (!active) {
          return;
        }
        setPlans([]);
        setError('Güncel paket bilgileri alınamadı.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (marketingOnlySurface || !isAuthenticated) {
      setSubscriptionSummary(null);
      setQuotaSummary(null);
      return undefined;
    }

    let active = true;
    const loadRights = async () => {
      try {
        const [subscriptionRes, quotaRes] = await Promise.all([
          api.get('/me/subscription', buildProtectedRequestConfig()),
          api.get('/me/listing-quota', buildProtectedRequestConfig())
        ]);
        if (!active) {
          return;
        }
        setSubscriptionSummary(subscriptionRes.data?.data || null);
        setQuotaSummary(quotaRes.data?.data || null);
      } catch (_requestError) {
        if (!active) {
          return;
        }
        setSubscriptionSummary(null);
        setQuotaSummary(null);
      }
    };

    loadRights();
    return () => {
      active = false;
    };
  }, [isAuthenticated, marketingOnlySurface]);

  const premiumActive = Boolean(
    subscriptionSummary?.premiumActive ||
      (user?.isPremium && (!user?.premiumUntil || new Date(user.premiumUntil) > new Date()))
  );
  const featuredCredits = subscriptionSummary?.featuredCredits ?? user?.featuredCredits ?? 0;
  const paidListingCredits = subscriptionSummary?.paidListingCredits ?? quotaSummary?.paidCredits ?? 0;
  const planCountLabel = quotaSummary ? `${quotaSummary.remaining}/${quotaSummary.limit}` : '-';

  const packageCards = useMemo(
    () =>
      PACKAGE_CONFIGS.map((config) => {
        const plan = findPlan(plans, config.keys);
        const stateKey = plan?.id || plan?.key || config.id;
        const selectedMode = selectedModes[stateKey] || getPreferredMode(plan);
        return {
          ...config,
          plan,
          selectedMode,
          selectedPlanCode: getPlanCode(plan, selectedMode),
          modes: getAvailableModes(plan),
          stateKey
        };
      }),
    [plans, selectedModes]
  );

  const updateSelectedMode = (card, mode) => {
    setSelectedModes((prev) => ({
      ...prev,
      [card.stateKey]: mode
    }));
  };

  const resolveRightLabel = (card) => {
    if (card.id === 'premium' && premiumActive) {
      return 'Aktif hakkın var';
    }
    if (card.id === 'featured' && Number(featuredCredits) > 0) {
      return `Kalan hak: ${featuredCredits}`;
    }
    if (card.id === 'extra' && Number(paidListingCredits) > 0) {
      return `Kalan hak: ${paidListingCredits}`;
    }
    return '';
  };

  const handlePurchase = async (card) => {
    if (marketingOnlySurface) {
      window.location.href = buildSurfaceHref('app', WEBSITE_PACKAGES_PATH);
      return;
    }

    if (!card.selectedPlanCode) {
      setError('Bu paket şu anda kullanılamıyor.');
      return;
    }

    if (!PREMIUM_PURCHASES_ENABLED) {
      setError(PREMIUM_PURCHASE_DISABLED_MESSAGE);
      return;
    }

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      setProcessing(card.selectedPlanCode);
      setError('');
      const response = await api.post(
        '/billing/checkout',
        { planCode: card.selectedPlanCode },
        buildProtectedRequestConfig()
      );
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      const message =
        requestError.response?.data?.message || 'Dijital paket başlatılamadı. Lütfen tekrar dene.';
      setError(message);
    } finally {
      setProcessing('');
    }
  };

  return (
    <div className="pricing-page-shell pricing-page-shell--packages">
      <PublicTopBar title={PAGE_TITLE} />

      <main className="premium-page premium-page--modern pricing-premium-page">
        {error ? (
          <div className="premium-modern-alert premium-modern-alert--error">
            <strong>Bilgi</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <section className="premium-modern-hero">
          <div className="premium-modern-hero__copy">
            <span className="premium-modern-eyebrow">Paketler ve fiyatlandırma</span>
            <h1>Talebini Daha Fazla Kişiye Göster</h1>
            <p>
              Premium ve öne çıkarma haklarıyla taleplerin daha görünür olsun, daha hızlı teklif al.
            </p>
          </div>
          <div className="premium-rights-strip" aria-label="Hak özeti">
            <div>
              <span>Premium</span>
              <strong>{premiumActive ? 'Aktif' : 'Pasif'}</strong>
            </div>
            <div>
              <span>Öne çıkarma</span>
              <strong>{featuredCredits}</strong>
            </div>
            <div>
              <span>Ek hak</span>
              <strong>{paidListingCredits}</strong>
            </div>
            <div>
              <span>İlan hakkı</span>
              <strong>{planCountLabel}</strong>
            </div>
          </div>
        </section>

        <section className="premium-package-stack" aria-label="Paket seçenekleri">
          {loading ? <div className="premium-modern-skeleton">Paketler yükleniyor...</div> : null}
          {!loading && !packageCards.some((card) => card.plan) ? (
            <div className="premium-modern-alert">
              <strong>Şu anda kullanılamıyor</strong>
              <p>Aktif paket bulunamadı. Fiyatlar admin panelden tanımlandığında burada görünür.</p>
            </div>
          ) : null}
          {!loading
            ? packageCards.map((card) => {
                const hasPlan = Boolean(card.plan);
                const isProcessing = processing === card.selectedPlanCode;
                const rightLabel = resolveRightLabel(card);
                return (
                  <article
                    key={card.id}
                    className={`premium-package-card premium-package-card--${card.theme}`}
                  >
                    <div className="premium-package-card__header">
                      <span className="premium-package-card__badge">{card.badge}</span>
                      {rightLabel ? <span className="premium-package-card__right">{rightLabel}</span> : null}
                    </div>
                    <div className="premium-package-card__body">
                      <h2>{card.title}</h2>
                      <p>{card.description}</p>
                    </div>
                    {hasPlan ? (
                      <div className="premium-package-card__pricing">
                        <strong>{getModePrice(card.plan, card.selectedMode)}</strong>
                        <span>
                          {getModeLabel(card.selectedMode)} · {getModeDuration(card.plan, card.selectedMode)}
                        </span>
                      </div>
                    ) : (
                      <div className="premium-package-card__pricing premium-package-card__pricing--unavailable">
                        <strong>Şu anda kullanılamıyor</strong>
                        <span>Admin panelden aktif paket tanımlanınca burada görünür.</span>
                      </div>
                    )}
                    {hasPlan && card.modes.length > 1 ? (
                      <div className="premium-package-modes" aria-label={`${card.title} ödeme aralığı`}>
                        {card.modes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`premium-package-mode ${card.selectedMode === mode ? 'is-active' : ''}`}
                            onClick={() => updateSelectedMode(card, mode)}
                          >
                            {getModeLabel(mode)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <ul className="premium-package-features">
                      {card.features.map((feature) => (
                        <li key={feature}>
                          <span aria-hidden="true">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="premium-package-cta"
                      onClick={() => handlePurchase(card)}
                      disabled={!hasPlan || isProcessing}
                    >
                      {marketingOnlySurface
                        ? 'Uygulamaya Git'
                        : isProcessing
                          ? 'Yönlendiriliyor...'
                          : hasPlan
                            ? card.cta
                            : card.unavailableCta}
                    </button>
                  </article>
                );
              })
            : null}
        </section>

        <section className="premium-comparison-card">
          <div className="premium-comparison-card__header">
            <span className="premium-modern-eyebrow">Karşılaştırma</span>
            <h2>Hangi paket sana uygun?</h2>
          </div>
          <div className="premium-comparison-grid" role="table" aria-label="Paket karşılaştırması">
            <div className="premium-comparison-grid__head" role="row">
              <span role="columnheader">Özellik</span>
              <span role="columnheader">Standart</span>
              <span role="columnheader">Öne Çıkan</span>
              <span role="columnheader">Premium</span>
            </div>
            {COMPARISON_ROWS.map((row) => (
              <div key={row.label} className="premium-comparison-grid__row" role="row">
                <span role="cell">{row.label}</span>
                <span role="cell" className={row.standard ? 'is-included' : ''}>
                  {row.standard ? '✓' : '—'}
                </span>
                <span role="cell" className={row.featured ? 'is-included' : ''}>
                  {row.featured ? '✓' : '—'}
                </span>
                <span role="cell" className={row.premium ? 'is-included' : ''}>
                  {row.premium ? '✓' : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="premium-service-note">
          <strong>Dijital hizmet modeli</strong>
          <p>
            Talepet kullanıcılar arasında ödeme aracılığı yapmaz. Satın aldığın paketler yalnızca
            Talepet içindeki görünürlük, premium rozet ve ek talep yayınlama haklarıdır.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default PricingPage;
