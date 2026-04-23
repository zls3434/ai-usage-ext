[English](./README.md) | **中文**

# 🦙 AI Usage Monitor

> 在 VSCode/Trae CN 状态栏中实时监控云端 AI 平台 API 用量。当前支持 **Ollama**。

## ✨ 功能特性

- **实时用量监控** — 在状态栏中显示 Ollama 会话（5小时）和周用量的百分比
- **颜色编码告警** — 视觉警告：正常（<50%）、黄色警告（50-80%）、红色告警（>80%）
- **悬停提示框** — 鼠标悬停查看详细用量信息和重置倒计时
- **QuickPick 菜单** — 左键点击状态栏图标即可弹出操作菜单，方便快捷
- **自动/手动刷新** — 可配置自动更新间隔（30秒/1分钟/2分钟/5分钟/10分钟），也支持手动刷新
- **Ollama 登录** — 内置 WebView 登录面板，提供分步 Cookie 提取指引
- **手动输入 Cookie** — 备选方式，可直接从 DevTools 中粘贴 Cookie
- **安全存储** — Cookie 通过 `globalState` 本地存储，绝不发送给第三方服务

## 📸 预览

### 状态栏显示

```
$(cloud) Ollama S: 45%  W: 30%
```

- **S: xx%** — 当前 5 小时会话用量百分比
- **W: yy%** — 当周用量百分比

### 悬停提示框

```
Ollama Cloud Usage
────────────────────
Session (5h): 45% used
  Reset in: 2h 30m

Weekly: 30% used
  Reset in: 3d 12h
────────────────────
Last updated: 14:30:00
```

## 🚀 快速开始

### 前置条件

