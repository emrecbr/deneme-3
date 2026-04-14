import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';

function ProfileOffers({ surfaceVariant = 'app' }) {
  const isWebSurface = surfaceVariant === 'web';
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const fetchOffers = async () => {
      try {
        const response = await api.get('/offers?user=currentUser');
        if (!ignore) {
          setOffers(response.data?.data || response.data?.items || []);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.response?.data?.message || 'Teklifler alınamadı.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchOffers();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className={`page ${isWebSurface ? 'website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modülü</p>
            <h2>Tekliflerim</h2>
            <p>Verdiğin teklifleri ve durumlarını web-first görünümle izle.</p>
          </div>
        </div>
      ) : (
        <div className="profile-topbar">
          <BackIconButton />
          <h1>Tekliflerim</h1>
          <span className="topbar-spacer" aria-hidden="true" />
        </div>
      )}

      {loading ? <div className="card">Yükleniyor...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        offers.length ? (
          offers.map((item) => (
            <article key={item._id} className={`card profile-item ${isWebSurface ? 'website-profile-record-card' : ''}`}>
              <strong>{item.rfq?.title || 'RFQ'}</strong>
              <div className="rfq-sub">Fiyat: {item.price}</div>
              <div className="rfq-sub">Teslim: {item.deliveryTime} gün</div>
              <div className="rfq-sub">Durum: {item.status}</div>
              <div className="rfq-sub">Kabul: {item.status === 'accepted' ? 'Evet' : 'Hayır'}</div>
            </article>
          ))
        ) : (
          <div className="card empty-state">Henüz teklif vermediniz.</div>
        )
      ) : null}
    </div>
  );
}

export default ProfileOffers;
