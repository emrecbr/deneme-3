# Demo Test Standardi

Render deploy oncesi standart local production-benzeri test akisi budur.

## Tek Komut

Repo kokunden:

```bash
cd frontend && npm run demo
```

Bu komut sirayla:
- production build alir
- `vite preview` ile `4173` portunda preview acar

## Ayri Ayri Calistirmak Istersen

```bash
cd frontend
npm run demo:build
npm run demo:preview
```

## Telefonda Test

1. Bilgisayar ve telefon ayni aga bagli olsun.
2. Bilgisayarin LAN IP adresini ogren.
3. Telefonda su adresi ac:

```text
http://<LAN_IP>:4173
```

Ornek:

```text
http://192.168.1.25:4173
```

## Zorunlu Kontrol Listesi

- `login` ekrani aciliyor ve submit calisiyor mu
- `kesfet` route'u aciliyor mu
- `create` route'u aciliyor mu
- `rfq detail` sayfasi aciliyor mu
- `profil` sayfalari aciliyor mu
- `admin login` ayri surface'te calismaya devam ediyor mu

## Hata Yakalama Checklist

Build:
- `npm run demo:build` hatasiz tamamlandi mi
- import/export uyumsuzlugu var mi
- eksik component veya eksik named export var mi

Runtime:
- console'da syntax error veya `ReferenceError` var mi
- login butonlari loading'den cikiyor mu
- auth bootstrap sayfayi kilitliyor mu
- website hostta admin token sizmiyor mu

API ve env:
- production API base dogru hosta gidiyor mu
- `VITE_*` env bagimliliklari preview'da calisiyor mu
- `/api/system/maintenance`, `/api/health`, `/api/auth/me` beklenmedik sekilde takiliyor mu

Asset ve theme:
- kaldirilmis `/themes/website/*` istekleri gelmiyor mu
- admin ve website surface CSS'leri birbirine karismiyor mu

## Deploy Oncesi Son Karar

Su uc kosul saglanmadan Render deploy baslatma:

1. `cd frontend && npm run demo` basarili
2. Tarayici ve telefon preview testi temiz
3. Login, kesfet, create, rfq detail, profil ve admin login akislari kontrol edildi
