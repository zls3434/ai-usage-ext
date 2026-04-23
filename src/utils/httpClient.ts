/**
 * @fileoverview HTTP 客户端封装，用于请求 Ollama 平台页面
 * @date 2026-04-23
 * @author zls3434
 * @purpose 封装 HTTP 请求逻辑，支持 Cookie 认证、超时控制和安全限制
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * HTTP 客户端配置接口
 * @property cookie - 请求时携带的 Cookie 字符串
 * @property timeout - 请求超时时间（毫秒），默认 10000
 * @property baseURL - 请求的基础 URL，默认 https://ollama.com
 */
export interface HttpClientConfig {
    cookie: string;
    timeout?: number;
    baseURL?: string;
}

/**
 * HTTP 客户端类
 * @description 封装对 Ollama 平台的 HTTP 请求，提供统一的错误处理和安全控制
 */
export class HttpClient {
    private instance: AxiosInstance;
    private cookie: string;

    /**
     * 创建 HTTP 客户端实例
     * @param config - 客户端配置
     */
    constructor(config: HttpClientConfig) {
        this.cookie = config.cookie;
        const baseURL = config.baseURL || 'https://ollama.com';
        const timeout = config.timeout || 10000;

        this.instance = axios.create({
            baseURL,
            timeout,
            headers: this.buildHeaders(),
            maxRedirects: 0,
            validateStatus: (status: number) => status < 400,
        });
    }

    /**
     * 构建请求头
     * @returns 包含 Cookie 和 User-Agent 的请求头对象
     */
    private buildHeaders(): Record<string, string> {
        return {
            'Cookie': this.cookie,
            'User-Agent': 'AI-Usage-Ext/0.1.0 (VSCode Extension)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };
    }

    /**
     * 更新 Cookie
     * @param cookie - 新的 Cookie 字符串
     */
    updateCookie(cookie: string): void {
        this.cookie = cookie;
        this.instance.defaults.headers['Cookie'] = cookie;
    }

    /**
     * 发送 GET 请求
     * @param url - 请求路径（相对于 baseURL）
     * @param config - 可选的 Axios 请求配置
     * @returns 响应数据（HTML 字符串或 JSON 对象）
     * @throws 当请求失败或状态码异常时抛出错误
     */
    async get(url: string, config?: AxiosRequestConfig): Promise<string> {
        try {
            const response = await this.instance.get(url, {
                ...config,
                headers: this.buildHeaders(),
            });

            if (response.status === 302 || response.status === 301) {
                throw new Error('Received redirect - Cookie may be invalid');
            }

            return typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new Error('Authentication failed - Cookie may be expired');
                }
                throw new Error(`HTTP request failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 发送 GET 请求并解析 JSON 响应
     * @param url - 请求路径
     * @returns 解析后的 JSON 对象
     */
    async getJSON<T = unknown>(url: string): Promise<T> {
        try {
            const response = await this.instance.get(url, {
                headers: {
                    ...this.buildHeaders(),
                    'Accept': 'application/json',
                },
            });
            return response.data as T;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new Error('Authentication failed - Cookie may be expired');
                }
                throw new Error(`HTTP request failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 获取当前 Cookie
     * @returns 当前存储的 Cookie 字符串
     */
    getCookie(): string {
        return this.cookie;
    }
}