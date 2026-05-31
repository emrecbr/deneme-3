import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const SEGMENTS = [
  { value: '', label: 'Genel' },
  { value: 'goods', label: 'Eşya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan' }
];
const SECTION_SOURCES = [
  { value: 'featured', label: 'Öne çıkan' },
  { value: 'nearby', label: 'Yakındaki' },
  { value: 'latest', label: 'Son eklenen' },
  { value: 'premium', label: 'Premium' }
];

const defaultForm = {
  heroTitle: 'Talepet ile hızlı talep oluştur',
  heroSubtitle: 'Bulunduğun bölgede teklifleri keşfet.',
  layoutVariant: 'premium_mobile_v1',
  heroBanner: {
    enabled: true,
    title: 'Talebini daha hızlı tamamla',
    subtitle: 'Yakındaki açık talepleri keşfet, ihtiyacını paylaş ve doğru tekliflere daha hızlı ulaş.',
    ctaLabel: 'Talep Oluştur',
    ctaPath: '/create',
    imageUrl: '',
    overlayEnabled: true,
    sortOrder: 10
  },
  quickCategories: [],
  homeSections: [],
  visualTheme: {
    background: '#F5F1EA',
    cardRadius: 28,
    useSoftCards: true
  }
};

const emptyCategory = (index = 0) => ({
  key: `quick-${Date.now()}-${index}`,
  label: '',
  segment: '',
  categoryId: '',
  iconUrl: '',
  backgroundColor: '#F8F6F2',
  enabled: true,
  sortOrder: (index + 1) * 10
});

const emptySection = (index = 0) => ({
  key: `section-${Date.now()}-${index}`,
  title: '',
  subtitle: '',
  enabled: true,
  source: 'latest',
  sortOrder: (index + 1) * 10
});

const normalizeForm = (payload = {}) => ({
  ...defaultForm,
  ...payload,
  heroBanner: { ...defaultForm.heroBanner, ...(payload.heroBanner || {}) },
  visualTheme: { ...defaultForm.visualTheme, ...(payload.visualTheme || {}) },
  quickCategories: Array.isArray(payload.quickCategories) ? payload.quickCategories : defaultForm.quickCategories,
  homeSections: Array.isArray(payload.homeSections) ? payload.homeSections : defaultForm.homeSections
});

const buildAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

