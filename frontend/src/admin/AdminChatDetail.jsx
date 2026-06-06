import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const resolveMediaUrl = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace(/\/api\/?$/, '')}${value}`;
  }
  return value;
};

const userLabel = (user) => user?.name || user?.email || '—';

const moderationLabel = (status) => {
  switch (status) {
    case 'flagged':
      return 'Riskli';
    case 'reviewed':
      return 'İncelendi';
    case 'dismissed':
      return 'Temiz';
    case 'clean':
      return 'Temiz';
    default:
      return status || 'Temiz';
  }
};

export default function AdminChatDetail() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingMessageId, setUpdatingMessageId] = useState('');
  const [updatingReportId, setUpdatingReportId] = useState('');
  const [restrictionLoadingId, setRestrictionLoadingId] = useState('');

  useEffect(() => {
    let active = true;
    const loadDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/chats/${chatId}`);
        if (active) setData(response.data?.data || null);
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Chat detayı alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      active = false;
    };
  }, [chatId]);

  const chat = data?.chat || null;
  const messages = data?.messages || [];
  const reports = data?.reports || [];
  const activeRestrictionFor = (userId) =>
    (chat?.restrictions || []).find((item) => item.userId === userId && item.active);

  const updateMessageModeration = async (messageId, moderationStatus) => {
    setUpdatingMessageId(messageId);
    setError('');
    try {
      const body =
        moderationStatus === 'flagged'
          ? {
              moderationStatus,
              riskScore: 60,
              riskReasons: ['Admin tarafından riskli işaretlendi']
            }
          : { moderationStatus };
      const response = await api.patch(`/admin/chats/${chatId}/messages/${messageId}/moderation`, body);
      const next = response.data?.data || {};
      setData((prev) => ({
        ...prev,
        messages: (prev?.messages || []).map((item) =>
          item.messageId === messageId
            ? {
                ...item,
                riskScore: next.riskScore,
                riskLevel: next.riskLevel,
                riskReasons: next.riskReasons || [],
                moderationStatus: next.moderationStatus
              }
            : item
        )
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Mesaj moderasyon durumu güncellenemedi.');
    } finally {
      setUpdatingMessageId('');
    }
  };

  const updateReportStatus = async (reportId, status) => {
    setUpdatingReportId(reportId);
    setError('');
    try {
      await api.patch(`/admin/chat-reports/${reportId}`, { status });
      setData((prev) => ({
        ...prev,
        reports: (prev?.reports || []).map((item) => (item._id === reportId ? { ...item, status } : item))
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Şikayet durumu güncellenemedi.');
    } finally {
      setUpdatingReportId('');
    }
  };

  const restrictUser = async (userId) => {
    const reason = window.prompt('Kısıtlama sebebi');
    if (!reason || !reason.trim()) return;
    const dayInput = window.prompt('Süre (gün). Boş bırakırsanız süresiz olur.');
    const days = Number(dayInput || 0);
    const expiresAt = Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    setRestrictionLoadingId(userId);
    setError('');
    try {
      const response = await api.post(`/admin/users/${userId}/chat-restrictions`, {
        reason: reason.trim(),
        scope: 'chat',
        expiresAt
      });
      const restriction = response.data?.data;
      setData((prev) => ({
        ...prev,
        chat: {
          ...prev.chat,
          restrictions: [
            ...(prev.chat?.restrictions || []),
            {
              restrictionId: restriction?._id || restriction?.id,
              userId,
              reason: restriction?.reason || reason.trim(),
              scope: restriction?.scope || 'chat',
              expiresAt: restriction?.expiresAt || expiresAt || null,
              createdAt: restriction?.createdAt || new Date().toISOString(),
              active: true
            }
          ]
        }
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Kullanıcı kısıtlanamadı.');
    } finally {
      setRestrictionLoadingId('');
    }
  };

  const liftRestriction = async (userId, restrictionId) => {
    if (!restrictionId) return;
    setRestrictionLoadingId(userId);
    setError('');
    try {
      await api.delete(`/admin/users/${userId}/chat-restrictions/${restrictionId}`);
      setData((prev) => ({
        ...prev,
        chat: {
          ...prev.chat,
          restrictions: (prev.chat?.restrictions || []).map((item) =>
            item.restrictionId === restrictionId ? { ...item, active: false, liftedAt: new Date().toISOString() } : item
          )
        }
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Kısıtlama kaldırılamadı.');
    } finally {
      setRestrictionLoadingId('');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Chat Detay İnceleme</div>
      <div className="admin-panel-body">
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin/chats')}>
          Listeye Dön
        </button>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? <div className="admin-empty">Yükleniyor…</div> : null}

        {!loading && chat ? (
          <>
            <section className="admin-chat-summary">
              <div>
                <span className="admin-muted">Katılımcılar</span>
                <strong>{(chat.participants || []).map(userLabel).join(' / ') || '—'}</strong>
              </div>
              <div>
                <span className="admin-muted">RFQ</span>
                <strong>{chat.rfq?.title || '—'}</strong>
                {chat.rfq?.city || chat.rfq?.district ? (
                  <p className="admin-muted">{[chat.rfq.city, chat.rfq.district].filter(Boolean).join(', ')}</p>
                ) : null}
              </div>
              <div>
                <span className="admin-muted">Şikayet</span>
                <strong>{reports.length}</strong>
              </div>
              <div>
                <span className="admin-muted">Moderasyon</span>
                <strong>{chat.moderationSummary?.flaggedMessageCount || 0} riskli mesaj</strong>
              </div>
              <div>
                <span className="admin-muted">Engel</span>
                <strong>{chat.hasBlockedParticipant ? 'Engel ilişkisi var' : 'Yok'}</strong>
              </div>
            </section>

            <section className="admin-chat-actions">
              <button type="button" className="admin-btn" onClick={() => navigate('/admin/chat-reports')}>
                Şikayetleri Gör
              </button>
            </section>

            <section className="admin-chat-participants">
              {(chat.participants || []).map((participant) => {
                const restriction = activeRestrictionFor(participant.id);
                return (
                  <div key={participant.id} className="admin-chat-participant-card">
                    <strong>{userLabel(participant)}</strong>
                    <span className="admin-muted">{restriction ? 'Mesajlaşma kısıtlı' : 'Kısıtlama yok'}</span>
                    {restriction ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={restrictionLoadingId === participant.id}
                        onClick={() => liftRestriction(participant.id, restriction.restrictionId)}
                      >
                        Kısıtlamayı Kaldır
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={restrictionLoadingId === participant.id}
                        onClick={() => restrictUser(participant.id)}
                      >
                        Mesajlaşmayı Kısıtla
                      </button>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="admin-chat-reports">
              <h3>Şikayetler</h3>
              {reports.length === 0 ? <div className="admin-empty">Kayıt bulunamadı.</div> : null}
              {reports.map((report) => (
                <div key={report._id} className="admin-chat-report-card">
                  <div>
                    <strong>{report.reason || '—'}</strong>
                    <p>{report.note || 'Açıklama yok'}</p>
                    <span className="admin-muted">
                      Reporter: {userLabel(report.reporterId)} / Reported: {userLabel(report.reportedUserId)}
                    </span>
                  </div>
                  <select
                    className="admin-input"
                    value={report.status}
                    disabled={updatingReportId === report._id}
                    onChange={(event) => updateReportStatus(report._id, event.target.value)}
                  >
                    <option value="open">Açık</option>
                    <option value="reviewed">İncelendi</option>
                    <option value="dismissed">Geçersiz</option>
                    <option value="action_taken">İşlem Yapıldı</option>
                  </select>
                </div>
              ))}
            </section>

            <section className="admin-chat-message-list">
              {messages.length === 0 ? <div className="admin-empty">Kayıt bulunamadı.</div> : null}
              {messages.map((message) => {
                const mediaUrl = resolveMediaUrl(message.mediaUrl);
                return (
                  <article key={message.messageId} className="admin-chat-message-card">
                    <div className="admin-chat-message-head">
                      <strong>{userLabel(message.sender)}</strong>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    {message.type === 'image' && mediaUrl ? (
                      <div className="admin-chat-media-preview">
                        <img src={mediaUrl} alt="Chat görseli" loading="lazy" />
                        <a className="admin-link" href={mediaUrl} target="_blank" rel="noreferrer">
                          Yeni sekmede aç
                        </a>
                      </div>
                    ) : (
                      <p>{message.text || '—'}</p>
                    )}
                    <div className="admin-chat-message-meta">
                      <span>{moderationLabel(message.moderationStatus)}</span>
                      <span>Risk: {message.riskScore || 0}</span>
                      <span>Okundu: {message.readAt ? formatDate(message.readAt) : '—'}</span>
                    </div>
                    {message.riskReasons?.length ? (
                      <div className="admin-muted">{message.riskReasons.join(', ')}</div>
                    ) : null}
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={updatingMessageId === message.messageId}
                        onClick={() => updateMessageModeration(message.messageId, 'flagged')}
                      >
                        Mesajı İşaretle
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={updatingMessageId === message.messageId}
                        onClick={() => updateMessageModeration(message.messageId, 'dismissed')}
                      >
                        Mesajı Temiz Olarak İşaretle
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={updatingMessageId === message.messageId}
                        onClick={() => updateMessageModeration(message.messageId, 'reviewed')}
                      >
                        İncelendi Yap
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
