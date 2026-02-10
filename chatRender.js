/**
 * chatRender.js
 * 负责聊天界面的渲染、消息发送、气泡交互等
 */

const ChatInterface = {
    /**
     * 文字意念传图：用 Canvas 生成白底文字卡片图片
     * @param {string} text - 要显示的文字描述
     * @returns {string} - 生成的图片 Data URL
     */
    generateTextImageCard: function(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置画布尺寸 (正方形，大尺寸)
        const width = 500;
        const height = 500;
        canvas.width = width;
        canvas.height = height;
        
        // 绘制白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 绘制淡灰色边框
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
        
        // 设置文字样式
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 自动换行绘制文字
        const maxWidth = width - 80; // 左右留 40px 边距
        const lineHeight = 38;
        const fontSize = 26;
        ctx.font = fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        
        // 文字换行处理
        const words = text.split('');
        const lines = [];
        let currentLine = '';
        
        for (let i = 0; i < words.length; i++) {
            const char = words[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // 限制最大行数
        const maxLines = 11;
        if (lines.length > maxLines) {
            lines.length = maxLines;
            lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
        }
        
        // 计算起始 Y 坐标使文字垂直居中
        const totalTextHeight = lines.length * lineHeight;
        let startY = (height - totalTextHeight) / 2 + lineHeight / 2;
        
        // 绘制每一行文字
        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
        
        return canvas.toDataURL('image/png');
    },

    currentCharId: null,
    deleteMode: false,
    selectedForDelete: new Set(),
    
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
    },

    open: function(charId) {
        try {
            this.currentCharId = charId;
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

            // Apply Wallpaper
            const messagesArea = document.getElementById('chat-messages');
            if (char.settings && char.settings.wallpaper) {
                messagesArea.style.backgroundImage = 'url(' + char.settings.wallpaper + ')';
                messagesArea.style.backgroundSize = 'cover';
                messagesArea.style.backgroundPosition = 'center';
            } else {
                messagesArea.style.backgroundImage = '';
            }

            // Apply Custom CSS
            if (char.settings && char.settings.customCss) {
                CssManager.applyCustomCss(char.settings.customCss);
            } else {
                CssManager.applyCustomCss('');
            }
            
            // Apply CSS Variables (Bubble size, font size, etc.)
            if (char.settings) {
                if (char.settings.cssBubble) CssManager.updateCssVar('bubble', char.settings.cssBubble);
                if (char.settings.cssFont) CssManager.updateCssVar('font', char.settings.cssFont);
                if (char.settings.cssAvatar) CssManager.updateCssVar('avatar', char.settings.cssAvatar);
            }

            this.renderMessages();
            this.renderEmojiGrid();
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

    _renderRAF: null,
    
    renderMessages: function() {
        const container = document.getElementById('chat-messages');
        const history = API.Chat.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        
        // Performance: Use requestAnimationFrame to avoid blocking UI
        if (this._renderRAF) cancelAnimationFrame(this._renderRAF);
        
        this._renderRAF = requestAnimationFrame(() => {
            // Optimization: Only render last 30 messages on mobile for better performance
            const isMobile = window.innerWidth < 768;
            const maxMessages = isMobile ? 30 : 50;
            const startIndex = Math.max(0, history.length - maxMessages);
            const renderedHistory = history.slice(startIndex);
            
            let html = '';
            if (startIndex > 0) {
                html += '<div class="text-center text-xs text-gray-400 py-2">... 更多历史消息 ...</div>';
            }

            let lastTimestamp = 0;
            
            renderedHistory.forEach((msg, i) => {
                const index = startIndex + i; // Real index in full history
                const timeDiff = (msg.timestamp - lastTimestamp) / 1000 / 60;
                
                if (i === 0 || timeDiff > 3) {
                    const date = new Date(msg.timestamp);
                    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    html += '<div class="chat-timestamp">' + timeStr + '</div>';
                }
                
                const isMe = msg.sender === 'user';
                
                const charSettings = char.settings || {};
                const perCharUserAvatar = charSettings.userAvatar || null;
                const profile = API.Profile.getProfile();
                const globalUserAvatar = profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';
                const avatar = isMe ? (perCharUserAvatar || globalUserAvatar) : char.avatar;
                const avatarClass = isMe ? 'user-message-avatar' : 'char-message-avatar';

                // Check if message is recalled
                if (msg.recalled) {
                    const recallText = isMe ? '你撤回了一条消息' : (char.remark + ' 撤回了一条消息');
                    html += '<div class="text-center text-xs text-gray-400 py-2 italic">' + recallText + '</div>';
                    lastTimestamp = msg.timestamp;
                    return; // Skip rendering the actual message
                }

                // Delete mode checkbox
                const isSelected = this.deleteMode && this.selectedForDelete.has(index);
                const checkboxHtml = this.deleteMode ?
                    '<div onclick="ChatInterface.toggleDeleteSelection(' + index + ')" class="flex items-center justify-center w-6 h-6 shrink-0 cursor-pointer">' +
                        '<div class="w-5 h-5 rounded-full border-2 ' + (isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300') + ' flex items-center justify-center">' +
                            (isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : '') +
                        '</div>' +
                    '</div>' : '';

                const isImage = msg.type === 'image';
                // AI意念图（AI发的data:image/开头）或用户文字描述图（有textDrawingDesc标记）使用更大的样式
                const isAiImage = !isMe && msg.content && msg.content.startsWith('data:image/');
                const isUserTextDrawing = isMe && msg.textDrawingDesc; // 用户发的文字描述图
                const imageClass = (isAiImage || isUserTextDrawing) ? 'sent-emoji ai-image-card' : 'sent-emoji';
                
                if (isImage) {
                    html += '<div class="flex gap-2 items-start ' + (isMe ? 'flex-row-reverse' : '') + '">' +
                        checkboxHtml +
                        '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
                        '<div class="max-w-[70%]">' +
                            '<img src="' + msg.content + '" ' +
                                 (this.deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : 'onclick="window.open(this.src)" ') +
                                 'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                                 'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                                 'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                                 'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                                 'class="' + imageClass + '" loading="lazy">' +
                        '</div>' +
                    '</div>';
                } else {
                    let quoteHtml = '';
                    if (msg.quote) {
                        const quotedMsg = history.find(h => h.id === msg.quote.id);
                        if (quotedMsg && !quotedMsg.recalled) {
                            const authorName = quotedMsg.sender === 'user' ? '我' : char.remark;
                            const quoteContent = quotedMsg.type === 'image' ? '[图片]' : quotedMsg.content.substring(0, 40) + (quotedMsg.content.length > 40 ? '...' : '');
                            quoteHtml = '<div class="quote-in-bubble"><span class="quote-author">' + authorName + ':</span><span>' + quoteContent + '</span></div>';
                        } else if (quotedMsg && quotedMsg.recalled) {
                            quoteHtml = '<div class="quote-in-bubble"><span class="text-gray-400 italic">引用的消息已撤回</span></div>';
                        }
                    }

                    let contentHtml = msg.content.replace(/\n/g, '<br>');
                    const bubbleClass = isMe ? 'bubble bubble-user' : 'bubble bubble-ai';
                    
                    html += '<div class="flex gap-2 items-center ' + (isMe ? 'flex-row-reverse' : '') + '">' +
                        checkboxHtml +
                        '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
                        '<div class="max-w-[70%]">' +
                            '<div ' + (this.deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : '') +
                                 'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                                 'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                                 'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                                 'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                                'class="relative cursor-pointer active:brightness-95 transition prevent-select ' + bubbleClass + '">' +
                                quoteHtml + contentHtml +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }
                
                lastTimestamp = msg.timestamp;
            });
            
            container.innerHTML = html;
            this.scrollToBottom();
        });
    },
    
    // Render messages without scrolling (for delete mode selection)
    renderMessagesNoScroll: function() {
        const container = document.getElementById('chat-messages');
        const history = API.Chat.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        const scrollTop = container.scrollTop; // Save current scroll position
        
        if (this._renderRAF) cancelAnimationFrame(this._renderRAF);
        
        this._renderRAF = requestAnimationFrame(() => {
            const isMobile = window.innerWidth < 768;
            const maxMessages = isMobile ? 30 : 50;
            const startIndex = Math.max(0, history.length - maxMessages);
            const renderedHistory = history.slice(startIndex);
            
            let html = '';
            if (startIndex > 0) {
                html += '<div class="text-center text-xs text-gray-400 py-2">... 更多历史消息 ...</div>';
            }

            let lastTimestamp = 0;
            
            renderedHistory.forEach((msg, i) => {
                const index = startIndex + i;
                const timeDiff = (msg.timestamp - lastTimestamp) / 1000 / 60;
                
                if (i === 0 || timeDiff > 3) {
                    const date = new Date(msg.timestamp);
                    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    html += '<div class="chat-timestamp">' + timeStr + '</div>';
                }
                
                const isMe = msg.sender === 'user';
                
                const charSettings = char.settings || {};
                const perCharUserAvatar = charSettings.userAvatar || null;
                const profile = API.Profile.getProfile();
                const globalUserAvatar = profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';
                const avatar = isMe ? (perCharUserAvatar || globalUserAvatar) : char.avatar;
                const avatarClass = isMe ? 'user-message-avatar' : 'char-message-avatar';

                if (msg.recalled) {
                    const recallText = isMe ? '你撤回了一条消息' : (char.remark + ' 撤回了一条消息');
                    html += '<div class="text-center text-xs text-gray-400 py-2 italic">' + recallText + '</div>';
                    lastTimestamp = msg.timestamp;
                    return;
                }

                const isSelected = this.deleteMode && this.selectedForDelete.has(index);
                const checkboxHtml = this.deleteMode ?
                    '<div onclick="ChatInterface.toggleDeleteSelection(' + index + ')" class="flex items-center justify-center w-6 h-6 shrink-0 cursor-pointer">' +
                        '<div class="w-5 h-5 rounded-full border-2 ' + (isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300') + ' flex items-center justify-center">' +
                            (isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : '') +
                        '</div>' +
                    '</div>' : '';

                const isImage = msg.type === 'image';
                // AI意念图（AI发的data:image/开头）或用户文字描述图（有textDrawingDesc标记）使用更大的样式
                const isAiImage = !isMe && msg.content && msg.content.startsWith('data:image/');
                const isUserTextDrawing = isMe && msg.textDrawingDesc; // 用户发的文字描述图
                const imageClass = (isAiImage || isUserTextDrawing) ? 'sent-emoji ai-image-card' : 'sent-emoji';
                
                if (isImage) {
                    html += '<div class="flex gap-2 items-center ' + (isMe ? 'flex-row-reverse' : '') + '">' +
                        checkboxHtml +
                        '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
                        '<div class="max-w-[70%]">' +
                            '<img src="' + msg.content + '" ' +
                                 (this.deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : 'onclick="window.open(this.src)" ') +
                                 'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                                 'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                                 'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                                 'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                                 'class="' + imageClass + '" loading="lazy">' +
                        '</div>' +
                    '</div>';
                } else {
                    let quoteHtml = '';
                    if (msg.quote) {
                        const quotedMsg = history.find(h => h.id === msg.quote.id);
                        if (quotedMsg && !quotedMsg.recalled) {
                            const authorName = quotedMsg.sender === 'user' ? '我' : char.remark;
                            const quoteContent = quotedMsg.type === 'image' ? '[图片]' : quotedMsg.content.substring(0, 40) + (quotedMsg.content.length > 40 ? '...' : '');
                            quoteHtml = '<div class="quote-in-bubble"><span class="quote-author">' + authorName + ':</span><span>' + quoteContent + '</span></div>';
                        } else if (quotedMsg && quotedMsg.recalled) {
                            quoteHtml = '<div class="quote-in-bubble"><span class="text-gray-400 italic">引用的消息已撤回</span></div>';
                        }
                    }

                    let contentHtml = msg.content.replace(/\n/g, '<br>');
                    const bubbleClass = isMe ? 'bubble bubble-user' : 'bubble bubble-ai';
                    
                    html += '<div class="flex gap-2 items-center ' + (isMe ? 'flex-row-reverse' : '') + '">' +
                        checkboxHtml +
                        '<img src="' + avatar + '" class="' + avatarClass + ' w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" loading="lazy">' +
                        '<div class="max-w-[70%]">' +
                            '<div ' + (this.deleteMode ? 'onclick="ChatInterface.toggleDeleteSelection(' + index + ')" ' : '') +
                                 'oncontextmenu="ChatInterface.showContextMenu(event, ' + index + ')" ' +
                                 'ontouchstart="ChatInterface.handleTouchStart(event, ' + index + ')" ' +
                                 'ontouchmove="ChatInterface.handleTouchMove(event)" ' +
                                 'ontouchend="ChatInterface.handleTouchEnd(event)" ' +
                                'class="relative cursor-pointer active:brightness-95 transition prevent-select ' + bubbleClass + '">' +
                                quoteHtml + contentHtml +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }
                
                lastTimestamp = msg.timestamp;
            });
            
            container.innerHTML = html;
            container.scrollTop = scrollTop; // Restore scroll position
        });
    },

    scrollToBottom: function() {
        const msgContainer = document.getElementById('chat-messages');
        if(msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    },

    currentContextMenuMsgIndex: null,
    longPressTimer: null,
    longPressTriggered: false,
    touchStartX: 0,
    touchStartY: 0,

    handleTouchStart: function(event, index) {
        this.longPressTriggered = false;
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(50);
            this.showContextMenu(event, index, this.touchStartX, this.touchStartY);
        }, 500); // Reduced to 500ms for better responsiveness
    },

    handleTouchMove: function(event) {
        if (!this.longPressTimer) return;
        const moveX = event.touches[0].clientX;
        const moveY = event.touches[0].clientY;
        // Increased tolerance to 20px
        if (Math.abs(moveX - this.touchStartX) > 20 || Math.abs(moveY - this.touchStartY) > 20) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },

    handleTouchEnd: function(event) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        // If long press triggered, prevent default click behavior (like image opening)
        if (this.longPressTriggered) {
            if (event.cancelable) event.preventDefault();
            this.longPressTriggered = false;
        }
    },

    menuCloseHandler: null,
    menuCloseTimeout: null,

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

        // Remove old listener if exists
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchend', this.menuCloseHandler);
        }

        // Create new close handler with better touch support
        this.menuCloseHandler = (e) => {
            // Check if click/touch is inside menu - don't close
            if (menu.contains(e.target)) {
                return;
            }
            // Add delay before closing to ensure button actions can trigger
            setTimeout(() => {
                this.closeContextMenu();
            }, 100);
        };

        // Longer delay before adding close listener on mobile
        setTimeout(() => {
            document.addEventListener('click', this.menuCloseHandler);
            document.addEventListener('touchstart', this.menuCloseHandler, { passive: true });
        }, 300);
    },

    closeContextMenu: function() {
        const menu = document.getElementById('chat-context-menu');
        menu.classList.add('hidden');
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchstart', this.menuCloseHandler);
            this.menuCloseHandler = null;
        }
    },

    handleContextAction: function(action) {
        // Prevent event propagation and default behavior
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const index = this.currentContextMenuMsgIndex;
        if (index === null) return;
        
        const history = API.Chat.getHistory(this.currentCharId);
        const msg = history[index];
        if (!msg) return;

        // Close menu with a small delay to ensure action is processed
        if (this.menuCloseTimeout) clearTimeout(this.menuCloseTimeout);
        this.menuCloseTimeout = setTimeout(() => {
            this.closeContextMenu();
        }, 50);

        if (action === 'copy') {
            navigator.clipboard.writeText(msg.content).then(() => alert('已复制'));
        } else if (action === 'quote') {
            this.startQuote(index);
        } else if (action === 'edit') {
            // Allow editing both user and char messages
            const senderName = msg.sender === 'user' ? '我' : API.Chat.getChar(this.currentCharId).remark;
            const newText = prompt('编辑 ' + senderName + ' 的消息:', msg.content);
            if (newText !== null && newText.trim()) {
                history[index].content = newText.trim();
                history[index].edited = true; // Mark as edited
                history[index].editedAt = Date.now();
                API.Chat.saveHistory(this.currentCharId, history);
                this.renderMessages();
                ChatManager.renderList(); // Update contact list preview
            }
        } else if (action === 'recall') {
            // Recall message - mark as recalled instead of deleting
            history[index].recalled = true;
            history[index].recalledAt = Date.now();
            API.Chat.saveHistory(this.currentCharId, history);
            this.renderMessages();
            ChatManager.renderList();
        } else if (action === 'delete') {
            // Enter multi-select delete mode
            this.enterDeleteMode(index);
        }
    },

    // Multi-select delete mode functions
    enterDeleteMode: function(initialIndex) {
        this.deleteMode = true;
        this.selectedForDelete = new Set([initialIndex]);
        this.renderMessages();
        this.showDeleteModeUI();
    },

    showDeleteModeUI: function() {
        // Hide input area and show delete mode bar
        const inputArea = document.querySelector('#super-chat-interface .bg-\\[\\#f7f7f7\\].border-t');
        if (inputArea) inputArea.style.display = 'none';
        
        // Create delete mode bar if not exists
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
        this.updateDeleteCount();
    },

    updateDeleteCount: function() {
        const countEl = document.getElementById('delete-count');
        if (countEl) {
            countEl.textContent = `已选择 ${this.selectedForDelete.size} 条`;
        }
    },

    toggleDeleteSelection: function(index) {
        if (this.selectedForDelete.has(index)) {
            this.selectedForDelete.delete(index);
        } else {
            this.selectedForDelete.add(index);
        }
        this.updateDeleteCount();
        // Don't scroll to bottom when toggling selection
        this.renderMessagesNoScroll();
    },

    confirmDelete: function() {
        if (this.selectedForDelete.size === 0) {
            alert('请选择要删除的消息');
            return;
        }
        
        if (!confirm(`确定删除选中的 ${this.selectedForDelete.size} 条消息？`)) return;
        
        const history = API.Chat.getHistory(this.currentCharId);
        // Sort indices in descending order to delete from end first
        const indices = Array.from(this.selectedForDelete).sort((a, b) => b - a);
        indices.forEach(index => {
            history.splice(index, 1);
        });
        
        API.Chat.saveHistory(this.currentCharId, history);
        this.exitDeleteMode();
        ChatManager.renderList();
    },

    exitDeleteMode: function() {
        this.deleteMode = false;
        this.selectedForDelete = new Set();
        
        // Show input area again
        const inputArea = document.querySelector('#super-chat-interface .bg-\\[\\#f7f7f7\\].border-t');
        if (inputArea) inputArea.style.display = '';
        
        // Hide delete mode bar
        const deleteBar = document.getElementById('delete-mode-bar');
        if (deleteBar) deleteBar.style.display = 'none';
        
        this.renderMessages();
    },

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

        API.Chat.addMessage(this.currentCharId, msg);
        this.renderMessages();
        
        input.value = '';
        input.style.height = 'auto';
    },

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

    currentEmojiGroupId: 'bound',
    renderTask: null,

    renderEmojiGridById: function(groupId) {
        if (this.renderTask) cancelAnimationFrame(this.renderTask);
        if (!groupId) groupId = 'bound';
        this.currentEmojiGroupId = groupId;

        const allGroups = API.Emoji.getGroups();
        const char = API.Chat.getChar(this.currentCharId);
        const settings = char && char.settings ? char.settings : {};
        
        // 支持多选的表情包分组
        const boundGroupIds = settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []);
        const boundGroups = allGroups.filter(g => boundGroupIds.includes(g.id));
        
        // 1. Render Bar
        const bar = document.getElementById('emoji-group-bar');
        let barHtml = '';
        
        const isBoundActive = groupId === 'bound';

        // 绑定的表情包按钮（显示多选数量）
        const boundButtonClass = isBoundActive ? 'text-blue-500 border-blue-500 bg-blue-50' : 'text-gray-500 border-transparent hover:bg-gray-50';
        const boundButtonText = boundGroups.length > 0 ? `★ 已绑定(${boundGroups.length})` : '默认';
        barHtml += `<button onclick="ChatInterface.renderEmojiGridById('bound')" class="px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${boundButtonClass}">${boundButtonText}</button>`;

        allGroups.forEach(g => {
            // 跳过已绑定的分组（它们会在"已绑定"中显示）
            if (boundGroupIds.includes(g.id)) return;
            const isActive = groupId === g.id;
            const buttonClass = isActive ? 'text-blue-500 border-blue-500 bg-blue-50' : 'text-gray-500 border-transparent hover:bg-gray-50';
            barHtml += `<button onclick="ChatInterface.renderEmojiGridById('${g.id}')" class="px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${buttonClass}">${g.name}</button>`;
        });

        barHtml += '<button onclick="EmojiManager.openModal()" class="px-4 py-2 text-xs font-medium whitespace-nowrap text-gray-400 hover:text-gray-600 ml-auto"><i class="fa-solid fa-gear"></i></button>';

        bar.innerHTML = barHtml;

        // 2. Render Grid
        const grid = document.getElementById('emoji-grid');
        let emojis = [];

        if (groupId === 'bound') {
            // 合并所有绑定分组的表情包
            boundGroups.forEach(g => {
                if (g.emojis) {
                    emojis = emojis.concat(g.emojis);
                }
            });
        } else {
            const group = allGroups.find(g => g.id === groupId);
            if (group) emojis = group.emojis;
        }
        
        if (emojis.length === 0) {
             grid.innerHTML = '<div class="col-span-4 text-center text-gray-400 py-8 text-xs">此处没有表情<br>点击右上角⚙️导入</div>';
             return;
        }

        // Clear existing content and reset grid
        grid.innerHTML = '';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gap = '1rem';
        grid.style.alignContent = 'start';

        // Chunked Rendering Optimization - Reduced chunk size for smoother mobile performance
        const CHUNK_SIZE = 12;
        let currentIndex = 0;

        const renderChunk = () => {
            const chunk = emojis.slice(currentIndex, currentIndex + CHUNK_SIZE);
            if (chunk.length === 0) return;

            const chunkHtml = chunk.map(e => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(e.url) || e.url.startsWith('data:image');
                // Escape single quotes in URL to prevent JS errors
                const safeUrl = e.url.replace(/'/g, "\\'");
                
                if (isImage) {
                    return '<div onclick="ChatInterface.sendEmoji(\'' + safeUrl + '\')" class="emoji-item aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition relative group" style="width: 100%; max-width: 80px;">' +
                    '<img src="' + e.url + '" class="w-full h-full object-cover" loading="lazy" decoding="async" onerror="this.src=\'https://placehold.co/100x100?text=Err\'">' +
                    '<div class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-[10px] text-center p-1 leading-tight">' + (e.meaning || '表情') + '</div>' +
                    '</div>';
                } else {
                    return '<div onclick="ChatInterface.sendEmoji(\'' + safeUrl + '\')" class="emoji-item aspect-square bg-blue-50 border border-blue-100 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition relative group flex items-center justify-center p-1" style="width: 100%; max-width: 80px;">' +
                    '<i class="fa-solid fa-link text-blue-400 text-xl"></i>' +
                    '<span class="absolute bottom-1 text-[8px] text-gray-500 truncate w-full text-center px-1">' + (e.meaning || '链接') + '</span>' +
                    '</div>';
                }
            }).join('');

            // Append chunk using insertAdjacentHTML for better performance than innerHTML +=
            grid.insertAdjacentHTML('beforeend', chunkHtml);
            
            currentIndex += CHUNK_SIZE;
            if (currentIndex < emojis.length) {
                ChatInterface.renderTask = requestAnimationFrame(renderChunk);
            }
        };

        // Start rendering
        renderChunk();
    },
    
    renderEmojiGrid: function() {
        this.renderEmojiGridById('bound');
    },

    sendEmoji: function(emojiUrl) {
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: emojiUrl,
            type: 'image',
            timestamp: Date.now()
        };
        API.Chat.addMessage(this.currentCharId, msg);
        this.renderMessages();
        document.getElementById('panel-container').classList.add('hidden');
    },

    currentQuote: null,

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

    triggerAI: async function() {
        const input = document.getElementById('chat-input');
        if (input.value.trim()) this.sendUserMessage();

        const btn = document.querySelector('button[onclick="ChatInterface.triggerAI()"]');
        btn.classList.add('animate-pulse');
        
        const headerName = document.getElementById('chat-header-name');
        const originalName = headerName.textContent;
        const originalColor = headerName.style.color;
        headerName.textContent = '对方正在输入中...';
        headerName.style.color = '#9CA3AF';
        
        try {
            const bubbles = await API.Chat.generateReply(this.currentCharId);
            const history = API.Chat.getHistory(this.currentCharId);
            
            // 获取表情包映射（含义 -> URL）用于解析AI发送的表情包格式
            const char = API.Chat.getChar(this.currentCharId);
            const settings = char && char.settings ? char.settings : {};
            let emojiMeaningToUrl = {}; // 含义到URL的映射
            if (settings.emojiGroupId) {
                const emojis = API.Emoji.getGroupEmojis(settings.emojiGroupId);
                emojis.forEach(e => {
                    emojiMeaningToUrl[e.meaning] = e.url;
                });
            }
            
            for (let text of bubbles) {
                // Check for recall command [RECALL]
                const isRecall = text.includes('[RECALL]');
                if (isRecall) {
                    text = text.replace('[RECALL]', '').trim();
                }
                
                // Skip empty messages
                if (!text || text.trim() === '') continue;
                
                // 解析 [表情包：xxx] 格式，转换为实际URL
                const emojiMatch = text.match(/^\[表情包[：:]\s*(.+?)\s*\]$/);
                if (emojiMatch) {
                    const emojiMeaning = emojiMatch[1];
                    if (emojiMeaningToUrl[emojiMeaning]) {
                        text = emojiMeaningToUrl[emojiMeaning];
                    }
                }
                
                // ★ 文字意念传图：检测图片描述格式 [图片:xxx] 或 [IMAGE:xxx]
                // 当AI想描述一张图片时，不调用生图API，而是生成白底文字卡片
                let isTextImageCard = false;
                const imageDescMatch = text.match(/^\[(?:图片|IMAGE|图像|画面)[：:]\s*(.+?)\s*\]$/i);
                if (imageDescMatch) {
                    const imageDescription = imageDescMatch[1];
                    // 使用 Canvas 生成白底文字卡片
                    text = this.generateTextImageCard(imageDescription);
                    isTextImageCard = true;
                }
                
                const isImageUrl = text.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i) ||
                                   text.startsWith('data:image/'); // 支持 Data URL (意念图)
                
                // Parse quote format [QUOTE:content]
                let quote = null;
                const quoteMatch = text.match(/^\[QUOTE:(.+?)\]/);
                if (quoteMatch) {
                    const quoteContent = quoteMatch[1];
                    text = text.replace(quoteMatch[0], '').trim();
                    
                    // Skip if text is empty after removing quote
                    if (!text || text.trim() === '') continue;
                    
                    // Find the quoted message in history (only non-recalled messages)
                    const quotedMsg = history.find(m =>
                        !m.recalled &&
                        m.content &&
                        m.content.includes(quoteContent)
                    );
                    if (quotedMsg) {
                        quote = {
                            id: quotedMsg.id,
                            sender: quotedMsg.sender,
                            content: quotedMsg.content,
                            type: quotedMsg.type
                        };
                    }
                }
                
                const msgId = Date.now() + Math.random();
                const msg = {
                    id: msgId,
                    sender: 'ai',
                    content: text,
                    type: isImageUrl ? 'image' : 'text',
                    timestamp: Date.now(),
                    quote: quote
                };
                API.Chat.addMessage(this.currentCharId, msg);
                this.renderMessages();
                
                // If this message should be recalled, wait 2 seconds then recall it
                if (isRecall) {
                    await new Promise(r => setTimeout(r, 2000));
                    const currentHistory = API.Chat.getHistory(this.currentCharId);
                    const msgIndex = currentHistory.findIndex(m => m.id === msgId);
                    if (msgIndex !== -1) {
                        currentHistory[msgIndex].recalled = true;
                        currentHistory[msgIndex].recalledAt = Date.now();
                        API.Chat.saveHistory(this.currentCharId, currentHistory);
                        this.renderMessages();
                        ChatManager.renderList();
                    }
                }
                
                // Wait 1.2 seconds between messages (simulating real typing)
                await new Promise(r => setTimeout(r, 1200));
            }

            API.Chat.checkAutoSummary(this.currentCharId);

        } catch (e) {
            alert('AI 请求失败: ' + e.message);
        } finally {
            btn.classList.remove('animate-pulse');
            headerName.textContent = originalName;
            headerName.style.color = originalColor;
        }
    },

    // ==================== 重回功能 (Regenerate) ====================
    regenerateLastAI: async function() {
        const history = API.Chat.getHistory(this.currentCharId);
        if (history.length === 0) return;

        // 检查最后一条消息是否是AI的
        const lastMsg = history[history.length - 1];
        if (lastMsg.sender === 'user') {
            // 如果最后是用户消息，点击无效
            alert('最后一条消息是你发送的，无法重回');
            return;
        }

        // 删除最后一轮AI的所有回复（连续的AI消息）
        let removeCount = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].sender === 'ai' || history[i].sender === 'assistant') {
                removeCount++;
            } else {
                break;
            }
        }

        if (removeCount > 0) {
            history.splice(history.length - removeCount, removeCount);
            API.Chat.saveHistory(this.currentCharId, history);
            this.renderMessages();
            ChatManager.renderList();
        }

        // 关闭扩展面板
        document.getElementById('panel-container').classList.add('hidden');

        // 自动触发AI重新生成
        await this.triggerAI();
    },

    // ==================== 拍照功能 (Camera) ====================
    openCamera: function() {
        document.getElementById('panel-container').classList.add('hidden');
        document.getElementById('camera-input').click();
    },

    handleCameraCapture: async function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            
            // 压缩图片 - 用户发送的真实图片，比表情包大一点
            const compressedBase64 = await this.compressImageForChat(base64Data);
            
            // 发送图片消息到聊天（不自动触发AI回复）
            const msg = {
                id: Date.now(),
                sender: 'user',
                content: compressedBase64,
                type: 'image',
                timestamp: Date.now(),
                isVisionImage: true // 标记为需要Vision识图的图片
            };
            API.Chat.addMessage(this.currentCharId, msg);
            this.renderMessages();
            
            // 不再自动调用AI，用户需要手动点击发送按钮
        };
        reader.readAsDataURL(file);
        input.value = ''; // 重置input
    },

    // 聊天图片压缩 - 比表情包大一点，不限制长宽比
    compressImageForChat: function(base64) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 最小尺寸150px，最大尺寸400px（比表情包80px大，但不会太大）
                const MIN_SIZE = 150;
                const MAX_SIZE = 400;
                
                // 获取较长边
                const maxDim = Math.max(width, height);
                const minDim = Math.min(width, height);
                
                // 如果太小，放大到最小尺寸
                if (minDim < MIN_SIZE) {
                    const scale = MIN_SIZE / minDim;
                    width *= scale;
                    height *= scale;
                }
                
                // 如果太大，缩小到最大尺寸
                if (Math.max(width, height) > MAX_SIZE) {
                    if (width > height) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = base64;
        });
    },

    // 图片压缩工具函数（通用）
    compressImage: function(base64, maxSize, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    },

    // ==================== 照片功能 (Gallery) ====================
    openGalleryMenu: function() {
        const submenu = document.getElementById('gallery-submenu');
        submenu.classList.remove('hidden');
    },

    closeGalleryMenu: function() {
        const submenu = document.getElementById('gallery-submenu');
        submenu.classList.add('hidden');
    },

    // 文字描述画图
    openTextDrawing: function() {
        this.closeGalleryMenu();
        document.getElementById('panel-container').classList.add('hidden');
        // 直接显示弹窗，不做任何延迟
        const modal = document.getElementById('text-drawing-modal');
        modal.classList.remove('hidden');
        document.getElementById('text-drawing-input').value = '';
        // 延迟focus避免键盘弹出卡顿
        setTimeout(() => {
            document.getElementById('text-drawing-input').focus();
        }, 100);
    },

    closeTextDrawing: function() {
        document.getElementById('text-drawing-modal').classList.add('hidden');
    },

    sendTextDrawing: function() {
        const input = document.getElementById('text-drawing-input');
        const description = input.value.trim();
        if (!description) {
            alert('请输入图片描述');
            return;
        }

        // 生成文字占位图（使用和AI意念图一样的规格500x500）
        const imageDataUrl = this.generateTextImageCard(description);

        // 发送图片消息（不自动触发AI，需要用户手动点击发送按钮）
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: imageDataUrl,
            type: 'image',
            timestamp: Date.now(),
            textDrawingDesc: description // 保存描述，供AI回复时使用
        };
        API.Chat.addMessage(this.currentCharId, msg);
        this.renderMessages();

        // 关闭弹窗
        this.closeTextDrawing();
        
        // 不再自动触发AI，用户需要手动点击发送按钮
    },

    // 从相册选择
    openGalleryPicker: function() {
        this.closeGalleryMenu();
        document.getElementById('panel-container').classList.add('hidden');
        document.getElementById('gallery-input').click();
    },

    handleGallerySelect: async function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            
            // 压缩图片 - 用户发送的真实图片
            const compressedBase64 = await this.compressImageForChat(base64Data);
            
            // 发送图片消息到聊天（不自动触发AI回复）
            const msg = {
                id: Date.now(),
                sender: 'user',
                content: compressedBase64,
                type: 'image',
                timestamp: Date.now(),
                isVisionImage: true // 标记为需要Vision识图的图片
            };
            API.Chat.addMessage(this.currentCharId, msg);
            this.renderMessages();
            
            // 不再自动调用AI，用户需要手动点击发送按钮
        };
        reader.readAsDataURL(file);
        input.value = ''; // 重置input
    }
};
