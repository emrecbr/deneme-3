import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategorySelector from '../components/CategorySelector';

const SEGMENT_OPTIONS = [
  { value: 'goods', label: 'Esya' },
  { value: 'service', label: 'Hizmet / Usta' },
  { value: 'auto', label: 'Otomobil' },
  { value: 'jobseeker', label: 'İş Arayan Kişi' }
];

function Categories() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState('');

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
    <div>
      <div className="cats-inline-wrap" style={{ padding: '0 16px' }}>
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
      <CategorySelector
        mode="page"
        title="Kategoriler"
        selectedSegment={segment}
        onSegmentChange={setSegment}
        onClose={() => navigate(-1)}
        onSelect={handleSelect}
      />
    </div>
  );
}

export default Categories;
