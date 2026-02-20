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

        const isSameChar = this.currentCharId === charId;
        this.currentCharId = charId;
        const char = API.Chat.getChar(charId);
        if (!char) return;

        // 立即显示界面，避免用户感知到延迟
        this._showInterface(char);

        // 异步加载设置和消息，提升响应速度
        requestAnimationFrame(() => {
            this._initializeAsync(isSameChar);
        });
    },

    /**
     * 立即显示界面（同步操作）
     */
    _showInterface: function(char) {
        // 设置顶栏角色名
        const headerName = document.getElementById('offline-header-name');
        if (headerName) headerName.textContent = char.remark || char.name;

        // 隐藏主屏幕
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.add('hidden');

        // 隐藏线上聊天界面
        const onlineInterface = document.getElementById('super-chat-interface');
        if (onlineInterface) onlineInterface.classList.add('hidden');

        // 显示线下模式界面
        const offlineInterface = document.getElementById('offline-mode-interface');
        if (offlineInterface) offlineInterface.classList.remove('hidden');
    },

    /**
     * 异步初始化（避免阻塞UI）
     */
    _initializeAsync: function(isSameChar) {
        // 分批处理初始化任务，避免长时间阻塞
        const tasks = [
            () => this.loadSettings(),
            () => {
                if (isSameChar) {
                    this._scrollToBottom();
                } else {
                    this.renderMessages();
                }
            },
            () => this._bindInputEvents()
        ];

        // 使用 setTimeout 分批执行任务
        let taskIndex = 0;
        const executeNextTask = () => {
            if (taskIndex < tasks.length) {
                try {
                    tasks[taskIndex]();
                } catch (e) {
                    console.error('[OfflineMode] Task execution error:', e);
                }
                taskIndex++;
                setTimeout(executeNextTask, 10); // 10ms间隔，保持UI响应
            }
        };
        executeNextTask();
    },

    /**
     * 绑定输入框事件（只绑一次）
     */
    _bindInputEvents: function() {
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
        
        // 重新显示线上聊天界面
        const onlineInterface = document.getElementById('super-chat-interface');
        if (onlineInterface) onlineInterface.classList.remove('hidden');
        
        // 不清空 currentCharId，下次重进同一角色可跳过重建
    },

    /**
     * 渲染消息列表
     */
    /**
     * 构建单条消息的 HTML 字符串
     */
    _buildMsgHtml: function(msg, index, avatarSize, fontSize, fontFamily, userAvatar, charAvatar) {
        const isUser = msg.sender === 'user';
        const avatar = isUser ? userAvatar : charAvatar;
        const fontStyle = 'font-size:' + fontSize + 'px;' + (fontFamily ? 'font-family:' + fontFamily + ';' : '');

        let html = '<div class="flex flex-col items-center mb-6">';
        html += '<div class="flex flex-col items-center shrink-0 mb-2">';
        html += '<img src="' + avatar + '" class="rounded-full object-cover shadow-sm" style="width:' + avatarSize + 'px; height:' + avatarSize + 'px;">';
        html += '</div>';
        html += '<div class="w-full flex justify-center">';
        if (isUser) {
            html += '<div class="bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/30 offline-bubble max-w-xs" data-msg-index="' + index + '">';
            html += '<p class="text-gray-800 leading-relaxed whitespace-pre-wrap" style="' + fontStyle + '">' + this._escapeHtml(msg.content) + '</p>';
            html += '</div>';
        } else {
            html += '<div class="bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/30 offline-bubble max-w-xs" data-msg-index="' + index + '">';
            html += '<div class="text-gray-800 leading-relaxed whitespace-pre-wrap" style="' + fontStyle + '">' + this._formatContent(msg.content) + '</div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    },

    /**
     * 绑定容器事件委托（只绑定一次）
     */
    _bindContainerEvents: function(container) {
        if (container._offlineEventsBound) return;
        container._offlineEventsBound = true;
        const self = this;

        const findBubble = (target) => {
            let el = target;
            while (el && el !== container) {
                if (el.classList && el.classList.contains('offline-bubble')) return el;
                el = el.parentElement;
            }
            return null;
        };

        container.addEventListener('touchstart', function(e) {
            const bubble = findBubble(e.target);
            if (!bubble) return;
            self.handleTouchStart(e, parseInt(bubble.getAttribute('data-msg-index')));
        }, { passive: true });

        container.addEventListener('touchmove', function(e) {
            self.handleTouchMove(e);
        }, { passive: true });

        container.addEventListener('touchend', function(e) {
            self.handleTouchEnd(e);
        }, { passive: true });

        container.addEventListener('mousedown', function(e) {
            const bubble = findBubble(e.target);
            if (!bubble) return;
            self.handleMouseDown(e, parseInt(bubble.getAttribute('data-msg-index')));
        });

        container.addEventListener('contextmenu', function(e) {
            const bubble = findBubble(e.target);
            if (!bubble) return;
            self.handleBubbleContextMenu(e, parseInt(bubble.getAttribute('data-msg-index')));
        });
    },

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

        const settings = API.Offline.getSettings(this.currentCharId);
        const avatarSize = settings.avatarSize || 32;
        const fontSize = settings.fontSize || 14;
        const fontFamily = settings.fontFamily || '';

        const charSettings = char ? (char.settings || {}) : {};
        const userAvatar = charSettings.userAvatar || profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';

        let html = '';
        history.forEach((msg, index) => {
            html += this._buildMsgHtml(msg, index, avatarSize, fontSize, fontFamily, userAvatar, charAvatar);
        });

        container.innerHTML = html;
        this._bindContainerEvents(container);
        this._scrollToBottom();
    },

    /**
     * 追加单条消息气泡（不重建整个列表，避免卡顿）
     */
    _appendMsgBubble: function(msg) {
        const container = document.getElementById('offline-messages');
        if (!container) return;

        // 如果当前显示的是空状态占位，先清空
        if (container.querySelector('.fa-book-open')) {
            container.innerHTML = '';
        }

        const history = API.Offline.getHistory(this.currentCharId);
        const index = history.length - 1; // 刚追加的消息在末尾

        const char = API.Chat.getChar(this.currentCharId);
        const profile = API.Profile.getProfile();
        const charAvatar = char ? char.avatar : 'https://placehold.co/40x40/dbeafe/3b82f6?text=AI';
        const settings = API.Offline.getSettings(this.currentCharId);
        const avatarSize = settings.avatarSize || 32;
        const fontSize = settings.fontSize || 14;
        const fontFamily = settings.fontFamily || '';
        const charSettings = char ? (char.settings || {}) : {};
        const userAvatar = charSettings.userAvatar || profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';

        const html = this._buildMsgHtml(msg, index, avatarSize, fontSize, fontFamily, userAvatar, charAvatar);
        container.insertAdjacentHTML('beforeend', html);
        this._bindContainerEvents(container);
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

        input.value = '';
        input.style.height = 'auto';

        // 直接追加气泡，不重建整个列表
        this._appendMsgBubble(msg);

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
        waitHtml += '<div class="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 flex items-center justify-center gap-2">';
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

            // 更新角色列表
            if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
                ChatManager.renderList();
            }

            // 直接追加AI气泡，不重建整个列表
            this._appendMsgBubble(aiMsg);

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
     * 重回（重新生成最后一条AI回复）
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
        
        // 优化：只移除最后一个消息气泡，不重建整个列表
        this._removeLastMessageBubble();

        // 重新生成
        this._triggerAI();
    },

    /**
     * 移除最后一个消息气泡（避免全量重建）
     */
    _removeLastMessageBubble: function() {
        const container = document.getElementById('offline-messages');
        if (!container) return;
        
        const lastBubble = container.lastElementChild;
        if (lastBubble && lastBubble.classList.contains('flex')) {
            lastBubble.remove();
        }
    },

    /**
     * 打开预设编辑模态框
     */
    openPresetModal: function() {
        this.renderPresetList();
        document.getElementById('offline-preset-modal').classList.remove('hidden');
        // 清空表单并重置编辑状态
        document.getElementById('offline-preset-name').value = '';
        document.getElementById('offline-preset-input').value = '';
        this._editingPresetId = null;
        // 恢复按钮文字
        const saveBtn = document.querySelector('#offline-preset-modal button[onclick="OfflineMode.savePreset()"]');
        if (saveBtn) saveBtn.textContent = '保存预设';
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

    // 当前正在编辑的预设ID（null表示新建）
    _editingPresetId: null,

    /**
     * 保存预设（新建或更新）
     */
    savePreset: function() {
        const name = document.getElementById('offline-preset-name').value.trim();
        const content = document.getElementById('offline-preset-input').value.trim();
        
        if (!name) return alert('请输入预设名称');
        if (!content) return alert('请输入预设内容');
        
        if (this._editingPresetId) {
            // 更新已有预设
            API.Offline.updatePreset(this.currentCharId, this._editingPresetId, { name, content });
            this._editingPresetId = null;
            alert('预设已更新');
        } else {
            // 新建预设
            API.Offline.addPreset(this.currentCharId, { name, content, enabled: true });
            alert('预设已保存');
        }
        
        this.renderPresetList();
        document.getElementById('offline-preset-name').value = '';
        document.getElementById('offline-preset-input').value = '';
        
        // 恢复按钮文字
        const saveBtn = document.querySelector('#offline-preset-modal button[onclick="OfflineMode.savePreset()"]');
        if (saveBtn) saveBtn.textContent = '保存预设';
    },

    /**
     * 编辑预设 - 将预设内容填入表单
     */
    editPreset: function(presetId) {
        const presets = API.Offline.getPresets(this.currentCharId);
        const preset = presets.find(p => p.id === presetId);
        if (!preset) return;

        // 填入表单
        document.getElementById('offline-preset-name').value = preset.name;
        document.getElementById('offline-preset-input').value = preset.content;
        this._editingPresetId = presetId;
        
        // 修改按钮文字为"更新预设"
        const saveBtn = document.querySelector('#offline-preset-modal button[onclick="OfflineMode.savePreset()"]');
        if (saveBtn) saveBtn.textContent = '更新预设';
        
        // 滚动到表单区域
        const formArea = document.getElementById('offline-preset-name');
        if (formArea) formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        // 字体输入框：优先显示原始URL，没有URL则显示字体名
        const fontInput = document.getElementById('offline-font-family');
        if (fontInput) fontInput.value = settings.fontUrl || settings.fontFamily || '';

        // 渲染字体预设列表
        this.renderFontPresetList();
        // 重置CSS预设编辑状态
        this._editingCssPresetId = null;

        document.getElementById('offline-settings-modal').classList.remove('hidden');
    },

    /**
     * 应用字体输入框中的字体（支持字体名、ttf/woff2 URL）
     */
    applyFontInput: function() {
        const fontInput = document.getElementById('offline-font-family');
        if (!fontInput) return;
        const val = fontInput.value.trim();
        if (!val) return;

        let fontName = val;

        // 检测是否为字体文件URL（ttf / woff2 / woff / otf）
        if (/\.(ttf|woff2?|otf)(\?.*)?$/i.test(val)) {
            fontName = 'offline-custom-font';
            this._injectFontFace(fontName, val);
            API.Offline.saveSettings(this.currentCharId, { fontUrl: val });
        } else {
            API.Offline.saveSettings(this.currentCharId, { fontUrl: '' });
        }

        // 直接注入 CSS 强制覆盖所有子元素字体
        this._applyFontCss(fontName);
        // 同时保存 fontFamily 供下次 renderMessages 使用
        API.Offline.saveSettings(this.currentCharId, { fontFamily: fontName });
    },

    /**
     * 通过注入 CSS 把字体强制应用到整个线下界面（排除图标元素）
     */
    _applyFontCss: function(fontFamily) {
        let style = document.getElementById('offline-font-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'offline-font-style';
            document.head.appendChild(style);
        }
        if (fontFamily) {
            // 排除 <i> 图标和 fa-* class，避免 Font Awesome 乱码
            style.textContent = `#offline-mode-interface *:not(i):not([class*="fa-"]) { font-family: "${fontFamily}" !important; }`;
        } else {
            style.textContent = '';
        }
    },

    /**
     * 清除线下模式字体，恢复默认
     */
    clearFont: function() {
        API.Offline.saveSettings(this.currentCharId, { fontFamily: '', fontUrl: '' });
        this._applyFontCss('');
        const fontInput = document.getElementById('offline-font-family');
        if (fontInput) fontInput.value = '';
    },

    /**
     * 注入 @font-face 到 <head>
     */
    _injectFontFace: function(fontName, url) {
        let faceStyle = document.getElementById('offline-font-face-style');
        if (!faceStyle) {
            faceStyle = document.createElement('style');
            faceStyle.id = 'offline-font-face-style';
            document.head.appendChild(faceStyle);
        }
        faceStyle.textContent = `@font-face { font-family: "${fontName}"; src: url("${url}"); }`;
    },

    closeSettings: function() {
        document.getElementById('offline-settings-modal').classList.add('hidden');
    },

    loadSettings: function() {
         const settings = API.Offline.getSettings(this.currentCharId);
         const offlineEl = document.getElementById('offline-mode-interface');
         const self = this;

         if (!offlineEl) {
             console.error('[OfflineMode] offline-mode-interface element not found');
             return;
         }

         // 确保定位始终保持为 absolute inset-0
         offlineEl.style.position = 'absolute';
         offlineEl.style.top = '0';
         offlineEl.style.left = '0';
         offlineEl.style.right = '0';
         offlineEl.style.bottom = '0';

         // 如果保存了字体URL，重新注入 @font-face
         if (settings.fontUrl) {
             this._injectFontFace('offline-custom-font', settings.fontUrl);
         }

         // 通过 CSS 强制应用字体到整个界面
         this._applyFontCss(settings.fontFamily || '');

         // 应用自定义 CSS
         this._applyCss(settings.customCss || '');

         // 应用壁纸或默认背景
         if (settings.wallpaper) {
             // 如果 localStorage 中有小型图片，直接使用
             offlineEl.style.backgroundImage = 'url(' + settings.wallpaper + ')';
             offlineEl.style.backgroundSize = 'cover';
             offlineEl.style.backgroundPosition = 'center';
             offlineEl.style.backgroundColor = 'transparent';
         } else {
             // 尝试从 IndexedDB 加载大型图片
             API.Offline._getWallpaperFromIndexedDB(this.currentCharId, function(wallpaperData) {
                 if (wallpaperData) {
                     offlineEl.style.backgroundImage = 'url(' + wallpaperData + ')';
                     offlineEl.style.backgroundSize = 'cover';
                     offlineEl.style.backgroundPosition = 'center';
                     offlineEl.style.backgroundColor = 'transparent';
                 } else {
                     // 默认灰白色背景
                     offlineEl.style.backgroundColor = '#f5f5f5';
                     offlineEl.style.backgroundImage = 'none';
                 }
             });
         }
     },

    updateSetting: function(key, value) {
        const update = {};
        update[key] = value;
        API.Offline.saveSettings(this.currentCharId, update);

        // 直接更新DOM，避免全量重建
        if (key === 'avatarSize') {
            const el = document.getElementById('val-offline-avatar-size');
            if (el) el.textContent = value + 'px';
            // 直接更新所有头像尺寸
            document.querySelectorAll('#offline-messages img.rounded-full').forEach(img => {
                img.style.width = value + 'px';
                img.style.height = value + 'px';
            });
        } else if (key === 'fontSize') {
            const el = document.getElementById('val-offline-font-size');
            if (el) el.textContent = value + 'px';
            // 直接更新所有消息文字大小
            document.querySelectorAll('#offline-messages .offline-bubble p, #offline-messages .offline-bubble div[style]').forEach(p => {
                p.style.fontSize = value + 'px';
            });
        } else if (key === 'fontFamily') {
            // 字体变化通过 _applyFontCss 处理，不需要重建
            this._applyFontCss(value);
        } else {
            // 其他设置（壁纸等）才需要重建
            this.renderMessages();
        }
    },

    // ==================== 字体预设 ====================

    /**
     * 渲染字体预设列表
     */
    renderFontPresetList: function() {
        const list = document.getElementById('offline-font-preset-list');
        if (!list) return;
        const presets = API.Offline.getFontPresets();
        if (presets.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">暂无字体预设</p>';
            return;
        }
        list.innerHTML = presets.map(p => `
            <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                <span class="flex-1 text-sm text-gray-800 truncate" style="font-family:${this._escapeHtml(p.fontFamily)}">${this._escapeHtml(p.name)}</span>
                <button onclick="OfflineMode.applyFontPreset(${p.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs font-bold hover:bg-blue-200 active:scale-90 transition">应用</button>
                <button onclick="OfflineMode.deleteFontPreset(${p.id})" class="w-6 h-6 flex items-center justify-center rounded bg-red-100 text-red-500 hover:bg-red-200 active:scale-90 transition">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        `).join('');
    },

    /**
     * 保存当前字体为预设
     */
    saveFontPreset: function() {
        const name = document.getElementById('offline-font-preset-name').value.trim();
        const fontFamily = document.getElementById('offline-font-family').value.trim();
        if (!name) return alert('请输入预设名称');
        if (!fontFamily) return alert('请先输入字体');
        // 同名覆盖
        const existing = API.Offline.getFontPresets().find(p => p.name === name);
        if (existing) {
            API.Offline.updateFontPreset(existing.id, { fontFamily });
        } else {
            API.Offline.addFontPreset({ name, fontFamily });
        }
        document.getElementById('offline-font-preset-name').value = '';
        this.renderFontPresetList();
    },

    /**
     * 应用字体预设
     */
    applyFontPreset: function(id) {
        const presets = API.Offline.getFontPresets();
        const p = presets.find(x => x.id === id);
        if (!p) return;
        const input = document.getElementById('offline-font-family');
        if (input) input.value = p.fontFamily;
        this.updateSetting('fontFamily', p.fontFamily);
    },

    /**
     * 删除字体预设
     */
    deleteFontPreset: function(id) {
        if (!confirm('确定删除这个字体预设？')) return;
        API.Offline.deleteFontPreset(id);
        this.renderFontPresetList();
    },

    // ==================== CSS 预设 ====================

    _editingCssPresetId: null,

    /**
     * 打开CSS预设选择弹窗
     */
    openCssPresetModal: function() {
        const modal = document.getElementById('offline-css-preset-modal');
        if (!modal) return;
        this._renderCssPresetModalList();
        modal.classList.remove('hidden');
    },

    closeCssPresetModal: function() {
        const modal = document.getElementById('offline-css-preset-modal');
        if (modal) modal.classList.add('hidden');
    },

    _renderCssPresetModalList: function() {
        const list = document.getElementById('offline-css-preset-modal-list');
        if (!list) return;
        const presets = API.Offline.getCssPresets();
        if (presets.length === 0) {
            list.innerHTML = '<span class="text-xs text-gray-400 block text-center py-4">暂无预设</span>';
            return;
        }
        list.innerHTML = presets.map(p => `
            <div class="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition">
                <span class="flex-1 text-sm text-gray-700 truncate">${this._escapeHtml(p.name)}</span>
                <button onclick="OfflineMode.applyCssPreset(${p.id})" class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold active:scale-95 transition">应用</button>
                <button onclick="OfflineMode.deleteCssPreset(${p.id})" class="text-[10px] bg-red-50 text-red-400 px-2 py-0.5 rounded font-bold active:scale-95 transition">删除</button>
            </div>
        `).join('');
    },

    /**
     * 保存CSS预设（弹出输入框命名）
     */
    saveCssPreset: function() {
        const css = document.getElementById('offline-custom-css').value.trim();
        if (!css) return alert('请先输入CSS内容');
        const name = prompt('请输入预设名称：');
        if (!name || !name.trim()) return;
        const trimmedName = name.trim();
        const existing = API.Offline.getCssPresets().find(p => p.name === trimmedName);
        if (existing) {
            API.Offline.updateCssPreset(existing.id, { name: trimmedName, css });
        } else {
            API.Offline.addCssPreset({ name: trimmedName, css });
        }
    },

    /**
     * 应用CSS预设（填入textarea并关闭弹窗）
     */
    applyCssPreset: function(id) {
        const presets = API.Offline.getCssPresets();
        const p = presets.find(x => x.id === id);
        if (!p) return;
        document.getElementById('offline-custom-css').value = p.css;
        this.closeCssPresetModal();
    },

    /**
     * 删除CSS预设
     */
    deleteCssPreset: function(id) {
        if (!confirm('确定删除这个CSS预设？')) return;
        API.Offline.deleteCssPreset(id);
        this._renderCssPresetModalList();
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
         API.Offline.saveSettings(this.currentCharId, { wallpaper: '' });
         // 同时删除 IndexedDB 中的大型壁纸数据
         API.Offline._deleteWallpaperFromIndexedDB(this.currentCharId);
         // 立即重置背景样式为默认
         const offlineEl = document.getElementById('offline-mode-interface');
         if (offlineEl) {
             offlineEl.style.backgroundColor = '#f5f5f5';
             offlineEl.style.backgroundImage = 'none';
         }
         document.getElementById('offline-wallpaper-input').value = '';
         this.renderMessages();
         alert('背景已清除，恢复默认灰白色');
     },

    /**
     * 处理本地背景上传
     */
    handleWallpaperUpload: function(input) {
        if (!input || !input.files || !input.files[0]) return;
        
        const file = input.files[0];
        const reader = new FileReader();
        const self = this;
        
        reader.onload = (e) => {
            try {
                const base64 = e.target.result;
                console.log('[OfflineMode] Wallpaper loaded, size:', base64.length);
                
                // 保存设置（会自动分离大型图片到 IndexedDB）
                const update = { wallpaper: base64 };
                API.Offline.saveSettings(self.currentCharId, update);
                console.log('[OfflineMode] Wallpaper save initiated');
                
                // 延迟应用设置，确保 IndexedDB 写入完成
                setTimeout(() => {
                    console.log('[OfflineMode] Loading settings after save...');
                    self.loadSettings();
                    
                    // 再延迟一次确保 IndexedDB 读取完成
                    setTimeout(() => {
                        console.log('[OfflineMode] Re-rendering messages');
                        self.renderMessages();
                        
                        const wallpaperInput = document.getElementById('offline-wallpaper-input');
                        if (wallpaperInput) {
                            wallpaperInput.value = '本地图片已上传';
                        }
                        
                        alert('背景已上传并应用');
                    }, 200);
                }, 300);
            } catch (err) {
                console.error('[OfflineMode] Error uploading wallpaper:', err);
                alert('背景上传失败: ' + err.message);
            } finally {
                // 清空 input 的 value，允许再次上传同一文件
                setTimeout(() => {
                    input.value = '';
                }, 200);
            }
        };
        
        reader.onerror = (err) => {
            console.error('[OfflineMode] FileReader error:', err);
            alert('读取文件失败，请重试');
            input.value = '';
        };
        
        reader.readAsDataURL(file);
    },

    applyCustomCss: function() {
        const css = document.getElementById('offline-custom-css').value.trim();
        
        // 防抖处理，避免频繁应用CSS导致卡顿
        if (this._cssApplyTimer) {
            clearTimeout(this._cssApplyTimer);
        }
        
        this._cssApplyTimer = setTimeout(() => {
            try {
                this.updateSetting('customCss', css);
                this._applyCss(css);
                
                // 移动端友好的提示，避免阻塞UI
                const indicator = document.createElement('div');
                indicator.textContent = 'CSS 已应用';
                indicator.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-lg text-sm z-[9999]';
                document.body.appendChild(indicator);
                
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 2000);
            } catch (e) {
                console.error('[OfflineMode] CSS应用失败:', e);
                alert('CSS 应用失败: ' + e.message);
            }
        }, 300);
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

        const self = this;
        this.longPressTimer = setTimeout(() => {
            self.longPressTriggered = true;
            self.showLongPressMenu(event, index);
        }, 500); // 500ms 触发长按

        // 添加鼠标移动监听
        const handleMouseMove = (moveEvent) => {
            const moveX = moveEvent.clientX;
            const moveY = moveEvent.clientY;
            // 移动超过20px则取消长按
            if (Math.abs(moveX - self.touchStartX) > 20 || Math.abs(moveY - self.touchStartY) > 20) {
                clearTimeout(self.longPressTimer);
                self.longPressTimer = null;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (self.longPressTimer) {
                clearTimeout(self.longPressTimer);
                self.longPressTimer = null;
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    },

    handleTouchStart: function(event, index) {
        console.log('[OfflineMode] handleTouchStart called, index:', index);
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
        this.currentContextMenuMsgIndex = index;
        this.longPressTriggered = false;

        const self = this;
        this.longPressTimer = setTimeout(() => {
            console.log('[OfflineMode] Touch long press triggered, showing menu');
            self.longPressTriggered = true;
            self.showLongPressMenu(event, index);
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
        console.log('[OfflineMode] showLongPressMenu called, index:', index);
        
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        this.currentContextMenuMsgIndex = index;
        
        const menu = document.getElementById('offline-longpress-menu');
        if (!menu) {
            console.error('[OfflineMode] Long press menu element not found in DOM');
            return;
        }
        
        console.log('[OfflineMode] Menu element found:', menu);

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

        let left = clientX;
        let top = clientY;
        
        console.log('[OfflineMode] Menu position before adjustment:', { left, top, innerWidth: window.innerWidth, innerHeight: window.innerHeight });
        
        // 防止菜单超出屏幕
        if (left + 120 > window.innerWidth) left = window.innerWidth - 130;
        if (top + 100 > window.innerHeight) top = top - 100;

        left = Math.max(10, left);
        top = Math.max(10, top);

        console.log('[OfflineMode] Menu position after adjustment:', { left, top });

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        menu.style.display = 'block';
        menu.classList.remove('hidden');
        
        console.log('[OfflineMode] Menu displayed at:', { top: menu.style.top, left: menu.style.left });

        // 移除旧的监听器
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler, true);
            document.removeEventListener('touchstart', this.menuCloseHandler, true);
        }

        // 创建新的关闭处理器
        const self = this;
        this.menuCloseHandler = (e) => {
            if (menu.contains(e.target)) {
                return;
            }
            self.closeLongPressMenu();
        };

        // 延迟添加关闭监听器，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', this.menuCloseHandler, true);
            document.addEventListener('touchstart', this.menuCloseHandler, { passive: true, capture: true });
        }, 200);
    },

    /**
     * 关闭长按菜单
     */
    closeLongPressMenu: function() {
        const menu = document.getElementById('offline-longpress-menu');
        if (menu) {
            menu.style.display = 'none';
            menu.classList.add('hidden');
        }
        if (this.menuCloseHandler) {
            document.removeEventListener('click', this.menuCloseHandler, true);
            document.removeEventListener('touchstart', this.menuCloseHandler, true);
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
        if (!history || index < 0 || index >= history.length) return;
        
        const msg = history[index];
        if (!msg) return;

        this._editingMessageIndex = index;
        const modal = document.getElementById('offline-edit-message-modal');
        const input = document.getElementById('offline-edit-message-input');
        
        if (!modal || !input) {
            console.warn('[OfflineMode] Edit modal or input not found');
            return;
        }
        
        input.value = msg.content || '';
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    },

    /**
     * 取消编辑消息
     */
    cancelEditMessage: function() {
        const modal = document.getElementById('offline-edit-message-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
        this._editingMessageIndex = null;
    },

    /**
     * 确认编辑消息
     */
    confirmEditMessage: function() {
        const index = this._editingMessageIndex;
        if (index === null) return;

        const input = document.getElementById('offline-edit-message-input');
        if (!input) return;
        
        const newText = input.value.trim();

        if (!newText) {
            alert('消息内容不能为空');
            return;
        }

        const history = API.Offline.getHistory(this.currentCharId);
        if (!history || index < 0 || index >= history.length) return;
        
        const msg = history[index];
        if (!msg) return;

        msg.content = newText;
        msg.edited = true;
        msg.editedAt = Date.now();
        
        // 异步保存，避免阻塞UI
        setTimeout(() => {
            API.Offline.saveHistory(this.currentCharId, history);
        }, 0);

        // 立即更新DOM中对应的消息气泡，避免全量重建
        this._updateMessageBubble(index, newText);
        this.cancelEditMessage();
    },

    /**
     * 删除消息
     */
    deleteMessage: function(index) {
        if (!confirm('确定要删除这条消息吗？')) return;
        
        const history = API.Offline.getHistory(this.currentCharId);
        if (!history || index < 0 || index >= history.length) return;
        
        history.splice(index, 1);
        
        // 异步保存，避免阻塞UI
        setTimeout(() => {
            API.Offline.saveHistory(this.currentCharId, history);
        }, 0);

        // 立即移除DOM中对应的消息气泡，避免全量重建
        this._removeMessageBubble(index);
        
        // 更新后续消息的索引
        this._updateMessageIndices(index);
    },

    /**
     * 更新指定消息气泡的内容（避免全量重建）
     */
    _updateMessageBubble: function(index, newContent) {
        const container = document.getElementById('offline-messages');
        if (!container) return;
        
        const bubble = container.querySelector(`[data-msg-index="${index}"]`);
        if (!bubble) {
            // 如果找不到对应气泡，回退到全量重建
            this.renderMessages();
            return;
        }
        
        const contentEl = bubble.querySelector('p, div[style]');
        if (contentEl) {
            contentEl.textContent = newContent;
        }
    },

    /**
     * 移除指定消息气泡（避免全量重建）
     */
    _removeMessageBubble: function(index) {
        const container = document.getElementById('offline-messages');
        if (!container) return;
        
        const bubble = container.querySelector(`[data-msg-index="${index}"]`);
        if (bubble) {
            // 找到包含气泡的完整消息容器（包括头像）
            let messageContainer = bubble;
            while (messageContainer && !messageContainer.classList.contains('mb-6')) {
                messageContainer = messageContainer.parentElement;
            }
            if (messageContainer) {
                messageContainer.remove();
            } else {
                bubble.remove();
            }
        }
    },

    /**
     * 更新删除消息后的索引（避免索引错乱）
     */
    _updateMessageIndices: function(deletedIndex) {
        const container = document.getElementById('offline-messages');
        if (!container) return;
        
        const bubbles = container.querySelectorAll('[data-msg-index]');
        bubbles.forEach(bubble => {
            const currentIndex = parseInt(bubble.getAttribute('data-msg-index'));
            if (currentIndex > deletedIndex) {
                bubble.setAttribute('data-msg-index', currentIndex - 1);
            }
        });
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineMode;
}
