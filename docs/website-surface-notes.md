# Website Surface Notes

## Amaç

`talepet.net.tr` public website, landing, auth ve kesif yuzeyi olarak konumlanir.

## Surface ayrimi

- `talepet.net.tr` / `www.talepet.net.tr`: website
- `app.talepet.net.tr`: kullanici uygulamasi
- `admin.talepet.net.tr`: admin panel
- `api.talepet.net.tr`: backend API

## Website ilkeleri

- Website app'in aynasi degil, public karar ve onboarding yuzeyidir.
- Auth route'lari website hostunda calisir.
- Public kesif login olmadan da urun mantigini anlatir.
- Kritik urun aksiyonlari kontrollu auth veya app gecisi ister.

## Responsive notlar

- Desktop'ta genis container ve section ritmi korunur.
- Mobile'da sticky header statik davranisa gecer.
- CTA gruplari dar ekranda sola yaslanir ve alt alta dusmeye hazirdir.

## Operasyon notlari

- Render rewrite/fallback kurallari korunmali.
- CTA mapping degisirse bu dosya ve `website-cta-map.md` birlikte guncellenmeli.
- Release sonrasi `website-smoke-test.md` adimlari uygulanmali.
