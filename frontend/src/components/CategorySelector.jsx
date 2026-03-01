import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';

function IconBase({ children, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const Car = () => <IconBase><path d="M5 16h14" /><path d="M7 16V9l2-3h6l2 3v7" /><circle cx="8.5" cy="16.5" r="1.5" /><circle cx="15.5" cy="16.5" r="1.5" /></IconBase>;
const Smartphone = () => <IconBase><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M10 6h4" /><circle cx="12" cy="17.5" r="0.8" /></IconBase>;
const Cpu = () => <IconBase><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></IconBase>;
const Home = () => <IconBase><path d="M3 11.5 12 4l9 7.5" /><path d="M6 10.5V20h12v-9.5" /></IconBase>;
const Bike = () => <IconBase><circle cx="6.5" cy="16.5" r="3.2" /><circle cx="17.5" cy="16.5" r="3.2" /><path d="M6.5 16.5 10 9h4l3.5 7.5M10 9H7.5M14 9l2 3" /></IconBase>;
const Shirt = () => <IconBase><path d="m8 5 4-2 4 2 3 4-3 2v10H8V11L5 9l3-4Z" /></IconBase>;
const Sparkles = () => <IconBase><path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" /><path d="m19 3 .7 1.6L21.3 5l-1.6.7L19 7.3l-.7-1.6L16.7 5l1.6-.7L19 3Z" /></IconBase>;
const Baby = () => <IconBase><circle cx="12" cy="8.5" r="3.5" /><path d="M8 20c0-2.2 1.8-4 4-4s4 1.8 4 4" /><circle cx="10.7" cy="8.3" r=".5" /><circle cx="13.3" cy="8.3" r=".5" /></IconBase>;
const BookOpen = () => <IconBase><path d="M3 6.5C5 5 8 5 11 6v13c-3-1-6-1-8 0z" /><path d="M21 6.5c-2-1.5-5-1.5-8-.5v13c3-1 6-1 8 0z" /></IconBase>;
const Briefcase = () => <IconBase><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12h18" /></IconBase>;
const Dumbbell = () => <IconBase><path d="M3 10v4M6 9v6M18 9v6M21 10v4M6 12h12" /></IconBase>;
const Truck = () => <IconBase><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="17" r="1.7" /><circle cx="17" cy="17" r="1.7" /></IconBase>;
const Wrench = () => <IconBase><path d="M14 6a4 4 0 0 0 4 4l-8.5 8.5a2 2 0 1 1-2.8-2.8L15.2 7.2A4 4 0 0 0 14 6Z" /></IconBase>;
const PawPrint = () => <IconBase><circle cx="7.5" cy="8" r="1.7" /><circle cx="12" cy="6.8" r="1.7" /><circle cx="16.5" cy="8" r="1.7" /><path d="M12 20c3.2 0 5-2 5-4.2S15 12 12 12s-5 1.6-5 3.8S8.8 20 12 20Z" /></IconBase>;
const Gem = () => <IconBase><path d="M3 9 7 4h10l4 5-9 11Z" /><path d="M3 9h18M7 4l5 16M17 4l-5 16" /></IconBase>;

const categoryIcons = {
  Araba: Car,
  Telefon: Smartphone,
  Elektronik: Cpu,
  'Ev & Yaşam': Home,
  Motosiklet: Bike,
  'Giyim & Aksesuar': Shirt,
  'Kişisel Bakım & Kozmetik': Sparkles,
  'Anne & Bebek & Oyuncak': Baby,
  'Hobi & Kitap & Müzik': BookOpen,
  'Ofis & Kırtasiye': Briefcase,
  'Spor & Outdoor': Dumbbell,
  'Diğer Araçlar': Truck,
  'Yapı Market & Bahçe': Wrench,
  'Pet Shop': PawPrint,
  Antika: Gem
};

function CategorySelector({
  mode = 'page',
  open = true,
  onClose,
  onSelect,
  onClear,
  title = 'Kategoriler',
  selectedCategoryId = null
}) {
  const touchStartXRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roots, setRoots] = useState([]);
  const [path, setPath] = useState([]);
  const [direction, setDirection] = useState('forward');

  useEffect(() => {
    if (mode === 'modal' && !open) {
      return;
    }

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await api.get('/categories');
        const flat = response.data?.data || response.data?.items || [];

        const map = {};
        const rootItems = [];

        flat.forEach((cat) => {
          map[String(cat._id)] = { ...cat, children: [] };
        });

        flat.forEach((cat) => {
          const parentId = cat.parent ? String(typeof cat.parent === 'object' ? cat.parent._id : cat.parent) : null;
          if (parentId && map[parentId]) {
            map[parentId].children.push(map[String(cat._id)]);
          } else {
            rootItems.push(map[String(cat._id)]);
          }
        });

        setRoots(rootItems);
        setError('');
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Kategoriler yuklenemedi.');
        setRoots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [mode, open]);

  const currentItems = useMemo(() => {
    if (!path.length) {
      return roots;
    }
    return path[path.length - 1]?.children || [];
  }, [path, roots]);

  const breadcrumb = useMemo(() => path.map((item) => item.name).join(' > '), [path]);

  const goBackLevel = () => {
    if (!path.length) {
      onClose?.();
      return;
    }

    setDirection('back');
    setPath((prev) => prev.slice(0, -1));
  };

  const handleOpenCategory = (item) => {
    if (item.children?.length) {
      setDirection('forward');
      setPath((prev) => [...prev, item]);
      return;
    }

    const selectedPath = [...path, item];
    onSelect?.({
      _id: item._id,
      name: item.name,
      path: selectedPath.map((node) => node.name),
      parentId: path[0]?._id || null
    });
  };

  const handleClearSelection = () => {
    setDirection('back');
    setPath([]);
    onClear?.();
  };

  const onTouchStart = (event) => {
    touchStartXRef.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    if (typeof startX !== 'number') {
      return;
    }

    const endX = event.changedTouches[0].clientX;
    const deltaX = endX - startX;
    if (deltaX > 80 && path.length) {
      goBackLevel();
    }

    touchStartXRef.current = null;
  };

  if (mode === 'modal' && !open) {
    return null;
  }

  const hasSelection = Boolean(selectedCategoryId) || path.length > 0;

  return (
    <div className={mode === 'modal' ? 'category-selector-overlay' : ''}>
      <div
        className={mode === 'modal' ? 'category-selector-modal' : 'categories-page'}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="categories-topbar">
          <h1>{title}</h1>
          <div className="topbar-actions">
            {hasSelection ? (
              <button
                type="button"
                className="icon-btn subtle"
                onClick={handleClearSelection}
                aria-label="Secimi iptal et"
              >
                ×
              </button>
            ) : null}
            <button type="button" className="secondary-btn close-btn" onClick={goBackLevel}>
              {path.length ? 'Geri' : mode === 'modal' ? 'Kapat' : 'Geri'}
            </button>
          </div>
        </div>

        {breadcrumb ? <div className="categories-breadcrumb">{breadcrumb}</div> : null}
        {loading ? <div className="card">Yukleniyor...</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {!loading && !error ? (
          <div className={`categories-grid-wrap ${direction === 'forward' ? 'slide-forward' : 'slide-back'}`} key={breadcrumb || 'root'}>
            <div className="categories-grid">
              {currentItems.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`category-card ${String(selectedCategoryId || '') === String(item._id) ? 'selected' : ''}`}
                  onClick={() => handleOpenCategory(item)}
                >
                  <span className="category-icon">
                    {(() => {
                      const IconComponent = categoryIcons[item.name];
                      return IconComponent ? <IconComponent /> : <Cpu />;
                    })()}
                  </span>
                  <span className="category-content">
                    <span className="category-name">{item.name}</span>
                    <span className="category-meta">
                      {item.children?.length ? `${item.children.length} alt kategori` : 'Kategori sec'}
                    </span>
                  </span>
                  {item.children?.length ? <span className="category-arrow">›</span> : <span className="category-leaf">✓</span>}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CategorySelector;
