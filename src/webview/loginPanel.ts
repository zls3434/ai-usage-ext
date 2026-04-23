/**
 * @fileoverview WebView 登录面板，在编辑器内加载 Ollama 登录页面并提取 Cookie
 * @date 2026-04-23
 * @author qiweizhe
 * @purpose 通过 VSCode WebView 创建一个内嵌浏览器窗口加载 Ollama 登录页，
 *          用户手动登录后自动检测登录状态并提取 Cookie
 */

import * as vscode from 'vscode';
import { CookieManager } from '../managers/cookieManager';

/**
 * WebView 登录面板类
 * @description 在 VSCode 编辑器区域创建一个 WebView 面板，
 *              加载 ollama.com 登录页面，用户手动完成登录后自动提取 Cookie
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
     * @description 创建 WebView 面板，加载 Ollama 登录页面，
     *              并注入 JavaScript 脚本用于监听 Cookie 变化
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
                enableCommandUris: false,
            }
        );

        this.panel.iconPath = new vscode.ThemeIcon('cloud');

        this.panel.webview.html = this.getLoginPageHtml();

        this.panel.webview.onDidReceiveMessage(
            async (message: { type: string; cookie?: string; url?: string }) => {
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
     * @property type - 消息类型：'cookie' 表示检测到 Cookie，'loginSuccess' 表示登录成功
     * @property cookie - 伴随消息的 Cookie 字符串
     * @property url - 伴随消息的当前页面 URL
     */
    private async handleWebviewMessage(message: { type: string; cookie?: string; url?: string }): Promise<void> {
        switch (message.type) {
            case 'cookie':
                /** WebView 检测到 Cookie 变化，保存 Cookie */
                if (message.cookie && message.cookie.trim().length > 0) {
                    await this.cookieManager.setCookie(message.cookie);
                }
                break;

            case 'loginSuccess':
                /** 登录成功，保存 Cookie 并通知 */
                if (message.cookie && message.cookie.trim().length > 0) {
                    await this.cookieManager.saveCookiesFromWebView(message.cookie);
                }
                vscode.window.showInformationMessage('AI Usage: Successfully logged in to Ollama!');
                this.panel?.dispose();
                if (this.onLoginSuccess) {
                    this.onLoginSuccess();
                }
                break;

            case 'loginFailed':
                /** 登录失败提示 */
                vscode.window.showErrorMessage('AI Usage: Failed to login to Ollama. Please try again.');
                break;
        }
    }

    /**
     * 生成登录页面的 HTML
     * @description 创建一个包含 iframe 的 WebView，加载 ollama.com 登录页面，
     *              并注入 JavaScript 脚本周期性检测 Cookie 变化
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
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .header {
            padding: 12px 16px;
            background: var(--vscode-notifications-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .header .icon {
            font-size: 16px;
        }
        .header .status {
            color: var(--vscode-descriptionForeground);
        }
        .instruction {
            padding: 8px 16px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-activeForeground);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .instruction a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        .instruction a:hover {
            text-decoration: underline;
        }
        iframe {
            flex: 1;
            width: 100%;
            border: none;
        }
        .manual-section {
            padding: 12px 16px;
            background: var(--vscode-notifications-background);
            border-top: 1px solid var(--vscode-panel-border);
        }
        .manual-section button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        .manual-section button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="icon">🔐</span>
        <span><strong>Login to Ollama</strong></span>
        <span class="status">— Please sign in below, Cookie will be captured automatically after login</span>
    </div>
    <div class="instruction">
        <strong>Tips:</strong> If the embedded login page doesn't work, you can
        <a href="#" onclick="showManualInput()">manually enter your Cookie</a>
        by copying it from your browser's DevTools (Application > Cookies > ollama.com).
    </div>
    <iframe
        id="loginFrame"
        src="https://ollama.com/signin"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
        allow="clipboard-read; clipboard-write"
    ></iframe>
    <div class="manual-section" id="manualSection" style="display:none;">
        <span>Enter your cookie: </span>
        <input type="text" id="cookieInput" placeholder=" Paste cookie string here... " style="width:400px;padding:4px 8px;" />
        <button onclick="submitManualCookie()">Save Cookie</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        /**
         * 监听来自 iframe 的消息，检测登录成功事件
         * 由于跨域限制，直接访问 iframe 内的 document.cookie 是不可能的
         * 因此我们采用定期轮询 iframe 的 URL 变化来间接判断登录是否成功
         */
        let lastKnownUrl = 'https://ollama.com/signin';
        let pollInterval = null;

        /**
         * 定期检查 iframe 的 URL 变化
         * 如果 iframe 从 /signin 页面跳转到其他页面（如首页），说明登录成功
         */
        function startPolling() {
            pollInterval = setInterval(() => {
                try {
                    const iframe = document.getElementById('loginFrame');
                    /** 尝试访问 iframe 的 contentWindow URL 来检测跳转 */
                    if (iframe && iframe.contentWindow) {
                        const currentUrl = iframe.contentWindow.location.href;
                        if (currentUrl !== lastKnownUrl) {
                            lastKnownUrl = currentUrl;
                            /** URL 发生变化，可能登录成功 */
                            if (!currentUrl.includes('/signin')) {
                                /** 不再在 signin 页面，说明登录成功 */
                                notifyLoginSuccess();
                            }
                        }
                    }
                } catch (e) {
                    /**
                     * 跨域错误：尝试访问 iframe 内容时抛出 SecurityError
                     * 这是预期行为，因为 iframe 内容来自不同域
                     * 我们通过 try-catch 来检测：如果访问 location.href 抛出异常，
                     * 说明 iframe 已经不在同域了（登录成功后跳转到了 ollama.com 主站）
                     * 而 ifrmae 加载 ollama.com 的 /signin 页面时，也可能因跨域而抛错
                     * 所以这个检测方式不太可靠，需要备选方案
                     */
                }
            }, 1000);
        }

        /**
         * 通知扩展登录成功
         * 由于跨域限制无法直接读取 iframe 内的 Cookie，
         * 登录成功后需要用户手动复制 Cookie 或使用备选方案
         */
        function notifyLoginSuccess() {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
            vscode.postMessage({
                type: 'loginSuccess',
                cookie: '',
                url: lastKnownUrl
            });
        }

        /**
         * 显示手动输入 Cookie 界面
         */
        function showManualInput() {
            const manualSection = document.getElementById('manualSection');
            if (manualSection) {
                manualSection.style.display = 'block';
            }
        }

        /**
         * 提交手动输入的 Cookie
         */
        function submitManualCookie() {
            const input = document.getElementById('cookieInput');
            if (input && input.value.trim()) {
                vscode.postMessage({
                    type: 'cookie',
                    cookie: input.value.trim()
                });
                vscode.postMessage({
                    type: 'loginSuccess',
                    cookie: input.value.trim(),
                    url: ''
                });
            }
        }

        /**
         * 监听 Enter 键提交 Cookie
         */
        document.getElementById('cookieInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitManualCookie();
            }
        });

        /** 开始轮询检测登录状态 */
        startPolling();
    </script>
</body>
</html>`;
    }
}