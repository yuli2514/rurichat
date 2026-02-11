/**
 * apps.js
 * 包含独立的功能模块：表情包管理、记忆APP、世界书、个人主页
 */

// ==================== EMOJI MANAGER UI ====================
const EmojiManager = {
    // 当前展开的分组ID
    expandedGroupId: null,
    // 多选模式
    selectMode: false,
    selectedIndices: new Set(),

    init: function() {
        this.renderGroups();
    },

    openModal: function() {
        this.expandedGroupId = null;
        this.selectMode = false;
        this.selectedIndices.clear();
        document.getElementById('emoji-manager-modal').classList.remove('hidden');
        this.renderGroups();
    },

    closeModal: function() {
        document.getElementById('emoji-manager-modal').classList.add('hidden');
        this.expandedGroupId = null;
        this.selectMode = false;
        this.selectedIndices.clear();
    },

    batchImport: function() {
        const groupName = document.getElementById('emoji-group-name').value.trim();
        const batchText = document.getElementById('emoji-batch-input').value.trim();
        
        if (!groupName) return alert('请输入分组名称');
        if (!batchText) return alert('请输入表情包数据');

        const emojis = API.Emoji.parseBatchInput(batchText);
        if (emojis.length === 0) return alert('未能解析出有效的表情包数据 (需包含 http/https 链接)');

        API.Emoji.addGroup(groupName, emojis);
        
        document.getElementById('emoji-group-name').value = '';
        document.getElementById('emoji-batch-input').value = '';
        
        this.renderGroups();
        alert('导入成功！共 ' + emojis.length + ' 个表情');
    },

    renderGroups: function() {
        const list = document.getElementById('emoji-groups-list');
        const groups = API.Emoji.getGroups();
        
        if (groups.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">暂无分组</p>';
            return;
        }

        list.innerHTML = groups.map(g => {
            const isExpanded = this.expandedGroupId === g.id;
            let html = '<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">';
            html += '<div class="flex justify-between items-center p-3">';
            html += '<div class="flex items-center gap-2 flex-1 cursor-pointer" onclick="EmojiManager.toggleGroup(\'' + g.id + '\')">';
            html += '<i class="fa-solid fa-chevron-' + (isExpanded ? 'down' : 'right') + ' text-gray-400 text-xs transition-transform"></i>';
            html += '<span class="font-bold text-sm">' + g.name + '</span>';
            html += '<span class="text-xs text-gray-400">(' + g.emojis.length + ')</span>';
            html += '</div>';
            html += '<button onclick="EmojiManager.deleteGroup(\'' + g.id + '\')" class="text-red-500 text-xs px-2">删除分组</button>';
            html += '</div>';
            
            if (isExpanded) {
                html += this._renderGroupEmojis(g);
            }
            
            html += '</div>';
            return html;
        }).join('');
    },

    _renderGroupEmojis: function(group) {
        if (!group.emojis || group.emojis.length === 0) {
            return '<div class="px-3 pb-3 text-xs text-gray-400 text-center">此分组没有表情包</div>';
        }

        let html = '<div class="px-3 pb-2">';
        // 操作栏：多选模式切换 + 批量删除
        html += '<div class="flex justify-between items-center mb-2 pb-2 border-t border-gray-100 pt-2">';
        if (this.selectMode) {
            html += '<span class="text-xs text-blue-500">已选 ' + this.selectedIndices.size + ' 个</span>';
            html += '<div class="flex gap-2">';
            html += '<button onclick="EmojiManager.selectAllEmojis(\'' + group.id + '\')" class="text-xs text-blue-500 px-2 py-1 bg-blue-50 rounded-lg">全选</button>';
            html += '<button onclick="EmojiManager.deleteSelectedEmojis(\'' + group.id + '\')" class="text-xs text-red-500 px-2 py-1 bg-red-50 rounded-lg' + (this.selectedIndices.size === 0 ? ' opacity-50' : '') + '">删除所选</button>';
            html += '<button onclick="EmojiManager.exitSelectMode()" class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-lg">取消</button>';
            html += '</div>';
        } else {
            html += '<span class="text-xs text-gray-400">长按或点击管理表情</span>';
            html += '<button onclick="EmojiManager.enterSelectMode()" class="text-xs text-blue-500 px-2 py-1 bg-blue-50 rounded-lg">多选</button>';
        }
        html += '</div>';

        // 表情包网格
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
        group.emojis.forEach((e, idx) => {
            const isSelected = this.selectedIndices.has(idx);
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(e.url) || e.url.startsWith('data:image');
            
            html += '<div class="relative aspect-square rounded-lg overflow-hidden border ' + (isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200') + ' cursor-pointer group" ';
            
            if (this.selectMode) {
                html += 'onclick="EmojiManager.toggleEmojiSelect(' + idx + ')"';
            }
            html += '>';
            
            if (isImage) {
                html += '<img src="' + e.url + '" class="w-full h-full object-cover" loading="lazy" onerror="this.src=\'https://placehold.co/80x80?text=Err\'">';
            } else {
                html += '<div class="w-full h-full bg-blue-50 flex items-center justify-center"><i class="fa-solid fa-link text-blue-400"></i></div>';
            }
            
            // 选中标记
            if (this.selectMode && isSelected) {
                html += '<div class="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><i class="fa-solid fa-check text-white text-[10px]"></i></div>';
            } else if (this.selectMode) {
                html += '<div class="absolute top-1 right-1 w-5 h-5 border-2 border-gray-300 rounded-full bg-white/80"></div>';
            }
            
            // 非多选模式下显示删除按钮（hover/点击）
            if (!this.selectMode) {
                html += '<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">';
                html += '<button onclick="event.stopPropagation();EmojiManager.deleteSingleEmoji(\'' + group.id + '\',' + idx + ')" class="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center"><i class="fa-solid fa-trash text-white text-xs"></i></button>';
                html += '</div>';
            }
            
            // 含义标签
            html += '<div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 truncate px-1">' + (e.meaning || '表情') + '</div>';
            
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        return html;
    },

    toggleGroup: function(groupId) {
        if (this.expandedGroupId === groupId) {
            this.expandedGroupId = null;
        } else {
            this.expandedGroupId = groupId;
        }
        this.selectMode = false;
        this.selectedIndices.clear();
        this.renderGroups();
    },

    enterSelectMode: function() {
        this.selectMode = true;
        this.selectedIndices.clear();
        this.renderGroups();
    },

    exitSelectMode: function() {
        this.selectMode = false;
        this.selectedIndices.clear();
        this.renderGroups();
    },

    toggleEmojiSelect: function(index) {
        if (this.selectedIndices.has(index)) {
            this.selectedIndices.delete(index);
        } else {
            this.selectedIndices.add(index);
        }
        this.renderGroups();
    },

    selectAllEmojis: function(groupId) {
        const groups = API.Emoji.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            if (this.selectedIndices.size === group.emojis.length) {
                // 已全选，取消全选
                this.selectedIndices.clear();
            } else {
                group.emojis.forEach((_, idx) => this.selectedIndices.add(idx));
            }
        }
        this.renderGroups();
    },

    deleteSingleEmoji: function(groupId, emojiIndex) {
        if (!confirm('确定要删除这个表情包吗？')) return;
        API.Emoji.deleteEmoji(groupId, emojiIndex);
        this.renderGroups();
    },

    deleteSelectedEmojis: function(groupId) {
        if (this.selectedIndices.size === 0) return;
        if (!confirm('确定要删除选中的 ' + this.selectedIndices.size + ' 个表情包吗？')) return;
        API.Emoji.deleteEmojis(groupId, Array.from(this.selectedIndices));
        this.selectedIndices.clear();
        this.selectMode = false;
        this.renderGroups();
    },

    deleteGroup: function(groupId) {
        if (!confirm('确定要删除这个表情包分组吗？')) return;
        API.Emoji.deleteGroup(groupId);
        if (this.expandedGroupId === groupId) {
            this.expandedGroupId = null;
        }
        this.renderGroups();
    },
    
    // Proxy for ChatInterface to use
    getGroupEmojis: function(groupId) {
        return API.Emoji.getGroupEmojis(groupId);
    },
    
    getGroups: function() {
        return API.Emoji.getGroups();
    }
};

// ==================== MEMORY APP UI ====================
const MemoryApp = {
    currentCharId: null,

    init: function() {
        const memoryIcons = document.querySelectorAll('[class*="fa-brain"]');
        memoryIcons.forEach(icon => {
            const parent = icon.closest('.cursor-pointer, [onclick]');
            if (parent) {
                parent.addEventListener('click', () => {
                    this.open();
                });
            }
        });
        
        const closeBtn = document.getElementById('close-memory-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
    },

    open: function() {
        document.getElementById('memory-app').classList.remove('hidden');
        this.showCharSelect();
    },

    close: function() {
        document.getElementById('memory-app').classList.add('hidden');
        this.currentCharId = null;
    },

    showCharSelect: function() {
        document.getElementById('memory-char-select').classList.remove('hidden');
        document.getElementById('memory-timeline').classList.add('hidden');
        
        const chars = API.Chat.getChars();
        const list = document.getElementById('memory-char-list');
        
        if (chars.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">暂无角色</p>';
            return;
        }

        list.innerHTML = chars.map(c => 
            '<div onclick="MemoryApp.selectChar(\'' + c.id + '\')" class="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition">' +
                '<img src="' + c.avatar + '" class="w-12 h-12 rounded-full object-cover">' +
                '<div class="flex-1">' +
                    '<h3 class="font-bold text-gray-800">' + c.remark + '</h3>' +
                    '<p class="text-xs text-gray-400">点击查看记忆</p>' +
                '</div>' +
                '<i class="fa-solid fa-chevron-right text-gray-300"></i>' +
            '</div>'
        ).join('');
    },

    selectChar: function(charId) {
         this.currentCharId = charId;
         const char = API.Chat.getChar(charId);
         if (!char) return;

         document.getElementById('memory-char-select').classList.add('hidden');
         document.getElementById('memory-timeline').classList.remove('hidden');
         document.getElementById('memory-header').classList.add('hidden');
         
         document.getElementById('memory-current-avatar').src = char.avatar;
         document.getElementById('memory-current-name').textContent = char.remark;
         
         // 初始化标签页
         this.switchTab('memories');
     },

    /**
     * 切换标签页
     */
    switchTab: function(tab) {
        const memoriesContainer = document.getElementById('memory-cards-container');
        const summariesContainer = document.getElementById('offline-summaries-container');
        const tabMemories = document.getElementById('tab-memories');
        const tabSummaries = document.getElementById('tab-offline-summaries');

        if (tab === 'memories') {
            memoriesContainer.classList.remove('hidden');
            summariesContainer.classList.add('hidden');
            tabMemories.classList.add('border-blue-500', 'text-blue-500');
            tabMemories.classList.remove('border-transparent', 'text-gray-600');
            tabSummaries.classList.remove('border-blue-500', 'text-blue-500');
            tabSummaries.classList.add('border-transparent', 'text-gray-600');
            this.renderMemories();
        } else if (tab === 'offline-summaries') {
            memoriesContainer.classList.add('hidden');
            summariesContainer.classList.remove('hidden');
            tabSummaries.classList.add('border-blue-500', 'text-blue-500');
            tabSummaries.classList.remove('border-transparent', 'text-gray-600');
            tabMemories.classList.remove('border-blue-500', 'text-blue-500');
            tabMemories.classList.add('border-transparent', 'text-gray-600');
            this.renderOfflineSummaries();
        }
    },

    backToCharSelect: function() {
        this.currentCharId = null;
        document.getElementById('memory-header').classList.remove('hidden');
        this.showCharSelect();
    },

    renderMemories: function() {
        const container = document.getElementById('memory-cards-container');
        const memories = API.Memory.getMemories(this.currentCharId);
        
        document.getElementById('memory-count').textContent = memories.length;

        if (memories.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-12"><i class="fa-solid fa-brain text-4xl mb-2 opacity-50"></i><p class="text-sm">暂无记忆</p><p class="text-xs mt-1">点击"立即总结"生成记忆</p></div>';
            return;
        }

        container.innerHTML = memories.map((m, idx) => 
            '<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">' +
                '<div class="flex justify-between items-start mb-2">' +
                    '<span class="text-xs text-gray-400">' + new Date(m.timestamp).toLocaleString() + '</span>' +
                    '<div class="flex gap-2">' +
                        '<button onclick="MemoryApp.editMemory(' + idx + ')" class="text-blue-500 text-xs"><i class="fa-solid fa-pen"></i></button>' +
                        '<button onclick="MemoryApp.deleteMemory(' + idx + ')" class="text-red-500 text-xs"><i class="fa-solid fa-trash"></i></button>' +
                    '</div>' +
                '</div>' +
                '<p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">' + m.content + '</p>' +
            '</div>'
        ).join('');
    },

    editMemory: function(index) {
        const memories = API.Memory.getMemories(this.currentCharId);
        const memory = memories[index];
        const newContent = prompt('编辑记忆内容:', memory.content);
        if (newContent !== null && newContent.trim()) {
            API.Memory.updateMemory(this.currentCharId, index, newContent.trim());
            this.renderMemories();
        }
    },

    deleteMemory: function(index) {
        if (!confirm('确定要删除这条记忆吗？')) return;
        API.Memory.deleteMemory(this.currentCharId, index);
        this.renderMemories();
    },

    triggerSummary: async function() {
        const char = API.Chat.getChar(this.currentCharId);
        if (!char) return;

        const summaryBtn = document.getElementById('trigger-summary-btn');
        if (!summaryBtn) return;

        // 设置加载状态
        summaryBtn.disabled = true;
        summaryBtn.classList.add('opacity-50');
        const originalText = summaryBtn.textContent;
        summaryBtn.textContent = '总结中...';

        const history = API.Chat.getHistory(this.currentCharId);
        const summaryPrompt = char.settings && char.settings.summaryPrompt ? char.settings.summaryPrompt : null;

        try {
            const summary = await API.Memory.generateSummary(this.currentCharId, char.name, history, summaryPrompt);
            API.Memory.addMemory(this.currentCharId, summary, 'manual');
            this.renderMemories();
            alert('记忆总结完成！');
        } catch (e) {
            alert('总结失败: ' + e.message);
        } finally {
            // 恢复按钮状态
            summaryBtn.disabled = false;
            summaryBtn.classList.remove('opacity-50');
            summaryBtn.textContent = originalText;
        }
    },
    
   /**
    * 渲染线下聊天总结列表
    */
   renderOfflineSummaries: function() {
       const container = document.getElementById('offline-summaries-container');
       const summaries = API.Offline.getOfflineSummaries(this.currentCharId);

       if (summaries.length === 0) {
           container.innerHTML = '<div class="text-center text-gray-400 py-12"><i class="fa-solid fa-book text-4xl mb-2 opacity-50"></i><p class="text-sm">暂无线下总结</p><p class="text-xs mt-1">线下聊天会自动生成总结</p></div>';
           return;
       }

       container.innerHTML = summaries.map((s, idx) =>
           '<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">' +
               '<div class="flex justify-between items-start mb-2">' +
                   '<span class="text-xs text-gray-400">' + new Date(s.timestamp).toLocaleString() + '</span>' +
                   '<div class="flex gap-2">' +
                       '<button onclick="MemoryApp.editOfflineSummary(' + idx + ')" class="text-blue-500 text-xs"><i class="fa-solid fa-pen"></i></button>' +
                       '<button onclick="MemoryApp.deleteOfflineSummary(' + idx + ')" class="text-red-500 text-xs"><i class="fa-solid fa-trash"></i></button>' +
                   '</div>' +
               '</div>' +
               '<p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">' + s.content + '</p>' +
           '</div>'
       ).join('');
   },

   /**
    * 编辑线下总结
    */
   editOfflineSummary: function(index) {
       const summaries = API.Offline.getOfflineSummaries(this.currentCharId);
       const summary = summaries[index];
       const newContent = prompt('编辑线下总结:', summary.content);
       if (newContent !== null && newContent.trim()) {
           API.Offline.updateOfflineSummary(this.currentCharId, summary.id, newContent.trim());
           this.renderOfflineSummaries();
       }
   },

   /**
    * 删除线下总结
    */
   deleteOfflineSummary: function(index) {
       if (!confirm('确定要删除这条线下总结吗？')) return;
       const summaries = API.Offline.getOfflineSummaries(this.currentCharId);
       const summary = summaries[index];
       API.Offline.deleteOfflineSummary(this.currentCharId, summary.id);
       this.renderOfflineSummaries();
   },

    // Add manual memory input
    addManualMemory: function() {
        const content = prompt('请输入新的记忆内容:');
        if (content !== null && content.trim()) {
            API.Memory.addMemory(this.currentCharId, content.trim(), 'manual');
            this.renderMemories();
        }
    }
};

// ==================== WORLD BOOK MANAGER UI ====================
const WorldBookManager = {
    init: function() {
        this.bindEvents();
        this.renderList();
    },
    
    bindEvents: function() {
        document.getElementById('worldbook-app-icon').addEventListener('click', () => {
            document.getElementById('worldbook-app').classList.remove('hidden');
            this.renderList();
        });
        document.getElementById('close-worldbook-btn').addEventListener('click', () => {
            document.getElementById('worldbook-app').classList.add('hidden');
        });
    },

    openEditModal: function(id) {
        console.log('[WorldBook] openEditModal called with id:', id, 'type:', typeof id);
        document.getElementById('worldbook-modal').classList.remove('hidden');
        const deleteBtn = document.getElementById('wb-delete-btn');
        
        // Reset fields first
        document.getElementById('wb-id').value = '';
        document.getElementById('wb-title').value = '';
        document.getElementById('wb-category').value = '';
        document.getElementById('wb-content').value = '';
        deleteBtn.classList.add('hidden');

        if (id !== undefined && id !== null && id !== '') {
            const books = API.WorldBook.getBooks();
            console.log('[WorldBook] Looking for book with id:', id, 'in books:', books.map(b => ({id: b.id, type: typeof b.id})));
            // 将 id 转换为字符串进行比较，确保类型一致
            const idStr = String(id);
            const book = books.find(b => String(b.id) === idStr);
            
            console.log('[WorldBook] Found book:', book);
            
            if (book) {
                document.getElementById('wb-id').value = book.id;
                document.getElementById('wb-title').value = book.title || '';
                document.getElementById('wb-category').value = book.category || '';
                document.getElementById('wb-content').value = book.content || '';
                deleteBtn.classList.remove('hidden');
                console.log('[WorldBook] Fields populated - title:', book.title, 'category:', book.category, 'content:', book.content);
            } else {
                console.warn('[WorldBook] Book not found with id:', id);
            }
        }
    },

    closeEditModal: function() {
        document.getElementById('worldbook-modal').classList.add('hidden');
    },

    saveWorldBook: function() {
        const id = document.getElementById('wb-id').value;
        const title = document.getElementById('wb-title').value.trim();
        const category = document.getElementById('wb-category').value.trim();
        const content = document.getElementById('wb-content').value.trim();

        if (!title) return alert('标题不能为空');

        API.WorldBook.saveBook({
            id: id || null,
            title: title,
            category: category || '未分类',
            content: content
        });

        this.renderList();
        this.closeEditModal();
    },

    deleteWorldBook: function() {
        const id = document.getElementById('wb-id').value;
        if (!confirm('确定要删除这个世界书设定吗？')) return;
        
        API.WorldBook.deleteBook(id);
        this.renderList();
        this.closeEditModal();
    },

    renderList: function() {
        const list = document.getElementById('worldbook-list');
        const books = API.WorldBook.getBooks();
        
        if (books.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fa-solid fa-book-open text-4xl mb-2 opacity-50"></i><p>暂无设定，点击右上角 + 创建</p></div>';
            return;
        }

        // 按分组整理
        const grouped = {};
        const ungrouped = [];
        
        books.forEach(b => {
            const cat = b.category && b.category.trim() ? b.category.trim() : '';
            if (cat) {
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(b);
            } else {
                ungrouped.push(b);
            }
        });

        let html = '';
        
        // 渲染分组 (iOS风格)
        Object.keys(grouped).forEach(groupName => {
            const items = grouped[groupName];
            html += '<details class="mb-4" open>' +
                '<summary class="ios-section-header px-4 py-2 cursor-pointer list-none">' +
                    groupName.toUpperCase() +
                '</summary>' +
                '<div class="bg-white rounded-xl overflow-hidden shadow-sm">';
            
            items.forEach((b, idx) => {
                html += '<div onclick="WorldBookManager.openEditModal(\'' + b.id + '\')" class="p-4 ' + (idx < items.length - 1 ? 'border-b border-gray-100' : '') + ' hover:bg-gray-50 transition cursor-pointer">' +
                    '<h3 class="font-bold text-gray-800 mb-1">' + b.title + '</h3>' +
                    '<p class="text-xs text-gray-500 line-clamp-2">' + (b.content || '暂无内容...') + '</p>' +
                '</div>';
            });
            
            html += '</div></details>';
        });
        
        // 渲染未分组
        if (ungrouped.length > 0) {
            ungrouped.forEach(b => {
                html += '<div onclick="WorldBookManager.openEditModal(\'' + b.id + '\')" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition cursor-pointer mb-3">' +
                    '<div class="flex justify-between items-center mb-1">' +
                        '<h3 class="font-bold text-gray-800">' + b.title + '</h3>' +
                        '<span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">未分类</span>' +
                    '</div>' +
                    '<p class="text-xs text-gray-500 line-clamp-2">' + (b.content || '暂无内容...') + '</p>' +
                '</div>';
            });
        }
        
        list.innerHTML = html;
    }
};

// ==================== PROFILE MANAGER UI ====================
const ProfileManager = {
    open: function() {
        document.getElementById('profile-app').classList.remove('hidden');
        this.loadProfile();
    },

    close: function() {
        document.getElementById('profile-app').classList.add('hidden');
        this.saveAll(); 
    },

    loadProfile: function() {
        const profile = API.Profile.getProfile();
        
        if (profile.name) document.getElementById('profile-name').value = profile.name;
        if (profile.location) document.getElementById('profile-location').value = profile.location;
        if (profile.signature) document.getElementById('profile-signature').value = profile.signature;
        if (profile.character) {
            const charInput = document.getElementById('profile-character');
            if (charInput) charInput.value = profile.character;
        }
        if (profile.avatar) {
            document.getElementById('profile-avatar-preview').src = profile.avatar;
        }
        if (profile.background) {
            document.getElementById('profile-bg-preview').style.backgroundImage = 'url(' + profile.background + ')';
        }

        document.getElementById('profile-avatar-upload').onchange = (e) => this.handleAvatarUpload(e.target);
        document.getElementById('profile-bg-upload').onchange = (e) => this.handleBgUpload(e.target);
    },

    handleAvatarUpload: function(input) {
        const file = input.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('图片大小不能超过 2MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = tempImg.width;
                    let height = tempImg.height;
                    
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
                    ctx.drawImage(tempImg, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    try {
                        let profile = API.Profile.getProfile();
                        profile.avatar = dataUrl;
                        API.Profile.saveProfile(profile);
                        
                        document.getElementById('profile-avatar-preview').src = dataUrl;
                        
                        this.saveAll();
                        alert('个人主页头像已更新');
                    } catch (err) {
                        console.error('Storage failed:', err);
                        alert('头像保存失败，可能是存储空间已满。请尝试更小的图片。');
                    }
                };
                tempImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    },

    handleBgUpload: function(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profile-bg-preview').style.backgroundImage = 'url(' + e.target.result + ')';
                this.saveAll();
            };
            reader.readAsDataURL(file);
        }
    },

    saveAll: function() {
        const charInput = document.getElementById('profile-character');
        const profile = {
            name: document.getElementById('profile-name').value,
            location: document.getElementById('profile-location').value,
            signature: document.getElementById('profile-signature').value,
            character: charInput ? charInput.value : '',
            avatar: document.getElementById('profile-avatar-preview').src,
            background: document.getElementById('profile-bg-preview').style.backgroundImage.replace(/^url\(['"]?|['"]?\)$/g, '')
        };
        API.Profile.saveProfile(profile);
        
        const personas = API.Profile.getPersonas();
        const selectedPersonaId = document.getElementById('setting-user-persona-select')?.value;
        if(selectedPersonaId) {
            const personaIndex = personas.findIndex(p => p.id === selectedPersonaId);
            if(personaIndex !== -1) {
                personas[personaIndex].content = profile.character;
                API.Profile.savePersonas(personas);
            }
        }
    },

    // Persona UI Methods
    openPresetModal: function() {
        document.getElementById('preset-modal').classList.remove('hidden');
    }
};
