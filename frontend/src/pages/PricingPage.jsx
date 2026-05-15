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
    title: 'Ek Ilan Hakki',
    badgeLabel: 'Esnek',
    shortDescription: 'Ucretsiz ilan hakkin doldugunda hesabina ek ilan hakki tanimlar.',
    longDescription: 'Bu paket fiziksel urun degil, platform ici dijital yayin hakkidir.',
    billingModes: ['one_time'],
    currency: 'TRY',
    monthlyPrice: 99,
    yearlyPrice: 0,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: '+1 ek ilan hakki',
      featuredDurationDays: { monthly: 0, yearly: 0 },
      premiumBadgeIncluded: false,
      visibilityBoostLabel: 'Ek yayin hakki saglar',
      offerPriorityLabel: 'Dahil degil',
      durationLabels: {
        monthly: 'Tek seferlik hak aktivasyonu',
        yearly: 'Tek seferlik hak aktivasyonu'
      }
    },
    disclaimer:
      'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'
  },
  {
    id: 'featured_listing',
    key: 'featured_listing',
    title: 'One Cikarma Paketi',
    badgeLabel: 'One Cikan',
    shortDescription: 'Secilen talebin daha dikkat cekici gorunmesini saglar.',
    longDescription: 'One cikarilan paket dijital gorunurluk hizmetidir.',
    billingModes: ['monthly', 'yearly'],
    currency: 'TRY',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan haklarin korunur',
      featuredDurationDays: { monthly: 7, yearly: 30 },
      premiumBadgeIncluded: false,
      visibilityBoostLabel: 'Secilen ilani daha yuksek gorunur kilar',
      offerPriorityLabel: 'Talebin daha hizli fark edilmesine yardimci olur',
      durationLabels: {
        monthly: '7 gun one cikarma etkisi',
        yearly: '30 gun one cikarma etkisi'
      }
    },
    disclaimer:
      'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'
  },
  {
    id: 'premium_listing',
    key: 'premium_listing',
    title: 'Premium Paket',
    badgeLabel: 'Populer',
    shortDescription: 'Premium hesap rozeti ve daha fazla profil gorunurlugu saglar.',
    longDescription: 'Premium paket platform ici dijital hesap ve gorunurluk hizmetidir.',
    billingModes: ['monthly', 'yearly'],
    currency: 'TRY',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    entitlements: {
      digitalServiceLabel: 'Dijital hizmet paketi',
      listingRights: 'Standart ilan haklarin korunur',
      featuredDurationDays: { monthly: 0, yearly: 0 },
      premiumBadgeIncluded: true,
      visibilityBoostLabel: 'Premium rozet ve premium hesap ayrismasi',
      offerPriorityLabel: 'Premium hesap sinyali',
      durationLabels: {
        monthly: '30 gun premium hesap aktivasyonu',
        yearly: '365 gun premium hesap aktivasyonu'
      }
    },
    disclaimer:
      'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'
  }
];