- **VSCode** ≥ 1.85.0 或 **Trae CN**（兼容 IDE）
- 一个 **Ollama** 账号（在 [ollama.com](https://ollama.com) 注册）

### 安装方式

#### 方式一：从 VSIX 安装

1. 下载或构建 `.vsix` 文件
2. 打开 VSCode/Trae CN
3. 进入扩展面板 → 点击 `···` → **从 VSIX 安装...**
4. 选择 `.vsix` 文件

#### 方式二：从源码构建

```bash
# 克隆仓库
git clone <repository-url>
cd ai-usage-ext

# 安装依赖
npm install

# 编译
npm run compile

# 打包为 VSIX
npx vsce package --allow-missing-repository
```

或使用一键构建脚本：

```bash
chmod +x build.sh
./build.sh
```

构建脚本将执行以下步骤：
1. 安装依赖
2. 运行 TypeScript 类型检查
3. 使用 esbuild 编译
4. 打包为 `.vsix` 文件

### 首次配置

1. 安装后，插件会在启动时自动激活
2. 状态栏将显示 `$(key) Ollama: Login`
3. 点击状态栏图标（或通过命令面板执行 `AI Usage: Login Ollama`）
4. 按照 WebView 引导获取 Ollama Cookie：
   - 点击 **"Open Sign-in Page"** 在浏览器中登录 Ollama
   - 打开 DevTools（F12 或 Cmd+Option+I）
   - 进入 **Application → Cookies** 或 **Network 标签 → 请求头**
   - 复制完整的 Cookie 字符串，粘贴到输入框中
5. 保存后，用量数据将在几秒内显示在状态栏

## 📖 命令列表

| 命令 | 说明 |
|------|------|
| `AI Usage: Show Menu` | 打开 QuickPick 菜单，提供所有可用操作 |
| `AI Usage: Login Ollama` | 打开 WebView 登录面板 |
| `AI Usage: Set Ollama Cookie (Manual)` | 通过输入框手动输入 Cookie |
| `AI Usage: Clear Ollama Cookie` | 清除已保存的 Cookie |
| `AI Usage: Toggle Auto Update` | 开启/关闭自动用量刷新 |
| `AI Usage: Set Update Interval` | 选择刷新频率（30秒/1分钟/2分钟/5分钟/10分钟） |
| `AI Usage: Refresh Now` | 立即获取最新用量数据 |
| `AI Usage: Open Ollama Settings` | 在浏览器中打开 ollama.com/settings |

## ⚙️ 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `aiUsage.autoUpdate` | `boolean` | `true` | 是否开启自动用量数据刷新 |
| `aiUsage.updateInterval` | `number` | `60` | 自动更新间隔（秒），可选值：30/60/120/300/600 |

## 🏗️ 架构设计

### 项目结构

```
ai-usage-ext/
├── src/
│   ├── extension.ts                # 扩展入口（激活/停用）
│   ├── controllers/
│   │   └── extensionController.ts  # 核心控制器—协调各模块
│   ├── providers/
│   │   └── ollamaProvider.ts       # Ollama 数据获取与 HTML 解析
│   ├── managers/
│   │   ├── cookieManager.ts        # Cookie 存储、检索与变更通知
│   │   ├── configManager.ts        # VSCode 配置管理与变更监听
│   │   └── statusBarManager.ts     # 状态栏 UI—显示、颜色、提示框
│   ├── webview/
│   │   └── loginPanel.ts           # WebView 登录面板及 Cookie 提取引导
│   ├── models/
│   │   └── usageData.ts           # 数据接口、枚举和工具函数
│   └── utils/
│       └── httpClient.ts           # HTTP 客户端封装（Cookie 认证、错误处理）
├── package.json                    # 扩展元数据、命令和配置
├── tsconfig.json                   # TypeScript 配置
├── build.sh                        # 一键构建打包脚本
├── .vscodeignore                   # VSIX 打包排除文件
└── LICENSE                         # MIT 许可证
```

### 模块职责

| 模块 | 职责 |
|------|------|
| **ExtensionController** | 核心协调器—注册命令、管理定时器、编排数据流 |
| **OllamaProvider** | 获取 `ollama.com/settings` 页面 HTML，通过 cheerio 解析会话/周用量和重置时间 |
| **CookieManager** | 在 `globalState` 中持久化 Cookie，提供变更通知 |
| **ConfigManager** | 读写 VSCode 配置项，触发配置变更回调 |
| **StatusBarManager** | 在状态栏中渲染用量数据，提供颜色编码告警和悬停提示框 |
| **LoginPanel** | WebView 面板，引导用户完成 Ollama 登录和 Cookie 提取 |
| **HttpClient** | 基于 Axios 的 HTTP 客户端，支持 Cookie 认证、超时控制和错误分类 |
| **UsageData** | 类型定义（`UsageData`、`UsageResult`、`UsageStatus`）和工具函数 |

### 数据流

```
┌──────────────────────┐
│  用户点击状态栏图标   │
│  或使用命令面板      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│   ExtensionController        │
│   （协调所有模块）            │
└──────┬───────────┬───────────┘
       │           │
       ▼           ▼
┌────────────┐  ┌──────────────┐
│ Ollama      │  │ Config        │
│ Provider    │  │ Manager      │
│             │  │              │
│ 获取并解析  │  │ 定时器偏好和 │
│ 用量数据    │  │ 配置设置     │
└──────┬──────┘  └──────────────┘
       │
       ▼
┌────────────────┐
│ Status Bar      │
│ Manager         │
│                 │
│ 更新显示内容、  │
│ 颜色、提示框等 │
└────────────────┘
```

## 🔧 开发

### 构建与调试

```bash
# 安装依赖
npm install

# 开发模式（监听文件变更）
npm run watch

# 生产构建
npm run compile

# 代码检查
npm run lint

# 类型检查
npx tsc --noEmit

# 一键构建打包
./build.sh
```

### 技术栈

- **开发语言**: TypeScript 5.3+
- **运行时**: VSCode Extension API ≥ 1.85.0
- **构建工具**: esbuild
- **HTTP 客户端**: axios
- **HTML 解析器**: cheerio
- **打包工具**: @vscode/vsce

### 添加新的数据提供者

如需支持更多 AI 平台，请在 `src/providers/` 中创建新的提供者，实现与 `ollamaProvider.ts` 相同的 `fetchUsage()` 模式，并在 `extensionController.ts` 中注册。

## 🔒 安全性

- **Cookie 存储**: Cookie 存储在 VSCode 的 `globalState` 中（本地存储），不会写入日志或发送给外部
- **仅限 HTTPS**: 所有请求均使用 HTTPS 协议访问 `ollama.com`
- **禁止重定向**: HTTP 客户端禁用自动重定向，防止 Cookie 泄露
- **超时保护**: 请求超时时间为 15 秒
- **清除 Cookie**: 提供专用命令，用户可随时移除已存储的 Cookie

## ⚠️ 限制

- 基于 Cookie 的认证：需要从浏览器手动提取 Cookie（受跨域安全限制影响）
- Ollama 页面结构可能变化，导致 HTML 解析失败——插件使用多层回退策略应对此问题
- 目前仅支持 Ollama 云平台

## 🤖 AI 开发声明

本项目**完全使用 AI Coding 开发**。本人无比重视与尊重开源精神，如果本项目涉及任何版权或许可问题，请及时联系本人进行修改或删除。如有冒犯，在此先行郑重致歉。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) © 2026 zls3434。

[LICENSE](LICENSE) 文件中还包含了所有打包依赖和开发依赖（BSD-2-Clause、ISC、MIT、Apache-2.0）的第三方版权声明。