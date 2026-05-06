# Render Keepalive

Talepet API servisinde `503` ve `x-render-routing=hibernate-pending-wake` goruluyorsa sorun uygulama icindeki OAuth kodu degil, Render servisinin uyku modundan uyanma gecikmesidir.

## Kanit

- `[controllers/authController.js](/abs/path/C:/Users/C1/Desktop/talepet/controllers/authController.js)` icindeki `oauthGoogle` handler'i `503` uretmiyor.
- Route yalnizca:
  - `302` ile Google consent ekranina yonlendiriyor
  - veya konfig eksiginde `500/501` donduruyor
- `503 + x-render-routing=hibernate-pending-wake + retry-after=5` Render edge katmaninin wake-up cevabidir.

## Onerilen kalici cozum

Sleeping servis kendi icinden calisan bir interval ile kendini uyanik tutamaz. Bu nedenle dis ping gerekir.

Hedef ping:

- URL:
  `https://api.talepet.net.tr/api/health`
- Siklik:
  her 5 dakika
- Beklenen sonuc:
  servis uykuya dusmeden warm kalir, `/api/auth/google` icin `503 hibernate-pending-wake` ihtimali azalir

### Secenek 1: Render Cron Job

- Command:
  `node scripts/renderKeepAlive.mjs`
- Schedule:
  her 5 dakika
- Env:
  `RENDER_KEEPALIVE_URL=https://api.talepet.net.tr/api/health`

### Secenek 2: UptimeRobot / benzeri monitor

- URL:
  `https://api.talepet.net.tr/api/health`
- Interval:
  5 dakika
- HTTP Method:
  `GET`

## Frontend davranisi

- Google login butonu kullaniciya uzun bir uyari gostermemelidir.
- Frontend tarafinda sessiz wake-up / retry kullanilir.
- Toplam deneme mantigi:
  ilk deneme + en fazla 2 retry
- Tum denemeler basarisiz olursa kullaniciya yalniz kisa bir genel hata gosterilir.

## Manual test

1. Ilk deneme:
   `curl -i "https://api.talepet.net.tr/api/auth/google?source=web&returnTo=https://talepet.net.tr&returnSurface=web"`
2. 5-10 saniye sonra ikinci deneme:
   `curl -i "https://api.talepet.net.tr/api/auth/google?source=web&returnTo=https://talepet.net.tr&returnSurface=web"`

Ilk istekte `503` ve `x-render-routing=hibernate-pending-wake` gorulebilir; ikinci istek tipik olarak `302` ile Google'a yonlenmelidir.
