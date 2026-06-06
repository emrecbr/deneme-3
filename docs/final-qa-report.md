# Talepet Final QA Raporu

Tarih: 2026-06-06
Branch: `main`
Son route/smoke commit: `85b415c Fix admin chat route wiring`

## Kapsam

Bu rapor yayın öncesi güvenli, read-only final QA kontrollerini kapsar. Production verisini değiştiren RFQ oluşturma, teklif verme, OTP gönderme, push gönderme, ödeme alma, dosya upload etme, chat mesajı gönderme ve admin moderasyon aksiyonları bu turda çalıştırılmadı.

## Çalıştırılan Kontroller

### Repo ve Build

- `git branch --show-current`: `main`
- `git status --short`: task dışı dirty dosyalar mevcut. Bu dosyalar QA commit kapsamına alınmadı.
- `.env` tracked değil. Tracked env dosyası yalnızca `.env.example`.
- `.env.example` placeholder değerler içeriyor; gerçek secret tespit edilmedi.
- Secret taraması gerçek değer değil, `process.env.*` referansları ve `.env.example` placeholder satırları buldu.
- `node --check src/server.js`: geçti.
- `npm run build --prefix frontend`: geçti.

### npm audit

Komut: `npm audit --omit=dev`

İlk sonuç: 9 bulgu

- High: `nodemailer <=8.0.4`
- High: `xlsx`
- Moderate: `qs`
- Moderate: `uuid`
- Moderate: `ws`
- Transitive bulgular: `express`, `postman-request`, `engine.io`, `socket.io-adapter`

Notlar:

- `xlsx` için audit çıktısında fix yok.
- `nodemailer` için fix breaking upgrade gerektiriyor.
- Bu bulgular yayın öncesi risk olarak ele alınmalı; otomatik `npm audit fix --force` uygulanmadı.

Güvenli aksiyonlar:

- `nodemailer` doğrudan dependency olarak kullanılıyor. Kullanım noktası `src/services/email.js`; mevcut kod `createTransport`, `verify` ve `sendMail` API’lerini kullanıyor. Paket kontrollü şekilde `8.0.10` sürümüne yükseltildi.
- `xlsx` doğrudan dependency olarak yalnızca admin TSB araç import akışında kullanılıyordu. Audit çıktısında fix olmadığı için paket kaldırıldı ve TSB import güvenli varsayılan olarak CSV-only yapıldı. Admin UI artık yalnızca `.csv` dosyası seçtiriyor.
- `express` patch seviyesinde `4.22.2` sürümüne yükseltildi; ilgili `qs` bulgusu giderildi.
- `socket.io` lockfile çözümü `engine.io@6.6.8`, `socket.io-adapter@2.5.7` ve `ws@8.20.1` seviyesine çıktı; `ws` bulgusu giderildi.
- `iyzipay` transitif `postman-request` çözümü `2.88.1-postman.48` sürümüne `overrides` ile sabitlendi. `npm audit fix --force` uygulanmadı.

Güncel sonuç: 4 moderate bulgu

- `qs` ve `uuid`, `iyzipay -> postman-request` transitif zincirinden geliyor.
- High veya critical prod dependency bulgusu kalmadı.
- Kalan moderate bulgular ödeme sağlayıcı SDK zincirinde olduğu için force downgrade/major değişiklik yapılmadı; ödeme testleri ve sağlayıcı SDK alternatifi ayrı kontrollü çalışma gerektirir.

### Canlı Backend Read-Only Kontrolleri

Public endpointler:

- `GET /api/health`: 200
- `GET /api/content/home`: 200
- `GET /api/categories`: 200
- `GET /api/rfq`: 200

Auth/admin guard kontrolleri:

- `GET /api/chats`: 401
- `GET /api/chats/unread-count`: 401
- `GET /api/admin/chats`: 401
- `GET /api/admin/chat-reports`: 401
- `GET /api/admin/chat-restrictions`: 401
- `GET /api/admin/content/home`: 401
- `GET /api/admin/categories`: 401
- `GET /api/admin/audit`: 401
- `GET /api/admin/system/health`: 401

Değerlendirme: Auth gerektiren endpointler token olmadan veri döndürmedi. Bu beklenen güvenli davranış.

### Canlı Frontend/Admin Smoke

Komut: `npm run test:smoke`

Sonuç: 11/11 geçti.

Kontrol edilenler:

- API health
- Public home content
- Public categories
- Admin chat endpointlerinin auth guard’ı
- `/admin/chats` SPA route asset kontrolü
- `/admin/chat-reports` SPA route asset kontrolü
- `/admin/chat-restrictions` SPA route asset kontrolü
- `/app` app route asset kontrolü
- `/` website route asset kontrolü

