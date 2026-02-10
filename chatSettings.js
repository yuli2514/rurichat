/**
 * chatSettings.js
 * 负责角色聊天设置、面具管理、CSS自定义等
 */

const ChatSettings = {
    clearHistory: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        
        const char = API.Chat.getChar(charId);
        if (!char) return;
        
        // Show options dialog
        const choice = confirm(`删除与"${char.remark}"的数据\n\n点击"确定"：仅删除聊天记录\n点击"取消"后再选择：删除聊天记录+记忆`);
        
        if (choice) {
            // Only delete chat history
            API.Chat.saveHistory(charId, []);
            char.lastMessage = '聊天记录已清空';
            char.timestamp = Date.now();
            API.Chat.updateChar(char);
            ChatInterface.renderMessages();
            ChatManager.renderList();
            alert('聊天记录已删除');
        } else {
            // Ask if want to delete both
            if (confirm(`是否删除聊天记录和所有记忆？\n\n点击"确定"：删除聊天记录+记忆\n点击"取消"：不删除任何内容`)) {
                // Delete both chat history and memories
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

    open: function() {
        const panel = document.getElementById('chat-settings-panel');
        panel.classList.remove('hidden');
        panel.classList.remove('translate-x-full');
        this.loadCharSettings();
    },

    close: function() {
        const panel = document.getElementById('chat-settings-panel');
        panel.classList.add('translate-x-full');
        setTimeout(() => panel.classList.add('hidden'), 300);
    },

    loadCharSettings: function() {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;

        const char = API.Chat.getChar(charId);
        if (!char) return;

        const settings = char.settings || {};

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
        this.renderWorldBookTree(settings.worldBookIds || []);
        
        // 渲染表情包多选列表
        this.renderEmojiMultiSelect(settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []));
        
        loadDropdown('setting-user-persona-select', API.Profile.getPersonas(), 'userPersonaId', '(默认用户)');

        // Load custom persona content (auto-saved)
        const personaContentArea = document.getElementById('setting-user-persona-content');
        if (personaContentArea) {
            // First check if there's a saved custom persona content
            if (settings.customPersonaContent) {
                personaContentArea.value = settings.customPersonaContent;
            } else if (settings.userPersonaId) {
                // Otherwise load from selected preset
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    personaContentArea.value = persona.content;
                }
            } else {
                personaContentArea.value = '';
            }
        }

        document.getElementById('setting-ctx-length').value = settings.contextLength || 20;
        document.getElementById('setting-auto-summary').checked = settings.autoSummary || false;
        document.getElementById('setting-summary-freq').value = settings.summaryFreq || 10;
        document.getElementById('setting-summary-prompt').value = settings.summaryPrompt || '';
        document.getElementById('summary-options').classList.toggle('hidden', !settings.autoSummary);

        if (settings.wallpaper) {
            document.getElementById('setting-chat-bg-preview').src = settings.wallpaper;
            document.getElementById('setting-chat-bg-preview').classList.remove('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.add('hidden');
        } else {
            document.getElementById('setting-chat-bg-preview').classList.add('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.remove('hidden');
        }

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

        const cssBubble = settings.cssBubble || 1.0;
        const cssFont = settings.cssFont || 16;
        const cssAvatar = settings.cssAvatar || 40;
        const cssToolbar = settings.cssToolbar || 20;
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

        const cssInput = document.getElementById('custom-css-input');
        if (cssInput) cssInput.value = customCss;
        
        const msgArea = document.getElementById('chat-messages');
        if (msgArea) {
            msgArea.style.setProperty('--chat-bubble-padding-v', (10 * cssBubble) + 'px');
            msgArea.style.setProperty('--chat-bubble-padding-h', (14 * cssBubble) + 'px');
            msgArea.style.setProperty('--chat-font-size', cssFont + 'px');
            msgArea.style.setProperty('--chat-avatar-size', cssAvatar + 'px');
        }

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

        const remark = document.getElementById('setting-char-remark').value;
        const prompt = document.getElementById('setting-char-prompt').value;
        const userNameForSummary = document.getElementById('setting-user-name-for-summary').value.trim();
        
        API.Chat.updateChar(charId, { remark: remark, prompt: prompt });
        // 保存用户称呼到角色设置中
        this.updateCharSettings({ userName: userNameForSummary || '用户' });
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

    // 打开用户人设管理器
    openPersonaManager: function() {
        PersonaManager.openModal();
    },

    // 保存自定义人设内容（直接输入的临时人设）
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

    updateCharSettings: function(newSettings) {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        API.Chat.updateCharSettings(charId, newSettings);
    },

    updateAvatar: function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const charId = ChatInterface.currentCharId;
            API.Chat.updateChar(charId, { avatar: e.target.result });
            
            document.getElementById('setting-char-avatar').src = e.target.result;
            ChatManager.renderList();
        };
        reader.readAsDataURL(file);
    },

    updateUserAvatar: function(input) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('图片大小不能超过 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_SIZE = 300;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                try {
                    this.updateCharSettings({ userAvatar: dataUrl });
                    
                    const settingUserAvatar = document.getElementById('setting-user-avatar');
                    if (settingUserAvatar) {
                        settingUserAvatar.src = dataUrl;
                    }
                    
                    const chatUserAvatars = document.querySelectorAll('.user-message-avatar');
                    chatUserAvatars.forEach(avatar => {
                        avatar.src = dataUrl;
                    });
                    
                    if (ChatInterface.currentCharId) {
                        ChatInterface.renderMessages();
                    }
                    
                    alert('当前角色聊天用户头像已设置');
                } catch (err) {
                    console.error('Storage failed:', err);
                    alert('头像保存失败，可能是存储空间已满。请尝试更小的图片。');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    updatePanelBackground: function(input) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('图片过大，请选择小于5MB的图片');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const MAX_SIZE = 800;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    this.updateCharSettings({ panelBackground: compressedDataUrl });
                    this.loadCharSettings();
                    alert('设置面板背景已更新！');
                } catch (err) {
                    console.error('Storage failed:', err);
                    alert('背景图保存失败，可能是存储空间已满。请尝试更简单的图片。');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    updateChatWallpaper: function(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.updateCharSettings({ wallpaper: e.target.result });
            document.getElementById('setting-chat-bg-preview').src = e.target.result;
            document.getElementById('setting-chat-bg-preview').classList.remove('hidden');
            document.getElementById('setting-chat-bg-placeholder').classList.add('hidden');
            
            document.getElementById('chat-messages').style.backgroundImage = 'url(' + e.target.result + ')';
            document.getElementById('chat-messages').style.backgroundSize = 'cover';
            document.getElementById('chat-messages').style.backgroundPosition = 'center';
        };
        reader.readAsDataURL(file);
    },

    clearChatWallpaper: function() {
        this.updateCharSettings({ wallpaper: '' });
        document.getElementById('setting-chat-bg-preview').src = '';
        document.getElementById('setting-chat-bg-preview').classList.add('hidden');
        document.getElementById('setting-chat-bg-placeholder').classList.remove('hidden');
        document.getElementById('chat-messages').style.backgroundImage = '';
    },

    deleteChar: function() {
        if (!confirm('确定要删除这个角色吗？所有聊天记录也将被删除！')) return;
        
        const charId = ChatInterface.currentCharId;
        API.Chat.deleteChar(charId);
        
        this.close();
        ChatInterface.closeToList();
        ChatManager.renderList();
    },

    // ==================== 世界书目录树渲染（支持多选） ====================
    renderWorldBookTree: function(selectedIds) {
        const container = document.getElementById('worldbook-tree-container');
        if (!container) return;
        
        const books = API.WorldBook.getBooks();
        
        if (books.length === 0) {
            container.innerHTML = '<span class="text-xs text-gray-400 block text-center py-4">暂无世界书，请先创建</span>';
            return;
        }
        
        // 按分类（category）分组
        const categories = {};
        const uncategorized = [];
        
        books.forEach(book => {
            const cat = book.category || '';
            if (cat.trim()) {
                if (!categories[cat]) {
                    categories[cat] = [];
                }
                categories[cat].push(book);
            } else {
                uncategorized.push(book);
            }
        });
        
        let html = '';
        
        // 先渲染有分类的
        Object.keys(categories).sort().forEach(catName => {
            const catBooks = categories[catName];
            const catId = 'wb-cat-' + catName.replace(/\s+/g, '-');
            
            html += `
                <div class="border border-gray-200 rounded-lg overflow-hidden mb-2">
                    <div class="flex items-center justify-between p-2 bg-gray-100 cursor-pointer" onclick="document.getElementById('${catId}').classList.toggle('hidden'); this.querySelector('i').classList.toggle('rotate-90')">
                        <span class="text-xs font-bold text-gray-600 flex items-center gap-2">
                            <i class="fa-solid fa-folder text-yellow-500"></i>
                            ${catName}
                            <span class="text-gray-400 font-normal">(${catBooks.length})</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-gray-400 text-[10px] transition-transform duration-200"></i>
                    </div>
                    <div id="${catId}" class="hidden p-2 space-y-1 bg-white">
                        ${catBooks.map(book => this._renderWorldBookItem(book, selectedIds)).join('')}
                    </div>
                </div>
            `;
        });
        
        // 最后渲染无分类的
        if (uncategorized.length > 0) {
            html += `
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between p-2 bg-gray-50 cursor-pointer" onclick="document.getElementById('wb-cat-uncategorized').classList.toggle('hidden'); this.querySelector('i').classList.toggle('rotate-90')">
                        <span class="text-xs font-bold text-gray-500 flex items-center gap-2">
                            <i class="fa-solid fa-file-lines text-gray-400"></i>
                            未分类
                            <span class="text-gray-400 font-normal">(${uncategorized.length})</span>
                        </span>
                        <i class="fa-solid fa-chevron-right text-gray-400 text-[10px] transition-transform duration-200"></i>
                    </div>
                    <div id="wb-cat-uncategorized" class="hidden p-2 space-y-1 bg-white">
                        ${uncategorized.map(book => this._renderWorldBookItem(book, selectedIds)).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    _renderWorldBookItem: function(book, selectedIds) {
        const isChecked = selectedIds.includes(book.id);
        return `
            <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox"
                       value="${book.id}"
                       ${isChecked ? 'checked' : ''}
                       onchange="ChatSettings.toggleWorldBook('${book.id}')"
                       class="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500">
                <span class="text-xs text-gray-700 truncate flex-1">${book.title}</span>
            </label>
        `;
    },
    
    toggleWorldBook: function(bookId) {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        
        const char = API.Chat.getChar(charId);
        const settings = char.settings || {};
        let selectedIds = settings.worldBookIds || [];
        
        const idx = selectedIds.indexOf(bookId);
        if (idx === -1) {
            selectedIds.push(bookId);
        } else {
            selectedIds.splice(idx, 1);
        }
        
        this.updateCharSettings({ worldBookIds: selectedIds });
    },

    // ==================== 表情包多选渲染 ====================
    renderEmojiMultiSelect: function(selectedIds) {
        const container = document.getElementById('emoji-multi-select-container');
        if (!container) return;
        
        const groups = API.Emoji.getGroups();
        
        if (groups.length === 0) {
            container.innerHTML = '<span class="text-xs text-gray-400 block text-center py-4">暂无表情包分组，请先导入</span>';
            return;
        }
        
        let html = groups.map(group => {
            const isChecked = selectedIds.includes(group.id);
            const emojiCount = group.emojis ? group.emojis.length : 0;
            return `
                <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                    <input type="checkbox"
                           value="${group.id}"
                           ${isChecked ? 'checked' : ''}
                           onchange="ChatSettings.toggleEmojiGroup('${group.id}')"
                           class="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500">
                    <div class="flex-1 min-w-0">
                        <span class="text-sm font-medium text-gray-700 block truncate">${group.name}</span>
                        <span class="text-[10px] text-gray-400">${emojiCount} 个表情</span>
                    </div>
                </label>
            `;
        }).join('');
        
        container.innerHTML = html;
    },
    
    toggleEmojiGroup: function(groupId) {
        const charId = ChatInterface.currentCharId;
        if (!charId) return;
        
        const char = API.Chat.getChar(charId);
        const settings = char.settings || {};
        let selectedIds = settings.emojiGroupIds || [];
        
        // 兼容旧的单选数据
        if (selectedIds.length === 0 && settings.emojiGroupId) {
            selectedIds = [settings.emojiGroupId];
        }
        
        const idx = selectedIds.indexOf(groupId);
        if (idx === -1) {
            selectedIds.push(groupId);
        } else {
            selectedIds.splice(idx, 1);
        }
        
        this.updateCharSettings({ emojiGroupIds: selectedIds });
    }
};
