import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { websiteProfileNavItems } from '../content/profileNavigation';
import {
  WEBSITE_PROFILE_ACCOUNT_PATH,
  WEBSITE_PROFILE_ALERTS_PATH,
  WEBSITE_PROFILE_FAVORITES_PATH,
  WEBSITE_PROFILE_MESSAGES_PATH,
  WEBSITE_PROFILE_PREMIUM_PATH,
  WEBSITE_PROFILE_REQUESTS_PATH
} from '../config/surfaces';

function WebsiteProfileHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    requests: 0,
    pendingRequests: 0,
    chats: 0,
    favorites: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const [rfqResponse, chatResponse, favoriteResponse] = await Promise.all([
          api.get('/rfq?buyer=currentUser&limit=50'),
          api.get('/chats'),
          api.get('/users/favorites')
        ]);

        if (!active) return;

        const rfqItems = rfqResponse.data?.data || rfqResponse.data?.items || [];
        const chatItems = chatResponse.data?.data || chatResponse.data?.items || [];
        const favoriteItems = favoriteResponse.data?.data || favoriteResponse.data?.items || [];
        const pendingStatuses = new Set(['pending', 'waiting', 'draft']);

        setSummary({
          requests: rfqItems.length,
          pendingRequests: rfqItems.filter((item) => pendingStatuses.has(item.status)).length,
          chats: chatItems.length,
          favorites: favoriteItems.length
        });
        setError('');
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Profil özeti alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

  const quickActions = useMemo(
    () => [
      {
        label: 'Hesabını Düzenle',
        to: WEBSITE_PROFILE_ACCOUNT_PATH,
        helper: 'Bilgiler, güvenlik ve ödeme alanı'
      },
      {
        label: 'Premium Alanı',
        to: WEBSITE_PROFILE_PREMIUM_PATH,
        helper: 'Paketler, görünürlük ve ödeme bağlantıları'
      },
      {
        label: 'Takiplerini Aç',
        to: WEBSITE_PROFILE_ALERTS_PATH,
        helper: 'Kategori, şehir ve anahtar kelime takipleri'
      },
      {
        label: 'Mesajlarını Aç',
        to: WEBSITE_PROFILE_MESSAGES_PATH,
        helper: 'Sohbet giriş noktası'
      }
    ],
    []
  );

  const overviewItems = useMemo(
    () => [
      {
        label: 'Toplam Talep',
        value: loading ? '—' : summary.requests,
        note: loading ? 'Veriler yükleniyor' : summary.requests ? 'Oluşturduğun talepler' : 'Henüz talep oluşturmadın'
      },
      {
        label: 'Bekleyen Talep',
        value: loading ? '—' : summary.pendingRequests,
        note: loading ? 'Durum kontrol ediliyor' : summary.pendingRequests ? 'Onay veya işlem bekleyen kayıtlar' : 'Bekleyen talep görünmüyor'
      },
      {
        label: 'Mesajlar',
        value: loading ? '—' : summary.chats,
        note: loading ? 'Sohbetler alınıyor' : summary.chats ? 'Aktif sohbetlerin' : 'Henüz aktif sohbet yok'
      },
      {
        label: 'Favoriler',
        value: loading ? '—' : summary.favorites,
        note: loading ? 'Favoriler alınıyor' : summary.favorites ? 'Kaydettiğin talepler' : 'Henüz favori eklemedin'
      }
    ],
    [loading, summary]
  );

  const statusItems = useMemo(
    () => [
      { label: 'Hesap tipi', value: user?.isPremium ? 'Premium' : 'Standart' },
      { label: 'Bildirim odağı', value: summary.pendingRequests ? 'Bekleyen taleplerin var' : 'Genel takip' },
      { label: 'Mesaj akışı', value: summary.chats ? `${summary.chats} aktif sohbet` : 'Yeni mesaj bekleniyor' }
    ],
    [summary, user]
  );

  return (
    <div className="website-profile-home">
      <section className="website-profile-home__intro card">
        <div>
          <p className="landing-eyebrow">Website profil girişi</p>
          <h2>{user?.name || 'Talepet kullanıcısı'}</h2>
          <p>
            Profil alanın artık website yüzeyi içinde modül modül ilerliyor. Hesap, premium, takipler ve günlük aksiyonlar
            aynı shell içinde daha net bir bilgi mimarisiyle açılıyor.
          </p>
        </div>
      </section>

      <section className="website-profile-home__stats">
        {overviewItems.map((item) => (
          <article key={item.label} className="website-profile-home__stat-card card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      {error ? (
        <section className="card ux-error-state website-profile-state-card">
          <strong>Profil özeti alınamadı</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="website-profile-home__grid">
        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Hızlı Aksiyonlar</h3>
            <span>En çok kullanılan profile geçişler</span>
          </div>

          <div className="website-profile-home__quick-list">
            {quickActions.map((item) => (
              <Link key={item.to} to={item.to} className="website-profile-home__quick-link">
                <strong>{item.label}</strong>
                <span>{item.helper}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Aktif Durumlar</h3>
            <span>Hesabının güncel özeti</span>
          </div>

          <div className="website-profile-home__module-list">
            {statusItems.map((item) => (
              <div key={item.label} className="website-profile-home__module-item">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Modül Haritası</h3>
            <span>Website profil alanında erişebileceğin sayfalar</span>
          </div>

          <div className="website-profile-home__module-list">
            {websiteProfileNavItems.map((item) => (
              <div key={item.to} className="website-profile-home__module-item">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Bir Sonraki Adım</h3>
            <span>Günlük kullanım için önerilen girişler</span>
          </div>

          <div className="website-profile-home__quick-list">
            <Link to={WEBSITE_PROFILE_REQUESTS_PATH} className="website-profile-home__quick-link">
              <strong>Taleplerini gözden geçir</strong>
              <span>Yayındaki ve bekleyen taleplerini tek yerden yönet.</span>
            </Link>
            <Link to={WEBSITE_PROFILE_FAVORITES_PATH} className="website-profile-home__quick-link">
              <strong>Favorilerini düzenle</strong>
              <span>Kaydettiğin RFQ kayıtlarını temizle veya tekrar incele.</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default WebsiteProfileHome;
