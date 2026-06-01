import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import RFQDiscoveryCard from '../components/RFQDiscoveryCard';
import RFQSkeletonGrid from '../components/RFQSkeletonGrid';
import StatusBadge from '../components/StatusBadge';
import { formatCategoryLabel, formatRfqLocation } from '../utils/rfqFormatters';
import { getRequestStatusLabel } from '../utils/rfqStatus';

function Favorites({ surfaceVariant = 'app' }) {
  const isWebSurface = surfaceVariant === 'web';
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

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
      setError(requestError.response?.data?.message || 'İlan takipleri alınamadı.');
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

  const getCategoryName = (categoryValue) => {
    return formatCategoryLabel(categoryValue, 'Talep');
  };

  const getFollowStatus = (rfq) => {
    const moderationStatus = String(rfq?.moderationStatus || '').toLowerCase();
    if (moderationStatus === 'pending' || moderationStatus === 'flagged') {
      return { label: 'Moderasyonda', tone: 'warning' };
    }
    if (moderationStatus === 'rejected') {
      return { label: 'Yayında değil', tone: 'danger' };
    }

    const label = getRequestStatusLabel(rfq);
    if (label === 'Aktif') {
      return { label, tone: 'success' };
    }
    if (label === 'Süresi doldu') {
      return { label, tone: 'warning' };
    }
    return { label, tone: 'neutral' };
  };

  const getOfferCount = (rfq) => {
    if (Array.isArray(rfq?.offers)) {
      return rfq.offers.length;
    }
    return Number(rfq?.offerCount || rfq?.offersCount || 0);
  };

  const removeFollow = async (event, rfqId) => {
    event.stopPropagation();
    if (!rfqId || removingId) {
      return;
    }

    try {
      setRemovingId(rfqId);
      await api.delete(`/users/favorite/${rfqId}`);
      setItems((prev) => prev.filter((item) => String(item._id) !== String(rfqId)));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'İlan takipten çıkarılamadı.');
    } finally {
      setRemovingId('');
    }
  };

  return (
    <div className={`page ${isWebSurface ? 'website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modülü</p>
            <h2>İlan Takiplerim</h2>
            <p>Takip ettiğin ilanları yeniden aç ve yönet.</p>
          </div>
        </div>
      ) : (
        <div className="profile-topbar">
          <BackIconButton />
          <h1>İlan Takiplerim</h1>
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
              items.map((rfq) => {
                const status = getFollowStatus(rfq);
                const offerCount = getOfferCount(rfq);

                return (
                  <article key={rfq._id} className="card rfq-card rfq-clickable followed-rfq-card" onClick={() => navigate(`/rfq/${rfq._id}`)}>
                    <RFQDiscoveryCard
                      title={rfq.title}
                      categoryLabel={getCategoryName(rfq.category)}
                      locationLabel={formatRfqLocation(rfq)}
                      publishedLabel={rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString('tr-TR') : ''}
                      description={rfq.description || (rfq.quantity ? `Miktar: ${rfq.quantity}` : '')}
                      isPremium={Boolean(rfq?.isPremium)}
                      isFeatured={Boolean(rfq?.featuredActive || rfq?.isFeatured)}
                      variant="compact"
                    />
                    <div className="followed-rfq-card__footer">
                      <div className="followed-rfq-card__meta">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        <span>{offerCount ? `${offerCount} teklif` : 'Henüz teklif yok'}</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-btn followed-rfq-card__remove"
                        onClick={(event) => removeFollow(event, rfq._id)}
                        disabled={removingId === rfq._id}
                      >
                        {removingId === rfq._id ? 'Çıkarılıyor...' : 'Takipten Çıkar'}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state premium-empty">
                <div className="empty-illustration">*</div>
                <p>Henüz takip ettiğiniz ilan yok.</p>
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
