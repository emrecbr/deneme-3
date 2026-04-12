# Jarvis Agent

Windows-first, Electron tabanli, sesli komut altyapisina hazir, onay kontrollu desktop agent iskeleti.

Bu proje mevcut `talepet` reposundan bagimsizdir. `C:\Users\C1\Desktop\talepet` klasoru bu ajan icin sadece erisilebilir hedef proje olarak tanimlanmistir.

## Ilk fazda neler var

- Electron + React + TypeScript desktop uygulamasi
- Yazili komut girisi
- MediaRecorder + STT backend tabanli push-to-talk voice pipeline
- Guvenli action executor
- Talepet klasorunu acma gorevi
- Render / domain / DNS operasyonlari icin wizard iskeleti
- Approval / reject akisleri

## Klasor yapisi

```text
jarvis-agent/
  apps/
    desktop/
      src/
        main/
        preload/
        renderer/
  packages/
    audio/
    core/
    executor/
    security/
```

## Kurulum

Windows'ta `corepack enable` bazen `C:\Program Files\nodejs\...` altinda `EPERM` verebilir. Bu durumda shim olusmasa bile `corepack pnpm` ile devam edebilirsin ve yonetici yetkisi gerekmez.

Onerilen Windows PowerShell akisi:

```powershell
corepack prepare pnpm@10.6.5 --activate
```

Istersen oturum bazli hizli alias tanimlayabilirsin:

```powershell
Set-Alias pnpmi corepack
```

Bagimliliklari kur:

```powershell
cd C:\Users\C1\Desktop\talepet\jarvis-agent
corepack pnpm approve-builds
corepack pnpm install
```

`.env.example` dosyasini `.env` olarak kopyalayip gerekirse duzenle.

`approve-builds` ekraninda `electron` ve `esbuild` secilecek, sonra `y` ile onay verilecek.

Tek satir bootstrap:

```powershell
cd C:\Users\C1\Desktop\talepet\jarvis-agent
corepack prepare pnpm@10.6.5 --activate
if (!(Test-Path .env)) { Copy-Item .env.example .env }
corepack pnpm approve-builds
corepack pnpm install
```

## Calistirma

Gelistirme:

```powershell
corepack pnpm --filter @jarvis/desktop dev
```

Repo kokunden ayni akisi calistirmak icin:

```powershell
corepack pnpm dev
```

## Windows troubleshooting

Eger Electron acilisinda Chromium cache izin hatalari gorursen:

- `Unable to move the cache: Access denied (0x5)`
- `Unable to create cache`
- `Gpu Cache Creation failed: -2`

uygulama artik cache ve session verisini yazilabilir bir dizine yonlendirir:

```text
%APPDATA%\JarvisAgent\dev-runtime
```

Dev modda ek olarak daha guvenli Chromium startup ayarlari uygulanir:

- `userData` ozel klasore tasinir
- `sessionData` ozel klasore tasinir
- `disk-cache-dir` ozel klasore tasinir
- GPU shader disk cache kapatilir
- development modda hardware acceleration kapatilir

Beklenen log:

```text
[jarvis-agent] runtime paths { ... }
start electron app...
```

Eger problem devam ederse mevcut cache'i temizleyip tekrar dene:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\JarvisAgent\dev-runtime" -ErrorAction SilentlyContinue
corepack pnpm dev
```

## Preload troubleshooting

Eger DevTools tarafinda su hatalari gorursen:

- `Unable to load preload script`
- `Cannot use import statement outside a module`
- `Cannot read properties of undefined (reading 'getBootstrap')`

preload cikti formati Electron ile uyumsuz olabilir. Bu projede preload artik CommonJS olarak uretilir:

```text
apps/desktop/out/preload/index.cjs
```

Beklenen startup zinciri:

```text
[jarvis-agent] preload loaded
[jarvis-agent] bridge exposed
[jarvis-agent] bridge available in renderer
[jarvis-agent] bootstrap fetched
```

Uretim derlemesi:

```powershell
corepack pnpm build
```

Tip kontrolu:

```powershell
corepack pnpm typecheck
```

## Ilk demo akisi

1. Uygulamayi ac.
2. Komut kutusuna `Talepet klasorunu ac` yaz.
3. Uygulama bir action plan uretecek.
4. Approval modal uzerinden onay verirsen ilgili klasor acilacak.
5. `Render dashboard ac` veya `DNS wizard baslat` gibi komutlar wizard ve URL plani uretecek.

## Guvenlik modeli

- Varsayilan davranis approval-first.
- Sadece allowlist icindeki URL alan adlari acilir.
- Sadece allowlist icindeki klasorler acilir.
- Render/domain islemleri ilk fazda otomatik yurutulmez; wizard ve onayli aksiyon planlari uretir.

## Voice / STT

Bu surumde Web Speech ana yol olarak kullanilmaz. Renderer mikrofon kaydini `MediaRecorder` ile alir, main process ise sesi STT backend'e yollar.

Varsayilan STT yolu:

- OpenAI transcription backend
- model: `gpt-4o-mini-transcribe`
- env: `OPENAI_API_KEY` veya `JARVIS_OPENAI_API_KEY`

Ornek env:

```powershell
OPENAI_API_KEY=...
JARVIS_STT_PROVIDER=openai
JARVIS_STT_MODEL=gpt-4o-mini-transcribe
JARVIS_ENABLE_WAKE_WORD=false
```

Wake word bu fazda varsayilan olarak kapalidir. Oncelik stabil push-to-talk transcript akisidir.

## Sonraki fazlar

- TTS provider adapteri
- Browser automation sandbox
- Typed orchestrator servisi
- Audit log ve SQLite store
- Policy engine sertlestirmesi
