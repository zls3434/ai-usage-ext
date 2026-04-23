/**
 * @fileoverview Ollama 数据提供者，负责从 Ollama 平台获取和解析用量数据
 * @date 2026-04-23
 * @author qiweizhe
 * @purpose 通过 HTTP 请求获取 Ollama settings 页面数据，解析出用量百分比和重置时间
 */

import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { HttpClient } from '../utils/httpClient';
import { UsageData, UsageResult, UsageStatus, RawUsageData } from '../models/usageData';

/**
 * Ollama 数据提供者类
 * @description 从 Ollama 云平台的 /settings 页面获取用量信息，
 *              解析 HTML 中的用量数据并返回结构化的结果
 */
export class OllamaProvider {
    /** HTTP 客户端实例，用于发送请求 */
    private httpClient: HttpClient;

    /** 上次成功获取的数据，用于网络错误时回退显示 */
    private lastKnownData: UsageData | undefined;

    /**
     * 创建 Ollama 数据提供者
     * @param cookie - Ollama 平台的 Cookie 字符串
     */
    constructor(cookie: string) {
        this.httpClient = new HttpClient({
            cookie,
            baseURL: 'https://ollama.com',
            timeout: 15000,
        });
    }

    /**
     * 更新 Cookie 并重建 HTTP 客户端
     * @param cookie - 新的 Cookie 字符串
     */
    updateCookie(cookie: string): void {
        this.httpClient.updateCookie(cookie);
    }

    /**
     * 获取用量数据
     * @description 先尝试 JSON API，如果失败则回退到 HTML 解析
     * @returns 用量数据结果
     */
    async fetchUsage(): Promise<UsageResult> {
        if (!this.httpClient.getCookie()) {
            return {
                status: UsageStatus.NoCookie,
            };
        }

        try {
            /** 首先尝试 HTML 页面解析（当前主要方式） */
            const html = await this.httpClient.get('/settings');

            if (!html || html.trim().length === 0) {
                throw new Error('Empty response from Ollama settings page');
            }

            const rawUsage = this.parseUsageFromHtml(html);
            const usageData = this.convertRawUsageData(rawUsage);
            this.lastKnownData = usageData;

            return {
                data: usageData,
                status: UsageStatus.Normal,
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            /** 检测是否是认证错误 */
            if (errorMsg.includes('Authentication failed') || errorMsg.includes('Cookie may be expired')) {
                return {
                    status: UsageStatus.NoCookie,
                    errorMessage: 'Cookie expired, please login again',
                };
            }

            /** 网络错误时使用上次已知数据 */
            if (this.lastKnownData) {
                return {
                    data: this.lastKnownData,
                    status: UsageStatus.Normal,
                    errorMessage: `Using cached data: ${errorMsg}`,
                };
            }

            return {
                status: UsageStatus.Error,
                errorMessage: errorMsg,
            };
        }
    }

    /**
     * 从 HTML 页面中解析用量数据
     * @description 使用 cheerio 解析 ollama.com/settings 页面 HTML
     *              提取 session 和 weekly 的用量百分比以及重置时间
     * @param html - 页面 HTML 字符串
     * @returns 原始用量数据
     */
    private parseUsageFromHtml(html: string): RawUsageData {
        const $ = cheerio.load(html);

        let sessionUsageStr = '';
        let weeklyUsageStr = '';
        let sessionResetStr: string | undefined;
        let weeklyResetStr: string | undefined;

        /**
         * 策略 1: 查找包含用量信息的进度条或百分比文本
         * Ollama settings 页面通常用进度条展示用量
         * 尝试匹配多种可能的 HTML 结构
         */

        /** 查找所有文本内容中包含百分比的部分 */
        const percentageRegex = /(\d+(?:\.\d+)?)\s*%/g;
        const percentages: string[] = [];

        $('*').each((_index: number, element: AnyNode) => {
            const el = $(element);
            const text = el.text().trim();
            let match: RegExpExecArray | null;
            const localPercentages: string[] = [];
            percentageRegex.lastIndex = 0;

            while ((match = percentageRegex.exec(text)) !== null) {
                localPercentages.push(match[1]);
            }

            /** 如果一个元素中只包含一个百分比，可能就是用量信息 */
            if (localPercentages.length === 1) {
                percentages.push(localPercentages[0]);
            }
        });

        /**
         * 策略 2: 查找 aria-valuenow 属性（进度条）
         */
        $('[aria-valuenow]').each((_index: number, element: AnyNode) => {
            const value = $(element).attr('aria-valuenow');
            if (value) {
                percentages.push(value);
            }
        });

        /**
         * 策略 3: 查找 style 中的 width 百分比
         */
        $('[style*="width"]').each((_index: number, element: AnyNode) => {
            const style = $(element).attr('style') || '';
            const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
            if (widthMatch) {
                percentages.push(widthMatch[1]);
            }
        });

        /**
         * 策略 4: 查找特定关键词附近的文本
         * 如 "Session"、"5 hours"、"Weekly"、"7 days" 等关键词
         */
        const sessionKeywords = ['session', '5 hour', '5h'];
        const weeklyKeywords = ['weekly', '7 day', 'week'];

        $('*').each((_index: number, element: AnyNode) => {
            const el = $(element);
            const text = el.text().toLowerCase();

            for (const keyword of sessionKeywords) {
                if (text.includes(keyword)) {
                    const parent = el.parent();
                    const parentText = parent.text();
                    const match = parentText.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (match) {
                        sessionUsageStr = match[1];
                    }
                }
            }

            for (const keyword of weeklyKeywords) {
                if (text.includes(keyword)) {
                    const parent = el.parent();
                    const parentText = parent.text();
                    const match = parentText.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (match) {
                        weeklyUsageStr = match[1];
                    }
                }
            }
        });

        /**
         * 策略 5: 解析页面中的时间信息（剩余时间）
         * 查找如 "2h 30m"、"3d 12h"、"resets in" 等模式
         */
        const timeRegex = /(\d+h(?:\s*\d+m)?)|\d+d(?:\s*\d+h)?|\d+m/g;
        const resetTimeRegex = /(?:resets?\s+in|resets?\s+after|next\s+reset[:\s]+)([^.]+)/gi;

        $('*').each((_index: number, element: AnyNode) => {
            const el = $(element);
            const text = el.text();

            if (!sessionResetStr) {
                const lowerText = text.toLowerCase();
                if (lowerText.includes('session') || lowerText.includes('5 hour') || lowerText.includes('5h')) {
                    let resetMatch: RegExpExecArray | null;
                    resetTimeRegex.lastIndex = 0;
                    while ((resetMatch = resetTimeRegex.exec(text)) !== null) {
                        sessionResetStr = resetMatch[1].trim();
                    }
                }
            }

            if (!weeklyResetStr) {
                const lowerText = text.toLowerCase();
                if (lowerText.includes('weekly') || lowerText.includes('7 day') || lowerText.includes('week')) {
                    let resetMatch: RegExpExecArray | null;
                    resetTimeRegex.lastIndex = 0;
                    while ((resetMatch = resetTimeRegex.exec(text)) !== null) {
                        weeklyResetStr = resetMatch[1].trim();
                    }
                }
            }
        });

        /** 如果没有通过关键词找到数据，使用前两个百分比作为 session 和 weekly */
        if (!sessionUsageStr && percentages.length >= 1) {
            sessionUsageStr = percentages[0];
        }
        if (!weeklyUsageStr && percentages.length >= 2) {
            weeklyUsageStr = percentages[1];
        }

        return {
            sessionUsageStr,
            weeklyUsageStr,
            sessionResetStr,
            weeklyResetStr,
        };
    }

    /**
     * 将原始用量数据转换为结构化数据
     * @param raw - 从 HTML 解析的原始数据
     * @returns 结构化的用量数据
     */
    private convertRawUsageData(raw: RawUsageData): UsageData {
        const now = new Date();

        /** 解析用量百分比 */
        const sessionUsagePercent = parseFloat(raw.sessionUsageStr) || 0;
        const weeklyUsagePercent = parseFloat(raw.weeklyUsageStr) || 0;

        /** 解析重置时间 */
        let sessionResetDate: Date | undefined;
        let weeklyResetDate: Date | undefined;

        if (raw.sessionResetStr) {
            sessionResetDate = this.parseResetTime(raw.sessionResetStr, now);
        } else {
            /** 如果没有找到具体的重置时间，假设 5 小时周期的中间点 */
            sessionResetDate = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);
        }

        if (raw.weeklyResetStr) {
            weeklyResetDate = this.parseResetTime(raw.weeklyResetStr, now);
        } else {
            /** 如果没有找到具体的重置时间，假设一周周期的中间点 */
            weeklyResetDate = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);
        }

