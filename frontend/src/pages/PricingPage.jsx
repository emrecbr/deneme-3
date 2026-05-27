import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { buildProtectedRequestConfig, buildPublicRequestConfig } from '../api/axios';
import PublicFooter from '../components/PublicFooter';
import PublicTopBar from '../components/PublicTopBar';
import { PRICING_PAGE_CONTENT } from '../content/pricingContent';
import visaBadge from '../assets/payment/visa-badge.svg';
import mastercardBadge from '../assets/payment/mastercard-badge.svg';
import iyzicoBadge from '../assets/payment/iyzico-badge.svg';
import { WEBSITE_PACKAGES_PATH, buildSurfaceHref, isWebSurfaceHost } from '../config/surfaces';
import { useAuth } from '../context/AuthContext';
import {
  PREMIUM_PURCHASE_DISABLED_MESSAGE,
  PREMIUM_PURCHASES_ENABLED
} from '../config/featureFlags';

const formatMoney = (value, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const FALLBACK_PUBLIC_PLANS = [
  {
    id: 'listing_extra_public',
    key: 'listing_extra',
    title: 'Ek İlan Hakkı',
    badgeLabel: 'Esnek',
    shortDescription: 'Ücretsiz ilan hakkın dolduğunda hesabına ek ilan hakkı tanımlar.',
    longDescription: 'Bu paket fiziksel ürün değil, platform içi dijital yayın hakkıdır.',
    billingModes: ['one_time'],
    currency: 'TRY',
    monthlyPrice: 99,
    yearlyPrice: 0,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: '+1 ek ilan hakkı',
      featuredDurationDays: { monthly: 0, yearly: 0 },
      premiumBadgeIncluded: false,
      visibilityBoostLabel: 'Ek yayın hakkı sağlar',
      offerPriorityLabel: 'Dahil değil',
      durationLabels: {
        monthly: 'Tek seferlik hak aktivasyonu',
        yearly: 'Tek seferlik hak aktivasyonu'
      }
    },
    disclaimer:
      'Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme aracılığı yapmaz.'
  },
  {
    id: 'featured_listing',
    key: 'featured_listing',
    title: 'Öne Çıkarma Paketi',
    badgeLabel: 'Öne Çıkan',
    shortDescription: 'Seçilen talebin daha dikkat çekici görünmesini sağlar.',
    longDescription: 'Öne çıkarılan paket dijital görünürlük hizmetidir.',
    billingModes: ['monthly', 'yearly'],
    currency: 'TRY',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan hakların korunur',
      featuredDurationDays: { monthly: 7, yearly: 30 },
      premiumBadgeIncluded: false,
      visibilityBoostLabel: 'Seçilen ilanı daha yüksek görünür kılar',
      offerPriorityLabel: 'Talebin daha hızlı fark edilmesine yardımcı olur',
      durationLabels: {
        monthly: '7 gün öne çıkarma etkisi',
        yearly: '30 gün öne çıkarma etkisi'
      }
    },
    disclaimer:
      'Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme aracılığı yapmaz.'
  },
  {
    id: 'premium_listing',
    key: 'premium_listing',
    title: 'Premium Paket',
    badgeLabel: 'Popüler',
    shortDescription: 'Premium hesap rozeti ve daha fazla profil görünürlüğü sağlar.',
    longDescription: 'Premium paket platform içi dijital hesap ve görünürlük hizmetidir.',
    billingModes: ['monthly', 'yearly'],
    currency: 'TRY',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan hakların korunur',
      featuredDurationDays: { monthly: 0, yearly: 0 },
      premiumBadgeIncluded: true,
      visibilityBoostLabel: 'Premium rozet ve premium hesap ayrışması',
      offerPriorityLabel: 'Premium hesap sinyali',
      durationLabels: {
        monthly: '30 gün premium hesap aktivasyonu',
        yearly: '365 gün premium hesap aktivasyonu'
      }
    },
    disclaimer:
      'Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme aracılığı yapmaz.'
  }
];

