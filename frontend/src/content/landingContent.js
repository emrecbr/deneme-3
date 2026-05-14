import { APP_HOME_PATH, WEBSITE_CATEGORIES_PATH, WEBSITE_DISCOVERY_PATH } from '../config/surfaces';

export const LANDING_CONTENT = {
  title: 'Talepet | Talebini yayinla, teklifleri tek akista topla',
  description:
    'Talepet; hizmet, esya, otomobil ve is odakli talepleri sehir ve ilce baglamiyla eslestiren, teklif toplama, moderasyon ve premium gorunurluk katmanlarini tek deneyimde birlestiren platformdur.',
  hero: {
    eyebrow: 'Sehir ve ilce bazli talep platformu',
    title: 'Ihtiyacini olustur, dogru teklifleri hizlica al.',
    subtitle:
      'Yazilim, mobil uygulama, web sitesi, tasarim, tadilat, nakliye ve daha birçok hizmet icin talep olustur; uygun hizmet verenlerden teklif topla.',
    primaryCta: { label: 'Talep Olustur', to: '/register' },
    secondaryCta: { label: 'Kategorileri Incele', to: '/categories' },
    tertiaryCta: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    metrics: [
      { label: 'Segment kapsami', value: '4 ana kategori alani' },
      { label: 'Eslesme mantigi', value: 'Sehir / ilce odakli' },
      { label: 'Kalite katmani', value: 'Moderasyon + premium' }
    ],
    highlights: [
      'Talep olusturma, teklif toplama ve karsilastirma mantigi',
      'Yerel hizmet, urun ve uzmanlik ihtiyaclari icin ortak akış',
      'Gorunurluk, guven ve operasyon katmanlarini ayni sistemde toplama'
    ]
  },
  featuredBenefits: [
    {
      title: 'Talep mantigi tek, kategori dili farkli',
      body:
        'Usta arayan da, urun arayan da, arac ihtiyaci olan da ayni temel mantikla hareket eder. Talepet kategoriye gore arayuzu karmasiklastirmadan ihtiyaci dogru sekilde toplar.'
    },
    {
      title: 'Website karar verir, app islemi tamamlar',
      body:
        'Website yuzeyi platformu tanitir, auth akisina sokar ve dogru CTA ile kullaniciyi yonlendirir. Talep verme, teklif izleme ve profil yonetimi uygulama tarafinda devam eder.'
    },
    {
      title: 'Gorunurluk ve kalite ayni urun tasariminin parcasi',
      body:
        'Premium gorunurluk, bildirim akislari, dogrulama ve operasyonel moderasyon; yalnizca ilan yayinlamayi degil, daha saglikli eslesme ve daha net teklif surecini destekler.'
    }
  ],
  howItWorks: [
    {
      step: '01',
      title: 'Talebini acik ve yerel baglamla yayinla',
      body:
        'Kategori, sehir, ilce ve ihtiyac detayini netlestir. Talepet talebi dogru baglamda isleyerek alakasiz cevaplari azaltir.'
    },
    {
      step: '02',
      title: 'Hizmet verenler teklif gondersin',
      body:
        'Ilgili hizmet verenler, saticilar veya uzmanlar taleplerine teklif sunar. Kullanici bu teklifleri tek bir akista inceleyebilir.'
    },
    {
      step: '03',
      title: 'Odeme ve anlasmayi platform disinda tamamla',
      body:
        'Talepet odeme araciligi yapmaz. Taraflar hizmet kosullarini platform disinda kararlastirir; Talepet ise dijital gorunurluk ve premium haklar sunar.'
    }
  ],
  categories: [
    {
      key: 'service',
      label: 'Hizmet / Usta',
      detail: 'Teknik servis, tamir, temizlik, tasima, kurulum ve uzman hizmet talepleri.',
      cue: 'Is odakli teklif akisi'
    },
    {
      key: 'goods',
      label: 'Esya / Urun',
      detail: 'Belirli ozellikte urun arama, tedarik, satin alma ve urun karsilastirma talepleri.',
      cue: 'Urun odakli RFQ mantigi'
    },
    {
      key: 'auto',
      label: 'Otomobil',
      detail: 'Arac alim, servis, yedek parca, ekspertiz ve otomotiv destek akislari.',
      cue: 'Yerel ve uzman odakli'
    },
    {
      key: 'job',
      label: 'Is ve Uzmanlik',
      detail: 'Uzman profilleri, beceri bazli talepler ve is odakli eslesmeler.',
      cue: 'Profil + teklif dengesi'
    }
  ],
  publicDiscovery: {
    eyebrow: 'Public kesif',
    title: 'Giris yapmadan once hangi taleplerin nasil aktigini gor.',
    body:
      'Website yuzeyi Talepet mantigini sadece anlatmaz; kategori, konum ve talep formatini da public bir on izleme katmaniyla gosterir. Boylece kullanici giris yapmadan once urune daha yakin bir karar verir.',
    categoriesIntro:
      'Kategori secimi; talebin dili, beklentisi ve teklif kalitesi icin ilk sinyaldir. Her segment ayni temel mantikla calisir ama kendi ihtiyacina gore detaylanir.',
    cityIntro:
      'Sehir ve ilce baglami, ozellikle hizmet ve saha gerektiren taleplerde teklif kalitesini ciddi bicimde etkiler.',
    detailCta: { label: 'Kesfe git', to: WEBSITE_DISCOVERY_PATH },
    createCta: { label: 'Talep olusturmak icin Kayit Ol', to: '/register' },
    appCta: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    featuredCities: [
      {
        city: 'Istanbul',
        detail: 'Tasima, teknik servis, mobilya kurulum ve hizli yerel hizmet ihtiyaclari icin yogun talep akisi.'
      },
      {
        city: 'Ankara',
        detail: 'Kurumsal hizmetler, ofis destekleri ve planli randevu gerektiren islerde daha net teklif baglami.'
      },
      {
        city: 'Izmir',
        detail: 'Ev, yasam ve otomotiv destek ihtiyaclari icin dengeli kategori karmasi ve yerel teklif yogunlugu.'
      }
    ],
    rfqPreview: [
      {
        title: 'Klima montaji icin usta araniyor',
        meta: 'Hizmet / Usta • Istanbul / Kadikoy',
        summary: 'Aynı gun icinde montaj yapabilecek ekip araniyor. Kesif ve fiyat teklifinin net olmasi bekleniyor.',
        cta: 'Benzer talepleri kesfet',
        to: WEBSITE_DISCOVERY_PATH
      },
      {
        title: '2. el bebek arabasi talebi',
        meta: 'Esya / Urun • Ankara / Cankaya',
        summary: 'Temiz durumda, katlanabilir ve teslim secenegi olan ilanlar oncelikli olarak gorulmek isteniyor.',
        cta: 'Kategorileri incele',
        to: WEBSITE_CATEGORIES_PATH
      },
      {
        title: 'Ekspertiz ve servis destegi aranıyor',
        meta: 'Otomobil • Izmir / Bornova',
        summary: 'Arac inceleme ve servis yonlendirmesi icin uzman teklifleri tek akista karsilastirilmak isteniyor.',
        cta: 'Detaylar icin Giris Yap',
        to: '/login'
      }
    ]
  },
  locationLogic: {
    eyebrow: 'Sehir ve ilce baglami',
    title: 'Dogru teklif, dogru lokasyon filtresiyle daha anlamli hale gelir.',
    body:
      'Talepet tum Turkiye icin tek bir karisik liste mantigi yerine sehir ve ilceyi merkeze alir. Boylece talep sahibi daha isabetli gorunurluk elde eder, karsidaki taraf da daha net bir is tanimiyle cevap verir.',
    bullets: [
      'Sehir / ilce secimi ile daha temiz teklif havuzu',
      'Yerel hizmet verenler icin daha anlamli talep filtreleme',
      'Profil, adres ve talep akisini ayni lokasyon mantigiyla baglama'
    ],
    spotlight: [
      'Konum yalnizca filtre degil, teklif kalitesini etkileyen ana sinyal olarak ele alinir.',
      'Ozellikle hizmet, tasima, montaj ve saha gerektiren kategorilerde lokasyon baglami karar kalitesini guclendirir.'
    ]
  },
  trustPillars: [
    {
      title: 'Dogrulama katmani',
      body: 'E-posta, telefon ve callback tabanli auth adimlariyla daha kontrollu giris ve hesap akisi.'
    },
    {
      title: 'Moderasyon ve operasyon',
      body: 'Admin paneli ve risk sinyalleri ile dusuk kaliteli veya problemli akislarin daha net yonetilmesi.'
    },
    {
      title: 'Premium gorunurluk',
      body: 'One cikarma ve gorunurluk paketleriyle talebin daha dikkat cekici sergilenmesi.'
    },
    {
      title: 'Odeme ve ticari zemin',
      body: 'iyzico, Visa ve Mastercard uyumlu odeme zemini ile daha profesyonel bir operasyon altyapisi.'
    }
  ],
  faq: [
    {
      question: 'Talepet website ile uygulama ayni sey mi?',
      answer:
        'Hayir. Website yuzeyi platformun ne oldugunu, nasil calistigini ve neden deger urettigini anlatir. Talep olusturma, teklif toplama ve profil yonetimi uygulama yuzeyinde devam eder.'
    },
    {
      question: 'Giris yapmadan websitei kullanabilir miyim?',
      answer:
        'Evet. Website acik bilgi yuzeyi olarak calisir. Ancak talep yayinlama, teklif yonetimi ve bildirim akisina gecmek icin auth gerekir.'
    },
    {
      question: 'Neden sehir ve ilce bazli yapi bu kadar vurgulaniyor?',
      answer:
        'Cunku bir talebin degeri yalnizca kategoriyle degil, lokasyonla da belirlenir. Talepet lokasyonu daha isabetli teklif akisi icin ana sinyal olarak kullanir.'
    },
    {
      question: 'Premium ne ise yariyor?',
      answer:
        'Premium araclar talebin daha guclu gorunmesine, daha hizli dikkat cekmesine ve belirli akislarin daha one cikmasina yardimci olur.'
    }
  ],
  footerCta: {
    eyebrow: 'Hazir oldugunda bir sonraki adima gec',
    title: 'Website karar zemini sunar, uygulama urun akisina tasir.',
    body:
      'Talepet website yuzeyi seni bilgi, guven ve auth katmaninda karsilar. Hesabin hazirsa uygulama yuzeyine gecerek taleplerini, tekliflerini ve profilini yonetebilirsin.',
    primary: { label: 'Kayit Ol', to: '/register' },
    secondary: { label: 'Giris Yap', to: '/login' },
    tertiary: { label: 'Uygulamayi Ac', to: APP_HOME_PATH }
  }
};
