import { useNavigate } from 'react-router-dom';
import CategorySelector from '../components/CategorySelector';

function Categories() {
  const navigate = useNavigate();

  const handleSelect = (category) => {
    const payload = {
      selectedCategoryId: category._id,
      selectedCategoryPath: category.path
    };

    sessionStorage.setItem('selectedCategory', JSON.stringify(payload));
    navigate('/create', { state: payload });
  };

  return <CategorySelector mode="page" title="Kategoriler" onClose={() => navigate(-1)} onSelect={handleSelect} />;
}

export default Categories;
