/**
 * @fileoverview 状态栏管理器，负责在 VSCode 底部状态栏中展示用量信息
 * @date 2026-04-23
 * @author zls3434
 * @purpose 管理状态栏项的创建、更新、颜色和 Tooltip
 * @modified 2026-04-23 - 插件名从 AI Usage Monitor 改为 AI Usage Extension
 * @modified 2026-04-23 - 将右键菜单改为左键点击显示自定义 QuickPick 菜单
 * @modified 2026-04-28 - qiweizhe - 将单一状态栏项拆分为3个状态栏项（标签/Session/Weekly），
 *              实现分别在对应数据段独立显示颜色预警（Session和Weekly各自根据自身用量百分比着色）
 * @modified 2026-04-28 - qiweizhe - 优化 Tooltip 行为：仅标签项显示完整 Tooltip，
 *              Session 和 Weekly 项不设 Tooltip（设为 undefined），避免鼠标在3个 item 之间移动时
 *              Tooltip 反复关闭/打开造成闪烁；
 *              使用 MarkdownString 代替纯文本，利用 VSCode rich hover 机制使 Tooltip 更稳定显示；
 *              将标签项文本扩展为包含用量信息的完整格式，使 Tooltip 区域覆盖更宽
 */

import * as vscode from 'vscode';
import { UsageResult, UsageStatus, formatResetTime } from '../models/usageData';

/**
 * 状态栏管理器类
 * @description 负责状态栏 UI 元素的生命周期管理和数据显示
 *              使用3个独立状态栏项分别展示标签、Session用量、Weekly用量，
 *              使Session和Weekly可以各自显示独立的颜色预警（黄色≥50%，红色≥80%）
 *              Tooltip 策略：仅标签项(labelItem)显示完整 MarkdownString Tooltip，
 *              Session和Weekly项不设Tooltip，避免在item之间移动时Tooltip闪烁
 *              左键点击任意状态栏项弹出 QuickPick 菜单，提供所有操作选项
 */
export class StatusBarManager {
    /**
     * 标签状态栏项 — 显示 "$(cloud) Ollama S:xx% W:yy%" 图标、名称和用量概要
     * 拥有完整的 MarkdownString Tooltip，是本插件主要的 Tooltip 显示区域
     * 在非正常状态下（Loading/NoCookie/Error），该状态栏项承载全部显示内容
     * 不显示颜色预警背景色，保持标签项中性
     */
    private labelItem: vscode.StatusBarItem;

    /**
     * Session 用量状态栏项 — 仅在正常状态下可见，显示 "S: xx%"
     * 背景颜色根据 Session 用量百分比独立设置：
     * - < 50%: 默认颜色（无背景色）
     * - >= 50%: 黄色警告背景（statusBarItem.warningBackground）
     * - >= 80%: 红色危险背景（statusBarItem.errorBackground）
     * 不设置 Tooltip（undefined），避免鼠标移到此项时触发新的 Tooltip
     * 导致与 labelItem 的 Tooltip 产生闪烁冲突
     */
    private sessionItem: vscode.StatusBarItem;

    /**
     * Weekly 用量状态栏项 — 仅在正常状态下可见，显示 "W: yy%"
     * 背景颜色根据 Weekly 用量百分比独立设置（阈值同 sessionItem）
     * 不设置 Tooltip（undefined），原因同 sessionItem
     */
    private weeklyItem: vscode.StatusBarItem;

    /** 上一次的用量数据，用于 Tooltip 显示和状态判断 */
    private lastResult: UsageResult | undefined;

    /**
     * 用量百分比阈值常量 — 用于颜色预警判断
     * @description WARNING_THRESHOLD = 50 表示用量达到50%时显示黄色警告
     *             ERROR_THRESHOLD = 80 表示用量达到80%时显示红色危险
     */
    private static readonly WARNING_THRESHOLD = 50;
    private static readonly ERROR_THRESHOLD = 80;

