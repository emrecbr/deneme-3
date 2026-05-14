import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { websiteProfileNavItems } from '../content/profileNavigation';
import {
  WEBSITE_PACKAGES_PATH,
  WEBSITE_PROFILE_ACCOUNT_PATH,
  WEBSITE_PROFILE_ALERTS_PATH,
  WEBSITE_PROFILE_FAVORITES_PATH,
  WEBSITE_PROFILE_MESSAGES_PATH,
  WEBSITE_PROFILE_REQUESTS_PATH
} from '../config/surfaces';
import { formatListingQuotaResetDate } from '../utils/listingQuota';

function WebsiteProfileHome() {
  const { user, listingQuota } = useAuth();
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
        setError(requestError.response?.data?.message || 'Profil ozeti alinamadi.');
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
        label: 'Hesabini Duzenle',
        to: WEBSITE_PROFILE_ACCOUNT_PATH,
        helper: 'Bilgiler, guvenlik ve odeme alani'
      },
      {
        label: 'Paketler ve Uyelik',
        to: WEBSITE_PACKAGES_PATH,
        helper: 'Tek pricing sistemi, dijital haklar ve compliance aciklamalari'
      },
      {
        label: 'Takiplerini Ac',
        to: WEBSITE_PROFILE_ALERTS_PATH,
        helper: 'Kategori, sehir ve anahtar kelime takipleri'
      },
      {
        label: 'Mesajlarini Ac',
        to: WEBSITE_PROFILE_MESSAGES_PATH,
        helper: 'Sohbet giris noktasi'
      }
    ],
    []
  );

  const overviewItems = useMemo(
    () => [
      {
        label: 'Toplam Talep',
        value: loading ? '-' : summary.requests,
        note: loading ? 'Veriler yukleniyor' : summary.requests ? 'Olusturdugun talepler' : 'Henuz talep olusturmadin'
      },
      {
        label: 'Bekleyen Talep',
        value: loading ? '-' : summary.pendingRequests,
        note: loading
          ? 'Durum kontrol ediliyor'
          : summary.pendingRequests
            ? 'Onay veya islem bekleyen kayitlar'
            : 'Bekleyen talep gorunmuyor'
      },
      {
        label: 'Mesajlar',
        value: loading ? '-' : summary.chats,
        note: loading ? 'Sohbetler aliniyor' : summary.chats ? 'Aktif sohbetlerin' : 'Henuz aktif sohbet yok'
      },
      {
        label: 'Favoriler',
        value: loading ? '-' : summary.favorites,
        note: loading ? 'Favoriler aliniyor' : summary.favorites ? 'Kaydettigin talepler' : 'Henuz favori eklemedin'
      },
      {
        label: 'Kalan hak',
        value: listingQuota ? `${listingQuota.remaining}/${listingQuota.limit}` : '-',
        note: listingQuota
          ? `Son ${listingQuota.windowDays} gun • Yenilenme ${formatListingQuotaResetDate(listingQuota.resetAt)}`
          : 'Kota bilgisi hesaplanıyor'
      }
    ],
    [listingQuota, loading, summary]
  );

  const statusItems = useMemo(
    () => [
      { label: 'Hesap tipi', value: user?.isPremium ? 'Premium' : 'Standart' },
      { label: 'Bildirim odagi', value: summary.pendingRequests ? 'Bekleyen taleplerin var' : 'Genel takip' },
      { label: 'Mesaj akisi', value: summary.chats ? `${summary.chats} aktif sohbet` : 'Yeni mesaj bekleniyor' }
    ],
    [summary, user]
  );

  return (
    <div className="website-profile-home">
      <section className="website-profile-home__intro card">
        <div>
          <p className="landing-eyebrow">Website profil girisi</p>
          <h2>{user?.name || 'Talepet kullanicisi'}</h2>
          <p>
            Profil alani artik website yuzeyi icinde modul modul ilerliyor. Hesap, paketler, takipler ve gunluk
            aksiyonlar ayni shell icinde daha net bir bilgi mimarisiyle aciliyor.
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
          <strong>Profil ozeti alinamadi</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="website-profile-home__grid">
        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Ucretsiz Ilan Hakkin</h3>
            <span>Website ve app create akisinda ayni kota gorunurlugu kullanilir</span>
          </div>

          {listingQuota ? (
            <div className="website-profile-home__module-list">
              <div className="website-profile-home__module-item">
                <strong>Kalan hak</strong>
                <span>{listingQuota.remaining}/{listingQuota.limit}</span>
              </div>
              <div className="website-profile-home__module-item">
                <strong>Kullanilan</strong>
                <span>{listingQuota.used ?? '-'}</span>
              </div>
              <div className="website-profile-home__module-item">
                <strong>Pencere</strong>
                <span>Son {listingQuota.windowDays} gun</span>
              </div>
              <div className="website-profile-home__module-item">
                <strong>Yenilenme</strong>
                <span>{formatListingQuotaResetDate(listingQuota.resetAt)}</span>
              </div>
            </div>
          ) : (
            <div className="website-profile-home__module-item">
              <strong>Kota bilgisi</strong>
              <span>Hesaplaniyor</span>
            </div>
          )}
        </div>

        <div className="card website-profile-home__panel">
          <div className="website-profile-home__panel-head">
            <h3>Hizli Aksiyonlar</h3>
            <span>En cok kullanilan profile gecisler</span>
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
            <span>Hesabinin guncel ozeti</span>
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
            <h3>Modul Haritasi</h3>
            <span>Website profil alaninda erisebilecegin sayfalar</span>
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
            <h3>Bir Sonraki Adim</h3>
            <span>Gunluk kullanim icin onerilen girisler</span>
          </div>

          <div className="website-profile-home__quick-list">
            <Link to={WEBSITE_PROFILE_REQUESTS_PATH} className="website-profile-home__quick-link">
              <strong>Taleplerini gozden gecir</strong>
              <span>Yayindaki ve bekleyen taleplerini tek yerden yonet.</span>
            </Link>
            <Link to={WEBSITE_PROFILE_FAVORITES_PATH} className="website-profile-home__quick-link">
              <strong>Favorilerini duzenle</strong>
              <span>Kaydettigin RFQ kayitlarini temizle veya tekrar incele.</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default WebsiteProfileHome;
