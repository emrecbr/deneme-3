import { APP_HOME_PATH } from '../config/surfaces';

export const LANDING_CONTENT = {
  title: 'Talepet | Talebini yayinla, dogru teklifleri tek yerde topla',
  description:
    'Talepet; hizmet, esya, otomobil ve is odakli talepleri sehir ve ilce bazli eslestiren, teklif toplama ve premium gorunurluk akisini tek deneyimde birlestiren platformdur.',
  hero: {
    eyebrow: 'Talep ve teklif platformu',
    title: 'Ihtiyacini yayinla, dogru teklifleri daha hizli topla.',
    subtitle:
      'Talepet website yuzeyi; platformun nasil calistigini, hangi kategorilerde deger urettigini ve kullanicinin ne zaman uygulama yuzeyine gecmesi gerektigini netlestiren ana giris noktasi olarak calisir.',
    primaryCta: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    secondaryCta: { label: 'Giris Yap', to: '/login' },
    tertiaryCta: { label: 'Kayit Ol', to: '/register' },
    metrics: [
      { label: 'Talep akisi', value: '4 ana segment' },
      { label: 'Yerel eslesme', value: 'Sehir / ilce bazli' },
      { label: 'Kalite katmani', value: 'Moderasyon + premium' }
    ]
  },
  featuredBenefits: [
    {
      title: 'Talepet nasil calisir?',
      body:
        'Kullanici ihtiyacini kategori ve konuma gore talep olarak yayinlar. Uygun hizmet verenler, saticilar veya uzmanlar teklif sunar. Tum surec uygulama yuzeyinde yonetilir.'
    },
    {
      title: 'Website ile uygulama ayridir',
      body:
        'Website; tanitim, guven, kategori anlatimi ve auth giris katmanidir. Asil talep ve teklif deneyimi app.talepet.net.tr uzerinden ilerler.'
    },
    {
      title: 'Premium kalite mesajlari',
      body:
        'Dogrulama, gorunurluk paketleri, bildirim akislari ve operasyonel moderasyon yapisi; talebi yalnizca yayinlamakla kalmayip daha kaliteli eslesmeler uretilmesini destekler.'
    }
  ],
  howItWorks: [
    {
      step: '01',
      title: 'Talebini netlestir',
      body: 'Kategori, konum ve ihtiyac detayini belirle. Platform dogru yuzeye ve akisa yonlendirsin.'
    },
    {
      step: '02',
      title: 'Teklifleri karsilastir',
      body: 'Ilgili satici veya hizmet verenlerden gelen teklifleri ayni akista gor ve karsilastir.'
    },
    {
      step: '03',
      title: 'Sureci takip et',
      body: 'Bildirimler, profil, talep durumu ve premium araclar ile sureci uygulama tarafinda yonet.'
    }
  ],
  categories: [
    {
      key: 'service',
      label: 'Hizmet',
      detail: 'Usta, teknik servis, temizlik, tasima, kurulum ve profesyonel destek talepleri.'
    },
    {
      key: 'goods',
      label: 'Esya',
      detail: 'Urun bulma, satin alma, tedarik ve belirli ozellikte urun arama talepleri.'
    },
    {
      key: 'auto',
      label: 'Otomobil',
      detail: 'Arac alim, parca, servis, ekspertiz ve otomotiv destek akislari.'
    },
    {
      key: 'job',
      label: 'Is ve uzmanlik',
      detail: 'Uzman profilleri, beceri bazli talepler ve is odakli eslesmeler.'
    }
  ],
  locationLogic: {
    eyebrow: 'Sehir ve ilce bazli mantik',
    title: 'Dogru teklif, dogru lokasyon eslesmesiyle guclenir.',
    body:
      'Talepet tum akisi tum Turkiye icin tek listede karistirmak yerine sehir ve ilce baglamini one cikarir. Boylece kullanici talebini daha isabetli kisilere gosterir, karsidaki taraf da daha anlamli bir is kapsamiyla cevap verir.',
    bullets: [
      'Konum bazli filtreleme ile daha isabetli eslesme',
      'Yerel hizmet verenler icin daha temiz talep havuzu',
      'Sehir ve ilce bilgisini uygulama akisina tasiyan profil mantigi'
    ]
  },
  trustPillars: [
    {
      title: 'Dogrulama akislari',
      body: 'E-posta, telefon ve callback tabanli auth adimlariyla daha kontrollu giris deneyimi.'
    },
    {
      title: 'Moderasyon ve operasyon',
      body: 'Admin paneli ve operasyon akisiyla kalitesiz veya riskli davranislarin daha gorunur yonetilmesi.'
    },
    {
      title: 'Premium gorunurluk',
      body: 'One cikarma ve gorunurluk paketleriyle talebin daha guclu sergilenmesi.'
    },
    {
      title: 'Odeme zemini',
      body: 'iyzico, Visa ve Mastercard uyumlu odeme zemini ile operasyonel hazirlik.'
    }
  ],
  faq: [
    {
      question: 'Talepet website ile uygulama ayni sey mi?',
      answer:
        'Hayir. Website yuzeyi tanitim, guven ve giris katmanidir. Talep olusturma, teklif toplama ve profil yonetimi uygulama yuzeyinde ilerler.'
    },
    {
      question: 'Giris yapmadan websitei kullanabilir miyim?',
      answer:
        'Evet. Website acik bilgi yuzeyi olarak calisir. Ancak talep yayinlama ve teklif yonetimi icin auth gerekir.'
    },
    {
      question: 'Neden sehir ve ilce bazli yapi onemli?',
      answer:
        'Talebin daha dogru kisilere ulasmasi, tekliflerin daha anlamli olmasi ve is akisinin yerel ihtiyaca gore filtrelenmesi icin.'
    },
    {
      question: 'Premium ne ise yariyor?',
      answer:
        'Premium araclar, gorunurluk ve dikkat kazanma avantajlari saglayarak talebin daha guclu sergilenmesine yardimci olur.'
    }
  ],
  footerCta: {
    eyebrow: 'Hazir oldugunda uygulamaya gec',
    title: 'Talep olusturma ve teklif yonetimi uygulama yuzeyinde devam eder.',
    body:
      'Website seni tanitim ve guven katmaninda karsilar. Islem yapmaya hazirsan uygulama yuzeyine gecerek hesabini, taleplerini ve teklif surecini yonetebilirsin.',
    primary: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    secondary: { label: 'Giris Yap', to: '/login' }
  }
};
