const resolveAssetUrl = (url, assetBaseUrl = '') => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(assetBaseUrl || '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function HomeQuickCategories({ items = [], assetBaseUrl, onSelect }) {
  const visibleItems = [...items]
    .filter((item) => item?.enabled !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .slice(0, 4);

  if (!visibleItems.length) {
    return null;
  }

  return (
    <section className="home-quick-categories" aria-label="Kategori kısa yolları">
      <div className="home-quick-categories__grid">
        {visibleItems.map((item) => {
          const imageUrl = resolveAssetUrl(item.imageUrl || item.iconUrl, assetBaseUrl);
          return (
            <button
              key={item.key || item.label}
              type="button"
              className="home-quick-category"
              style={{ '--home-quick-bg': item.backgroundColor || '#F8F6F2' }}
              onClick={() => onSelect?.(item)}
            >
              <span className="home-quick-category__media">
                {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span>{String(item.label || '?').slice(0, 1)}</span>}
              </span>
              <span className="home-quick-category__label">{item.label || 'Kategori'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
