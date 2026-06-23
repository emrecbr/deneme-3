import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/axios';
import { getSocket } from '../lib/socket';
import BackIconButton from '../components/BackIconButton';

const MAX_MESSAGE_LENGTH = 2000;
const TYPING_STOP_DELAY_MS = 1400;
const CHAT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CHAT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

const getId = (value) => value?._id || value?.id || value || '';

const normalizeMessage = (message, fallbackStatus = 'sent') => ({
  ...message,
  _id: message?._id || message?.id || message?.clientId || `local-${Date.now()}`,
  status: message?.status || fallbackStatus
});

const resolveMediaUrl = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^blob:/i.test(value) || /^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace(/\/api\/?$/, '')}${value}`;
  }
  return value;
};

const isSameDay = (left, right) => {
  if (!left || !right) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const formatTime = (dateValue) => {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateLabel = (dateValue) => {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long'
  });
};

const formatLastSeen = (presence) => {
  if (presence?.online) return 'Çevrimiçi';
  if (!presence?.lastSeenAt) return 'Son görülme bilgisi yok';
  const lastSeen = new Date(presence.lastSeenAt);
  const diffMs = Date.now() - lastSeen.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Son görülme: az önce';
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `Son görülme: ${diffMinutes} dk önce`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Son görülme: ${diffHours} sa önce`;
  return `Son görülme: ${lastSeen.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}`;
};

const hasReadReceipt = (message, otherUserId) => {
  if (!message || !otherUserId) return false;
  const readBy = Array.isArray(message.readBy) ? message.readBy.map((item) => String(getId(item))) : [];
  return Boolean(message.readAt || readBy.includes(String(otherUserId)));
};

const mergeIncomingMessage = (items, message, currentUserId) => {
  const nextMessage = normalizeMessage(message);
  const nextId = String(nextMessage._id);
  if (items.some((item) => String(item._id) === nextId)) {
    return items;
  }

  const senderId = String(getId(nextMessage.sender));
  const pendingIndex = items.findIndex(
    (item) =>
      item.status === 'sending' &&
      item.content === nextMessage.content &&
      String(getId(item.sender)) === senderId &&
      senderId === String(currentUserId || '')
  );

  if (pendingIndex >= 0) {
    const copy = [...items];
    copy[pendingIndex] = nextMessage;
    return copy;
  }

  return [...items, nextMessage];
};

