/**
 * @fileoverview 状态栏管理器，负责在 VSCode 底部状态栏中展示用量信息
 * @date 2026-04-23
 * @author zls3434
 * @purpose 管理状态栏项的创建、更新、颜色和 Tooltip
 * @modified 2026-04-23 - 将右键菜单改为左键点击显示自定义 QuickPick 菜单
 */

import * as vscode from 'vscode';
import { UsageResult, UsageStatus, formatResetTime } from '../models/usageData';

/**
 * 状态栏管理器类
 * @description 负责状态栏 UI 元素的生命周期管理和数据显示
 *              左键点击状态栏项弹出 QuickPick 菜单，提供所有操作选项
 */
export class StatusBarManager {
    /** VSCode 状态栏项 */
    private statusBarItem: vscode.StatusBarItem;

    /** 上一次的用量数据，用于 Tooltip 显示 */
    private lastResult: UsageResult | undefined;

    /**
     * 创建状态栏管理器
     * @param priority - 状态栏项优先级，值越大越靠左
     */
    constructor(priority: number = 100) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            priority
        );
        this.statusBarItem.name = 'AI Usage Monitor';
        /** 左键点击状态栏项弹出自定义菜单 */
        this.statusBarItem.command = 'aiUsage.showMenu';
        this.showLoading();
        this.statusBarItem.show();
    }

    /**
     * 显示加载状态
     * @description 在数据未就绪时显示加载中的指示
     */
    showLoading(): void {
        this.statusBarItem.text = '$(cloud~download) Ollama: ...';
        this.statusBarItem.tooltip = 'AI Usage: Loading...';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * 显示未设置 Cookie 状态
     * @description 提示用户需要先登录 Ollama
     */
    showNoCookie(): void {
        this.statusBarItem.text = '$(key) Ollama: Login';
        this.statusBarItem.tooltip = 'AI Usage: Click to login to Ollama';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        /** 未设置 Cookie 时，左键点击直接弹出菜单（菜单中有登录选项） */
        this.statusBarItem.command = 'aiUsage.showMenu';
    }

    /**
     * 显示错误状态
     * @param message - 错误信息
     */
    showError(message: string): void {
        this.statusBarItem.text = '$(error) Ollama: Error';
        this.statusBarItem.tooltip = `AI Usage: ${message}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.command = 'aiUsage.showMenu';
    }

    /**
     * 更新状态栏显示的用量数据
     * @param result - 用量数据结果
     */
    updateUsage(result: UsageResult): void {
        this.lastResult = result;

        switch (result.status) {
            case UsageStatus.Loading:
                this.showLoading();
                return;
            case UsageStatus.NoCookie:
                this.showNoCookie();
                return;
            case UsageStatus.Error:
                this.showError(result.errorMessage || 'Unknown error');
                return;
            case UsageStatus.Normal:
                this.updateNormalDisplay(result);
                return;
        }
    }

    /**
     * 更新正常状态下的显示内容
     * @param result - 包含有效用量数据的结果
     */
    private updateNormalDisplay(result: UsageResult): void {
        if (!result.data) {
            this.showError('No data available');
            return;
        }

        const { sessionUsagePercent, weeklyUsagePercent, sessionResetDate, weeklyResetDate, lastUpdated } = result.data;

        /** 构建状态栏文本 — 使用空格和分隔符提高数字可读性 */
        this.statusBarItem.text = `$(cloud) Ollama S: ${sessionUsagePercent}%  W: ${weeklyUsagePercent}%`;

        /** 根据用量级别设置颜色 */
        const maxUsage = Math.max(sessionUsagePercent, weeklyUsagePercent);
        this.statusBarItem.backgroundColor = this.getUsageBackgroundColor(maxUsage);

        /** 左键点击弹出菜单 */
        this.statusBarItem.command = 'aiUsage.showMenu';

        /** 构建 Hover Tooltip */
        const lines: string[] = [
            'Ollama Cloud Usage',
            '────────────────────',
        ];

        lines.push(`Session (5h): ${sessionUsagePercent}% used`);
        if (sessionResetDate) {
            const remaining = sessionResetDate.getTime() - Date.now();
            lines.push(`  Reset in: ${formatResetTime(remaining)}`);
        }

        lines.push('');
        lines.push(`Weekly: ${weeklyUsagePercent}% used`);
        if (weeklyResetDate) {
            const remaining = weeklyResetDate.getTime() - Date.now();
            lines.push(`  Reset in: ${formatResetTime(remaining)}`);
        }

        lines.push('────────────────────');

        const timeStr = lastUpdated.toLocaleTimeString();
        lines.push(`Last updated: ${timeStr}`);

        this.statusBarItem.tooltip = lines.join('\n');
    }

    /**
     * 根据用量百分比获取背景颜色
     * @param percent - 用量百分比（0-100）
     * @returns VSCode 主题颜色或 undefined
     */
    private getUsageBackgroundColor(percent: number): vscode.ThemeColor | undefined {
        if (percent >= 80) {
            return new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        if (percent >= 50) {
            return new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        return undefined;
    }

    /**
     * 获取状态栏项的销毁函数
     * @returns 状态栏项的 Disposable 对象
     */
    getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }

    /**
     * 获取上一次的用量数据
     * @returns 上一次的用量结果，可能为 undefined
     */
    getLastResult(): UsageResult | undefined {
        return this.lastResult;
    }

    /**
     * 销毁状态栏管理器，释放资源
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}