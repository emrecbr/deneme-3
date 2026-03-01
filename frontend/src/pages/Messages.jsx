import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';

function Messages() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chats');
      setChats(response.data?.data || response.data?.items || []);
      setError('');
    } catch (requestError) {
      const statusCode = requestError?.response?.status;
      if (statusCode === 500) {
        setError('Mesajlar alinamadi');
      } else {
        setError('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // Realtime (socket) temporarily disabled for auth stabilization.

  const handleDeleteChat = async (chatId, event) => {
    event.stopPropagation();

    try {
      await api.delete(`/chats/${chatId}`);
      setChats((prev) => prev.filter((item) => item._id !== chatId));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Chat silinemedi.');
    }
  };

  return (
    <div className="page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Mesajlar</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>
      <section className="card">
      {loading ? (
        <div>
          {[1, 2, 3].map((item) => (
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
          <button type="button" className="secondary-btn" onClick={fetchChats}>
            Tekrar Dene
          </button>
        </div>
      ) : null}

      {!loading ? (
        <div className="profile-list">
          {sortedChats.length ? (
            sortedChats.map((chat) => (
              <article key={chat._id} className="profile-item" onClick={() => navigate(`/messages/${chat._id}`)}>
                <strong>{chat.rfq?.title || 'RFQ'}</strong>
                <div>Son mesaj: {chat.lastMessage || 'Henüz mesaj yok'}</div>
                <button type="button" className="secondary-btn" onClick={(event) => handleDeleteChat(chat._id, event)}>
                  Sil
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state premium-empty">
              <div className="empty-illustration">💬</div>
              Henüz mesaj yok
            </div>
          )}
        </div>
      ) : null}
      </section>
    </div>
  );
}

export default Messages;
