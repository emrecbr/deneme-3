# Admin Promote

Admin paneline girecek kullanicinin veritabaninda gercek admin rolu olmalidir. Email'e gore hardcode yetki verilmez.

## Mevcut admin kullaniciyi admin role terfi ettirme

```powershell
node scripts/promoteAdmin.mjs admin@talepet.net.tr
```

Script:

- `MONGODB_URI` ile MongoDB'ye baglanir
- kullaniciyi email ile bulur
- `role: "admin"`, `isAdmin: true`, `roles: ["admin"]` alanlarini gunceller
- before/after rol ozetini terminale yazar

## Not

- Kullanici kaydi yoksa once normal kayit veya mevcut seed akisi ile olusturulmalidir.
- Admin guard frontend tarafinda su sirayla kontrol eder:
  - `user.role === "admin"`
  - `user.isAdmin === true`
  - `user.roles?.includes("admin")`
