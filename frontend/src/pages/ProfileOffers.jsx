import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';

function ProfileOffers() {
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
    <div className="page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Tekliflerim</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>

      {loading ? <div className="card">Yükleniyor...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        offers.length ? (
          offers.map((item) => (
            <article key={item._id} className="card profile-item">
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
