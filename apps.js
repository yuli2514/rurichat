/**
 * apps.js
 * 包含独立的功能模块：表情包管理、记忆APP、世界书、个人主页
 */

// ==================== EMOJI MANAGER UI ====================
const EmojiManager = {
    init: function() {
        this.renderGroups();
    },

    openModal: function() {
        document.getElementById('emoji-manager-modal').classList.remove('hidden');
        this.renderGroups();
    },

    closeModal: function() {
        document.getElementById('emoji-manager-modal').classList.add('hidden');
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

    // 当前展开管理的分组ID
    expandedGroupId: null,
    // 批量删除选中的索引
    selectedForDelete: new Set(),

    renderGroups: function() {
        const list = document.getElementById('emoji-groups-list');
        const groups = API.Emoji.getGroups();
        
        if (groups.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">暂无分组</p>';
            return;
        }

        list.innerHTML = groups.map(g => {
            const isExpanded = this.expandedGroupId === g.id;
            let html = '<div class="bg-white rounded-lg p-3 border border-gray-200">';
            html += '<div class="flex justify-between items-center mb-2">';
            html += '<span class="font-bold text-sm">' + g.name + '</span>';
            html += '<div class="flex gap-2">';
            html += '<button onclick="EmojiManager.toggleExpand(\'' + g.id + '\')" class="text-blue-500 text-xs">' + (isExpanded ? '收起' : '管理') + '</button>';
            html += '<button onclick="EmojiManager.deleteGroup(\'' + g.id + '\')" class="text-red-500 text-xs">删除组</button>';
            html += '</div></div>';
            html += '<p class="text-xs text-gray-500">共 ' + g.emojis.length + ' 个表情</p>';
            
            // 展开后显示表情包列表（带删除按钮）
            if (isExpanded) {
                html += '<div class="mt-3 border-t border-gray-100 pt-3">';
                // 批量操作按钮
                html += '<div class="flex justify-between items-center mb-2">';
                html += '<button onclick="EmojiManager.selectAllEmojis(\'' + g.id + '\')" class="text-xs text-blue-500">全选</button>';
                html += '<button onclick="EmojiManager.deleteSelectedEmojis(\'' + g.id + '\')" class="text-xs text-red-500 font-bold">删除选中 (' + this.selectedForDelete.size + ')</button>';
                html += '</div>';
                // 表情包网格
                html += '<div class="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">';
                g.emojis.forEach(function(e, idx) {
                    const isSelected = EmojiManager.selectedForDelete.has(idx);
                    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(e.url) || e.url.startsWith('data:image');
                    html += '<div class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2 ' + (isSelected ? 'border-red-500' : 'border-transparent') + '" onclick="EmojiManager.toggleEmojiSelect(' + idx + ')">';
                    if (isImage) {
                        html += '<img src="' + e.url + '" class="w-full h-full object-cover" loading="lazy">';
                    } else {
                        html += '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-link text-gray-400"></i></div>';
                    }
                    if (isSelected) {
                        html += '<div class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><i class="fa-solid fa-check text-white text-[8px]"></i></div>';
                    }
                    html += '<div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5 truncate px-1">' + (e.meaning || '表情') + '</div>';
                    html += '</div>';
                });
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }).join('');
    },

    toggleExpand: function(groupId) {
        if (this.expandedGroupId === groupId) {
            this.expandedGroupId = null;
        } else {
            this.expandedGroupId = groupId;
        }
        this.selectedForDelete.clear();
        this.renderGroups();
    },

    toggleEmojiSelect: function(index) {
        if (this.selectedForDelete.has(index)) {
            this.selectedForDelete.delete(index);
        } else {
            this.selectedForDelete.add(index);
        }
        this.renderGroups();
    },

    selectAllEmojis: function(groupId) {
        const groups = API.Emoji.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        if (this.selectedForDelete.size === group.emojis.length) {
            // 已全选则取消全选
            this.selectedForDelete.clear();
        } else {
            // 全选
            this.selectedForDelete.clear();
            group.emojis.forEach(function(_, idx) {
                EmojiManager.selectedForDelete.add(idx);
            });
        }
        this.renderGroups();
    },

    deleteSelectedEmojis: function(groupId) {
        if (this.selectedForDelete.size === 0) {
            alert('请先选择要删除的表情包');
            return;
        }
        if (!confirm('确定要删除选中的 ' + this.selectedForDelete.size + ' 个表情包吗？')) return;
        
        const groups = API.Emoji.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        // 从后往前删除，避免索引偏移
        const indices = Array.from(this.selectedForDelete).sort((a, b) => b - a);
        indices.forEach(function(idx) {
            group.emojis.splice(idx, 1);
        });
        
        API.Emoji.saveGroups(groups);
        this.selectedForDelete.clear();
        this.renderGroups();
    },

    deleteGroup: function(groupId) {
        if (!confirm('确定要删除这个表情包分组吗？')) return;
        API.Emoji.deleteGroup(groupId);
        this.expandedGroupId = null;
        this.selectedForDelete.clear();
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
        // 显示主 header
        const header = document.getElementById('memory-header');
        if (header) header.classList.remove('hidden');
        
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
        // 隐藏主 header（timeline 有自己的 header）
        const header = document.getElementById('memory-header');
        if (header) header.classList.add('hidden');
        
        document.getElementById('memory-current-avatar').src = char.avatar;
        document.getElementById('memory-current-name').textContent = char.remark;
        
        // 默认激活普通记忆 Tab
        this.switchTab('memories');
    },

    backToCharSelect: function() {
        this.currentCharId = null;
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

        const history = API.Chat.getHistory(this.currentCharId);
        const summaryPrompt = char.settings && char.settings.summaryPrompt ? char.settings.summaryPrompt : null;

        try {
            const summary = await API.Memory.generateSummary(this.currentCharId, char.name, history, summaryPrompt);
            API.Memory.addMemory(this.currentCharId, summary, 'manual');
            this.renderMemories();
            alert('记忆总结完成！');
        } catch (e) {
            alert('总结失败: ' + e.message);
        }
    },
    
    // Add manual memory input
    addManualMemory: function() {
        const content = prompt('请输入新的记忆内容:');
        if (content !== null && content.trim()) {
            API.Memory.addMemory(this.currentCharId, content.trim(), 'manual');
            this.renderMemories();
        }
    },

    /**
     * 切换 Tab（普通记忆 / 线下总结）
     */
    switchTab: function(tab) {
        const tabMemories = document.getElementById('tab-memories');
        const tabOffline = document.getElementById('tab-offline-summaries');
        const containerMemories = document.getElementById('memory-cards-container');
        const containerOffline = document.getElementById('offline-summaries-container');

        if (!tabMemories || !tabOffline || !containerMemories || !containerOffline) return;

        if (tab === 'memories') {
            tabMemories.classList.add('border-blue-500', 'text-blue-600');
            tabMemories.classList.remove('border-transparent', 'text-gray-600');
            tabOffline.classList.remove('border-blue-500', 'text-blue-600');
            tabOffline.classList.add('border-transparent', 'text-gray-600');
            containerMemories.classList.remove('hidden');
            containerOffline.classList.add('hidden');
            this.renderMemories();
        } else if (tab === 'offline-summaries') {
            tabOffline.classList.add('border-blue-500', 'text-blue-600');
            tabOffline.classList.remove('border-transparent', 'text-gray-600');
            tabMemories.classList.remove('border-blue-500', 'text-blue-600');
            tabMemories.classList.add('border-transparent', 'text-gray-600');
            containerOffline.classList.remove('hidden');
            containerMemories.classList.add('hidden');
            this.renderOfflineSummaries();
        }
    },

    /**
     * 渲染线下总结列表
     */
    renderOfflineSummaries: function() {
        const container = document.getElementById('offline-summaries-container');
        if (!container || !this.currentCharId) return;

        const summaries = API.Offline.getOfflineSummaries(this.currentCharId);

        if (summaries.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-12">' +
                '<i class="fa-solid fa-book-open text-4xl mb-2 opacity-50"></i>' +
                '<p class="text-sm">暂无线下总结</p>' +
                '<p class="text-xs mt-1">在线下模式中聊天后会自动生成总结</p>' +
                '</div>';
            return;
        }

        container.innerHTML = summaries.map((s, idx) =>
            '<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">' +
                '<div class="flex justify-between items-start mb-2">' +
                    '<span class="text-xs text-gray-400">' + new Date(s.timestamp).toLocaleString() + '</span>' +
                    '<div class="flex gap-2">' +
                        '<span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">' + (s.type === 'auto' ? '自动' : '手动') + '</span>' +
                        '<button onclick="MemoryApp.editOfflineSummary(' + idx + ')" class="text-blue-500 text-xs"><i class="fa-solid fa-pen"></i></button>' +
                        '<button onclick="MemoryApp.deleteOfflineSummary(' + idx + ')" class="text-red-500 text-xs"><i class="fa-solid fa-trash"></i></button>' +
                    '</div>' +
                '</div>' +
                '<p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">' + s.content + '</p>' +
            '</div>'
        ).join('');
    },

    /**
     * 删除线下总结
     */
    /**
     * 编辑线下总结
     */
    editOfflineSummary: function(index) {
        const summaries = API.Offline.getOfflineSummaries(this.currentCharId);
        const summary = summaries[index];
        if (!summary) return;
        const newContent = prompt('编辑线下总结内容:', summary.content);
        if (newContent !== null && newContent.trim()) {
            API.Offline.updateOfflineSummary(this.currentCharId, index, newContent.trim());
            this.renderOfflineSummaries();
        }
    },

    deleteOfflineSummary: function(index) {
        if (!confirm('确定要删除这条线下总结吗？')) return;
        API.Offline.deleteOfflineSummary(this.currentCharId, index);
        this.renderOfflineSummaries();
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

// ==================== PROFILE MANAGER UI (已废弃 - 暂时停用) ====================
const ProfileManager = {
    open: function() {
        document.getElementById('profile-app').classList.remove('hidden');
    },

    close: function() {
        document.getElementById('profile-app').classList.add('hidden');
    }
};
