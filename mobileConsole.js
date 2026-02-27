/**
 * 移动端调试控制台
 * 在页面上显示一个悬浮的控制台窗口
 */
const MobileConsole = {
    isEnabled: false,
    consoleDiv: null,
    logContainer: null,
    maxLogs: 100,

    /**
     * 初始化移动端控制台
     */
    init: function() {
        // 只在移动端启用
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) return;

        this.createConsoleUI();
        this.interceptConsole();
        this.isEnabled = true;
        
        console.log('[MobileConsole] 移动端调试控制台已启用');
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
        `;

        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            background: #333;
            color: white;
            padding: 5px 10px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 5px 5px 0 0;
        `;
        titleBar.innerHTML = `
            <span>📱 移动端控制台</span>
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

        // 创建显示按钮
        const showButton = document.createElement('button');
        showButton.id = 'mobile-console-btn';
        showButton.innerHTML = '📱';
        showButton.style.cssText = `
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
        `;
        showButton.onclick = () => this.show();

        document.body.appendChild(this.consoleDiv);
        document.body.appendChild(showButton);
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
     * 显示控制台
     */
    show: function() {
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'flex';
            document.getElementById('mobile-console-btn').style.display = 'none';
        }
    },

    /**
     * 隐藏控制台
     */
    hide: function() {
        if (this.consoleDiv) {
            this.consoleDiv.style.display = 'none';
            document.getElementById('mobile-console-btn').style.display = 'block';
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