import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import BackIconButton from '../components/BackIconButton';

function ProfileRequests() {
  const BACKEND_ORIGIN = API_BASE_URL.replace('/api', '');
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('approved');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'approved' || tab === 'pending') {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    let ignore = false;
    const fetchRequests = async () => {
      try {
        const response = await api.get('/rfq?buyer=currentUser&limit=50');
        if (!ignore) {
          setRequests(response.data?.data || response.data?.items || []);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.response?.data?.message || 'Talepler alınamadı.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchRequests();
    return () => {
      ignore = true;
    };
  }, []);

  const getImage = (rfq) => {
    if (Array.isArray(rfq.images) && rfq.images.length > 0) {
      return `${BACKEND_ORIGIN}${rfq.images[0]}`;
    }
    return '/placeholders/default.svg';
  };

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aChat = a.lastChatAt ? new Date(a.lastChatAt).getTime() : 0;
      const bChat = b.lastChatAt ? new Date(b.lastChatAt).getTime() : 0;
      if (aChat !== bChat) return bChat - aChat;
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [requests]);

  const approved = useMemo(() => {
    return sorted.filter((item) => item.status === 'open' || item.status === 'approved' || item.status === 'awarded');
  }, [sorted]);

  const pending = useMemo(() => {
    return sorted.filter((item) => item.status === 'pending' || item.status === 'waiting' || item.status === 'draft');
  }, [sorted]);

  const list = activeTab === 'approved' ? approved : pending;

  return (
    <div className="page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Taleplerim</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>

      {loading ? <div className="card">Yükleniyor...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="detail-tabs">
            <button
              type="button"
              className={activeTab === 'approved' ? 'active' : ''}
              onClick={() => setActiveTab('approved')}
            >
              Onaylananlar
            </button>
            <button
              type="button"
              className={activeTab === 'pending' ? 'active' : ''}
              onClick={() => setActiveTab('pending')}
            >
              Bekleyenler
            </button>
          </div>
          {requests.length ? (
            list.length ? (
              list.map((item) => (
                <article key={item._id} className="card profile-item premium-rfq-card" onClick={() => navigate(`/rfq/${item._id}`)}>
                  <div className="rfq-media">
                    <img src={getImage(item)} className="rfq-image" alt={item.title || 'rfq'} loading="lazy" />
                  </div>
                  <strong>{item.title}</strong>
                  <div className="rfq-sub">Fiyat: {item.targetPrice ? `${item.targetPrice} TL` : 'Belirtilmedi'}</div>
                  <div className="rfq-sub">Durum: {item.status}</div>
                </article>
              ))
            ) : (
              <div className="card empty-state premium-empty">
                {activeTab === 'approved' ? 'Henüz onaylanan talebin yok.' : 'Bekleyen talebin yok.'}
              </div>
            )
          ) : (
            <div className="card empty-state">Henüz talep oluşturmadınız.</div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default ProfileRequests;
