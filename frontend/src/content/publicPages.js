export const PUBLIC_FOOTER_LINKS = [
  { to: '/paketler', label: 'Paketler' },
  { to: '/hakkimizda', label: 'Hakkimizda' },
  { to: '/gizlilik-sozlesmesi', label: 'Gizlilik Sozlesmesi' },
  { to: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satis Sozlesmesi' },
  { to: '/teslimat-ve-iade', label: 'Teslimat ve Iade Sartlari' },
  { to: '/iletisim', label: 'Iletisim' }
];

export const PUBLIC_PAGE_CONTENT = {
  about: {
    title: 'Hakkimizda',
    description:
      'Talepet, kullanicilarin ihtiyaclarini talep olarak yayinladigi ve hizmet verenlerin teklif sundugu dijital bir talep ve teklif platformudur.',
    lead:
      'Talepet; kullanicinin ihtiyacini kategori, konum ve is akisi baglamiyla toplayan, hizmet verenleri ve teklif verenleri ayni platformda bulusturan dijital bir hizmet altyapisidir.',
    sections: [
      {
        heading: 'Talepet ne yapar?',
        paragraphs: [
          'Kullanicilar ihtiyaclarini talep olarak yayinlar; ilgili hizmet verenler, saticilar veya uzmanlar bu taleplere teklif sunar.',
          'Platform hizmet, esya, otomobil ve is odakli segmentlerde talep olusturma, teklif toplama, mesajlasma ve profil yonetimi gibi temel dijital araclari tek deneyimde toplar.'
        ]
      },
      {
        heading: 'Gelir modeli ve dijital hizmetler',
        paragraphs: [
          'Talepet fiziksel urun stogu tutan bir magazadan ziyade, platform ici dijital hizmetler sunan bir yapidir.',
          'Premium paketler, one cikarilan ilanlar ve ek ilan haklari; kullanicinin talebini platform icinde daha gorunur hale getiren satin alinabilir dijital hizmetlerdir.'
        ]
      },
      {
        heading: 'Guven ve kurumsal yaklasim',
        paragraphs: [
          'Talepet, hesap dogrulama, moderasyon, sehir-ilce baglami ve odeme altyapisi gibi katmanlari kullanarak daha kontrollu bir talep ve teklif deneyimi kurmayi hedefler.',
          'Kurumsal ve hukuki sayfalarimiz, kullanicinin satin alabildigi dijital hizmetleri ve platformun calisma mantigini seffaf bicimde aciklar.'
        ]
      }
    ]
  },
  privacy: {
    title: 'Gizlilik Sozlesmesi',
    description:
      'Talepet kullanici verilerinin hangi amaclarla islendigini, saklandigini ve teknik hizmet saglayicilarla hangi kapsamda paylasildigini aciklar.',
    lead:
      'Bu metin, Talepet uzerinde uyelik, talep olusturma, teklif alma, konum secimi, bildirim ve odeme sureclerinde islenen kisisel verilere iliskin genel bilgilendirme saglar.',
    sections: [
      {
        heading: 'Islenen veriler',
        paragraphs: [
          'Ad, soyad, e-posta adresi, telefon numarasi, profil bilgileri, talep icerigi, secilen kategori ve sehir-ilce baglami gibi bilgiler islenebilir.',
          'Kart verileri dogrudan odeme hizmet saglayicisinin guvenli altyapisinda islenir; Talepet bu verileri yalnizca hizmeti yurutmek icin gereken ozet seviyede gorur.'
        ]
      },
      {
        heading: 'Isleme amaclari',
        paragraphs: [
          'Hesap olusturma, kimlik dogrulama, talep yayinlama, teklif ve mesajlasma akislarini yurutme, uygun eslesmeleri gosterme ve kullanici destek sureclerini yonetme amaclariyla veri islenir.',
          'Premium uyelik, one cikarma ve ek ilan hakki gibi dijital hizmetlerin saglanmasi icin odeme ve siparis durumu bilgileri de tutulabilir.'
        ]
      },
      {
        heading: 'Paylasim ve saklama',
        paragraphs: [
          'Veriler; barindirma, analiz, bildirim ve odeme altyapisini saglayan teknik hizmet saglayicilarla hizmetin sunulmasi icin gerekli oldugu olcude paylasilabilir.',
          'Guvenlik, yasal yukumlulukler ve uyusmazlik surecleri icin belirli kayitlar ilgili mevzuatin ongordugu sure boyunca saklanabilir.'
        ]
      }
    ]
  },
  distanceSales: {
    title: 'Mesafeli Satis Sozlesmesi',
    description:
      'Talepet uzerinden sunulan premium gorunurluk, one cikarma ve ek ilan hakki gibi dijital hizmetlere iliskin genel cerceveyi aciklar.',
    lead:
      'Bu sozlesme, Talepet tarafindan sunulan premium paketler, one cikarma secenekleri ve ek ilan hakki gibi dijital hizmetlerin satin alinmasina iliskin genel esaslari ozetler.',
    sections: [
      {
        heading: 'Sozlesmenin konusu',
        paragraphs: [
          'Talepet uzerinde satin alinan hizmetler, dijital gorunurluk ve platform ici kullanim hakki saglayan hizmetlerdir.',
          'Bu hizmetler fiziksel urun satisi, depolama veya kargo teslimati kapsaminda degerlendirilmez.'
        ]
      },
      {
        heading: 'Siparis ve aktivasyon',
        paragraphs: [
          'Odeme sureci tamamlandiktan sonra ilgili plan, kredi veya hak kullanicinin hesabina dijital olarak tanimlanir.',
          'Bazi hizmetler aninda aktiflesir; bazilari ise odeme dogrulama ve teknik kontrol sonrasinda hesaba yansir.'
        ]
      },
      {
        heading: 'Kullanim kosullari',
        paragraphs: [
          'Premium paketler ve one cikarma haklari yalnizca Talepet platformu icinde gecerli olup baska bir platforma devredilemez.',
          'Platform kurallarina aykiri veya moderasyon nedeniyle kaldirilan icerikler icin dijital hizmetlerin uygulanma sekli hizmet kosullarina gore degerlendirilir.'
        ]
      }
    ]
  },
  deliveryReturns: {
    title: 'Teslimat ve Iade Sartlari',
    description:
      'Talepet fiziksel kargo teslimati yapan bir magaza olmadigi icin teslimat ve iade sureci dijital hizmetlerin aktivasyonu uzerinden aciklanir.',
    lead:
      'Talepet uzerinden satin alinan hizmetler dijital niteliktedir. Bu nedenle teslimat ve iade degerlendirmesi fiziksel kargo yerine hizmet aktivasyonu ve hesap tanimi uzerinden yapilir.',
    sections: [
      {
        heading: 'Teslimat',
        paragraphs: [
          'Premium uyelik, one cikarma ve ek ilan hakki gibi hizmetler basarili odeme sonrasinda kullanici hesabina dijital olarak tanimlanir.',
          'Hizmetin hesaba yansima suresi odeme saglayicisindan gelen dogrulama sonucuna gore degisebilir.'
        ]
      },
      {
        heading: 'Iade ve iptal',
        paragraphs: [
          'Henuz kullanilmamis dijital haklar icin degerlendirme, hizmetin turune ve yururlukteki mevzuata gore yapilir.',
          'Aktiflesmis veya hesaba uygulanmis dijital gorunurluk hizmetlerinde iade kosullari hizmetin niteligine gore farklilasabilir.'
        ]
      },
      {
        heading: 'Destek sureci',
        paragraphs: [
          'Odeme, aktivasyon veya hesapta hak gorunmemesi gibi durumlarda kullanici destek kanallari uzerinden kayit olusturabilirsiniz.',
          'Giris yapan kullanicilar profil alanindaki Sorun Bildir akisiyla destek talebi baslatabilir.'
        ]
      }
    ]
  },
  contact: {
    title: 'Iletisim',
    description:
      'Talepet ile destek, uyelik, premium paketler, odeme ve kurumsal sorular icin kullanabileceginiz iletisim basliklarini listeler.',
    lead:
      'Talepet; dijital talep ve teklif platformu olarak destek, odeme ve uyelik sureclerini tek merkezden yonetir. Asagidaki basliklar, inceleme ekiplerinin ve kullanicilarin dogru noktaya hizli ulasmasi icin duzenlendi.',
    sections: [
      {
        heading: 'Destek kanallari',
        paragraphs: [
          'Platform bildirim e-postalari: noreply@talepet.net.tr',
          'Hesaba bagli destek talepleri: giris yaptiktan sonra profil alanindaki Sorun Bildir akisindan iletilebilir.',
          'Odeme ve premium paket sorulari: Paketler ve Premium alanlari uzerinden ilgili akislar incelenebilir.'
        ]
      },
      {
        heading: 'Talepet ne satar?',
        paragraphs: [
          'Talepet, premium uyelik, one cikarilan ilanlar ve ek ilan hakki gibi platform ici dijital hizmetler sunar.',
          'Bu hizmetler kullanicinin talebini daha gorunur hale getirmek, ek ilan yayini yapmak veya platform icindeki premium avantajlardan yararlanmak icin satin alinabilir.'
        ]
      },
      {
        heading: 'Kurumsal bilgi notu',
        paragraphs: [
          'Sirket unvani, vergi numarasi ve acik adres gibi hukuki bilgiler canli kurumsal kayitlarla birebir esitlenecek sekilde yayin oncesi guncellenir.',
          'Bu sayfa, platformun ne yaptigini ve hangi dijital hizmetleri sattigini seffaf sekilde gostermek icin kullaniciya acik tutulur.'
        ]
      }
    ]
  }
};
