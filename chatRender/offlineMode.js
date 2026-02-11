/**
 * chatRender/offlineMode.js
 * 线下模式 - 长剧情描写对话
 * 
 * 包含：
 * - 线下模式页面控制
 * - 消息发送与渲染
 * - AI剧情生成
 * - 预设管理
 */

const OfflineMode = {
    currentCharId: null,

    /**
     * 打开线下模式
     */
    open: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) {
            alert('请先打开一个角色的聊天');
            return;
        }

        this.currentCharId = charId;
        const char = API.Chat.getChar(charId);
        if (!char) return;

        // 设置顶栏角色名
        const headerName = document.getElementById('offline-header-name');
        if (headerName) headerName.textContent = char.remark || char.name;

        // 隐藏主屏幕（home-screen）
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.add('hidden');

        // 隐藏线上聊天界面，确保线下模式是独立页面
        const onlineInterface = document.getElementById('super-chat-interface');
        if (onlineInterface) onlineInterface.classList.add('hidden');

        // 显示线下模式界面
        document.getElementById('offline-mode-interface').classList.remove('hidden');

        // 加载设置
        this.loadSettings();

        // 渲染消息
        this.renderMessages();

        // 输入框不要回车发送，允许换行
        const input = document.getElementById('offline-input');
        if (input && !input._offlineBound) {
            input._offlineBound = true;
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 96) + 'px';
            });
        }
    },

    /**
     * 关闭线下模式，返回聊天界面
     */
    close: function() {
        document.getElementById('offline-mode-interface').classList.add('hidden');
        
        // 重新显示线上聊天界面（不显示主屏幕）
        const onlineInterface = document.getElementById('super-chat-interface');
        if (onlineInterface) onlineInterface.classList.remove('hidden');
        
        this.currentCharId = null;
    },

    /**
     * 渲染消息列表
     */
    renderMessages: function() {
        const container = document.getElementById('offline-messages');
        if (!container) return;

        const history = API.Offline.getHistory(this.currentCharId);
        const char = API.Chat.getChar(this.currentCharId);
        const profile = API.Profile.getProfile();
        const charAvatar = char ? char.avatar : 'https://placehold.co/40x40/dbeafe/3b82f6?text=AI';

        if (history.length === 0) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400">' +
                '<i class="fa-solid fa-book-open text-4xl mb-3 opacity-40"></i>' +
                '<p class="text-sm">线下剧情模式</p>' +
                '<p class="text-xs mt-1 opacity-70">发送一条消息开始你的故事</p>' +
                '</div>';
            return;
        }

        let html = '';
        const settings = API.Offline.getSettings(this.currentCharId);
        const avatarSize = settings.avatarSize || 32;
        const fontSize = settings.fontSize || 14;
        
        // 获取用户头像：优先使用角色单独设置的用户头像，否则使用全局用户头像
        const charSettings = char ? (char.settings || {}) : {};
        const perCharUserAvatar = charSettings.userAvatar || null;
        const globalUserAvatar = profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';
        const userAvatarForOffline = perCharUserAvatar || globalUserAvatar;

        history.forEach((msg, index) => {
            const isUser = msg.sender === 'user';
            const avatar = isUser ? userAvatarForOffline : charAvatar;

            // 头像在气泡上面中间的布局
            html += '<div class="flex flex-col items-center mb-6">';
            
            // 头像在上面
            html += '<div class="flex flex-col items-center shrink-0 mb-2">';
            html += '<img src="' + avatar + '" class="rounded-full object-cover shadow-sm" style="width:' + avatarSize + 'px; height:' + avatarSize + 'px;">';
            html += '</div>';
            
            // 消息气泡
            html += '<div class="w-full flex justify-center">';
            if (isUser) {
                html += '<div class="bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/30 offline-bubble max-w-xs" data-msg-index="' + index + '">';
                html += '<p class="text-gray-800 leading-relaxed whitespace-pre-wrap" style="font-size:' + fontSize + 'px;">' + this._escapeHtml(msg.content) + '</p>';
                html += '</div>';
            } else {
                html += '<div class="bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/30 offline-bubble max-w-xs" data-msg-index="' + index + '">';
                html += '<div class="text-gray-800 leading-relaxed whitespace-pre-wrap" style="font-size:' + fontSize + 'px;">' + this._formatContent(msg.content) + '</div>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
        
        // 为所有气泡添加事件监听
        const bubbles = container.querySelectorAll('.offline-bubble');
        bubbles.forEach((bubble) => {
            const index = parseInt(bubble.getAttribute('data-msg-index'));
            
            // 触摸事件
            bubble.addEventListener('touchstart', (e) => this.handleTouchStart(e, index), { passive: true });
            bubble.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
            bubble.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
            
            // 鼠标事件
            bubble.addEventListener('mousedown', (e) => this.handleMouseDown(e, index));
            bubble.addEventListener('contextmenu', (e) => this.handleBubbleContextMenu(e, index));
        });
        
        this._scrollToBottom();
    },

    /**
     * 发送用户消息
     */
    sendMessage: function() {
        const input = document.getElementById('offline-input');
        const text = input.value.trim();
        if (!text) return;

        const msg = {
            id: Date.now(),
            sender: 'user',
            content: text,
            type: 'text',
            timestamp: Date.now(),
            mode: 'offline'
        };

        API.Offline.addMessage(this.currentCharId, msg);
        
        // 同时添加到线上聊天记录（互通）
        API.Chat.addMessage(this.currentCharId, {
            ...msg,
            content: '[线下剧情] ' + text
        });

        input.value = '';
        input.style.height = 'auto';
        this.renderMessages();

        // 自动触发AI回复
        this._triggerAI();
    },

    /**
     * 触发AI生成剧情
     */
    _triggerAI: async function() {
        const container = document.getElementById('offline-messages');
        
        // 显示等待气泡
        const waitingId = 'waiting-bubble-' + Date.now();
        const char = API.Chat.getChar(this.currentCharId);
        const charAvatar = char ? char.avatar : 'https://placehold.co/40x40/dbeafe/3b82f6?text=AI';
        const settings = API.Offline.getSettings(this.currentCharId);
        const avatarSize = settings.avatarSize || 32;
        
        let waitHtml = '<div id="' + waitingId + '" class="flex flex-col items-center mb-6">';
        waitHtml += '<div class="flex flex-col items-center shrink-0 mb-2">';
        waitHtml += '<img src="' + charAvatar + '" class="rounded-full object-cover shadow-sm" style="width:' + avatarSize + 'px; height:' + avatarSize + 'px;">';
        waitHtml += '</div>';
        waitHtml += '<div class="w-full flex justify-center">';
        waitHtml += '<div class="bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/30 flex items-center justify-center gap-2">';
        waitHtml += '<div class="flex gap-1">';
        waitHtml += '<span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay:0s"></span>';
        waitHtml += '<span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay:0.15s"></span>';
        waitHtml += '<span class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay:0.3s"></span>';
        waitHtml += '</div>';
        waitHtml += '<span class="text-xs text-gray-400">正在构思剧情...</span>';
        waitHtml += '</div>';
        waitHtml += '</div>';
        waitHtml += '</div>';
        
        container.insertAdjacentHTML('beforeend', waitHtml);
        this._scrollToBottom();

        try {
            const reply = await API.Offline.generateReply(this.currentCharId);

            // 移除等待气泡
            const waitEl = document.getElementById(waitingId);
            if (waitEl) waitEl.remove();

            // 保存AI回复
            const aiMsg = {
                id: Date.now(),
                sender: 'ai',
                content: reply,
                type: 'text',
                timestamp: Date.now(),
                mode: 'offline'
            };
            API.Offline.addMessage(this.currentCharId, aiMsg);

            // 同时添加到线上聊天记录（互通）
            API.Chat.addMessage(this.currentCharId, {
                ...aiMsg,
                content: '[线下剧情] ' + reply.substring(0, 50) + '...'
            });

            // 更新角色列表
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }

            this.renderMessages();

            // 触发自动总结（如果启用）
            API.Offline.autoSummarizeOfflineChat(this.currentCharId);
         } catch (e) {
             // 移除等待气泡
             const waitEl = document.getElementById(waitingId);
             if (waitEl) waitEl.remove();
             
             alert('AI 请求失败: ' + e.message);
         }
     },

    /**
     * 重回（��新生成最后一条AI回复）
     */
    regenerate: async function() {
        const history = API.Offline.getHistory(this.currentCharId);
        if (history.length === 0) return;

        const lastMsg = history[history.length - 1];
        if (lastMsg.sender === 'user') {
            alert('最后一条消息是你发送的，将直接生成AI回复');
            this._triggerAI();
            return;
        }

        // 删除最后一条AI消息
        history.pop();
        API.Offline.saveHistory(this.currentCharId, history);
        this.renderMessages();

        // 重新生成
        this._triggerAI();
    },

    /**
     * 打开预设编辑模态框
     */
    openPresetModal: function() {
        this.renderPresetList();
        document.getElementById('offline-preset-modal').classList.remove('hidden');
        // 清空表单
        document.getElementById('offline-preset-name').value = '';
        document.getElementById('offline-preset-input').value = '';
    },

    closePresetModal: function() {
        document.getElementById('offline-preset-modal').classList.add('hidden');
    },

    /**
     * 渲染预设列表
     */
    renderPresetList: function() {
        const list = document.getElementById('offline-preset-list');
        const presets = API.Offline.getPresets(this.currentCharId);
        
        if (presets.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 text-center py-3">暂无预设，创建一个新预设</p>';
            return;
        }

        list.innerHTML = presets.map(preset => `
            <div class="bg-gray-50 rounded-lg p-3 flex items-start gap-2 border border-gray-200">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <input type="checkbox" ${preset.enabled ? 'checked' : ''} onchange="OfflineMode.togglePreset(${preset.id})" class="w-4 h-4 cursor-pointer">
                        <span class="font-medium text-sm text-gray-800 truncate">${this._escapeHtml(preset.name)}</span>
                    </div>
                    <p class="text-xs text-gray-600 line-clamp-2">${this._escapeHtml(preset.content.substring(0, 60))}...</p>
                </div>
                <div class="flex gap-1 shrink-0">
                    <button onclick="OfflineMode.editPreset(${preset.id})" class="w-6 h-6 flex items-center justify-center rounded text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 active:scale-90 transition">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="OfflineMode.deletePreset(${preset.id})" class="w-6 h-6 flex items-center justify-center rounded text-xs bg-red-100 text-red-600 hover:bg-red-200 active:scale-90 transition">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * 保存预设
     */
    savePreset: function() {
        const name = document.getElementById('offline-preset-name').value.trim();
        const content = document.getElementById('offline-preset-input').value.trim();
        
        if (!name) return alert('请输入预设名称');
        if (!content) return alert('请输入预设内容');
        
        API.Offline.addPreset(this.currentCharId, { name, content, enabled: true });
        this.renderPresetList();
        document.getElementById('offline-preset-name').value = '';
        document.getElementById('offline-preset-input').value = '';
        alert('预设已保存');
    },

    /**
     * 编辑预设
     */
    editPreset: function(presetId) {
        const presets = API.Offline.getPresets(this.currentCharId);
        const preset = presets.find(p => p.id === presetId);
        if (!preset) return;

        const newName = prompt('编辑预设名称:', preset.name);
        if (newName === null) return;
        
        const newContent = prompt('编辑预设内容:', preset.content);
        if (newContent === null) return;

        if (!newName.trim()) return alert('预设名称不能为空');
        if (!newContent.trim()) return alert('预设内容不能为空');

        API.Offline.updatePreset(this.currentCharId, presetId, { name: newName, content: newContent });
        this.renderPresetList();
        alert('预设已更新');
    },

    /**
     * 删除预设
     */
    deletePreset: function(presetId) {
        if (!confirm('确定要删除这个预设吗？')) return;
        API.Offline.deletePreset(this.currentCharId, presetId);
        this.renderPresetList();
    },

    /**
     * 切换预设启用状态
     */
    togglePreset: function(presetId) {
        API.Offline.togglePreset(this.currentCharId, presetId);
        this.renderPresetList();
    },

    /**
     * 打开设置模态框
     */
    openSettings: function() {
        const settings = API.Offline.getSettings(this.currentCharId);
        
        document.getElementById('offline-wallpaper-input').value = settings.wallpaper || '';
        document.getElementById('val-offline-avatar-size').textContent = (settings.avatarSize || 32) + 'px';
        document.querySelector('input[oninput*="avatarSize"]').value = settings.avatarSize || 32;
        document.getElementById('val-offline-font-size').textContent = (settings.fontSize || 14) + 'px';
        document.querySelector('input[oninput*="fontSize"]').value = settings.fontSize || 14;
        document.getElementById('offline-custom-css').value = settings.customCss || '';

        document.getElementById('offline-settings-modal').classList.remove('hidden');
    },

    closeSettings: function() {
        document.getElementById('offline-settings-modal').classList.add('hidden');
    },

    loadSettings: function() {
         const settings = API.Offline.getSettings(this.currentCharId);
         const interface = document.getElementById('offline-mode-interface');

         // 确保定位始终保持为 absolute inset-0
         interface.style.position = 'absolute';
         interface.style.top = '0';
         interface.style.left = '0';
         interface.style.right = '0';
         interface.style.bottom = '0';

         // 应用壁纸或默认背景
         if (settings.wallpaper) {
             interface.style.backgroundImage = 'url(' + settings.wallpaper + ')';
             interface.style.backgroundSize = 'cover';
             interface.style.backgroundPosition = 'center';
             interface.style.backgroundColor = 'transparent';
         } else {
             // 默认灰白色背景
             interface.style.backgroundColor = '#f5f5f5';
             interface.style.backgroundImage = 'none';
         }

         // 应用自定义 CSS
         this._applyCss(settings.customCss || '');
     },

    updateSetting: function(key, value) {
        const update = {};
        update[key] = value;
        API.Offline.saveSettings(this.currentCharId, update);
        
        if (key === 'avatarSize') {
            document.getElementById('val-offline-avatar-size').textContent = value + 'px';
        } else if (key === 'fontSize') {
            document.getElementById('val-offline-font-size').textContent = value + 'px';
        }
        
        this.renderMessages();
    },

    uploadWallpaper: function() {
         const url = document.getElementById('offline-wallpaper-input').value.trim();
         if (!url) return alert('请输入图片 URL');
         this.updateSetting('wallpaper', url);
         this.loadSettings();
         alert('背景已更新');
     },

     /**
      * 清除背景，恢复默认灰白色
      */
    clearWallpaper: function() {
         this.updateSetting('wallpaper', '');
         this.loadSettings();
         document.getElementById('offline-wallpaper-input').value = '';
         alert('背景已清除，恢复默认灰白色');
     },

    /**
     * 处理本地背景上传
     */
    handleWallpaperUpload: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                this.updateSetting('wallpaper', base64);
                this.loadSettings();
                document.getElementById('offline-wallpaper-input').value = '本地图片已上传';
                alert('背景已上传并应用');
                // 清空 input 的 value，允许再次上传同一文件
                input.value = '';
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    applyCustomCss: function() {
        const css = document.getElementById('offline-custom-css').value.trim();
        this.updateSetting('customCss', css);
        this._applyCss(css);
        alert('CSS 已应用');
    },

    clearCustomCss: function() {
        document.getElementById('offline-custom-css').value = '';
        this.updateSetting('customCss', '');
        this._applyCss('');
    },

    _applyCss: function(css) {
        let style = document.getElementById('offline-custom-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'offline-custom-style';
            document.head.appendChild(style);
        }
        // 限制 CSS 作用域到线下模式界面
        if (css.trim()) {
            const scopedCss = css.split('}').map(rule => {
                if (!rule.trim()) return '';
                return '#offline-mode-interface ' + rule.trim() + '}';
            }).join('\n');
            style.textContent = scopedCss;
        } else {
            style.textContent = '';
        }
    },

    /**
     * 清空线下对话记录
     */
    clearHistory: function() {
        if (!confirm('确定要清空所有线下对话记录吗？此操作不可恢复。')) return;
        API.Offline.saveHistory(this.currentCharId, []);
        this.closeSettings();
        this.renderMessages();
    },

    /**
     * 滚动到底部
     */
    _scrollToBottom: function() {
        const container = document.getElementById('offline-messages');
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    },

    /**
     * HTML转义
     */
    _escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 格式化AI回复内容（保留段落格式，移除非剧情内容）
     */
    _formatContent: function(content) {
        if (!content) return '';
        
        // 先移除HTML标签（包括<center>、</center>等）
        let text = content.replace(/<[^>]*>/g, '');
        
        // 再转义HTML
        text = this._escapeHtml(text);
        
        // 移除常见的格式标记和非剧情内容
        // 移除【】括号内的内容（如【系统】、【旁白】等）
        text = text.replace(/【[^】]*】/g, '');
        
        // 移除*号标记（如*动作*、*表情*等）
        text = text.replace(/\*[^*]*\*/g, '');
        
        // 移除(括号)内的舞台指示
        text = text.replace(/\([^)]*\)/g, '');
        
        // 移除---分隔线
        text = text.replace(/---+/g, '');
        
        // 移除===分隔线
        text = text.replace(/===+/g, '');
        
        // 清理多余空行（保留段落分隔）
        text = text.replace(/\n\n\n+/g, '\n\n');
        
        // 将连续换行转为段落分隔
        text = text.replace(/\n\n+/g, '</p><p class="mt-4">');
        text = '<p>' + text + '</p>';
        
        // 单个换行转为<br>
        text = text.replace(/\n/g, '<br>');
        
        // 清理空的段落标签
        text = text.replace(/<p>\s*<\/p>/g, '');
        text = text.replace(/<p class="mt-4">\s*<\/p>/g, '');
        
        return text;
    },

    /**
     * 触摸开始事件处理（长按检测）
     */
    touchStartX: 0,
    touchStartY: 0,
    longPressTimer: null,
    longPressTriggered: false,
    currentContextMenuMsgIndex: null,
    menuCloseHandler: null,
    _editingMessageIndex: null,

    /**
     * 鼠标按下事件处理（桌面端长按检测）
     */
    handleMouseDown: function(event, index) {
        // 只处理左键
        if (event.button !== 0) return;
        
        this.touchStartX = event.clientX;
        this.touchStartY = event.clientY;
        this.currentContextMenuMsgIndex = index;
        this.longPressTriggered = false;

        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            this.showLongPressMenu(event, index);
        }, 500); // 500ms 触发长按

        // 添加鼠标移动监听
        const handleMouseMove = (moveEvent) => {
            const moveX = moveEvent.clientX;
            const moveY = moveEvent.clientY;
            // 移动超过20px则取消长按
            if (Math.abs(moveX - this.touchStartX) > 20 || Math.abs(moveY - this.touchStartY) > 20) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    },

    handleTouchStart: function(event, index) {
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
        this.currentContextMenuMsgIndex = index;
        this.longPressTriggered = false;

        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            this.showLongPressMenu(event, index);
        }, 500); // 500ms 触发长按
    },

    /**
     * 触摸移动事件处理
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
     * 处理气泡右键菜单/长按菜单
     */
    handleBubbleContextMenu: function(event, index) {
        if (event.type === 'contextmenu') {
            // 桌面端右键菜单
            event.preventDefault();
            this.showContextMenu(event, index);
        } else {
            // 移动端长按菜单
            this.showLongPressMenu(event, index);
        }
    },

    /**
     * 显示长按菜单
     */
    showLongPressMenu: function(event, index) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        this.currentContextMenuMsgIndex = index;
        
        const menu = document.getElementById('offline-longpress-menu');
        if (!menu) return;
        
        const container = document.getElementById('offline-mode-interface');
        const containerRect = container.getBoundingClientRect();

        let clientX = 0;
        let clientY = 0;

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

        let left = clientX - containerRect.left;
        let top = clientY - containerRect.top;
        
        if (left + 120 > containerRect.width) left = containerRect.width - 130;
        if (top + 100 > containerRect.height) top = top - 100;

        left = Math.max(10, left);
        top = Math.max(10, top);

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        menu.classList.remove('hidden');

        // 移除旧的监听器
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchstart', this.menuCloseHandler);
        }

        // 创建新的关闭处理器
        this.menuCloseHandler = (e) => {
            if (menu.contains(e.target)) {
                return;
            }
            setTimeout(() => {
                this.closeLongPressMenu();
            }, 100);
        };

        // 延迟添加关闭监听器
        setTimeout(() => {
            document.addEventListener('click', this.menuCloseHandler);
            document.addEventListener('touchstart', this.menuCloseHandler, { passive: true });
        }, 300);
    },

    /**
     * 关闭长按菜单
     */
    closeLongPressMenu: function() {
        const menu = document.getElementById('offline-longpress-menu');
        if (menu) {
            menu.classList.add('hidden');
        }
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler);
            document.removeEventListener('touchstart', this.menuCloseHandler);
            this.menuCloseHandler = null;
        }
    },

    /**
     * 处理长按菜单操作
     */
    handleLongPressAction: function(action) {
        const index = this.currentContextMenuMsgIndex;
        if (index === null) return;
        
        const history = API.Offline.getHistory(this.currentCharId);
        const msg = history[index];
        if (!msg) return;

        this.closeLongPressMenu();

        if (action === 'edit') {
            this.openEditMessage(index);
        } else if (action === 'delete') {
            this.deleteMessage(index);
        }
    },

    /**
     * 打开编辑消息弹窗
     */
    openEditMessage: function(index) {
        const history = API.Offline.getHistory(this.currentCharId);
        const msg = history[index];
        if (!msg || msg.type !== 'text') return;

        this._editingMessageIndex = index;
        const modal = document.getElementById('offline-edit-message-modal');
        const input = document.getElementById('offline-edit-message-input');
        
        input.value = msg.content;
        modal.classList.remove('hidden');
        input.focus();
    },

    /**
     * 取消编辑消息
     */
    cancelEditMessage: function() {
        const modal = document.getElementById('offline-edit-message-modal');
        modal.classList.add('hidden');
        this._editingMessageIndex = null;
    },

    /**
     * 确认编辑消息
     */
    confirmEditMessage: function() {
        const index = this._editingMessageIndex;
        if (index === null) return;

        const input = document.getElementById('offline-edit-message-input');
        const newText = input.value.trim();

        if (!newText) {
            alert('消息内容不能为空');
            return;
        }

        const history = API.Offline.getHistory(this.currentCharId);
        const msg = history[index];
        if (!msg) return;

        msg.content = newText;
        msg.edited = true;
        msg.editedAt = Date.now();
        
        API.Offline.saveHistory(this.currentCharId, history);
        this.renderMessages();

        this.cancelEditMessage();
    },

    /**
     * 删除消息
     */
    deleteMessage: function(index) {
        if (!confirm('确定要删除这条消息吗？')) return;
        
        const history = API.Offline.getHistory(this.currentCharId);
        history.splice(index, 1);
        
        API.Offline.saveHistory(this.currentCharId, history);
        this.renderMessages();
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineMode;
}