const getBillingSummary = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${formatMoney(plan.monthlyPrice, plan.currency)} / ay - ${formatMoney(plan.yearlyPrice, plan.currency)} / yıl`;
  }
  if (modes.includes('monthly')) {
    return `${formatMoney(plan.monthlyPrice, plan.currency)} / ay`;
  }
  if (modes.includes('yearly')) {
    return `${formatMoney(plan.yearlyPrice, plan.currency)} / yıl`;
  }
  return formatMoney(plan.monthlyPrice || plan.yearlyPrice, plan.currency);
};

const getPlanTypeLabel = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return 'Aylık ve yıllık';
  }
  if (modes.includes('monthly')) {
    return 'Aylık';
  }
  if (modes.includes('yearly')) {
    return 'Yıllık';
  }
  return 'Tek seferlik';
};

const getDurationSummary = (plan) => {
  const durationLabels = plan.entitlements?.durationLabels || {};
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${durationLabels.monthly || '30 gün'} / ${durationLabels.yearly || '365 gün'}`;
  }
  if (modes.includes('monthly')) {
    return durationLabels.monthly || '30 gün';
  }
  if (modes.includes('yearly')) {
    return durationLabels.yearly || '365 gün';
  }
  return durationLabels.monthly || durationLabels.yearly || 'Tek seferlik';
};

