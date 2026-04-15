import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PublicFooter from '../components/PublicFooter';
import PublicTopBar from '../components/PublicTopBar';
import { PRICING_PAGE_CONTENT } from '../content/pricingContent';
import visaBadge from '../assets/payment/visa-badge.svg';
import mastercardBadge from '../assets/payment/mastercard-badge.svg';
import iyzicoBadge from '../assets/payment/iyzico-badge.svg';
import { useAuth } from '../context/AuthContext';

const formatMoney = (value, currency = 'TRY') =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const transformPlansToCards = (plans = []) =>
  plans
    .filter((plan) => plan.key === 'premium_listing' || plan.key === 'featured_listing')
    .flatMap((plan) => {
      const items = [];
      const modes = Array.isArray(plan.billingModes) ? plan.billingModes : [];

      if (modes.includes('monthly')) {
        items.push({
          key: plan.metadata?.planCodes?.monthly || `${plan.key}_monthly`,
          title:
            plan.key === 'premium_listing' ? 'Aylik Premium Paket' : 'Aylik One Cikarilan Ilan',
          description: plan.shortDescription || plan.title,
          priceLabel: formatMoney(plan.monthlyPrice, plan.currency),
          duration:
            plan.key === 'premium_listing' ? '30 gunluk premium gorunurluk' : '30 gunluk one cikarma',
          actionType: 'premium'
        });
      }

      if (modes.includes('yearly')) {
        items.push({
          key: plan.metadata?.planCodes?.yearly || `${plan.key}_yearly`,
          title:
            plan.key === 'premium_listing' ? 'Yillik Premium Paket' : 'Yillik One Cikarilan Ilan',
          description: plan.shortDescription || plan.title,
          priceLabel: formatMoney(plan.yearlyPrice, plan.currency),
          duration:
            plan.key === 'premium_listing' ? '12 aylik premium gorunurluk' : '12 aylik one cikarma',
          actionType: 'premium'
        });
      }

      return items;
    });

function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [cards, setCards] = useState(PRICING_PAGE_CONTENT.fallbackCards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const response = await api.get('/app/monetization/plans');
        if (!active) return;
        const items = transformPlansToCards(response.data?.items || []);
        const extraListingCard = PRICING_PAGE_CONTENT.fallbackCards.find((item) => item.key === 'listing_extra');
        setCards(items.length ? [...items, extraListingCard].filter(Boolean) : PRICING_PAGE_CONTENT.fallbackCards);
        setError('');
      } catch (_requestError) {
        if (!active) return;
        setCards(PRICING_PAGE_CONTENT.fallbackCards);
        setError('Guncel paketler yuklenemedi. Varsayilan dijital hizmet kartlari gosteriliyor.');
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

  const visibleCards = useMemo(() => cards.slice(0, 6), [cards]);

  const handlePurchase = (card) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (card.actionType === 'create') {
      navigate('/create');
      return;
    }

    navigate('/premium');
  };

  return (
    <div className="pricing-page-shell">
      <PublicTopBar title={PRICING_PAGE_CONTENT.title} />

      <section className="public-hero pricing-page-hero">
        <p className="public-eyebrow">{PRICING_PAGE_CONTENT.hero.eyebrow}</p>
        <h1>{PRICING_PAGE_CONTENT.hero.title}</h1>
        <p className="public-lead">{PRICING_PAGE_CONTENT.hero.body}</p>

        <div className="pricing-page-highlights">
          {PRICING_PAGE_CONTENT.highlights.map((item) => (
            <div key={item} className="pricing-page-highlight">
              <span className="landing-trust-dot" aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
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
            <p className="public-eyebrow">Satinalinabilir dijital hizmetler</p>
            <h2>Paketler ve one cikarma araclari</h2>
            <p>
              Iyzico inceleme ekibi icin fiyat, kapsam ve satin alma aksiyonlari tek yerde gorunur
              tutuldu. Her kart mevcut kullanici akisina baglanir; olu CTA birakilmaz.
            </p>
          </div>
          <div className="pricing-page-badges" aria-label="Odeme gostergeleri">
            <img src={visaBadge} alt="Visa" className="public-payment-badge" />
            <img src={mastercardBadge} alt="MasterCard" className="public-payment-badge" />
            <img src={iyzicoBadge} alt="iyzico ile Ode" className="public-payment-badge public-payment-badge-wide" />
          </div>
        </div>

        {loading ? <div className="website-profile-state-card">Paketler yukleniyor...</div> : null}
        {!loading && error ? <div className="website-profile-state-card">{error}</div> : null}

        <div className="pricing-page-card-grid">
          {visibleCards.map((card) => (
            <article key={card.key} className="pricing-plan-card">
              <div className="pricing-plan-card__meta">
                <span className="pricing-plan-card__badge">Dijital hizmet</span>
                <strong>{card.title}</strong>
              </div>
              <p>{card.description}</p>
              <div className="pricing-plan-card__price">{card.priceLabel}</div>
              <div className="pricing-plan-card__duration">{card.duration}</div>
              <div className="pricing-plan-card__service-note">
                Bu paket dijital hizmettir ve aninda aktive edilir.
              </div>
              <button type="button" className="landing-primary-button pricing-plan-card__cta" onClick={() => handlePurchase(card)}>
                Satin Al
              </button>
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
            ek ilan hakki gibi dijital hizmetler sunar. Asagidaki sayfalar odeme, gizlilik ve
            dijital hizmet modelini inceleme ekibine net sekilde gosterir.
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
