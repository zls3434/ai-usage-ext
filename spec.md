# AI Usage Extension - 规格说明文档

> 修改日期: 2026-04-23 | 修改人: qiweizhe | 修改目的: 项目初始规格定义

## 1. 项目概述

### 1.1 项目名称

AI Usage Extension (ai-usage-ext)

### 1.2 项目目标

开发一个 VSCode/Trae CN 扩展插件，用于获取云端 AI 平台的 API 用量信息，并在编辑器底部状态栏中实时显示。当前优先实现 Ollama 平台的用量获取。

### 1.3 项目背景

Ollama 云平台对每个用户有 session limits（每5小时重置）和 weekly limits（每7天重置）的用量限制，用户需要方便地了解当前使用量及重置时间，避免在开发过程中突然达到限制。

### 1.4 核心价值

- 实时监控 Ollama 云平台用量，避免开发中断
- 直观展示用量百分比和重置倒计时
- 便捷的开关控制和频率调整

## 2. 技术架构

### 2.1 技术栈

- **开发框架**: VSCode Extension API (TypeScript)
- **构建工具**: esbuild (通过 yo code 脚手架生成)
- **打包工具**: @vscode/vsce
- **HTTP 请求**: Node.js 内置 https/http 模块或 axios
- **数据存储**: VSCode ExtensionContext.globalState（持久化 cookies 和配置）
- **浏览器自动化**: VSCode WebView 加载 Ollama 登录页面，用户手动登录后自动提取 Cookie

### 2.2 架构设计

```
┌─────────────────────────────────────────────┐
│              VSCode Extension               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │ StatusBar   │    │  Context Menu     │   │
│  │ (UI Layer)  │    │  (右键菜单)       │   │
│  └──────┬──────┘    └────────┬─────────┘   │
│         │                    │              │
│  ┌──────▼────────────────────▼─────────┐   │
│  │        Extension Controller        │   │
│  │    (协调 UI、数据、定时器)          │   │
│  └──────┬────────────────────┬────────┘   │
│         │                    │              │
│  ┌──────▼────────┐   ┌──────▼──────────┐  │
│  │  Ollama        │   │  Config Manager │  │
│  │  Provider      │   │  (配置管理)      │  │
│  │  (数据获取)     │   │                  │  │
│  └──────┬────────┘   └─────────────────┘  │
│         │                                    │
│  ┌──────▼────────┐                         │
│  │  Cookie        │                         │
│  │  Manager       │                         │
│  │  (Cookie管理)  │                         │
│  └──────┬────────┘                         │
│         │                                    │
│  ┌──────▼────────┐                         │
│  │  Ollama.com    │                         │
│  │  (Web Server)  │                         │
│  └────────────────┘                         │
│                                             │
└─────────────────────────────────────────────┘
```

### 2.3 数据流

```
用户登录 ollama.com → 手动复制 cookies → 粘贴到插件配置
                                                    ↓
定时器触发 → OllamaProvider.fetchUsage() → HTTPS 请求 ollama.com/settings
                                                    ↓
解析 HTML/JSON → 提取用量数据 → 更新 StatusBar 显示
```

## 3. 功能规格

### 3.1 Cookie 管理

#### 3.1.1 Cookie 输入

- **方式**: 用户手动从浏览器复制 Cookie 并粘贴到插件设置中
- **理由**: VSCode 扩展无法直接操作浏览器登录界面，手动方式最稳定可靠
- **配置入口**:
  - 命令面板输入 `AI Usage: Set Ollama Cookie`
  - 右键状态栏菜单选择 "设置 Cookie"
- **存储**: 使用 `globalState` 持久化存储，加密敏感信息
- **Cookie 字段**: 需要完整的 `cookie` 字符串（从浏览器 DevTools 中复制）

#### 3.1.2 Cookie 有效性验证

- 设置 Cookie 后立即发起一次请求验证
- 如果验证失败，在状态栏显示警告图标
- Cookie 过期时自动提示用户更新

### 3.2 用量数据获取

#### 3.2.1 数据源

- **URL**: `https://ollama.com/settings` 页面
- **请求方式**: HTTPS GET，携带用户 Cookie
- **备选**: 尝试 `/api/me` 接口（如果可用，见 GitHub issue #12532）

#### 3.2.2 数据解析

从 ollama.com/settings 页面提取以下信息：

- **5小时 Session 用量**: 当前 session 已用百分比
- **Weekly 用量**: 当前周已用百分比
- **Session 重置时间**: 距离下次重置的剩余时间
- **Weekly 重置时间**: 距离周重置的剩余时间

> 注意: 页面结构可能变化，需要建立弹性解析策略。优先尝试 JSON API，回退到 HTML 解析。

#### 3.2.3 错误处理

- 网络错误：显示最后已知数据 + 警告图标
- Cookie 过期：提示用户重新设置
- 页面结构变化：尝试多种解析策略，失败时显示原始数据

### 3.3 状态栏显示