const getFeaturedDurationSummary = (plan) => {
  const durations = plan.entitlements?.featuredDurationDays || {};
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (!durations.monthly && !durations.yearly) {
    return 'Yok';
  }
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${durations.monthly || 0} gün / ${durations.yearly || 0} gün`;
  }
  if (modes.includes('monthly')) {
    return `${durations.monthly || 0} gün`;
  }
  if (modes.includes('yearly')) {
    return `${durations.yearly || 0} gün`;
  }
  return `${durations.monthly || durations.yearly || 0} gün`;
};

const getActionLabel = (planKey) => {
  if (planKey === 'listing_extra') {
    return 'Ek İlan Hakkını Başlat';
  }
  if (planKey === 'featured_listing') {
    return 'Öne Çıkarma Paketini Aktifleştir';
  }
  return 'Premium Paketini Aktifleştir';
};

const COMPLIANCE_POINTS = [
  {
    title: 'Premium üyelik',
    body: 'Talepet premium üyelik paketleriyle profil rozeti, görünürlük avantajı ve üyelik hakları satar.'
  },
  {
    title: 'Dijital görünürlük',
    body: 'Öne çıkarma ve premium rozet gibi hizmetler yalnızca platform içi dijital görünürlük hakkıdır.'
  },
  {
    title: 'İlan hakları',
    body: 'Ek ilan kredileri fiziksel ürün değil, platform içinde yeni talep yayını açma hakkıdır.'
  },
  {
    title: 'Kullanıcılar arası ödeme yok',
    body: 'Talepet kullanıcılar arasında ödeme aracılığı yapmaz, escrow sunmaz ve komisyonla para toplamaz.'
  }
];

function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const marketingOnlySurface = isWebSurfaceHost();
  const [plans, setPlans] = useState(FALLBACK_PUBLIC_PLANS);
  const [notice, setNotice] = useState(
    'Talepet yalnızca dijital görünürlük, premium hak ve ilan paketleri satar.'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${PRICING_PAGE_CONTENT.title} | Talepet`;
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
        const payload = response.data?.data || {};
        const items = Array.isArray(payload.items) && payload.items.length ? payload.items : FALLBACK_PUBLIC_PLANS;
        setPlans(items);
        setNotice(payload.notice || notice);
        setError('');
      } catch (_requestError) {
        if (!active) {
          return;
        }
        setPlans(FALLBACK_PUBLIC_PLANS);
        setError('Güncel dijital hizmet paketleri alınamadı. Varsayılan açıklama gösteriliyor.');
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

  const visiblePlans = useMemo(() => plans.slice(0, 6), [plans]);

  const resolveCheckoutPlanCode = (plan) => {
    if (plan.key === 'listing_extra') {
      return 'listing_extra';
    }
    if (plan.key === 'featured_listing') {
      return plan.planCodes?.monthly || 'featured_monthly';
    }
    return plan.planCodes?.monthly || 'premium_monthly';
  };

  const handlePurchase = async (plan) => {
    if (marketingOnlySurface) {
      window.location.href = buildSurfaceHref('app', WEBSITE_PACKAGES_PATH);
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

    const planCode = resolveCheckoutPlanCode(plan);

    try {
      setProcessing(planCode);
      setError('');
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
      const message =
        requestError.response?.data?.message || 'Dijital paket başlatılamadı. Lütfen tekrar dene.';
      setError(message);
    } finally {
      setProcessing('');
    }
  };

  return (
    <div className="pricing-page-shell">
      <PublicTopBar title={PRICING_PAGE_CONTENT.title} />

      <section className="pricing-page-hero">
        <div className="pricing-page-hero__copy">
          <p className="public-eyebrow">{PRICING_PAGE_CONTENT.hero.eyebrow}</p>
          <h1>Talepet Premium Hizmet Paketleri</h1>
          <p className="public-lead">
            Talepet kullanıcılar arasında ödeme aracılığı yapmaz. Platform yalnızca dijital
            görünürlük, premium listeleme ve üyelik hizmetleri sunar.
          </p>
          <div className="pricing-page-highlights">
            {PRICING_PAGE_CONTENT.highlights.map((item) => (
              <div key={item} className="pricing-page-highlight">
                <span className="landing-trust-dot" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="pricing-page-hero__panel">
          <span className="pricing-page-hero__panel-badge">Dijital hizmet modeli</span>
          <h2>Reviewer için net ürün özeti</h2>
          <ul className="pricing-page-hero__panel-list">
            <li>Talepet fiziksel ürün satmaz.</li>
            <li>Talepet kullanıcılar arasında ödeme toplamaz.</li>
            <li>Gelir modeli premium üyelik ve görünürlük paketleridir.</li>
            <li>Ek ilan ve öne çıkarma hakları dijital platform hakkıdır.</li>
          </ul>
        </aside>
      </section>

      <section className="pricing-page-trust-grid">
        {PRICING_PAGE_CONTENT.trustCards.map((item) => (
          <article key={item.title} className="public-page-card pricing-page-trust-card">
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="public-page-card pricing-page-card-grid-wrap">
        <div className="pricing-page-card-grid-head">
          <div>
            <p className="public-eyebrow">Dijital hizmet paketleri</p>
            <h2>Paket farkları ve kullanıcı hakları</h2>
            <p>
              Ne satıldığı, hangi hakkın ücretli olduğu ve premium paketlerin ne sağladığı bu
              alanda açıkça listelenir.
            </p>
          </div>
          <div className="pricing-page-badges" aria-label="Ödeme göstergeleri">
            <img src={visaBadge} alt="Visa" className="public-payment-badge" />
            <img src={mastercardBadge} alt="MasterCard" className="public-payment-badge" />
            <img
              src={iyzicoBadge}
              alt="iyzico ile öde"
              className="public-payment-badge public-payment-badge-wide"
            />
          </div>
        </div>

        <div className="pricing-page-service-note">{notice}</div>
        {!marketingOnlySurface && !PREMIUM_PURCHASES_ENABLED ? (
          <div className="website-profile-state-card">
            <strong>Yakında aktif</strong>
            <p>
              Premium paket satın alma yakında aktif olacak. Uygulama tarafında paket kartları
              inceleme amaçlı görünür; ödeme henüz başlatılmaz.
            </p>
          </div>
        ) : null}

        {loading ? <div className="website-profile-state-card">Paketler yükleniyor...</div> : null}
        {!loading && error ? (
          <div className="website-profile-state-card">
            <p>{error}</p>
            <button type="button" className="secondary-btn" onClick={() => window.location.reload()}>
              Tekrar Dene
            </button>
          </div>
        ) : null}

        <div className="pricing-page-card-grid">
          {visiblePlans.map((plan) => (
            <article key={plan.id || plan.key} className="pricing-plan-card pricing-plan-card--detailed">
              <div className="pricing-plan-card__meta">
                <span className="pricing-plan-card__badge">
                  {plan.entitlements?.digitalServiceLabel || 'Dijital hizmet paketi'}
                </span>
                <strong>{plan.title}</strong>
                {plan.badgeLabel ? (
                  <span className="pricing-plan-card__badge pricing-plan-card__badge--accent">
                    {plan.badgeLabel}
                  </span>
                ) : null}
              </div>
              <p>{plan.shortDescription}</p>
              <div className="pricing-plan-card__price">{getBillingSummary(plan)}</div>
              <div className="pricing-plan-card__duration">
                {getPlanTypeLabel(plan)} · {getDurationSummary(plan)}
              </div>

              <dl className="pricing-plan-card__facts">
                <div>
                  <dt>Kaç ilan hakkı</dt>
                  <dd>{plan.entitlements?.listingRights || 'Belirtilmedi'}</dd>
                </div>
                <div>
                  <dt>Öne çıkarılma süresi</dt>
                  <dd>{getFeaturedDurationSummary(plan)}</dd>
                </div>
                <div>
                  <dt>Premium badge</dt>
                  <dd>{plan.entitlements?.premiumBadgeIncluded ? 'Var' : 'Yok'}</dd>
                </div>
                <div>
                  <dt>Daha fazla görünürlük</dt>
                  <dd>{plan.entitlements?.visibilityBoostLabel || 'Belirtilmedi'}</dd>
                </div>
                <div>
                  <dt>Teklif önceliği</dt>
                  <dd>{plan.entitlements?.offerPriorityLabel || 'Dahil değil'}</dd>
                </div>
                <div>
                  <dt>Plan tipi</dt>
                  <dd>{getPlanTypeLabel(plan)}</dd>
                </div>
                <div>
                  <dt>Fiyat</dt>
                  <dd>{getBillingSummary(plan)}</dd>
                </div>
              </dl>

              <div className="pricing-plan-card__service-note">
                {plan.disclaimer ||
                  'Bu ödeme dijital platform hizmeti içindir. Talepet kullanıcılar arasında ödeme aracılığı yapmaz.'}
              </div>
              <button
                type="button"
                className="landing-primary-button pricing-plan-card__cta"
                onClick={() => handlePurchase(plan)}
                disabled={!marketingOnlySurface && processing === resolveCheckoutPlanCode(plan)}
              >
                {marketingOnlySurface
                  ? 'Uygulamaya Git'
                  : processing === resolveCheckoutPlanCode(plan)
                    ? 'Yönlendiriliyor...'
                    : getActionLabel(plan.key)}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="public-page-card pricing-page-compliance">
        <div className="pricing-page-compliance__intro">
          <p className="public-eyebrow">Gelir modeli</p>
          <h2>Talepet Nasıl Gelir Elde Eder?</h2>
          <p>
            Talepet kullanıcılar arasında ödeme yapılan bir pazar yeri değildir. Platform gelirini
            premium üyelik, dijital görünürlük, öne çıkarma hakları ve ek ilan kredilerinden elde
            eder.
          </p>
        </div>
        <div className="pricing-page-compliance__grid">
          {COMPLIANCE_POINTS.map((item) => (
            <article key={item.title} className="pricing-page-compliance__item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-page-card pricing-page-legal">
        <div className="pricing-page-legal__copy">
          <p className="public-eyebrow">Güven ve hukuki görünürlük</p>
          <h2>Kurumsal ve yasal sayfalar tek tıkla ulaşılabilir durumda.</h2>
          <p>
            Talepet fiziksel ürün mağazası değil; platform içi premium görünürlük, öne çıkarma ve
            ek ilan hakkı gibi dijital hizmetler sunar. Talepet kullanıcılar arasında ödeme
            aracılığı yapmaz.
          </p>
        </div>

        <div className="pricing-page-legal__links">
          {PRICING_PAGE_CONTENT.legalLinks.map((item) => (
            <Link key={item.to} to={item.to} className="pricing-page-legal__link">
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default PricingPage;
