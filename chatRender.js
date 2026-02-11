/**
 * chatRender.js
 * 聊天界面渲染模块 - 入口文件
 * 
 * 此文件作为模块加载器，整合所有子模块并导出统一的 ChatInterface 对象
 * 保持与原有代码完全兼容的API接口
 * 
 * 模块结构：
 * ├── chatRender/
 * │   ├── index.js          - 核心逻辑和对外接口 (~280行)
 * │   ├── utils.js          - 工具函数（图片生成、压缩、滚动）(~130行)
 * │   ├── messageBuilder.js - 消息HTML构建器 (~180行)
 * │   ├── eventHandlers.js  - 事件处理器（触摸、右键菜单、删除模式）(~270行)
 * │   ├── emojiPanel.js     - 表情包面板 (~180行)
 * │   ├── mediaHandlers.js  - 媒体处理器（拍照、相册）(~160行)
 * │   └── aiHandler.js      - AI交互处理器 (~170行)
 * 
 * 使用方式：
 * 在 HTML 中按顺序引入以下脚本：
 * <script src="chatRender/utils.js"></script>
 * <script src="chatRender/messageBuilder.js"></script>
 * <script src="chatRender/eventHandlers.js"></script>
 * <script src="chatRender/emojiPanel.js"></script>
 * <script src="chatRender/mediaHandlers.js"></script>
 * <script src="chatRender/aiHandler.js"></script>
 * <script src="chatRender/index.js"></script>
 * 
 * 或者直接引入此文件（需要支持动态加载）：
 * <script src="chatRender.js"></script>
 */

// 动态加载子模块（用于不支持ES模块的环境）
(function() {
    'use strict';
    
    // 检查是否已经加载了子模块
    if (typeof ChatInterface !== 'undefined' && ChatInterface._modulesLoaded) {
        return;
    }
    
    // 子模块列表（按依赖顺序）
    const modules = [
        'chatRender/utils.js',
        'chatRender/messageBuilder.js',
        'chatRender/eventHandlers.js',
        'chatRender/emojiPanel.js',
        'chatRender/mediaHandlers.js',
        'chatRender/aiHandler.js',
        'chatRender/index.js'
    ];
    
    // 获取当前脚本的基础路径
    function getBasePath() {
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            const src = scripts[i].src;
            if (src.includes('chatRender.js')) {
                return src.substring(0, src.lastIndexOf('/') + 1);
            }
        }
        return '';
    }
    
    // 同步加载脚本（用于确保加载顺序）
    function loadScriptSync(url) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false); // 同步请求
        xhr.send(null);
        if (xhr.status === 200) {
            const script = document.createElement('script');
            script.text = xhr.responseText;
            document.head.appendChild(script);
            return true;
        }
        return false;
    }
    
    // 检查子模块是否已加载
    function checkModulesLoaded() {
        return typeof ChatRenderUtils !== 'undefined' &&
               typeof MessageBuilder !== 'undefined' &&
               typeof ChatEventHandlers !== 'undefined' &&
               typeof EmojiPanel !== 'undefined' &&
               typeof MediaHandlers !== 'undefined' &&
               typeof AIHandler !== 'undefined' &&
               typeof ChatInterface !== 'undefined';
    }
    
    // 如果子模块未加载，则动态加载
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
    
    // 标记模块已加载
    if (typeof ChatInterface !== 'undefined') {
        ChatInterface._modulesLoaded = true;
    }
})();
