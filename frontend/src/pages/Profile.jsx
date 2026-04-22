import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ReportIssueSheet from '../components/ReportIssueSheet';
import ProfileLegalSection from '../components/ProfileLegalSection';
import { formatListingQuotaResetDate } from '../utils/listingQuota';

function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser, listingQuota } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const trustScore = Number(user?.trustScore || 50);
  const trustColor = trustScore < 40 ? 'trust-low' : trustScore < 70 ? 'trust-mid' : 'trust-high';
  const trustBadge = trustScore >= 95 ? 'Elite' : trustScore >= 80 ? 'Guvenilir Satici' : null;

  const fetchProfile = useCallback(
    async () => {
      try {
        if (mountedRef.current) {
          setLoading(true);
        }
        const [rfqResponse, chatResponse] = await Promise.all([
          api.get('/rfq?buyer=currentUser&limit=50'),
          api.get('/chats')
        ]);
        if (!mountedRef.current) {
          return;
        }
        const rfqItems = rfqResponse.data?.data || rfqResponse.data?.items || [];
        const chatItems = chatResponse.data?.data || chatResponse.data?.items || [];
        setRfqs(rfqItems);
        setChats(chatItems);
        setError('');
      } catch (fetchError) {
        if (mountedRef.current) {
          setError(fetchError.response?.data?.message || 'Profil bilgileri alınamadı.');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchProfile();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchProfile]);

  const sortedRequests = useMemo(() => {
    const items = Array.isArray(rfqs) ? rfqs : [];
    const sorted = [...items].sort((a, b) => {
      const aChat = a?.lastChatAt ? new Date(a.lastChatAt).getTime() : 0;
      const bChat = b?.lastChatAt ? new Date(b.lastChatAt).getTime() : 0;
      if (aChat !== bChat) return bChat - aChat;
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return sorted;
  }, [rfqs]);

  const { approvedRequests, pendingRequests } = useMemo(() => {
    const approvedStatuses = new Set(['open', 'approved', 'awarded']);
    const pendingStatuses = new Set(['pending', 'waiting', 'draft']);
    const approved = [];
    const pending = [];
    sortedRequests.forEach((item) => {
      if (approvedStatuses.has(item.status)) {
        approved.push(item);
        return;
      }
      if (pendingStatuses.has(item.status)) {
        pending.push(item);
      }
    });
    return { approvedRequests: approved, pendingRequests: pending };
  }, [sortedRequests]);

  const recentChats = useMemo(() => {
    const items = Array.isArray(chats) ? chats : [];
    return [...items]
      .sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [chats]);

  const formatChatTime = (value) => {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  const displayName = user?.name || user?.email || 'Kullanici';
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || '?';
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const approvedCount = approvedRequests.length;
  const pendingCount = pendingRequests.length;
  const unreadCount = 0;
  const lastChatPreview = recentChats[0]
    ? `${recentChats[0]?.rfq?.title || 'RFQ'} — ${recentChats[0]?.lastMessage || 'Henüz mesaj yok'}`
    : 'Henüz mesaj yok';

  return (
    <div className="profile-page">
      <div className="profile-wrap premium-profile">
        <div className="profile-topbar">
          <h1>Profilim</h1>
          <button type="button" className="link-btn" onClick={() => navigate('/')}>
            {'<'} Ana Sayfa
          </button>
        </div>

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
            <button type="button" className="secondary-btn" onClick={() => fetchProfile()}>
              Tekrar Dene
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="profile-hero-card profile-header-card">
              <div className="profile-hero-header" />
              <div className="profile-hero-content">
                <div className="profile-avatar-lg">
                  {user?.avatarUrl && !avatarFailed ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div className="profile-identity">
                  <h2>{displayName}</h2>
                  <span className="role-badge">{user?.email || '-'}</span>
                  {user?.isPremium ? <span className="premium-mini-badge">Premium</span> : null}
                </div>
                <div className="profile-actions">
                  <button type="button" className="secondary-btn profile-report-btn" onClick={() => setReportOpen(true)}>
                    Sorun Bildir
                  </button>
                  <button type="button" className="icon-btn profile-edit-btn" aria-label="Duzenle" onClick={() => {
                    setEditName(user?.name || '');
                    setAvatarPreview('');
                    setAvatarFile(null);
                    setEditError('');
                    setEditOpen(true);
                  }}>
                    ✎
                  </button>
                </div>
              </div>
              <div className="profile-score-row">
                <span>Guven Skoru</span>
                <strong>{trustScore}/100</strong>
              </div>
              <div className="trust-progress">
                <div className={`trust-progress-fill ${trustColor}`} style={{ width: `${trustScore}%` }} />
              </div>
              {trustBadge ? <div className="trust-badge">{trustBadge}</div> : null}
            </section>

            <section className="profile-big-card profile-quota-card">
              <div className="profile-card-header">
                <h2>Ücretsiz İlan Hakkın</h2>
              </div>
              {listingQuota ? (
                <div className="profile-card-items">
                  <div className="profile-sub-item">
                    <span>Kalan hak</span>
                    <span className="sub-item-right">
                      <strong>{listingQuota.remaining}/{listingQuota.limit}</strong>
                    </span>
                  </div>
                  <div className="profile-sub-item">
                    <span>Pencere</span>
                    <span className="sub-item-right">Son {listingQuota.windowDays} gün</span>
                  </div>
                  <div className="profile-sub-preview">
                    {listingQuota.remaining === 0
                      ? 'Son 30 günde ücretsiz ilan hakkın doldu. Yeni ilan vermek için paket gerekecek.'
                      : `Yenilenme: ${formatListingQuotaResetDate(listingQuota.resetAt)}`}
                  </div>
                </div>
              ) : (
                <div className="profile-card-items">
                  <div className="profile-sub-preview">Kota bilgisi hesaplanıyor.</div>
                </div>
              )}
            </section>

            <section className="profile-big-card" onClick={() => navigate('/profile/account')}>
              <div className="profile-card-header">
                <h2>Hesabım</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button
                  type="button"
                  className="profile-sub-item"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/profile/account');
                  }}
                >
                  <span>Bilgilerim</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-sub-item"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/profile/addresses');
                  }}
                >
                  <span>Adreslerim</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-sub-item"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/profile/account', { state: { openPassword: true } });
                  }}
                >
                  <span>Sifre</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="profile-big-card" onClick={() => navigate('/profile/requests')}>
              <div className="profile-card-header">
                <h2>Taleplerim</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/profile/requests?tab=approved');
                }}>
                  <span>Onaylananlar</span>
                  <span className="sub-item-right">
                    <span className="sub-badge">{approvedCount}</span>
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/profile/requests?tab=pending');
                }}>
                  <span>Bekleyenler</span>
                  <span className="sub-item-right">
                    <span className="sub-badge">{pendingCount}</span>
                    <span className="chevron">›</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="profile-big-card" onClick={() => navigate('/messages')}>
              <div className="profile-card-header">
                <h2>Mesajlar</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/messages');
                }}>
                  <span>Tum Sohbetler</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/messages?tab=unread');
                }}>
                  <span>Okunmamislar</span>
                  <span className="sub-item-right">
                    {unreadCount ? <span className="sub-badge">{unreadCount}</span> : null}
                    <span className="chevron">›</span>
                  </span>
                </button>
                <div className="profile-sub-preview">{lastChatPreview}</div>
              </div>
            </section>

            <section className="profile-big-card" onClick={() => navigate('/favorites')}>
              <div className="profile-card-header">
                <h2>Favorilerim</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/favorites?type=rfq');
                }}>
                  <span>Favori Talepler</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="profile-big-card" onClick={() => navigate('/profile/account', { state: { openAlerts: true } })}>
              <div className="profile-card-header">
                <h2>Takiplerim</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/profile/account', { state: { openAlerts: true } });
                }}>
                  <span>Yeni İlan Takiplerim</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <div className="profile-sub-preview">İlgilendiğin kategoriler için bildirimleri yönet.</div>
              </div>
            </section>

            <section className="profile-big-card">
              <div className="profile-card-header">
                <h2>Ayarlar</h2>
                <span className="chevron">›</span>
              </div>
              <div className="profile-card-items">
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/');
                }}>
                  <span>Gelismis Ayarlar</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button type="button" className="profile-sub-item" onClick={(event) => {
                  event.stopPropagation();
                  navigate('/premium');
                }}>
                  <span>Premium Yonetimi</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button type="button" className="profile-sub-item" disabled onClick={(event) => event.stopPropagation()}>
                  <span>Bildirim Ayarlari</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="profile-sub-item danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm('Cikis yapmak istiyor musun?')) {
                      logout({ redirect: true });
                    }
                  }}
                >
                  <span>Cikis Yap</span>
                  <span className="sub-item-right">
                    <span className="chevron">›</span>
                  </span>
                </button>
              </div>
            </section>

            <ProfileLegalSection />
          </>
        ) : null}
      </div>

      {editOpen ? (
        <div className="profile-edit-overlay" role="dialog" aria-modal="true">
          <div className="profile-edit-card">
            <div className="profile-edit-header">
              <h2>Profili Düzenle</h2>
              <button type="button" className="icon-btn" onClick={() => setEditOpen(false)} aria-label="Kapat">
                ✕
              </button>
            </div>
            <div className="profile-edit-body">
              <div className="profile-edit-avatar">
                <div className="profile-avatar-lg">
                  {avatarPreview || user?.avatarUrl ? (
                    <img src={avatarPreview || user?.avatarUrl} alt={displayName} />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div className="profile-edit-actions">
                  <label className="secondary-btn">
                    Fotoğraf Seç
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 3 * 1024 * 1024) {
                          setEditError('Dosya boyutu en fazla 3MB olmalı.');
                          return;
                        }
                        setEditError('');
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }}
                      hidden
                    />
                  </label>
                  {user?.avatarUrl ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={async () => {
                        try {
                          setAvatarLoading(true);
                          await api.delete('/users/me/avatar');
                          updateUser({ avatarUrl: '' });
                        } catch (_error) {
                          setEditError('Avatar kaldırılamadı.');
                        } finally {
                          setAvatarLoading(false);
                        }
                      }}
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? 'Siliniyor...' : 'Fotoğrafı kaldır'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="auth-field">
                <label>İsim</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Ad Soyad"
                />
              </div>
              {editError ? <div className="auth-alert">{editError}</div> : null}
            </div>
            <div className="profile-edit-footer">
              <button type="button" className="secondary-btn" onClick={() => setEditOpen(false)}>
                İptal
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={editLoading}
                onClick={async () => {
                  setEditError('');
                  const trimmed = String(editName || '').trim();
                  if (!trimmed || trimmed.length < 2) {
                    setEditError('İsim en az 2 karakter olmalı.');
                    return;
                  }
                  if (trimmed.length > 60) {
                    setEditError('İsim 60 karakteri geçemez.');
                    return;
                  }
                  try {
                    setEditLoading(true);
                    if (avatarFile) {
                      const formData = new FormData();
                      formData.append('avatar', avatarFile);
                      const uploadRes = await api.post('/users/me/avatar', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      updateUser({ avatarUrl: uploadRes?.data?.data?.avatarUrl || '' });
                    }
                    const profileRes = await api.patch('/users/me', { name: trimmed });
                    updateUser({
                      name: profileRes?.data?.data?.name || trimmed,
                      avatarUrl: profileRes?.data?.data?.avatarUrl || user?.avatarUrl || ''
                    });
                    setEditOpen(false);
                  } catch (err) {
                    setEditError(err?.response?.data?.message || 'Profil güncellenemedi.');
                  } finally {
                    setEditLoading(false);
                  }
                }}
              >
                {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ReportIssueSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        sourceType="profile"
        sourceId={user?.id || user?._id}
        relatedRfqId={null}
        reportedUserId={null}
        reportedUserLabel={null}
        defaultRoleRelation="self"
      />
    </div>
  );
}

export default Profile;
