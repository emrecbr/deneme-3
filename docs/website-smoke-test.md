# Website Smoke Test

## Surface checks

- `https://talepet.net.tr` website olarak acilir.
- `https://www.talepet.net.tr` ayni website davranisini verir.
- `https://app.talepet.net.tr` app shell olarak acilir.
- `https://admin.talepet.net.tr` admin panel davranisini korur.
- `https://api.talepet.net.tr/health` cevap verir.

## CTA checks

- Header `Giris Yap` -> `/login`
- Header `Kayit Ol` -> `/register`
- Hero primary CTA -> `/register`
- Hero secondary CTA -> `/login`
- `Uygulamayi Ac` CTA'lari -> `app.talepet.net.tr`
- Public kesif CTA'lari local auth route veya kontrollu app host kullanir

## Auth checks

- `talepet.net.tr/login` website auth shell acilir
- `talepet.net.tr/register` website register shell acilir
- Login sonrasi kullanici tekrar `/login` sayfasina dusmez
- Register sonrasi auth state hydrate olur ve kontrollu hedefe gider

## Discovery checks

- Populer kategoriler bolumu gorunur
- Public kesif bolumu gorunur
- Sehir / ilce preview kartlari gorunur
- RFQ preview kartlari gorunur
- Kritik aksiyonlar auth veya app CTA ile kapanir

## Responsive checks

- 1440px desktop: hero iki kolon, section hizalari duzgun
- 1024px tablet: gridler tasmadan iki kolon veya uygun kirilim verir
- 390px mobile: header, hero CTA ve footer CTA tek kolona duzgun duser
- Sticky header mobile'da statik davranisa gecer

## Accessibility checks

- `Tab` ile CTA'lar gorunur focus halkasi alir
- Skip link klavye ile gorunur
- Baslik hiyerarsisi `h1 -> h2 -> h3` duzenindedir
- Footer linkleri klavye ile secilebilir

## Release sonrası hızlı kontrol

- Cache temizlenmis sekilde root domain ac
- Login ve register route'larini dogrudan ac
- App hosta gecis CTA'larinin dogru hosta gittigini dogrula
- Broken link ve 404 kontrolu yap
