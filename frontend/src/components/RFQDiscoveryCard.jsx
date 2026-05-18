import { FavoriteIcon } from './ui/AppIcons';
import { RfqCategoryIcon } from '../utils/rfqCategoryIcons';

function MetaIcon({ children }) {
  return <span className="rfq-discovery-card__meta-icon" aria-hidden="true">{children}</span>;
}

function SellerAvatar({ sellerAvatar, sellerName }) {
  const initials = String(sellerName || 'T')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'T';

  if (sellerAvatar) {
    return <img src={sellerAvatar} alt="" className="rfq-discovery-card__seller-avatar" loading="lazy" />;
  }

  return <span className="rfq-discovery-card__seller-avatar rfq-discovery-card__seller-avatar--fallback">{initials}</span>;
}

export default function RFQDiscoveryCard({
  title,
  categoryLabel,
  locationLabel,
  publishedLabel,
  description,
  sellerName,
  sellerVerified = false,
  sellerAvatar = '',
  distanceLabel = '',
  isPremium = false,
  isFeatured = false,
  isFavorite = false,
  favoriteAnimating = false,
  onFavoriteToggle = null,
  footerHint = 'Detayi gor',
  className = '',
  variant = 'feed'
}) {
  const premiumLabel = isFeatured ? 'One Cikan' : isPremium ? 'Premium' : '';

  return (
    <div
      className={`rfq-discovery-card rfq-discovery-card--${variant} ${isFeatured ? 'is-featured' : ''} ${isPremium ? 'is-premium' : ''} ${className}`.trim()}
    >
      {premiumLabel ? (
        <span className="rfq-discovery-card__state">
          {premiumLabel}
        </span>
      ) : null}

      {onFavoriteToggle ? (
        <button
          type="button"
          className="rfq-discovery-card__favorite"
          aria-label={isFavorite ? 'Favorilerden cikar' : 'Favorilere ekle'}
          onClick={onFavoriteToggle}
        >
          <FavoriteIcon size={18} active={isFavorite} className={favoriteAnimating ? 'favorite-animating' : ''} />
        </button>
      ) : null}

      <div className="rfq-discovery-card__hero">
        <span className="rfq-discovery-card__icon-shell">
          <RfqCategoryIcon categoryLabel={categoryLabel} size={18} className="rfq-discovery-card__category-icon" />
        </span>

        <div className="rfq-discovery-card__hero-copy">
          <div className="rfq-discovery-card__category-row">
            <span className="rfq-discovery-card__category">{categoryLabel || 'Talep'}</span>
          </div>
          <h3 className="rfq-discovery-card__title">{title || 'Yeni talep'}</h3>
        </div>
      </div>

      <div className="rfq-discovery-card__meta">
        {locationLabel ? (
          <span className="rfq-discovery-card__meta-item">
            <MetaIcon>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </MetaIcon>
            <span>{locationLabel}</span>
          </span>
        ) : null}

        {publishedLabel ? (
          <span className="rfq-discovery-card__meta-item">
            <MetaIcon>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l2.5 1.5" />
              </svg>
            </MetaIcon>
            <span>{publishedLabel}</span>
          </span>
        ) : null}

        {distanceLabel ? (
          <span className="rfq-discovery-card__meta-item">
            <MetaIcon>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" />
                <path d="M12 8.5v3.5l2 2" />
              </svg>
            </MetaIcon>
            <span>{distanceLabel}</span>
          </span>
        ) : null}
      </div>

      <p className="rfq-discovery-card__description">{description || 'Detaya gecerek talebin tum kapsamini inceleyebilirsin.'}</p>

      <div className="rfq-discovery-card__footer">
        <div className="rfq-discovery-card__seller">
          <SellerAvatar sellerAvatar={sellerAvatar} sellerName={sellerName} />
          <div className="rfq-discovery-card__seller-copy">
            <span className="rfq-discovery-card__seller-name">
              {sellerName || 'Talep sahibi'}
            </span>
            <span className="rfq-discovery-card__seller-status">
              {sellerVerified ? 'Dogrulanmis profil' : 'Profil bilgisi'}
            </span>
          </div>
          {sellerVerified ? (
            <span className="rfq-discovery-card__verified" aria-label="Dogrulanmis profil">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 12 3 3 6-6" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
          ) : null}
        </div>

        <span className="rfq-discovery-card__hint">
          {footerHint}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
