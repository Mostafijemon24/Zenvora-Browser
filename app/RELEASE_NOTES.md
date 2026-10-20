Zenvora 0.2 connects the Assistant to real AI.

## New in 0.2

- **AI Assistant, for real.** Ask about the pages you share and get answers from **Claude** (Anthropic) or any model on **OpenRouter**. Follow-up questions keep the conversation.
- **Your keys stay on your server.** The new Zenvora Assistant server (`server/` in the repository) holds the API keys; the app only stores the server address and an access token.
- **Settings → AI & automation:** server address, access token, *Test connection*, provider choice (Claude or OpenRouter) and model.
- Without a server, the desktop app says the Assistant isn't connected instead of showing invented answers.
- The installed app now keeps its data in a folder named `Zenvora`.

Setup guide: see **AI assistant setup** in the README.

## Downloads

| System | File |
|---|---|
| Windows 10/11 (64-bit) | `Zenvora-Setup-…-x64.exe` |
| macOS, Apple Silicon (M1–M4) | `Zenvora-…-mac-arm64.dmg` |
| macOS, Intel | `Zenvora-…-mac-x64.dmg` |
| Linux (any distro) | `Zenvora-…-linux-x86_64.AppImage` |
| Debian / Ubuntu | `Zenvora-…-linux-amd64.deb` |

`SHA256SUMS.txt` lists checksums for every file.

## Still preview (sample data)

Tasks, Privacy details, Page analysis (SEO) and the Downloads panel show sample data. The VPN is **not** available: it shows "Not set up" and never claims to protect your traffic.

## Installing an unsigned build

These builds are not code-signed yet, so your system will warn you once:

- **Windows:** on "Windows protected your PC", click **More info → Run anyway**.
- **macOS:** open the app once; when it's blocked, go to **System Settings → Privacy & Security** and click **Open Anyway**.
- **Linux AppImage:** `chmod +x Zenvora-*.AppImage` and run it.
