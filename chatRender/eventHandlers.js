/**
 * chatRender/eventHandlers.js
 * 聊天渲染模块 - 事件处理器
 * 
 * 包含：
 * - 长按触摸事件处理
 * - 右键菜单显示/隐藏
 * - 右键菜单操作处理
 * - 删除模式相关操作
 */

const ChatEventHandlers = {
    // 状态变量
    currentContextMenuMsgIndex: null,
    longPressTimer: null,
    longPressTriggered: false,
    touchStartX: 0,
    touchStartY: 0,
    menuCloseHandler: null,
    menuCloseTimeout: null,

    /**
     * 触摸开始事件处理
     * @param {TouchEvent} event - 触摸事件
     * @param {number} index - 消息索引
     */
    handleTouchStart: function(event, index) {
        this.longPressTriggered = false;
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(50);
            this.showContextMenu(event, index, this.touchStartX, this.touchStartY);
        }, 500); // 500ms 触发长按
    },

    /**
     * 触摸移动事件处理
     * @param {TouchEvent} event - 触摸事件
     */
    handleTouchMove: function(event) {
        if (!this.longPressTimer) return;
        const moveX = event.touches[0].clientX;
        const moveY = event.touches[0].clientY;
        // 移动超过20px则取消长按
        if (Math.abs(moveX - this.touchStartX) > 20 || Math.abs(moveY - this.touchStartY) > 20) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },

    /**
     * 触摸结束事件处理
     * @param {TouchEvent} event - 触摸事件
     */
    handleTouchEnd: function(event) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        // 如果长按已触发，阻止默认点击行为
        if (this.longPressTriggered) {
            if (event.cancelable) event.preventDefault();
            this.longPressTriggered = false;
        }
    },

    /**
     * 显示右键菜单
     * @param {Event} event - 事件对象
     * @param {number} index - 消息索引
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    showContextMenu: function(event, index, x, y) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        this.currentContextMenuMsgIndex = index;
        
        const menu = document.getElementById('chat-context-menu');
        const container = document.getElementById('super-chat-interface');
        const containerRect = container.getBoundingClientRect();

        let clientX = x || 0;
        let clientY = y || 0;

        if (!clientX && !clientY) {
            if (event.touches && event.touches.length > 0) {
                clientX = event.touches[0].clientX;
                clientY = event.touches[0].clientY;
            } else if (event.changedTouches && event.changedTouches.length > 0) {
                 clientX = event.changedTouches[0].clientX;
                 clientY = event.changedTouches[0].clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }
        }

        if (!clientX && !clientY && event.target) {
            const rect = event.target.getBoundingClientRect();
            clientX = rect.left + rect.width / 2;
            clientY = rect.top + rect.height / 2;
        }

        let left = clientX - containerRect.left;
        let top = clientY - containerRect.top;
        
        if (left + 140 > containerRect.width) left = containerRect.width - 150;
        if (top + 180 > containerRect.height) top = top - 180;

        left = Math.max(10, left);
        top = Math.max(10, top);

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        menu.classList.remove('hidden');

        // 移除旧的监听器
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchend', this.menuCloseHandler);
        }

        // 创建新的关闭处理器
        this.menuCloseHandler = (e) => {
            if (menu.contains(e.target)) {
                return;
            }
            setTimeout(() => {
                this.closeContextMenu();
            }, 100);
        };

        // 延迟添加关闭监听器
        setTimeout(() => {
            document.addEventListener('click', this.menuCloseHandler);
            document.addEventListener('touchstart', this.menuCloseHandler, { passive: true });
        }, 300);
    },

    /**
     * 关闭右键菜单
     */
    closeContextMenu: function() {
        const menu = document.getElementById('chat-context-menu');
        menu.classList.add('hidden');
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchstart', this.menuCloseHandler);
            this.menuCloseHandler = null;
        }
    },

    /**
     * 处理右键菜单操作
     * @param {string} action - 操作类型
     * @param {Object} chatInterface - ChatInterface引用
     */
    handleContextAction: function(action, chatInterface) {
        // 阻止事件传播
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const index = this.currentContextMenuMsgIndex;
        if (index === null) return;
        
        const history = API.Chat.getHistory(chatInterface.currentCharId);
        const msg = history[index];
        if (!msg) return;

        // 延迟关闭菜单
        if (this.menuCloseTimeout) clearTimeout(this.menuCloseTimeout);
        this.menuCloseTimeout = setTimeout(() => {
            this.closeContextMenu();
        }, 50);

        if (action === 'copy') {
            navigator.clipboard.writeText(msg.content).then(() => alert('已复制'));
        } else if (action === 'quote') {
            chatInterface.startQuote(index);
        } else if (action === 'edit') {
            const senderName = msg.sender === 'user' ? '我' : API.Chat.getChar(chatInterface.currentCharId).remark;
            const newText = prompt('编辑 ' + senderName + ' 的消息:', msg.content);
            if (newText !== null && newText.trim()) {
                history[index].content = newText.trim();
                history[index].edited = true;
                history[index].editedAt = Date.now();
                API.Chat.saveHistory(chatInterface.currentCharId, history);
                chatInterface.renderMessages();
                ChatManager.renderList();
            }
        } else if (action === 'recall') {
            history[index].recalled = true;
            history[index].recalledAt = Date.now();
            API.Chat.saveHistory(chatInterface.currentCharId, history);
            chatInterface.renderMessages();
            ChatManager.renderList();
        } else if (action === 'delete') {
            chatInterface.enterDeleteMode(index);
        }
    },

    /**
     * 进入删除模式
     * @param {number} initialIndex - 初始选中的消息索引
     * @param {Object} chatInterface - ChatInterface引用
     */
    enterDeleteMode: function(initialIndex, chatInterface) {
        chatInterface.deleteMode = true;
        chatInterface.selectedForDelete = new Set([initialIndex]);
        chatInterface.renderMessages();
        this.showDeleteModeUI();
    },

    /**
     * 显示删除模式UI
     */
    showDeleteModeUI: function() {
        // 隐藏输入区域
        const inputArea = document.querySelector('#super-chat-interface .bg-\\[\\#f7f7f7\\].border-t');
        if (inputArea) inputArea.style.display = 'none';
        
        // 创建或显示删除模式工具栏
        let deleteBar = document.getElementById('delete-mode-bar');
        if (!deleteBar) {
            deleteBar = document.createElement('div');
            deleteBar.id = 'delete-mode-bar';
            deleteBar.className = 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center z-[100] shadow-lg';
            deleteBar.innerHTML = `
                <button onclick="ChatInterface.exitDeleteMode()" class="px-4 py-2 text-gray-600 font-medium">取消</button>
                <span id="delete-count" class="text-sm text-gray-500">已选择 1 条</span>
                <button onclick="ChatInterface.confirmDelete()" class="px-4 py-2 bg-red-500 text-white rounded-lg font-medium">删除</button>
            `;
            document.getElementById('super-chat-interface').appendChild(deleteBar);
        } else {
            deleteBar.style.display = 'flex';
        }
    },

    /**
     * 更新删除计数显示
     * @param {number} count - 选中数量
     */
    updateDeleteCount: function(count) {
        const countEl = document.getElementById('delete-count');
        if (countEl) {
            countEl.textContent = `已选择 ${count} 条`;
        }
    },

    /**
     * 切换删除选择状态
     * @param {number} index - 消息索引
     * @param {Object} chatInterface - ChatInterface引用
     */
    toggleDeleteSelection: function(index, chatInterface) {
        if (chatInterface.selectedForDelete.has(index)) {
            chatInterface.selectedForDelete.delete(index);
        } else {
            chatInterface.selectedForDelete.add(index);
        }
        this.updateDeleteCount(chatInterface.selectedForDelete.size);
        chatInterface.renderMessagesNoScroll();
    },

    /**
     * 确认删除选中的消息
     * @param {Object} chatInterface - ChatInterface引用
     */
    confirmDelete: function(chatInterface) {
        if (chatInterface.selectedForDelete.size === 0) {
            alert('请选择要删除的消息');
            return;
        }
        
        if (!confirm(`确定删除选中的 ${chatInterface.selectedForDelete.size} 条消息？`)) return;
        
        const history = API.Chat.getHistory(chatInterface.currentCharId);
        // 从后往前删除，避免索引错乱
        const indices = Array.from(chatInterface.selectedForDelete).sort((a, b) => b - a);
        indices.forEach(index => {
            history.splice(index, 1);
        });
        
        API.Chat.saveHistory(chatInterface.currentCharId, history);
        this.exitDeleteMode(chatInterface);
        ChatManager.renderList();
    },

    /**
     * 退出删除模式
     * @param {Object} chatInterface - ChatInterface引用
     */
    exitDeleteMode: function(chatInterface) {
        chatInterface.deleteMode = false;
        chatInterface.selectedForDelete = new Set();
        
        // 显示输入区域
        const inputArea = document.querySelector('#super-chat-interface .bg-\\[\\#f7f7f7\\].border-t');
        if (inputArea) inputArea.style.display = '';
        
        // 隐藏删除模式工具栏
        const deleteBar = document.getElementById('delete-mode-bar');
        if (deleteBar) deleteBar.style.display = 'none';
        
        chatInterface.renderMessages();
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatEventHandlers;
}
