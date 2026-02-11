/**
 * chatSettings.js
 * 聊天设置模块 - 入口文件
 * 
 * 此文件作为模块加载器，整合所有子模块并导出统一的 ChatSettings 对象
 * 保持与原有代码完全兼容的API接口
 * 
 * 模块结构：
 * ├── chatSettings/
 * │   ├── index.js           - 核心逻辑和对外接口 (~280行)
 * │   ├── avatarHandlers.js  - 头像和背景处理 (~160行)
 * │   └── bindingSelectors.js - 绑定选择器（世界书、表情包）(~180行)
 * 
 * 使用方式：
 * 在 HTML 中按顺序引入以下脚本：
 * <script src="chatSettings/avatarHandlers.js"></script>
 * <script src="chatSettings/bindingSelectors.js"></script>
 * <script src="chatSettings/index.js"></script>
 */

// 动态加载子模块
(function() {
    'use strict';
    
    if (typeof ChatSettings !== 'undefined' && ChatSettings._modulesLoaded) {
        return;
    }
    
    const modules = [
        'chatSettings/avatarHandlers.js',
        'chatSettings/bindingSelectors.js',
        'chatSettings/index.js'
    ];
    
    function getBasePath() {
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            const src = scripts[i].src;
            if (src.includes('chatSettings.js')) {
                return src.substring(0, src.lastIndexOf('/') + 1);
            }
        }
        return '';
    }
    
    function loadScriptSync(url) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.send(null);
        if (xhr.status === 200) {
            const script = document.createElement('script');
            script.text = xhr.responseText;
            document.head.appendChild(script);
            return true;
        }
        return false;
    }
    
    function checkModulesLoaded() {
        return typeof AvatarHandlers !== 'undefined' &&
               typeof BindingSelectors !== 'undefined' &&
               typeof ChatSettings !== 'undefined';
    }
    
    if (!checkModulesLoaded()) {
        const basePath = getBasePath();
        
        for (const module of modules) {
            const url = basePath + module;
            try {
                loadScriptSync(url);
            } catch (e) {
                console.error('Failed to load module:', module, e);
            }
        }
    }
    
    if (typeof ChatSettings !== 'undefined') {
        ChatSettings._modulesLoaded = true;
    }
})();
