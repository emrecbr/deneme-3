import { APP_HOME_PATH } from '../config/surfaces';

export const LANDING_CONTENT = {
  title: 'Talepet | Talep olustur, teklifleri uygulamada yonet',
  description:
    'Talepet; kategori ve konum bazli taleplerin uygulama icinde olusturuldugu, hizmet verenlerin teklif sundugu ve kullanicinin sureci tek ekrandan yonettigi mobil odakli platformdur.',
  hero: {
    eyebrow: 'Mobil odakli talep ve teklif deneyimi',
    title: 'Talebini uygulamada olustur, teklifleri tek akista yonet.',
    subtitle:
      'Talepet; hizmet, esya, otomobil ve uzmanlik ihtiyaclarinda kullaniciyi dogru kategori ve konum baglaminda hizmet verenlerle bulusturur.',
    primaryCta: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    secondaryCta: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    tertiaryCta: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    metrics: [
      { label: 'Talep olusturma', value: 'Kategori + konum odakli' },
      { label: 'Teklif akisi', value: 'Uygulama icinde yonetilir' },
      { label: 'Deneyim', value: 'Mobil ve hizli kullanim' }
    ],
    highlights: [
      'Talep olusturma, teklif alma ve karsilastirma mantigi',
      'Kategori ve lokasyona gore daha isabetli eslesme deneyimi',
      'Tum kullanici islemlerinin uygulama icinde tamamlanmasi'
    ]
  },
  featuredBenefits: [
    {
      title: 'Kullanici talebini hizli ve net olusturur',
      body:
        'Talepet; ihtiyaci kategori, sehir ve ilce baglamiyla toplar. Boylece kullanici ne aradigini daha net ifade eder ve daha ilgili teklifler alir.'
    },
    {
      title: 'Hizmet verenler dogrudan teklif gonderir',
      body:
        'Talebi goren hizmet verenler veya saticilar uygulama uzerinden teklif sunar. Kullanici da bu teklifleri tek bir akista inceleyip karsilastirir.'
    },
    {
      title: 'Tum akis uygulamada tamamlanir',
      body:
        'Talep verme, teklifleri izleme, profil yonetimi ve bildirim deneyimi uygulama tarafinda ilerler. Website ise yalnizca urunu ve sistemi tanitir.'
    }
  ],
  howItWorks: [
    {
      step: '01',
      title: 'Kullanici uygulamada talep olusturur',
      body:
        'Kategori, sehir, ilce ve ihtiyac detayini netlestirir. Talepet talebi dogru baglamda isleyerek daha ilgili teklifleri one cikarir.'
    },
    {
      step: '02',
      title: 'Hizmet verenler teklif verir',
      body:
        'Ilgili hizmet verenler, saticilar veya uzmanlar uygulama uzerinden taleplere teklif sunar. Kullanici tum teklifleri tek akista gorur.'
    },
    {
      step: '03',
      title: 'Kullanici sureci kolayca yonetir',
      body:
        'Bildirimler, profil, talep detayi ve teklif karsilastirmasi uygulama tarafinda ilerler. Boylece is takibi daha hizli ve daha duzenli olur.'
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
    eyebrow: 'Uygulama mantigi',
    title: 'Talep akisinin uygulamada nasil isledigini hizlica gor.',
    body:
      'Bu landing page, Talepet uygulamasinin temel akislarini anlatir: talep olusturma, teklif alma, kategoriye gore filtreleme ve konuma dayali eslesme.',
    categoriesIntro:
      'Kategori secimi, talebin kime gidecegini belirleyen ilk sinyaldir. Bu sayede kullanici daha hizli ve daha ilgili teklifler alir.',
    cityIntro:
      'Sehir ve ilce baglami, ozellikle saha gerektiren taleplerde teklif kalitesini dogrudan etkiler.',
    detailCta: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    createCta: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    appCta: { label: 'Uygulamayi Ac', to: APP_HOME_PATH },
    featuredCities: [
      {
        city: 'Istanbul',
        detail: 'Tasima, teknik servis, kurulum ve hizli yerel hizmet ihtiyaclari icin yogun talep akisi.'
      },
      {
        city: 'Ankara',
        detail: 'Kurumsal hizmetler ve planli randevu gerektiren islerde daha net teklif baglami.'
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
        summary: 'Ayni gun icinde montaj yapabilecek ekip araniyor. Kesif ve fiyat teklifinin net olmasi bekleniyor.',
        cta: 'Uygulamada gor',
        to: APP_HOME_PATH
      },
      {
        title: '2. el bebek arabasi talebi',
        meta: 'Esya / Urun • Ankara / Cankaya',
        summary: 'Temiz durumda, katlanabilir ve teslim secenegi olan ilanlar oncelikli olarak gorulmek isteniyor.',
        cta: 'Uygulamada gor',
        to: APP_HOME_PATH
      },
      {
        title: 'Ekspertiz ve servis destegi araniyor',
        meta: 'Otomobil • Izmir / Bornova',
        summary: 'Arac inceleme ve servis yonlendirmesi icin uzman teklifleri tek akista karsilastirilmak isteniyor.',
        cta: 'Uygulamada gor',
        to: APP_HOME_PATH
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
      title: 'Mobil odakli hiz',
      body: 'Talep akisi, teklif takibi ve bildirimler uygulama icinde tek deneyimde toplanir.'
    },
    {
      title: 'Kategori bazli netlik',
      body: 'Her talep tipi ayni temel mantikla ilerler ama kendi ihtiyacina gore detaylanir.'
    },
    {
      title: 'Konum bazli isabet',
      body: 'Sehir ve ilce baglami sayesinde daha ilgili, daha gercekci ve daha hizli teklifler gorulur.'
    },
    {
      title: 'Duzenli teklif yonetimi',
      body: 'Kullanici teklifleri uygulama icinde karsilastirir, sureci daha duzenli ve daha rahat takip eder.'
    }
  ],
  faq: [
    {
      question: 'Talepet website ile uygulama ayni sey mi?',
      answer:
        'Hayir. Website yuzeyi platformu tanitir. Talep olusturma, teklif toplama, profil ve bildirim deneyimi uygulama yuzeyinde devam eder.'
    },
    {
      question: 'Islemler website uzerinden yapilir mi?',
      answer:
        'Hayir. Website acik bilgi yuzeyi olarak calisir. Talep olusturma, teklif yonetimi ve hesap akisina gecmek icin uygulama kullanilir.'
    },
    {
      question: 'Neden sehir ve ilce bazli yapi bu kadar vurgulaniyor?',
      answer:
        'Cunku bir talebin degeri yalnizca kategoriyle degil, lokasyonla da belirlenir. Talepet lokasyonu daha isabetli teklif akisi icin ana sinyal olarak kullanir.'
    },
    {
      question: 'Talepet kullaniciya nasil kolaylik saglar?',
      answer:
        'Kullanici ihtiyacini tek form mantigiyla toplar, ilgili teklifleri ayni yerde gorur ve sureci uygulama icinde daha kolay takip eder.'
    }
  ],
  footerCta: {
    eyebrow: 'Hazir oldugunda uygulamaya gec',
    title: 'Talebini olusturmak ve teklifleri yonetmek icin uygulamayi kullan.',
    body:
      'Talepet website yuzeyi urunu tanitir. Gercek kullanici deneyimi, talep olusturma ve teklif akisi ise uygulama tarafinda ilerler.',
    primary: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    secondary: { label: 'Uygulamaya Gec', to: APP_HOME_PATH },
    tertiary: { label: 'Uygulamayi Ac', to: APP_HOME_PATH }
  }
};