Canlı frontend artık yeni route bundle’ını servis ediyor:

- `index-DbJhv-1S.js`

Admin chat route tokenları canlı bundle içinde mevcut:

- `AdminChats`
- `AdminChatReports`
- `AdminChatRestrictions`
- `chat-reports`
- `chat-restrictions`

## Eklenen Smoke Test Otomasyonu

Yeni script:

```bash
npm run test:smoke
```

Dosya:

- `scripts/smokeTest.mjs`

Test özellikleri:

- Sadece read-only GET istekleri yapar.
- Production verisini değiştirmez.
- Secret veya token gerektirmez.
- Admin endpointlerinde 401/403 bekler.
- SPA route’larında canlı JS asset içinde gerekli route tokenlarını kontrol eder.
- CI veya yayın öncesi manuel smoke için tekrar çalıştırılabilir.

## Admin Chat Route Durumu

Önceki sorun: canlı static site eski bundle servis ettiği için `/admin/chats`, `/admin/chat-reports`, `/admin/chat-restrictions` dashboard’a dönüyordu.

Güncel durum:

- Backend route’ları canlıda 404 değil, auth guard ile 401 dönüyor.
- Static site yeni bundle servis ediyor.
- Smoke test ilgili admin route tokenlarını canlı bundle’da doğruladı.

Not: Authenticated admin UI render’ı test hesabı ile manuel doğrulanmadı; smoke test route/asset ve backend guard seviyesini doğrular.

## Uygulanmayan / Manuel Test Gerektiren Alanlar

Aşağıdaki alanlar test hesabı, iki kullanıcı, ödeme test kartı, iOS simulator veya admin oturumu gerektirdiği için bu turda uygulanmadı:

- Admin login ile authenticated ekran render kontrolü
- Admin Chat Denetimi liste içeriği ve `İncele` butonu
- Admin Chat Şikayetleri durum güncelleme
- Kısıtlı Kullanıcılar kaldırma aksiyonu
- Hero görsel upload
- Ana kategori görsel upload/publish
- Chat görsel mesaj upload
- RFQ create
- Offer create/update/withdraw
- Bildirim okundu/yönlendirme akışı authenticated test
- İki kullanıcı realtime chat testi
- Engelleme/şikayet/moderasyon canlı aksiyonları
- Ödeme/paket checkout testi
- OTP gönderme/verify testi
- iOS simulator testleri
- OneSignal push teslim testi

Bu alanlarda production verisi değiştirilmemesi için test credentials ve güvenli test planı olmadan işlem yapılmadı.

## Risk Sınıflandırması

### High

- Authenticated kritik iş akışları henüz test kullanıcılarıyla doğrulanmadı.

### Medium

- `npm audit` kalan bulguları `iyzipay -> postman-request` transitif zincirinde 4 moderate olarak açık.
- Çok sayıda task dışı dirty dosya mevcut; release commit kapsamı dikkatle seçilmeli.
- iOS simulator QA henüz yapılmadı.
- Ödeme/OTP/push testleri henüz yapılmadı.

### Low

- Smoke test yalnızca route/asset/API guard seviyesindedir; görsel regresyon veya UX doğrulaması yapmaz.

## Yayın Değerlendirmesi

Durum: Koşullu yayın adayı.

Neden:

- Build ve read-only smoke kontrolleri geçti.
- Admin chat route canlı bundle sorunu düzeldi.
- `npm audit` high bulguları giderildi.
- Ancak authenticated/manual kritik akış testleri açık.

Yayın öncesi önerilen minimum bloklar:

1. `iyzipay -> postman-request` transitif moderate bulguları için ödeme SDK güncelleme/alternatif planı çıkarılmalı.
2. Test admin + iki test kullanıcı hesabı ile authenticated QA yapılmalı.
3. Ödeme yalnızca test modunda doğrulanmalı.
4. iOS simulator smoke yapılmalı.
5. Upload testleri test görselleriyle ve Cloudinary URL doğrulamasıyla yapılmalı.

## Komut Özeti

Geçen komutlar:

```bash
node --check src/server.js
node --check src/services/email.js
node --check src/services/tsbImportService.js
node --check routes/adminRoutes.js
EMAIL_PROVIDER=mock node -e "import('./src/services/email.js').then(async m=>{ await m.sendOtpEmail({to:'qa@example.com', code:'123456'}); console.log('EMAIL_MOCK_OK') })"
npm run build --prefix frontend
npm run test:smoke
```

Güvenlik kontrolü:

```bash
npm audit --omit=dev
```

Sonuç: 4 moderate bulgu kaldı; detaylar yukarıda sınıflandırıldı.
