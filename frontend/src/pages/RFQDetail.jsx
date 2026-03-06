import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { getSocket } from '../lib/socket';
import { getProductSchema } from '../lib/rfqProductSchemas';
import { triggerHaptic } from '../utils/haptic';
import RFQCreate from './RFQCreate';
import OfferSheet from '../components/OfferSheet';

function RFQDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const idEq = (a, b) => {
    if (!a || !b) {
      return false;
    }
    const left = typeof a === 'object' ? a?._id : a;
    const right = typeof b === 'object' ? b?._id : b;
    if (!left || !right) {
      return false;
    }
    return String(left) === String(right);
  };

  const [rfq, setRfq] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [chatToast, setChatToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingOfferId, setProcessingOfferId] = useState(null);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [chatStarting, setChatStarting] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatSupplierId, setActiveChatSupplierId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatListRef = useRef(null);
  const tabInitializedRef = useRef(false);
  const viewedOffersRef = useRef(new Set());
  const [activeTab, setActiveTab] = useState('offers');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [flashBid, setFlashBid] = useState(false);
  const [isOfferSheetOpen, setIsOfferSheetOpen] = useState(false);
  const [offerSheetMode, setOfferSheetMode] = useState('create');
  const [counterForm, setCounterForm] = useState({ price: '', note: '' });
  const [counterOfferId, setCounterOfferId] = useState(null);
  const [featureLoading, setFeatureLoading] = useState(false);
  const OFFER_UPDATABLE = ['sent', 'viewed', 'countered'];
  const OFFER_FINAL = ['accepted', 'rejected', 'withdrawn', 'completed'];
  const currentUserId = currentUser?.id || currentUser?._id || null;
  const buyerId = typeof rfq?.buyer === 'object' ? rfq?.buyer?._id : rfq?.buyer;
  const isOwner = useMemo(() => idEq(rfq?.buyer, currentUserId), [currentUserId, rfq?.buyer]);
  const isBuyer = isOwner;
  const isSeller = Boolean(currentUserId && !isBuyer);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/rfq/${id}`);
      setRfq(response.data?.data || null);
      setError('');
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'RFQ detayi alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      setUserLoading(true);
      const response = await api.get('/auth/me');
      const payload = response.data?.data || response.data || {};
      setCurrentUser(payload.user || payload || null);
    } catch (_error) {
      setCurrentUser(null);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchMyOffer = async () => {
    if (!id || !currentUserId) {
      return;
    }
    if (isOwner) {
      setCurrentOffer(null);
      return;
    }
    try {
      setOfferLoading(true);
      const response = await api.get(`/offers/rfq/${id}/me`);
      setCurrentOffer(response.data?.data || null);
      setOfferError('');
    } catch (requestError) {
      setCurrentOffer(null);
      setOfferError(requestError.response?.data?.message || 'Teklif bilgisi alinamadi.');
    } finally {
      setOfferLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQ();
    fetchCurrentUser();
  }, [id]);

  useEffect(() => {
    if (!currentUserId || !id) {
      return;
    }
    fetchMyOffer();
  }, [currentUserId, id, isOwner]);

  useEffect(() => {
    setOfferSheetMode('create');
    setIsOfferSheetOpen(false);
    setCurrentOffer(null);
    setOfferError('');
  }, [id]);

  useEffect(() => {
    const socket = getSocket({
      userId: currentUser?.id || currentUser?._id,
      city: currentUser?.city
    });
    if (!socket) {
      return;
    }
    socket.emit('join_rfq', id);

    const onNewBid = (payload) => {
      if (!payload || payload.rfqId !== id) {
        return;
      }
      setRfq((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          currentBestOffer: payload.currentBestOffer ?? payload.price ?? prev.currentBestOffer
        };
      });
      setFlashBid(true);
      window.setTimeout(() => setFlashBid(false), 600);
    };

    socket.on('new_bid', onNewBid);
    return () => {
      socket.off('new_bid', onNewBid);
      socket.emit('leave_rfq', id);
    };
  }, [currentUser?.city, currentUser?.id, currentUser?._id, id]);

  useEffect(() => {
    if (!rfq?.deadline) {
      setCountdown('');
      return undefined;
    }

    const compute = () => {
      const diff = new Date(rfq.deadline).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Süre doldu');
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / (24 * 60 * 60));
      const hours = Math.floor((totalSec % (24 * 60 * 60)) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      setCountdown(`${days}g ${hours}s ${minutes}dk`);
    };

    compute();
    const intervalId = window.setInterval(compute, 30000);
    return () => window.clearInterval(intervalId);
  }, [rfq?.deadline]);

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return '-';
    }

    return new Date(dateValue).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
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

  const formatDetailValue = (value) => {
    if (value == null) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value ? 'Evet' : 'Hayır';
    }
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
      return value?.label || value?.name || JSON.stringify(value);
    }
    return String(value);
  };

  const productDetails = useMemo(() => {
    if (!rfq?.productDetails || typeof rfq.productDetails !== 'object') {
      return {};
    }
    return rfq.productDetails;
  }, [rfq?.productDetails]);

  const productDetailEntries = useMemo(() => {
    if (!productDetails || !Object.keys(productDetails).length) {
      return [];
    }
    const schema = getProductSchema(getCategoryName(rfq?.category));
    const labels = new Map();
    if (schema?.fields?.length) {
      schema.fields.forEach((field) => {
        labels.set(field.key, field.label);
      });
    }
    return Object.entries(productDetails)
      .filter(([key, value]) => {
        if (key === 'brand' || key === 'model') {
          return false;
        }
        return String(value ?? '').trim();
      })
      .map(([key, value]) => ({
        key,
        label: labels.get(key) || key,
        value
      }));
  }, [productDetails, rfq?.category]);

  const getOfferStatusLabel = (status) => {
    switch (status) {
      case 'sent':
        return 'Gönderildi';
      case 'viewed':
        return 'Görüldü';
      case 'countered':
        return 'Karşı teklif';
      case 'accepted':
        return 'Kabul edildi';
      case 'rejected':
        return 'Reddedildi';
      case 'withdrawn':
        return 'Geri çekildi';
      case 'completed':
        return 'Tamamlandı';
      default:
        return status || '-';
    }
  };

  const renderTimeline = (offer) => {
    const timeline = Array.isArray(offer?.timeline) ? offer.timeline : [];
    if (!timeline.length) {
      return null;
    }
    return (
      <div className="offer-timeline">
        {timeline.map((item, index) => (
          <div key={`${offer._id}-${item.status}-${index}`} className={`timeline-item ${item.status}`}>
            <span className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-status">{getOfferStatusLabel(item.status)}</div>
              <div className="timeline-date">{item.date ? new Date(item.date).toLocaleString('tr-TR') : ''}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const isAwarded = rfq?.status === 'awarded';
  const featuredCredits = Number(currentUser?.featuredCredits || 0);
  const featuredActive = useMemo(() => {
    if (!rfq) {
      return false;
    }
    if (rfq.featuredActive != null) {
      return Boolean(rfq.featuredActive);
    }
    if (!rfq.isFeatured || !rfq.featuredUntil) {
      return false;
    }
    return new Date(rfq.featuredUntil).getTime() > Date.now();
  }, [rfq]);

  function handleStartChat(withUserId) {
    if (!id || !currentUserId) {
      return;
    }
    if (isBuyer && !withUserId) {
      setChatToast('Sohbet için bir satıcı seç');
      return;
    }
    if (!withUserId) {
      return;
    }
    setChatStarting(true);
    api
      .post(`/chats/rfq/${id}/with/${withUserId}`)
      .then((response) => {
        if (response.data?.code === 'WAIT_BUYER') {
          setChatToast('Alıcıdan haber bekle...');
          return;
        }
        const chatId = response.data?.data?.chat?._id;
        if (chatId) {
          setActiveChatId(chatId);
          setActiveChatSupplierId(withUserId);
        }
      })
      .catch((requestError) => {
        const statusCode = requestError.response?.status;
        const tag = requestError.response?.data?.tag;
        const msg = requestError.response?.data?.message || 'Sohbet baslatilamadi.';
        if (process.env.NODE_ENV !== 'production') {
          console.warn('CHAT_START_FAIL', { status: statusCode, tag });
        }
        setChatToast(tag ? `(${tag}) ${msg}` : msg);
      })
      .finally(() => {
        setChatStarting(false);
      });
  }

  useEffect(() => {
    if (!chatToast) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setChatToast('');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [chatToast]);

  useEffect(() => {
    if (tabInitializedRef.current) {
      return;
    }
    if (rfq && currentUserId) {
      setActiveTab(isOwner ? 'offers' : 'chat');
      tabInitializedRef.current = true;
    }
  }, [currentUserId, isOwner, rfq]);


  const handleOfferSubmit = async (payload) => {
    setFormError('');

    if (isAwarded) {
      setFormError('Bu talep tamamlandigi icin yeni teklif kabul etmiyor.');
      return;
    }

    if (isOwner) {
      setFormError('Bu talep size ait. Teklif veremezsiniz.');
      return;
    }

    setSubmitting(true);

    try {
      if (offerSheetMode === 'create') {
        console.log('OFFER_CREATE_START');
      } else {
        console.log('OFFER_UPDATE_START');
      }
      if (offerSheetMode === 'edit' && supplierOffer && OFFER_UPDATABLE.includes(supplierOffer.status)) {
        await api.patch(`/offers/${supplierOffer._id}`, {
          price: payload.price,
          deliveryTime: payload.deliveryTime,
          note: payload.message,
          quantity: payload.quantity
        });
        console.log('OFFER_UPDATE_OK', { id: supplierOffer._id });
      } else if (!supplierOffer) {
        await api.post(`/offers/${id}`, {
          price: payload.price,
          deliveryTime: payload.deliveryTime,
          message: payload.message,
          quantity: payload.quantity
        });
        console.log('OFFER_CREATE_OK', { rfqId: id });
      } else {
        setFormError('Teklif bu durumda guncellenemez.');
        return;
      }

      triggerHaptic(10);
      setIsOfferSheetOpen(false);
      await fetchRFQ();
      await fetchMyOffer();
    } catch (submitError) {
      const statusCode = submitError.response?.status;
      const responseData = submitError.response?.data || {};
      if (!submitError.response) {
        setFormError('Sunucuya baglanilamadi.');
        return;
      }
      const logTag = offerSheetMode === 'edit' ? 'OFFER_UPDATE_FAIL' : 'OFFER_CREATE_FAIL';
      console.error(logTag, {
        status: statusCode,
        code: responseData.code,
        message: responseData.message
      });
      if (statusCode === 409 && responseData.code === 'OFFER_EXISTS') {
        setFormError('');
        setChatToast('Bu ilan için zaten teklifin var. Düzenleyebilirsin.');
        try {
          await fetchMyOffer();
        } catch (_error) {}
        setOfferSheetMode('edit');
        setIsOfferSheetOpen(true);
        return;
      }
      setFormError(responseData.message || 'Teklif gonderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferAction = async (offerId, action) => {
    setActionError('');
    setProcessingOfferId(offerId);

    try {
      const response = await api.post(`/offers/${offerId}/${action}`);
      triggerHaptic(10);
      await fetchRFQ();
      if (action === 'accept' && response.data?.chatId) {
        navigate(`/messages/${response.data.chatId}`);
      }
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Islem gerceklestirilemedi.');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleWithdrawOffer = async (offerId) => {
    if (!offerId) {
      return;
    }
    if (!window.confirm('Teklifi geri cekmek istiyor musunuz?')) {
      return;
    }
    setProcessingOfferId(offerId);
    try {
      console.log('OFFER_WITHDRAW_START', { id: offerId });
      await api.post(`/offers/${offerId}/withdraw`);
      console.log('OFFER_WITHDRAW_OK', { id: offerId });
      triggerHaptic(10);
      await fetchRFQ();
      await fetchMyOffer();
    } catch (requestError) {
      console.error('OFFER_WITHDRAW_FAIL', {
        status: requestError.response?.status,
        code: requestError.response?.data?.code,
        message: requestError.response?.data?.message
      });
      setActionError(requestError.response?.data?.message || 'Teklif geri cekilemedi.');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleOpenCounter = (offer) => {
    setCounterOfferId(offer?._id || null);
    setCounterForm({ price: '', note: '' });
  };

  const handleSubmitCounter = async (event) => {
    event.preventDefault();
    if (!counterOfferId) {
      return;
    }
    setProcessingOfferId(counterOfferId);
    try {
      await api.post(`/offers/${counterOfferId}/counter`, {
        price: Number(counterForm.price),
        note: counterForm.note
      });
      triggerHaptic(10);
      setCounterOfferId(null);
      setCounterForm({ price: '', note: '' });
      await fetchRFQ();
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Karsi teklif gonderilemedi.');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const offers = Array.isArray(rfq?.offers) ? rfq.offers : [];
  const isOfferActive = useMemo(() => {
    if (!currentOffer) {
      return false;
    }
    return !['withdrawn', 'rejected', 'completed'].includes(currentOffer.status);
  }, [currentOffer]);
  const supplierOffer = useMemo(() => {
    if (isOwner) {
      return null;
    }
    return isOfferActive ? currentOffer : null;
  }, [currentOffer, isOfferActive, isOwner]);
  const offerInitialValues = useMemo(
    () => ({
      price: supplierOffer?.price ?? '',
      deliveryTime: supplierOffer?.deliveryTime ?? '',
      message: supplierOffer?.message ?? '',
      quantity: supplierOffer?.quantity ?? ''
    }),
    [supplierOffer]
  );

  useEffect(() => {
    if (!isOwner || !offers.length) {
      return;
    }
    offers.forEach((offer) => {
      if (!offer?._id || offer.status !== 'sent') {
        return;
      }
      if (viewedOffersRef.current.has(String(offer._id))) {
        return;
      }
      viewedOffersRef.current.add(String(offer._id));
      api.post(`/offers/${offer._id}/viewed`).catch(() => {});
    });
  }, [isOwner, offers]);
  const activeChatOffer = useMemo(() => {
    if (!activeChatSupplierId) {
      return null;
    }
    return offers.find((offer) => String(offer?.supplier?._id || offer?.supplier) === String(activeChatSupplierId)) || null;
  }, [activeChatSupplierId, offers]);

  useEffect(() => {
    if (!activeChatId || !currentUserId) {
      return;
    }

    const fetchMessages = async () => {
      try {
        setChatLoading(true);
        const response = await api.get(`/chats/${activeChatId}/messages`);
        setChatMessages(response.data?.data || []);
      } catch (_error) {
        setChatMessages([]);
      } finally {
        setChatLoading(false);
      }
    };

    fetchMessages();

    const socket = getSocket({
      userId: currentUserId,
      city: currentUser?.city
    });
    if (!socket) {
      return;
    }
    socket.emit('join_chat', activeChatId);

    const onMessage = (payload) => {
      if (!payload || payload.chatId !== activeChatId) {
        return;
      }
      const nextMessage = payload.message;
      setChatMessages((prev) => {
        if (!nextMessage || prev.some((item) => item._id === nextMessage._id)) {
          return prev;
        }
        return [...prev, nextMessage];
      });
    };

    const onOfferUpdate = (payload) => {
      if (!payload || payload.chatId !== activeChatId) {
        return;
      }
      fetchRFQ();
    };

    socket.on('message:new', onMessage);
    socket.on('newMessage', onMessage);
    socket.on('offer:update', onOfferUpdate);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('newMessage', onMessage);
      socket.off('offer:update', onOfferUpdate);
      socket.emit('leave_chat', activeChatId);
    };
  }, [activeChatId, currentUser?.city, currentUserId, fetchRFQ]);

  useEffect(() => {
    if (!chatListRef.current) {
      return;
    }
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (isEditOpen) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [isEditOpen]);

  const sendChatMessage = async (event) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !activeChatId) {
      return;
    }
    try {
      await api.post(`/chats/${activeChatId}/message`, { content: trimmed });
      setChatInput('');
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Mesaj gonderilemedi.');
    }
  };

  const openOfferCreate = async () => {
    setFormError('');
    if (supplierOffer) {
      setOfferSheetMode('edit');
      setIsOfferSheetOpen(true);
      return;
    }
    try {
      const response = await api.get(`/offers/rfq/${id}/me`);
      const offer = response.data?.data || null;
      setCurrentOffer(offer);
      setOfferError('');
      const active = offer && !['withdrawn', 'rejected', 'completed'].includes(offer.status);
      setOfferSheetMode(active ? 'edit' : 'create');
    } catch (_error) {
      setOfferSheetMode('create');
    }
    setIsOfferSheetOpen(true);
  };

  const openOfferEdit = () => {
    if (!supplierOffer) {
      openOfferCreate();
      return;
    }
    setOfferSheetMode('edit');
    setIsOfferSheetOpen(true);
  };

  const handleFeatureRFQ = async () => {
    if (!rfq || !isOwner) {
      return;
    }
    if (featuredActive) {
      setChatToast('Bu ilan zaten öne çıkarılmış.');
      window.setTimeout(() => setChatToast(''), 2500);
      return;
    }
    try {
      setFeatureLoading(true);
      const response = await api.post(`/rfq/${rfq._id}/feature`);
      const payload = response.data?.data;
      if (payload?.rfq) {
        setRfq(payload.rfq);
      }
      if (payload?.remainingCredits != null) {
        setCurrentUser((prev) => (prev ? { ...prev, featuredCredits: payload.remainingCredits } : prev));
      }
      setChatToast('Ilan öne çıkarıldı (7 gün).');
      window.setTimeout(() => setChatToast(''), 3000);
    } catch (requestError) {
      const code = requestError.response?.data?.code;
      if (code === 'FEATURED_REQUIRED') {
        setChatToast('Öne çıkarmak için kredi gerekli.');
        window.setTimeout(() => setChatToast(''), 3000);
      } else if (code === 'ALREADY_FEATURED') {
        setChatToast('Bu ilan zaten öne çıkarılmış.');
        window.setTimeout(() => setChatToast(''), 3000);
      } else {
        setChatToast(requestError.response?.data?.message || 'İlan öne çıkarılamadı.');
        window.setTimeout(() => setChatToast(''), 3000);
      }
    } finally {
      setFeatureLoading(false);
    }
  };

  const handlePurchaseFeatured = async () => {
    try {
      const response = await api.post('/billing/checkout', { planCode: 'featured_one_time' });
      const url = response.data?.checkoutUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (requestError) {
      setChatToast(requestError.response?.data?.message || 'Checkout baslatilamadi.');
      window.setTimeout(() => setChatToast(''), 3000);
    }
  };

  return (
    <div>
      <div className="detail-head">
        <button type="button" className="secondary-btn" onClick={() => navigate('/')}>
          Geri
        </button>
      </div>

      {!loading && !userLoading && !error && rfq ? (
        <div className="detail-tabs">
          <button
            type="button"
            className={activeTab === 'offers' ? 'active' : ''}
            onClick={() => setActiveTab('offers')}
          >
            Teklifler
          </button>
          <button
            type="button"
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Sohbet
          </button>
        </div>
      ) : null}

      {loading || userLoading ? (
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
      {error ? <div className="error">{error}</div> : null}

      {!loading && !userLoading && !error && rfq ? (
        <>
          <section className="card fade-in" style={{ animationDelay: '0ms' }}>
            <div className="detail-title-row">
              <h1>{rfq.title}</h1>
              {isAwarded ? <span className="badge done">Talep Tamamlandi</span> : null}
              {isOwner && rfq.status === 'open' ? (
                <button type="button" className="secondary-btn" onClick={() => setIsEditOpen(true)}>
                  Duzenle
                </button>
              ) : null}
            </div>
            {isOwner ? (
              <div className="detail-feature-row">
                <div className="rfq-sub">Kredi: {featuredCredits}</div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleFeatureRFQ}
                  disabled={featureLoading || featuredActive || featuredCredits <= 0}
                >
                  {featuredActive ? 'Öne Çıkarıldı' : featureLoading ? 'Isleniyor...' : 'Öne Çıkar'}
                </button>
                {featuredCredits <= 0 && !featuredActive ? (
                  <button type="button" className="primary-btn" onClick={handlePurchaseFeatured}>
                    Öne Çıkar Satın Al
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="detail-description">{rfq.description}</p>
            <div className="rfq-sub">Kategori: {getCategoryName(rfq.category)}</div>
            {productDetails?.brand || productDetails?.model ? (
              <div className="rfq-sub">
                Marka/Model: {productDetails?.brand || ''} {productDetails?.model || ''}
              </div>
            ) : null}
            {rfq.car?.brandName || rfq.car?.modelName ? (
              <div className="rfq-sub">
                {rfq.car?.brandName || ''} {rfq.car?.modelName || ''}
              </div>
            ) : null}
            {productDetailEntries.length ? (
              <div className="rfq-sub">
                <strong>Ürün Bilgileri</strong>
                {productDetailEntries.map((entry) => (
                  <div key={entry.key}>
                    {entry.label}: {formatDetailValue(entry.value)}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="rfq-sub">Miktar: {rfq.quantity}</div>
            <div className="rfq-sub">Termin: {formatDate(rfq.deadline)}</div>
            {rfq.isAuction ? (
              <div className={`auction-live ${flashBid ? 'flash' : ''}`}>
                <div>Canli En Iyi Teklif: {rfq.currentBestOffer ? `${rfq.currentBestOffer} TL` : 'Henuz yok'}</div>
                <div>Kalan Sure: {countdown || '-'}</div>
              </div>
            ) : null}

            {!isOwner ? (
              <button
                type="button"
                className="primary-btn offer-submit-btn"
                onClick={() => handleStartChat(buyerId)}
                disabled={chatStarting || !supplierOffer}
                title={!supplierOffer ? 'Once teklif ver' : undefined}
              >
                {chatStarting ? 'Aciliyor...' : 'Sohbet Et'}
              </button>
            ) : null}
          </section>

          {activeTab === 'offers' ? (
            <>
              {isOwner ? (
                <section className="card fade-in" style={{ animationDelay: '50ms' }}>
                  <h2>Gelen Teklifler</h2>
                  {actionError ? <div className="error">{actionError}</div> : null}

                  {offers.length ? (
                    <div className="offer-list">
                      {offers.map((offer, index) => {
                        const supplierId = offer?.supplier?._id || offer?.supplier;

                        return (
                          <article
                            key={offer._id}
                            className={`offer-card fade-in ${offer.status === 'accepted' ? 'accepted' : ''} ${
                              offer.status === 'rejected' ? 'rejected' : ''
                            }`}
                            style={{ animationDelay: `${100 + index * 50}ms` }}
                            onClick={() => setSelectedOffer(offer)}
                          >
                            <div className="offer-top">
                              <strong>{offer.supplier?.name || 'Tedarikci'}</strong>
                              <span>{offer.price} TL</span>
                            </div>
                            <div className="offer-meta">Teslim: {offer.deliveryTime} gun</div>
                            <p>{offer.message}</p>

                            {offer.status ? <span className={`badge open ${offer.status}`}>{getOfferStatusLabel(offer.status)}</span> : null}
                            {renderTimeline(offer)}

                            {!isAwarded ? (
                              <div className="offer-actions-row">
                                <button
                                  type="button"
                                  className="primary-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOfferAction(offer._id, 'accept');
                                  }}
                                  disabled={processingOfferId === offer._id || OFFER_FINAL.includes(offer.status)}
                                >
                                  {processingOfferId === offer._id ? 'Isleniyor...' : 'Kabul Et'}
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOfferAction(offer._id, 'reject');
                                  }}
                                  disabled={processingOfferId === offer._id || OFFER_FINAL.includes(offer.status)}
                                >
                                  Reddet
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenCounter(offer);
                                  }}
                                  disabled={processingOfferId === offer._id || OFFER_FINAL.includes(offer.status)}
                                >
                                  Karsi Teklif
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleStartChat(supplierId);
                                  }}
                                  disabled={chatStarting}
                                >
                                  {chatStarting ? '...' : 'Sohbet Et'}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📭</div>
                      Henuz teklif yok.
                    </div>
                  )}
                </section>
              ) : (
                <section className="card fade-in" style={{ animationDelay: '50ms' }}>
                  <h2>Teklifim</h2>
                  {offerError ? <div className="error">{offerError}</div> : null}
                  {offerLoading ? <div className="refresh-text">Yukleniyor...</div> : null}
                  {supplierOffer ? (
                    <div
                      className="offer-card offer-card-editable"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isAwarded) {
                          return;
                        }
                        if (!OFFER_UPDATABLE.includes(supplierOffer.status)) {
                          return;
                        }
                        openOfferEdit();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (isAwarded || !OFFER_UPDATABLE.includes(supplierOffer.status)) {
                            return;
                          }
                          openOfferEdit();
                        }
                      }}
                    >
                      <div className="offer-top">
                        <strong>{supplierOffer.price} TL</strong>
                        <span>{supplierOffer.deliveryTime} gun</span>
                      </div>
                      {supplierOffer.message ? <p>{supplierOffer.message}</p> : null}
                      {supplierOffer.status ? <span className={`badge open ${supplierOffer.status}`}>{getOfferStatusLabel(supplierOffer.status)}</span> : null}
                      <span className="offer-edit-icon">✎</span>
                      {renderTimeline(supplierOffer)}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📝</div>
                      Henuz teklif yok.
                    </div>
                  )}
                  {formError ? <div className="error">{formError}</div> : null}
                  {!isAwarded && !supplierOffer ? (
                    <div className="offer-actions-row">
                      <button type="button" className="primary-btn" onClick={openOfferCreate} disabled={submitting}>
                        Teklif Ver
                      </button>
                    </div>
                  ) : null}
                </section>
              )}
            </>
          ) : null}

          {activeTab === 'chat' ? (
            <>
              {isOwner ? (
                <section className="card fade-in" style={{ animationDelay: '50ms' }}>
                  <h2>Saticilarla Sohbet</h2>
                  {offers.length ? (
                    <div className="offer-list">
                      {offers.map((offer) => {
                        const supplierId = offer?.supplier?._id || offer?.supplier;
                        return (
                          <div key={offer._id} className="offer-card">
                            <div className="offer-top">
                              <strong>{offer.supplier?.name || 'Tedarikci'}</strong>
                              <span>{offer.price} TL</span>
                            </div>
                            <div className="offer-meta">Teslim: {offer.deliveryTime} gun</div>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => handleStartChat(supplierId)}
                              disabled={chatStarting}
                            >
                              {chatStarting ? '...' : 'Sohbet Et'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">💬</div>
                      Henuz sohbet edilecek tedarikci yok.
                    </div>
                  )}
                </section>
              ) : null}

              {activeChatId ? (
                <section className="card fade-in" style={{ animationDelay: '75ms' }}>
                  <div className="detail-title-row">
                    <h2>Sohbet</h2>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setActiveChatId(null);
                        setActiveChatSupplierId(null);
                      }}
                    >
                      Kapat
                    </button>
                  </div>
                  {chatLoading ? <div className="refresh-text">Yukleniyor...</div> : null}
                  <div className="chat-list" ref={chatListRef}>
                    {chatMessages.map((item) => {
                      const senderId = item?.sender?._id || item?.sender;
                      const mine = Boolean(currentUserId && senderId === currentUserId);
                      return (
                        <article key={item._id} className={mine ? 'chat-bubble mine' : 'chat-bubble'}>
                          <div>{item.content}</div>
                          <span className="chat-time">
                            {new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                  <form className="chat-form" onSubmit={sendChatMessage}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="Mesajinizi yazin"
                      maxLength={2000}
                    />
                    <button type="submit" className="primary-btn">
                      Gonder
                    </button>
                  </form>
                </section>
              ) : null}

              {activeChatId && activeChatOffer && isOwner ? (
                <section className="card fade-in" style={{ animationDelay: '85ms' }}>
                  <h2>Teklif</h2>
                  <div className="offer-card">
                    <div className="offer-top">
                      <strong>{activeChatOffer.price} TL</strong>
                      <span>{activeChatOffer.deliveryTime} gun</span>
                    </div>
                    {activeChatOffer.message ? <p>{activeChatOffer.message}</p> : null}
                    {activeChatOffer.status ? (
                      <span className={`badge open ${activeChatOffer.status}`}>{getOfferStatusLabel(activeChatOffer.status)}</span>
                    ) : null}
                  </div>
                  {!isAwarded ? (
                    <div className="offer-actions-row">
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleOfferAction(activeChatOffer._id, 'accept')}
                        disabled={processingOfferId === activeChatOffer._id || OFFER_FINAL.includes(activeChatOffer.status)}
                      >
                        {processingOfferId === activeChatOffer._id ? 'Isleniyor...' : 'Kabul Et'}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleOfferAction(activeChatOffer._id, 'reject')}
                        disabled={processingOfferId === activeChatOffer._id || OFFER_FINAL.includes(activeChatOffer.status)}
                      >
                        Reddet
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {!isOwner ? (
                <section className="card fade-in" style={{ animationDelay: '90ms' }}>
                  <h2>Teklif</h2>
                  {formError ? <div className="error">{formError}</div> : null}
                  {!isAwarded && !supplierOffer ? (
                    <div className="offer-actions-row">
                      <button type="button" className="primary-btn" onClick={openOfferCreate} disabled={submitting}>
                        Teklif Ver
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}

          {isEditOpen ? (
            <div className="create-sheet-overlay open" onClick={() => setIsEditOpen(false)}>
              <div
                className="create-sheet-content create-sheet-open-full"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="rb-sheet-handle" />
                <button type="button" className="create-sheet-close" onClick={() => setIsEditOpen(false)}>
                  Kapat
                </button>
                <RFQCreate
                  mode="edit"
                  initialData={rfq}
                  onSuccess={(updated) => {
                    if (updated) {
                      setRfq(updated);
                    } else {
                      fetchRFQ();
                    }
                    setIsEditOpen(false);
                  }}
                  onClose={() => setIsEditOpen(false)}
                />
              </div>
            </div>
          ) : null}

          <OfferSheet
            open={isOfferSheetOpen}
            mode={offerSheetMode}
            initialValues={offerInitialValues}
            onClose={() => setIsOfferSheetOpen(false)}
            onSubmit={handleOfferSubmit}
            onWithdraw={
              supplierOffer && OFFER_UPDATABLE.includes(supplierOffer.status)
                ? () => handleWithdrawOffer(supplierOffer._id)
                : null
            }
            submitting={submitting}
            isAuction={rfq?.isAuction}
          />

          {chatToast ? <div className="results-toast show">{chatToast}</div> : null}

          {selectedOffer ? (
            <div className="sheet-overlay" onClick={() => setSelectedOffer(null)}>
              <div className="sheet-content" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-handle" />
                <h3>Teklif Detayi</h3>
                <div className="rfq-sub">Tedarikci: {selectedOffer.supplier?.name || '-'}</div>
                <div className="rfq-sub">Fiyat: {selectedOffer.price} TL</div>
                <div className="rfq-sub">Teslim: {selectedOffer.deliveryTime} gun</div>
                <p className="detail-description">{selectedOffer.message || '-'}</p>
                {renderTimeline(selectedOffer)}
                <button type="button" className="secondary-btn offer-submit-btn" onClick={() => setSelectedOffer(null)}>
                  Kapat
                </button>
              </div>
            </div>
          ) : null}

          {counterOfferId ? (
            <div className="sheet-overlay" onClick={() => setCounterOfferId(null)}>
              <div className="sheet-content" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-handle" />
                <h3>Karsi Teklif</h3>
                <form onSubmit={handleSubmitCounter}>
                  <input
                    type="number"
                    placeholder="Yeni fiyat"
                    min="1"
                    value={counterForm.price}
                    onChange={(event) => setCounterForm((prev) => ({ ...prev, price: event.target.value }))}
                    required
                  />
                  <textarea
                    placeholder="Not"
                    value={counterForm.note}
                    onChange={(event) => setCounterForm((prev) => ({ ...prev, note: event.target.value }))}
                    rows={3}
                  />
                  <button type="submit" className="primary-btn offer-submit-btn" disabled={processingOfferId === counterOfferId}>
                    {processingOfferId === counterOfferId ? 'Gonderiliyor...' : 'Gonder'}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default RFQDetail;
