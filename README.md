# Getting Started
Hobson is a live programming environment inspired by [Smalltalk](https://en.wikipedia.org/wiki/Smalltalk), [Lisp](https://en.wikipedia.org/wiki/Lisp_(programming_language)), Mel Conway's [Humane Dozen](https://melconway.com/Home/pdf/humanedozen.pdf), and most of all by Alexander Obenauer's [Itemized OS](https://alexanderobenauer.com/labnotes/).

The system aims to document itself from within, so the only way to learn more is to run the system. It consists of an HTML bootloader file that is used to import all of the system code into IndexedDB. First, download https://github.com/akashchopra/hobson/blob/master/src/items/backup.json to your machine. Then go to https://akashchopra.github.io/hobson/src/bootloader.html. You will be presented with this screen:

<img width="834" height="402" alt="image" src="https://github.com/user-attachments/assets/5e586a00-ba45-46d7-b540-6d5f2dca5ef4" />

Upload the backup.json file (which contains the full system, not just the kernel) and you are ready to go! The system should open at the "New Users" workspace, but if for some reason the backup file was configured to load a different workspace, simply press Ctrl+k and select "New Users" from the choices offered - it is the best starting point for learning about the system.

## Desktop App (Tauri)

Hobson can also run as a native desktop app via [Tauri](https://v2.tauri.app/), giving access to filesystem, shell, networking, and other OS APIs — including an HTTP server for device-to-device sync.

### Prerequisites

- [Rust](https://rustup.rs/) (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Tauri CLI (`cargo install tauri-cli --version "^2"`)
- Linux system libraries: `sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Development

```bash
cargo tauri dev
```

### Release Build

```bash
cargo tauri build
```

Produces a `.deb` and `.rpm` in `src-tauri/target/release/bundle/`. The standalone binary is at `src-tauri/target/release/hobson`.

### Keyboard Shortcuts

The Tauri app has no browser chrome, so these shortcuts replace browser UI:

| Shortcut | Action |
|----------|--------|
| Ctrl+R / F5 | Reload page |
| Alt+Left | Back |
| Alt+Right | Forward |

### Known Issues

- WebKitGTK on Linux is somewhat slower than Firefox for Hobson's workload. This is an upstream limitation.
- The `-webkit-font-smoothing: antialiased` CSS rule is required in kernel:styles to prevent text rendering artifacts under WebKitGTK's GPU compositor.

## Mobile App (Tauri Android)

Hobson runs on Android via Tauri's mobile support. The mobile app syncs with the desktop over the local network.

### Prerequisites

- All desktop prerequisites above
- [Android SDK](https://developer.android.com/studio) with NDK installed
- Android device with USB debugging enabled, or an emulator
- `ANDROID_HOME` and `NDK_HOME` environment variables set

### Development

```bash
cargo tauri android dev
```

Requires a connected Android device or running emulator.

### Release Build

```bash
cargo tauri android build
```

The unsigned APK is produced at `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`. Sign and install:

```bash
# Create a keystore (one-time)
keytool -genkey -v -keystore ~/hobson.keystore -alias hobson -keyalg RSA -keysize 2048 -validity 10000

# Sign the APK
APK=src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
apksigner sign --ks ~/hobson.keystore --out ~/hobson-release.apk "$APK"

# Install
adb install ~/hobson-release.apk
```

### Initial Setup

The mobile app starts with an empty database. Import `backup.json` from the bootloader's import screen, or push it via adb and import:

```bash
adb push src/items/backup.json /sdcard/Download/backup.json
```

### Sync

Once both desktop and mobile are running with the same item set:

1. Desktop starts an HTTP sync server automatically on port 8384
2. On mobile, configure the desktop's IP in the sync-client item (`content.serverAddress`, e.g. `"192.168.1.100:8384"`)
3. Tap the Sync button in the mobile action bar

Sync uses last-write-wins at the item level. Deletions are tracked via the per-item history system.

## Warning
This system is almost entirely vibe-coded, and needs serious review. The documentation within the system is also mostly AI-generated, and can sometimes read like marketing material - treat with caution!
