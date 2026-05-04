**English** | [中文](./README_CN.md)

# 🦙 AI Usage Extension

> Monitor cloud AI platform API usage directly in your VSCode/Trae CN status bar. Currently supports **Ollama**.

## ✨ Features

- **Real-time Usage Monitoring** — Display Ollama session (5h) and weekly usage percentages in the status bar
- **Color-coded Alerts** — Independent color warnings for each usage type: Session (<50% normal, 50-80% yellow, ≥80% red) and Weekly (<75% normal, 75-90% yellow, ≥90% red)
- **Hover Tooltip** — Detailed usage info including reset countdown on mouse hover over the label item
- **QuickPick Menu** — Left-click the status bar item to access all actions via a convenient menu
- **Auto & Manual Refresh** — Configurable auto-update intervals (30s, 1min, 2min, 5min, 10min) or manual refresh
- **Ollama Login** — Built-in WebView login panel with step-by-step cookie extraction guide
- **Manual Cookie Input** — Fallback option to paste cookies directly from DevTools
- **Secure Storage** — Cookies are stored locally via `globalState`, never sent to third-party services

## 📸 Preview

### Status Bar Display

The status bar consists of three independent items, each with its own color alert:

```
$(cloud) Ollama    S: 45%    W: 30%
```

- **$(cloud) Ollama** — Label item (no color alert, shows full tooltip on hover)
- **S: xx%** — Current 5-hour session usage percentage with independent color alert
- **W: yy%** — Current weekly usage percentage with independent color alert

### Color-coded Alerts

| Usage Level | Session Threshold | Weekly Threshold | Status Bar Background |
|-------------|-------------------|------------------|-----------------------|
| Normal | < 50% | < 75% | Default (no highlight) |
| Warning | 50% ~ 79% | 75% ~ 89% | Yellow (`statusBarItem.warningBackground`) |
| Critical | ≥ 80% | ≥ 90% | Red (`statusBarItem.errorBackground`) |

### Hover Tooltip

Hover over the **label item** (`$(cloud) Ollama`) to see detailed Markdown-formatted usage info:

```
☁ Ollama Cloud Usage
──────────────────────
Session (5h): 45% used
  ↻ Reset in: 2h 30m

Weekly: 78% used ⚠ WARNING
  ↻ Reset in: 3d 12h
──────────────────────
Last updated: 14:30:00
```

## 🚀 Getting Started

### Prerequisites

