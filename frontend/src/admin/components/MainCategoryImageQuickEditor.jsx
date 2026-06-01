import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/adminApi';
import { API_BASE_URL } from '../../api/axios';

const MAIN_CATEGORY_CARDS = [
  { segment: 'goods', label: 'Eşya', backgroundColor: '#FFF4DE' },
  { segment: 'service', label: 'Hizmet / Usta', backgroundColor: '#EAF2FF' },
  { segment: 'auto', label: 'Otomobil', backgroundColor: '#EEFDF8' },
  { segment: 'jobseeker', label: 'İş Arayan', backgroundColor: '#F3EFFF' }
];

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

const resizeMainCategoryImage = async (file) => {
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
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > 1) {
    sourceWidth = image.height;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, CATEGORY_IMAGE_SIZE, CATEGORY_IMAGE_SIZE);
  const blob = await canvasToBlob(canvas, 0.82);
  if (blob.size > CATEGORY_IMAGE_OUTPUT_MAX_BYTES) {
    throw new Error('Görsel sıkıştırılamadı. Lütfen daha küçük veya daha sade bir görsel deneyin.');
  }
  return blob;
};

const buildDraftFromCategory = (category = {}) => ({
  imageUrl: category.imageUrl || '',
  imageProvider: category.imageProvider || '',
  imagePublicId: category.imagePublicId || '',
  imageEnabled: category.imageEnabled !== false,
  dirty: false,
  markedForRemoval: false,
  status: category.imageUrl ? 'Yayınlandı' : ''
});

