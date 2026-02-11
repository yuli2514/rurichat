/**
 * chatRender/emojiPanel.js
 * 聊天渲染模块 - 表情包面板
 * 
 * 包含：
 * - 表情包分组栏渲染
 * - 表情包网格渲染
 * - 最近使用表情包管理
 * - 发送表情包
 */

const EmojiPanel = {
    // 当前选中的表情包分组ID
    currentEmojiGroupId: 'recent',
    // 渲染任务（用于取消）
    renderTask: null,

    /**
     * 根据分组ID渲染表情包网格
     * @param {string} groupId - 分组ID
     * @param {string} currentCharId - 当前角色ID
     */
    renderEmojiGridById: function(groupId, currentCharId) {
        if (this.renderTask) cancelAnimationFrame(this.renderTask);
        if (!groupId) groupId = 'recent';
        this.currentEmojiGroupId = groupId;

        const allGroups = API.Emoji.getGroups();
        const char = API.Chat.getChar(currentCharId);
        const settings = char && char.settings ? char.settings : {};
        
        // 支持多选的表情包分组
        const boundGroupIds = settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []);
        const boundGroups = allGroups.filter(g => boundGroupIds.includes(g.id));
        
        // 1. 渲染分组栏
        const bar = document.getElementById('emoji-group-bar');
        let barHtml = '';
        
        const isRecentActive = groupId === 'recent';

        // ★ 最近使用的表情包按钮
        const recentButtonClass = isRecentActive ? 'text-blue-500 border-blue-500 bg-blue-50' : 'text-gray-500 border-transparent hover:bg-gray-50';
        barHtml += `<button onclick="ChatInterface.renderEmojiGridById('recent')" class="px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${recentButtonClass}">★</button>`;

        // 显示所有表情包分组
        allGroups.forEach(g => {
            const isActive = groupId === g.id;
            const buttonClass = isActive ? 'text-blue-500 border-blue-500 bg-blue-50' : 'text-gray-500 border-transparent hover:bg-gray-50';
            barHtml += `<button onclick="ChatInterface.renderEmojiGridById('${g.id}')" class="px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${buttonClass}">${g.name}</button>`;
        });

        barHtml += '<button onclick="EmojiManager.openModal()" class="px-4 py-2 text-xs font-medium whitespace-nowrap text-gray-400 hover:text-gray-600 ml-auto"><i class="fa-solid fa-gear"></i></button>';

        bar.innerHTML = barHtml;

        // 2. 渲染表情包网格
        const grid = document.getElementById('emoji-grid');
        let emojis = [];

        if (groupId === 'recent') {
            // 显示最近使用的表情包（最多15个）
            emojis = this.getRecentEmojis();
        } else {
            const group = allGroups.find(g => g.id === groupId);
            if (group) emojis = group.emojis;
        }
        
        if (emojis.length === 0) {
             grid.innerHTML = '<div class="col-span-4 text-center text-gray-400 py-8 text-xs">此处没有表情<br>点击右上角⚙️导入</div>';
             return;
        }

        // 清空现有内容并重置网格
        grid.innerHTML = '';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gap = '1rem';
        grid.style.alignContent = 'start';

        // 分块渲染优化 - 减少每块大小以提升移动端性能
        const CHUNK_SIZE = 12;
        let currentIndex = 0;

        const renderChunk = () => {
            const chunk = emojis.slice(currentIndex, currentIndex + CHUNK_SIZE);
            if (chunk.length === 0) return;

            const chunkHtml = chunk.map(e => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(e.url) || e.url.startsWith('data:image');
                // 转义单引号防止JS错误
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

            // 使用 insertAdjacentHTML 提升性能
            grid.insertAdjacentHTML('beforeend', chunkHtml);
            
            currentIndex += CHUNK_SIZE;
            if (currentIndex < emojis.length) {
                this.renderTask = requestAnimationFrame(renderChunk);
            }
        };

        // 开始渲染
        renderChunk();
    },
    
    /**
     * 渲染表情包网格（默认显示最近使用）
     * @param {string} currentCharId - 当前角色ID
     */
    renderEmojiGrid: function(currentCharId) {
        this.renderEmojiGridById('recent', currentCharId);
    },

    /**
     * 获取最近使用的表情包（最多15个）
     * @returns {Array} - 最近使用的表情包数组
     */
    getRecentEmojis: function() {
        try {
            const recent = JSON.parse(localStorage.getItem('recent_emojis') || '[]');
            return recent.slice(0, 15);
        } catch (e) {
            return [];
        }
    },

    /**
     * 保存最近使用的表情包
     * @param {string} emojiUrl - 表情包URL
     */
    saveRecentEmoji: function(emojiUrl) {
        try {
            let recent = JSON.parse(localStorage.getItem('recent_emojis') || '[]');
            // 移除已存在的相同表情包（避免重复）
            recent = recent.filter(e => e.url !== emojiUrl);
            // 添加到最前面
            recent.unshift({ url: emojiUrl, meaning: '最近使用' });
            // 只保留最近15个
            recent = recent.slice(0, 15);
            localStorage.setItem('recent_emojis', JSON.stringify(recent));
        } catch (e) {
            console.error('保存最近使用表情包失败:', e);
        }
    },

    /**
     * 发送表情包
     * @param {string} emojiUrl - 表情包URL
     * @param {string} currentCharId - 当前角色ID
     */
    sendEmoji: function(emojiUrl, currentCharId) {
        // 保存到最近使用
        this.saveRecentEmoji(emojiUrl);
        
        const msg = {
            id: Date.now(),
            sender: 'user',
            content: emojiUrl,
            type: 'image',
            timestamp: Date.now()
        };
        API.Chat.addMessage(currentCharId, msg);
        
        // 隐藏面板
        document.getElementById('panel-container').classList.add('hidden');
        
        return msg;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmojiPanel;
}
