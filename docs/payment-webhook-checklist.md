# Payment Webhook Checklist

Bu dokuman Talepet'te premium paket, one cikar, ek ilan ve kart ekleme odakli odeme akislarini production'a alirken kullanilacak kontrol listesini ve webhook test matrisini tanimlar.

## Durum Modeli

`Payment.status`
- `pending`: checkout basladi, odeme sonucu bekleniyor
- `paid`: provider odemeyi basarili bildirdi
- `failed`: provider odemeyi basarisiz veya iptal bildirdi
- `refunded`: provider iade bildirdi

`Payment.lifecycleStatus`
- `initiated`: backend payment kaydini olusturdu
- `pending`: checkout URL olustu, kullanici odeme ekranina yonlendirildi
- `webhook_received`: basarili webhook geldi, fulfillment sirasina alindi
- `succeeded`: hak/kredi uygulandi
- `failed`: odeme veya fulfillment basarisiz
- `cancelled`: provider iptal sinyali dondu
- `refunded`: provider iade sinyali dondu

`Payment.fulfillmentStatus`
- `pending`: hak henuz uygulanmadi
- `processing`: fulfillment worker bu odemeyi isliyor
- `done`: hak uygulandi
- `failed`: hak uygulama asamasinda hata alindi
- `skipped`: odeme basarili ama fulfillment uygulanmadi

## Uctan Uca Yasam Dongusu

1. Kullanici checkout endpoint'ini cagirir.
2. Backend `Payment` kaydini `initiated` olarak olusturur.
3. Provider checkout URL'si olusunca lifecycle `pending` olur.
4. Provider webhook'u geldiginde event `WebhookEvent` olarak kaydedilir.
5. Event duplicate degilse ilgili `Payment` `webhook_received` olur.
6. Fulfillment lock alinirse premium / featured / extra listing hakki tek sefer uygulanir.
7. Fulfillment tamamlaninca lifecycle `succeeded`, fulfillment `done` olur.

## Idempotency Kurallari

- `WebhookEvent(provider,eventId)` unique index'i ayni event'i ikinci kez reddeder.
- `Payment.fulfillmentStatus` ikinci katman korumadir.
- Ayni odeme icin yeni eventId ile ikinci kez `payment.succeeded` gelse bile:
  - fulfillment claim alinmis ve `done` ise kredi tekrar yazilmaz
  - claim `processing` durumundaysa ikinci islem skip edilir

## Hak Isleme Kurallari

- `listing_extra`
  - `user.paidListingCredits += 1`
- `featured_*`
  - `user.featuredCredits += 1`
- `subscription`
  - `user.isPremium = true`
  - `user.premiumUntil = currentPeriodEnd`
  - `Subscription` aktiflenir veya guncellenir
- premium one-time benzeri odemeler
  - `user.isPremium = true`
  - `user.premiumUntil = now + 30 gun`
- `payment_method_setup`
  - kart bilgisi odeme sonucu geldiyse ozet kaydedilir
  - kullanici consent verdiyse varsayilan odeme yontemi olarak islenir

## Webhook Test Matrisi

| Senaryo | Beklenen Payment | Beklenen Fulfillment | Beklenen Kullanici Etkisi |
| --- | --- | --- | --- |
| Basarili premium odeme | `paid` + `succeeded` | `done` | premium aktif olur |
| Basarili featured odeme | `paid` + `succeeded` | `done` | `featuredCredits +1` |
| Basarili ek ilan odemesi | `paid` + `succeeded` | `done` | `paidListingCredits +1` |
| Basarili kart ekleme odemesi | `paid` + `succeeded` | `done` veya consent bekler | kart ozeti gorunur |
| Basarisiz odeme | `failed` + `failed` | `pending` veya `skipped` | hak yazilmaz |
| Duplicate webhook ayni eventId | degismez | degismez | hak tekrar yazilmaz |
| Duplicate webhook farkli eventId ayni payment | `paid` kalir | `done` kalir | hak tekrar yazilmaz |
| Gecikmeli webhook | `pending` -> `paid` | `done` | hak sonradan yazilir |
| Provider timeout ama webhook sonra gelir | ilk anda `pending` | sonra `done` | hak webhook ile yazilir |
| Unknown provider status | lifecycle degismez veya loglanir | uygulanmaz | manuel inceleme gerekir |
| Refund event | `refunded` | mevcut hak geri alinmaz, manuel politika gerekir | operasyon incelemesi |
| Cancel event | `failed/cancelled` | uygulanmaz | hak yazilmaz |

## Manual QA Checklist

### Checkout Baslatma

- Admin'de listing quota aktif mi kontrol et
- Admin'de monetization fiyatlari aktif mi kontrol et
- RFQ create ekraninda kota bilgisi gorunuyor mu kontrol et
- Kota bittiginde paywall aciliyor mu kontrol et
- Premium / featured / ek ilan checkout URL'i donuyor mu kontrol et

### Webhook Sonrasi

- `GET /api/billing/payment/:paymentId` ile:
  - `status`
  - `lifecycleStatus`
  - `fulfillmentStatus`
  - `lastWebhookEventId`
  degerlerini kontrol et
- `GET /api/billing/me` ile premium/featured durumu kontrol et
- `GET /api/users/me/listing-quota` ile paid listing credit artisini kontrol et
- Profil ekraninda guncel durum gorunuyor mu kontrol et

### Duplicate Event Testi

- Aynı `eventId` ile webhook'u tekrar yolla
- Sonuc `duplicate: true` olmali
- Kullanici kredileri degismemeli
- Farkli `eventId` ama ayni `providerPaymentId` ile success webhook tekrar yolla
- `fulfillmentStatus=done` kalmali
- kredi/premium ikinci kez artmamali

## Operasyon Loglari

Asagidaki loglar grep icin kullanilabilir:

- `CHECKOUT_INITIATED`
- `CHECKOUT_PENDING`
- `CHECKOUT_ERROR`
- `WEBHOOK_RECEIVED`
- `WEBHOOK_DUPLICATE_EVENT`
- `WEBHOOK_PAYMENT_NOT_FOUND`
- `PAYMENT_FAILED`
- `PAYMENT_REFUNDED`
- `PAYMENT_CANCELLED`
- `WEBHOOK_UNKNOWN_STATUS`
- `FULFILLMENT_DONE`
- `FULFILLMENT_DUPLICATE_SKIPPED`
- `FULFILLMENT_ERROR`

## Bilinen Edge Case'ler

- Refund/cancel durumunda kullaniciya yazilmis hak geri alinmiyor; operasyon karari gerekir.
- Provider webhook'u planCode veya providerPaymentId gondermezse payment eslesmesi zayif kalabilir.
- `payment_method_setup` odemesinde kullanici consent vermeden kart varsayilan olarak kaydedilmez.
- Provider timeout durumunda basarili webhook gec gelebilir; frontend `PremiumReturn` polling'i bunu tolere etmelidir.
