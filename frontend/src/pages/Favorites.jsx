import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import RFQDiscoveryCard from '../components/RFQDiscoveryCard';

function Favorites({ surfaceVariant = 'app' }) {
  const BACKEND_ORIGIN = API_BASE_URL.replace('/api', '');
  const isWebSurface = surfaceVariant === 'web';
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFavorites = useCallback(async (options = {}) => {
    const { isActive = () => true } = options;
    try {
      if (!isActive()) {
        return;
      }
      setLoading(true);
      const response = await api.get('/users/favorites');
      if (!isActive()) {
        return;
      }
      setItems(response.data?.data || response.data?.items || []);
      setError('');
    } catch (requestError) {
      if (!isActive()) {
        return;
      }
      setItems([]);
      setError(requestError.response?.data?.message || 'Favoriler alinamadi.');
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchFavorites({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [fetchFavorites]);

  const getImage = (rfq) => {
    const avatarPath =
      rfq?.buyer?.avatar ||
      rfq?.buyer?.profileImage ||
      rfq?.user?.avatar ||
      rfq?.user?.profileImage ||
      '';
    if (!avatarPath) {
      return '';
    }
    return `${BACKEND_ORIGIN}${avatarPath}`.replace(/([^:]\/)\/+/g, '$1');
  };

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) {
      return '-';
    }

    if (typeof categoryValue === 'string') {
      return categoryValue;
    }

    return categoryValue.name || categoryValue.slug || '-';
  };

  return (
    <div className={`page ${isWebSurface ? 'website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modülü</p>
            <h2>Favorilerim</h2>
            <p>Kaydettiğin talepleri website shell içinde yeniden aç ve yönet.</p>
          </div>
        </div>
      ) : (
        <div className="profile-topbar">
          <BackIconButton />
          <h1>Favorilerim</h1>
          <span className="topbar-spacer" aria-hidden="true" />
        </div>
      )}
      <section className="card">
      {loading ? (
        <div>
          {[1, 2].map((item) => (
            <div key={item} className="card skeleton-card-wrap">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <div className="card ux-error-state">
          <p>{error}</p>
          <button type="button" className="secondary-btn" onClick={fetchFavorites}>
            Tekrar Dene
          </button>
        </div>
      ) : null}

      {!loading ? (
        <div className={`rfq-grid ${isWebSurface ? 'website-profile-grid' : ''}`}>
          {items.length ? (
            items.map((rfq) => (
              <article key={rfq._id} className="card rfq-card rfq-clickable" onClick={() => navigate(`/rfq/${rfq._id}`)}>
                <RFQDiscoveryCard
                  title={rfq.title}
                  categoryLabel={getCategoryName(rfq.category)}
                  locationLabel={rfq.city || rfq.locationLabel || 'Konum bilgisi'}
                  publishedLabel={rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString('tr-TR') : ''}
                  description={rfq.description || (rfq.quantity ? `Miktar: ${rfq.quantity}` : '')}
                  sellerName={rfq?.buyer?.name || rfq?.user?.name || 'Talep sahibi'}
                  sellerVerified={Boolean(rfq?.buyer?.isVerified || rfq?.buyer?.emailVerified || rfq?.buyer?.phoneVerified)}
                  sellerAvatar={getImage(rfq)}
                  isPremium={Boolean(rfq?.isPremium)}
                  isFeatured={Boolean(rfq?.featuredActive || rfq?.isFeatured)}
                  footerHint="Detaya git"
                  variant="compact"
                />
              </article>
            ))
          ) : (
            <div className="empty-state premium-empty">
              <div className="empty-illustration">⭐</div>
              <p>Favori listen bos</p>
              <button type="button" className="secondary-btn" onClick={() => navigate('/app')}>
                Talepleri incele
              </button>
            </div>
          )}
        </div>
      ) : null}
      </section>
    </div>
  );
}

export default Favorites;
