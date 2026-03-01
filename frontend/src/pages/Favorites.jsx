import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import BackIconButton from '../components/BackIconButton';

function Favorites() {
  const BACKEND_ORIGIN = API_BASE_URL.replace('/api', '');
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/favorites');
      setItems(response.data?.data || response.data?.items || []);
      setError('');
    } catch (requestError) {
      setItems([]);
      setError(requestError.response?.data?.message || 'Favoriler alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        await fetchFavorites();
      } catch (_error) {
        // handled in fetchFavorites
      }
    };

    run();
  }, []);

  const getImage = (rfq) => {
    if (Array.isArray(rfq.images) && rfq.images.length > 0) {
      return `${BACKEND_ORIGIN}${rfq.images[0]}`;
    }
    return '/placeholders/default.svg';
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
    <div className="page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Favorilerim</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>
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
        <div className="rfq-grid">
          {items.length ? (
            items.map((rfq) => (
              <article key={rfq._id} className="card rfq-card rfq-clickable" onClick={() => navigate(`/rfq/${rfq._id}`)}>
                <div className="rfq-media">
                  <img src={getImage(rfq)} className="rfq-image" alt="rfq" loading="lazy" />
                </div>
                <h3>{rfq.title}</h3>
                <div className="rfq-sub">Kategori: {getCategoryName(rfq.category)}</div>
                <div className="rfq-sub">Miktar: {rfq.quantity}</div>
              </article>
            ))
          ) : (
            <div className="empty-state premium-empty">
              <div className="empty-illustration">⭐</div>
              Favori listen bos
            </div>
          )}
        </div>
      ) : null}
      </section>
    </div>
  );
}

export default Favorites;
