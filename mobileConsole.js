/**
 * 移动端调试控制台
 * 在页面上显示一个悬浮的控制台窗口
 */
const MobileConsole = {
    isEnabled: false,
    isVisible: false,
    consoleDiv: null,
    logContainer: null,
    showButton: null,
    maxLogs: 100,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },

    /**
     * 初始化移动端控制台
     */
    init: function() {
        // 只在移动端启用
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) return;

        this.createConsoleUI();
        this.interceptConsole();
        this.setupDragHandlers();
        
        // 检查用户设置
        const enabled = localStorage.getItem('mobileConsoleEnabled') === 'true';
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
        
        console.log('[MobileConsole] 移动端调试控制台已初始化');
    },

    /**
     * 创建控制台UI
     */
    createConsoleUI: function() {
        // 创建控制台容器
        this.consoleDiv = document.createElement('div');
        this.consoleDiv.id = 'mobile-console';
        this.consoleDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 90%;
            max-width: 400px;
            height: 200px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            border: 1px solid #333;
            border-radius: 5px;
            z-index: 9999;
            display: none;
            flex-direction: column;
            touch-action: none;
        `;

        // 创建标题栏（可拖拽）
        const titleBar = document.createElement('div');
        titleBar.id = 'mobile-console-titlebar';
        titleBar.style.cssText = `
            background: #333;
            color: white;
            padding: 5px 10px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 5px 5px 0 0;
            cursor: move;
            user-select: none;
        `;
        titleBar.innerHTML = `
            <span>📱 移动端控制台 (可拖拽)</span>
            <div>
                <button onclick="MobileConsole.clear()" style="background: #666; color: white; border: none; padding: 2px 6px; margin-right: 5px; border-radius: 3px; font-size: 10px;">清空</button>
                <button onclick="MobileConsole.hide()" style="background: #f44; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">×</button>
            </div>
        `;

        // 创建日志容器
        this.logContainer = document.createElement('div');
        this.logContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 5px;
            line-height: 1.2;
        `;

        this.consoleDiv.appendChild(titleBar);
        this.consoleDiv.appendChild(this.logContainer);

        // 创建显示按钮（也可拖拽）
        this.showButton = document.createElement('button');
        this.showButton.id = 'mobile-console-btn';
        this.showButton.innerHTML = '📱';
        this.showButton.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 20px;
            z-index: 9998;
            cursor: pointer;
            touch-action: none;
        `;
        this.showButton.onclick = () => this.show();

        document.body.appendChild(this.consoleDiv);
        document.body.appendChild(this.showButton);
    },

    /**
     * 拦截console方法
     */
    interceptConsole: function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addLog('LOG', args.join(' '), '#00ff00');
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            this.addLog('ERROR', args.join(' '), '#ff4444');
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addLog('WARN', args.join(' '), '#ffaa00');
        };
    },

    /**
     * 添加日志
     */
    addLog: function(type, message, color) {
        if (!this.isEnabled || !this.logContainer) return;

        const time = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.cssText = `
            color: ${color};
            margin-bottom: 2px;
            word-break: break-all;
        `;
        logEntry.innerHTML = `<span style="color: #888;">[${time}]</span> <span style="color: #aaa;">[${type}]</span> ${message}`;

        this.logContainer.appendChild(logEntry);

        // 限制日志数量
        while (this.logContainer.children.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }

        // 自动滚动到底部
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    /**
     * 设置拖拽处理器
     */
    setupDragHandlers: function() {
        // 控制台拖拽
        const titleBar = document.getElementById('mobile-console-titlebar');
        if (titleBar) {
            titleBar.addEventListener('touchstart', (e) => this.startDrag(e, this.consoleDiv), { passive: false });
            titleBar.addEventListener('mousedown', (e) => this.startDrag(e, this.consoleDiv));
        }

        // 按钮拖拽
        if (this.showButton) {
            this.showButton.addEventListener('touchstart', (e) => this.startDrag(e, this.showButton), { passive: false });
            this.showButton.addEventListener('mousedown', (e) => this.startDrag(e, this.showButton));
        }

        // 全局拖拽事件
        document.addEventListener('touchmove', (e) => this.drag(e), { passive: false });
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('touchend', () => this.endDrag());
        document.addEventListener('mouseup', () => this.endDrag());
    },

    /**
     * 开始拖拽
     */
    startDrag: function(e, element) {
        if (e.target.tagName === 'BUTTON') return; // 不拖拽按钮

        this.isDragging = true;
        this.dragElement = element;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = element.getBoundingClientRect();
        
        this.dragOffset.x = clientX - rect.left;
        this.dragOffset.y = clientY - rect.top;
        
        e.preventDefault();
    },

    /**
     * 拖拽中
     */
    drag: function(e) {
        if (!this.isDragging || !this.dragElement) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        let newX = clientX - this.dragOffset.x;
        let newY = clientY - this.dragOffset.y;
        
        // 边界检查
        const maxX = window.innerWidth - this.dragElement.offsetWidth;
        const maxY = window.innerHeight - this.dragElement.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        this.dragElement.style.left = newX + 'px';
        this.dragElement.style.top = newY + 'px';
        this.dragElement.style.right = 'auto';
        this.dragElement.style.bottom = 'auto';
        
        e.preventDefault();
    },

    /**
     * 结束拖拽
     */
    endDrag: function() {
        this.isDragging = false;
        this.dragElement = null;
    },

    /**
     * 启用控制台
     */
    enable: function() {
        this.isEnabled = true;
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'none';
        }
        if (this.showButton) {
            this.showButton.style.display = 'block';
        }
        console.log('[MobileConsole] 控制台已启用');
    },

    /**
     * 禁用控制台
     */
    disable: function() {
        this.isEnabled = false;
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'none';
        }
        if (this.showButton) {
            this.showButton.style.display = 'none';
        }
        console.log('[MobileConsole] 控制台已禁用');
    },

    /**
     * 显示控制台
     */
    show: function() {
        if (!this.isEnabled) return;
        
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'flex';
            this.isVisible = true;
        }
        if (this.showButton) {
            this.showButton.style.display = 'none';
        }
    },

    /**
     * 隐藏控制台
     */
    hide: function() {
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'none';
            this.isVisible = false;
        }
        if (this.showButton && this.isEnabled) {
            this.showButton.style.display = 'block';
        }
    },

    /**
     * 清空日志
     */
    clear: function() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }
    }
};

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MobileConsole.init());
} else {
    MobileConsole.init();
}

// 导出到全局
window.MobileConsole = MobileConsole;