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

        console.log('RuriChat Initialized Successfully');

        // 5. Global Layout Lock (Prevent Body Scroll)
        document.body.addEventListener('touchmove', function(e) {
            if (e.target.closest('.overflow-y-auto') || e.target.closest('.overflow-x-auto')) {
                return; // Allow scrolling in specific areas
            }
            e.preventDefault();
        }, { passive: false });

        // 6. 全局相机输入事件处理（移动端更可靠）
        setupGlobalCameraHandler();

    } catch (e) {
        console.error('Initialization Error:', e);
    }
}

/**
 * 设置全局相机输入事件处理
 * 注意：ChatInterface._bindCameraInput() 已经绑定了 camera-input 的 change 事件
 * 这里只作为兜底处理器，仅在 ChatInterface 的处理器未绑定时才处理
 */
function setupGlobalCameraHandler() {
    // 使用事件委托监听 document 上的 change 事件
    document.addEventListener('change', async function(e) {
        if (e.target && e.target.id === 'camera-input') {
            console.log('[Global] Camera input change detected');
            
            // 如果 ChatInterface 已经绑定了处理器，跳过全局处理（避免双重触发）
            if (e.target._boundByInit) {
                console.log('[Global] Camera input already handled by ChatInterface, skipping');
                return;
            }
            
            console.log('[Global] Files:', e.target.files);
            
            if (e.target.files && e.target.files.length > 0) {
                if (typeof ChatInterface !== 'undefined' && ChatInterface.handleCameraCapture) {
                    try {
                        await ChatInterface.handleCameraCapture(e.target);
                    } catch (err) {
                        console.error('[Global] Camera capture error:', err);
                    }
                }
            }
        }
    });
    
    console.log('[Global] Camera handler setup complete');
}

// 检测是否使用组件化加载模式
document.addEventListener('DOMContentLoaded', () => {
    // 如果存在 ComponentLoader（组件化模式），等待组件加载完成
    if (typeof ComponentLoader !== 'undefined' && typeof AppEvents !== 'undefined') {
        console.log('[main.js] Component mode detected, waiting for components...');
        AppEvents.on('app:ready', () => {
            console.log('[main.js] Components ready, initializing app...');
            initializeApp();
        });
    } else {
        // 传统模式：HTML 已在页面中，直接初始化
        console.log('[main.js] Traditional mode, initializing directly...');
        initializeApp();
    }
});
