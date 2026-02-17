/**
 * main.js
 * 主入口，负责初始化和调用 api.js 和 ui.js 的功能
 */

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

/**
 * 核心初始化函数 - 初始化所有 Manager 和 UI 组件
 * 可被 DOMContentLoaded 或组件加载完成后调用
 */
function initializeApp() {
    try {
        console.log('Initializing RuriChat...');

        // 1. Initialize Utilities
        // updateTime is defined in ui.js
        if (typeof updateTime === 'function') {
            setInterval(updateTime, 1000);
            updateTime();
        }

        // 2. Initialize Swipe Logic
        if (typeof SwipeLogic !== 'undefined') {
            SwipeLogic.init();
        }

        // 3. Setup File Uploaders
        // setupUploader is defined in ui.js
        if (typeof setupUploader === 'function') {
            setupUploader('upload-avatar-top', 'avatar-top-preview', 'avatar-top-text', null);
            setupUploader('upload-avatar-card', 'avatar-card-preview', 'avatar-card-text', null);
            setupUploader('upload-rect', 'image-preview-rect', null, 'upload-placeholder');
        }

        // 4. Initialize Managers
        // These managers are defined in ui.js and rely on api.js
        const managers = [
            { name: 'EmojiManager', obj: typeof EmojiManager !== 'undefined' ? EmojiManager : null },
            { name: 'MemoryApp', obj: typeof MemoryApp !== 'undefined' ? MemoryApp : null },
            { name: 'SettingsManager', obj: typeof SettingsManager !== 'undefined' ? SettingsManager : null },
            { name: 'WorldBookManager', obj: typeof WorldBookManager !== 'undefined' ? WorldBookManager : null },
            { name: 'ChatManager', obj: typeof ChatManager !== 'undefined' ? ChatManager : null },
            { name: 'ChatInterface', obj: typeof ChatInterface !== 'undefined' ? ChatInterface : null },
            { name: 'HomeManager', obj: typeof HomeManager !== 'undefined' ? HomeManager : null }
        ];

        managers.forEach(m => {
            if (m.obj && typeof m.obj.init === 'function') {
                m.obj.init();
                console.log(`${m.name} initialized.`);
            } else {
                console.warn(`${m.name} not found or has no init method.`);
            }
        });

        // 迁移旧的按角色存储的线下预设到全局存储
        if (typeof API !== 'undefined' && API.Offline && typeof API.Offline.migratePresetsToGlobal === 'function') {
            API.Offline.migratePresetsToGlobal();
        }

        console.log('RuriChat Initialized Successfully');

        // 5. Global Layout Lock (Prevent Body Scroll)
        document.body.addEventListener('touchmove', function(e) {
            if (e.target.closest('.overflow-y-auto') || e.target.closest('.overflow-x-auto')) {
                return; // Allow scrolling in specific areas
            }
            e.preventDefault();
        }, { passive: false });

        // 6. 页面关闭前刷入 DataStore 脏数据，防止数据丢失
        window.addEventListener('beforeunload', () => {
            if (typeof DataStore !== 'undefined') DataStore.flushSync();
        });

        // 7. 全局相机输入事件处理（移动端更可靠）
        setupGlobalCameraHandler();

    } catch (e) {
        console.error('Initialization Error:', e);
    }
}

/**
 * 全局相机处理已移至 chatRender/index.js _bindCameraInput() 统一管理
 * 此处不再重复绑定，避免拍照重复发送
 */
function setupGlobalCameraHandler() {
    // 已由 ChatInterface._bindCameraInput() 统一处理
    console.log('[Global] Camera handler delegated to ChatInterface._bindCameraInput()');
}

// 检测是否使用组件化加载模式
document.addEventListener('DOMContentLoaded', () => {
    /**
     * 启动前先初始化 AvatarStore（IndexedDB），完成头像迁移
     * 确保 getChars() 能从内存缓存同步读取头像
     */
    async function bootWithAvatarStore() {
        if (typeof AvatarStore !== 'undefined') {
            try {
                await AvatarStore.init();
                await AvatarStore.migrateFromLocalStorage();
            } catch (e) {
                console.error('[main.js] AvatarStore boot failed:', e);
            }
        }
    }

    async function startApp() {
        await bootWithAvatarStore();
        // 初始化 DataStore（通用数据存储），迁移 localStorage 数据到 IndexedDB
        if (typeof DataStore !== 'undefined') {
            try {
                await DataStore.init();
                await DataStore.migrateFromLocalStorage();
            } catch (e) {
                console.error('[main.js] DataStore boot failed:', e);
            }
        }
        initializeApp();
    }

    if (typeof ComponentLoader !== 'undefined' && typeof AppEvents !== 'undefined') {
        console.log('[main.js] Component mode detected, waiting for components...');
        AppEvents.on('app:ready', () => {
            console.log('[main.js] Components ready, initializing app...');
            startApp();
        });
    } else {
        console.log('[main.js] Traditional mode, initializing directly...');
        startApp();
    }
});
