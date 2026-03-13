import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MENU_SECTIONS = [
  {
    title: 'Gösterge Paneli',
    items: [{ label: 'Dashboard', to: '/admin' }]
  },
  {
    title: 'RFQ / İlan Yönetimi',
    items: [
      { label: 'Tüm RFQ’lar', to: '/admin/rfq/all' },
      { label: 'Moderasyon Kuyruğu', to: '/admin/rfq/moderation' },
      { label: 'Sorunlu RFQ’lar', to: '/admin/rfq/flagged' }
    ]
  },
  {
    title: 'Moderasyon',
    items: [
      { label: 'Gelişmiş Kuyruk', to: '/admin/moderation/queue-advanced' },
      { label: 'Risk İşaretleri', to: '/admin/moderation/risk-signals' }
    ]
  },
  {
    title: 'RFQ Oluşturma Akışı',
    items: [
      { label: 'Adım Yapısı', to: '/admin/rfq-flow/steps' },
      { label: 'Validasyon Analitiği', to: '/admin/rfq-flow/validation-analytics' },
      { label: 'Form Hata İzleme', to: '/admin/rfq-flow/errors' }
    ]
  },
  {
    title: 'Kullanıcılar',
    items: [
      { label: 'Tüm Kullanıcılar', to: '/admin/users/all' },
      { label: 'Engellenen / Şüpheli Kullanıcılar', to: '/admin/users/flagged' }
    ]
  },
  {
    title: 'Kategoriler',
    roles: ['admin'],
    items: [
      { label: 'Ana Kategoriler', to: '/admin/categories/main' },
      { label: 'Alt Kategoriler', to: '/admin/categories/sub' },
      { label: 'Kategori Eşleme Sorunları', to: '/admin/categories/mapping' },
      { label: 'Arama Öneri Kategorileri', to: '/admin/categories/suggestions' }
    ]
  },
  {
    title: 'Konum Yönetimi',
    roles: ['admin'],
    items: [
      { label: 'Şehirler', to: '/admin/locations/cities' },
      { label: 'İlçeler', to: '/admin/locations/districts' },
      { label: 'Konum Sorunları', to: '/admin/locations/issues' },
      { label: 'Canlı Konum / Yarıçap Ayarları', to: '/admin/locations/live' }
    ]
  },
  {
    title: 'Harita',
    roles: ['admin'],
    items: [
      { label: 'Harita Ayarları', to: '/admin/map/settings' },
      { label: 'Haritada Görünmeyen İlanlar', to: '/admin/map/missing' },
      { label: 'Harita Test Ekranı', to: '/admin/map/test' }
    ]
  },
  {
    title: 'Arama ve Filtreler',
    items: [
      { label: 'Arama Analitiği', to: '/admin/search/analytics' },
      { label: 'Arama Önerileri', to: '/admin/search/suggestions' },
      { label: 'Filtre Ayarları', to: '/admin/search/filters' }
    ]
  },
  {
    title: 'Bildirimler',
    items: [
      { label: 'SMS Logları', to: '/admin/notifications/sms-logs' },
      { label: 'OTP İşlemleri', to: '/admin/notifications/otp-logs' },
      { label: 'Bildirim Şablonları', to: '/admin/notifications/templates' }
    ]
  },
  {
    title: 'İçerik Yönetimi',
    roles: ['admin'],
    items: [
      { label: 'Ana Sayfa', to: '/admin/content/home' },
      { label: 'Onboarding / Yardım Metinleri', to: '/admin/content/onboarding' },
      { label: 'Arayüz Metinleri', to: '/admin/content/ui-texts' }
    ]
  },
  {
    title: 'Sistem',
    roles: ['admin'],
    items: [
      { label: 'Sistem Sağlığı', to: '/admin/system/health' },
      { label: 'Hata Kayıtları', to: '/admin/system/errors' },
      { label: 'Feature Flags', to: '/admin/system/feature-flags' },
      { label: 'Bakım Modu', to: '/admin/system/maintenance' }
    ]
  },
  {
    title: 'Raporlar',
    items: [
      { label: 'Genel Özet', to: '/admin/reports/overview' },
      { label: 'Export', to: '/admin/reports/exports' }
    ]
  },
  {
    title: 'Admin',
    roles: ['admin'],
    items: [
      { label: 'Admin Kullanıcıları', to: '/admin/admins' },
      { label: 'Roller ve Yetkiler', to: '/admin/roles' },
      { label: 'Audit Log', to: '/admin/audit' }
    ]
  }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const role = user?.role || 'user';
  const canSeeSection = (section) => {
    if (!section.roles) return true;
    return section.roles.includes(role);
  };
  const visibleSections = MENU_SECTIONS.filter(canSeeSection);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Talepet Admin</div>
        <nav className="admin-menu">
          {visibleSections.map((section) => (
            <div key={section.title} className="admin-menu-section">
              <div className="admin-menu-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className="admin-menu-link">
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-topbar-title">Admin Panel</div>
          <div className="admin-topbar-meta">
            <span>{user?.email}</span>
            <span className="admin-role">{user?.role}</span>
            <button
              type="button"
              className="admin-logout"
              onClick={() => logout({ redirect: true })}
            >
              Çıkış
            </button>
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
