// 3D竹笛定制器的ES模块引导程序
// 此文件作为模块化应用程序的入口点

import { App } from './App.js';

// 在生产环境中静默控制台；在调试时切换 window.__DEV__ = true
if (typeof window !== 'undefined') {
    if (typeof window.__DEV__ === 'undefined') window.__DEV__ = false;
    (function () {
        const original = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console)
        };
        ['log', 'info', 'warn', 'error', 'debug'].forEach((fn) => {
            console[fn] = function (...args) {
                if (window.__DEV__) original[fn](...args);
            };
        });
    })();
}

let appInstance = null;
let threeDIntegration = null;

// 当DOM准备就绪时初始化应用程序
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('开始应用初始化...');
        
        // 初始化主应用程序（根App连接UI、3D和定制器）
        appInstance = new App();

        // 为代理访问和调试全局暴露应用
        window.app = appInstance;

        console.log('3D竹笛定制器初始化成功');

    } catch (error) {
        console.error('应用初始化失败:', error);
        alert('应用初始化失败。请刷新页面重试。');
    }
    
    // --- 模态框逻辑开始 --- （在DOM准备就绪后直接绑定）
    const openGuideBtn = document.getElementById('open-guide-btn');
    const closeGuideBtn = document.getElementById('close-guide-modal');
    const guideOverlay = document.getElementById('guide-modal-overlay');

    if (openGuideBtn && closeGuideBtn && guideOverlay) {
        const showGuide = () => guideOverlay.classList.remove('hidden');
        const hideGuide = () => guideOverlay.classList.add('hidden');

        openGuideBtn.addEventListener('click', showGuide);
        closeGuideBtn.addEventListener('click', hideGuide);
        guideOverlay.addEventListener('click', (event) => {
            if (event.target === guideOverlay) {
                hideGuide();
            }
        });

        // 首次访问逻辑
        if (!localStorage.getItem('diziAppVisited')) {
            showGuide();
            localStorage.setItem('diziAppVisited', 'true');
        }
    }
    // --- 模态框逻辑结束 ---
});

// 在页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (appInstance) {
        appInstance.destroy();
        appInstance = null;
    }

        console.log('应用清理完成');
});