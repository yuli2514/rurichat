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
        
        // 直接渲染记忆（不再需要Tab切换）
        this.renderMemories();
        
        // 更新token统计和轮数显示
        this.updateTokenCount();
        this.updateRoundCount();
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
        
        // 更新token统计和轮数显示
        this.updateTokenCount();
        this.updateRoundCount();
    },

    // ==================== 编辑记忆功能 ====================
    _editingMemoryIndex: null,
    
    editMemory: function(index) {
        this._editingMemoryIndex = index;
        const memories = API.Memory.getMemories(this.currentCharId);
        const memory = memories[index];
        
        if (!memory) return;
        
        const modal = document.getElementById('memory-edit-modal');
        const textarea = modal.querySelector('textarea');
        
        // 设置当前记忆内容
        textarea.value = memory.content;
        
        // 显示模态框
        modal.classList.remove('hidden');
        
        // 聚焦到文本区域
        setTimeout(() => {
            textarea.focus();
            // 将光标移到文本末尾
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 100);
    },
    
    cancelEditMemory: function() {
        const modal = document.getElementById('memory-edit-modal');
        modal.classList.add('hidden');
        this._editingMemoryIndex = null;
    },
    
    confirmEditMemory: function() {
        if (this._editingMemoryIndex === null) return;
        
        const modal = document.getElementById('memory-edit-modal');
        const textarea = modal.querySelector('textarea');
        const newContent = textarea.value.trim();
        
        if (!newContent) {
            alert('记忆内容不能为空');
            return;
        }
        
        // 更新记忆内容
        API.Memory.updateMemory(this.currentCharId, this._editingMemoryIndex, newContent);
        this.renderMemories();
        
        // 关闭模态框
        modal.classList.add('hidden');
        this._editingMemoryIndex = null;
    },

    deleteMemory: function(index) {
        if (!confirm('确定要删除这条记忆吗？')) return;
        API.Memory.deleteMemory(this.currentCharId, index);
        this.renderMemories();
        this.updateTokenCount();
    },

    triggerSummary: async function() {
        const char = API.Chat.getChar(this.currentCharId);
        if (!char) return;

        // 获取按钮并显示"正在总结..."状态
        const btn = document.getElementById('trigger-summary-btn');
        if (btn) {
            btn.disabled = true;
            btn._originalText = btn.textContent;
            btn.textContent = '正在总结...';
            btn.classList.add('opacity-60');
        }

        const settings = char.settings || {};
        const summaryPrompt = settings.summaryPrompt || null;
        const summaryFreq = settings.summaryFreq || 20;

        try {
            // 合并线上线下历史进行总结
            const onlineHistory = API.Chat.getHistory(this.currentCharId);
            const offlineHistory = API.Offline.getHistory(this.currentCharId);
            const mergedHistory = [];
            
            onlineHistory.forEach(msg => {
                if (!msg.recalled) {
                    mergedHistory.push({ ...msg, _source: 'online' });
                }
            });
            offlineHistory.forEach(msg => {
                mergedHistory.push({ ...msg, _source: 'offline' });
            });
            
            // 按时间戳排序
            mergedHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            const summary = await API.Memory.generateSummary(this.currentCharId, char.name, mergedHistory, summaryPrompt, summaryFreq);
            API.Memory.addMemory(this.currentCharId, summary, 'manual');
            
            // 手动总结后强制重置计数器
            API.Chat._resetRoundCounter(this.currentCharId);
            console.log('[MemoryApp] 手动总结完成，计数器已重置');
            
            this.renderMemories();
            if (btn) {
                btn.textContent = '总结完成 ✓';
                setTimeout(function() {
                    btn.textContent = btn._originalText || '立即总结';
                    btn.disabled = false;
                    btn.classList.remove('opacity-60');
                }, 1500);
            }
        } catch (e) {
            alert('总结失败: ' + e.message);
            if (btn) {
                btn.textContent = btn._originalText || '立即总结';
                btn.disabled = false;
                btn.classList.remove('opacity-60');
            }
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

    // ==================== Token统计功能 ====================
    
    /**
     * 简单的token估算函数（中文按字符数，英文按单词数*1.3）
     */
    estimateTokens: function(text) {
        if (!text || typeof text !== 'string') return 0;
        // 中文字符
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        // 英文单词（简单估算）
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        // 英文和空格字符
        const englishAndSpaces = (text.match(/[a-zA-Z\s]/g) || []).length;
        // 其他字符
        const otherChars = text.length - chineseChars - englishAndSpaces;
        
        return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
    },

    /**
     * 计算角色的总token数
     */
    calculateTotalTokens: function() {
        if (!this.currentCharId) {
            console.warn('[MemoryApp] calculateTotalTokens: currentCharId is null');
            return { total: 0, breakdown: {} };
        }

        const char = API.Chat.getChar(this.currentCharId);
        if (!char) {
            console.warn('[MemoryApp] calculateTotalTokens: char not found for id', this.currentCharId);
            return { total: 0, breakdown: {} };
        }

        const breakdown = {};
        let total = 0;

        // 1. 角色设定（包括角色名称和角色提示词）
        const charName = char.name || '';
        const charPrompt = char.prompt || '';
        breakdown.charSetting = this.estimateTokens(charName) + this.estimateTokens(charPrompt);
        total += breakdown.charSetting;

        // 2. 系统设定（固定的系统提示词模板，估算约500 tokens）
        // 包括线上聊天规则、特殊指令、格式要求等
        breakdown.systemSetting = 500;
        total += breakdown.systemSetting;

        // 3. 上下文（最近的聊天记录）
        const settings = char.settings || {};
        const ctxLength = settings.contextLength || 20;
        const history = API.Chat.getHistory(this.currentCharId);
        const recentHistory = history.slice(-ctxLength);
        let contextTokens = 0;
        recentHistory.forEach(msg => {
            if (msg.content) {
                // 处理多模态内容（数组格式）
                if (Array.isArray(msg.content)) {
                    msg.content.forEach(part => {
                        if (part.type === 'text' && part.text) {
                            contextTokens += this.estimateTokens(part.text);
                        }
                    });
                } else if (typeof msg.content === 'string') {
                    contextTokens += this.estimateTokens(msg.content);
                }
            }
        });
        breakdown.context = contextTokens;
        total += contextTokens;

        // 4. 记忆
        const memories = API.Memory.getMemories(this.currentCharId);
        let memoryTokens = 0;
        memories.forEach(m => {
            memoryTokens += this.estimateTokens(m.content || '');
        });
        breakdown.memories = memoryTokens;
        total += memoryTokens;

        // 5. 用户人设
        let personaTokens = 0;
        if (settings.customPersonaContent) {
            personaTokens = this.estimateTokens(settings.customPersonaContent);
        } else if (settings.userPersonaId) {
            const personas = API.Profile.getPersonas();
            const persona = personas.find(p => p.id === settings.userPersonaId);
            if (persona) {
                personaTokens = this.estimateTokens(persona.content || '');
            }
        }
        breakdown.userPersona = personaTokens;
        total += personaTokens;

        // 6. 关联世界书
        const worldBookIds = settings.worldBookIds || (settings.worldBookId ? [settings.worldBookId] : []);
        let worldBookTokens = 0;
        if (worldBookIds.length > 0) {
            const books = API.WorldBook.getBooks();
            const selectedBooks = books.filter(b => worldBookIds.includes(b.id));
            selectedBooks.forEach(wb => {
                worldBookTokens += this.estimateTokens(wb.title || '');
                worldBookTokens += this.estimateTokens(wb.content || '');
            });
        }
        breakdown.worldBook = worldBookTokens;
        total += worldBookTokens;

        // 7. 关联表情包（只计算表情包含义文本）
        const emojiGroupIds = settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []);
        let emojiTokens = 0;
        if (emojiGroupIds.length > 0) {
            emojiGroupIds.forEach(groupId => {
                const emojis = API.Emoji.getGroupEmojis(groupId);
                emojis.forEach(e => {
                    emojiTokens += this.estimateTokens(e.meaning || '');
                    emojiTokens += this.estimateTokens(e.url || '');
                });
            });
        }
        breakdown.emoji = emojiTokens;
        total += emojiTokens;

        console.log('[MemoryApp] Token breakdown:', breakdown, 'Total:', total);
        return { total, breakdown };
    },

    /**
     * 更新token显示
     */
    updateTokenCount: function() {
        const result = this.calculateTotalTokens();
        const countEl = document.getElementById('total-token-count');
        if (countEl) {
            // 简化显示：1000以下显示完整数字，1000以上显示k
            let displayText;
            if (result.total < 1000) {
                displayText = result.total.toString();
            } else if (result.total < 10000) {
                displayText = (result.total / 1000).toFixed(1) + 'k';
            } else {
                displayText = Math.floor(result.total / 1000) + 'k';
            }
            countEl.textContent = displayText;
        }
    },

    /**
     * 显示token详情
     */
    showTokenDetails: function() {
        const result = this.calculateTotalTokens();
        const modal = document.getElementById('token-details-modal');
        const content = document.getElementById('token-details-content');
        
        if (!modal || !content) {
            console.error('[MemoryApp] Token details modal elements not found');
            return;
        }

        const labels = {
            charSetting: '角色设定',
            systemSetting: '系统设定',
            context: '上下文（聊天记录）',
            memories: '记忆',
            userPersona: '用户人设',
            worldBook: '关联世界书',
            emoji: '关联表情包'
        };

        let html = '<div class="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-4 mb-4">';
        html += '<div class="text-center">';
        html += '<div class="text-3xl font-bold text-purple-600">' + result.total.toLocaleString() + '</div>';
        html += '<div class="text-sm text-gray-600 mt-1">总Token数</div>';
        html += '</div></div>';

        html += '<div class="space-y-2">';
        Object.keys(result.breakdown).forEach(key => {
            const value = result.breakdown[key];
            const percentage = result.total > 0 ? ((value / result.total) * 100).toFixed(1) : 0;
            html += '<div class="bg-gray-50 rounded-lg p-3">';
            html += '<div class="flex justify-between items-center mb-1">';
            html += '<span class="text-sm font-medium text-gray-700">' + labels[key] + '</span>';
            html += '<span class="text-sm font-bold text-gray-900">' + value.toLocaleString() + '</span>';
            html += '</div>';
            html += '<div class="w-full bg-gray-200 rounded-full h-2">';
            html += '<div class="bg-purple-500 h-2 rounded-full" style="width: ' + percentage + '%"></div>';
            html += '</div>';
            html += '<div class="text-xs text-gray-500 mt-1">' + percentage + '%</div>';
            html += '</div>';
        });
        html += '</div>';

        content.innerHTML = html;
        modal.classList.remove('hidden');
    },

    /**
     * 关闭token详情
     */
    closeTokenDetails: function() {
        document.getElementById('token-details-modal').classList.add('hidden');
    },

    // ==================== 精简记忆功能 ====================
    
    /**
     * 打开精简记忆模态框
     */
    openSimplifyModal: function() {
        const memories = API.Memory.getMemories(this.currentCharId);
        if (memories.length === 0) {
            alert('暂无记忆可精简');
            return;
        }

        const modal = document.getElementById('simplify-memory-modal');
        document.getElementById('simplify-from').value = 1;
        document.getElementById('simplify-to').value = memories.length;
        document.getElementById('simplify-to').max = memories.length;
        document.getElementById('simplify-from').max = memories.length;
        document.getElementById('simplify-count').value = 1;
        document.getElementById('simplify-count').max = memories.length;
        
        modal.classList.remove('hidden');
    },

    /**
     * 取消精简
     */
    cancelSimplify: function() {
        document.getElementById('simplify-memory-modal').classList.add('hidden');
    },

    /**
     * 开始精简记忆
     */
    startSimplify: async function() {
        const from = parseInt(document.getElementById('simplify-from').value);
        const to = parseInt(document.getElementById('simplify-to').value);
        const count = parseInt(document.getElementById('simplify-count').value);
        const prompt = document.getElementById('simplify-prompt').value.trim();

        if (!prompt) {
            alert('请输入精简提示词');
            return;
        }

        if (from < 1 || to < 1 || from > to) {
            alert('请输入有效的记忆范围');
            return;
        }

        if (count < 1) {
            alert('请输入有效的精简数量');
            return;
        }

        const memories = API.Memory.getMemories(this.currentCharId);
        if (to > memories.length) {
            alert('记忆范围超出实际记忆数量');
            return;
        }

        // 获取要精简的记忆（注意：数组索引从0开始）
        const selectedMemories = memories.slice(from - 1, to);
        
        if (selectedMemories.length === 0) {
            alert('没有选中任何记忆');
            return;
        }

        // 显示加载状态
        const modal = document.getElementById('simplify-memory-modal');
        const startBtn = modal.querySelector('button[onclick="MemoryApp.startSimplify()"]');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = '正在精简...';
            startBtn.classList.add('opacity-60');
        }

        try {
            // 调用API精简记忆
            const simplified = await this.simplifyMemories(selectedMemories, count, prompt);
            
            // 删除原来的记忆（从后往前删除，避免索引变化）
            for (let i = to - 1; i >= from - 1; i--) {
                memories.splice(i, 1);
            }
            
            // 在原位置插入精简后的记忆
            simplified.forEach((content, idx) => {
                memories.splice(from - 1 + idx, 0, {
                    id: 'mem_' + Date.now() + '_' + idx,
                    content: content,
                    timestamp: Date.now(),
                    type: 'simplified'
                });
            });
            
            // 保存更新后的记忆
            API.Memory.saveMemories(this.currentCharId, memories);
            
            // 刷新显示
            this.renderMemories();
            
            // 关闭模态框
            modal.classList.add('hidden');
            
            alert('精简完成！已将第' + from + '-' + to + '条记忆精简为' + count + '条');
        } catch (e) {
            alert('精简失败: ' + e.message);
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = '开始精简';
                startBtn.classList.remove('opacity-60');
            }
        }
    },

    /**
     * 调用API精简记忆
     */
    simplifyMemories: async function(memories, targetCount, prompt) {
        const config = API.Settings.getApiConfig();
        if (!config.endpoint || !config.key) {
            throw new Error('请先在设置中配置 API');
        }

        // 构建要精简的记忆文本
        const memoryText = memories.map((m, idx) =>
            '记忆' + (idx + 1) + ': ' + m.content
        ).join('\n\n');

        // 构建系统提示词
        let systemContent = prompt;
        systemContent += '\n\n请将以下' + memories.length + '条记忆精简为' + targetCount + '条记忆。';
        systemContent += '\n要求：';
        systemContent += '\n1. 保留最重要的信息';
        systemContent += '\n2. 每条记忆独立完整';
        systemContent += '\n3. 按原有顺序组织';
        systemContent += '\n4. 直接输出精简后的记忆，每条记忆用换行符分隔';
        systemContent += '\n5. 不要添加序号、标题或其他格式';

        const response = await fetch(config.endpoint + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.key
            },
            body: JSON.stringify({
                model: config.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: memoryText }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error('API请求失败');
        }

        const data = await response.json();
        const result = data.choices[0].message.content;
        
        // 解析结果，按换行符分割
        const simplified = result.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .slice(0, targetCount); // 确保不超过目标数量

        if (simplified.length === 0) {
            throw new Error('精简结果为空');
        }

        return simplified;
    },
    
    /**
     * 更新轮数显示
     */
    updateRoundCount: function() {
        if (!this.currentCharId) return;
        
        const char = API.Chat.getChar(this.currentCharId);
        if (!char) return;
        
        const settings = char.settings || {};
        const freq = settings.summaryFreq || 10;
        
        // 获取统一的轮数计数
        const currentCount = API.Chat._getUnifiedRoundCount(this.currentCharId);
        const lastSummaryRound = API.Chat._getLastSummaryRound(this.currentCharId);
        const newRounds = currentCount.totalRounds - lastSummaryRound;
        
        const roundCountEl = document.getElementById('round-count');
        if (roundCountEl) {
            roundCountEl.textContent = newRounds + '/' + freq;
            roundCountEl.title = '当前新增轮数: ' + newRounds + ' (线上:' + currentCount.onlineRounds + ' 线下:' + currentCount.offlineRounds + ') / 自动总结频率: ' + freq;
            
            // 如果接近触发自动总结，改变颜色提示
            if (newRounds >= freq * 0.8) {
                roundCountEl.classList.add('text-orange-500', 'font-bold');
            } else {
                roundCountEl.classList.remove('text-orange-500', 'font-bold');
            }
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

// ==================== PROFILE MANAGER UI (已废弃 - 暂时停用) ====================
const ProfileManager = {
    open: function() {
        document.getElementById('profile-app').classList.remove('hidden');
    },

    close: function() {
        document.getElementById('profile-app').classList.add('hidden');
    }
};
