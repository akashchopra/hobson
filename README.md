# Getting Started
Hobson is a live programming environment inspired by [Smalltalk](https://en.wikipedia.org/wiki/Smalltalk), [Lisp](https://en.wikipedia.org/wiki/Lisp_(programming_language)), Mel Conway's [Humane Dozen](https://melconway.com/Home/pdf/humanedozen.pdf), and most of all by Alexander Obenauer's [Itemized OS](https://alexanderobenauer.com/labnotes/).

The system aims to document itself from within, so the only way to learn more is to run the system. It consists of an HTML bootloader file that is used to import all of the system code into IndexedDB. First, download https://github.com/akashchopra/hobson/blob/master/src/items/backup.json to your machine. Then go to https://akashchopra.github.io/hobson/src/bootloader.html. You will be presented with this screen:

<img width="834" height="402" alt="image" src="https://github.com/user-attachments/assets/5e586a00-ba45-46d7-b540-6d5f2dca5ef4" />

Upload the backup.json file (which contains the full system, not just the kernel) and you are ready to go! The system should open at the "New Users" workspace, but if for some reason the backup file was configured to load a different workspace, simply press Ctrl+k and select "New Users" from the choices offered - it is the best starting point for learning about the system.

## Desktop App (Tauri)

Hobson can also run as a native desktop app via [Tauri](https://v2.tauri.app/), giving access to filesystem, shell, networking, and other OS APIs. The Tauri shell lives on the `tauri` branch.

### Prerequisites

- [Rust](https://rustup.rs/) (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Tauri CLI (`cargo install tauri-cli --version "^2"`)
- Linux system libraries: `sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Run

```bash
git checkout tauri
cd src-tauri
cargo tauri dev
```

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

## Warning
This system is almost entirely vibe-coded, and needs serious review. The documentation within the system is also mostly AI-generated, and can sometimes read like marketing material - treat with caution!
