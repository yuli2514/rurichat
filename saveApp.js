/**
 * saveApp.js
 * 存档管理UI控制器
 */
const SaveApp = {
    currentCharId: null,
    currentSaveId: null,

    /**
     * 打开存档管理界面
     */
    open: function() {
        console.log('[SaveApp] Opening save app...');
        console.log('[SaveApp] ChatInterface exists:', typeof ChatInterface !== 'undefined');
        console.log('[SaveApp] ChatInterface.currentCharId:', typeof ChatInterface !== 'undefined' ? ChatInterface.currentCharId : 'N/A');
        
        // 获取当前角色ID
        if (typeof ChatInterface !== 'undefined' && ChatInterface.currentCharId) {
            this.currentCharId = ChatInterface.currentCharId;
            console.log('[SaveApp] Using charId:', this.currentCharId);
        } else {
            console.error('[SaveApp] No character selected');
            alert('请先选择一个角色进入聊天界面');
            return;
        }

        const saveAppEl = document.getElementById('save-app');
        if (!saveAppEl) {
            console.error('[SaveApp] save-app element not found!');
            alert('存档界面加载失败，请刷新页面');
            return;
        }

        saveAppEl.classList.remove('hidden');
        this.renderSaveList();
        console.log('[SaveApp] Save app opened successfully');
    },

    /**
     * 关闭存档管理界面
     */
    close: function() {
        document.getElementById('save-app').classList.add('hidden');
        this.currentCharId = null;
    },

    /**
     * 渲染存档列表
     */
    renderSaveList: function() {
        const container = document.getElementById('save-list-container');
        const emptyState = document.getElementById('save-empty-state');
        const saves = SaveManager.getAllSaves();

        if (saves.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        container.innerHTML = saves.map(save => {
            const date = new Date(save.timestamp);
            const dateStr = date.toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const stats = SaveManager.getSaveStats(save.id);
            const totalMessages = stats.onlineMessages + stats.offlineMessages;

            return `
                <div class="bg-white rounded-lg p-4 border border-gray-200 active:bg-gray-50 transition cursor-pointer"
                     onclick="SaveApp.openDetailModal('${save.id}')">
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="font-bold text-gray-900 text-base flex-1 mr-2">${this._escapeHtml(save.name)}</h3>
                        <span class="text-xs text-gray-400 shrink-0">${dateStr}</span>
                    </div>
                    <div class="text-xs text-gray-500 mb-3">
                        ${this._escapeHtml(save.charName)} · ${totalMessages} 条消息 · ${stats.memories} 条记忆
                    </div>
                    <div class="flex gap-2">
                        <button
                            onclick="event.stopPropagation(); SaveApp.quickLoad('${save.id}')"
                            class="flex-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg active:scale-95 transition text-xs"
                        >
                            加载
                        </button>
                        <button
                            onclick="event.stopPropagation(); SaveApp.exportSave('${save.id}')"
                            class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg active:scale-95 transition text-xs"
                        >
                            导出
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * 打开保存存档模态框
     */
    openSaveModal: function() {
        if (!this.currentCharId) {
            alert('请先选择一个角色');
            return;
        }

        const char = API.Chat.getChar(this.currentCharId);
        if (!char) {
            alert('角色不存在');
            return;
        }

        // 生成默认存档名称
        const date = new Date();
        const defaultName = `${char.name}_${date.getMonth() + 1}月${date.getDate()}日`;
        document.getElementById('save-name-input').value = defaultName;

        document.getElementById('save-modal').classList.remove('hidden');
        
        // 聚焦输入框并选中文本
        setTimeout(() => {
            const input = document.getElementById('save-name-input');
            input.focus();
            input.select();
        }, 100);
    },

    /**
     * 关闭保存存档模态框
     */
    closeSaveModal: function() {
        document.getElementById('save-modal').classList.add('hidden');
    },

    /**
     * 确认保存存档
     */
    confirmSave: function() {
        const saveName = document.getElementById('save-name-input').value.trim();
        
        if (!saveName) {
            alert('请输入存档名称');
            return;
        }

        try {
            SaveManager.createSave(this.currentCharId, saveName);
            this.closeSaveModal();
            this.renderSaveList();
            alert('✅ 存档保存成功！');
        } catch (e) {
            console.error('[SaveApp] Save failed:', e);
            alert('❌ 保存失败：' + e.message);
        }
    },

    /**
     * 全新开始
     */
    startFresh: function() {
        if (!this.currentCharId) {
            alert('请先选择一个角色');
            return;
        }

        const char = API.Chat.getChar(this.currentCharId);
        if (!char) {
            alert('角色不存在');
            return;
        }

        if (!confirm(`⚠️ 确定要全新开始吗？\n\n这将清空【${char.name}】的所有聊天记录和记忆，但保留角色人设。\n\n建议先保存当前状态！`)) {
            return;
        }

        if (!confirm('再次确认：真的要清空所有聊天和记忆吗？此操作不可撤销！')) {
            return;
        }

        try {
            SaveManager.startFresh(this.currentCharId);
            alert('✅ 已清空聊天和记忆，可以开始新的故事了！');
            
            // 如果当前在聊天界面，刷新显示
            if (typeof ChatInterface !== 'undefined' && ChatInterface.currentCharId === this.currentCharId) {
                ChatInterface.renderMessages();
            }
        } catch (e) {
            console.error('[SaveApp] Start fresh failed:', e);
            alert('❌ 操作失败：' + e.message);
        }
    },

    /**
     * 打开存档详情模态框
     */
    openDetailModal: function(saveId) {
        this.currentSaveId = saveId;
        const saves = SaveManager.getAllSaves();
        const save = saves.find(s => s.id === saveId);
        
        if (!save) {
            alert('存档不存在');
            return;
        }

        const stats = SaveManager.getSaveStats(saveId);
        const date = new Date(save.timestamp);
        const dateStr = date.toLocaleString('zh-CN');

        document.getElementById('save-detail-name').textContent = save.name;
        document.getElementById('save-detail-time').textContent = `保存于 ${dateStr}`;
        document.getElementById('save-stat-online').textContent = `${stats.onlineMessages} 条`;
        document.getElementById('save-stat-offline').textContent = `${stats.offlineMessages} 条`;
        document.getElementById('save-stat-memories').textContent = `${stats.memories} 条`;
        document.getElementById('save-stat-personas').textContent = `${stats.userPersonas} 个`;

        document.getElementById('save-detail-modal').classList.remove('hidden');
    },

    /**
     * 关闭存档详情模态框
     */
    closeDetailModal: function() {
        document.getElementById('save-detail-modal').classList.add('hidden');
        this.currentSaveId = null;
    },

    /**
     * 确认加载存档
     */
    confirmLoad: function() {
        if (!this.currentSaveId) return;

        if (!confirm('⚠️ 加载此存档将覆盖当前的聊天记录和记忆，确定继续吗？\n\n建议先保存当前状态！')) {
            return;
        }

        try {
            const save = SaveManager.loadSave(this.currentSaveId);
            this.closeDetailModal();
            this.close();
            alert(`✅ 存档【${save.name}】加载成功！`);
            
            // 如果当前在聊天界面，刷新显示
            if (typeof ChatInterface !== 'undefined' && ChatInterface.currentCharId === save.charId) {
                ChatInterface.renderMessages();
            }
            
            // 刷新记忆APP（如果打开）
            if (typeof MemoryApp !== 'undefined' && MemoryApp.currentCharId === save.charId) {
                MemoryApp.renderMemories();
            }
        } catch (e) {
            console.error('[SaveApp] Load failed:', e);
            alert('❌ 加载失败：' + e.message);
        }
    },

    /**
     * 快速加载存档（从列表直接加载）
     */
    quickLoad: function(saveId) {
        this.currentSaveId = saveId;
        this.confirmLoad();
    },

    /**
     * 导出当前查看的存档
     */
    exportCurrentSave: function() {
        if (!this.currentSaveId) return;
        
        try {
            SaveManager.exportSave(this.currentSaveId);
        } catch (e) {
            console.error('[SaveApp] Export failed:', e);
            alert('❌ 导出失败：' + e.message);
        }
    },

    /**
     * 导出指定存档
     */
    exportSave: function(saveId) {
        try {
            SaveManager.exportSave(saveId);
        } catch (e) {
            console.error('[SaveApp] Export failed:', e);
            alert('❌ 导出失败：' + e.message);
        }
    },

    /**
     * 删除当前查看的存档
     */
    deleteCurrentSave: function() {
        if (!this.currentSaveId) return;

        if (!confirm('确定要删除这个存档吗？此操作不可撤销！')) {
            return;
        }

        try {
            SaveManager.deleteSave(this.currentSaveId);
            this.closeDetailModal();
            this.renderSaveList();
            alert('✅ 存档已删除');
        } catch (e) {
            console.error('[SaveApp] Delete failed:', e);
            alert('❌ 删除失败：' + e.message);
        }
    },

    /**
     * HTML转义（防止XSS）
     */
    _escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出到全局
window.SaveApp = SaveApp;
