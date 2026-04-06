import { useNavigate } from 'react-router-dom';
import visaBadge from '../assets/payment/visa-badge.svg';
import mastercardBadge from '../assets/payment/mastercard-badge.svg';
import iyzicoBadge from '../assets/payment/iyzico-badge.svg';
import { profileLegalContent } from '../content/profileLegalContent';

function ProfileLegalSection() {
  const navigate = useNavigate();

  return (
    <section className="profile-big-card profile-legal-card">
      <div className="profile-card-header">
        <h2>{profileLegalContent.title}</h2>
      </div>
      <p className="profile-legal-description">{profileLegalContent.description}</p>
      <div className="profile-legal-links" aria-label="Yasal bilgiler bağlantıları">
        {profileLegalContent.links.map((item) => (
          <button
            key={item.to}
            type="button"
            className="profile-legal-link"
            onClick={() => navigate(item.to)}
          >
            <span>{item.label}</span>
            <span className="chevron">›</span>
          </button>
        ))}
      </div>
      <div className="profile-legal-note">{profileLegalContent.sslText}</div>
      <div className="profile-legal-payment-text">{profileLegalContent.paymentText}</div>
      <div className="profile-legal-badges" aria-label="Ödeme göstergeleri">
        <img src={visaBadge} alt="Visa" className="profile-legal-badge" />
        <img src={mastercardBadge} alt="MasterCard" className="profile-legal-badge" />
        <img src={iyzicoBadge} alt="iyzico ile Öde" className="profile-legal-badge profile-legal-badge-wide" />
      </div>
      <div className="profile-legal-subtext">{profileLegalContent.paymentSubtext}</div>
    </section>
  );
}

export default ProfileLegalSection;
