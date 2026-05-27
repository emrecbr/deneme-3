import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategorySelector from '../components/CategorySelector';

const SEGMENT_OPTIONS = [
  { value: 'goods', label: 'Esya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

function Categories({ surfaceVariant = 'app' }) {
  const navigate = useNavigate();
  const [segment, setSegment] = useState('');
  const isWebSurface = surfaceVariant === 'web';

  const handleSelect = (category) => {
    const payload = {
      selectedSegment: category.segment || segment,
      selectedCategoryId: category._id,
      selectedCategoryPath: category.path
    };

    sessionStorage.setItem('selectedCategory', JSON.stringify(payload));
    navigate('/create', { state: payload });
  };

  return (
    <div className={`categories-page ${isWebSurface ? 'categories-page--web' : ''}`}>
      {isWebSurface ? (
        <section className="categories-page__hero">
          <p className="landing-eyebrow">Kategori keşfi</p>
          <h1>Talebinize uygun kategoriyi web sitesi içinden seçin.</h1>
          <p>
            Eşya, hizmet, otomobil ve iş arayan segmentlerinde ilerleyebilir; ihtiyacınızı netleştirdikten
            sonra ürün akışına kontrollü şekilde geçiş yapabilirsiniz.
          </p>
        </section>
      ) : null}

      <div className="cats-inline-wrap" style={{ padding: isWebSurface ? '0' : '0 16px' }}>
        <div className="cats-inline-scroll">
          {SEGMENT_OPTIONS.map((option) => {
            const isActive = segment === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`cats-inline-chip ${isActive ? 'active' : ''}`}
                onClick={() => setSegment(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={isWebSurface ? 'categories-page__selector' : ''}>
        <CategorySelector
          mode="page"
          title="Kategoriler"
          selectedSegment={segment}
          onSegmentChange={setSegment}
          onClose={() => navigate(-1)}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}

export default Categories;
