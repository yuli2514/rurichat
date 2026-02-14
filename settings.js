/**
 * settings.js
 * 负责全局设置管理：API配置、壁纸、字体、屏幕参数等
 */

const SettingsManager = {
    init: function() {
        this.loadSettings();
        this.bindEvents();
    },

    bindEvents: function() {
        document.getElementById('settings-icon').addEventListener('click', () => {
            document.getElementById('settings-app').classList.remove('hidden');
        });
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            document.getElementById('settings-app').classList.add('hidden');
        });
    },

    openPage: function(pageId) { 
        document.getElementById(pageId).classList.add('active'); 
    },
    
    closePage: function(pageId) { 
        document.getElementById(pageId).classList.remove('active'); 
    },
    
    switchTab: function(tab) {
        const netTab = document.getElementById('tab-net');
        const localTab = document.getElementById('tab-local');
        const netContent = document.getElementById('content-net');
        const localContent = document.getElementById('content-local');

        if (tab === 'net') {
            netTab.classList.replace('text-gray-500', 'bg-white'); 
            netTab.classList.add('shadow-sm');
            localTab.classList.remove('bg-white', 'shadow-sm'); 
            localTab.classList.add('text-gray-500');
            netContent.classList.remove('hidden'); 
            localContent.classList.add('hidden');
        } else {
            localTab.classList.replace('text-gray-500', 'bg-white'); 
            localTab.classList.add('shadow-sm');
            netTab.classList.remove('bg-white', 'shadow-sm'); 
            netTab.classList.add('text-gray-500');
            localContent.classList.remove('hidden'); 
            netContent.classList.add('hidden');
        }
    },

    fetchModels: async function() {
        const endpoint = document.getElementById('api-endpoint').value.trim().replace(/\/$/, '');
        const key = document.getElementById('api-key').value.trim();
        if (!endpoint) return alert('请输入 API Endpoint');

        const btn = document.querySelector('button[onclick="SettingsManager.fetchModels()"]');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const models = await API.Settings.fetchModels(endpoint, key);
            const select = document.getElementById('model-select');
            select.innerHTML = '<option value="">选择模型...</option>';
            
            if (models.length > 0) {
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name || m.model);
                    if (id) {
                        const option = document.createElement('option');
                        option.value = id;
                        option.textContent = id;
                        select.appendChild(option);
                    }
                });
                select.classList.remove('hidden');
                alert('成功获取 ' + models.length + ' 个模型');
            } else {
                alert('未找到可用模型，请检查 API 配置');
            }
        } catch (e) {
            console.error('Fetch models error:', e);
            alert('拉取模型失败: ' + e.message);
        } finally {
            btn.innerHTML = originalIcon;
        }
    },

    saveApiSettings: function() {
        const config = {
            endpoint: document.getElementById('api-endpoint').value,
            key: document.getElementById('api-key').value,
            model: document.getElementById('api-model').value,
            temperature: parseFloat(document.getElementById('api-temperature').value) || 0.8
        };
        API.Settings.saveApiConfig(config);
        alert('API 配置已保存');
    },

    saveApiPreset: function() {
        const defaultName = 'Preset ' + new Date().toLocaleTimeString();
        const name = prompt('请输入预设名称:', defaultName);
        if (name === null) return;

        const config = {
            endpoint: document.getElementById('api-endpoint').value,
            key: document.getElementById('api-key').value,
            model: document.getElementById('api-model').value,
            temperature: parseFloat(document.getElementById('api-temperature').value) || 0.8,
            name: name.trim() || defaultName
        };
        let presets = API.Settings.getPresets();
        presets.push(config);
        API.Settings.savePresets(presets);
        this.renderPresets();
    },

    deletePreset: function(index) {
        if (!confirm('确定要删除这个预设吗？')) return;
        let presets = API.Settings.getPresets();
        presets.splice(index, 1);
        API.Settings.savePresets(presets);
        this.renderPresets();
    },

    updatePreset: function(index) {
        let presets = API.Settings.getPresets();
        if (!presets[index]) return;

        const currentName = presets[index].name;
        const newName = prompt('更新预设 (可修改名称):', currentName);
        if (newName === null) return; // User cancelled

        presets[index].name = newName.trim() || currentName;
        presets[index].endpoint = document.getElementById('api-endpoint').value;
        presets[index].key = document.getElementById('api-key').value;
        presets[index].model = document.getElementById('api-model').value;
        presets[index].temperature = parseFloat(document.getElementById('api-temperature').value) || 0.8;
        
        API.Settings.savePresets(presets);
        this.renderPresets();
        alert('预设已更新');
    },

    renderPresets: function() {
        const list = document.getElementById('api-presets-list');
        const presets = API.Settings.getPresets();
        list.innerHTML = '';
        
        if (presets.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-center py-2">暂无预设</p>';
            return;
        }

        presets.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-50 p-3 rounded-lg text-xs mb-2 border border-gray-100';
            const tempDisplay = p.temperature !== undefined ? p.temperature : 0.8;
            div.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-gray-700 truncate mr-2" title="${p.name}">${p.name}</span>
                    <button onclick="SettingsManager.loadPreset(${index})" class="bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition">加载</button>
                </div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 flex-1 min-w-0 mr-2">
                        <span class="text-gray-400 truncate" title="${p.model}">${p.model || 'Unknown Model'}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-orange-500 shrink-0">T:${tempDisplay}</span>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="SettingsManager.updatePreset(${index})" class="text-green-600 hover:text-green-700">更新</button>
                        <button onclick="SettingsManager.deletePreset(${index})" class="text-red-500 hover:text-red-700">删除</button>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    },

    loadPreset: function(index) {
        const presets = API.Settings.getPresets();
        const p = presets[index];
        if (p) {
            document.getElementById('api-endpoint').value = p.endpoint;
            document.getElementById('api-key').value = p.key;
            document.getElementById('api-model').value = p.model;
            // 加载温度参数
            const temp = p.temperature !== undefined ? p.temperature : 0.8;
            document.getElementById('api-temperature').value = temp;
            document.getElementById('api-temp-val').textContent = temp;
            alert('已加载预设: ' + p.name);
        }
    },

    applyFont: function() {
        const fontUrl = document.getElementById('font-url').value.trim();
        if (!fontUrl) return alert('请输入字体 URL');
        
        const oldStyle = document.getElementById('custom-font-style');
        if (oldStyle) oldStyle.remove();
        
        const fontName = 'CustomFont' + Date.now();
        const style = document.createElement('style');
        style.id = 'custom-font-style';
        style.textContent = '@font-face { font-family: "' + fontName + '"; src: url("' + fontUrl + '") format("woff2"), url("' + fontUrl + '") format("woff"), url("' + fontUrl + '") format("truetype"); font-display: swap; } body, p, span, div, input, textarea, button, h1, h2, h3, h4, h5, h6, label, a { font-family: "' + fontName + '", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; } i[class*="fa-"] { font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands" !important; }';
        document.head.appendChild(style);
        localStorage.setItem('customFont', fontUrl);
    },

    updateFontSize: function(val) {
        document.getElementById('font-size-val').textContent = val + 'px';
        document.documentElement.style.setProperty('--base-font-size', val + 'px');
        localStorage.setItem('baseFontSize', val);
    },

    setWallpaperFromUrl: function() { 
        this.applyWallpaper(document.getElementById('wallpaper-url').value); 
    },
    
    handleWallpaperUpload: function(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            const self = this;
            reader.onload = function(e) {
                self.applyWallpaper(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    },
    
    applyWallpaper: function(src) {
        if (!src) return;
        document.getElementById('home-screen').style.backgroundImage = 'url(\'' + src + '\')';
        document.getElementById('wallpaper-preview').style.backgroundImage = 'url(\'' + src + '\')';
        localStorage.setItem('wallpaper', src);
    },
    
    clearWallpaper: function() {
        document.getElementById('home-screen').style.backgroundImage = '';
        document.getElementById('wallpaper-preview').style.backgroundImage = '';
        localStorage.removeItem('wallpaper');
    },

    toggleNotch: function() {
        const show = document.getElementById('toggle-notch').checked;
        document.getElementById('notch-container').style.display = show ? 'block' : 'none';
        document.getElementById('status-bar').style.paddingTop = show ? '0' : '4px';
        localStorage.setItem('showNotch', show);
    },
    
    toggleImmersive: function() {
        const immersive = document.getElementById('toggle-immersive').checked;
        const shell = document.getElementById('phone-shell');
        if (immersive) {
            shell.classList.remove('border-[8px]', 'border-gray-800', 'rounded-[50px]', 'shadow-2xl');
            shell.style.width = '100vw'; 
            shell.style.height = '100vh';
            document.getElementById('screen-width').disabled = true;
            document.getElementById('screen-height').disabled = true;
        } else {
            shell.classList.add('border-[8px]', 'border-gray-800', 'rounded-[50px]', 'shadow-2xl');
            this.updateDimensions();
            document.getElementById('screen-width').disabled = false;
            document.getElementById('screen-height').disabled = false;
        }
        localStorage.setItem('immersive', immersive);
    },
    
    updateDimensions: function() {
        if (document.getElementById('toggle-immersive').checked) return;
        const w = document.getElementById('screen-width').value;
        const h = document.getElementById('screen-height').value;
        const shell = document.getElementById('phone-shell');
        shell.style.width = w + 'px'; 
        shell.style.height = h + 'px';
        localStorage.setItem('screenSize', JSON.stringify({ w: w, h: h }));
    },
    
    resetDimensions: function() {
        document.getElementById('screen-width').value = 375;
        document.getElementById('screen-height').value = 812;
        this.updateDimensions();
    },

    exportData: function() {
        const data = JSON.stringify(localStorage);
        const blob = new Blob([data], { type: 'application/json' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'rurichat_backup_' + new Date().toISOString().slice(0,10) + '.json';
        link.click();
        URL.revokeObjectURL(blobUrl);
    },
    
    importData: function(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                localStorage.clear();
                Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
                alert('数据导入成功，页面将刷新');
                location.reload();
            } catch (err) {
                alert('数据文件无效');
            }
        };
        reader.readAsText(file);
    },

    /**
     * 清空所有数据（localStorage + IndexedDB），然后自动刷新
     */
    clearAllData: function() {
        if (!confirm('⚠️ 确定要清空所有数据吗？\n\n这将删除所有角色、聊天记录、设置、记忆、线下数据等，且不可恢复！')) return;
        if (!confirm('再次确认：真的要清空所有数据吗？此操作不可撤销！')) return;

        try {
            // 清空 localStorage
            localStorage.clear();
            console.log('[Settings] localStorage cleared');

            // 清空 IndexedDB（线下模式壁纸等）
            const dbNames = ['ruri_offline_db'];
            dbNames.forEach(dbName => {
                try {
                    const deleteReq = indexedDB.deleteDatabase(dbName);
                    deleteReq.onsuccess = () => console.log('[Settings] IndexedDB deleted:', dbName);
                    deleteReq.onerror = (e) => console.error('[Settings] IndexedDB delete error:', dbName, e);
                } catch (e) {
                    console.error('[Settings] Error deleting IndexedDB:', dbName, e);
                }
            });

            alert('所有数据已清空，页面将自动刷新');
            location.reload();
        } catch (e) {
            console.error('[Settings] clearAllData error:', e);
            alert('清空数据时出错: ' + e.message);
        }
    },

    loadSettings: function() {
        const apiConfig = API.Settings.getApiConfig();
        if (apiConfig.endpoint) {
            document.getElementById('api-endpoint').value = apiConfig.endpoint || '';
            document.getElementById('api-key').value = apiConfig.key || '';
            document.getElementById('api-model').value = apiConfig.model || '';
        }
        // 加载温度参数
        const temp = apiConfig.temperature !== undefined ? apiConfig.temperature : 0.8;
        document.getElementById('api-temperature').value = temp;
        document.getElementById('api-temp-val').textContent = temp;
        
        this.renderPresets();

        const customFont = localStorage.getItem('customFont');
        if (customFont) {
            document.getElementById('font-url').value = customFont;
            this.applyFont();
        }
        const fontSize = localStorage.getItem('baseFontSize');
        if (fontSize) {
            document.getElementById('font-slider').value = fontSize;
            this.updateFontSize(fontSize);
        }
        
        this.renderFontPresets();

        const wallpaper = localStorage.getItem('wallpaper');
        if (wallpaper) this.applyWallpaper(wallpaper);

        const showNotch = localStorage.getItem('showNotch') !== 'false';
        document.getElementById('toggle-notch').checked = showNotch;
        this.toggleNotch();

        const immersive = localStorage.getItem('immersive') === 'true';
        document.getElementById('toggle-immersive').checked = immersive;
        if (immersive) this.toggleImmersive();

        const screenSize = JSON.parse(localStorage.getItem('screenSize') || '{}');
        if (screenSize.w) {
            document.getElementById('screen-width').value = screenSize.w;
            document.getElementById('screen-height').value = screenSize.h;
            this.updateDimensions();
        }
    },

    // Font Presets Logic
    saveFontPreset: function() {
        const url = document.getElementById('font-url').value.trim();
        if (!url) return alert('请先输入字体 URL');
        
        const name = prompt('为该字体预设命名:', 'My Font');
        if (name === null) return;
        
        const presets = JSON.parse(localStorage.getItem('fontPresets') || '[]');
        presets.push({ name: name.trim() || '未命名字体', url: url });
        localStorage.setItem('fontPresets', JSON.stringify(presets));
        
        this.renderFontPresets();
        alert('字体预设已保存');
    },

    renderFontPresets: function() {
        const list = document.getElementById('font-presets-list');
        if (!list) return;
        
        const presets = JSON.parse(localStorage.getItem('fontPresets') || '[]');
        list.innerHTML = '';

        if (presets.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-center text-[10px] py-2">暂无字体预设</p>';
            return;
        }

        presets.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-50 p-2 rounded-lg flex justify-between items-center border border-gray-100';
            div.innerHTML = `
                <div class="flex flex-col min-w-0 mr-2">
                    <span class="text-xs font-bold text-gray-700 truncate">${p.name}</span>
                    <span class="text-[9px] text-gray-400 truncate">${p.url}</span>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="SettingsManager.loadFontPreset(${index})" class="text-blue-500 text-xs font-bold hover:bg-blue-50 p-1 rounded">应用</button>
                    <button onclick="SettingsManager.deleteFontPreset(${index})" class="text-red-400 text-xs hover:text-red-600 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    loadFontPreset: function(index) {
        const presets = JSON.parse(localStorage.getItem('fontPresets') || '[]');
        const p = presets[index];
        if (p) {
            document.getElementById('font-url').value = p.url;
            this.applyFont();
        }
    },

    deleteFontPreset: function(index) {
        if (!confirm('确定删除此字体预设？')) return;
        const presets = JSON.parse(localStorage.getItem('fontPresets') || '[]');
        presets.splice(index, 1);
        localStorage.setItem('fontPresets', JSON.stringify(presets));
        this.renderFontPresets();
    }
};
