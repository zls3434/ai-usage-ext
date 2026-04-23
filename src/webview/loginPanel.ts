/**
 * @fileoverview WebView 登录面板，引导用户登录 Ollama 平台并获取 Cookie
 * @date 2026-04-23
 * @author zls3434
 * @purpose 通过 WebView 展示登录指引和 Cookie 输入界面，
 *          支持在浏览器中打开登录页、手动输入 Cookie 两种方式
 * @modified 2026-04-23 - 重构登录方案：从 iframe 自动提取改为引导式手动输入
 */

import * as vscode from 'vscode';
import { CookieManager } from '../managers/cookieManager';

/**
 * WebView 登录面板类
 * @description 在 VSCode 编辑器区域创建一个 WebView 面板，
 *              展示 Ollama 登录指引和 Cookie 手动输入界面。
 *              由于浏览器跨域安全限制，无法从外部 iframe 中直接读取 Cookie，
 *              因此采用"浏览器登录 → DevTools 复制 Cookie → 粘贴到输入框"的流程。
 */
export class LoginPanel {
    /** VSCode 扩展上下文 */
    private context: vscode.ExtensionContext;

    /** Cookie 管理器实例 */
    private cookieManager: CookieManager;

    /** WebView 面板实例 */
    private panel: vscode.WebviewPanel | undefined;

    /** 登录成功回调 */
    private onLoginSuccess?: () => void;

    /**
     * 创建登录面板实例
     * @param context - VSCode 扩展上下文
     * @param cookieManager - Cookie 管理器实例
     */
    constructor(context: vscode.ExtensionContext, cookieManager: CookieManager) {
        this.context = context;
        this.cookieManager = cookieManager;
    }

    /**
     * 设置登录成功回调
     * @param callback - 登录成功后执行的回调函数
     */
    setOnLoginSuccess(callback: () => void): void {
        this.onLoginSuccess = callback;
    }

    /**
     * 显示登录 WebView 面板
     * @description 创建 WebView 面板，展示登录指引和 Cookie 输入界面
     */
    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'ollamaLogin',
            'Login to Ollama',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        this.panel.iconPath = new vscode.ThemeIcon('cloud');

        this.panel.webview.html = this.getLoginPageHtml();