export default function MainCategoryImageQuickEditor({
  title = 'Ana Kategori Görselleri',
  description = 'Ana sayfadaki 4 kategori kartının görsellerini buradan yönetebilirsiniz.',
  showHeader = true,
  className = '',
  onPublished
}) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyById, setBusyById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async ({ resetDrafts = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        parent: 'none',
        includeInactive: 'true',
        limit: '50'
      });
      const response = await api.get(`/admin/categories?${params.toString()}`);
      const nextItems = response.data?.items || [];
      setItems(nextItems);
      setDrafts((prev) => {
        const next = resetDrafts ? {} : { ...prev };
        nextItems.forEach((category) => {
          if (!category?._id) return;
          if (!next[category._id] || !next[category._id].dirty || resetDrafts) {
            next[category._id] = buildDraftFromCategory(category);
          }
        });
        return next;
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Kategori listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ resetDrafts: true });
  }, [load]);

  const categoryBySegment = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (item?.segment && !map.has(item.segment)) {
        map.set(item.segment, item);
      }
    });
    return map;
  }, [items]);

  const setCardBusy = (categoryId, value) => {
    setBusyById((prev) => ({ ...prev, [categoryId]: value || '' }));
  };

  const updateDraft = (categoryId, updater) => {
    setDrafts((prev) => {
      const current = prev[categoryId] || buildDraftFromCategory();
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return { ...prev, [categoryId]: next };
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
      updateDraft(categoryId, { status: 'Sadece JPG, PNG veya WebP görsel kullanabilirsiniz.' });
      return;
    }
    if (file.size > CATEGORY_IMAGE_INPUT_MAX_BYTES) {
      updateDraft(categoryId, { status: 'Bu görsel çok büyük. Lütfen daha küçük bir görsel seçin.' });
      return;
    }

    setCardBusy(categoryId, 'uploading');
    try {
      updateDraft(categoryId, { status: 'Görsel hazırlanıyor...' });
      const resizedBlob = await resizeMainCategoryImage(file);
      const formData = new FormData();
      formData.append('file', resizedBlob, `main-category-${Date.now()}.webp`);
      updateDraft(categoryId, { status: 'Görsel yükleniyor...' });
      const response = await api.post(`/admin/categories/${categoryId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });
      const uploaded = response.data?.data || {};
      if (!uploaded.url) {
        throw new Error('Görsel URL alınamadı.');
      }
      updateDraft(categoryId, {
        imageUrl: uploaded.url,
        imageProvider: uploaded.provider || '',
        imagePublicId: uploaded.publicId || '',
        imageEnabled: true,
        dirty: true,
        markedForRemoval: false,
        status: 'Yayınlanmamış değişiklik var'
      });
    } catch (err) {
      const isTimeout = err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
      updateDraft(categoryId, {
        status: isTimeout
          ? 'Görsel yükleme zaman aşımına uğradı. Lütfen tekrar deneyin.'
          : err?.response?.data?.message || err?.message || 'Görsel yüklenemedi.'
      });
    } finally {
      setCardBusy(categoryId, '');
    }
  };

  const handleMainCategoryImageRemove = (categoryId) => {
    if (!categoryId) return;
    updateDraft(categoryId, {
      imageUrl: '',
      imageProvider: '',
      imagePublicId: '',
      imageEnabled: false,
      dirty: true,
      markedForRemoval: true,
      status: 'Görsel kaldırıldı, yayınlamak için kaydet'
    });
  };

  const handleMainCategoryImageEnabledChange = (categoryId, checked) => {
    if (!categoryId) return;
    updateDraft(categoryId, (current) => ({
      ...current,
      imageEnabled: checked,
      dirty: true,
      status: 'Yayınlanmamış değişiklik var'
    }));
  };

  const publishMainCategoryImage = async (categoryId) => {
    if (!categoryId) return;
    const draft = drafts[categoryId] || buildDraftFromCategory();
    setCardBusy(categoryId, 'publishing');
    setMessage('');
    try {
      const response = draft.markedForRemoval
        ? await api.delete(`/admin/categories/${categoryId}/image`)
        : await api.patch(`/admin/categories/${categoryId}/image`, {
            imageUrl: draft.imageUrl,
            imageProvider: draft.imageProvider,
            imagePublicId: draft.imagePublicId,
            imageEnabled: draft.imageEnabled
          });

      const nextCategory = response.data?.data || {};
      const imageFields = {
        imageUrl: nextCategory.imageUrl || '',
        imageProvider: nextCategory.imageProvider || '',
        imagePublicId: nextCategory.imagePublicId || '',
        imageEnabled: nextCategory.imageEnabled !== false
      };
      updateItemImage(categoryId, imageFields);
      setDrafts((prev) => ({
        ...prev,
        [categoryId]: {
          ...buildDraftFromCategory(imageFields),
          status: 'Yayınlandı'
        }
      }));
      setMessage('Kategori görseli yayınlandı.');
      onPublished?.();
    } catch (err) {
      updateDraft(categoryId, { status: err?.response?.data?.message || 'Görsel yayınlanamadı.' });
    } finally {
      setCardBusy(categoryId, '');
    }
  };

  return (
    <section className={`admin-main-category-quick-editor ${className}`.trim()}>
      {showHeader ? (
        <div className="admin-main-category-quick-editor__header">
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
      ) : null}
      {error ? <div className="admin-error">{error}</div> : null}
      {message ? <div className="admin-success">{message}</div> : null}

      {loading ? (
        <div className="admin-empty">Yükleniyor...</div>
      ) : (
        <div className="admin-main-category-card-grid">
          {MAIN_CATEGORY_CARDS.map((definition) => {
            const category = categoryBySegment.get(definition.segment);
            const categoryId = category?._id || '';
            const draft = categoryId ? drafts[categoryId] || buildDraftFromCategory(category) : buildDraftFromCategory();
            const imageUrl = buildAssetUrl(draft.imageUrl);
            const busy = categoryId ? busyById[categoryId] : '';
            const isBusy = Boolean(busy);
            const hasImage = Boolean(draft.imageUrl);
            return (
              <article
                key={definition.segment}
                className="admin-main-category-card"
                style={{ '--category-card-bg': definition.backgroundColor }}
              >
                <div className="admin-main-category-card__header">
                  <span>Kategori</span>
                  <strong>{category?.name || definition.label}</strong>
                </div>
                <div className={`admin-main-category-card__preview ${hasImage ? 'has-image' : ''}`}>
                  {imageUrl ? <img src={imageUrl} alt={`${category?.name || definition.label} görseli`} /> : <span>Görsel yok</span>}
                </div>
                <div className="admin-main-category-card__actions">
                  <label className={`admin-btn ${isBusy || !categoryId ? 'disabled' : ''}`}>
                    {busy === 'uploading' ? 'Yükleniyor...' : hasImage ? 'Değiştir' : 'Görsel Seç'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="admin-hidden-file-input"
                      disabled={isBusy || !categoryId}
                      onChange={(event) => handleMainCategoryImageUpload(categoryId, event)}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    disabled={!hasImage || isBusy || !categoryId}
                    onClick={() => handleMainCategoryImageRemove(categoryId)}
                  >
                    Kaldır
                  </button>
                </div>
                <label className="admin-main-category-image-switch">
                  <input
                    type="checkbox"
                    checked={draft.imageEnabled}
                    disabled={isBusy || !categoryId}
                    onChange={(event) => handleMainCategoryImageEnabledChange(categoryId, event.target.checked)}
                  />
                  <span>Görsel Aktif</span>
                </label>
                {draft.status ? <div className="admin-main-category-card__status">{draft.status}</div> : null}
                {!categoryId ? <div className="admin-main-category-card__status is-warning">Kategori kaydı bulunamadı.</div> : null}
                <button
                  type="button"
                  className="admin-btn admin-main-category-card__publish"
                  disabled={!categoryId || isBusy || !draft.dirty}
                  onClick={() => publishMainCategoryImage(categoryId)}
                >
                  {busy === 'publishing' ? 'Yayınlanıyor...' : 'Kaydet ve Yayınla'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
