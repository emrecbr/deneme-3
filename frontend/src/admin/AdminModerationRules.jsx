import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const DEFAULT_FORM = {
  term: '',
  category: 'other',
  severity: 'block',
  matchType: 'contains',
  isActive: true,
  notes: '',
  riskScoreWeight: 0,
  source: 'manual',
  isSeeded: false
};

const CATEGORY_OPTIONS = [
  { value: 'profanity', label: 'küfür' },
  { value: 'insult', label: 'hakaret' },
  { value: 'violence', label: 'şiddet' },
  { value: 'sexual', label: 'cinsellik' },
  { value: 'harassment', label: 'taciz' },
  { value: 'threat', label: 'tehdit' },
  { value: 'obscene', label: 'müstehcen' },
  { value: 'spam', label: 'spam' },
  { value: 'reklam', label: 'reklam' },
  { value: 'iletişim', label: 'iletişim' },
  { value: 'uygunsuz', label: 'uygunsuz' },
  { value: 'other', label: 'diğer' }
];

const getCategoryLabel = (value) => CATEGORY_OPTIONS.find((item) => item.value === value)?.label || value;

export default function AdminModerationRules() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    severity: '',
    isActive: '',
    source: ''
  });

  const loadRules = async () => {
    try {
      setError('');
      const response = await api.get('/admin/moderation/rules', { params: filters });
      setRules(response.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Kurallar alınamadı.');
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRules();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.term.trim()) {
      setError('Kural metni zorunlu.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      if (editingId) {
        await api.patch(`/admin/moderation/rules/${editingId}`, form);
      } else {
        await api.post('/admin/moderation/rules', form);
      }
      setForm(DEFAULT_FORM);
      setEditingId(null);
      await loadRules();
    } catch (err) {
      setError(err?.response?.data?.message || 'Kural kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setForm({
      term: rule.term || '',
      category: rule.category || 'other',
      severity: rule.severity || 'block',
      matchType: rule.matchType || 'contains',
      isActive: rule.isActive !== false,
      notes: rule.notes || '',
      riskScoreWeight: Number(rule.riskScoreWeight || 0),
      source: rule.source || 'manual',
      isSeeded: Boolean(rule.isSeeded)
    });
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Bu kuralı silmek istiyor musun?')) return;
    try {
      await api.delete(`/admin/moderation/rules/${ruleId}`);
      await loadRules();
    } catch (err) {
      setError(err?.response?.data?.message || 'Kural silinemedi.');
    }
  };

  const formTitle = useMemo(() => (editingId ? 'Kuralı Güncelle' : 'Yeni Kural Ekle'), [editingId]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Moderasyon Kuralları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-panel-subtitle">{formTitle}</div>
          <div className="admin-form-grid">
            <label>
              <span>Terim</span>
              <input
                value={form.term}
                onChange={(event) => setForm((prev) => ({ ...prev, term: event.target.value }))}
                placeholder="Örn: whatsapp, bedava, küfür"
              />
            </label>
            <label>
              <span>Kategori</span>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Seviye</span>
              <select
                value={form.severity}
                onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
              >
                <option value="block">Engelle</option>
                <option value="warn">Uyarı</option>
              </select>
            </label>
            <label>
              <span>Eşleşme Tipi</span>
              <select
                value={form.matchType}
                onChange={(event) => setForm((prev) => ({ ...prev, matchType: event.target.value }))}
              >
                <option value="contains">Contains</option>
                <option value="phrase">Phrase</option>
                <option value="exact">Exact</option>
                <option value="regex">Regex</option>
              </select>
            </label>
          <label>
            <span>Aktif</span>
            <select
              value={form.isActive ? 'true' : 'false'}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.value === 'true' }))
              }
            >
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Not</span>
            <input
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Admin notu"
            />
          </label>
          <label>
            <span>Risk Skor Etkisi</span>
            <input
              type="number"
              value={form.riskScoreWeight}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, riskScoreWeight: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            <span>Kaynak</span>
            <select
              value={form.source}
              onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
            >
              <option value="manual">Manuel</option>
              <option value="seeded">Seed</option>
              <option value="tdk_seed">TDK Seed</option>
              <option value="curated_seed">Curated Seed</option>
            </select>
          </label>
        </div>
          <div className="admin-form-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setEditingId(null);
                  setForm(DEFAULT_FORM);
                }}
              >
                İptal
              </button>
            ) : null}
          </div>
        </form>

        <div className="admin-divider"></div>
        <div className="admin-panel-subtitle">Kurallar</div>
        <div className="admin-form-grid">
          <label>
            <span>Arama</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Terim ara..."
            />
          </label>
          <label>
            <span>Kategori</span>
            <select
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">Tümü</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Seviye</span>
            <select
              value={filters.severity}
              onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="block">Engelle</option>
              <option value="warn">Uyarı</option>
            </select>
          </label>
          <label>
            <span>Aktif</span>
            <select
              value={filters.isActive}
              onChange={(event) => setFilters((prev) => ({ ...prev, isActive: event.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="true">Açık</option>
              <option value="false">Kapalı</option>
            </select>
          </label>
          <label>
            <span>Kaynak</span>
            <select
              value={filters.source}
              onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
            >
              <option value="">Tümü</option>
              <option value="manual">Manuel</option>
              <option value="seeded">Seed</option>
              <option value="tdk_seed">TDK Seed</option>
              <option value="curated_seed">Curated Seed</option>
            </select>
          </label>
        </div>

        {rules.length ? (
          <ul className="admin-list">
            {rules.map((rule) => (
              <li key={rule._id}>
                <div>
                  <strong>{rule.term}</strong>
                  <span className="admin-muted">
                    {getCategoryLabel(rule.category)} · {rule.severity} · {rule.matchType} · skor {rule.riskScoreWeight || 0} · {rule.source || 'manual'} · {rule.isActive ? 'aktif' : 'kapalı'}
                  </span>
                </div>
                <div className="admin-actions">
                  <button type="button" className="link-btn" onClick={() => startEdit(rule)}>
                    Düzenle
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => handleDelete(rule._id)}>
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">Kural bulunamadı.</div>
        )}
      </div>
    </div>
  );
}
