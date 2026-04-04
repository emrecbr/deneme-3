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
const Shirt = () => <IconBase><path d="m8 5 4-2 4 2 3 4-3 2v10H8V11L5 9l3-4Z" /></IconBase>;
const Briefcase = () => <IconBase><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12h18" /></IconBase>;
const Wrench = () => <IconBase><path d="M14 6a4 4 0 0 0 4 4l-8.5 8.5a2 2 0 1 1-2.8-2.8L15.2 7.2A4 4 0 0 0 14 6Z" /></IconBase>;

const SEGMENT_OPTIONS = [
  { value: 'goods', label: 'Eşya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

function buildTreeFromFlat(items) {
  const map = new Map();
  const roots = [];

  items.forEach((cat) => {
    map.set(String(cat._id), { ...cat, children: [] });
  });

  items.forEach((cat) => {
    const parentId = cat.parent ? String(typeof cat.parent === 'object' ? cat.parent._id : cat.parent) : null;
    const node = map.get(String(cat._id));
    if (!node) return;

    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function normalizeTree(nodes, inheritedSegment = '') {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((node) => ({
    ...node,
    segment: node.segment || inheritedSegment || '',
    children: normalizeTree(node.children || [], node.segment || inheritedSegment || '')
  }));
}

const categoryIcons = {
  Araba: Car,
  Telefon: Smartphone,
  Elektronik: Cpu,
  Hizmet: Wrench,
  Moda: Shirt,
  'İş & Freelance': Briefcase,
  'Ev & Yaşam': Home
};

function CategorySelector({
  mode = 'page',
  open = true,
  onClose,
  onSelect,
  onClear,
  title = 'Kategoriler',
  selectedCategoryId = null,
  selectedSegment = '',
  onSegmentChange
}) {
  const touchStartXRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roots, setRoots] = useState([]);
  const [path, setPath] = useState([]);
  const [direction, setDirection] = useState('forward');
  const [internalSegment, setInternalSegment] = useState(selectedSegment || '');

  useEffect(() => {
    setInternalSegment(selectedSegment || '');
  }, [selectedSegment]);

  const activeSegment = selectedSegment || internalSegment;

  useEffect(() => {
    if (mode === 'modal' && !open) {
      return;
    }
    if (!activeSegment) {
      setRoots([]);
      setPath([]);
      setLoading(false);
      setError('');
      return;
    }

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await api.get('/categories', { params: { segment: activeSegment } });
        const flat = response.data?.data || response.data?.items || [];
        const tree = response.data?.tree || [];
        const rootItems = normalizeTree(tree.length ? tree : buildTreeFromFlat(flat), activeSegment);

        setRoots(rootItems);
        setPath([]);
        setError('');
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Kategoriler yüklenemedi.');
        setRoots([]);
        setPath([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [activeSegment, mode, open]);

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
      parentId: path[0]?._id || null,
      segment: activeSegment
    });
  };

  const handleClearSelection = () => {
    setDirection('back');
    setPath([]);
    onClear?.();
  };

  const handleSegmentSelect = (value) => {
    setInternalSegment(value);
    setPath([]);
    onSegmentChange?.(value);
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
                aria-label="Seçimi iptal et"
              >
                ×
              </button>
            ) : null}
            <button type="button" className="secondary-btn close-btn" onClick={goBackLevel}>
              {path.length ? 'Geri' : mode === 'modal' ? 'Kapat' : 'Geri'}
            </button>
          </div>
        </div>

        <div className="cats-inline-wrap">
          <div className="cats-inline-scroll">
            {SEGMENT_OPTIONS.map((segment) => {
              const isActive = activeSegment === segment.value;
              return (
                <button
                  key={segment.value}
                  type="button"
                  className={`cats-inline-chip ${isActive ? 'active' : ''}`}
                  onClick={() => handleSegmentSelect(segment.value)}
                >
                  {segment.label}
                </button>
              );
            })}
          </div>
        </div>

        {breadcrumb ? <div className="categories-breadcrumb">{breadcrumb}</div> : null}
        {!activeSegment ? <div className="card">Önce bir segment seç.</div> : null}
        {loading ? <div className="card">Yükleniyor...</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {!loading && !error && activeSegment ? (
          <div className={`categories-grid-wrap ${direction === 'forward' ? 'slide-forward' : 'slide-back'}`} key={`${activeSegment}-${breadcrumb || 'root'}`}>
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
                      const IconComponent = categoryIcons[item.name] || (activeSegment === 'auto' ? Car : activeSegment === 'service' ? Wrench : activeSegment === 'jobseeker' ? Briefcase : Cpu);
                      return <IconComponent />;
                    })()}
                  </span>
                  <span className="category-content">
                    <span className="category-name">{item.name}</span>
                    <span className="category-meta">
                      {item.children?.length ? `${item.children.length} alt kategori` : 'Kategori seç'}
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