        this.panel.webview.onDidReceiveMessage(
            async (message: { type: string; cookie?: string }) => {
                await this.handleWebviewMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /**
     * 处理 WebView 发来的消息
     * @param message - WebView 发送的消息对象
     * @property type - 消息类型
     * @property cookie - 伴随消息的 Cookie 字符串
     */
    private async handleWebviewMessage(message: { type: string; cookie?: string }): Promise<void> {
        switch (message.type) {
            case 'submitCookie':
                /** 用户提交了手动输入的 Cookie */
                if (message.cookie && message.cookie.trim().length > 0) {
                    await this.cookieManager.saveCookiesFromWebView(message.cookie.trim());
                    vscode.window.showInformationMessage('AI Usage: Cookie saved successfully!');
                    this.panel?.dispose();
                    if (this.onLoginSuccess) {
                        this.onLoginSuccess();
                    }
                }
                break;

            case 'openBrowser':
                /** 用户点击了在浏览器中打开登录页 */
                const uri = vscode.Uri.parse('https://ollama.com/signin');
                await vscode.env.openExternal(uri);
                break;

            case 'openSettings':
                /** 用户点击了打开 Ollama 设置页（已登录后查看用量） */
                const settingsUri = vscode.Uri.parse('https://ollama.com/settings');
                await vscode.env.openExternal(settingsUri);
                break;
        }
    }

    /**
     * 生成登录页面的 HTML
     * @description 创建登录指引页面，包含：
     *              1. 操作步骤说明
     *              2. 在浏览器中打开登录页按钮
     *              3. Cookie 输入框和提交按钮
     *              4. 如何获取 Cookie 的详细指引
     * @returns WebView 面板的 HTML 内容
     */
    private getLoginPageHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login to Ollama</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --muted: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --accent-fg: var(--vscode-button-foreground);
            --border: var(--vscode-panel-border);
            --card-bg: var(--vscode-notifications-background);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --input-fg: var(--vscode-input-foreground);
            --success: var(--vscode-testing-iconPassed, #4caf50);
            --warning: var(--vscode-editorWarning-foreground, #ff9800);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--fg);
            padding: 24px 32px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
        }

        h1 {
            font-size: 22px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        h1 .icon {
            font-size: 26px;
        }

        .subtitle {
            color: var(--muted);
            font-size: 14px;
            margin-bottom: 24px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 16px;
        }

        .card h2 {
            font-size: 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .step-list {
            list-style: none;
            counter-reset: step;
            padding-left: 0;
        }

        .step-list li {
            counter-increment: step;
            padding: 8px 8px 8px 40px;
            position: relative;
            margin-bottom: 6px;
            font-size: 13px;
            border-radius: 4px;
        }

        .step-list li::before {
            content: counter(step);
            position: absolute;
            left: 8px;
            top: 8px;
            width: 22px;
            height: 22px;
            background: var(--accent);
            color: var(--accent-fg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }

        .step-list li:nth-child(1) { background: rgba(76, 175, 80, 0.08); }
        .step-list li:nth-child(2) { background: rgba(33, 150, 243, 0.08); }
        .step-list li:nth-child(3) { background: rgba(255, 152, 0, 0.08); }
        .step-list li:nth-child(4) { background: rgba(156, 39, 176, 0.08); }

        .step-list li strong {
            color: var(--fg);
        }

        .btn-group {
            display: flex;
            gap: 10px;
            margin-top: 16px;
            flex-wrap: wrap;
        }

        button {
            background: var(--accent);
            color: var(--accent-fg);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        button:hover {
            background: var(--accent-hover);
        }

        button.secondary {
            background: transparent;
            color: var(--fg);
            border: 1px solid var(--border);
        }

        button.secondary:hover {
            background: var(--card-bg);
        }

        .cookie-input-section {
            margin-top: 16px;
        }

        .cookie-input-section label {
            font-size: 14px;
            font-weight: 600;
            display: block;
            margin-bottom: 6px;
        }

        .cookie-input-section input {
            width: 100%;
            padding: 10px 12px;
            background: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            font-size: 13px;
            font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
            margin-bottom: 10px;
        }

        .cookie-input-section input:focus {
            outline: 1px solid var(--accent);
            outline-offset: -1px;
        }

        .cookie-input-section input::placeholder {
            color: var(--muted);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .hint {
            font-size: 12px;
            color: var(--muted);
            margin-top: 4px;
            line-height: 1.5;
        }

        .hint code {
            background: var(--card-bg);
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 11px;
        }

        .screenshot-hint {
            margin-top: 12px;
            padding: 10px;
            background: rgba(33, 150, 243, 0.08);
            border-left: 3px solid rgba(33, 150, 243, 0.6);
            font-size: 12px;
            color: var(--muted);
            border-radius: 0 4px 4px 0;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--muted);
            margin-top: 8px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--success);
        }

        .error-msg {
            color: var(--vscode-errorForeground, #f44336);
            font-size: 13px;
            margin-top: 8px;
            display: none;
        }
    </style>
</head>
<body>
    <h1><span class="icon">🦙</span> Login to Ollama</h1>
    <p class="subtitle">Connect your Ollama account to monitor API usage in the status bar</p>

    <div class="card">
        <h2>📋 How to get your Cookie</h2>
        <ol class="step-list">
            <li><strong>Click "Open Sign-in Page"</strong> below to open the Ollama login page in your browser</li>
            <li><strong>Sign in</strong> to your Ollama account (GitHub/GitHub OAuth)</li>
            <li>After login, press <code>F12</code> or <code>Cmd+Option+I</code> to open <strong>Developer Tools</strong></li>
            <li>Go to <strong>Application</strong> tab &rarr; <strong>Cookies</strong> &rarr; select <code>https://ollama.com</code>, then copy <strong>all cookie values</strong> as a single string in the format: <code>name1=value1; name2=value2</code></li>
        </ol>

        <div class="screenshot-hint">
            💡 <strong>Tip:</strong> In Chrome DevTools, go to the <strong>Network</strong> tab, refresh the page, click any request to <code>ollama.com</code>, and find the <code>Cookie</code> header in the request headers. Copy its full value — that's your cookie string.
        </div>

        <div class="btn-group">
            <button onclick="openBrowser()">
                🔗 Open Sign-in Page
            </button>
            <button class="secondary" onclick="openSettings()">
                📊 Open Settings Page (after login)
            </button>
        </div>
    </div>

    <div class="card">
        <h2>🔑 Enter Cookie</h2>
        <div class="cookie-input-section">
            <label for="cookieInput">Paste your cookie string below:</label>
            <input
                type="text"
                id="cookieInput"
                placeholder="e.g. __Secure-session=xxx; aid=yyy; ..."
                spellcheck="false"
                autocomplete="off"
            />
            <div class="btn-group">
                <button onclick="submitCookie()" id="submitBtn">
                    ✅ Save Cookie & Connect
                </button>
                <button class="secondary" onclick="clearAndClose()">
                    ✕ Cancel
                </button>
            </div>
            <div id="errorMsg" class="error-msg"></div>
            <div class="status-indicator" id="statusIndicator" style="display:none;">
                <span class="status-dot"></span>
                <span id="statusText">Connecting...</span>
            </div>
        </div>
    </div>

    <div class="hint">
        ⚠️ Your cookie is stored locally in VSCode's secure storage and is never sent to any third-party service.
        It is only used to fetch usage data from <code>ollama.com/settings</code>.
        <br/><br/>
        🔄 If you encounter issues, try clearing your cookie and re-entering it. Cookie typically expires after a period of time.
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        /**
         * 在外部浏览器中打开 Ollama 登录页
         */
        function openBrowser() {
            vscode.postMessage({ type: 'openBrowser' });
        }

        /**
         * 在外部浏览器中打开 Ollama 设置页
         */
        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }

        /**
         * 提交用户输入的 Cookie
         * 包含基本的格式验证
         */
        function submitCookie() {
            const input = document.getElementById('cookieInput');
            const errorMsg = document.getElementById('errorMsg');
            const statusIndicator = document.getElementById('statusIndicator');

            /** 清除之前的错误消息 */
            errorMsg.style.display = 'none';
            errorMsg.textContent = '';
            statusIndicator.style.display = 'none';

            if (!input.value || input.value.trim().length === 0) {
                errorMsg.textContent = '⚠️ Please enter your cookie string.';
                errorMsg.style.display = 'block';
                input.focus();
                return;
            }

            /** 基本格式验证：Cookie 应该包含键值对 */
            const cookieValue = input.value.trim();
            if (!cookieValue.includes('=')) {
                errorMsg.textContent = '⚠️ Invalid cookie format. It should look like: name1=value1; name2=value2';
                errorMsg.style.display = 'block';
                input.focus();
                return;
            }

            /** 显示连接指示器 */
            statusIndicator.style.display = 'inline-flex';
            document.getElementById('statusText').textContent = 'Saving cookie...';

            /** 发送 Cookie 到扩展 */
            vscode.postMessage({
                type: 'submitCookie',
                cookie: cookieValue
            });
        }

        /**
         * 取消并关闭面板
         */
        function clearAndClose() {
            vscode.postMessage({ type: 'cancel' });
        }

        /**
         * 监听 Enter 键提交 Cookie
         */
        document.getElementById('cookieInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitCookie();
            }
        });

        /** 自动聚焦到 Cookie 输入框 */
        window.addEventListener('load', () => {
            document.getElementById('cookieInput').focus();
        });
    </script>
</body>
</html>`;
    }
}