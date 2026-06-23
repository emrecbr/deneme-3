import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';

const getId = (value) => value?._id || value?.id || value || '';

const formatChatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function Messages({ surfaceVariant = 'app' }) {
  const isWebSurface = surfaceVariant === 'web';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const realtimeUpdateKeysRef = useRef(new Map());

  const currentUserId = String(user?.id || user?._id || '');

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  const getOtherParticipantName = (chat) => {
    const buyerId = String(getId(chat?.buyer));
    const supplierId = String(getId(chat?.supplier));
    const currentIsBuyer = currentUserId && buyerId === currentUserId;
    const other = currentIsBuyer ? chat?.supplier : chat?.buyer;
    return other?.name || other?.email || 'Kullanıcı';
  };

  const getOtherParticipantId = (chat) => {
    const buyerId = String(getId(chat?.buyer));
    const supplierId = String(getId(chat?.supplier));
    return currentUserId && buyerId === currentUserId ? supplierId : buyerId;
  };

  const presenceUserIds = useMemo(() => {
    return [...new Set(chats.map((chat) => getOtherParticipantId(chat)).filter(Boolean))];
  }, [chats, currentUserId]);

  const fetchChats = useCallback(async (options = {}) => {
    const { isActive = () => true } = options;
    try {
      if (!isActive()) return;
      setLoading(true);
      const response = await api.get('/chats');
      if (!isActive()) return;
      setChats(response.data?.data || response.data?.items || []);
      setError('');
    } catch (requestError) {
      if (!isActive()) return;
      const statusCode = requestError?.response?.status;
      const message =
        requestError?.response?.data?.message ||
        (statusCode === 500 ? 'Mesajlar alınamadı.' : 'Mesajlara şu an ulaşılamıyor.');
      setError(message);
    } finally {
      if (isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchChats({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [fetchChats]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const socket = getSocket({ userId: currentUserId, city: user?.city });
    if (!socket) return undefined;

    const shouldApplyRealtimeUpdate = (payload) => {
      const keySource = payload?.lastMessageAt || payload?.message?.createdAt || payload?.lastMessage || payload?.message?.content || '';
      if (!payload?.chatId || !keySource) return true;
      const key = `${payload.chatId}:${keySource}`;
      const now = Date.now();
      realtimeUpdateKeysRef.current.forEach((timestamp, itemKey) => {
        if (now - timestamp > 5000) {
          realtimeUpdateKeysRef.current.delete(itemKey);
        }
      });
      if (realtimeUpdateKeysRef.current.has(key)) {
        return false;
      }
      realtimeUpdateKeysRef.current.set(key, now);
      return true;
    };

    const onConversationUpdated = (payload) => {
      if (!payload?.chatId) return;
      if ((payload.lastMessage || payload.lastMessageAt) && !shouldApplyRealtimeUpdate(payload)) return;
      const incrementUnread = payload.incrementUnread ?? String(payload.senderId || '') !== currentUserId;
      setChats((prev) =>
        prev.map((chat) =>
          String(chat._id) === String(payload.chatId)
            ? {
                ...chat,
                lastMessage: payload.lastMessage || chat.lastMessage,
                lastMessageAt: payload.lastMessageAt || chat.lastMessageAt,
                unreadCount:
                  String(payload.readerId || '') === currentUserId
                    ? 0
                    : payload.lastMessage || payload.lastMessageAt
                      ? incrementUnread
                        ? Number(chat.unreadCount || 0) + 1
                        : Number(chat.unreadCount || 0)
                      : Number(chat.unreadCount || 0)
              }
            : chat
        )
      );
    };

    const onNewMessage = (payload) => {
      if (!payload?.chatId) return;
      if (!shouldApplyRealtimeUpdate(payload)) return;
      const senderId = String(getId(payload.message?.sender));
      const isMine = currentUserId && senderId === currentUserId;
      onConversationUpdated({
        chatId: payload.chatId,
        lastMessage: payload.message?.content,
        lastMessageAt: payload.message?.createdAt,
        incrementUnread: !isMine
      });
    };

    const onRead = (payload) => {
      if (!payload?.chatId || String(payload.readerId || '') !== currentUserId) return;
      setChats((prev) =>
        prev.map((chat) =>
          String(chat._id) === String(payload.chatId)
            ? {
                ...chat,
                unreadCount: 0
              }
            : chat
        )
      );
    };

    const onPresence = (payload) => {
      if (!payload?.userId) return;
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (payload.online) {
          next.add(String(payload.userId));
        } else {
          next.delete(String(payload.userId));
        }
        return next;
      });
    };

    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:new', onNewMessage);
    socket.on('newMessage', onNewMessage);
    socket.on('message:read', onRead);
    socket.on('presence:update', onPresence);
    socket.on('presence:online', onPresence);
    socket.on('presence:offline', onPresence);
    presenceUserIds.forEach((otherId) => {
      socket.emit('presence:check', otherId);
    });

    return () => {
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:new', onNewMessage);
      socket.off('newMessage', onNewMessage);
      socket.off('message:read', onRead);
      socket.off('presence:update', onPresence);
      socket.off('presence:online', onPresence);
      socket.off('presence:offline', onPresence);
    };
  }, [currentUserId, presenceUserIds, user?.city]);

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
    <div className={`page ${isWebSurface ? 'website-profile-module' : ''}`}>
      {isWebSurface ? (
        <div className="website-profile-module__header">
          <div>
            <p className="landing-eyebrow">Profil modülü</p>
            <h2>Mesajlar</h2>
            <p>Sohbet listene website içinden eriş, son mesajları takip et ve ilgili talebe dön.</p>
          </div>
        </div>
      ) : (
        <div className="profile-topbar">
          <BackIconButton />
          <h1>Mesajlar</h1>
          <span className="topbar-spacer" aria-hidden="true" />
        </div>
      )}

      <section className="chat-list-page-card">
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
          <div className={`chat-thread-list ${isWebSurface ? 'website-profile-list' : ''}`}>
            {sortedChats.length ? (
              sortedChats.map((chat) => {
                const unreadCount = Number(chat.unreadCount || 0);
                return (
                  <article
                    key={chat._id}
                    className={`chat-thread-card ${unreadCount ? 'has-unread' : ''} ${
                      isWebSurface ? 'website-profile-record-card' : ''
                    }`}
                    onClick={() => {
                      setChats((prev) =>
                        prev.map((item) => (String(item._id) === String(chat._id) ? { ...item, unreadCount: 0 } : item))
                      );
                      navigate(`/messages/${chat._id}`);
                    }}
                  >
                    <div className="chat-thread-avatar" aria-hidden="true">
                      {getOtherParticipantName(chat).slice(0, 1).toLocaleUpperCase('tr-TR')}
                      {onlineUserIds.has(getOtherParticipantId(chat)) ? <span className="chat-online-dot" /> : null}
                    </div>
                    <div className="chat-thread-main">
                      <div className="chat-thread-head">
                        <strong>{getOtherParticipantName(chat)}</strong>
                        <span>{formatChatTime(chat.lastMessageAt || chat.updatedAt)}</span>
                      </div>
                      <div className="chat-thread-context">{chat.rfq?.title || 'Talep sohbeti'}</div>
                      <p>{chat.lastMessage || 'Henüz mesaj yok'}</p>
                    </div>
                    <div className="chat-thread-side">
                      {unreadCount ? <span className="chat-unread-badge">{unreadCount}</span> : null}
                      <button type="button" className="chat-delete-btn" onClick={(event) => handleDeleteChat(chat._id, event)}>
                        Sil
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state premium-empty">
                <div className="empty-illustration">💬</div>
                <p>Henüz mesaj yok</p>
                <button type="button" className="secondary-btn" onClick={() => navigate('/app')}>
                  Ana sayfaya dön
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Messages;