- **VSCode** ≥ 1.85.0 or **Trae CN** (compatible IDE)
- An **Ollama** account (sign up at [ollama.com](https://ollama.com))

### Installation

#### Option 1: Install from VSIX

1. Download or build the `.vsix` file
2. Open VSCode/Trae CN
3. Go to Extensions → `···` → **Install from VSIX...**
4. Select the `.vsix` file

#### Option 2: Build from Source

```bash
# Clone the repository
git clone <repository-url>
cd ai-usage-ext

# Install dependencies
npm install

# Compile
npm run compile

# Package as VSIX
npx vsce package --allow-missing-repository
```

Or use the one-click build script:

```bash
chmod +x build.sh
./build.sh
```

The build script will:
1. Install dependencies
2. Run TypeScript type checking
3. Compile with esbuild
4. Package into a `.vsix` file

### First-Time Setup

1. After installation, the extension activates automatically on startup
2. You'll see `$(key) Ollama: Login` in the status bar
3. Click the status bar item (or run `AI Usage: Login Ollama` from the Command Palette)
4. Follow the WebView guide to obtain your Ollama cookie:
   - Click **"Open Sign-in Page"** to log in to Ollama in your browser
   - Open DevTools (F12 or Cmd+Option+I)
   - Go to **Application → Cookies** or **Network tab → request headers**
   - Copy the full cookie string and paste it into the input field
5. Once saved, usage data will appear in the status bar within seconds

## 📖 Commands

| Command | Description |
|---------|-------------|
| `AI Usage: Show Menu` | Open QuickPick menu with all available actions |
| `AI Usage: Login Ollama` | Open the WebView login panel |
| `AI Usage: Set Ollama Cookie (Manual)` | Manually enter cookie string via InputBox |
| `AI Usage: Clear Ollama Cookie` | Remove the stored cookie |
| `AI Usage: Toggle Auto Update` | Enable/disable automatic usage refresh |
| `AI Usage: Set Update Interval` | Choose refresh frequency (30s/1min/2min/5min/10min) |
| `AI Usage: Refresh Now` | Immediately fetch latest usage data |
| `AI Usage: Open Ollama Settings` | Open ollama.com/settings in browser |

## ⚙️ Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `aiUsage.autoUpdate` | `boolean` | `true` | Enable automatic usage data refresh |
| `aiUsage.updateInterval` | `number` | `60` | Auto-update interval in seconds (30/60/120/300/600) |

## 🏗️ Architecture

### Project Structure

```
ai-usage-ext/
├── src/
│   ├── extension.ts                # Extension entry point (activate/deactivate)
│   ├── controllers/
│   │   └── extensionController.ts  # Core controller — coordinates all modules
│   ├── providers/
│   │   └── ollamaProvider.ts       # Ollama data fetching & HTML parsing
│   ├── managers/
│   │   ├── cookieManager.ts        # Cookie storage, retrieval & change notifications
│   │   ├── configManager.ts        # VSCode settings management & change listeners
│   │   └── statusBarManager.ts     # Status bar UI — display, colors, tooltips
│   ├── webview/
│   │   └── loginPanel.ts           # WebView login panel with cookie extraction guide
│   ├── models/
│   │   └── usageData.ts            # Data interfaces, enums, and helper functions
│   └── utils/
│       └── httpClient.ts           # HTTP client wrapper with cookie auth & error handling
├── package.json                    # Extension metadata, commands, configurations
├── tsconfig.json                   # TypeScript configuration
├── build.sh                        # One-click build & package script
├── .vscodeignore                   # VSIX packaging exclusions
└── LICENSE                         # MIT License
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| **ExtensionController** | Central coordinator — registers commands, manages timer, orchestrates data flow |
| **OllamaProvider** | Fetches `ollama.com/settings` HTML, parses session/weekly usage & reset times via cheerio |
| **CookieManager** | Persists cookies in `globalState`, provides change notifications |
| **ConfigManager** | Reads/writes VSCode settings, fires config change callbacks |
| **StatusBarManager** | Renders usage data in 3 independent status bar items (label/session/weekly) with separate color-coded alerts and a shared Markdown tooltip |
| **LoginPanel** | WebView panel guiding users through Ollama login and cookie extraction |
| **HttpClient** | Axios-based HTTP client with cookie auth, timeout control, and error classification |
| **UsageData** | Type definitions (`UsageData`, `UsageResult`, `UsageStatus`), `UsageType` enum, alert threshold constants, and utility functions |

### Data Flow

```
┌──────────────────────┐
│  User clicks status  │
│  bar or uses command │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│   ExtensionController        │
│   (coordinates all modules)  │
└──────┬───────────┬───────────┘
       │           │
       ▼           ▼
┌────────────┐  ┌──────────────┐
│ Ollama     │  │ Config        │
│ Provider   │  │ Manager      │
│            │  │              │
│ fetches &  │  │ timer prefs  │
│ parses     │  │ & settings   │
│ usage data │  │              │
└──────┬─────┘  └──────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Status Bar Manager            │
│                               │
│ ┌──────────┬───────┬───────┐ │
│ │ Label    │ S:xx% │ W:yy% │ │
│ │ (tooltip)│ (color)│(color)│ │
│ └──────────┴───────┴───────┘ │
│                               │
│ 3 items with independent     │
│ color alerts per usage type  │
└──────────────────────────────┘
```

## 🔧 Development

### Build & Watch

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run watch

# Production build
npm run compile

# Lint
npm run lint

# Type check
npx tsc --noEmit

# One-click build & package
./build.sh
```

### Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: VSCode Extension API ≥ 1.85.0
- **Bundler**: esbuild
- **HTTP Client**: axios
- **HTML Parser**: cheerio
- **Packaging**: @vscode/vsce

### Adding a New Provider

To support additional AI platforms, create a new provider in `src/providers/` that implements the same `fetchUsage()` pattern as `ollamaProvider.ts`, and register it in `extensionController.ts`.

## 🔒 Security

- **Cookie storage**: Cookies are stored locally in VSCode's `globalState` — never written to logs or sent externally
- **HTTPS only**: All requests use HTTPS to `ollama.com`
- **No redirects**: HTTP client disables automatic redirects to prevent cookie leakage
- **Timeout protection**: Requests time out after 15 seconds
- **Clear cookie**: A dedicated command allows users to remove stored cookies at any time

## ⚠️ Limitations

- Cookie-based authentication: requires manual cookie extraction from the browser (due to cross-origin security restrictions)
- Ollama page structure may change, which could break HTML parsing — the extension uses multiple fallback strategies to handle this
- Only supports Ollama cloud platform at this time

## 🤖 AI Development Statement

This project is **entirely developed using AI Coding**. I deeply respect the open-source spirit and community. If this project involves any copyright or licensing concerns, please contact me promptly so I can modify or remove the offending content. I sincerely apologize in advance for any unintentional offense.

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 zls3434.

The [LICENSE](LICENSE) file also includes third-party license acknowledgments for all bundled and development dependencies (BSD-2-Clause, ISC, MIT, Apache-2.0).