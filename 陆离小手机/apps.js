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

    renderGroups: function() {
        const list = document.getElementById('emoji-groups-list');
        const groups = API.Emoji.getGroups();
        
        if (groups.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">暂无分组</p>';
            return;
        }

        list.innerHTML = groups.map(g => `
            <div class="bg-white rounded-lg p-3 border border-gray-200">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm">${g.name}</span>
                    <button onclick="EmojiManager.deleteGroup('${g.id}')" class="text-red-500 text-xs">删除</button>
                </div>
                <p class="text-xs text-gray-500">共 ${g.emojis.length} 个表情</p>
            </div>
        `).join('');
    },

    deleteGroup: function(groupId) {
        if (!confirm('确定要删除这个表情包分组吗？')) return;
        API.Emoji.deleteGroup(groupId);
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
        
        document.getElementById('memory-current-avatar').src = char.avatar;
        document.getElementById('memory-current-name').textContent = char.remark;
        
        this.renderMemories();
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
