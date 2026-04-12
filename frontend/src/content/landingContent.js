import { APP_HOME_PATH } from '../config/surfaces';

export const LANDING_CONTENT = {
  title: 'Talepet | Talebini yayınla, doğru teklifi hızla bul',
  description:
    'Talepet; hizmet, eşya, otomobil ve iş arayan segmentlerinde talep oluşturmayı, teklif almayı ve premium görünürlük araçlarını tek uygulamada buluşturur.',
  hero: {
    eyebrow: 'Talep ve teklif platformu',
    title: 'İhtiyacını yayınla, doğru teklifi daha hızlı bul.',
    subtitle:
      'Talepet, kullanıcıların ihtiyaçlarını talep olarak yayınladığı; satıcıların, hizmet verenlerin ve uzmanların bu taleplere teklif sunduğu mobil öncelikli dijital platformdur.',
    primaryCta: { label: 'Uygulamayı Aç', to: APP_HOME_PATH },
    secondaryCta: { label: 'Giriş Yap', to: '/login' },
    tertiaryCta: { label: 'Kayıt Ol', to: '/register' }
  },
  sections: [
    {
      title: 'Talepet nasıl çalışır?',
      body:
        'Talebini kategori ve konuma göre yayınla, uygun kişi ve işletmelerden teklif al, profilinden tüm süreci tek yerden yönet.'
    },
    {
      title: 'Segment bazlı yapı',
      body:
        'Hizmet, eşya, otomobil ve iş arayan segmentleriyle her ihtiyaç türü kendi akışında, daha doğru kategori eşleşmesiyle yönetilir.'
    },
    {
      title: 'Güven ve görünürlük',
      body:
        'Premium paketler, öne çıkarma seçenekleri, takip sistemi ve güvenli ödeme hazırlığı ile taleplerini daha görünür hale getirebilirsin.'
    }
  ],
  segments: [
    { key: 'service', label: 'Hizmet', detail: 'Usta, servis, bakım, destek ve profesyonel işler' },
    { key: 'goods', label: 'Eşya', detail: 'Satın alma, ürün bulma ve tedarik ihtiyaçları' },
    { key: 'auto', label: 'Otomobil', detail: 'Araç alım, bakım, parça ve servis talepleri' },
    { key: 'jobseeker', label: 'İş Arayan', detail: 'İş arayan kullanıcı profilleri ve uygun fırsatlar' }
  ],
  trustPoints: [
    'Mobil-first uygulama deneyimi',
    'Takip, bildirim ve teklif akışları',
    'Premium görünürlük ve ek ilan altyapısı',
    'Visa, MasterCard ve iyzico uyumlu ödeme zemini'
  ],
  footerCta: {
    title: 'Talepet uygulamasına geç',
    body: 'Uygulama yüzeyi üzerinden taleplerini yayınla, tekliflerini yönet ve profil akışını kullan.',
    primary: { label: 'Uygulamayı Aç', to: APP_HOME_PATH },
    secondary: { label: 'Giriş Yap', to: '/login' }
  }
};
