/**
 * 组件加载器 - 动态加载 HTML 组件
 * 支持组件间通信和事件总线
 */
const ComponentLoader = {
    // 组件缓存
    cache: {},
    
    // 已加载的组件列表
    loaded: new Set(),
    
    // 事件总线 - 用于组件间通信
    eventBus: {
        events: {},
        
        // 订阅事件
        on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
            return () => this.off(event, callback);
        },
        
        // 取消订阅
        off(event, callback) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        },
        
        // 触发事件
        emit(event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Event handler error for ${event}:`, e);
                }
            });
        }
    },
    
    /**
     * 加载单个组件
     * @param {string} name - 组件名称
     * @param {string} containerId - 容器元素ID
     * @param {string} insertPosition - 插入位置: 'replace' | 'append' | 'prepend' | 'before' | 'after'
     */
    async load(name, containerId, insertPosition = 'append') {
        const url = `components/${name}.html`;
        
        try {
            // 检查缓存
            let html = this.cache[name];
            if (!html) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load component: ${name}`);
                }
                html = await response.text();
                this.cache[name] = html;
            }
            
            // 获取容器
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container not found: ${containerId}`);
            }
            
            // 插入 HTML
            switch (insertPosition) {
                case 'replace':
                    container.innerHTML = html;
                    break;
                case 'prepend':
                    container.insertAdjacentHTML('afterbegin', html);
                    break;
                case 'before':
                    container.insertAdjacentHTML('beforebegin', html);
                    break;
                case 'after':
                    container.insertAdjacentHTML('afterend', html);
                    break;
                case 'append':
                default:
                    container.insertAdjacentHTML('beforeend', html);
            }
            
            this.loaded.add(name);
            this.eventBus.emit('component:loaded', { name, containerId });
            
            return true;
        } catch (error) {
            console.error(`Error loading component ${name}:`, error);
            return false;
        }
    },
    
    /**
     * 批量加载组件
     * @param {Array} components - [{name, containerId, position}]
     */
    async loadAll(components) {
        const results = await Promise.all(
            components.map(c => this.load(c.name, c.containerId, c.position))
        );
        
        const allLoaded = results.every(r => r);
        if (allLoaded) {
            this.eventBus.emit('components:allLoaded');
        }
        return allLoaded;
    },
    
    /**
     * 初始化所有组件
     */
    async init() {
        const components = [
            { name: 'system-ui', containerId: 'phone-shell', position: 'prepend' },
            { name: 'home-screen', containerId: 'phone-shell', position: 'append' },
            { name: 'chat-app', containerId: 'phone-shell', position: 'append' },
            { name: 'profile-app', containerId: 'phone-shell', position: 'append' },
            { name: 'modals', containerId: 'phone-shell', position: 'append' },
            { name: 'memory-app', containerId: 'phone-shell', position: 'append' },
            { name: 'worldbook-app', containerId: 'phone-shell', position: 'append' },
            { name: 'chat-interface', containerId: 'phone-shell', position: 'append' },
            { name: 'chat-settings', containerId: 'phone-shell', position: 'append' },
            { name: 'settings-app', containerId: 'phone-shell', position: 'append' },
            { name: 'offline-mode', containerId: 'phone-shell', position: 'append' },
            { name: 'css-preset-modal', containerId: 'phone-shell', position: 'append' }
        ];
        
        console.log('[ComponentLoader] Starting to load components...');
        const success = await this.loadAll(components);
        
        if (success) {
            console.log('[ComponentLoader] All components loaded successfully');
        } else {
            console.error('[ComponentLoader] Some components failed to load');
        }
        
        return success;
    },
    
    /**
     * 检查组件是否已加载
     */
    isLoaded(name) {
        return this.loaded.has(name);
    },
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.cache = {};
    }
};

// 组件间通信快捷方法
const AppEvents = ComponentLoader.eventBus;

// 常用事件名称常量
const EVENTS = {
    // 导航事件
    NAV_TO_CHAT: 'nav:toChat',
    NAV_TO_HOME: 'nav:toHome',
    NAV_TO_SETTINGS: 'nav:toSettings',
    NAV_BACK: 'nav:back',
    
    // 聊天事件
    CHAT_OPEN: 'chat:open',
    CHAT_CLOSE: 'chat:close',
    CHAT_MESSAGE_SENT: 'chat:messageSent',
    CHAT_MESSAGE_RECEIVED: 'chat:messageReceived',
    
    // 角色事件
    CHARACTER_SELECTED: 'character:selected',
    CHARACTER_UPDATED: 'character:updated',
    CHARACTER_DELETED: 'character:deleted',
    
    // 设置事件
    SETTINGS_CHANGED: 'settings:changed',
    THEME_CHANGED: 'theme:changed',
    
    // 数据事件
    DATA_SAVED: 'data:saved',
    DATA_LOADED: 'data:loaded'
};

// 导出给全局使用
window.ComponentLoader = ComponentLoader;
window.AppEvents = AppEvents;
window.EVENTS = EVENTS;
