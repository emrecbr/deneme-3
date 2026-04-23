import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const ACTION_LABELS = {
  admin_login: 'Admin girisi',
  admin_logout: 'Admin cikisi',
  admin_password_change: 'Sifre degistirildi',
  user_status_update: 'Kullanici durumu guncellendi',
  user_role_update: 'Kullanici rolu guncellendi',
  user_note_create: 'Kullanici notu eklendi',
  user_delete: 'Kullanici pasife alindi',
  rfq_update: 'RFQ guncellendi',
  rfq_status_update: 'RFQ durumu guncellendi',
  rfq_bulk_status_update: 'RFQ toplu durum guncellendi',
  rfq_moderation_update: 'RFQ moderasyon guncellendi',
  rfq_restore: 'RFQ yeniden yayina alindi',
  rfq_delete: 'RFQ kaldirildi',
  listing_expiry_setting_update: 'Ilan yayin suresi guncellendi',
  listing_expired: 'RFQ suresi doldu',
  listing_quota_settings_update: 'Ilan kotasi guncellendi',
  listing_quota_reset: 'Ilan kotasi sifirlandi',
  listing_quota_limit_reached: 'Ilan kotasi doldu',
  listing_paid_create_started: 'Ek ilan odemesi baslatildi',
  listing_paid_create_success: 'Ek ilan odemesi basarili',
  listing_paid_create_failed: 'Ek ilan odemesi basarisiz',
  payment_method_add: 'Odeme yontemi eklendi',
  payment_method_remove: 'Odeme yontemi kaldirildi',
  payment_method_set_default: 'Odeme yontemi varsayilan yapildi',
  moderation_rule_create: 'Moderasyon kurali eklendi',
  moderation_rule_update: 'Moderasyon kurali guncellendi',
  moderation_rule_delete: 'Moderasyon kurali silindi',
  moderation_attempt_review: 'Moderasyon denemesi incelendi',
  moderation_block: 'Icerik engellendi',
  moderation_block_advanced: 'Icerik engellendi (ileri)',
  moderation_review_required: 'Moderasyon inceleme',
  moderation_risk_user_flag: 'Riskli kullanici isaretlendi',
  moderation_rule_toggle: 'Moderasyon ayarlari guncellendi',
  moderation_override: 'Moderasyon override',
  monetization_plan_create: 'Paket olusturuldu',
  monetization_plan_update: 'Paket guncellendi',
  monetization_plan_toggle: 'Paket gorunurlugu guncellendi',
  admin_test_push: 'Test bildirimi gonderildi',
  category_create: 'Kategori olusturuldu',
  category_update: 'Kategori guncellendi',
  search_suggestion_create: 'Arama onerisi olusturuldu',
  search_suggestion_update: 'Arama onerisi guncellendi',
  city_create: 'Sehir olusturuldu',
  city_update: 'Sehir guncellendi',
  district_create: 'Ilce olusturuldu',
  district_update: 'Ilce guncellendi',
  location_issue_fix: 'Konum sorunu duzeltildi',
  radius_settings_update: 'Yaricap ayarlari guncellendi',
  settings_feature_flags_update: 'Feature flag guncellendi',
  settings_maintenance_update: 'Bakim modu guncellendi',
  settings_map_update: 'Harita ayarlari guncellendi',
  content_update: 'Icerik guncellendi',
  permission_denied: 'Yetki reddedildi',
  export_data: 'Export alindi',
  report_status_update: 'Bildirim durumu guncellendi',
  report_note_add: 'Bildirim notu eklendi'
};

const getModuleLabel = (action) => {
  if (!action) return '—';
  if (action.startsWith('rfq_')) return 'RFQ';
  if (action.startsWith('user_')) return 'Kullanici';
  if (action.startsWith('category_')) return 'Kategori';
  if (action.startsWith('search_suggestion')) return 'Arama';
  if (action.startsWith('city_')) return 'Sehir';
  if (action.startsWith('district_')) return 'Ilce';
  if (action.startsWith('location_') || action.startsWith('radius_')) return 'Konum';
  if (action.startsWith('listing_')) return 'Ilan';
  if (action.startsWith('monetization_')) return 'Paket';
  if (action.startsWith('moderation_')) return 'Moderasyon';
  if (action.startsWith('settings_')) return 'Sistem';
  if (action.startsWith('content_')) return 'Icerik';
  if (action.startsWith('admin_')) return 'Admin';
  if (action.startsWith('export_')) return 'Rapor';
  if (action.startsWith('report_')) return 'Sorun Bildirimi';
  return '—';
};

const summarizeMeta = (action, meta) => {
  if (!meta) return '';
  if (meta.rfqId) return `RFQ #${String(meta.rfqId).slice(-6)}`;
  if (meta.userId) return `Kullanici #${String(meta.userId).slice(-6)}`;
  if (meta.categoryId) return `Kategori #${String(meta.categoryId).slice(-6)}`;
  if (meta.cityId) return `Sehir #${String(meta.cityId).slice(-6)}`;
  if (meta.districtId) return `Ilce #${String(meta.districtId).slice(-6)}`;
  if (meta.suggestionId) return `Oneri #${String(meta.suggestionId).slice(-6)}`;
  if (meta.reportId) return `Bildirim #${String(meta.reportId).slice(-6)}`;
  if (action === 'settings_map_update' && meta.path) return `Harita ayari: ${meta.path}`;
  if (action === 'content_update' && (meta.path || meta.section)) return `Icerik alani: ${meta.path || meta.section}`;
  if (meta.changedKeys?.length) return `Degisen alanlar: ${meta.changedKeys.join(', ')}`;
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
        setError(err?.response?.data?.message || 'Audit log alinamadi.');
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
            placeholder="Action (or: rfq_status_update)"
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
            placeholder="Modul (rfq/user/settings/content)"
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
          <div className="admin-empty">Yukleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Kayit bulunamadi.</div>
        ) : (
          <ul className="admin-list">
            {items.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{ACTION_LABELS[item.action] || item.action}</strong>
                  <span className="admin-muted">{getModuleLabel(item.action)}</span>
                  <span className="admin-muted">{item.role || '-'}</span>
                  {item.adminId ? <span className="admin-muted">#{String(item.adminId).slice(-6)}</span> : null}
                  {summarizeMeta(item.action, item.meta) ? <span className="admin-muted">{summarizeMeta(item.action, item.meta)}</span> : null}
                  <span className="admin-muted">{item.action}</span>
                </div>
                <span className="admin-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="admin-pagination">
          <button type="button" className="admin-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
            Onceki
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
