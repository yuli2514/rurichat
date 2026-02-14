/**
 * chatSettings/index.js
 * 聊天设置模块 - 核心入口
 * 
 * 整合所有子模块，提供统一的 ChatSettings 对外接口
 * 保持与原 chatSettings.js 完全兼容的API
 * 
 * 子模块：
 * - avatarHandlers.js: 头像和背景处理
 * - bindingSelectors.js: 世界书和表情包绑定选择器
 */

const ChatSettings = {
    /**
     * 清除聊天历史
     */
    clearHistory: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        
        const char = API.Chat.getChar(charId);
        if (!char) return;
        
        const choice = confirm(`删除与"${char.remark}"的数据\n\n点击"确定"：仅删除聊天记录\n点击"取消"后再选择：删除聊天记录+记忆`);
        
        if (choice) {
            API.Chat.saveHistory(charId, []);
            char.lastMessage = '聊天记录已清空';
            char.timestamp = Date.now();
            API.Chat.updateChar(char);
            ChatInterface.renderMessages();
            ChatManager.renderList();
            alert('聊天记录已删除');
        } else {
            if (confirm(`是否删除聊天记录和所有记忆？\n\n点击"确定"：删除聊天记录+记忆\n点击"取消"：不删除任何内容`)) {
                API.Chat.saveHistory(charId, []);
                API.Memory.saveMemories(charId, []);
                char.lastMessage = '聊天记录和记忆已清空';
                char.timestamp = Date.now();
                API.Chat.updateChar(char);
                ChatInterface.renderMessages();
                ChatManager.renderList();
                alert('聊天记录和记忆已全部删除');
            }
        }
    },

    /**
     * 打开设置面板
     */
    open: function() {
        const panel = document.getElementById('chat-settings-panel');
        panel.classList.remove('hidden');
        panel.classList.remove('translate-x-full');
        this.loadCharSettings();
    },

    /**
     * 关闭设置面板
     */
    close: function() {
        const panel = document.getElementById('chat-settings-panel');
        panel.classList.add('translate-x-full');
        setTimeout(() => panel.classList.add('hidden'), 300);
    },

    /**
     * 加载角色设置
     */
    loadCharSettings: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;

        const char = API.Chat.getChar(charId);
        if (!char) return;

        const settings = char.settings || {};

        // 基本信息显示
        const charNameDisplay = document.getElementById('setting-char-name-display');
        const userNameDisplay = document.getElementById('setting-user-name-display');
        if (charNameDisplay) charNameDisplay.textContent = char.name || 'AI名';
        if (userNameDisplay) {
            const profile = API.Profile.getProfile();
            userNameDisplay.textContent = profile.name || '用户';
        }

        const musicEmojiText = document.getElementById('setting-music-emoji-text');
        if (musicEmojiText) {
            musicEmojiText.textContent = settings.musicEmojiText || '🎵';
        }

        const charEnText = document.getElementById('setting-char-en-text');
        if (charEnText) charEnText.textContent = settings.charEnText || 'Character';

        const userEnText = document.getElementById('setting-user-en-text');
        if (userEnText) userEnText.textContent = settings.userEnText || 'User';

        document.getElementById('setting-char-avatar').src = char.avatar;
        document.getElementById('setting-char-prompt').value = char.prompt || '';
        document.getElementById('setting-char-remark').value = char.remark || '';
        
        // 加载角色名字（用于记忆总结）
        const charNameForSummary = document.getElementById('setting-char-name-for-summary');
        if (charNameForSummary) {
            charNameForSummary.value = settings.charNameForSummary || char.name || '';
        }
        
        // 加载用户称呼（用于记忆总结）
        const userNameForSummary = document.getElementById('setting-user-name-for-summary');
        if (userNameForSummary) {
            userNameForSummary.value = settings.userName || '';
        }
        
        const profile = API.Profile.getProfile();
        const userAvatarElement = document.getElementById('setting-user-avatar');
        if (userAvatarElement) {
            const avatarSrc = settings.userAvatar || profile.avatar || 'https://ui-avatars.com/api/?name=Me&background=0D8ABC&color=fff';
            userAvatarElement.src = avatarSrc;
        }
        
        document.getElementById('chat-header-name').textContent = char.remark;

        // 加载下拉选择器
        const loadDropdown = (id, data, settingKey, defaultText = '(无绑定)') => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = `<option value="">${defaultText}</option>`;
            data.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.name || item.title;
                if (settings[settingKey] === item.id) opt.selected = true;
                select.appendChild(opt);
            });
        };

        // 渲染世界书目录树（支持多选）
        BindingSelectors.renderWorldBookTree(settings.worldBookIds || []);
        
        // 渲染表情包多选列表
        BindingSelectors.renderEmojiMultiSelect(settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []));
        
        loadDropdown('setting-user-persona-select', API.Profile.getPersonas(), 'userPersonaId', '(默认用户)');

        // 加载自定义人设内容
        const personaContentArea = document.getElementById('setting-user-persona-content');
        if (personaContentArea) {
            if (settings.customPersonaContent) {
                personaContentArea.value = settings.customPersonaContent;
            } else if (settings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    personaContentArea.value = persona.content;
                }
            } else {
                personaContentArea.value = '';
            }
        }

        // 记忆设置
        document.getElementById('setting-ctx-length').value = settings.contextLength || 20;
        document.getElementById('setting-auto-summary').checked = settings.autoSummary || false;
        document.getElementById('setting-summary-freq').value = settings.summaryFreq || 10;
        document.getElementById('setting-summary-prompt').value = settings.summaryPrompt || '';
        document.getElementById('summary-options').classList.toggle('hidden', !settings.autoSummary);

        // 壁纸设置
        if (settings.wallpaper) {
            document.getElementById('setting-chat-bg-preview').src = settings.wallpaper;
            document.getElementById('setting-chat-bg-preview').classList.remove('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.add('hidden');
        } else {
            document.getElementById('setting-chat-bg-preview').classList.add('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.remove('hidden');
        }

        // 面板背景
        const panelPreview = document.getElementById('setting-panel-bg-preview');
        const bgContainer = document.getElementById('setting-panel-header');
        
        if (settings.panelBackground) {
            if (panelPreview) {
                panelPreview.style.backgroundImage = `url(${settings.panelBackground})`;
                panelPreview.style.opacity = '1';
            }
            if (bgContainer) {
                bgContainer.style.setProperty('--chat-bg-url', `url(${settings.panelBackground})`, 'important');
            }
        } else {
            if (panelPreview) {
                panelPreview.style.backgroundImage = '';
                panelPreview.style.opacity = '0';
            }
            if (bgContainer) {
                bgContainer.style.setProperty('--chat-bg-url', '');
            }
        }

        // CSS设置
        const cssBubble = settings.cssBubble || 1.0;
        const cssFont = settings.cssFont || 16;
        const cssAvatar = settings.cssAvatar || 40;
        const cssToolbar = settings.cssToolbar || 20;
        const cssAvatarRadius = settings.cssAvatarRadius !== undefined ? settings.cssAvatarRadius : 50;
        const customCss = settings.customCss || '';

        const sliderBubble = document.getElementById('setting-css-bubble');
        if (sliderBubble) sliderBubble.value = cssBubble;
        const valBubble = document.getElementById('val-bubble-size');
        if (valBubble) valBubble.textContent = cssBubble;
        
        const sliderFont = document.getElementById('setting-css-font');
        if (sliderFont) sliderFont.value = cssFont;
        const valFont = document.getElementById('val-font-size');
        if (valFont) valFont.textContent = cssFont + 'px';
        
        const sliderAvatar = document.getElementById('setting-css-avatar');
        if (sliderAvatar) sliderAvatar.value = cssAvatar;
        const valAvatar = document.getElementById('val-avatar-size');
        if (valAvatar) valAvatar.textContent = cssAvatar + 'px';

        const sliderToolbar = document.getElementById('setting-css-toolbar');
        if (sliderToolbar) sliderToolbar.value = cssToolbar;
        const valToolbar = document.getElementById('val-toolbar-icon');
        if (valToolbar) valToolbar.textContent = cssToolbar + 'px';

        // 头像圆润度
        const sliderAvatarRadius = document.getElementById('setting-css-avatar-radius');
        if (sliderAvatarRadius) sliderAvatarRadius.value = cssAvatarRadius;
        const valAvatarRadius = document.getElementById('val-avatar-radius');
        if (valAvatarRadius) valAvatarRadius.textContent = cssAvatarRadius + '%';

        const cssInput = document.getElementById('custom-css-input');
        if (cssInput) cssInput.value = customCss;
        
        const msgArea = document.getElementById('chat-messages');
        if (msgArea) {
            msgArea.style.setProperty('--chat-bubble-padding-v', (10 * cssBubble) + 'px');
            msgArea.style.setProperty('--chat-bubble-padding-h', (14 * cssBubble) + 'px');
            msgArea.style.setProperty('--chat-font-size', cssFont + 'px');
            msgArea.style.setProperty('--chat-avatar-size', cssAvatar + 'px');
            msgArea.style.setProperty('--chat-avatar-radius', cssAvatarRadius + '%');
        }

        // 角色感知现实世界
        const realWorldCheckbox = document.getElementById('setting-realworld-awareness');
        if (realWorldCheckbox) realWorldCheckbox.checked = settings.realWorldAwareness || false;

        // 时间戳设置
        const timestampAvatar = document.getElementById('setting-timestamp-avatar');
        if (timestampAvatar) timestampAvatar.checked = settings.timestampAvatar || false;
        const timestampBubble = document.getElementById('setting-timestamp-bubble');
        if (timestampBubble) timestampBubble.checked = settings.timestampBubble || false;

        const chatInterface = document.getElementById('super-chat-interface');
        if (chatInterface) {
            chatInterface.style.setProperty('--chat-toolbar-icon-size', cssToolbar + 'px');
        }
        
        let style = document.getElementById('char-custom-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'char-custom-css';
            document.head.appendChild(style);
        }
        style.textContent = customCss;
        
        CssManager.renderCssPresets();
    },

    // ==================== 保存方法 ====================
    
    saveCharNameEdit: function(span) {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;

        const text = span.textContent.trim();
        if (!text) {
            span.textContent = 'AI名';
            return;
        }

        API.Chat.updateChar(charId, { name: text });
    },

    saveUserName: function(span) {
        const profile = API.Profile.getProfile();
        const text = span.textContent.trim();
        profile.name = text || '用户';
        API.Profile.saveProfile(profile);
    },

    saveMusicEmojiText: function(span) {
        const text = span.textContent.trim();
        if (!text) {
            span.textContent = '🎵';
            return;
        }
        this.updateCharSettings({ musicEmojiText: text });
    },

    saveCharEnText: function(span) {
        const text = span.textContent.trim();
        this.updateCharSettings({ charEnText: text || 'Character' });
    },

    saveUserEnText: function(span) {
        const text = span.textContent.trim();
        this.updateCharSettings({ userEnText: text || 'User' });
    },

    saveCharInfo: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;

        const charNameForSummary = document.getElementById('setting-char-name-for-summary').value.trim();
        const remark = document.getElementById('setting-char-remark').value;
        const prompt = document.getElementById('setting-char-prompt').value;
        const userNameForSummary = document.getElementById('setting-user-name-for-summary').value.trim();
        
        API.Chat.updateChar(charId, { remark: remark, prompt: prompt });
        this.updateCharSettings({
            charNameForSummary: charNameForSummary || '',
            userName: userNameForSummary || '用户'
        });
        document.getElementById('chat-header-name').textContent = remark;
        alert('角色信息已保存');
    },

    saveBinding: function() {
        this.updateCharSettings({ worldBookId: document.getElementById('setting-worldbook-select').value });
    },

    saveEmojiBinding: function() {
        this.updateCharSettings({ emojiGroupId: document.getElementById('setting-emoji-select').value });
    },

    saveUserPersona: function() {
        const selectedId = document.getElementById('setting-user-persona-select').value;
        this.updateCharSettings({ userPersonaId: selectedId });
        
        const contentArea = document.getElementById('setting-user-persona-content');
        if (contentArea) { 
             if (selectedId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === selectedId);
                if (persona) {
                    contentArea.value = persona.content;
                }
            } else {
                contentArea.value = '';
            }
        }
    },

    openPersonaManager: function() {
        PersonaManager.openModal();
    },

    saveCustomPersona: function() {
        const content = document.getElementById('setting-user-persona-content').value;
        this.updateCharSettings({ customPersonaContent: content });
    },

    saveMemory: function() {
        const autoSummary = document.getElementById('setting-auto-summary').checked;
        document.getElementById('summary-options').classList.toggle('hidden', !autoSummary);
        
        this.updateCharSettings({
            contextLength: parseInt(document.getElementById('setting-ctx-length').value) || 20,
            autoSummary: autoSummary,
            summaryFreq: parseInt(document.getElementById('setting-summary-freq').value) || 10
        });
    },

    saveSummaryPrompt: function() {
        this.updateCharSettings({ summaryPrompt: document.getElementById('setting-summary-prompt').value });
    },

    saveRealWorldAwareness: function() {
        const checked = document.getElementById('setting-realworld-awareness').checked;
        this.updateCharSettings({ realWorldAwareness: checked });
    },

    saveTimestampSettings: function() {
        const timestampAvatar = document.getElementById('setting-timestamp-avatar').checked;
        const timestampBubble = document.getElementById('setting-timestamp-bubble').checked;
        this.updateCharSettings({
            timestampAvatar: timestampAvatar,
            timestampBubble: timestampBubble
        });
        // 重新渲染消息以应用时间戳
        if (typeof ChatInterface !== 'undefined') {
            ChatInterface.renderMessages();
        }
    },

    updateCharSettings: function(newSettings) {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        API.Chat.updateCharSettings(charId, newSettings);
    },

    // ==================== 头像和背景代理 ====================
    
    updateAvatar: function(input) {
        AvatarHandlers.updateAvatar(input);
    },

    updateUserAvatar: function(input) {
        AvatarHandlers.updateUserAvatar(input, this.updateCharSettings.bind(this));
    },

    updatePanelBackground: function(input) {
        AvatarHandlers.updatePanelBackground(input, this.updateCharSettings.bind(this), this.loadCharSettings.bind(this));
    },

    updateChatWallpaper: function(input) {
        AvatarHandlers.updateChatWallpaper(input, this.updateCharSettings.bind(this));
    },

    clearChatWallpaper: function() {
        AvatarHandlers.clearChatWallpaper(this.updateCharSettings.bind(this));
    },

    // ==================== 删除角色 ====================
    
    deleteChar: function() {
        if (!confirm('确定要删除这个角色吗？所有聊天记录也将被删除！')) return;
        
        const charId = ChatInterface.currentCharId;
        API.Chat.deleteChar(charId);
        
        this.close();
        ChatInterface.closeToList();
        ChatManager.renderList();
    },

    // ==================== 绑定选择器代理 ====================
    
    renderWorldBookTree: function(selectedIds) {
        BindingSelectors.renderWorldBookTree(selectedIds);
    },
    
    toggleWorldBook: function(bookId) {
        BindingSelectors.toggleWorldBook(bookId, this.updateCharSettings.bind(this));
    },

    renderEmojiMultiSelect: function(selectedIds) {
        BindingSelectors.renderEmojiMultiSelect(selectedIds);
    },
    
    toggleEmojiGroup: function(groupId) {
        BindingSelectors.toggleEmojiGroup(groupId, this.updateCharSettings.bind(this));
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatSettings;
}
