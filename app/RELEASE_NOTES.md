First desktop preview of Zenvora.

## Downloads

| System | File |
|---|---|
| Windows 10/11 (64-bit) | `Zenvora-Setup-…-x64.exe` |
| macOS, Apple Silicon (M1–M4) | `Zenvora-…-mac-arm64.dmg` |
| macOS, Intel | `Zenvora-…-mac-x64.dmg` |
| Linux (any distro) | `Zenvora-…-linux-x86_64.AppImage` |
| Debian / Ubuntu | `Zenvora-…-linux-amd64.deb` |

`SHA256SUMS.txt` lists checksums for every file.

## What works

- Real web browsing in tabs, with workspaces, back/forward, reopen closed tab and tab search
- Address bar that tells URLs from searches (DuckDuckGo, Google, Bing or Brave)
- Find in page, per-tab zoom, bookmarks star
- Real error pages for unreachable sites and certificate problems
- Light/dark/system theme, accent colors, horizontal or vertical tabs
- Keyboard shortcuts: ⌘/Ctrl + T, W, ⇧T, L, K, F, R, comma
- Sandboxed pages: no page gets camera, microphone or location access

## Preview only (sample data, not connected yet)

Assistant, Tasks, Privacy details, Page analysis (SEO) and the Downloads panel show sample data.
The VPN is **not** available: it shows "Not set up" and never claims to protect your traffic.
Files you download from websites are still saved normally.

## Installing an unsigned build

These builds are not code-signed yet, so your system will warn you once:

- **Windows:** on "Windows protected your PC", click **More info → Run anyway**.
- **macOS:** open the app once; when it's blocked, go to **System Settings → Privacy & Security** and click **Open Anyway**.
- **Linux AppImage:** `chmod +x Zenvora-*.AppImage` and run it.