#### 3.3.1 显示内容

状态栏显示格式：`$(cloud) Ollama: S:xx% W:yy%`

其中：

- `$(cloud)` - VSCode 内置云图标
- `S:xx%` - 5小时 Session 用量百分比
- `W:yy%` - 一周 Weekly 用量百分比

#### 3.3.2 Hover Tooltip

鼠标悬停时显示详细信息：

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

#### 3.3.3 颜色编码

- 用量 < 50%: 默认颜色（白色）
- 用量 50-80%: 黄色警告
- 用量 > 80%: 红色警告

### 3.4 右键菜单

#### 3.4.1 菜单项

右键状态栏插件区域，弹出菜单包含：

1. **开启/关闭自动更新** - 切换定时获取开关
2. **修改更新频率** - 可选：30s / 1min / 2min / 5min / 10min
3. **设置 Cookie** - 打开 Cookie 输入框
4. **立即刷新** - 手动触发一次刷新
5. **打开 Ollama 设置页** - 在浏览器中打开 ollama.com/settings

### 3.5 定时更新

#### 3.5.1 默认频率

每 1 分钟更新一次

#### 3.5.2 可配置频率

支持 30秒、1分钟、2分钟、5分钟、10分钟

#### 3.5.3 更新策略

- 启动时立即获取一次
- 之后按配置频率定时获取
- 关闭自动更新时停止定时器
- 网络错误时不重置定时器，继续按计划重试

## 4. 文件结构

```
ai-usage-ext/
├── src/
│   ├── extension.ts          # 扩展入口，激活/停用逻辑
│   ├── controllers/
│   │   └── extensionController.ts  # 主控制器，协调各模块
│   ├── providers/
│   │   └── ollamaProvider.ts       # Ollama 数据获取和解析
│   ├── managers/
│   │   ├── cookieManager.ts        # Cookie 存储和检索
│   │   ├── configManager.ts        # 配置管理（更新频率、开关等）
│   │   └── statusBarManager.ts    # 状态栏 UI 管理
│   ├── models/
│   │   └── usageData.ts           # 用量数据模型定义
│   └── utils/
│       └── httpClient.ts          # HTTP 请求封装
├── package.json              # 扩展元数据和配置
├── tsconfig.json             # TypeScript 配置
└── .vscodeignore             # 打包排除文件
```

## 5. 配置项

### 5.1 VSCode Settings (contributes.configuration)

```json
{
  "aiUsage.updateInterval": {
    "type": "number",
    "default": 60,
    "enum": [30, 60, 120, 300, 600],
    "description": "自动更新间隔（秒）"
  },
  "aiUsage.autoUpdate": {
    "type": "boolean",
    "default": true,
    "description": "是否开启自动更新"
  },
  "aiUsage.ollamaCookie": {
    "type": "string",
    "default": "",
    "description": "Ollama 平台的 Cookie（从浏览器复制）"
  }
}
```

### 5.2 VSCode Commands (contributes.commands)

```json
{
  "commands": [
    { "command": "aiUsage.setCookie", "title": "AI Usage: Set Ollama Cookie" },
    { "command": "aiUsage.toggleAutoUpdate", "title": "AI Usage: Toggle Auto Update" },
    { "command": "aiUsage.setUpdateInterval", "title": "AI Usage: Set Update Interval" },
    { "command": "aiUsage.refreshNow", "title": "AI Usage: Refresh Now" },
    { "command": "aiUsage.openSettings", "title": "AI Usage: Open Ollama Settings" }
  ]
}
```

## 6. 依赖项

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.20.0",
    "@vscode/vsce": "^3.0.0"
  }
}
```

## 7. 安全考虑

### 7.1 Cookie 安全

- Cookie 是敏感信息，存储在 `globalState` 中（VSCode 内部存储）
- 不将 Cookie 写入任何日志或输出通道
- Cookie 传输仅通过 HTTPS
- 提供 "清除 Cookie" 功能

### 7.2 网络安全

- 仅请求 `ollama.com` 域名
- 强制 HTTPS
- 请求超时设置（10秒）
- 不跟随外部重定向

## 8. 打包和安装

### 8.1 打包命令

```bash
npm install
npm run compile
npx vsce package
```

### 8.2 安装到 Trae CN

1. 在 Trae CN 左侧导航栏点击插件市场图标
2. 点击右上角 `···` → 从 VSIX 安装
3. 选择生成的 `.vsix` 文件

## 9. 测试策略

### 9.1 单元测试

- OllamaProvider 的数据解析逻辑
- CookieManager 的存储和检索
- ConfigManager 的配置读写

### 9.2 集成测试

- 完整的请求-解析-显示流程
- 定时器启停
- 错误场景处理

### 9.3 手动测试

- 在 Trae CN 中安装 .vsix 文件
- 设置 Cookie → 验证数据显示
- 右键菜单功能验证
- 自动更新开关切换
- 频率修改生效验证

