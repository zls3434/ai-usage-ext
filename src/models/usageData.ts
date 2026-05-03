/**
 * @fileoverview AI Usage 数据模型定义
 * @date 2026-04-23
 * @author zls3434
 * @purpose 定义插件中使用的所有数据接口和类型，包括用量数据、配置数据、告警阈值常量等
 * @modified 2026-04-28 - qiweizhe - 更新 getUsageColorKey 函数，支持 Session 和 Weekly 使用不同阈值
 * @modified 2026-04-28 - qiweizhe - 将告警阈值常量提取为模块级导出常量，
 *              统一管理 Session（50%/80%）和 Weekly（75%/90%）的告警阈值，
 *              消除与 StatusBarManager 中的重复定义
 * @modified 2026-04-28 - qiweizhe - 新增 UsageType 枚举并导出，替代 getUsageColorKey 中的字符串字面量类型，
 *              统一用量类型的表示方式，与 StatusBarManager 中的 UsageType 保持一致
 */

/**
 * Ollama 云平台用量数据模型
 * @description 存储从 Ollama settings 页面解析出的用量信息
 * @property sessionUsagePercent - 5小时 session 的用量百分比（0-100）
 * @property weeklyUsagePercent - 一周的用量百分比（0-100）
 * @property sessionResetTime - 距离 session 重置的剩余时间（毫秒时间戳）
 * @property weeklyResetTime - 距离 weekly 重置的剩余时间（毫秒时间戳）
 * @property sessionResetDate - session 重置的具体时间
 * @property weeklyResetDate - weekly 重置的具体时间
 * @property lastUpdated - 最后一次更新数据的时间
 */
export interface UsageData {
    sessionUsagePercent: number;
    weeklyUsagePercent: number;
    sessionResetTime?: number;
    weeklyResetTime?: number;
    sessionResetDate?: Date;
    weeklyResetDate?: Date;
    lastUpdated: Date;
}

/**
 * 从 Ollama settings 页面原始解析的数据
 * @description 直接从 HTML 中提取的原始字符串数据，后续转换为 UsageData
 * @property sessionUsageStr - session 用量的原始文本（如 "45%"）
 * @property weeklyUsageStr - weekly 用量的原始文本（如 "30%"）
 * @property sessionResetStr - session 重置时间原始文本（如 "2h 30m"）
 * @property weeklyResetStr - weekly 重置时间原始文本（如 "3d 12h"）
 */
export interface RawUsageData {
    sessionUsageStr: string;
    weeklyUsageStr: string;
    sessionResetStr?: string;
    weeklyResetStr?: string;
}

/**
 * 用量状态枚举
 * @description 表示当前用量数据获取状态
 */
export enum UsageStatus {
    /** 正常状态，数据获取成功 */
    Normal = 'normal',
    /** Cookie 未设置或已过期 */
    NoCookie = 'no_cookie',
    /** 网络错误或解析失败 */
    Error = 'error',
    /** 正在加载中 */
    Loading = 'loading'
}

/**
 * 带状态的用量数据
 * @description 将用量数据和状态绑定，便于状态栏判断显示方式
 * @property data - 用量数据，可能为空（状态非 Normal 时）
 * @property status - 当前数据获取状态
 * @property errorMessage - 错误信息，仅在 Error 状态时有值
 */
export interface UsageResult {
    data?: UsageData;
    status: UsageStatus;
    errorMessage?: string;
}

/**
 * 更新间隔可选项
 * @description 用户可选择的定时更新频率
 */
export const UPDATE_INTERVALS = [
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '2 minutes', value: 120 },
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 }
] as const;

/**
 * 格式化剩余时间为人类可读字符串
 * @param ms - 剩余毫秒数
 * @returns 格式化的时间字符串（如 "2h 30m"、"3d 12h"）
 */
export function formatResetTime(ms: number): string {
    if (ms <= 0) {
        return '0m';
    }
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (hours % 24 > 0) {
        parts.push(`${hours % 24}h`);
    }
    if (minutes % 60 > 0 && days === 0) {
        parts.push(`${minutes % 60}m`);
    }
    if (parts.length === 0) {
        parts.push('0m');
    }
    return parts.join(' ');
}

/**
 * 用量类型枚举 — 区分 Session 和 Weekly，用于告警阈值查找
 * @description 由于 Session 和 Weekly 使用不同的告警阈值，
 *              所有颜色/预警判断方法需要知道当前判断的是哪种用量类型
 *              Session 告警阈值：< 50% 正常，50%-80% 黄色警告，>= 80% 红色危险
 *              Weekly 告警阈值：< 75% 正常，75%-90% 黄色警告，>= 90% 红色危险
 */
export enum UsageType {
    /** Session 用量（5小时窗口） */
    Session = 'session',
    /** Weekly 用量（一周窗口） */
    Weekly = 'weekly'
}

/** Session 告警阈值：50% 黄色警告，80% 红色危险 */
export const SESSION_WARNING_THRESHOLD = 50;
export const SESSION_ERROR_THRESHOLD = 80;
/** Weekly 告警阈值：75% 黄色警告，90% 红色危险 */
export const WEEKLY_WARNING_THRESHOLD = 75;
export const WEEKLY_ERROR_THRESHOLD = 90;

/**
 * 根据用量百分比和用量类型获取状态栏颜色主题键
 * @param percent - 用量百分比（0-100）
 * @param type - 用量类型（UsageType.Session 或 UsageType.Weekly），默认 UsageType.Session
 * @returns VSCode 主题颜色键
 * @description Session 和 Weekly 使用不同的告警阈值：
 *              - Session: >= 80% → errorForeground（红色），>= 50% → editorWarning.foreground（黄色）
 *              - Weekly:  >= 90% → errorForeground（红色），>= 75% → editorWarning.foreground（黄色）
 *              低于告警阈值返回空字符串（使用默认颜色）
 */
export function getUsageColorKey(percent: number, type: UsageType = UsageType.Session): string {
    const warningThreshold = type === UsageType.Weekly ? WEEKLY_WARNING_THRESHOLD : SESSION_WARNING_THRESHOLD;
    const errorThreshold = type === UsageType.Weekly ? WEEKLY_ERROR_THRESHOLD : SESSION_ERROR_THRESHOLD;

    if (percent >= errorThreshold) {
        return 'errorForeground';
    }
    if (percent >= warningThreshold) {
        return 'editorWarning.foreground';
    }
    return '';
}