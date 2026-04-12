import { useNavigate } from 'react-router-dom';
import { WEB_HOME_PATH } from '../config/surfaces';

function PublicTopBar({ title, fallbackTo = WEB_HOME_PATH }) {
  const navigate = useNavigate();

  const handleBack = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';
    const hasInternalHistory = Boolean(referrer) && referrer.startsWith(origin) && window.history.length > 1;

    if (hasInternalHistory) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo);
  };

  return (
    <header className="public-topbar">
      <button
        type="button"
        className="public-topbar-back"
        onClick={handleBack}
        aria-label="Geri dön"
      >
        <span className="public-topbar-back-icon" aria-hidden="true">‹</span>
        <span className="public-topbar-back-text">Geri dön</span>
      </button>

      <div className="public-topbar-title-wrap">
        <h1 className="public-topbar-title" title={title}>{title}</h1>
      </div>

      <div className="public-topbar-spacer" aria-hidden="true" />
    </header>
  );
}

export default PublicTopBar;
