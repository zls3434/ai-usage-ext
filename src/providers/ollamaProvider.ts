/**
 * @fileoverview Ollama 数据提供者，负责从 Ollama 平台获取和解析用量数据
 * @date 2026-04-23
 * @author zls3434
 * @purpose 通过 HTTP 请求获取 Ollama settings 页面数据，解析出用量百分比和重置时间
 * @modified 2026-04-23 - 根据实际页面 HTML 结构重写解析逻辑，修复 session/weekly 数据相同的问题
 */

import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { HttpClient } from '../utils/httpClient';
import { UsageData, UsageResult, UsageStatus } from '../models/usageData';

/**
 * Ollama 数据提供者类
 * @description 从 Ollama 云平台的 /settings 页面获取用量信息，
 *              基于 ollama.com/settings 的实际 HTML 结构解析用量数据
 *
 * 页面结构参考（ollama-settings-page.html）：
 * - Session usage 区域包含：
 *   <span class="text-sm">4.5% used</span>          — 用量百分比
 *   <div style="width: 4.5%"></div>                 — 进度条宽度
 *   <div class="local-time" data-time="2026-04-23T11:00:00Z">Resets in 4 hours</div> — 重置时间
 *
 * - Weekly usage 区域包含：
 *   <span class="text-sm">39.8% used</span>          — 用量百分比
 *   <div style="width: 39.8%"></div>                 — 进度条宽度
 *   <div class="local-time" data-time="2026-04-27T00:00:00Z">Resets in 3 days</div> — 重置时间
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
     * @description 请求 ollama.com/settings 页面，解析 HTML 提取用量信息
     * @returns 用量数据结果
     */
    async fetchUsage(): Promise<UsageResult> {
        if (!this.httpClient.getCookie()) {
            return {
                status: UsageStatus.NoCookie,
            };
        }

        try {
            const html = await this.httpClient.get('/settings');

            if (!html || html.trim().length === 0) {
                throw new Error('Empty response from Ollama settings page');
            }

            const usageData = this.parseUsageFromHtml(html);
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
     * @description 基于 ollama.com/settings 页面的实际 HTML 结构解析。
     *              页面中有两个用量区域，分别以 "Session usage" 和 "Weekly usage" 标识。
     *              解析策略：
     *              1. 精确匹配：找到包含 "Session usage" 和 "Weekly usage" 文本的容器
     *              2. 从容器内提取百分比文本（如 "4.5% used"）
     *              3. 从 data-time 属性提取重置时间戳（精确到秒的 ISO 时间）
     *              4. 回退策略：如果精确匹配失败，尝试进度条 style width 和 "Resets in" 文本
     * @param html - 页面 HTML 字符串
     * @returns 结构化的用量数据
     */
    private parseUsageFromHtml(html: string): UsageData {
        const $ = cheerio.load(html);
        const now = new Date();

        let sessionUsagePercent = 0;
        let weeklyUsagePercent = 0;
        let sessionResetDate: Date | undefined;
        let weeklyResetDate: Date | undefined;

        /**
         * 精确解析策略：
         * 找到所有包含 "session usage" 或 "weekly usage" 文本的元素，
         * 然后向上查找其父级容器，在容器内提取百分比和时间数据
         */
        const usageBlocks = this.findUsageBlocks($);

        if (usageBlocks.session) {
            const sessionData = this.extractBlockData($, usageBlocks.session);
            if (sessionData) {
                sessionUsagePercent = sessionData.percent;
                sessionResetDate = sessionData.resetDate;
            }
        }

        if (usageBlocks.weekly) {
            const weeklyData = this.extractBlockData($, usageBlocks.weekly);
            if (weeklyData) {
                weeklyUsagePercent = weeklyData.percent;
                weeklyResetDate = weeklyData.resetDate;
            }
        }

        /**
         * 回退策略：如果精确匹配未找到数据
         * 尝试通过进度条 style width 和 data-time 属性直接提取
         */
        if (sessionUsagePercent === 0 && weeklyUsagePercent === 0) {
            const fallbackData = this.fallbackParse($);
            if (fallbackData.sessionPercent > 0) {
                sessionUsagePercent = fallbackData.sessionPercent;
            }
            if (fallbackData.weeklyPercent > 0) {
                weeklyUsagePercent = fallbackData.weeklyPercent;
            }
            if (fallbackData.sessionResetDate && !sessionResetDate) {
                sessionResetDate = fallbackData.sessionResetDate;
            }
            if (fallbackData.weeklyResetDate && !weeklyResetDate) {
                weeklyResetDate = fallbackData.weeklyResetDate;
            }
        }

        return {
            sessionUsagePercent: Math.round(sessionUsagePercent * 10) / 10,
            weeklyUsagePercent: Math.round(weeklyUsagePercent * 10) / 10,
            sessionResetTime: sessionResetDate ? sessionResetDate.getTime() - now.getTime() : undefined,
            weeklyResetTime: weeklyResetDate ? weeklyResetDate.getTime() - now.getTime() : undefined,
            sessionResetDate,
            weeklyResetDate,
            lastUpdated: now,
        };
    }

    /**
     * 查找 Session 和 Weekly 用量区域的 DOM 节点
     * @description 在页面中搜索包含 "Session usage" 和 "Weekly usage" 文本的元素，
     *              返回它们最近的块级父容器
     * @param $ - cheerio 实例
     * @returns 包含 session 和 weekly 块索引的对象
     */
    private findUsageBlocks($: cheerio.CheerioAPI): { session: AnyNode | null; weekly: AnyNode | null } {
        let session: AnyNode | null = null;
        let weekly: AnyNode | null = null;

        /** 遍历所有包含文本的 span 元素 */
        $('span').each((_index, element) => {
            const el = $(element);
            const text = el.text().trim().toLowerCase();

            if (text.includes('session usage')) {
                /** 向上查找到包含整个用量块的外层 div */
                const block = el.closest('div').parent();
                if (block.length > 0) {
                    session = block.get(0) || null;
                }
            }

            if (text.includes('weekly usage')) {
                const block = el.closest('div').parent();
                if (block.length > 0) {
                    weekly = block.get(0) || null;
                }
            }
        });

        /** 如果通过 span 未找到，尝试遍历所有文本节点 */
        if (!session || !weekly) {
            $('*').each((_index, element) => {
                const el = $(element);
                const text = el.text().trim().toLowerCase();

                if (!session && text.includes('session usage') && !text.includes('weekly')) {
                    session = element;
                }
                if (!weekly && text.includes('weekly usage')) {
                    weekly = element;
                }
            });
        }

        return { session, weekly };
    }

    /**
     * 从用量块 DOM 中提取百分比和重置时间
     * @description 从一个用量块（Session 或 Weekly 的容器）中提取：
     *              - 百分比：从 "4.5% used" 格式的文本中提取
     *              - 重置时间：优先从 data-time 属性提取 ISO 时间戳，
     *                回退从 "Resets in X hours/days" 文本提取
     * @param $ - cheerio 实例
     * @param block - 用量块的 DOM 元素
     * @returns 提取的数据，包含百分比和重置时间
     */
    private extractBlockData($: cheerio.CheerioAPI, block: AnyNode): { percent: number; resetDate: Date | undefined } | null {
        const $block = $(block);
        let percent = 0;
        let resetDate: Date | undefined;

        /**
         * 提取百分比 — 方式 1：
         * 找 "4.5% used" 格式的文本
         * 在 HTML 中：<span class="text-sm">4.5% used</span>
         */
        $block.find('span').each((_index, spanEl) => {
            const spanText = $(spanEl).text().trim();
            const percentMatch = spanText.match(/(\d+(?:\.\d+)?)\s*%\s*used/i);
            if (percentMatch) {
                percent = parseFloat(percentMatch[1]);
            }
        });

        /**
         * 提取百分比 — 方式 2（回退）：
         * 找进度条的 style="width: 4.5%"
         */
        if (percent === 0) {
            $block.find('[style*="width"]').each((_index, styleEl) => {
                const style = $(styleEl).attr('style') || '';
                const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
                if (widthMatch) {
                    percent = parseFloat(widthMatch[1]);
                }
            });
        }

        /**
         * 提取重置时间 — 方式 1（优先）：
         * 从 data-time 属性提取 ISO 时间戳
         * 在 HTML 中：<div class="local-time" data-time="2026-04-23T11:00:00Z">
         */
        const localTimeEl = $block.find('.local-time');
        const dataTime = localTimeEl.attr('data-time');
        if (dataTime) {
            const parsed = new Date(dataTime);
            if (!isNaN(parsed.getTime())) {
                resetDate = parsed;
            }
        }

        /**
         * 提取重置时间 — 方式 2（回退）：
         * 从文本 "Resets in 4 hours" 或 "Resets in 3 days" 提取
         */
        if (!resetDate) {
            const resetText = localTimeEl.text().trim();
            if (resetText) {
                resetDate = this.parseResetsInText(resetText);
            }
        }

        if (percent > 0) {
            return { percent, resetDate };
        }

        return null;
    }

    /**
     * 回退解析策略
     * @description 当精确匹配 strategy 失败时，直接通过全局选择器提取
     *              - 从所有 .local-time 元素的 data-time 属性提取时间
     *              - 从所有进度条 style width 提取百分比
     *              - 第一个对应 session，第二个对应 weekly
     * @param $ - cheerio 实例
     * @returns 回退解析结果
     */
    private fallbackParse($: cheerio.CheerioAPI): {
        sessionPercent: number;
        weeklyPercent: number;
        sessionResetDate: Date | undefined;
        weeklyResetDate: Date | undefined;
    } {
        let sessionPercent = 0;
        let weeklyPercent = 0;
        let sessionResetDate: Date | undefined;
        let weeklyResetDate: Date | undefined;

        /** 从 .local-time 元素提取时间（按顺序：第一个为 session，第二个为 weekly） */
        const localTimeEls = $('.local-time');
        if (localTimeEls.length >= 1) {
            const time1 = localTimeEls.eq(0).attr('data-time');
            if (time1) {
                const parsed = new Date(time1);
                if (!isNaN(parsed.getTime())) {
                    sessionResetDate = parsed;
                }
            }
        }
        if (localTimeEls.length >= 2) {
            const time2 = localTimeEls.eq(1).attr('data-time');
            if (time2) {
                const parsed = new Date(time2);
                if (!isNaN(parsed.getTime())) {
                    weeklyResetDate = parsed;
                }
            }
        }

        /** 从进度条 style width 提取百分比 */
        const widthEls = $('[style*="width"]');
        const widthPercentages: number[] = [];
        widthEls.each((_index, el) => {
            const style = $(el).attr('style') || '';
            const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
            if (widthMatch) {
                widthPercentages.push(parseFloat(widthMatch[1]));
            }
        });

        /** 第一个百分比为 session，第二个为 weekly */
        if (widthPercentages.length >= 1) {
            sessionPercent = widthPercentages[0];
        }
        if (widthPercentages.length >= 2) {
            weeklyPercent = widthPercentages[1];
        }

        return {
            sessionPercent,
            weeklyPercent,
            sessionResetDate,
            weeklyResetDate,
        };
    }

    /**
     * 解析 "Resets in X hours/days" 文本为 Date 对象
     * @description 将页面中的相对时间文本转换为未来时间点
     * @param text - 如 "Resets in 4 hours" 或 "Resets in 3 days"
     * @returns 对应的未来 Date 对象，解析失败返回 undefined
     */
    private parseResetsInText(text: string): Date | undefined {
        const now = new Date();
        let totalMs = 0;

        /** 匹配天数：如 "3 days"、"1 day" */
        const daysMatch = text.match(/(\d+)\s*day/i);
        if (daysMatch) {
            totalMs += parseInt(daysMatch[1]) * 24 * 60 * 60 * 1000;
        }

        /** 匹配小时数：如 "4 hours"、"1 hour" */
        const hoursMatch = text.match(/(\d+)\s*hour/i);
        if (hoursMatch) {
            totalMs += parseInt(hoursMatch[1]) * 60 * 60 * 1000;
        }

        /** 匹配分钟数：如 "30 minutes"、"1 minute" */
        const minutesMatch = text.match(/(\d+)\s*minute/i);
        if (minutesMatch) {
            totalMs += parseInt(minutesMatch[1]) * 60 * 1000;
        }

        if (totalMs === 0) {
            return undefined;
        }

        return new Date(now.getTime() + totalMs);
    }
}