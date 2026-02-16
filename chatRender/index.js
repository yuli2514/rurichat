/**
 * chatRender/index.js
 * 聊天渲染模块 - 核心入口
 * 
 * 整合所有子模块，提供统一的 ChatInterface 对外接口
 * 保持与原 chatRender.js 完全兼容的API
 * 
 * 子模块：
 * - utils.js: 工具函数（图片生成、压缩、滚动）
 * - messageBuilder.js: 消息HTML构建
 * - eventHandlers.js: 事件处理（触摸、右键菜单、删除模式）
 * - emojiPanel.js: 表情包面板
 * - mediaHandlers.js: 媒体处理（拍照、相册）
 * - aiHandler.js: AI交互处理
 */

const ChatInterface = {
    // ==================== 状态变量 ====================
    currentCharId: null,
    deleteMode: false,
    selectedForDelete: new Set(),
    loadedMessageCount: 80,
    messageLoadStep: 80,
    _renderRAF: null,
    currentQuote: null,

    // ==================== 初始化 ====================
    init: function() {
        const input = document.getElementById('chat-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendUserMessage();
                }
            });
        }
        
        // 绑定相机输入事件（移动端更可靠）
        this._bindCameraInput();
    },
    
    /**
     * 绑定相机输入事件
     * 使用多种事件监听确保移动端兼容性
     */
    _bindCameraInput: function() {
        const cameraInput = document.getElementById('camera-input');
        if (cameraInput && !cameraInput._boundByInit) {
            cameraInput._boundByInit = true;
            
            // 统一使用 change 事件（移动端和桌面端均支持）
            // 只绑定一次，作为拍照的唯一入口
            cameraInput.addEventListener('change', async (e) => {
                console.log('[ChatInterface] Camera change triggered');
                if (e.target.files && e.target.files.length > 0) {
                    await this.handleCameraCapture(e.target);
                    // 清空 value，允许再次选择同一文件
                    cameraInput.value = '';
                }
            });
            console.log('[ChatInterface] Camera input event listener bound (single change)');
        }
    },

    // ==================== 工具函数代理 ====================
    generateTextImageCard: function(text) {
        return ChatRenderUtils.generateTextImageCard(text);
    },

    scrollToBottom: function() {
        ChatRenderUtils.scrollToBottom();
    },

    compressImageForChat: function(base64) {
        return ChatRenderUtils.compressImageForChat(base64);
    },

    compressImage: function(base64, maxSize, quality) {
        return ChatRenderUtils.compressImage(base64, maxSize, quality);
    },

    // ==================== 聊天界面控制 ====================
    open: function(charId) {
        try {
            this.currentCharId = charId;
            this.loadedMessageCount = 80;
            
            // 确保相机输入事件已绑定
            this._bindCameraInput();
            
            const char = API.Chat.getChar(charId);
            if (!char) {
                console.error('Character not found');
                return;
            }

            // 更新聊天界面顶栏
            const headerAvatar = document.getElementById('chat-header-avatar');
            if (headerAvatar) headerAvatar.src = char.avatar;
            
            const headerName = document.getElementById('chat-header-name');
            if (headerName) headerName.textContent = char.remark;

            // 关闭Chat App，显示聊天界面
            const chatApp = document.getElementById('chat-app');
            const superInterface = document.getElementById('super-chat-interface');
            
            if (chatApp) chatApp.classList.add('hidden');
            if (superInterface) superInterface.classList.remove('hidden');

            // 应用壁纸
            const messagesArea = document.getElementById('chat-messages');
            if (char.settings && char.settings.wallpaper) {
                messagesArea.style.backgroundImage = 'url(' + char.settings.wallpaper + ')';
                messagesArea.style.backgroundSize = 'cover';
                messagesArea.style.backgroundPosition = 'center';
            } else {
                messagesArea.style.backgroundImage = '';
            }

            // 应用自定义CSS（仅设置样式，不触发保存回调）
            {
                let style = document.getElementById('char-custom-css');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'char-custom-css';
                    document.head.appendChild(style);
                }
                style.textContent = (char.settings && char.settings.customCss) ? char.settings.customCss : '';
            }

            // 应用CSS变量（直接设置CSS变量，不通过CssManager避免重复保存）
            {
                const s = char.settings || {};
                const cssBubble = s.cssBubble || 1.0;
                const cssFont = s.cssFont || 16;
                const cssAvatar = s.cssAvatar || 40;
                const cssToolbar = s.cssToolbar || 20;
                const cssAvatarRadius = s.cssAvatarRadius !== undefined ? s.cssAvatarRadius : 50;

                const msgArea = document.getElementById('chat-messages');
                if (msgArea) {
                    msgArea.style.setProperty('--chat-bubble-padding-v', (10 * cssBubble) + 'px');
                    msgArea.style.setProperty('--chat-bubble-padding-h', (14 * cssBubble) + 'px');
                    msgArea.style.setProperty('--chat-font-size', cssFont + 'px');
                    msgArea.style.setProperty('--chat-avatar-size', cssAvatar + 'px');
                    msgArea.style.setProperty('--chat-avatar-radius', cssAvatarRadius + '%');
                }

                const chatInterfaceEl = document.getElementById('super-chat-interface');
                if (chatInterfaceEl) {
                    chatInterfaceEl.style.setProperty('--chat-toolbar-icon-size', cssToolbar + 'px');
                }
            }

            // 先渲染消息，表情包面板延迟渲染避免阻塞主线程
            this.renderMessages();
            setTimeout(() => this.renderEmojiGrid(), 300);
        } catch (e) {
            console.error('Error opening chat:', e);
            alert('打开聊天失败: ' + e.message);
        }
    },

    closeToList: function() {
        document.getElementById('super-chat-interface').classList.add('hidden');
        document.getElementById('chat-app').classList.remove('hidden');
    },

    close: function() {
        document.getElementById('super-chat-interface').classList.add('hidden');
        this.currentCharId = null;
    },

    // ==================== 消息渲染 ====================
    loadMoreMessages: function() {
        const container = document.getElementById('chat-messages');
        const scrollHeightBefore = container.scrollHeight;
        this.loadedMessageCount += this.messageLoadStep;
        this.renderMessagesKeepPosition(scrollHeightBefore);
    },

    renderMessagesKeepPosition: function(scrollHeightBefore) {
        const container = document.getElementById('chat-messages');
        const history = API.Chat.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        
        if (this._renderRAF) cancelAnimationFrame(this._renderRAF);
        
        this._renderRAF = requestAnimationFrame(() => {
            const html = this._buildMessagesHtml(history, char);
            container.innerHTML = html;
            
            // 保持滚动位置
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
        });
    },

    renderMessages: function() {
        const container = document.getElementById('chat-messages');
        const history = API.Chat.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        
        if (this._renderRAF) cancelAnimationFrame(this._renderRAF);
        
        this._renderRAF = requestAnimationFrame(() => {
            const html = this._buildMessagesHtml(history, char);
            container.innerHTML = html;
            this.scrollToBottom();
        });
    },

    /**
     * 增量追加单条消息到聊天区域（避免全量重渲染导致卡顿）
     * @param {Object} msg - 消息对象
     * @param {number} index - 消息在历史记录中的索引
     */
    appendSingleMessage: function(msg, index) {
        const container = document.getElementById('chat-messages');
        const char = API.Chat.getChar(this.currentCharId);
        const history = API.Chat.getHistory(this.currentCharId);
        if (!char || !container) return;

        const charSettings = char.settings || {};
        const showAvatarTimestamp = charSettings.timestampAvatar || false;
        const showBubbleTimestamp = charSettings.timestampBubble || false;

        // 检查是否需要时间戳分隔
        let timestampHtml = '';
        if (history.length <= 1) {
            timestampHtml = MessageBuilder.buildTimestamp(msg.timestamp);
        } else {
            // 找前一条消息
            const prevMsg = index > 0 ? history[index - 1] : null;
            if (prevMsg) {
                const timeDiff = (msg.timestamp - prevMsg.timestamp) / 1000 / 60;
                if (timeDiff > 3) {
                    timestampHtml = MessageBuilder.buildTimestamp(msg.timestamp);
                }
            }
        }

        const msgHtml = MessageBuilder.buildMessage({
            msg,
            index,
            char,
            history,
            deleteMode: this.deleteMode,
            selectedForDelete: this.selectedForDelete,
            showAvatarTimestamp: showAvatarTimestamp,
            showBubbleTimestamp: showBubbleTimestamp
        });

        container.insertAdjacentHTML('beforeend', timestampHtml + msgHtml);
        this.scrollToBottom();
    },

    renderMessagesNoScroll: function() {
        const container = document.getElementById('chat-messages');
        const history = API.Chat.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        const scrollTop = container.scrollTop;
        
        if (this._renderRAF) cancelAnimationFrame(this._renderRAF);
        
        this._renderRAF = requestAnimationFrame(() => {
            const html = this._buildMessagesHtml(history, char);
            container.innerHTML = html;
            container.scrollTop = scrollTop;
        });
    },

    /**
     * 内部方法：构建消息列表HTML
     */
    _buildMessagesHtml: function(history, char) {
        const maxMessages = this.loadedMessageCount;
        const startIndex = Math.max(0, history.length - maxMessages);
        const renderedHistory = history.slice(startIndex);
        
        // 读取时间戳显示设置
        const charSettings = char.settings || {};
        const showAvatarTimestamp = charSettings.timestampAvatar || false;
        const showBubbleTimestamp = charSettings.timestampBubble || false;
        
        let html = '';
        
        // 加载更多按钮
        if (startIndex > 0) {
            html += MessageBuilder.buildLoadMoreButton(startIndex);
        }

        let lastTimestamp = 0;
        
        renderedHistory.forEach((msg, i) => {
            const index = startIndex + i;
            const timeDiff = (msg.timestamp - lastTimestamp) / 1000 / 60;
            
            // 时间戳
            if (i === 0 || timeDiff > 3) {
                html += MessageBuilder.buildTimestamp(msg.timestamp);
            }
            
            // 消息内容
            html += MessageBuilder.buildMessage({
                msg,
                index,
                char,
                history,
                deleteMode: this.deleteMode,
                selectedForDelete: this.selectedForDelete,
                showAvatarTimestamp: showAvatarTimestamp,
                showBubbleTimestamp: showBubbleTimestamp
            });
            
            lastTimestamp = msg.timestamp;
        });
        
        return html;
    },

    // ==================== 事件处理代理 ====================
    handleTouchStart: function(event, index) {
        ChatEventHandlers.handleTouchStart(event, index);
    },

    handleTouchMove: function(event) {
        ChatEventHandlers.handleTouchMove(event);
    },

    handleTouchEnd: function(event) {
        ChatEventHandlers.handleTouchEnd(event);
    },

    showContextMenu: function(event, index, x, y) {
        ChatEventHandlers.showContextMenu(event, index, x, y);
    },

    closeContextMenu: function() {
        ChatEventHandlers.closeContextMenu();
    },

    handleContextAction: function(action) {
        ChatEventHandlers.handleContextAction(action, this);
    },

    // ==================== 删除模式代理 ====================
    enterDeleteMode: function(initialIndex) {
        ChatEventHandlers.enterDeleteMode(initialIndex, this);
    },

    toggleDeleteSelection: function(index) {
        ChatEventHandlers.toggleDeleteSelection(index, this);
    },

    confirmDelete: function() {
        ChatEventHandlers.confirmDelete(this);
    },

    exitDeleteMode: function() {
        ChatEventHandlers.exitDeleteMode(this);
    },

    // ==================== 消息发送 ====================
    sendUserMessage: function() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        const msg = {
            id: Date.now(),
            sender: 'user',
            content: text,
            type: 'text',
            timestamp: Date.now(),
            quote: this.currentQuote
        };
        this.cancelQuote();

        const updatedHistory = API.Chat.addMessage(this.currentCharId, msg);
        // 增量追加代替全量重渲染
        this.appendSingleMessage(msg, updatedHistory.length - 1);
        
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }
        
        input.value = '';
        input.style.height = 'auto';
    },

    // ==================== 面板控制 ====================
    togglePanel: function(panelName) {
        const container = document.getElementById('panel-container');
        const panels = ['emoji', 'expand'];
        const currentPanel = document.getElementById('panel-' + panelName);
        
        if (!currentPanel.classList.contains('hidden') && !container.classList.contains('hidden')) {
            container.classList.add('hidden');
            return;
        }

        panels.forEach(p => document.getElementById('panel-' + p).classList.add('hidden'));
        
        currentPanel.classList.remove('hidden');
        container.classList.remove('hidden');
        
        if (panelName === 'emoji') {
            this.renderEmojiGrid();
        }
        
        this.scrollToBottom();
    },

    // ==================== 表情包代理 ====================
    get currentEmojiGroupId() {
        return EmojiPanel.currentEmojiGroupId;
    },

    set currentEmojiGroupId(value) {
        EmojiPanel.currentEmojiGroupId = value;
    },

    renderEmojiGridById: function(groupId) {
        EmojiPanel.renderEmojiGridById(groupId, this.currentCharId);
    },

    renderEmojiGrid: function() {
        EmojiPanel.renderEmojiGrid(this.currentCharId);
    },

    getRecentEmojis: function() {
        return EmojiPanel.getRecentEmojis();
    },

    saveRecentEmoji: function(emojiUrl) {
        EmojiPanel.saveRecentEmoji(emojiUrl);
    },

    sendEmoji: function(emojiUrl) {
        const msg = EmojiPanel.sendEmoji(emojiUrl, this.currentCharId);
        // 增量追加代替全量重渲染
        const history = API.Chat.getHistory(this.currentCharId);
        this.appendSingleMessage(msg, history.length - 1);
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }
    },

    // ==================== 引用功能 ====================
    startQuote: function(index) {
        const history = API.Chat.getHistory(this.currentCharId);
        const msg = history[index];
        if (!msg) return;
        
        this.currentQuote = {
            id: msg.id,
            sender: msg.sender,
            content: msg.content,
            type: msg.type
        };

        const preview = document.getElementById('quote-preview');
        const text = document.getElementById('quote-content-text');
        preview.classList.remove('hidden');
        
        const char = API.Chat.getChar(this.currentCharId);
        const authorName = msg.sender === 'user' ? '我' : (char ? char.remark : '');
        
        text.textContent = `回复 ${authorName}: ${msg.type === 'image' ? '[图片]' : msg.content}`;
        document.getElementById('chat-input').focus();
    },

    cancelQuote: function() {
        this.currentQuote = null;
        document.getElementById('quote-preview').classList.add('hidden');
    },

    addCustomEmoji: function() {
        EmojiManager.openModal();
    },

    // ==================== AI交互代理 ====================
    triggerAI: async function() {
        await AIHandler.triggerAI(this);
    },

    regenerateLastAI: async function() {
        await AIHandler.regenerateLastAI(this);
    },

    // ==================== 媒体处理代理 ====================
    openCamera: function() {
        console.log('[ChatInterface] openCamera called, charId:', this.currentCharId);
        MediaHandlers.openCamera(this.currentCharId);
    },

    handleCameraCapture: async function(input) {
        console.log('[ChatInterface] handleCameraCapture called');
        console.log('[ChatInterface] input:', input);
        console.log('[ChatInterface] input.files:', input ? input.files : 'no input');
        
        // 手机端拍照返回后 this.currentCharId 可能丢失，使用 MediaHandlers 的缓存机制
        const charId = this.currentCharId || MediaHandlers._getValidCharId(null);
        console.log('[ChatInterface] handleCameraCapture - charId:', charId);
        
        try {
            await MediaHandlers.handleCameraCapture(
                input,
                charId,
                this.compressImageForChat.bind(this),
                this.renderMessages.bind(this)
            );
            console.log('[ChatInterface] handleCameraCapture completed');
        } catch (error) {
            console.error('[ChatInterface] handleCameraCapture error:', error);
            alert('拍照处理出错: ' + error.message);
        }
    },

    openGalleryMenu: function() {
        MediaHandlers.openGalleryMenu();
    },

    closeGalleryMenu: function() {
        MediaHandlers.closeGalleryMenu();
    },

    openTextDrawing: function() {
        MediaHandlers.openTextDrawing();
    },

    closeTextDrawing: function() {
        MediaHandlers.closeTextDrawing();
    },

    sendTextDrawing: function() {
        MediaHandlers.sendTextDrawing(
            this.currentCharId,
            this.generateTextImageCard.bind(this),
            this.renderMessages.bind(this)
        );
    },

    openGalleryPicker: function() {
        MediaHandlers.openGalleryPicker(this.currentCharId);
    },

    handleGallerySelect: async function(input) {
        await MediaHandlers.handleGallerySelect(
            input,
            this.currentCharId,
            this.compressImageForChat.bind(this),
            this.renderMessages.bind(this)
        );
    },

    // ==================== 语音处理代理 ====================
    openVoicePanel: function() {
        VoiceHandler.openVoicePanel();
    },

    closeVoicePanel: function() {
        VoiceHandler.closeVoicePanel();
    },

    playVoice: function(msgIndex) {
        VoiceHandler.playVoice(msgIndex);
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatInterface;
}
