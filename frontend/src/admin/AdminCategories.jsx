import { useEffect, useMemo, useState } from 'react';
import api from '../api/adminApi';
import { API_BASE_URL } from '../api/axios';

const SEGMENT_OPTIONS = [
  { value: '', label: 'Tüm segmentler / Belirtilmedi' },
  { value: 'goods', label: 'Esya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

const emptyForm = {
  name: '',
  slug: '',
  order: 0,
  isActive: true,
  segment: '',
  imageUrl: '',
  imageProvider: '',
  imagePublicId: '',
  imageEnabled: true
};

const CATEGORY_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CATEGORY_IMAGE_INPUT_MAX_BYTES = 15 * 1024 * 1024;
const CATEGORY_IMAGE_OUTPUT_MAX_BYTES = 5 * 1024 * 1024;
const CATEGORY_IMAGE_SIZE = 512;
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const buildAssetUrl = (url = '') => {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_ORIGIN}${path}`;
};

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Görsel işlenemedi.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel okunamadı.'));
    };
    image.src = objectUrl;
  });

const resizeCategoryImage = async (file) => {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = CATEGORY_IMAGE_SIZE;
  canvas.height = CATEGORY_IMAGE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Görsel işlenemedi.');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const sourceRatio = image.width / image.height;
  const targetRatio = 1;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, CATEGORY_IMAGE_SIZE, CATEGORY_IMAGE_SIZE);
  const blob = await canvasToBlob(canvas, 0.82);
  if (blob.size > CATEGORY_IMAGE_OUTPUT_MAX_BYTES) {
    throw new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.');
  }
  return blob;
};

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState('');
  const currentImageUrl = useMemo(() => buildAssetUrl(form.imageUrl), [form.imageUrl]);

  const getSegmentLabel = (value) =>
    SEGMENT_OPTIONS.find((item) => item.value === String(value || ''))?.label || 'Belirtilmedi';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        parent: 'none',
        includeInactive: 'true',
        page: String(page),
        limit: '50'
      });
      if (segmentFilter) {
        params.set('segment', segmentFilter);
      }
      const response = await api.get(`/admin/categories?${params.toString()}`);
      setItems(response.data?.items || []);
      setHasMore(Boolean(response.data?.pagination?.hasMore));
    } catch (err) {
      setError(err?.response?.data?.message || 'Kategori listesi alinamadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, segmentFilter]);

  const submit = async () => {
    setMessage('');
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        order: form.order,
        isActive: form.isActive,
        segment: form.segment,
        imageEnabled: form.imageEnabled,
        parent: null
      };
      if (editingId) {
        const response = await api.patch(`/admin/categories/${editingId}`, payload);
        setForm((prev) => ({ ...prev, ...(response.data?.data || {}) }));
        setMessage('Kategori güncellendi.');
      } else {
        await api.post('/admin/categories', payload);
        setMessage('Kategori eklendi. Görsel yüklemek için kategoriyi düzenleyin.');
        setForm(emptyForm);
        setEditingId(null);
      }
      setPage(1);
      load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'İşlem başarısız.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      order: item.order || 0,
      isActive: item.isActive !== false,
      segment: item.segment || '',
      imageUrl: item.imageUrl || '',
      imageProvider: item.imageProvider || '',
      imagePublicId: item.imagePublicId || '',
      imageEnabled: item.imageEnabled !== false
    });
  };

  const updateItemImage = (categoryId, imageFields) => {
    setItems((prev) => prev.map((item) => (item._id === categoryId ? { ...item, ...imageFields } : item)));
  };

  const handleMainCategoryImageUpload = async (categoryId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !categoryId) return;

    setMessage('');
    if (!CATEGORY_IMAGE_TYPES.has(file.type)) {
      setMessage('Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.');
      return;
    }
    if (file.size > CATEGORY_IMAGE_INPUT_MAX_BYTES) {
      setMessage('Bu görsel çok büyük. Lütfen daha küçük bir görsel seçin.');
      return;
    }

    setUploadingImage(true);
    try {
      setMessage('Görsel hazırlanıyor...');
      const resizedBlob = await resizeCategoryImage(file);
      const formData = new FormData();
      formData.append('file', resizedBlob, `main-category-${Date.now()}.webp`);
      setMessage('Görsel yükleniyor...');
      const response = await api.post(`/admin/categories/${categoryId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      const uploaded = response.data?.data || {};
      if (!uploaded.url) {
        throw new Error('Görsel URL alınamadı.');
      }
      const imageFields = {
        imageUrl: uploaded.url,
        imageProvider: uploaded.provider || '',
        imagePublicId: uploaded.publicId || '',
        imageEnabled: true
      };
      setForm((prev) => ({ ...prev, ...imageFields }));
      updateItemImage(categoryId, imageFields);
      setMessage('Görsel yüklendi ve ana kategoriye kaydedildi.');
    } catch (err) {
      const isTimeout = err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
      setMessage(
        isTimeout
          ? 'Görsel yükleme zaman aşımına uğradı. Lütfen tekrar deneyin.'
          : err?.response?.data?.message || err?.message || 'Görsel yüklenemedi.'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMainCategoryImageRemove = async (categoryId) => {
    if (!categoryId) return;
    setMessage('');
    try {
      const response = await api.delete(`/admin/categories/${categoryId}/image`);
      const next = response.data?.data || {};
      const imageFields = {
        imageUrl: next.imageUrl || '',
        imageProvider: next.imageProvider || '',
        imagePublicId: next.imagePublicId || '',
        imageEnabled: next.imageEnabled !== false
      };
      setForm((prev) => ({ ...prev, ...imageFields }));
      updateItemImage(categoryId, imageFields);
      setMessage('Görsel kaldırıldı.');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Görsel kaldırılamadı.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Ana Kategoriler</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-filter-grid">
          <label>
            Segment Filtresi
            <select
              className="admin-input"
              value={segmentFilter}
              onChange={(e) => {
                setSegmentFilter(e.target.value);
                setPage(1);
              }}
            >
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Kategori Adi
            <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Slug
            <input className="admin-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <label>
            Segment
            <select className="admin-input" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sira
            <input className="admin-input" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
          </label>
          <label>
            Aktif
            <select className="admin-input" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Pasif</option>
            </select>
          </label>
        </div>
        {editingId ? (
          <div className="admin-main-category-image-panel">
            <div className="admin-main-category-image-header">
              <span>Kategori</span>
              <strong>{form.name || 'Ana kategori'}</strong>
            </div>
            <div className="admin-main-category-image-preview">
              {currentImageUrl ? (
                <img src={currentImageUrl} alt={`${form.name || 'Ana kategori'} görseli`} />
              ) : (
                <span>Görsel yok</span>
              )}
            </div>
            <div className="admin-main-category-image-controls">
              <div className="admin-row-actions">
                <label className={`admin-btn ${uploadingImage ? 'disabled' : ''}`}>
                  {uploadingImage ? 'Yükleniyor...' : currentImageUrl ? 'Değiştir' : 'Görsel Yükle'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="admin-hidden-file-input"
                    disabled={uploadingImage}
                    onChange={(event) => handleMainCategoryImageUpload(editingId, event)}
                  />
                </label>
                <button type="button" className="admin-btn admin-btn-secondary" disabled={!form.imageUrl || uploadingImage} onClick={() => handleMainCategoryImageRemove(editingId)}>
                  Kaldır
                </button>
              </div>
              <label className="admin-main-category-image-switch">
                <input
                  type="checkbox"
                  checked={form.imageEnabled}
                  onChange={(e) => setForm({ ...form, imageEnabled: e.target.checked })}
                />
                <span>Görsel Aktif</span>
              </label>
            </div>
          </div>
        ) : null}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={submit}>
            {editingId ? 'Güncelle' : 'Ekle'}
          </button>
          {message ? <span className="admin-muted">{message}</span> : null}
        </div>

        {loading ? (
          <div className="admin-empty">Yükleniyor...</div>
        ) : (
          <div className="admin-table">
            <div className="admin-table-row admin-table-head no-checkbox admin-category-table-row">
              <div>Görsel</div>
              <div>Ad</div>
              <div>Segment</div>
              <div>Slug</div>
              <div>Sira</div>
              <div>Aktif</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div key={item._id} className="admin-table-row no-checkbox admin-category-table-row">
                <div>
                  {item.imageUrl ? (
                    <img className="admin-category-thumb" src={buildAssetUrl(item.imageUrl)} alt="" loading="lazy" />
                  ) : (
                    <span className="admin-category-thumb admin-category-thumb--empty">Yok</span>
                  )}
                </div>
                <div>{item.name}</div>
                <div>{getSegmentLabel(item.segment)}</div>
                <div>{item.slug}</div>
                <div>{item.order ?? 0}</div>
                <div>{item.isActive === false ? 'Pasif' : 'Aktif'}</div>
                <div>
                  <button type="button" className="admin-btn" onClick={() => startEdit(item)}>
                    Duzenle
                  </button>
                </div>
              </div>
            ))}
          </div>
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
