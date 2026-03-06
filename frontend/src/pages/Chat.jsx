import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { getSocket } from '../lib/socket';
import BackIconButton from '../components/BackIconButton';

function Chat() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const listRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [offerForm, setOfferForm] = useState({
    price: '',
    deliveryTime: '',
    message: ''
  });

  const currentUserId = useMemo(() => currentUser?.id || currentUser?._id || null, [currentUser]);

  const scrollToBottom = () => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [meResponse, chatResponse, detailResponse] = await Promise.all([
        api.get('/auth/me'),
        api.get(`/chats/${chatId}/messages`),
        api.get(`/chats/${chatId}`)
      ]);

      const payload = meResponse.data?.data || meResponse.data || {};
      setCurrentUser(payload.user || payload || null);
      setMessages(chatResponse.data?.data || []);
      setChat(detailResponse.data?.data || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Sohbet verileri alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUserId || !chatId) {
      return;
    }
    const socket = getSocket({ userId: currentUserId, city: currentUser?.city });
    if (!socket) {
      return;
    }
    socket.emit('join_chat', chatId);

    const onMessage = (payload) => {
      if (!payload || payload.chatId !== chatId) {
        return;
      }
      const nextMessage = payload.message;
      setMessages((prev) => {
        if (!nextMessage || prev.some((item) => item._id === nextMessage._id)) {
          return prev;
        }
        return [...prev, nextMessage];
      });
    };

    const onOfferUpdate = (payload) => {
      if (!payload || payload.chatId !== chatId) {
        return;
      }
      api.get(`/chats/${chatId}`).then((response) => {
        setChat(response.data?.data || null);
      }).catch(() => {});
    };

    socket.on('message', onMessage);
    socket.on('newMessage', onMessage);
    socket.on('offer:update', onOfferUpdate);

    return () => {
      socket.off('message', onMessage);
      socket.off('newMessage', onMessage);
      socket.off('offer:update', onOfferUpdate);
      socket.emit('leave_chat', chatId);
    };
  }, [chatId, currentUser?.city, currentUserId]);

  const sendMessage = async (event) => {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    try {
      const response = await api.post(`/chats/${chatId}/message`, { content: trimmed });
      const nextMessage = response.data?.data;

      setMessages((prev) => {
        if (!nextMessage || prev.some((item) => item._id === nextMessage._id)) {
          return prev;
        }
        return [...prev, nextMessage];
      });

      setContent('');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Mesaj gonderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const handleOfferChange = (event) => {
    const { name, value } = event.target;
    setOfferForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOfferSubmit = async (event) => {
    event.preventDefault();
    if (!chat?.rfq?._id) {
      return;
    }
    setOfferSubmitting(true);
    try {
      const currentOffer = chat?.offer || null;
      if (currentOffer && ['sent', 'viewed', 'countered'].includes(currentOffer.status)) {
        await api.patch(`/offers/${currentOffer._id}`, {
          price: Number(offerForm.price),
          deliveryTime: Number(offerForm.deliveryTime),
          note: offerForm.message
        });
      } else {
        await api.post(`/offers/${chat.rfq._id}`, {
          price: Number(offerForm.price),
          deliveryTime: Number(offerForm.deliveryTime),
          message: offerForm.message
        });
      }
      setOfferForm({ price: '', deliveryTime: '', message: '' });
      const detailResponse = await api.get(`/chats/${chatId}`);
      setChat(detailResponse.data?.data || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Teklif gonderilemedi.');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleOfferAction = async (action) => {
    if (!chat?.offer?._id) {
      return;
    }
    setOfferActionLoading(true);
    try {
      await api.post(`/offers/${chat.offer._id}/${action}`);
      const detailResponse = await api.get(`/chats/${chatId}`);
      setChat(detailResponse.data?.data || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Islem gerceklestirilemedi.');
    } finally {
      setOfferActionLoading(false);
    }
  };

  const formatTime = (dateValue) => {
    if (!dateValue) {
      return '';
    }

    return new Date(dateValue).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const buyerId = chat?.buyer?._id || chat?.buyer;
  const isOwner = Boolean(currentUserId && buyerId && currentUserId === String(buyerId));
  const offer = chat?.offer || null;

  useEffect(() => {
    if (!offer || isOwner) {
      return;
    }
    setOfferForm({
      price: offer.price || '',
      deliveryTime: offer.deliveryTime || '',
      message: offer.message || ''
    });
  }, [isOwner, offer]);

  return (
    <div className="chat-page">
      <div className="profile-topbar">
        <BackIconButton />
        <h1>Mesajlar</h1>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>

      <section className="card">
        <h2>Mesajlasma</h2>
        {loading ? <div className="refresh-text">Yukleniyor...</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {chat?.rfq ? (
          <div className="chat-context">
            <strong>{chat.rfq.title}</strong>
            <div className="chat-meta">
              {isOwner ? 'Alıcı' : 'Tedarikçi'} olarak sohbet ediyorsun.
            </div>
          </div>
        ) : null}

        <div className="chat-list" ref={listRef}>
          {messages.map((item) => {
            const senderId = item?.sender?._id || item?.sender;
            const mine = Boolean(currentUserId && senderId === currentUserId);

            return (
              <article key={item._id} className={mine ? 'chat-bubble mine' : 'chat-bubble'}>
                <div>{item.content}</div>
                <span className="chat-time">{formatTime(item.createdAt)}</span>
              </article>
            );
          })}
        </div>

        {offer ? (
          <div className="chat-offer-card">
            <div className="chat-offer-row">
              <strong>Teklif</strong>
              <span>{offer.price} TL</span>
            </div>
            <div className="chat-offer-row">
              <span>Teslim</span>
              <span>{offer.deliveryTime} gun</span>
            </div>
            {offer.message ? <p>{offer.message}</p> : null}
            {offer.status ? <div className="badge">{offer.status}</div> : null}
            {isOwner ? (
              <div className="offer-actions-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => handleOfferAction('accept')}
                  disabled={offerActionLoading || ['accepted', 'rejected', 'withdrawn', 'completed'].includes(offer.status)}
                >
                  {offerActionLoading ? '...' : 'Kabul Et'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => handleOfferAction('reject')}
                  disabled={offerActionLoading || ['accepted', 'rejected', 'withdrawn', 'completed'].includes(offer.status)}
                >
                  Reddet
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {(!isOwner && (!offer || ['sent', 'viewed', 'countered'].includes(offer.status) || offer.status === 'rejected')) ? (
          <form className="offer-form" onSubmit={handleOfferSubmit}>
            <div className="offer-form-row">
              <input
                type="number"
                name="price"
                placeholder="Fiyat"
                min="0"
                value={offerForm.price}
                onChange={handleOfferChange}
                disabled={offerSubmitting}
                required
              />
              <input
                type="number"
                name="deliveryTime"
                placeholder="Teslim Suresi (gun)"
                min="1"
                value={offerForm.deliveryTime}
                onChange={handleOfferChange}
                disabled={offerSubmitting}
                required
              />
            </div>
            <textarea
              name="message"
              placeholder="Teklif mesaji"
              value={offerForm.message}
              onChange={handleOfferChange}
              rows={3}
              disabled={offerSubmitting}
            />
            <button type="submit" className="primary-btn" disabled={offerSubmitting}>
              {offerSubmitting ? '...' : offer && ['sent', 'viewed', 'countered'].includes(offer.status) ? 'Teklifi Guncelle' : 'Teklif Ver'}
            </button>
          </form>
        ) : null}

        <form className="chat-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Mesajinizi yazin"
            maxLength={2000}
            disabled={sending}
          />
          <button type="submit" className="primary-btn" disabled={sending}>
            {sending ? '...' : 'Gonder'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default Chat;