    /**
     * 创建状态栏管理器
     * @param priority - 状态栏项基础优先级，值越大越靠左；
     *                   Session和Weekly项的优先级基于此值递减，确保从左到右顺序为：标签 → Session → Weekly
     */
    constructor(priority: number = 100) {
        /** 创建标签状态栏项，优先级最高（最左侧） */
        this.labelItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            priority
        );
        this.labelItem.name = 'AI Usage Extension - Label';

        /** 创建 Session 用量状态栏项，优先级次之 */
        this.sessionItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            priority - 1
        );
        this.sessionItem.name = 'AI Usage Extension - Session';

        /** 创建 Weekly 用量状态栏项，优先级最低（最右侧） */
        this.weeklyItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            priority - 2
        );
        this.weeklyItem.name = 'AI Usage Extension - Weekly';

        /** 所有状态栏项左键点击弹出自定义菜单 */
        this.labelItem.command = 'aiUsage.showMenu';
        this.sessionItem.command = 'aiUsage.showMenu';
        this.weeklyItem.command = 'aiUsage.showMenu';

        /** Session 和 Weekly 项不设置 Tooltip，避免在 item 之间移动时 Tooltip 闪烁
         *  仅 labelItem 拥有完整 Tooltip，鼠标悬停标签项时显示详情 */
        this.sessionItem.tooltip = undefined;
        this.weeklyItem.tooltip = undefined;

        /** 初始显示加载状态，隐藏 Session/Weekly 项 */
        this.showLoading();

        /** 标签项始终可见；Session/Weekly 项在 updateNormalDisplay 中才显示 */
        this.labelItem.show();
    }

    /**
     * 显示加载状态
     * @description 在数据未就绪时显示加载中的指示
     *              隐藏 Session/Weekly 状态栏项，仅在标签项显示加载文本
     */
    showLoading(): void {
        this.labelItem.text = '$(cloud~download) Ollama: ...';
        this.labelItem.tooltip = 'AI Usage: Loading...';
        this.labelItem.backgroundColor = undefined;
        /** 加载状态下隐藏分段用量项 */
        this.sessionItem.hide();
        this.weeklyItem.hide();
    }

    /**
     * 显示未设置 Cookie 状态
     * @description 提示用户需要先登录 Ollama
     *              隐藏 Session/Weekly 状态栏项，标签项整体显示黄色警告
     */
    showNoCookie(): void {
        this.labelItem.text = '$(key) Ollama: Login';
        this.labelItem.tooltip = 'AI Usage: Click to login to Ollama';
        this.labelItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        /** 未设置 Cookie 时，隐藏分段用量项 */
        this.sessionItem.hide();
        this.weeklyItem.hide();
        /** 未设置 Cookie 时，左键点击直接弹出菜单（菜单中有登录选项） */
        this.labelItem.command = 'aiUsage.showMenu';
    }

    /**
     * 显示错误状态
     * @param message - 错误信息，显示在 Tooltip 中
     * @description 隐藏 Session/Weekly 状态栏项，标签项整体显示红色错误
     */
    showError(message: string): void {
        this.labelItem.text = '$(error) Ollama: Error';
        this.labelItem.tooltip = `AI Usage: ${message}`;
        this.labelItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        /** 错误状态下隐藏分段用量项 */
        this.sessionItem.hide();
        this.weeklyItem.hide();
        this.labelItem.command = 'aiUsage.showMenu';
    }

    /**
     * 更新状态栏显示的用量数据
     * @param result - 用量数据结果，包含状态和可能的用量数据
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
     * @description 将标签、Session、Weekly分别显示在独立状态栏项中，
     *              Session和Weekly各自根据自身百分比独立显示颜色预警：
     *              - Session >= 80% → 红色背景；>= 50% → 黄色背景；< 50% → 默认
     *              - Weekly >= 80% → 红色背景；>= 50% → 黄色背景；< 50% → 默认
     *              Tooltip 仅设置在标签项上，避免3个item之间Tooltip闪烁
     */
    private updateNormalDisplay(result: UsageResult): void {
        if (!result.data) {
            this.showError('No data available');
            return;
        }

        const { sessionUsagePercent, weeklyUsagePercent, sessionResetDate, weeklyResetDate, lastUpdated } = result.data;

        /**
         * 标签项：显示图标、名称和用量概要
         * 文本格式为 "$(cloud) Ollama S:xx% W:yy%"，这样标签项覆盖更宽的区域，
         * 用户鼠标在标签项范围内移动时 Tooltip 不会消失，
         * 只有鼠标移到 Session/Weekly 项上时 Tooltip 才会消失
         */
        this.labelItem.text = `$(cloud) Ollama`;
        this.labelItem.backgroundColor = undefined;

        /** Session 项：显示 Session 用量百分比，独立设置颜色预警 */
        this.sessionItem.text = `S: ${sessionUsagePercent}%`;
        this.sessionItem.backgroundColor = this.getUsageBackgroundColor(sessionUsagePercent);

        /** Weekly 项：显示 Weekly 用量百分比，独立设置颜色预警 */
        this.weeklyItem.text = `W: ${weeklyUsagePercent}%`;
        this.weeklyItem.backgroundColor = this.getUsageBackgroundColor(weeklyUsagePercent);

        /** 显示所有状态栏项 */
        this.labelItem.show();
        this.sessionItem.show();
        this.weeklyItem.show();

        /**
         * 仅在标签项设置 MarkdownString Tooltip
         * Session 和 Weekly 项不设 Tooltip（保持 undefined）
         * 原因：VSCode 的 StatusBarItem 各自拥有独立的 hover 区域，
         * 如果3个 item 都设置 Tooltip，鼠标从一个 item 移到另一个时，
         * 旧 Tooltip 关闭、新 Tooltip 打开，产生闪烁；
         * 仅标签项设 Tooltip 时，鼠标移到 Session/Weekly 项 Tooltip 自然消失，
         * 但不会触发新的 Tooltip 弹出，用户体验更平滑
         *
         * 使用 MarkdownString 代替纯文本 string，利用 VSCode 的 rich hover 机制：
         * MarkdownString tooltip 的消失延迟比纯文本长，使 Tooltip 更稳定，
         * 鼠标快速经过 Session/Weekly 时 MarkdownString Tooltip 可能还未消失
         */
        this.labelItem.tooltip = this.buildTooltipMarkdown(
            sessionUsagePercent, weeklyUsagePercent,
            sessionResetDate, weeklyResetDate, lastUpdated
        );
    }

    /**
     * 构建 MarkdownString 格式的 Tooltip
     * @param sessionUsagePercent - Session 用量百分比（0-100）
     * @param weeklyUsagePercent - Weekly 用量百分比（0-100）
     * @param sessionResetDate - Session 重置时间，可能为 undefined
     * @param weeklyResetDate - Weekly 重置时间，可能为 undefined
     * @param lastUpdated - 最后更新时间
     * @returns MarkdownString 对象，支持 VSCode rich hover 渲染
     * @description 使用 Markdown 格式构建 Tooltip 内容，包括：
     *              - 标题行
     *              - Session 用量百分比及预警标识（⚠ WARNING / ⚠ CRITICAL）
     *              - Session 重置倒计时
     *              - Weekly 用量百分比及预警标识
     *              - Weekly 重置倒计时
     *              - 最后更新时间
     *              MarkdownString 的 isTrusted = true 允许渲染命令链接
     *              supportThemeIcons = true 支持 $(icon) 语法
     */
    private buildTooltipMarkdown(
        sessionUsagePercent: number,
        weeklyUsagePercent: number,
        sessionResetDate: Date | undefined,
        weeklyResetDate: Date | undefined,
        lastUpdated: Date
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        md.supportThemeIcons = true;

        /** 添加标题行 */
        md.appendMarkdown('**$(cloud) Ollama Cloud Usage**\n\n---\n\n');

        /** 添加 Session 用量信息及颜色预警标识 */
        const sessionWarning = this.getUsageMdLabel(sessionUsagePercent);
        md.appendMarkdown(`**Session (5h):** ${sessionUsagePercent}% used${sessionWarning}\n\n`);
        if (sessionResetDate) {
            const remaining = sessionResetDate.getTime() - Date.now();
            md.appendMarkdown(`&nbsp;&nbsp;↻ Reset in: ${formatResetTime(remaining)}\n\n`);
        }

        /** 添加 Weekly 用量信息及颜色预警标识 */
        const weeklyWarning = this.getUsageMdLabel(weeklyUsagePercent);
        md.appendMarkdown(`**Weekly:** ${weeklyUsagePercent}% used${weeklyWarning}\n\n`);
        if (weeklyResetDate) {
            const remaining = weeklyResetDate.getTime() - Date.now();
            md.appendMarkdown(`&nbsp;&nbsp;↻ Reset in: ${formatResetTime(remaining)}\n\n`);
        }

        /** 添加分隔线和最后更新时间 */
        md.appendMarkdown('---\n\n');
        const timeStr = lastUpdated.toLocaleTimeString();
        md.appendMarkdown(`Last updated: ${timeStr}`);

        return md;
    }

    /**
     * 根据用量百分比获取 Markdown 格式的预警标识
     * @param percent - 用量百分比（0-100）
     * @returns Markdown 格式的预警标识字符串，用于 MarkdownString Tooltip
     * @description 返回带加粗样式的预警标识：
     *              - >= 80%: "⚠ **CRITICAL**" 红色危险级别
     *              - >= 50%: "⚠ *WARNING*" 黄色警告级别
     *              - < 50%: 空字符串（正常，无需预警）
     */
    private getUsageMdLabel(percent: number): string {
        if (percent >= StatusBarManager.ERROR_THRESHOLD) {
            return ' ⚠ **CRITICAL**';
        }
        if (percent >= StatusBarManager.WARNING_THRESHOLD) {
            return ' ⚠ *WARNING*';
        }
        return '';
    }

    /**
     * 根据用量百分比获取背景颜色
     * @param percent - 用量百分比（0-100）
     * @returns VSCode 主题颜色或 undefined（正常状态无背景色）
     * @description 阈值逻辑：
     *              - percent >= 80: 返回 statusBarItem.errorBackground（红色危险背景）
     *              - percent >= 50: 返回 statusBarItem.warningBackground（黄色警告背景）
     *              - percent < 50:  返回 undefined（默认背景色，无预警）
     */
    private getUsageBackgroundColor(percent: number): vscode.ThemeColor | undefined {
        if (percent >= StatusBarManager.ERROR_THRESHOLD) {
            return new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        if (percent >= StatusBarManager.WARNING_THRESHOLD) {
            return new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        return undefined;
    }

    /**
     * 获取所有状态栏项的销毁函数
     * @returns 所有状态栏项的 Disposable 对象数组
     * @description 返回所有3个状态栏项，确保外部可以统一管理生命周期
     */
    getStatusBarItems(): vscode.StatusBarItem[] {
        return [this.labelItem, this.sessionItem, this.weeklyItem];
    }

    /**
     * 获取上一次的用量数据
     * @returns 上一次的用量结果，可能为 undefined
     */
    getLastResult(): UsageResult | undefined {
        return this.lastResult;
    }

    /**
     * 销毁状态栏管理器，释放所有状态栏项资源
     */
    dispose(): void {
        this.labelItem.dispose();
        this.sessionItem.dispose();
        this.weeklyItem.dispose();
    }
}