function Chat() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const listRef = useRef(null);
  const imageInputRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const typingStopTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const typingIndicatorTimerRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherPresence, setOtherPresence] = useState({ online: false, lastSeenAt: null });
  const [blockState, setBlockState] = useState({
    isBlocked: false,
    blockedByMe: false,
    blockedMe: false,
    otherUserId: ''
  });
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({ reason: 'spam', note: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [offerForm, setOfferForm] = useState({
    price: '',
    deliveryTime: '',
    message: ''
  });

  const currentUserId = useMemo(() => currentUser?.id || currentUser?._id || null, [currentUser]);
  const buyerId = String(getId(chat?.buyer));
  const supplierId = String(getId(chat?.supplier));
  const isOwner = Boolean(currentUserId && buyerId && String(currentUserId) === buyerId);
  const otherUser = isOwner ? chat?.supplier : chat?.buyer;
  const otherUserId = String(getId(otherUser));
  const isChatBlocked = Boolean(blockState?.isBlocked);
  const offer = chat?.offer || null;
  const trimmedContent = content.trim();
  const isMessageTooLong = trimmedContent.length > MAX_MESSAGE_LENGTH;
  const canSend = Boolean(trimmedContent) && !isMessageTooLong && !sending && !isChatBlocked;
  const canSendImage = !imageUploading && !isChatBlocked;
  const rfqLocation = [chat?.rfq?.city?.name, chat?.rfq?.district?.name].filter(Boolean).join(', ');
  const presenceLabel = socketStatus === 'connected' ? formatLastSeen(otherPresence) : 'Bağlantı yeniden kuruluyor';

  const scrollToBottom = (behavior = 'auto') => {
    window.requestAnimationFrame(() => {
      if (!listRef.current) return;
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior
      });
    });
  };

  const updateStickToBottom = () => {
    const node = listRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 96;
  };

  const markConversationRead = useCallback(async () => {
    if (!chatId) return;
    try {
      await api.patch(`/chats/${chatId}/read`);
    } catch (_error) {
      // Read receipts are best-effort; message navigation and sending should not block on them.
    }
  }, [chatId]);

  const stopTyping = useCallback(() => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (!typingActiveRef.current || !currentUserId || !chatId) return;
    const socket = getSocket({ userId: currentUserId, city: currentUser?.city });
    socket?.emit('typing:stop', { chatId });
    typingActiveRef.current = false;
  }, [chatId, currentUser?.city, currentUserId]);

  const handleContentChange = (event) => {
    if (isChatBlocked) return;
    const nextValue = event.target.value.slice(0, MAX_MESSAGE_LENGTH + 1);
    setContent(nextValue);
    if (!currentUserId || !chatId) return;
    const socket = getSocket({ userId: currentUserId, city: currentUser?.city });
    if (!socket) return;
    if (!typingActiveRef.current) {
      socket.emit('typing:start', { chatId });
      typingActiveRef.current = true;
    }
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(stopTyping, TYPING_STOP_DELAY_MS);
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
      setMessages((chatResponse.data?.data || []).map((item) => normalizeMessage(item)));
      const detailData = detailResponse.data?.data || null;
      setChat(detailData);
      setBlockState(
        detailData?.blockState || {
          isBlocked: false,
          blockedByMe: false,
          blockedMe: false,
          otherUserId: ''
        }
      );
      setError('');
      shouldStickToBottomRef.current = true;
      scrollToBottom();
    } catch (requestError) {
      const statusCode = requestError?.response?.status;
      setError(requestError.response?.data?.message || 'Sohbet verileri alınamadı.');
      if (statusCode === 403 || statusCode === 404) {
        window.setTimeout(() => navigate('/messages'), 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [chatId]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  useEffect(() => {
    if (!currentUserId || !chatId) return undefined;
    const socket = getSocket({ userId: currentUserId, city: currentUser?.city });
    if (!socket) {
      setSocketStatus('offline');
      return undefined;
    }

    setSocketStatus(socket.connected ? 'connected' : 'connecting');
    socket.emit('join_chat', chatId);

    const onConnect = () => {
      setSocketStatus('connected');
      if (otherUserId) {
        socket.emit('presence:check', otherUserId);
      }
    };
    const onDisconnect = () => {
      setSocketStatus('reconnecting');
      setIsOtherTyping(false);
      if (typingIndicatorTimerRef.current) {
        window.clearTimeout(typingIndicatorTimerRef.current);
        typingIndicatorTimerRef.current = null;
      }
    };
    const onReconnectAttempt = () => setSocketStatus('reconnecting');
    const onMessage = (payload) => {
      if (!payload || String(payload.chatId) !== String(chatId)) return;
      const shouldScroll = shouldStickToBottomRef.current;
      const senderId = String(getId(payload.message?.sender));
      setMessages((prev) => mergeIncomingMessage(prev, payload.message, currentUserId));
      if (senderId && senderId !== String(currentUserId)) {
        markConversationRead();
      }
      if (shouldScroll) {
        shouldStickToBottomRef.current = true;
      }
    };
    const onRead = (payload) => {
      if (!payload || String(payload.chatId) !== String(chatId)) return;
      const readerId = String(payload.readerId || '');
      const readMessageIds = new Set((payload.messageIds || payload.readMessageIds || []).map((item) => String(item)));
      setMessages((prev) =>
        prev.map((item) => {
          const senderId = String(getId(item.sender));
          const shouldMark =
            readMessageIds.size > 0
              ? readMessageIds.has(String(item._id))
              : readerId && senderId !== readerId;
          if (!shouldMark) return item;
          const readBy = Array.isArray(item.readBy) ? item.readBy.map((entry) => String(getId(entry))) : [];
          return {
            ...item,
            read: true,
            readAt: payload.readAt || item.readAt || new Date().toISOString(),
            readBy: readBy.includes(readerId) ? item.readBy : [...(item.readBy || []), readerId]
          };
        })
      );
    };
    const onTypingStart = (payload) => {
      if (!payload || String(payload.chatId) !== String(chatId) || String(payload.userId) !== otherUserId) return;
      setIsOtherTyping(true);
      if (typingIndicatorTimerRef.current) {
        window.clearTimeout(typingIndicatorTimerRef.current);
      }
      typingIndicatorTimerRef.current = window.setTimeout(() => setIsOtherTyping(false), TYPING_STOP_DELAY_MS + 1200);
    };
    const onTypingStop = (payload) => {
      if (!payload || (payload.chatId && String(payload.chatId) !== String(chatId)) || String(payload.userId) !== otherUserId) return;
      setIsOtherTyping(false);
      if (typingIndicatorTimerRef.current) {
        window.clearTimeout(typingIndicatorTimerRef.current);
        typingIndicatorTimerRef.current = null;
      }
    };
    const onPresence = (payload) => {
      if (!payload || String(payload.userId) !== otherUserId) return;
      setOtherPresence({
        online: Boolean(payload.online),
        lastSeenAt: payload.lastSeenAt || null
      });
    };
    const onOfferUpdate = (payload) => {
      if (!payload || String(payload.chatId) !== String(chatId)) return;
      api.get(`/chats/${chatId}`).then((response) => {
        const detailData = response.data?.data || null;
        setChat(detailData);
        if (detailData?.blockState) {
          setBlockState(detailData.blockState);
        }
      }).catch(() => {});
    };
    const onBlocked = (payload) => {
      if (!payload || String(payload.userId || '') !== otherUserId) return;
      api.get(`/chats/${chatId}`).then((response) => {
        const detailData = response.data?.data || null;
        setChat(detailData);
        setBlockState(
          detailData?.blockState || {
            isBlocked: false,
            blockedByMe: false,
            blockedMe: false,
            otherUserId
          }
        );
      }).catch(() => {});
    };

    if (otherUserId) {
      socket.emit('presence:check', otherUserId);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('message:new', onMessage);
    socket.on('message:sent', onMessage);
    socket.on('message:read', onRead);
    socket.on('newMessage', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('presence:online', onPresence);
    socket.on('presence:offline', onPresence);
    socket.on('offer:update', onOfferUpdate);
    socket.on('chat:blocked', onBlocked);

    return () => {
      stopTyping();
      setIsOtherTyping(false);
      if (typingIndicatorTimerRef.current) {
        window.clearTimeout(typingIndicatorTimerRef.current);
        typingIndicatorTimerRef.current = null;
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('message:new', onMessage);
      socket.off('message:sent', onMessage);
      socket.off('message:read', onRead);
      socket.off('newMessage', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('presence:online', onPresence);
      socket.off('presence:offline', onPresence);
      socket.off('offer:update', onOfferUpdate);
      socket.off('chat:blocked', onBlocked);
      socket.emit('leave_chat', chatId);
    };
  }, [chatId, currentUser?.city, currentUserId, markConversationRead, otherUserId, stopTyping]);

  const replaceOptimisticMessage = (tempId, nextMessage) => {
    const normalized = normalizeMessage(nextMessage);
    setMessages((prev) => {
      const filtered = prev.filter((item) => String(item._id) !== String(tempId) && String(item._id) !== String(normalized._id));
      return [...filtered, normalized].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  };

  const markOptimisticFailed = (tempId) => {
    setMessages((prev) =>
      prev.map((item) =>
        String(item._id) === String(tempId)
          ? {
              ...item,
              status: 'failed'
            }
          : item
      )
    );
  };

  const sendMessageText = async (text, existingTempId = '') => {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId) return;
    if (isChatBlocked) {
      setError('Bu kullanıcıyla mesajlaşamazsınız.');
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
      return;
    }
    stopTyping();

    const tempId = existingTempId || `temp-${Date.now()}`;
    if (!existingTempId) {
      const optimistic = {
        _id: tempId,
        sender: currentUser,
        content: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending'
      };
      shouldStickToBottomRef.current = true;
      setMessages((prev) => [...prev, optimistic]);
      setContent('');
    } else {
      setMessages((prev) =>
        prev.map((item) =>
          String(item._id) === String(existingTempId)
            ? {
                ...item,
                status: 'sending'
              }
            : item
        )
      );
    }

    setSending(true);
    try {
      const response = await api.post(`/chats/${chatId}/message`, { content: trimmed });
      const nextMessage = response.data?.data;
      if (nextMessage) {
        replaceOptimisticMessage(tempId, nextMessage);
      }
      setError('');
    } catch (requestError) {
      markOptimisticFailed(tempId);
      setError(requestError.response?.data?.message || 'Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    await sendMessageText(content);
  };

  const retryMessage = async (message) => {
    if (message.type === 'image' && message.localFile) {
      await sendImageFile(message.localFile, message._id);
      return;
    }
    await sendMessageText(message.content || '', message._id);
  };

  const sendImageFile = async (file, existingTempId = '') => {
    if (!file || !currentUserId) return;
    if (isChatBlocked) {
      setError('Bu kullanıcıyla mesajlaşamazsınız.');
      return;
    }
    if (!CHAT_IMAGE_MIME_TYPES.has(file.type)) {
      setError('Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.');
      return;
    }
    if (file.size > CHAT_IMAGE_MAX_SIZE) {
      setError('Görsel en fazla 5MB olabilir.');
      return;
    }
    stopTyping();

    const tempId = existingTempId || `temp-image-${Date.now()}`;
    if (!existingTempId) {
      const optimistic = {
        _id: tempId,
        sender: currentUser,
        type: 'image',
        content: '',
        mediaUrl: URL.createObjectURL(file),
        localFile: file,
        createdAt: new Date().toISOString(),
        status: 'sending'
      };
      shouldStickToBottomRef.current = true;
      setMessages((prev) => [...prev, optimistic]);
    } else {
      setMessages((prev) =>
        prev.map((item) =>
          String(item._id) === String(existingTempId)
            ? {
                ...item,
                status: 'sending'
              }
            : item
        )
      );
    }

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file, file.name || `chat-image-${Date.now()}.webp`);
      const response = await api.post(`/chats/${chatId}/media`, formData);
      const nextMessage = response.data?.data;
      if (nextMessage) {
        replaceOptimisticMessage(tempId, nextMessage);
      }
      setError('');
    } catch (requestError) {
      markOptimisticFailed(tempId);
      setError(requestError.response?.data?.message || 'Görsel gönderilemedi.');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await sendImageFile(file);
  };

  const openReportModal = (target) => {
    setReportTarget(target);
    setReportForm({ reason: 'spam', note: '' });
    setReportMessage('');
  };

  const closeReportModal = () => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportMessage('');
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportTarget) return;
    setReportSubmitting(true);
    setReportMessage('');
    try {
      const endpoint =
        reportTarget.type === 'message'
          ? `/chats/${chatId}/messages/${reportTarget.messageId}/report`
          : `/chats/${chatId}/report`;
      await api.post(endpoint, reportForm);
      setReportMessage('Şikayetiniz alındı.');
      window.setTimeout(() => {
        setReportTarget(null);
        setReportMessage('');
      }, 900);
    } catch (requestError) {
      setReportMessage(requestError.response?.data?.message || 'Şikayet gönderilemedi.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const toggleBlockUser = async () => {
    if (!otherUserId || blockSubmitting) return;
    setBlockSubmitting(true);
    setError('');
    try {
      if (blockState?.blockedByMe) {
        await api.delete(`/users/${otherUserId}/block`);
      } else {
        await api.post(`/users/${otherUserId}/block`);
      }
      const detailResponse = await api.get(`/chats/${chatId}`);
      const detailData = detailResponse.data?.data || null;
      setChat(detailData);
      setBlockState(
        detailData?.blockState || {
          isBlocked: false,
          blockedByMe: false,
          blockedMe: false,
          otherUserId
        }
      );
      if (!detailData?.blockState?.isBlocked) {
        setError('');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Engelleme işlemi yapılamadı.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleOfferChange = (event) => {
    const { name, value } = event.target;
    setOfferForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOfferSubmit = async (event) => {
    event.preventDefault();
    if (!chat?.rfq?._id) return;
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
      setError(requestError.response?.data?.message || 'Teklif gönderilemedi.');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleOfferAction = async (action) => {
    if (!chat?.offer?._id) return;
    setOfferActionLoading(true);
    try {
      await api.post(`/offers/${chat.offer._id}/${action}`);
      const detailResponse = await api.get(`/chats/${chatId}`);
      setChat(detailResponse.data?.data || null);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'İşlem gerçekleştirilemedi.');
    } finally {
      setOfferActionLoading(false);
    }
  };

  useEffect(() => {
    if (!offer || isOwner) return;
    setOfferForm({
      price: offer.price || '',
      deliveryTime: offer.deliveryTime || '',
      message: offer.message || ''
    });
  }, [isOwner, offer]);

  return (
    <div className="chat-page premium-chat-page">
      <div className="profile-topbar chat-topbar">
        <BackIconButton />
        <div>
          <h1>{otherUser?.name || 'Mesajlar'}</h1>
          <span>{presenceLabel}</span>
        </div>
        <button type="button" className="chat-report-link" onClick={() => openReportModal({ type: 'chat' })}>
          Şikayet
        </button>
        <button type="button" className="chat-report-link" onClick={toggleBlockUser} disabled={blockSubmitting || !otherUserId}>
          {blockState?.blockedByMe ? 'Engeli Kaldır' : 'Engelle'}
        </button>
        <span className="topbar-spacer" aria-hidden="true" />
      </div>

      <section className="chat-shell">
        {loading ? <div className="refresh-text">Yükleniyor...</div> : null}
        {error ? <div className="chat-error-banner">{error}</div> : null}

        {chat?.rfq ? (
          <div className="chat-context-card">
            <div>
              <span>Talep bağlamı</span>
              <strong>{chat.rfq.title}</strong>
              <p>
                {isOwner ? 'Alıcı' : 'Tedarikçi'} olarak sohbet ediyorsunuz.
                {rfqLocation ? ` ${rfqLocation}` : ''}
              </p>
            </div>
            <button type="button" className="secondary-btn" onClick={() => navigate(`/rfq/${chat.rfq._id}`)}>
              Talebi Gör
            </button>
          </div>
        ) : null}

        {socketStatus !== 'connected' ? (
          <div className="chat-connection-state">Bağlantı yeniden kuruluyor</div>
        ) : null}

        {isChatBlocked ? (
          <div className="chat-blocked-state">
            {blockState?.blockedByMe
              ? 'Bu kullanıcıyla mesajlaşma kapalı. Engeli kaldırarak devam edebilirsiniz.'
              : 'Bu kullanıcıyla mesajlaşamazsınız.'}
          </div>
        ) : null}

        <div className="chat-message-list" ref={listRef} onScroll={updateStickToBottom}>
          {!loading && !messages.length ? <div className="chat-empty-state">Henüz mesaj yok</div> : null}
          {messages.map((item, index) => {
            const senderId = String(getId(item?.sender));
            const mine = Boolean(currentUserId && senderId === String(currentUserId));
            const previous = messages[index - 1];
            const showDate = !previous || !isSameDay(previous.createdAt, item.createdAt);
            const messageStatus = mine
              ? item.status === 'sending'
                ? 'Gönderiliyor'
                : item.status === 'failed'
                  ? 'Gönderilemedi'
                  : hasReadReceipt(item, otherUserId)
                    ? 'Okundu'
                    : 'Gönderildi'
              : formatTime(item.createdAt);

            return (
              <div key={item._id}>
                {showDate ? <div className="chat-date-separator">{formatDateLabel(item.createdAt)}</div> : null}
                <article className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}>
                  <div className={`chat-bubble-v2 ${mine ? 'mine' : 'theirs'} ${item.status === 'failed' ? 'failed' : ''}`}>
                    <p>{item.content}</p>
                    {item.type === 'image' && item.mediaUrl ? (
                      <img
                        className="chat-image-message"
                        src={resolveMediaUrl(item.mediaUrl)}
                        alt="Gönderilen görsel"
                        loading="lazy"
                        onClick={() => window.open(resolveMediaUrl(item.mediaUrl), '_blank', 'noopener,noreferrer')}
                      />
                    ) : null}
                    <span className="chat-message-meta">{messageStatus}</span>
                    {!mine && item.status !== 'failed' ? (
                      <button
                        type="button"
                        className="chat-message-report-btn"
                        onClick={() => openReportModal({ type: 'message', messageId: item._id })}
                      >
                        Mesajı Şikayet Et
                      </button>
                    ) : null}
                    {item.status === 'failed' ? (
                      <button type="button" className="chat-retry-btn" onClick={() => retryMessage(item)}>
                        Tekrar dene
                      </button>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })}
          {isOtherTyping ? (
            <div className="chat-typing-indicator" aria-live="polite">
              Yazıyor...
            </div>
          ) : null}
        </div>

        {offer ? (
          <div className="chat-offer-card-v2">
            <div className="chat-offer-row">
              <strong>Teklif</strong>
              <span>{offer.price} TL</span>
            </div>
            <div className="chat-offer-row">
              <span>Teslim</span>
              <span>{offer.deliveryTime} gün</span>
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

        {!isOwner && (!offer || ['sent', 'viewed', 'countered'].includes(offer.status) || offer.status === 'rejected') ? (
          <form className="offer-form chat-offer-form" onSubmit={handleOfferSubmit}>
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
                placeholder="Teslim Süresi (gün)"
                min="1"
                value={offerForm.deliveryTime}
                onChange={handleOfferChange}
                disabled={offerSubmitting}
                required
              />
            </div>
            <textarea
              name="message"
              placeholder="Teklif mesajı"
              value={offerForm.message}
              onChange={handleOfferChange}
              rows={3}
              disabled={offerSubmitting}
            />
            <button type="submit" className="primary-btn" disabled={offerSubmitting}>
              {offerSubmitting ? '...' : offer && ['sent', 'viewed', 'countered'].includes(offer.status) ? 'Teklifi Güncelle' : 'Teklif Ver'}
            </button>
          </form>
        ) : null}

        <form className="chat-composer" onSubmit={sendMessage}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="chat-image-input"
            onChange={handleImageSelect}
            disabled={!canSendImage}
          />
          <button
            type="button"
            className="secondary-btn chat-image-btn"
            onClick={() => imageInputRef.current?.click()}
            disabled={!canSendImage}
          >
            {imageUploading ? '...' : 'Görsel'}
          </button>
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Mesaj yaz..."
            maxLength={MAX_MESSAGE_LENGTH + 1}
            rows={1}
            disabled={sending}
            readOnly={isChatBlocked}
          />
          <button type="submit" className="primary-btn" disabled={!canSend}>
            {sending ? 'Gönderiliyor' : 'Gönder'}
          </button>
          {isMessageTooLong ? <div className="chat-composer-warning">Mesaj en fazla {MAX_MESSAGE_LENGTH} karakter olabilir.</div> : null}
        </form>

        {reportTarget ? (
          <div className="chat-report-modal" role="dialog" aria-modal="true" aria-label="Chat şikayeti">
            <form className="chat-report-card" onSubmit={submitReport}>
              <div>
                <strong>{reportTarget.type === 'message' ? 'Mesajı Şikayet Et' : 'Konuşmayı Şikayet Et'}</strong>
                <p>Şikayetiniz moderasyon ekibi tarafından incelenir.</p>
              </div>
              <select
                value={reportForm.reason}
                onChange={(event) => setReportForm((prev) => ({ ...prev, reason: event.target.value }))}
                disabled={reportSubmitting}
              >
                <option value="spam">Spam</option>
                <option value="harassment">Taciz</option>
                <option value="inappropriate">Uygunsuz içerik</option>
                <option value="scam">Dolandırıcılık</option>
                <option value="other">Diğer</option>
              </select>
              <textarea
                rows={3}
                value={reportForm.note}
                onChange={(event) => setReportForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Kısa açıklama"
                disabled={reportSubmitting}
              />
              {reportMessage ? <div className="chat-report-message">{reportMessage}</div> : null}
              <div className="chat-report-actions">
                <button type="button" className="secondary-btn" onClick={closeReportModal} disabled={reportSubmitting}>
                  Vazgeç
                </button>
                <button type="submit" className="primary-btn" disabled={reportSubmitting}>
                  {reportSubmitting ? 'Gönderiliyor' : 'Gönder'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Chat;
