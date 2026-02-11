/**
 * chatSettings/bindingSelectors.js
 * 聊天设置模块 - 绑定选择器
 * 
 * 包含：
 * - 世界书目录树渲染（多选）
 * - 表情包多选列表渲染
 * - 绑定切换操作
 */

const BindingSelectors = {
    /**
     * 渲染世界书目录树（支持多选）
     * @param {Array} selectedIds - 已选中的世界书ID数组
     */
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
    
    /**
     * 渲染单个世界书项
     * @private
     */
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
    
    /**
     * 切换世界书选中状态
     * @param {string} bookId - 世界书ID
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     */
    toggleWorldBook: function(bookId, updateSettingsCallback) {
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
        
        updateSettingsCallback({ worldBookIds: selectedIds });
    },

    /**
     * 渲染表情包多选列表
     * @param {Array} selectedIds - 已选中的表情包分组ID数组
     */
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
    
    /**
     * 切换表情包分组选中状态
     * @param {string} groupId - 表情包分组ID
     * @param {Function} updateSettingsCallback - 更新设置的回调函数
     */
    toggleEmojiGroup: function(groupId, updateSettingsCallback) {
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
        
        updateSettingsCallback({ emojiGroupIds: selectedIds });
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BindingSelectors;
}
