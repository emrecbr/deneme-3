import { WEBSITE_PACKAGES_PATH } from '../config/surfaces';

export const PRICING_PAGE_CONTENT = {
  title: 'Paketler ve Fiyatlandirma',
  description:
    'Talepet uzerinde satin alinabilen dijital hizmetleri, fiyatlarini ve kullanim faydalarini tek yerde gor. Premium paketler, one cikarma ve ek ilan haklari platform icinde dijital olarak aktive edilir.',
  hero: {
    eyebrow: 'Dijital Hizmetler',
    title: 'Talepet paketleri ile hangi dijital hakki aldigini acikca gor.',
    body:
      'Talepet fiziksel urun magazasi degil; talep, teklif ve gorunurluk odakli bir dijital platformdur. Buradaki paketler platform ici premium gorunurluk, one cikarma ve ek ilan hakki gibi dijital hizmetler sunar.'
  },
  highlights: [
    'Talepet kullanicilar arasinda odeme araciligi yapmaz.',
    'Odeme sonrasi hizmetler hesaba dijital olarak tanimlanir.',
    'Premium ve one cikarma araclari talebin platform icinde daha belirgin gorunmesine yardimci olur.'
  ],
  trustCards: [
    {
      title: 'Ne satin aliniyor?',
      body:
        'Premium uyelik, one cikarma ve ek ilan hakki gibi platform ici dijital gorunurluk hizmetleri.'
    },
    {
      title: 'Teslimat nasil olur?',
      body:
        'Odeme onayi sonrasinda secilen paket veya hak kullanici hesabina dijital olarak tanimlanir.'
    },
    {
      title: 'Talepet ne yapmaz?',
      body:
        'Talepet kullanicilar arasinda odeme araciligi yapmaz; nihai hizmet bedeli taraflar arasinda kararlastirilir.'
    }
  ],
  fallbackCards: [
    {
      key: 'listing_extra',
      title: 'Ek Ilan Hakki',
      description: 'Kullanici hesabina tek seferlik ek ilan hakki tanimlayan dijital hizmet paketi.',
      priceLabel: '99 TRY',
      duration: 'Tek seferlik dijital hak',
      actionType: 'premium'
    },
    {
      key: 'featured_monthly',
      title: 'One Cikarma Paketi',
      description: 'Secilen talebin daha dikkat cekici gorunmesini saglayan dijital gorunurluk paketi.',
      priceLabel: '149 TRY / ay',
      duration: '7 gun one cikarma etkisi',
      actionType: 'premium'
    },
    {
      key: 'premium_monthly',
      title: 'Premium Paket',
      description: 'Premium rozet ve hesap gorunurlugunu guclendiren dijital platform hizmeti.',
      priceLabel: '249 TRY / ay',
      duration: '30 gun premium hesap aktivasyonu',
      actionType: 'premium'
    }
  ],
  legalLinks: [
    { to: '/nasil-calisir', label: 'Nasil Calisir' },
    { to: '/hakkimizda', label: 'Hakkimizda' },
    { to: '/gizlilik-sozlesmesi', label: 'Gizlilik Sozlesmesi' },
    { to: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satis Sozlesmesi' },
    { to: '/teslimat-ve-iade', label: 'Teslimat ve Iade Sartlari' },
    { to: '/iletisim', label: 'Iletisim' }
  ],
  ctaLink: WEBSITE_PACKAGES_PATH
};
