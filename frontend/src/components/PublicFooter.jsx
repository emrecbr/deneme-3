import { Link } from 'react-router-dom';
import visaBadge from '../assets/payment/visa-badge.svg';
import mastercardBadge from '../assets/payment/mastercard-badge.svg';
import iyzicoBadge from '../assets/payment/iyzico-badge.svg';
import { PUBLIC_FOOTER_LINKS } from '../content/publicPages';

function PublicFooter() {
  return (
    <footer className="public-footer" aria-label="Kurumsal baglantilar">
      <div className="public-footer-top">
        <div>
          <div className="public-footer-title">Talepet</div>
          <p className="public-footer-copy">
            Talep olusturma, teklif alma ve premium gorunurluk hizmetleri sunan dijital platform.
          </p>
          <p className="public-footer-copy public-footer-copy--muted">
            Talepet kullanicilar arasinda odeme araciligi yapmaz; yalnizca dijital platform
            hizmetleri sunar.
          </p>
        </div>
        <div className="public-payment-badges" aria-label="Odeme saglayicilari">
          <img src={visaBadge} alt="Visa odeme destegi" className="public-payment-badge" />
          <img
            src={mastercardBadge}
            alt="Mastercard odeme destegi"
            className="public-payment-badge"
          />
          <img
            src={iyzicoBadge}
            alt="iyzico ile odeme"
            className="public-payment-badge public-payment-badge-wide"
          />
        </div>
      </div>

      <nav className="public-footer-links" aria-label="Kurumsal sayfalar">
        {PUBLIC_FOOTER_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="public-footer-link">
            {item.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}

export default PublicFooter;
