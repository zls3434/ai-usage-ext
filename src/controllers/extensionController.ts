/**
 * @fileoverview 扩展主控制器，协调各模块之间的交互
 * @date 2026-04-23
 * @author qiweizhe
 * @purpose 作为插件核心协调器，管理定时器、命令注册、状态栏更新和数据获取的完整流程
 */

import * as vscode from 'vscode';
import { CookieManager } from '../managers/cookieManager';
import { ConfigManager } from '../managers/configManager';
import { StatusBarManager } from '../managers/statusBarManager';
import { OllamaProvider } from '../providers/ollamaProvider';
import { LoginPanel } from '../webview/loginPanel';
import { UsageStatus, UPDATE_INTERVALS } from '../models/usageData';

/**
 * 扩展控制器类
 * @description 插件的核心协调器，负责：
 *              1. 初始化和管理所有子模块
 *              2. 注册和处理 VSCode 命令
 *              3. 管理定时更新逻辑
 *              4. 协调数据获取和状态栏显示
 */
export class ExtensionController {
    /** VSCode 扩展上下文 */
    private context: vscode.ExtensionContext;

    /** Cookie 管理器 */
    private cookieManager: CookieManager;

    /** 配置管理器 */
    private configManager: ConfigManager;

    /** 状态栏管理器 */
    private statusBarManager: StatusBarManager;

    /** Ollama 数据提供者 */
    private ollamaProvider: OllamaProvider;

    /** 定时器句柄 */
    private updateTimer: ReturnType<typeof setInterval> | undefined;

    /** 是否正在执行刷新操作 */
    private isRefreshing: boolean = false;

    /** WebView 登录面板 */
    private loginPanel: LoginPanel;

    /**
     * 创建扩展控制器
     * @param context - VSCode 扩展上下文
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        /** 初始化各模块 */
        this.cookieManager = new CookieManager(context);
        this.configManager = new ConfigManager(context);
        this.statusBarManager = new StatusBarManager(100);
        this.ollamaProvider = new OllamaProvider(this.cookieManager.getCookie());
        this.loginPanel = new LoginPanel(context, this.cookieManager);

        /** 设置登录成功回调 */
        this.loginPanel.setOnLoginSuccess(() => {
            this.refreshUsage();
        });

        /** 监听 Cookie 变更 */
        this.cookieManager.onCookieChange((cookie: string) => {
            this.ollamaProvider.updateCookie(cookie);
            this.refreshUsage();
        });

        /** 监听配置变更 */
        this.configManager.onConfigChange(() => {
            this.restartTimer();
        });

        /** 注册所有命令 */
        this.registerCommands();

        /** 设置状态栏上下文（用于右键菜单 when 条件） */
        vscode.commands.executeCommand('setContext', 'aiUsageStatusBarItem', true);
    }

    /**
     * 注册所有 VSCode 命令
     */
    private registerCommands(): void {
        const commands: [string, () => Promise<void> | void][] = [
            ['aiUsage.loginOllama', () => this.loginOllama()],
            ['aiUsage.setCookie', () => this.setCookieManual()],
            ['aiUsage.clearCookie', () => this.clearCookie()],
            ['aiUsage.toggleAutoUpdate', () => this.toggleAutoUpdate()],
            ['aiUsage.setUpdateInterval', () => this.setUpdateInterval()],
            ['aiUsage.refreshNow', () => this.refreshUsage()],
            ['aiUsage.openSettings', () => this.openOllamaSettings()],
        ];

        for (const [command, handler] of commands) {
            const disposable = vscode.commands.registerCommand(command, handler);
            this.context.subscriptions.push(disposable);
        }
    }

    /**
     * 启动扩展
     * @description 初始化时立即获取一次数据，然后启动定时器
     */
    async start(): Promise<void> {
        /** 初始状态检查 */
        if (!this.cookieManager.hasCookie()) {
            this.statusBarManager.showNoCookie();
        }

        /** 首次获取数据 */
        await this.refreshUsage();

        /** 启动定时更新 */
        this.startTimer();
    }

    /**
     * 启动定时更新器
     */
    private startTimer(): void {
        this.stopTimer();

        if (!this.configManager.getAutoUpdate()) {
            return;
        }

        const interval = this.configManager.getUpdateInterval();
        this.updateTimer = setInterval(
            () => this.refreshUsage(),
            interval * 1000
        );
    }

    /**
     * 停止定时更新器
     */
    private stopTimer(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
    }

    /**
     * 重启定时更新器（配置变更时调用）
     */
    private restartTimer(): void {
        this.startTimer();
    }

    /**
     * 刷新用量数据
     * @description 从 Ollama 获取最新用量数据并更新状态栏
     */
    async refreshUsage(): Promise<void> {
        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;

        try {
            const result = await this.ollamaProvider.fetchUsage();
            this.statusBarManager.updateUsage(result);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.statusBarManager.updateUsage({
                status: UsageStatus.Error,
                errorMessage: message,
            });
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * 打开 Ollama 登录页面（WebView 方式）
     */
    async loginOllama(): Promise<void> {
        await this.loginPanel.show();
    }

    /**
     * 手动输入 Cookie
     */
    async setCookieManual(): Promise<void> {
        const cookie = await this.cookieManager.showCookieInputDialog();
        if (cookie) {
            vscode.window.showInformationMessage('AI Usage: Cookie set successfully. Refreshing data...');
            await this.refreshUsage();
        }
    }

    /**
     * 清除保存的 Cookie
     */
    async clearCookie(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'AI Usage: Are you sure you want to clear the Ollama cookie?',
            { modal: true },
            'Clear Cookie'
        );

        if (confirm === 'Clear Cookie') {
            await this.cookieManager.clearCookie();
            this.statusBarManager.showNoCookie();
            vscode.window.showInformationMessage('AI Usage: Cookie cleared.');
        }
    }

    /**
     * 切换自动更新开关
     */
    async toggleAutoUpdate(): Promise<void> {
        const currentAutoUpdate = this.configManager.getAutoUpdate();
        await this.configManager.setAutoUpdate(!currentAutoUpdate);

        if (!currentAutoUpdate) {
            /** 刚才原来是关闭的，现在打开了 */
            this.startTimer();
            vscode.window.showInformationMessage('AI Usage: Auto update enabled.');
        } else {
            /** 刚才原来是打开的，现在关闭了 */
            this.stopTimer();
            vscode.window.showInformationMessage('AI Usage: Auto update disabled.');
        }
    }

    /**
     * 设置更新间隔
     */
    async setUpdateInterval(): Promise<void> {
        const items = UPDATE_INTERVALS.map((interval) => ({
            label: interval.label,
            description: `Update every ${interval.label.toLowerCase()}`,
            value: interval.value,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: 'AI Usage: Select Update Interval',
            placeHolder: 'Choose how often to refresh usage data',
        });

        if (selected) {
            await this.configManager.setUpdateInterval(selected.value);
            vscode.window.showInformationMessage(`AI Usage: Update interval set to ${selected.label.toLowerCase()}.`);
        }
    }

    /**
     * 在浏览器中打开 Ollama 设置页面
     */
    async openOllamaSettings(): Promise<void> {
        const uri = vscode.Uri.parse('https://ollama.com/settings');
        await vscode.env.openExternal(uri);
    }

    /**
     * 销毁控制器，清理所有资源
     */
    dispose(): void {
        this.stopTimer();
        this.statusBarManager.dispose();
        this.configManager.dispose();
    }
}