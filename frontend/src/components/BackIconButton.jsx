import { useNavigate } from 'react-router-dom';

function BackIconButton({ className = '' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/profile');
  };

  return (
    <button type="button" className={`icon-btn back-icon ${className}`} aria-label="Geri" onClick={handleBack}>
      ‹
    </button>
  );
}

export default BackIconButton;
