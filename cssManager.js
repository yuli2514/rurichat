/**
 * cssManager.js
 * 负责聊天界面的CSS自定义和预设管理
 */
const CssManager = {
    /**
     * 更新CSS变量并应用到界面
     * @param {string} type - 变量类型: bubble/font/avatar/toolbar/avatarRadius
     * @param {*} value - 值
     * @param {boolean} skipSave - 是否跳过保存（恢复设置时使用）
     */
    updateCssVar: function(type, value, skipSave) {
        const msgArea = document.getElementById('chat-messages');
        if (!msgArea) return;

        if (type === 'bubble') {
            const valDisplay = document.getElementById('val-bubble-size');
            if (valDisplay) valDisplay.textContent = value;
            
            const v = 10 * value;
            const h = 14 * value;
            msgArea.style.setProperty('--chat-bubble-padding-v', v + 'px');
            msgArea.style.setProperty('--chat-bubble-padding-h', h + 'px');
            
            if (!skipSave && typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssBubble: value });
            }
        } else if (type === 'font') {
            const valDisplay = document.getElementById('val-font-size');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            msgArea.style.setProperty('--chat-font-size', value + 'px');
            
            if (!skipSave && typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssFont: value });
            }
        } else if (type === 'avatar') {
            const valDisplay = document.getElementById('val-avatar-size');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            msgArea.style.setProperty('--chat-avatar-size', value + 'px');
            
            if (!skipSave && typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssAvatar: value });
            }
        } else if (type === 'toolbar') {
            const valDisplay = document.getElementById('val-toolbar-icon');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            const chatInterface = document.getElementById('super-chat-interface');
            if (chatInterface) {
                chatInterface.style.setProperty('--chat-toolbar-icon-size', value + 'px');
            }
            
            if (!skipSave && typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssToolbar: value });
            }
        } else if (type === 'avatarRadius') {
            const valDisplay = document.getElementById('val-avatar-radius');
            if (valDisplay) valDisplay.textContent = value + '%';
            
            msgArea.style.setProperty('--chat-avatar-radius', value + '%');
            
            if (!skipSave && typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssAvatarRadius: value });
            }
        }
    },

    /**
     * 应用自定义CSS
     * @param {string} css - CSS代码
     * @param {boolean} skipSave - 是否跳过保存
     */
    applyCustomCss: function(css, skipSave) {
        let style = document.getElementById('char-custom-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'char-custom-css';
            document.head.appendChild(style);
        }
        style.textContent = css;
        if (!skipSave) {
            ChatSettings.updateCharSettings({ customCss: css });
        }
    },

    saveCssPreset: function() {
        const css = document.getElementById('custom-css-input').value;
        if (!css.trim()) return alert('CSS 内容为空');
        const name = prompt('为预设命名:');
        if (!name) return;
        
        let presets = API.Settings.getCssPresets();
        const existingIdx = presets.findIndex(p => p.name === name);
        if (existingIdx !== -1) {
            presets[existingIdx].css = css;
        } else {
            presets.push({ name, css });
        }
        API.Settings.saveCssPresets(presets);
        this.renderCssPresets();
        alert(existingIdx !== -1 ? '预设已覆盖' : '预设已保存');
    },

    // 打开CSS预设弹窗
    openPresetModal: function() {
        const modal = document.getElementById('css-preset-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderPresetModalList();
        }
    },

    // 关闭CSS预设弹窗
    closePresetModal: function() {
        const modal = document.getElementById('css-preset-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    // 渲染弹窗中的预设列表
    renderPresetModalList: function() {
        const list = document.getElementById('css-preset-modal-list');
        const presets = API.Settings.getCssPresets();
        
        if (!list) return;
        
        if (presets.length === 0) {
            list.innerHTML = '<span class="text-xs text-gray-400 block text-center py-4">暂无预设，请先保存CSS预设</span>';
            return;
        }

        list.innerHTML = presets.map((p, idx) => `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 hover:bg-gray-100 transition">
                <span class="text-sm font-medium text-gray-700 truncate flex-1">${p.name}</span>
                <div class="flex gap-2 shrink-0">
                    <button onclick="CssManager.loadCssPreset(${idx}); CssManager.closePresetModal();" class="text-blue-500 text-xs font-medium px-2 py-1 bg-blue-50 rounded">应用</button>
                    <button onclick="CssManager.deleteCssPreset(${idx})" class="text-red-500 text-xs font-medium px-2 py-1 bg-red-50 rounded">删除</button>
                </div>
            </div>
        `).join('');
    },

    // 清除当前CSS
    clearCurrentCss: function() {
        document.getElementById('custom-css-input').value = '';
        this.applyCustomCss('');
        this.closePresetModal();
    },

    renderCssPresets: function() {
        // 同时更新弹窗列表（如果打开的话）
        this.renderPresetModalList();
    },

    loadCssPreset: function(idx) {
        const presets = API.Settings.getCssPresets();
        if (presets[idx]) {
            const css = presets[idx].css;
            document.getElementById('custom-css-input').value = css;
            this.applyCustomCss(css);
        }
    },

    deleteCssPreset: function(idx) {
        if (!confirm('删除此预设?')) return;
        let presets = API.Settings.getCssPresets();
        presets.splice(idx, 1);
        API.Settings.saveCssPresets(presets);
        this.renderCssPresets();
        this.renderPresetModalList();
    }
};
