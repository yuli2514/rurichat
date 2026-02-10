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

document.addEventListener('DOMContentLoaded', () => {
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
            { name: 'EmojiManager', obj: EmojiManager },
            { name: 'MemoryApp', obj: MemoryApp },
            { name: 'SettingsManager', obj: SettingsManager },
            { name: 'WorldBookManager', obj: WorldBookManager },
            { name: 'ChatManager', obj: ChatManager },
            { name: 'ChatInterface', obj: ChatInterface },
            { name: 'HomeManager', obj: HomeManager }
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

    } catch (e) {
        console.error('Initialization Error:', e);
    }
});
