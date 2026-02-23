/**
 * saveManager.js
 * 存档/读档管理模块 - 支持保存和恢复完整的角色对话状态
 */

const SaveManager = {
    STORAGE_KEY: 'ruri_save_archives',
    
    /**
     * 初始化存档管理器
     */
    init: function() {
        console.log('[SaveManager] Initialized');
    },

    /**
     * 获取所有存档列表
     * @returns {Array} 存档列表
     */
    getAllSaves: function() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];
            const saves = JSON.parse(raw);
            return Array.isArray(saves) ? saves : [];
        } catch (e) {
            console.error('[SaveManager] Failed to load saves:', e);
            return [];
        }
    },

    /**
     * 保存存档列表
     * @param {Array} saves - 存档列表
     */
    _saveSavesList: function(saves) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
        } catch (e) {
            console.error('[SaveManager] Failed to save archives list:', e);
            throw new Error('存档列表保存失败: ' + e.message);
        }
    },

    /**
     * 创建新存档 - 保存当前角色的完整状态
     * @param {string} charId - 角色ID
     * @param {string} saveName - 存档名称
     * @returns {Object} 创建的存档对象
     */
    createSave: function(charId, saveName) {
        if (!charId) {
            throw new Error('未选择角色');
        }
        if (!saveName || !saveName.trim()) {
            throw new Error('存档名称不能为空');
        }

        // 获取角色信息
        const char = API.Chat.getChar(charId);
        if (!char) {
            throw new Error('角色不存在');
        }

        // 打包5项数据
        const saveData = {
            // 1. 线上聊天记录
            onlineHistory: API.Chat.getHistory(charId) || [],
            
            // 2. 线下聊天记录
            offlineHistory: API.Offline.getHistory(charId) || [],
            
            // 3. 角色记忆
            memories: API.Memory.getMemories(charId) || [],
            
            // 4. 角色人设（完整角色对象）
            character: JSON.parse(JSON.stringify(char)), // 深拷贝
            
            // 5. 用户人设列表（全局）
            userPersonas: API.Profile.getPersonas() || []
        };

        // 创建存档对象
        const save = {
            id: 'save_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: saveName.trim(),
            charId: charId,
            charName: char.name,
            timestamp: Date.now(),
            data: saveData
        };

        // 添加到存档列表
        const saves = this.getAllSaves();
        saves.unshift(save); // 新存档放在最前面
        this._saveSavesList(saves);

        console.log('[SaveManager] Save created:', save.id, save.name);
        return save;
    },

    /**
     * 加载存档 - 恢复存档时的角色状态
     * @param {string} saveId - 存档ID
     * @returns {Object} 加载的存档数据
     */
    loadSave: function(saveId) {
        const saves = this.getAllSaves();
        const save = saves.find(s => s.id === saveId);
        
        if (!save) {
            throw new Error('存档不存在');
        }

        const data = save.data;
        const charId = save.charId;

        // 恢复5项数据
        try {
            // 1. 恢复线上聊天记录
            API.Chat.saveHistory(charId, data.onlineHistory || []);
            
            // 2. 恢复线下聊天记录
            API.Offline.saveHistory(charId, data.offlineHistory || []);
            
            // 3. 恢复角色记忆
            API.Memory.saveMemories(charId, data.memories || []);
            
            // 4. 恢复角色人设（更新角色信息）
            if (data.character) {
                // 保留当前头像和一些UI状态，只恢复核心人设数据
                const currentChar = API.Chat.getChar(charId);
                const restoreData = {
                    name: data.character.name,
                    prompt: data.character.prompt,
                    remark: data.character.remark,
                    settings: data.character.settings
                };
                // 如果存档中有头像且不是默认头像，也恢复头像
                if (data.character.avatar && data.character.avatar !== 'icon.png') {
                    restoreData.avatar = data.character.avatar;
                }
                API.Chat.updateChar(charId, restoreData);
            }
            
            // 5. 恢复用户人设（全局）
            if (data.userPersonas && Array.isArray(data.userPersonas)) {
                API.Profile.savePersonas(data.userPersonas);
            }

            console.log('[SaveManager] Save loaded:', saveId);
            return save;
        } catch (e) {
            console.error('[SaveManager] Failed to load save:', e);
            throw new Error('存档加载失败: ' + e.message);
        }
    },

    /**
     * 删除存档
     * @param {string} saveId - 存档ID
     */
    deleteSave: function(saveId) {
        let saves = this.getAllSaves();
        const index = saves.findIndex(s => s.id === saveId);
        
        if (index === -1) {
            throw new Error('存档不存在');
        }

        saves.splice(index, 1);
        this._saveSavesList(saves);
        console.log('[SaveManager] Save deleted:', saveId);
    },

    /**
     * 全新开始 - 清空当前角色的聊天和记忆，保留人设
     * @param {string} charId - 角色ID
     */
    startFresh: function(charId) {
        if (!charId) {
            throw new Error('未选择角色');
        }

        const char = API.Chat.getChar(charId);
        if (!char) {
            throw new Error('角色不存在');
        }

        try {
            // 清空线上聊天记录
            API.Chat.saveHistory(charId, []);
            
            // 清空线下聊天记录
            API.Offline.saveHistory(charId, []);
            
            // 清空角色记忆
            API.Memory.saveMemories(charId, []);
            
            // 重置自动总结计数器
            if (typeof API.Chat._resetRoundCounter === 'function') {
                API.Chat._resetRoundCounter(charId);
            }

            console.log('[SaveManager] Fresh start for char:', charId);
        } catch (e) {
            console.error('[SaveManager] Failed to start fresh:', e);
            throw new Error('全新开始失败: ' + e.message);
        }
    },

    /**
     * 导出存档为JSON文件（用于备份）
     * @param {string} saveId - 存档ID
     */
    exportSave: function(saveId) {
        const saves = this.getAllSaves();
        const save = saves.find(s => s.id === saveId);
        
        if (!save) {
            throw new Error('存档不存在');
        }

        const json = JSON.stringify(save, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `存档_${save.name}_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },

    /**
     * 导入存档从JSON文件
     * @param {File} file - JSON文件
     * @returns {Promise<Object>} 导入的存档对象
     */
    importSave: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const save = JSON.parse(e.target.result);
                    
                    // 验证存档格式
                    if (!save.id || !save.name || !save.data) {
                        throw new Error('存档格式无效');
                    }

                    // 生成新ID避免冲突
                    save.id = 'save_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    save.timestamp = Date.now();

                    // 添加到存档列表
                    const saves = this.getAllSaves();
                    saves.unshift(save);
                    this._saveSavesList(saves);

                    console.log('[SaveManager] Save imported:', save.id);
                    resolve(save);
                } catch (err) {
                    reject(new Error('导入失败: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    },

    /**
     * 获取存档统计信息
     * @param {string} saveId - 存档ID
     * @returns {Object} 统计信息
     */
    getSaveStats: function(saveId) {
        const saves = this.getAllSaves();
        const save = saves.find(s => s.id === saveId);
        
        if (!save) {
            return null;
        }

        const data = save.data;
        return {
            onlineMessages: (data.onlineHistory || []).length,
            offlineMessages: (data.offlineHistory || []).length,
            memories: (data.memories || []).length,
            userPersonas: (data.userPersonas || []).length,
            charName: save.charName,
            timestamp: save.timestamp
        };
    }
};

// 导出到全局
window.SaveManager = SaveManager;
