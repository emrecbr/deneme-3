import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const ACTION_LABELS = {
  admin_login: 'Admin giriş',
  admin_logout: 'Admin çıkış',
  admin_password_change: 'Şifre değiştirildi',
  user_status_update: 'Kullanıcı durumu güncellendi',
  user_role_update: 'Kullanıcı rolü güncellendi',
  user_note_create: 'Kullanıcı notu eklendi',
  user_delete: 'Kullanıcı pasife alındı',
  rfq_update: 'RFQ güncellendi',
  rfq_status_update: 'RFQ durumu güncellendi',
  rfq_bulk_status_update: 'RFQ toplu durum güncellendi',
  rfq_moderation_update: 'RFQ moderasyon güncellendi',
  rfq_restore: 'RFQ yeniden yayına alındı',
  rfq_delete: 'RFQ kaldırıldı',
  listing_expiry_setting_update: 'İlan yayın süresi güncellendi',
  listing_expired: 'RFQ süresi doldu',
  listing_quota_settings_update: 'İlan kotası güncellendi',
  listing_quota_reset: 'İlan kotası sıfırlandı',
  listing_quota_limit_reached: 'İlan kotası doldu',
  listing_paid_create_started: 'Ek ilan ödemesi başlatıldı',
  listing_paid_create_success: 'Ek ilan ödemesi başarılı',
  listing_paid_create_failed: 'Ek ilan ödemesi başarısız',
  payment_method_add: 'Ödeme yöntemi eklendi',
  payment_method_remove: 'Ödeme yöntemi kaldırıldı',
  payment_method_set_default: 'Ödeme yöntemi varsayılan',
  moderation_rule_create: 'Moderasyon kuralı eklendi',
  moderation_rule_update: 'Moderasyon kuralı güncellendi',
  moderation_rule_delete: 'Moderasyon kuralı silindi',
  moderation_attempt_review: 'Moderasyon denemesi incelendi',
  moderation_block: 'İçerik engellendi',
  moderation_block_advanced: 'İçerik engellendi (ileri)',
  moderation_review_required: 'Moderasyon inceleme',
  moderation_risk_user_flag: 'Riskli kullanıcı işaretlendi',
  moderation_rule_toggle: 'Moderasyon ayarları güncellendi',
  moderation_override: 'Moderasyon override',
  monetization_plan_create: 'Paket oluşturuldu',
  monetization_plan_update: 'Paket güncellendi',
  monetization_plan_toggle: 'Paket görünürlüğü güncellendi',
  admin_test_push: 'Test bildirimi gönderildi',
  category_create: 'Kategori oluşturuldu',
  category_update: 'Kategori güncellendi',
  search_suggestion_create: 'Arama önerisi oluşturuldu',
  search_suggestion_update: 'Arama önerisi güncellendi',
  city_create: 'Şehir oluşturuldu',
  city_update: 'Şehir güncellendi',
  district_create: 'İlçe oluşturuldu',
  district_update: 'İlçe güncellendi',
  location_issue_fix: 'Konum sorunu düzeltildi',
  radius_settings_update: 'Yarıçap ayarları güncellendi',
  settings_feature_flags_update: 'Feature flag güncellendi',
  settings_maintenance_update: 'Bakım modu güncellendi',
  settings_map_update: 'Harita ayarları güncellendi',
  content_update: 'İçerik güncellendi',
  permission_denied: 'Yetki reddedildi',
  export_data: 'Export alındı',
  report_status_update: 'Bildirim durumu güncellendi',
  report_note_add: 'Bildirim notu eklendi'
};

const getModuleLabel = (action) => {
  if (!action) return '—';
  if (action.startsWith('rfq_')) return 'RFQ';
  if (action.startsWith('user_')) return 'Kullanıcı';
  if (action.startsWith('category_')) return 'Kategori';
  if (action.startsWith('search_suggestion')) return 'Arama';
  if (action.startsWith('city_')) return 'Şehir';
  if (action.startsWith('district_')) return 'İlçe';
  if (action.startsWith('location_') || action.startsWith('radius_')) return 'Konum';
  if (action.startsWith('listing_')) return 'İlan';
  if (action.startsWith('monetization_')) return 'Paket';
  if (action.startsWith('moderation_')) return 'Moderasyon';
  if (action.startsWith('settings_')) return 'Sistem';
  if (action.startsWith('content_')) return 'İçerik';
  if (action.startsWith('admin_')) return 'Admin';
  if (action.startsWith('export_')) return 'Rapor';
  if (action.startsWith('report_')) return 'Sorun Bildirimi';
  return '—';
};

const summarizeMeta = (meta) => {
  if (!meta) return '';
  if (meta.rfqId) return `RFQ #${String(meta.rfqId).slice(-6)}`;
  if (meta.userId) return `Kullanıcı #${String(meta.userId).slice(-6)}`;
  if (meta.categoryId) return `Kategori #${String(meta.categoryId).slice(-6)}`;
  if (meta.cityId) return `Şehir #${String(meta.cityId).slice(-6)}`;
  if (meta.districtId) return `İlçe #${String(meta.districtId).slice(-6)}`;
  if (meta.suggestionId) return `Öneri #${String(meta.suggestionId).slice(-6)}`;
  if (meta.reportId) return `Bildirim #${String(meta.reportId).slice(-6)}`;
  if (meta.status) return `Durum: ${meta.status}`;
  if (meta.role) return `Rol: ${meta.role}`;
  if (meta.path) return `Yol: ${meta.path}`;
  return '';
};

export default function AdminAuditLog() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [adminId, setAdminId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    if (action) params.set('action', action);
    if (module) params.set('module', module);
    if (adminId) params.set('adminId', adminId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [action, adminId, from, module, page, to]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/audit?${queryParams}`);
        if (!active) return;
        setItems(response.data?.items || []);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Audit log alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [queryParams]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Audit Log</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            placeholder="Action (örn: rfq_status_update)"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          />
          <input
            className="admin-input"
            placeholder="Admin ID"
            value={adminId}
            onChange={(event) => {
              setAdminId(event.target.value);
              setPage(1);
            }}
          />
          <input
            className="admin-input"
            placeholder="Modül (rfq/user/category/city/district/settings/auth)"
            value={module}
            onChange={(event) => {
              setModule(event.target.value);
              setPage(1);
            }}
          />
          <input
            className="admin-input"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <input
            className="admin-input"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayıt bulunamadı.</div>
        ) : (
            <ul className="admin-list">
              {items.map((item) => (
                <li key={item._id}>
                  <div>
                    <strong>{ACTION_LABELS[item.action] || item.action}</strong>
                    <span className="admin-muted">{getModuleLabel(item.action)}</span>
                    <span className="admin-muted">{item.role || '-'}</span>
                    {item.adminId ? <span className="admin-muted">#{String(item.adminId).slice(-6)}</span> : null}
                    {summarizeMeta(item.meta) ? <span className="admin-muted">{summarizeMeta(item.meta)}</span> : null}
                    <span className="admin-muted">{item.action}</span>
                  </div>
                  <span className="admin-muted">{formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}

        <div className="admin-pagination">
          <button type="button" className="admin-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
            Önceki
          </button>
          <span className="admin-muted">Sayfa {page}</span>
          <button type="button" className="admin-btn" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
