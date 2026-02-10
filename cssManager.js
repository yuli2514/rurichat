/**
 * cssManager.js
 * 负责聊天界面的CSS自定义和预设管理
 */
const CssManager = {
    updateCssVar: function(type, value) {
        const msgArea = document.getElementById('chat-messages');
        if (!msgArea) return;

        if (type === 'bubble') {
            const valDisplay = document.getElementById('val-bubble-size');
            if (valDisplay) valDisplay.textContent = value;
            
            const v = 10 * value;
            const h = 14 * value;
            msgArea.style.setProperty('--chat-bubble-padding-v', v + 'px');
            msgArea.style.setProperty('--chat-bubble-padding-h', h + 'px');
            
            if (typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssBubble: value });
            }
        } else if (type === 'font') {
            const valDisplay = document.getElementById('val-font-size');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            msgArea.style.setProperty('--chat-font-size', value + 'px');
            
            if (typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssFont: value });
            }
        } else if (type === 'avatar') {
            const valDisplay = document.getElementById('val-avatar-size');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            msgArea.style.setProperty('--chat-avatar-size', value + 'px');
            
            if (typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssAvatar: value });
            }
        } else if (type === 'toolbar') {
            const valDisplay = document.getElementById('val-toolbar-icon');
            if (valDisplay) valDisplay.textContent = value + 'px';
            
            const chatInterface = document.getElementById('super-chat-interface');
            if (chatInterface) {
                chatInterface.style.setProperty('--chat-toolbar-icon-size', value + 'px');
            }
            
            if (typeof ChatSettings !== 'undefined') {
                ChatSettings.updateCharSettings({ cssToolbar: value });
            }
        }
    },

    applyCustomCss: function(css) {
        let style = document.getElementById('char-custom-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'char-custom-css';
            document.head.appendChild(style);
        }
        style.textContent = css;
        ChatSettings.updateCharSettings({ customCss: css });
    },

    saveCssPreset: function() {
        const css = document.getElementById('custom-css-input').value;
        if (!css.trim()) return alert('CSS 内容为空');
        const name = prompt('为预设命名:');
        if (!name) return;
        
        let presets = API.Settings.getCssPresets();
        presets.push({ name, css });
        API.Settings.saveCssPresets(presets);
        this.renderCssPresets();
        alert('预设已保存');
    },

    renderCssPresets: function() {
        const list = document.getElementById('css-presets-container');
        const presets = API.Settings.getCssPresets();
        
        if (presets.length === 0) {
            list.innerHTML = '<span class="text-xs text-gray-400 block text-center py-1">暂无预设</span>';
            return;
        }

        list.innerHTML = presets.map((p, idx) => `
            <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                <span class="text-xs font-medium text-gray-600 truncate">${p.name}</span>
                <div class="flex gap-2">
                    <button onclick="CssManager.loadCssPreset(${idx})" class="text-blue-500 text-[10px]">应用</button>
                    <button onclick="CssManager.deleteCssPreset(${idx})" class="text-red-500 text-[10px]">删除</button>
                </div>
            </div>
        `).join('');
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
    }
};
