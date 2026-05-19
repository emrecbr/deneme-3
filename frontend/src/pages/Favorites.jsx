import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import RFQDiscoveryCard from '../components/RFQDiscoveryCard';
import RFQSkeletonGrid from '../components/RFQSkeletonGrid';
import { formatRfqLocation } from '../utils/rfqFormatters';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

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
      return OBJECT_ID_PATTERN.test(categoryValue) ? 'Talep' : categoryValue;
    }

    const label = categoryValue.name || categoryValue.slug || '';
    return label && !OBJECT_ID_PATTERN.test(label) ? label : 'Talep';
  };

  return (
    <div className={`page ${isWebSurface ? 'website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modulu</p>
            <h2>Favorilerim</h2>
            <p>Kaydettigin talepleri website shell icinde yeniden ac ve yonet.</p>
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
        {loading ? <RFQSkeletonGrid count={2} /> : null}

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
                    locationLabel={formatRfqLocation(rfq)}
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
                <div className="empty-illustration">*</div>
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
