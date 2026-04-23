# AI Usage Extension - 任务清单

> 修改日期: 2026-04-23 | 修改人: qiweizhe | 修改目的: 项目任务规划

## 任务列表

### 阶段 1: 项目脚手架搭建

- [ ] **T1.1** 使用 `yo code` 生成 VSCode 扩展项目骨架
  - 执行 `npx --package yo --package generator-code -- yo code`
  - 选择 TypeScript 项目
  - 配置扩展名称 `ai-usage-ext`
  - 设置发布者名称

- [ ] **T1.2** 安装项目依赖
  - 安装 axios（HTTP 客户端）
  - 安装 cheerio（HTML 解析）
  - 安装开发依赖（@vscode/vsce 等）

- [ ] **T1.3** 配置 TypeScript 和 esbuild
  - 配置 tsconfig.json
  - 配置 esbuild 打包
  - 创建项目文件目录结构

### 阶段 2: 核心模型和工具

- [ ] **T2.1** 创建用量数据模型 (`models/usageData.ts`)
  - 定义 `UsageData` 接口：sessionUsage, weeklyUsage, sessionResetTime, weeklyResetTime, lastUpdated
  - 定义 `OllamaConfig` 接口：cookie, updateInterval, autoUpdate

- [ ] **T2.2** 创建 HTTP 客户端 (`utils/httpClient.ts`)
  - 封装 axios 请求
  - 支持 Cookie 认证头
  - 超时和错误处理
  - HTTPS 安全配置

### 阶段 3: 管理器模块

- [ ] **T3.1** 创建 Cookie 管理器 (`managers/cookieManager.ts`)
  - Cookie 存储（globalState）
  - Cookie 读取
  - Cookie 清除
  - Cookie 有效性检查

- [ ] **T3.2** 创建配置管理器 (`managers/configManager.ts`)
  - 读取/写入更新间隔配置
  - 读取/写入自动更新开关配置
  - 配置变更事件监听

- [ ] **T3.3** 创建状态栏管理器 (`managers/statusBarManager.ts`)
  - 创建状态栏项
  - 更新状态栏文本和颜色
  - 设置 Hover Tooltip
  - 右键菜单绑定

### 阶段 4: 数据提供者

- [ ] **T4.1** 创建 Ollama 提供者 (`providers/ollamaProvider.ts`)
  - 请求 ollama.com/settings 页面
  - 携带 Cookie 认证
  - 解析 HTML 提取用量数据
  - 尝试 JSON API 回退策略
  - 错误处理和重试逻辑

### 阶段 5: 主控制器和扩展入口

- [ ] **T5.1** 创建扩展控制器 (`controllers/extensionController.ts`)
  - 初始化各模块
  - 启动/停止定时器
  - 协调数据获取和显示更新
  - 处理命令调用

- [ ] **T5.2** 实现扩展入口 (`extension.ts`)
  - activate() 函数
  - deactivate() 函数
  - 注册命令
  - 释放资源

- [ ] **T5.3** 配置 package.json
  - 注册命令
  - 注册配置项
  - 注册菜单项
  - 设置激活事件

### 阶段 6: 右键菜单和命令

- [ ] **T6.1** 实现右键菜单功能
  - 开启/关闭自动更新
  - 修改更新频率（QuickPick 选择）
  - 设置 Cookie（InputBox）
  - 立即刷新
  - 打开 Ollama 设置页（外部浏览器）

### 阶段 7: 打包和测试

- [ ] **T7.1** 编译和打包
  - 执行 `npm run compile`
  - 执行 `npx vsce package`
  - 生成 .vsix 文件

- [ ] **T7.2** 在 Trae CN 中安装测试
  - 从 VSIX 安装到 Trae CN
  - 验证基本功能
  - 验证状态栏显示
  - 验证右键菜单
  - 验证定时更新