export default function AdminContentHome() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/content/home');
        if (!active) return;
        setForm(normalizeForm(response.data?.data || {}));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'İçerik alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const enabledQuickCategories = useMemo(
    () => [...(form.quickCategories || [])].filter((item) => item.enabled !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [form.quickCategories]
  );

  const enabledSections = useMemo(
    () => [...(form.homeSections || [])].filter((item) => item.enabled !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [form.homeSections]
  );

  const updateHero = (key, value) => {
    setForm((prev) => ({ ...prev, heroBanner: { ...prev.heroBanner, [key]: value } }));
  };

  const updateTheme = (key, value) => {
    setForm((prev) => ({ ...prev, visualTheme: { ...prev.visualTheme, [key]: value } }));
  };

  const updateQuickCategory = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      quickCategories: (prev.quickCategories || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const updateSection = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      homeSections: (prev.homeSections || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const addQuickCategory = () => {
    setForm((prev) => ({
      ...prev,
      quickCategories: [...(prev.quickCategories || []), emptyCategory(prev.quickCategories?.length || 0)]
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      homeSections: [...(prev.homeSections || []), emptySection(prev.homeSections?.length || 0)]
    }));
  };

  const removeQuickCategory = (index) => {
    setForm((prev) => ({
      ...prev,
      quickCategories: (prev.quickCategories || []).filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const removeSection = (index) => {
    setForm((prev) => ({
      ...prev,
      homeSections: (prev.homeSections || []).filter((_item, itemIndex) => itemIndex !== index)
    }));
  };

  const uploadAsset = async (file, target, index = null) => {
    if (!file) return;
    setUploadingKey(index == null ? target : `${target}-${index}`);
    setError('');
    setSuccess('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      const response = await api.post('/admin/content/home/asset', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = response.data?.data?.url || '';
      if (!url) {
        throw new Error('Upload URL alınamadı.');
      }
      if (target === 'hero') {
        updateHero('imageUrl', url);
      } else if (target === 'quickCategory') {
        updateQuickCategory(index, 'iconUrl', url);
      }
      setSuccess('Görsel yüklendi. Yayına almak için Kaydet butonuna bas.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Görsel yüklenemedi.');
    } finally {
      setUploadingKey('');
    }
  };

  const save = async () => {
    if (!window.confirm('Ana sayfa görsel yönetimi güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/content/home', form);
      setForm(normalizeForm(response.data?.data || form));
      setSuccess('Ana sayfa içerikleri güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'İçerik güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel admin-home-visuals">
      <div className="admin-panel-title">Ana Sayfa Görsel Yönetimi</div>
      <div className="admin-panel-subtitle">
        Uygulama ana sayfasındaki hero banner, kategori kısa yolları ve liste bölüm başlıkları buradan yönetilir.
      </div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <div className="admin-home-visuals-grid">
            <div className="admin-home-visuals-editor">
              <div className="admin-card admin-plan-card">
                <div className="admin-card-title">Eski başlık alanı</div>
                <div className="admin-form-grid">
                  <label>
                    <span>Başlık</span>
                    <input className="admin-input" value={form.heroTitle || ''} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
                  </label>
                  <label>
                    <span>Alt başlık</span>
                    <textarea className="admin-textarea" rows={3} value={form.heroSubtitle || ''} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
                  </label>
                </div>
              </div>

              <div className="admin-card admin-plan-card">
                <div className="admin-card-title">Hero Banner</div>
                <div className="admin-form-grid">
                  <label>
                    <span>Aktif</span>
                    <select className="admin-input" value={form.heroBanner.enabled ? '1' : '0'} onChange={(e) => updateHero('enabled', e.target.value === '1')}>
                      <option value="1">Aktif</option>
                      <option value="0">Pasif</option>
                    </select>
                  </label>
                  <label>
                    <span>Overlay</span>
                    <select className="admin-input" value={form.heroBanner.overlayEnabled ? '1' : '0'} onChange={(e) => updateHero('overlayEnabled', e.target.value === '1')}>
                      <option value="1">Aktif</option>
                      <option value="0">Pasif</option>
                    </select>
                  </label>
                  <label>
                    <span>Başlık</span>
                    <input className="admin-input" value={form.heroBanner.title || ''} onChange={(e) => updateHero('title', e.target.value)} />
                  </label>
                  <label>
                    <span>Alt başlık</span>
                    <textarea className="admin-textarea" rows={3} value={form.heroBanner.subtitle || ''} onChange={(e) => updateHero('subtitle', e.target.value)} />
                  </label>
                  <label>
                    <span>CTA metni</span>
                    <input className="admin-input" value={form.heroBanner.ctaLabel || ''} onChange={(e) => updateHero('ctaLabel', e.target.value)} />
                  </label>
                  <label>
                    <span>CTA path</span>
                    <input className="admin-input" placeholder="/create" value={form.heroBanner.ctaPath || ''} onChange={(e) => updateHero('ctaPath', e.target.value)} />
                  </label>
                  <label>
                    <span>Görsel URL</span>
                    <input className="admin-input" value={form.heroBanner.imageUrl || ''} onChange={(e) => updateHero('imageUrl', e.target.value)} />
                  </label>
                  <label>
                    <span>Görsel upload</span>
                    <input
                      className="admin-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => uploadAsset(e.target.files?.[0], 'hero')}
                    />
                  </label>
                </div>
              </div>

              <div className="admin-card admin-plan-card">
                <div className="admin-card-title">Kategori Kısa Yolları</div>
                <div className="admin-repeat-list">
                  {(form.quickCategories || []).map((item, index) => (
                    <div className="admin-repeat-item" key={item.key || index}>
                      <div className="admin-repeat-header">
                        <strong>{item.label || `Kısa yol ${index + 1}`}</strong>
                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => removeQuickCategory(index)}>
                          Sil
                        </button>
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          <span>Label</span>
                          <input className="admin-input" value={item.label || ''} onChange={(e) => updateQuickCategory(index, 'label', e.target.value)} />
                        </label>
                        <label>
                          <span>Segment</span>
                          <select className="admin-input" value={item.segment || ''} onChange={(e) => updateQuickCategory(index, 'segment', e.target.value)}>
                            {SEGMENTS.map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Category ID</span>
                          <input className="admin-input" value={item.categoryId || ''} onChange={(e) => updateQuickCategory(index, 'categoryId', e.target.value)} />
                        </label>
                        <label>
                          <span>Arka plan</span>
                          <input className="admin-input" type="color" value={item.backgroundColor || '#F8F6F2'} onChange={(e) => updateQuickCategory(index, 'backgroundColor', e.target.value)} />
                        </label>
                        <label>
                          <span>Aktif</span>
                          <select className="admin-input" value={item.enabled === false ? '0' : '1'} onChange={(e) => updateQuickCategory(index, 'enabled', e.target.value === '1')}>
                            <option value="1">Aktif</option>
                            <option value="0">Pasif</option>
                          </select>
                        </label>
                        <label>
                          <span>Sıra</span>
                          <input className="admin-input" type="number" value={item.sortOrder || 0} onChange={(e) => updateQuickCategory(index, 'sortOrder', Number(e.target.value))} />
                        </label>
                        <label>
                          <span>Icon URL</span>
                          <input className="admin-input" value={item.iconUrl || ''} onChange={(e) => updateQuickCategory(index, 'iconUrl', e.target.value)} />
                        </label>
                        <label>
                          <span>Icon upload</span>
                          <input
                            className="admin-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => uploadAsset(e.target.files?.[0], 'quickCategory', index)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={addQuickCategory}>
                  Kısa Yol Ekle
                </button>
              </div>

              <div className="admin-card admin-plan-card">
                <div className="admin-card-title">Ana Sayfa Bölümleri</div>
                <div className="admin-repeat-list">
                  {(form.homeSections || []).map((item, index) => (
                    <div className="admin-repeat-item" key={item.key || index}>
                      <div className="admin-repeat-header">
                        <strong>{item.title || `Bölüm ${index + 1}`}</strong>
                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => removeSection(index)}>
                          Sil
                        </button>
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          <span>Başlık</span>
                          <input className="admin-input" value={item.title || ''} onChange={(e) => updateSection(index, 'title', e.target.value)} />
                        </label>
                        <label>
                          <span>Kaynak</span>
                          <select className="admin-input" value={item.source || 'latest'} onChange={(e) => updateSection(index, 'source', e.target.value)}>
                            {SECTION_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Alt başlık</span>
                          <input className="admin-input" value={item.subtitle || ''} onChange={(e) => updateSection(index, 'subtitle', e.target.value)} />
                        </label>
                        <label>
                          <span>Aktif</span>
                          <select className="admin-input" value={item.enabled === false ? '0' : '1'} onChange={(e) => updateSection(index, 'enabled', e.target.value === '1')}>
                            <option value="1">Aktif</option>
                            <option value="0">Pasif</option>
                          </select>
                        </label>
                        <label>
                          <span>Sıra</span>
                          <input className="admin-input" type="number" value={item.sortOrder || 0} onChange={(e) => updateSection(index, 'sortOrder', Number(e.target.value))} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={addSection}>
                  Bölüm Ekle
                </button>
              </div>

              <div className="admin-card admin-plan-card">
                <div className="admin-card-title">Görsel Tema</div>
                <div className="admin-form-grid">
                  <label>
                    <span>Arka plan</span>
                    <input className="admin-input" type="color" value={form.visualTheme.background || '#F5F1EA'} onChange={(e) => updateTheme('background', e.target.value)} />
                  </label>
                  <label>
                    <span>Kart radius</span>
                    <input className="admin-input" type="number" value={form.visualTheme.cardRadius || 28} onChange={(e) => updateTheme('cardRadius', Number(e.target.value))} />
                  </label>
                  <label>
                    <span>Soft kartlar</span>
                    <select className="admin-input" value={form.visualTheme.useSoftCards ? '1' : '0'} onChange={(e) => updateTheme('useSoftCards', e.target.value === '1')}>
                      <option value="1">Aktif</option>
                      <option value="0">Pasif</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <aside className="admin-home-preview">
              <div className="admin-home-preview-phone">
                <div className="admin-home-preview-top">
                  <strong>Talepet</strong>
                  <span>İstanbul</span>
                </div>
                {form.heroBanner.enabled ? (
                  <div
                    className={`admin-home-preview-hero ${form.heroBanner.overlayEnabled ? 'with-overlay' : ''}`}
                    style={form.heroBanner.imageUrl ? { backgroundImage: `url(${buildAssetUrl(form.heroBanner.imageUrl)})` } : undefined}
                  >
                    <div>
                      <span>Premium ana sayfa</span>
                      <h3>{form.heroBanner.title}</h3>
                      <p>{form.heroBanner.subtitle}</p>
                    </div>
                  </div>
                ) : null}
                <div className="admin-home-preview-quick">
                  {enabledQuickCategories.slice(0, 4).map((item) => (
                    <div key={item.key || item.label} style={{ background: item.backgroundColor || '#F8F6F2' }}>
                      {item.iconUrl ? <img src={buildAssetUrl(item.iconUrl)} alt="" /> : <span>{String(item.label || '?').slice(0, 1)}</span>}
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
                {enabledSections[0] ? (
                  <div className="admin-home-preview-section">
                    <strong>{enabledSections[0].title}</strong>
                    <span>{enabledSections[0].subtitle}</span>
                  </div>
                ) : null}
                <div className="admin-home-preview-card" />
                <div className="admin-home-preview-card short" />
              </div>
            </aside>
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={save} disabled={loading || saving || Boolean(uploadingKey)}>
            {saving ? 'Kaydediliyor…' : uploadingKey ? 'Görsel yükleniyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
