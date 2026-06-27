# deadlines. — desktop app

A frameless Electron wrapper around the deadlines. web app.

## Setup

```bash
npm install
```

## Run locally

```bash
npm start
```

For dev tools in the View menu:

```bash
npm run dev
```

## Build a distributable

```bash
# macOS (.dmg — universal arm64 + x64)
npm run build:mac

# Windows (.exe installer)
npm run build:win

# Linux (.AppImage + .deb)
npm run build:linux
```

Built apps appear in the `dist/` folder.

## Adding a real icon

Replace the placeholder files in `assets/` with your actual icons:

- `assets/icon.png`  — 1024×1024 PNG (used for Linux + Windows)
- `assets/icon.icns` — macOS icon set (generate from the PNG with `iconutil`)
- `assets/icon.ico`  — Windows icon (generate from the PNG with ImageMagick)

### Quick macOS icon generation

```bash
mkdir icon.iconset
sips -z 16 16     assets/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     assets/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   assets/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_512x512.png
cp assets/icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
rm -rf icon.iconset
```

## Google OAuth note

Google Identity Services' popup flow works inside Electron's BrowserWindow
as long as `localhost` (or your deployed domain) is in the Authorized
JavaScript Origins in Google Cloud Console.

For the packaged app you'll also need to add the `file://` origin, or better —
deploy the app to Vercel and point `win.loadURL('https://your-app.vercel.app')`
instead of `win.loadFile(...)` in `electron/main.js`.
