/**
 * @fileoverview Cookie 管理器，负责 Cookie 的存储、检索和 WebView 登录
 * @date 2026-04-23
 * @author zls3434
 * @purpose 管理 Ollama 平台的 Cookie，支持 WebView 登录自动提取和手动设置两种方式
 */

import * as vscode from 'vscode';

/**
 * Cookie 存储键名
 * @description globalState 中存储 Cookie 的键
 */
const COOKIE_STORAGE_KEY = 'aiUsage.ollamaCookie';

/**
 * Cookie 管理器类
 * @description 负责 Cookie 的持久化存储、检索和验证
 * 支持 WebView 登录自动提取和手动输入两种方式获取 Cookie
 */
export class CookieManager {
    /** VSCode 扩展上下文，用于访问 globalState 持久化存储 */
    private context: vscode.ExtensionContext;

    /** 当前存储的 Cookie 字符串 */
    private cookie: string;

    /** Cookie 变更回调函数列表 */
    private onCookieChangeCallbacks: ((cookie: string) => void)[] = [];

    /**
     * 创建 Cookie 管理器实例
     * @param context - VSCode 扩展上下文，用于 globalState 存储
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.cookie = this.context.globalState.get<string>(COOKIE_STORAGE_KEY, '');
    }

    /**
     * 获取当前存储的 Cookie
     * @returns Cookie 字符串，可能为空
     */
    getCookie(): string {
        return this.cookie;
    }

    /**
     * 设置 Cookie 并持久化存储
     * @param cookie - 新的 Cookie 字符串
     * @returns Promise<void> 存储完成后的 Promise
     */
    async setCookie(cookie: string): Promise<void> {
        this.cookie = cookie;
        await this.context.globalState.update(COOKIE_STORAGE_KEY, cookie);
        this.notifyCookieChange(cookie);
    }

    /**
     * 清除存储的 Cookie
     * @returns Promise<void> 清除完成后的 Promise
     */
    async clearCookie(): Promise<void> {
        this.cookie = '';
        await this.context.globalState.update(COOKIE_STORAGE_KEY, '');
        this.notifyCookieChange('');
    }

    /**
     * 检查 Cookie 是否已设置
     * @returns Cookie 是否非空
     */
    hasCookie(): boolean {
        return this.cookie.length > 0;
    }

    /**
     * 注册 Cookie 变更回调
     * @param callback - Cookie 变更时调用的函数
     * @returns 销毁函数，调用可移除回调
     */
    onCookieChange(callback: (cookie: string) => void): () => void {
        this.onCookieChangeCallbacks.push(callback);
        return () => {
            const index = this.onCookieChangeCallbacks.indexOf(callback);
            if (index >= 0) {
                this.onCookieChangeCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * 通知所有注册的 Cookie 变更回调
     * @param cookie - 变更后的 Cookie 字符串
     */
    private notifyCookieChange(cookie: string): void {
        for (const callback of this.onCookieChangeCallbacks) {
            try {
                callback(cookie);
            } catch {
                // 忽略回调执行中的错误，确保所有回调都能被调用
            }
        }
    }

    /**
     * 显示手动输入 Cookie 的对话框
     * @description 打开 InputBox 让用户手动粘贴 Cookie
     * @returns 用户输入的 Cookie 字符串，取消时返回 undefined
     */
    async showCookieInputDialog(): Promise<string | undefined> {
        const cookie = await vscode.window.showInputBox({
            title: 'AI Usage: Set Ollama Cookie',
            prompt: 'Paste your cookie string from ollama.com (open DevTools > Application > Cookies)',
            placeHolder: 'e.g. __Host-session=xxx; __cf_bm=xxx',
            ignoreFocusOut: true,
            password: true,
        });

        if (cookie !== undefined && cookie.trim().length > 0) {
            await this.setCookie(cookie.trim());
            return cookie.trim();
        }

        return undefined;
    }

    /**
     * 从 WebView 登录成功后保存 Cookie
     * @description WebView 登录成功后，提取 set-cookie 头或页面数据中的 Cookie 并保存
     * @param cookies - 从 WebView 中提取的 Cookie 数组或字符串
     * @returns Promise<void>
     */
    async saveCookiesFromWebView(cookies: string): Promise<void> {
        if (cookies && cookies.trim().length > 0) {
            await this.setCookie(cookies.trim());
        }
    }
}