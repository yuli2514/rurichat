/**
 * chatRender/messageBuilder.js
 * 聊天渲染模块 - 消息HTML构建器
 * 
 * 包含：
 * - 单条消息HTML生成
 * - 时间戳渲染
 * - 引用消息渲染
 * - 删除模式复选框渲染
 */

const MessageBuilder = {
    /**
     * 构建时间戳HTML
     * @param {number} timestamp - 时间戳
     * @returns {string} - 时间戳HTML
     */
    buildTimestamp: function(timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return '<div class="chat-timestamp">' + timeStr + '</div>';
    },

    /**
     * 构建撤回消息提示HTML
     * @param {boolean} isMe - 是否是用户消息
     * @param {string} charRemark - 角色备注名
     * @returns {string} - 撤回提示HTML
     */
    buildRecalledMessage: function(isMe, charRemark) {
        const recallText = isMe ? '你撤回了一条消息' : (charRemark + ' 撤回了一条消息');
        return '<div class="text-center text-xs text-gray-400 py-2 italic">' + recallText + '</div>';
    },

    /**
     * 构建删除模式复选框HTML
     * @param {number} index - 消息索引
     * @param {boolean} isSelected - 是否被选中
     * @param {boolean} deleteMode - 是否处于删除模式
     * @returns {string} - 复选框HTML
     */
    buildDeleteCheckbox: function(index, isSelected, deleteMode) {
        if (!deleteMode) return '';
        
        return '<div onclick="ChatInterface.toggleDeleteSelection(' + index + ')" class="flex items-center justify-center w-6 h-6 shrink-0 cursor-pointer">' +
            '<div class="w-5 h-5 rounded-full border-2 ' + (isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300') + ' flex items-center justify-center">' +
                (isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : '') +
            '</div>' +
        '</div>';
    },

    /**
     * 构建引用消息HTML
     * @param {Object} msg - 当前消息
     * @param {Array} history - 聊天历史
     * @param {Object} char - 角色信息
     * @returns {string} - 引用HTML
     */
    buildQuoteHtml: function(msg, history, char) {
        if (!msg.quote) return '';
        
        const quotedMsg = history.find(h => h.id === msg.quote.id);
        if (quotedMsg && !quotedMsg.recalled) {
            const authorName = quotedMsg.sender === 'user' ? '我' : char.remark;
            const quoteContent = quotedMsg.type === 'image' ? '[图片]' : quotedMsg.content.substring(0, 40) + (quotedMsg.content.length > 40 ? '...' : '');
            return '<div class="quote-in-bubble"><span class="quote-author">' + authorName + ':</span><span>' + quoteContent + '</span></div>';
        } else if (quotedMsg && quotedMsg.recalled) {
            return '<div class="quote-in-bubble"><span class="text-gray-400 italic">引用的消息已撤回</span></div>';
        }
        return '';
    },

    /**
     * 获取图片CSS类名
     * @param {boolean} isMe - 是否是用户消息
     * @param {Object} msg - 消息对象
     * @returns {string} - CSS类名
     */
    getImageClass: function(isMe, msg) {
        const isAiImage = !isMe && msg.content && msg.content.startsWith('data:image/');
        const isUserTextDrawing = isMe && msg.textDrawingDesc;
        const isUserPhoto = isMe && msg.isVisionImage;
        
        if (isAiImage || isUserTextDrawing) {
            return 'sent-emoji ai-image-card';
        } else if (isUserPhoto) {
            return 'sent-emoji user-photo';
        }
        return 'sent-emoji';
    },

    /**
     * 构建图片消息HTML
     * @param {Object} params - 参数对象
     * @returns {string} - 图片消息HTML
     */
    buildImageMessage: function(params) {
        const { msg, index, isMe, avatar, avatarClass, checkboxHtml, deleteMode, imageClass } = params;
        
        return '<div class="flex gap-2 items-start ' + (isMe ? 'flex-row-reverse' : '') + '">' +
            checkboxHtml +
            '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
            '<div class="max-w-[70%]">' +
                '<img src="' + msg.content + '" ' +
                     (deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : 'onclick="window.open(this.src)" ') +
                     'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                     'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                     'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                     'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                     'class="' + imageClass + '" loading="lazy">' +
            '</div>' +
        '</div>';
    },

    /**
     * 构建文本消息HTML
     * @param {Object} params - 参数对象
     * @returns {string} - 文本消息HTML
     */
    buildTextMessage: function(params) {
        const { msg, index, isMe, avatar, avatarClass, checkboxHtml, deleteMode, quoteHtml } = params;
        
        const contentHtml = msg.content.replace(/\n/g, '<br>');
        const bubbleClass = isMe ? 'bubble bubble-user' : 'bubble bubble-ai';
        
        return '<div class="flex gap-2 items-start ' + (isMe ? 'flex-row-reverse' : '') + '">' +
            checkboxHtml +
            '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
            '<div class="max-w-[70%]">' +
                '<div ' + (deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : '') +
                     'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                     'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                     'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                     'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                    'class="relative cursor-pointer active:brightness-95 transition prevent-select ' + bubbleClass + '">' +
                    quoteHtml + contentHtml +
                '</div>' +
            '</div>' +
        '</div>';
    },

    /**
     * 构建单条消息的完整HTML
     * @param {Object} params - 参数对象
     * @returns {string} - 消息HTML
     */
    buildMessage: function(params) {
        const { msg, index, char, history, deleteMode, selectedForDelete } = params;
        
        const isMe = msg.sender === 'user';
        
        // 获取头像
        const charSettings = char.settings || {};
        const perCharUserAvatar = charSettings.userAvatar || null;
        const profile = API.Profile.getProfile();
        const globalUserAvatar = profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';
        const avatar = isMe ? (perCharUserAvatar || globalUserAvatar) : char.avatar;
        const avatarClass = isMe ? 'user-message-avatar' : 'char-message-avatar';

        // 检查是否已撤回
        if (msg.recalled) {
            return this.buildRecalledMessage(isMe, char.remark);
        }

        // 删除模式复选框
        const isSelected = deleteMode && selectedForDelete.has(index);
        const checkboxHtml = this.buildDeleteCheckbox(index, isSelected, deleteMode);

        const isImage = msg.type === 'image';
        
        if (isImage) {
            const imageClass = this.getImageClass(isMe, msg);
            return this.buildImageMessage({
                msg, index, isMe, avatar, avatarClass, checkboxHtml, deleteMode, imageClass
            });
        } else {
            const quoteHtml = this.buildQuoteHtml(msg, history, char);
            return this.buildTextMessage({
                msg, index, isMe, avatar, avatarClass, checkboxHtml, deleteMode, quoteHtml
            });
        }
    },

    /**
     * 构建"加载更多"按钮HTML
     * @param {number} remainingCount - 剩余消息数量
     * @returns {string} - 按钮HTML
     */
    buildLoadMoreButton: function(remainingCount) {
        return '<div class="text-center py-3">' +
            '<button onclick="ChatInterface.loadMoreMessages()" class="px-4 py-2 bg-white text-gray-600 text-xs font-medium rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition">' +
            '<i class="fa-solid fa-clock-rotate-left mr-1"></i>加载更多消息 (' + remainingCount + '条)' +
            '</button>' +
        '</div>';
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageBuilder;
}
