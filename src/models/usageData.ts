/**
 * @fileoverview AI Usage 数据模型定义
 * @date 2026-04-23
 * @author qiweizhe
 * @purpose 定义插件中使用的所有数据接口和类型，包括用量数据、配置数据等
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
 * 根据用量百分比获取状态栏颜色主题键
 * @param percent - 用量百分比（0-100）
 * @returns VSCode 主题颜色键
 */
export function getUsageColorKey(percent: number): string {
    if (percent >= 80) {
        return 'errorForeground';
    }
    if (percent >= 50) {
        return 'editorWarning.foreground';
    }
    return '';
}