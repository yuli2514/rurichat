/**
 * chatRender/transferHandler.js
 * 转账功能处理器
 * 
 * 包含：
 * - 转账界面（金额输入、备注）
 * - 支付密码输入弹窗
 * - 转账卡片消息
 * - 收款功能
 */

const TransferHandler = {
    // 支付密码（模拟）
    PAYMENT_PASSWORD: '123456',
    
    // 当前输入的密码
    currentPassword: '',
    
    // 当前转账金额和备注
    currentAmount: '',
    currentRemark: '',
    
    // 防止面板立即关闭的标志
    panelJustOpened: false,

    /**
     * 打开转账界面
     */
    openTransferPanel: function(event) {
        console.log('[TransferHandler] openTransferPanel called');
        
        // 阻止事件冒泡，防止触发其他监听器
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        // 设置标志，防止立即关闭
        this.panelJustOpened = true;
        setTimeout(() => {
            this.panelJustOpened = false;
        }, 500);
        
        this.currentAmount = '';
        this.currentRemark = '';
        
        const charId = ChatInterface.currentCharId;
        console.log('[TransferHandler] charId:', charId);
        const char = API.Chat.getChar(charId);
        const charName = char ? char.remark : '对方';
        
        // 创建转账面板HTML
        const panelHtml = `
            <div id="transfer-panel" class="transfer-panel">
                <div class="transfer-panel-header">
                    <button onclick="TransferHandler.closeTransferPanel()" class="transfer-close-btn">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <span class="transfer-header-title">转账</span>
                    <span class="transfer-header-placeholder"></span>
                </div>
                
                <div class="transfer-panel-body">
                    <div class="transfer-to-info">
                        <span>转账给 </span>
                        <span class="transfer-to-name">${charName}</span>
                    </div>
                    
                    <div class="transfer-amount-section">
                        <div class="transfer-amount-display">
                            <span class="transfer-currency">￥</span>
                            <input type="text" id="transfer-amount-input" class="transfer-amount-input" 
                                   placeholder="0.00" inputmode="decimal"
                                   oninput="TransferHandler.handleAmountInput(this)">
                        </div>
                    </div>
                    
                    <div class="transfer-remark-section">
                        <input type="text" id="transfer-remark-input" class="transfer-remark-input"
                               placeholder="添加转账说明" maxlength="20"
                               oninput="TransferHandler.handleRemarkInput(this)">
                        <span class="transfer-remark-count">0/20</span>
                    </div>
                </div>
                
                <div class="transfer-panel-footer">
                    <button id="transfer-submit-btn" class="transfer-submit-btn disabled" 
                            onclick="TransferHandler.showPasswordPanel()">
                        转账
                    </button>
                </div>
            </div>
        `;
        
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'transfer-overlay';
        overlay.className = 'transfer-overlay';
        overlay.innerHTML = panelHtml;
        
        // 添加点击关闭事件
        overlay.addEventListener('click', (e) => {
            // 如果面板刚打开，不处理关闭
            if (this.panelJustOpened) {
                console.log('[TransferHandler] Panel just opened, ignoring close');
                return;
            }
            if (e.target === overlay) {
                this.closeTransferPanel();
            }
        });
        
        // 阻止面板内部的点击事件冒泡
        const panel = overlay.querySelector('.transfer-panel');
        if (panel) {
            panel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            panel.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: true });
        }
        
        document.getElementById('super-chat-interface').appendChild(overlay);
        
        // 聚焦金额输入框
        setTimeout(() => {
            const input = document.getElementById('transfer-amount-input');
            if (input) input.focus();
        }, 100);
    },

    /**
     * 关闭转账界面
     */
    closeTransferPanel: function() {
        const overlay = document.getElementById('transfer-overlay');
        if (overlay) {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 200);
        }
    },

    /**
     * 处理金额输入
     */
    handleAmountInput: function(input) {
        let value = input.value;
        
        // 只允许数字和小数点
        value = value.replace(/[^\d.]/g, '');
        
        // 只允许一个小数点
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // 小数点后最多两位
        if (parts.length === 2 && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].substring(0, 2);
        }
        
        // 限制最大金额
        if (parseFloat(value) > 200000) {
            value = '200000';
        }
        
        input.value = value;
        this.currentAmount = value;
        
        // 更新按钮状态
        const btn = document.getElementById('transfer-submit-btn');
        if (parseFloat(value) > 0) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.add('disabled');
        }
    },

    /**
     * 处理备注输入
     */
    handleRemarkInput: function(input) {
        this.currentRemark = input.value;
        const countSpan = input.parentElement.querySelector('.transfer-remark-count');
        countSpan.textContent = `${input.value.length}/20`;
    },

    /**
     * 显示支付密码面板
     */
    showPasswordPanel: function() {
        if (!this.currentAmount || parseFloat(this.currentAmount) <= 0) {
            return;
        }
        
        this.currentPassword = '';
        
        const passwordHtml = `
            <div id="password-panel" class="password-panel">
                <div class="password-panel-content">
                    <div class="password-panel-header">
                        <button onclick="TransferHandler.closePasswordPanel()" class="password-close-btn">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <span class="password-title">请输入支付密码</span>
                    </div>
                    
                    <div class="password-amount-display">
                        <span class="password-currency">￥</span>
                        <span class="password-amount">${this.formatAmount(this.currentAmount)}</span>
                    </div>
                    
                    <div class="password-dots-container">
                        <div class="password-dot" id="pwd-dot-0"></div>
                        <div class="password-dot" id="pwd-dot-1"></div>
                        <div class="password-dot" id="pwd-dot-2"></div>
                        <div class="password-dot" id="pwd-dot-3"></div>
                        <div class="password-dot" id="pwd-dot-4"></div>
                        <div class="password-dot" id="pwd-dot-5"></div>
                    </div>
                    
                    <div class="password-error-msg" id="password-error"></div>
                    
                    <div class="password-keypad">
                        <div class="keypad-row">
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('1')">1</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('2')">2</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('3')">3</button>
                        </div>
                        <div class="keypad-row">
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('4')">4</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('5')">5</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('6')">6</button>
                        </div>
                        <div class="keypad-row">
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('7')">7</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('8')">8</button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('9')">9</button>
                        </div>
                        <div class="keypad-row">
                            <button class="keypad-btn keypad-empty"></button>
                            <button class="keypad-btn" onclick="TransferHandler.inputPassword('0')">0</button>
                            <button class="keypad-btn keypad-delete" onclick="TransferHandler.deletePassword()">
                                <i class="fa-solid fa-delete-left"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const passwordOverlay = document.createElement('div');
        passwordOverlay.id = 'password-overlay';
        passwordOverlay.className = 'password-overlay';
        passwordOverlay.innerHTML = passwordHtml;
        
        document.getElementById('super-chat-interface').appendChild(passwordOverlay);
    },

    /**
     * 关闭密码面板
     */
    closePasswordPanel: function() {
        const overlay = document.getElementById('password-overlay');
        if (overlay) {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 200);
        }
    },

    /**
     * 输入密码数字
     */
    inputPassword: function(digit) {
        if (this.currentPassword.length >= 6) return;
        
        this.currentPassword += digit;
        
        // 更新显示
        for (let i = 0; i < 6; i++) {
            const dot = document.getElementById(`pwd-dot-${i}`);
            if (i < this.currentPassword.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        }
        
        // 输满6位自动验证
        if (this.currentPassword.length === 6) {
            setTimeout(() => this.verifyPassword(), 200);
        }
    },

    /**
     * 删除密码数字
     */
    deletePassword: function() {
        if (this.currentPassword.length === 0) return;
        
        this.currentPassword = this.currentPassword.slice(0, -1);
        
        // 更新显示
        for (let i = 0; i < 6; i++) {
            const dot = document.getElementById(`pwd-dot-${i}`);
            if (i < this.currentPassword.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        }
        
        // 清除错误提示
        document.getElementById('password-error').textContent = '';
    },

    /**
     * 验证密码
     */
    verifyPassword: function() {
        if (this.currentPassword === this.PAYMENT_PASSWORD) {
            // 密码正确，发送转账
            this.sendTransferMessage();
        } else {
            // 密码错误
            document.getElementById('password-error').textContent = '支付密码错误，请重试';
            this.currentPassword = '';
            
            // 清除所有点
            for (let i = 0; i < 6; i++) {
                document.getElementById(`pwd-dot-${i}`).classList.remove('filled');
            }
            
            // 震动反馈
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    },

    /**
     * 发送转账消息
     */
    sendTransferMessage: function() {
        const charId = ChatInterface.currentCharId;
        const char = API.Chat.getChar(charId);
        
        const transferMsg = {
            id: Date.now(),
            sender: 'user',
            type: 'transfer',
            content: '',
            timestamp: Date.now(),
            transferData: {
                amount: parseFloat(this.currentAmount),
                remark: this.currentRemark || '',
                status: 'pending', // pending, received
                fromUser: true,
                toName: char ? char.remark : '对方',
                createdAt: Date.now()
            }
        };
        
        API.Chat.addMessage(charId, transferMsg);
        
        // 关闭所有面板
        this.closePasswordPanel();
        this.closeTransferPanel();
        
        // 重新渲染消息
        ChatInterface.renderMessages();
        
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }
        
    },

    /**
     * 格式化金额显示
     */
    formatAmount: function(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2);
    },

    /**
     * 领取转账（AI角色领取用户转账）
     * @param {number} msgIndex - 消息索引
     */
    receiveTransfer: function(msgIndex) {
        const charId = ChatInterface.currentCharId;
        const history = API.Chat.getHistory(charId);
        
        if (msgIndex >= 0 && msgIndex < history.length) {
            const msg = history[msgIndex];
            if (msg.type === 'transfer' && msg.transferData && msg.transferData.status === 'pending') {
                msg.transferData.status = 'received';
                msg.transferData.receivedAt = Date.now();
                API.Chat.saveHistory(charId, history);
                ChatInterface.renderMessages();
            }
        }
    },

    /**
     * AI发送转账给用户
     * @param {number} amount - 金额
     * @param {string} remark - 备注
     */
    botSendTransfer: function(amount, remark = '') {
        const charId = ChatInterface.currentCharId;
        const char = API.Chat.getChar(charId);
        
        const transferMsg = {
            id: Date.now(),
            sender: 'char',
            type: 'transfer',
            content: '',
            timestamp: Date.now(),
            transferData: {
                amount: parseFloat(amount),
                remark: remark,
                status: 'pending',
                fromUser: false,
                fromName: char ? char.remark : '对方',
                createdAt: Date.now()
            }
        };
        
        API.Chat.addMessage(charId, transferMsg);
        ChatInterface.renderMessages();
        
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }
    },

    /**
     * 用户点击领取AI的转账
     * @param {number} msgIndex - 消息索引
     */
    userReceiveTransfer: function(msgIndex) {
        const charId = ChatInterface.currentCharId;
        const history = API.Chat.getHistory(charId);
        
        if (msgIndex >= 0 && msgIndex < history.length) {
            const msg = history[msgIndex];
            if (msg.type === 'transfer' && msg.transferData && 
                msg.transferData.status === 'pending' && !msg.transferData.fromUser) {
                msg.transferData.status = 'received';
                msg.transferData.receivedAt = Date.now();
                API.Chat.saveHistory(charId, history);
                ChatInterface.renderMessages();
            }
        }
    },

    /**
     * 处理转账卡片点击
     * @param {number} msgIndex - 消息索引
     */
    handleTransferClick: function(msgIndex) {
        const charId = ChatInterface.currentCharId;
        const history = API.Chat.getHistory(charId);
        
        if (msgIndex >= 0 && msgIndex < history.length) {
            const msg = history[msgIndex];
            if (msg.type === 'transfer' && msg.transferData) {
                // 已领取状态不做任何操作
                if (msg.transferData.status === 'received') {
                    return;
                }
                
                // 用户发的转账，用户自己不能领取，等待AI根据剧情判断
                if (msg.transferData.fromUser) {
                    // 不做任何操作
                    return;
                } else {
                    // AI发的转账，用户点击领取
                    this.userReceiveTransfer(msgIndex);
                }
            }
        }
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransferHandler;
}
