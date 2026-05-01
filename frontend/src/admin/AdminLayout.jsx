import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AdminShell from '../components/AdminShell';
import StatusBadge from '../components/StatusBadge';
import { useAdminAuth } from '../context/AdminAuthContext';

const MENU_SECTIONS = [
  {
    title: 'Dashboard',
    items: [{ label: 'Dashboard', to: '/admin' }]
  },
  {
    title: 'RFQ Yonetimi',
    items: [
      { label: 'Tum RFQlar', to: '/admin/rfq/all' },
      { label: 'Moderasyon Kuyrugu', to: '/admin/rfq/moderation' },
      { label: 'Sorunlu RFQlar', to: '/admin/rfq/flagged' },
      { label: 'Suresi Dolanlar', to: '/admin/rfq/expired' }
    ]
  },
  {
    title: 'Kullanicilar',
    items: [
      { label: 'Tum Kullanicilar', to: '/admin/users/all' },
      { label: 'Engellenen ve Supheli', to: '/admin/users/flagged' }
    ]
  },
  {
    title: 'Kategoriler',
    roles: ['admin'],
    items: [
      { label: 'Ana Kategoriler', to: '/admin/categories/main' },
      { label: 'Alt Kategoriler', to: '/admin/categories/sub' },
      { label: 'Kategori Esleme Sorunlari', to: '/admin/categories/mapping' }
    ]
  },
  {
    title: 'Sehir / Ilce',
    roles: ['admin'],
    items: [
      { label: 'Sehirler', to: '/admin/locations/cities' },
      { label: 'Ilceler', to: '/admin/locations/districts' }
    ]
  },
  {
    title: 'Konum Sorunlari',
    roles: ['admin'],
    items: [{ label: 'Konum Sorunlari', to: '/admin/locations/issues' }]
  },
  {
    title: 'Moderasyon',
    items: [
      { label: 'Gelismis Kuyruk', to: '/admin/moderation/queue-advanced' },
      { label: 'Risk Isaretleri', to: '/admin/moderation/risk-signals' },
      { label: 'Moderasyon Kurallari', to: '/admin/moderation/rules' },
      { label: 'Engellenen Denemeler', to: '/admin/moderation/attempts' },
      { label: 'Riskli Kullanicilar', to: '/admin/moderation/risk-users' }
    ]
  },
  {
    title: 'Paketler & Ilan Kotasi',
    roles: ['admin'],
    items: [
      { label: 'Ilan Kotasi', to: '/admin/system/listing-quota' },
      { label: 'Ilan Yayim Suresi', to: '/admin/system/listing-expiry' }
    ]
  },
  {
    title: 'Premium / One Cikarma',
    roles: ['admin'],
    items: [{ label: 'Paketler ve Planlar', to: '/admin/system/monetization-plans' }]
  },
  {
    title: 'Odemeler',
    roles: ['admin'],
    items: [{ label: 'Export ve Finans Ozeti', to: '/admin/reports/exports' }]
  },
  {
    title: 'OTP / SMS / Email Loglari',
    items: [
      { label: 'OTP Loglari', to: '/admin/notifications/otp-logs' },
      { label: 'SMS Loglari', to: '/admin/notifications/sms-logs' },
      { label: 'Email ve Takip Bildirimleri', to: '/admin/alerts' }
    ]
  },
  {
    title: 'Search Analytics',
    items: [{ label: 'Arama Analitigi', to: '/admin/search/analytics' }]
  },
  {
    title: 'RFQ Analytics',
    items: [
      { label: 'Adim Yapisi', to: '/admin/rfq-flow/steps' },
      { label: 'Validasyon Analitigi', to: '/admin/rfq-flow/validation-analytics' },
      { label: 'Genel Raporlar', to: '/admin/reports/overview' }
    ]
  },
  {
    title: 'Feature Flags',
    roles: ['admin'],
    items: [{ label: 'Feature Flags', to: '/admin/system/feature-flags' }]
  },
  {
    title: 'Maintenance Mode',
    roles: ['admin'],
    items: [{ label: 'Bakim Modu', to: '/admin/system/maintenance' }]
  },
  {
    title: 'System Health',
    roles: ['admin'],
    items: [{ label: 'Sistem Sagligi', to: '/admin/system/health' }]
  },
  {
    title: 'Audit Log',
    roles: ['admin'],
    items: [{ label: 'Audit Log', to: '/admin/audit' }]
  },
  {
    title: 'Ayarlar',
    items: [
      { label: 'Arayuz Metinleri', to: '/admin/content/ui-texts' },
      { label: 'Ana Sayfa Icerigi', to: '/admin/content/home' },
      { label: 'Onboarding Metinleri', to: '/admin/content/onboarding' },
      { label: 'Admin Kullanicilari', to: '/admin/admins' },
      { label: 'Harita Ayarlari', to: '/admin/map/settings' },
      { label: 'Arama Onerileri', to: '/admin/search/suggestions' },
      { label: 'Push Loglari', to: '/admin/notifications/push-logs' },
      { label: 'Push Tercihleri', to: '/admin/notifications/push-preferences' },
      { label: 'Sifre Degistir', to: '/admin/account/password' }
    ]
  }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuth();
  const role = admin?.role || 'user';
  const visibleSections = MENU_SECTIONS.filter((section) => !section.roles || section.roles.includes(role));

  return (
    <AdminShell
      sidebar={
        <>
          <div className="brand-link admin-brand">
            <span className="brand-text font-weight-light">Talepet Admin</span>
          </div>
          <div className="sidebar">
            <nav className="mt-2 admin-menu nav nav-pills nav-sidebar flex-column" aria-label="Admin menusu">
              {visibleSections.map((section) => (
                <div key={section.title} className="admin-menu-section nav-item">
                  <div className="admin-menu-title">{section.title}</div>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `nav-link admin-menu-link ${isActive ? 'active' : ''}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </>
      }
      topbar={
        <>
          <div className="admin-topbar-title">Talepet Yonetim Paneli</div>
          <div className="admin-topbar-meta navbar-nav ml-auto">
            <NavLink to="/admin/account/password" className="nav-link admin-topbar-link">
              Sifre Degistir
            </NavLink>
            <span className="admin-topbar-user">{admin?.email}</span>
            <StatusBadge tone="info">{admin?.role || 'user'}</StatusBadge>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm admin-logout"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Cikis
            </button>
          </div>
        </>
      }
    >
      <Outlet />
    </AdminShell>
  );
}
