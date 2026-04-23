/**
 * @fileoverview 配置管理器，负责读取和监听用户配置变更
 * @date 2026-04-23
 * @author zls3434
 * @purpose 管理 VSCode 设置中的插件配置项，包括更新频率、自动更新开关等
 */

import * as vscode from 'vscode';

/**
 * 配置管理器类
 * @description 封装 VSCode 配置 API，提供类型安全的配置读取和变更通知
 */
export class ConfigManager {
    /** VSCode 扩展上下文 */
    private context: vscode.ExtensionContext;

    /** 配置变更回调函数列表 */
    private onConfigChangeCallbacks: (() => void)[] = [];

    /** 配置节名称 */
    private static readonly SECTION = 'aiUsage';

    /**
     * 创建配置管理器实例
     * @param context - VSCode 扩展上下文
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerConfigChangeListener();
    }

    /**
     * 注册 VSCode 配置变更监听器
     * @description 监听 aiUsage 配置节下的所有配置变更
     */
    private registerConfigChangeListener(): void {
        const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(ConfigManager.SECTION)) {
                this.notifyConfigChange();
            }
        });
        this.context.subscriptions.push(disposable);
    }

    /**
     * 获取更新间隔（秒）
     * @returns 更新间隔秒数，默认 60 秒
     */
    getUpdateInterval(): number {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        return config.get<number>('updateInterval', 60);
    }

    /**
     * 获取是否自动更新
     * @returns 是否自动更新，默认 true
     */
    getAutoUpdate(): boolean {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        return config.get<boolean>('autoUpdate', true);
    }

    /**
     * 设置自动更新开关
     * @param enabled - 是否启用自动更新
     * @returns Promise<void>
     */
    async setAutoUpdate(enabled: boolean): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        await config.update('autoUpdate', enabled, vscode.ConfigurationTarget.Global);
    }

    /**
     * 设置更新间隔
     * @param seconds - 更新间隔秒数
     * @returns Promise<void>
     */
    async setUpdateInterval(seconds: number): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        await config.update('updateInterval', seconds, vscode.ConfigurationTarget.Global);
    }

    /**
     * 注册配置变更回调
     * @param callback - 配置变更时调用的函数
     * @returns 销毁函数，调用可移除回调
     */
    onConfigChange(callback: () => void): () => void {
        this.onConfigChangeCallbacks.push(callback);
        return () => {
            const index = this.onConfigChangeCallbacks.indexOf(callback);
            if (index >= 0) {
                this.onConfigChangeCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * 通知所有注册的配置变更回调
     */
    private notifyConfigChange(): void {
        for (const callback of this.onConfigChangeCallbacks) {
            try {
                callback();
            } catch {
                // 忽略回调执行中的错误
            }
        }
    }

    /**
     * 销毁配置管理器，清理监听器
     */
    dispose(): void {
        this.onConfigChangeCallbacks = [];
    }
}