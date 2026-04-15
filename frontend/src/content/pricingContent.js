import { WEBSITE_PACKAGES_PATH } from '../config/surfaces';

export const PRICING_PAGE_CONTENT = {
  title: 'Paketler ve Fiyatlandirma',
  description:
    'Talepet uzerinde satin alinabilen dijital hizmetleri, fiyatlarini ve kullanim faydalarini tek yerde gor. Premium paketler, one cikarma ve ek ilan haklari platform icinde dijital olarak aktive edilir.',
  hero: {
    eyebrow: 'Dijital Hizmetler',
    title: 'Talebini daha gorunur hale getiren paketleri incele.',
    body:
      'Talepet fiziksel urun magazasi degil; talep, teklif ve gorunurluk odakli bir dijital platformdur. Buradaki paketler platform ici premium gorunurluk, one cikarma ve ek ilan hakki gibi dijital hizmetler sunar.'
  },
  highlights: [
    'Odeme sonrasi hizmetler hesaba dijital olarak tanimlanir.',
    'Premium ve one cikarma araclari talebin platform icinde daha belirgin gorunmesine yardimci olur.',
    'Visa, MasterCard ve iyzico destekli odeme zemini kullanilir.'
  ],
  trustCards: [
    {
      title: 'Ne satin aliniyor?',
      body: 'Premium uyelik, one cikarma ve ek ilan hakki gibi platform ici dijital gorunurluk hizmetleri.'
    },
    {
      title: 'Teslimat nasil olur?',
      body: 'Odeme onayi sonrasinda secilen paket veya hak kullanici hesabina dijital olarak tanimlanir.'
    },
    {
      title: 'Nereden yonetilir?',
      body: 'Kullanici satin alma sonrasi paketlerini profil ve premium alanlarindan takip edebilir.'
    }
  ],
  fallbackCards: [
    {
      key: 'premium_monthly',
      title: 'Aylik Premium Paket',
      description: 'Talebini premium gorunurluk ile one cikar, profil alaninda premium durumunu yonet.',
      priceLabel: 'Aylik premium fiyatini goster',
      duration: '30 gunluk premium gorunurluk',
      actionType: 'premium'
    },
    {
      key: 'premium_yearly',
      title: 'Yillik Premium Paket',
      description: 'Yillik kullanim icin premium gorunurluk ve daha uzun sureli paket avantaji.',
      priceLabel: 'Yillik premium fiyatini goster',
      duration: '12 aylik premium gorunurluk',
      actionType: 'premium'
    },
    {
      key: 'featured_monthly',
      title: 'Aylik One Cikarilan Ilan',
      description: 'Ilaninin ve talebinin listelerde daha dikkat cekici gorunmesini saglar.',
      priceLabel: 'Aylik one cikarma fiyatini goster',
      duration: '30 gunluk one cikarma',
      actionType: 'premium'
    },
    {
      key: 'featured_yearly',
      title: 'Yillik One Cikarilan Ilan',
      description: 'One cikarma haklarini daha uzun sureli kullanmak isteyenler icin yillik secenek.',
      priceLabel: 'Yillik one cikarma fiyatini goster',
      duration: '12 aylik one cikarma',
      actionType: 'premium'
    },
    {
      key: 'listing_extra',
      title: 'Ek Ilan Hakki Paketi',
      description: 'Ucretsiz ilan kotan doldugunda ek ilan hakki satin alarak yeni talep olusturmaya devam et.',
      priceLabel: '99 TRY',
      duration: 'Tek ek ilan hakki',
      actionType: 'create'
    }
  ],
  legalLinks: [
    { to: '/hakkimizda', label: 'Hakkimizda' },
    { to: '/gizlilik-sozlesmesi', label: 'Gizlilik Sozlesmesi' },
    { to: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satis Sozlesmesi' },
    { to: '/teslimat-ve-iade', label: 'Teslimat ve Iade Sartlari' },
    { to: '/iletisim', label: 'Iletisim' }
  ],
  ctaLink: WEBSITE_PACKAGES_PATH
};
