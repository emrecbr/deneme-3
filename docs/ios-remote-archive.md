# iOS Remote Archive

Bu repo mevcut lokal Mac guncel Xcode'u kuramadiginda App Store build'ini guncel bir Mac ortaminda almak icin hazirdir.

## Proje sabitleri

- iOS proje dosyasi: `ios/App/App.xcodeproj`
- Scheme: `App`
- Bundle ID: `com.talepet.app`
- Uygulama adi: `Talepet`
- Production API: `https://api.talepet.net.tr/api`

## GitHub Actions yolu

Workflow: `.github/workflows/ios-app-store-build.yml`

Runner secimi:

- `runner_label`: Xcode 26+ ve iOS 26 SDK iceren macOS runner etiketi. Varsayilan `macos-26`.
- `signing_mode=build-only`: imzasiz Release build dogrulamasi yapar.
- `signing_mode=app-store-export`: signed archive alir ve `.ipa` artifact uretir.
- `signing_mode=app-store-upload`: `.ipa` uretir ve App Store Connect'e yukler.

Gerekli GitHub Secrets:

- `APPLE_TEAM_ID`
- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `IOS_APP_STORE_PROFILE_BASE64`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64`

Base64 hazirlama ornekleri:

```bash
base64 -i Certificates.p12 | pbcopy
base64 -i Talepet_AppStore.mobileprovision | pbcopy
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

`app-store-export` icin App Store Connect API secrets gerekli degildir; upload icin gereklidir.

## MacInCloud veya baska guncel Mac yolu

Guncel Xcode 26+ kurulu Mac'te:

```bash
git clone <repo-url>
cd talepet
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
npm ci
npm ci --prefix frontend
npm run build --prefix frontend
npx cap sync ios
open ios/App/App.xcodeproj
```

Xcode icinde:

- Target: `App`
- Signing & Capabilities: Apple Team secili
- Bundle ID: `com.talepet.app`
- Product > Archive
- Organizer > Distribute App > App Store Connect

Transporter yalnizca hazir `.ipa` yukler; `.ipa` uretmek icin once Xcode archive/export alinmalidir.