const getBillingSummary = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${formatMoney(plan.monthlyPrice, plan.currency)} / ay - ${formatMoney(plan.yearlyPrice, plan.currency)} / yil`;
  }
  if (modes.includes('monthly')) {
    return `${formatMoney(plan.monthlyPrice, plan.currency)} / ay`;
  }
  if (modes.includes('yearly')) {
    return `${formatMoney(plan.yearlyPrice, plan.currency)} / yil`;
  }
  return formatMoney(plan.monthlyPrice || plan.yearlyPrice, plan.currency);
};

const getPlanTypeLabel = (plan) => {
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return 'Aylik ve yillik';
  }
  if (modes.includes('monthly')) {
    return 'Aylik';
  }
  if (modes.includes('yearly')) {
    return 'Yillik';
  }
  return 'Tek seferlik';
};

const getDurationSummary = (plan) => {
  const durationLabels = plan.entitlements?.durationLabels || {};
  const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];
  if (modes.includes('monthly') && modes.includes('yearly')) {
    return `${durationLabels.monthly || '30 gun'} / ${durationLabels.yearly || '365 gun'}`;
  }
  if (modes.includes('monthly')) {
    return durationLabels.monthly || '30 gun';
  }
  if (modes.includes('yearly')) {
    return durationLabels.yearly || '365 gun';
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
    return `${durations.monthly || 0} gun / ${durations.yearly || 0} gun`;
  }
  if (modes.includes('monthly')) {
    return `${durations.monthly || 0} gun`;
  }
  if (modes.includes('yearly')) {
    return `${durations.yearly || 0} gun`;
  }
  return `${durations.monthly || durations.yearly || 0} gun`;
};

const getActionLabel = (planKey) => {
  if (planKey === 'listing_extra') {
    return 'Ek Ilan Hakkini Baslat';
  }
  if (planKey === 'featured_listing') {
    return 'One Cikarma Paketini Aktiflestir';
  }
  return 'Premium Paketini Aktiflestir';
};

const COMPLIANCE_POINTS = [
  {
    title: 'Premium uyelik',
    body: 'Talepet premium uyelik paketleriyle profil rozeti, gorunurluk avantaji ve uyelik haklari satar.'
  },
  {
    title: 'Dijital gorunurluk',
    body: 'One cikarma ve premium rozet gibi hizmetler yalnizca platform ici dijital gorunurluk hakkidir.'
  },
  {
    title: 'Ilan haklari',
    body: 'Ek ilan kredileri fiziksel urun degil, platform icinde yeni talep yayini acma hakkidir.'
  },
  {
    title: 'Kullanicilar arasi odeme yok',
    body: 'Talepet kullanicilar arasinda odeme araciligi yapmaz, escrow sunmaz ve komisyonla para toplamaz.'
  }
];

function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const marketingOnlySurface = isWebSurfaceHost();
  const [plans, setPlans] = useState(FALLBACK_PUBLIC_PLANS);
  const [notice, setNotice] = useState(
    'Talepet yalnizca dijital gorunurluk, premium hak ve ilan paketleri satar.'
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
        setError('Guncel dijital hizmet paketleri alinamadi. Varsayilan aciklama gosteriliyor.');
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
        requestError.response?.data?.message || 'Dijital paket baslatilamadi. Lutfen tekrar dene.';
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
            Talepet kullanicilar arasinda odeme araciligi yapmaz. Platform yalnizca dijital
            gorunurluk, premium listeleme ve uyelik hizmetleri sunar.
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
          <h2>Reviewer icin net urun ozeti</h2>
          <ul className="pricing-page-hero__panel-list">
            <li>Talepet fiziksel urun satmaz.</li>
            <li>Talepet kullanicilar arasinda odeme toplamaz.</li>
            <li>Gelir modeli premium uyelik ve gorunurluk paketleridir.</li>
            <li>Ek ilan ve one cikarma haklari dijital platform hakkidir.</li>
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
            <h2>Paket farklari ve kullanici haklari</h2>
            <p>
              Ne satildigi, hangi hakkin ucretli oldugu ve premium paketlerin ne sagladigi bu
              alanda acikca listelenir.
            </p>
          </div>
          <div className="pricing-page-badges" aria-label="Odeme gostergeleri">
            <img src={visaBadge} alt="Visa" className="public-payment-badge" />
            <img src={mastercardBadge} alt="MasterCard" className="public-payment-badge" />
            <img
              src={iyzicoBadge}
              alt="iyzico ile ode"
              className="public-payment-badge public-payment-badge-wide"
            />
          </div>
        </div>

        <div className="pricing-page-service-note">{notice}</div>

        {loading ? <div className="website-profile-state-card">Paketler yukleniyor...</div> : null}
        {!loading && error ? <div className="website-profile-state-card">{error}</div> : null}

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
                  <dt>Kac ilan hakki</dt>
                  <dd>{plan.entitlements?.listingRights || 'Belirtilmedi'}</dd>
                </div>
                <div>
                  <dt>One cikarilma suresi</dt>
                  <dd>{getFeaturedDurationSummary(plan)}</dd>
                </div>
                <div>
                  <dt>Premium badge</dt>
                  <dd>{plan.entitlements?.premiumBadgeIncluded ? 'Var' : 'Yok'}</dd>
                </div>
                <div>
                  <dt>Daha fazla gorunurluk</dt>
                  <dd>{plan.entitlements?.visibilityBoostLabel || 'Belirtilmedi'}</dd>
                </div>
                <div>
                  <dt>Teklif onceligi</dt>
                  <dd>{plan.entitlements?.offerPriorityLabel || 'Dahil degil'}</dd>
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
                  'Bu odeme dijital platform hizmeti icindir. Talepet kullanicilar arasinda odeme araciligi yapmaz.'}
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
                    ? 'Yonlendiriliyor...'
                    : getActionLabel(plan.key)}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="public-page-card pricing-page-compliance">
        <div className="pricing-page-compliance__intro">
          <p className="public-eyebrow">Gelir modeli</p>
          <h2>Talepet Nasil Gelir Elde Eder?</h2>
          <p>
            Talepet kullanicilar arasinda odeme yapilan bir pazar yeri degildir. Platform gelirini
            premium uyelik, dijital gorunurluk, one cikarma haklari ve ek ilan kredilerinden elde
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
          <p className="public-eyebrow">Guven ve hukuki gorunurluk</p>
          <h2>Kurumsal ve yasal sayfalar tek tikla ulasilabilir durumda.</h2>
          <p>
            Talepet fiziksel urun magazasi degil; platform ici premium gorunurluk, one cikarma ve
            ek ilan hakki gibi dijital hizmetler sunar. Talepet kullanicilar arasinda odeme
            araciligi yapmaz.
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