        return {
            sessionUsagePercent: Math.round(sessionUsagePercent),
            weeklyUsagePercent: Math.round(weeklyUsagePercent),
            sessionResetTime: sessionResetDate ? sessionResetDate.getTime() - now.getTime() : undefined,
            weeklyResetTime: weeklyResetDate ? weeklyResetDate.getTime() - now.getTime() : undefined,
            sessionResetDate,
            weeklyResetDate,
            lastUpdated: now,
        };
    }

    /**
     * 解析时间字符串为 Date 对象
     * @description 将如 "2h 30m"、"3d 12h" 这样的时间字符串转换为未来时间点
     * @param timeStr - 时间字符串
     * @param base - 基准时间（当前时间）
     * @returns 对应的未来 Date 对象
     */
    private parseResetTime(timeStr: string, base: Date): Date {
        let totalMs = 0;

        /** 匹配天数 */
        const daysMatch = timeStr.match(/(\d+)\s*d/);
        if (daysMatch) {
            totalMs += parseInt(daysMatch[1]) * 24 * 60 * 60 * 1000;
        }

        /** 匹配小时数 */
        const hoursMatch = timeStr.match(/(\d+)\s*h/);
        if (hoursMatch) {
            totalMs += parseInt(hoursMatch[1]) * 60 * 60 * 1000;
        }

        /** 匹配分钟数 */
        const minutesMatch = timeStr.match(/(\d+)\s*m/);
        if (minutesMatch) {
            totalMs += parseInt(minutesMatch[1]) * 60 * 1000;
        }

        /** 如果没有匹配到任何时间单位，默认返回基准时间 */
        if (totalMs === 0) {
            return base;
        }

        return new Date(base.getTime() + totalMs);
    }
}