import { useAuth } from '../context/AuthContext';

const PERMISSIONS = [
  { area: 'RFQ Yönetimi', admin: true, moderator: true },
  { area: 'Kullanıcı Yönetimi (görüntüleme)', admin: true, moderator: true },
  { area: 'Kullanıcı rol değiştirme', admin: true, moderator: false },
  { area: 'Kategori/Şehir/İlçe CRUD', admin: true, moderator: false },
  { area: 'Sistem ayarları / Feature flags', admin: true, moderator: false },
  { area: 'Bakım modu', admin: true, moderator: false },
  { area: 'Moderasyon notları', admin: true, moderator: true },
  { area: 'Export / Raporlar', admin: true, moderator: true }
];

export default function AdminPermissions() {
  const { user } = useAuth();
  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Roller ve Yetkiler</div>
      <div className="admin-panel-body">
        <div className="admin-muted">Aktif rol: {user?.role}</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head no-checkbox">
            <div>Alan</div>
            <div>Admin</div>
            <div>Moderator</div>
          </div>
          {PERMISSIONS.map((item) => (
            <div key={item.area} className="admin-table-row no-checkbox">
              <div>{item.area}</div>
              <div>{item.admin ? 'Evet' : 'Hayır'}</div>
              <div>{item.moderator ? 'Evet' : 'Hayır'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
