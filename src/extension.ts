/**
 * @fileoverview AI Usage Monitor 扩展入口文件
 * @date 2026-04-23
 * @author qiweizhe
 * @purpose VSCode/Trae CN 扩展插件入口，负责插件的激活和停用生命周期管理
 */

import * as vscode from 'vscode';
import { ExtensionController } from './controllers/extensionController';

/**
 * 扩展激活回调
 * @description 当 VSCode/Trae CN 激活此扩展时调用
 *              创建扩展控制器并启动数据获取流程
 * @param context - VSCode 扩展上下文，提供 globalState 和 subscriptions 等
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const controller = new ExtensionController(context);

    /** 确保 dispose 在扩展停用时调用 */
    context.subscriptions.push({
        dispose: () => controller.dispose(),
    });

    /** 启动扩展 */
    await controller.start();

    console.log('AI Usage Monitor extension activated.');
}

/**
 * 扩展停用回调
 * @description 当 VSCode/Trae CN 停用此扩展时调用
 *              清理资源（主要逻辑通过 context.subscriptions 处理）
 */
export function deactivate(): void {
    console.log('AI Usage Monitor extension deactivated.');
}