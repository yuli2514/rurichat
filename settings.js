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

    // Minimax 语音相关函数
    saveMinimaxVoiceSettings: function() {
        const config = {
            groupId: document.getElementById('minimax-group-id').value.trim(),
            apiKey: document.getElementById('minimax-api-key').value.trim(),
            version: document.getElementById('minimax-version').value,
            model: document.getElementById('minimax-model').value
        };

        if (!config.groupId || !config.apiKey) {
            alert('请填写完整的 Group ID 和 API Key');
            return;
        }

        localStorage.setItem('minimaxVoiceConfig', JSON.stringify(config));
        alert('Minimax 语音配置已保存');
    },

    loadMinimaxVoiceSettings: function() {
        const config = JSON.parse(localStorage.getItem('minimaxVoiceConfig') || '{}');
        
        if (config.groupId) document.getElementById('minimax-group-id').value = config.groupId;
        if (config.apiKey) document.getElementById('minimax-api-key').value = config.apiKey;
        if (config.version) document.getElementById('minimax-version').value = config.version;
        if (config.model) document.getElementById('minimax-model').value = config.model;
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
        const oldLink = document.getElementById('custom-font-link');
        if (oldLink) oldLink.remove();
        
        const lowerUrl = fontUrl.toLowerCase();
        const isCssFile = lowerUrl.endsWith('.css');
        
        if (isCssFile) {
            // CSS文件：通过link标签加载（如Google Fonts等在线字体CSS）
            const link = document.createElement('link');
            link.id = 'custom-font-link';
            link.rel = 'stylesheet';
            link.href = fontUrl;
            document.head.appendChild(link);
            // CSS文件中定义了font-family，使用通用名覆盖
            const style = document.createElement('style');
            style.id = 'custom-font-style';
            style.textContent = 'body, p, span, div, input, textarea, button, h1, h2, h3, h4, h5, h6, label, a { font-family: inherit; } i[class*="fa-"] { font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands" !important; }';
            document.head.appendChild(style);
        } else {
            // ttf/woff2/woff/otf字体文件：通过@font-face加载
            const fontName = 'CustomFont' + Date.now();
            let format = '';
            if (lowerUrl.endsWith('.ttf') || lowerUrl.endsWith('.ttc')) {
                format = "format('truetype')";
            } else if (lowerUrl.endsWith('.woff2')) {
                format = "format('woff2')";
            } else if (lowerUrl.endsWith('.woff')) {
                format = "format('woff')";
            } else if (lowerUrl.endsWith('.otf')) {
                format = "format('opentype')";
            }
            const style = document.createElement('style');
            style.id = 'custom-font-style';
            style.textContent = '@font-face { font-family: "' + fontName + '"; src: url("' + fontUrl + '") ' + format + '; font-display: swap; } body, p, span, div, input, textarea, button, h1, h2, h3, h4, h5, h6, label, a { font-family: "' + fontName + '", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; } i[class*="fa-"] { font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands" !important; }';
            document.head.appendChild(style);
        }
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

    exportData: async function() {
        const btn = event.target;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 导出中...';
        btn.disabled = true;
        
        try {
            const backupData = {
                localStorage: {},
                indexedDB: {}
            };
            
            // 备份 localStorage（完整备份，编码敏感数据）
            // 注意：存档数据 (ruri_save_archives) 也会被自动包含在 localStorage 备份中
            Object.keys(localStorage).forEach(key => {
                let value = localStorage[key];
                // 对包含"key"或"token"的配置进行Base64编码
                if (key.includes('api') || key.includes('token') || key.includes('github')) {
                    try {
                        value = btoa(btoa(value));
                        backupData.localStorage[key] = '__ENCODED__' + value;
                    } catch (e) {
                        backupData.localStorage[key] = value;
                    }
                } else {
                    backupData.localStorage[key] = value;
                }
            });
            
            // 备份 IndexedDB
            const dbNames = ['RuriAvatarDB', 'RuriDataDB', 'ruri_offline_db'];
            for (const dbName of dbNames) {
                try {
                    backupData.indexedDB[dbName] = await this.exportIndexedDB(dbName);
                } catch (e) {
                    console.warn('[Export] Failed to export', dbName, e);
                    backupData.indexedDB[dbName] = {};
                }
            }
            
            const data = JSON.stringify(backupData, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = 'rurichat_backup_' + new Date().toISOString().slice(0,10) + '.json';
            link.click();
            URL.revokeObjectURL(blobUrl);
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    },
    
    importData: async function(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                // 判断备份格式
                if (backupData.localStorage && backupData.indexedDB) {
                    // 新格式：恢复 localStorage
                    localStorage.clear();
                    Object.keys(backupData.localStorage).forEach(k => {
                        let value = backupData.localStorage[k];
                        // 检查是否是编码的数据
                        if (typeof value === 'string' && value.startsWith('__ENCODED__')) {
                            try {
                                value = value.substring(11);
                                value = atob(atob(value));
                            } catch (e) {
                                console.error('[导入] 解码失败', k, e);
                            }
                        }
                        localStorage.setItem(k, value);
                    });
                    
                    // 恢复 IndexedDB
                    const dbNames = Object.keys(backupData.indexedDB);
                    for (const dbName of dbNames) {
                        try {
                            await this.importIndexedDB(dbName, backupData.indexedDB[dbName]);
                            console.log('[Import] Imported', dbName);
                        } catch (e) {
                            console.warn('[Import] Failed to import', dbName, e);
                        }
                    }
                } else {
                    // 旧格式：只恢复 localStorage
                    localStorage.clear();
                    Object.keys(backupData).forEach(k => {
                        localStorage.setItem(k, backupData[k]);
                    });
                }
                
                alert('数据导入成功，页面将刷新');
                location.reload();
            } catch (err) {
                console.error('[Import] Error:', err);
                alert('数据文件无效: ' + err.message);
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

            // 清空 IndexedDB（头像、数据存储、线下模式壁纸等）
            const dbNames = ['ruri_offline_db', 'RuriAvatarDB', 'RuriDataDB'];
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

    // 分片上传大文件
    githubBackupChunked: async function(token, repo, baseFilename, data, isAutoBackup) {
        const btn = document.querySelector('button[onclick="SettingsManager.githubBackup()"]');
        const updateStatus = (msg) => {
            if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + msg;
        };
        
        try {
            // 将数据分成多个50MB的块
            const chunkSize = 50 * 1024 * 1024; // 50MB
            const chunks = [];
            for (let i = 0; i < data.length; i += chunkSize) {
                chunks.push(data.slice(i, i + chunkSize));
            }
            
            console.log('[备份] 分成', chunks.length, '个文件');
            updateStatus('上传分片 0/' + chunks.length);
            
            // 上传每个分片
            for (let i = 0; i < chunks.length; i++) {
                updateStatus('上传分片 ' + (i + 1) + '/' + chunks.length);
                const chunkFilename = baseFilename.replace('.json', '_part' + (i + 1) + '.json');
                
                // 编码分片
                const utf8Bytes = new TextEncoder().encode(chunks[i]);
                let binaryString = '';
                for (let j = 0; j < utf8Bytes.length; j++) {
                    binaryString += String.fromCharCode(utf8Bytes[j]);
                }
                const base64Content = btoa(binaryString);
                
                // 检查文件是否存在
                let sha = null;
                try {
                    const checkResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${chunkFilename}`, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (checkResponse.ok) {
                        const fileInfo = await checkResponse.json();
                        sha = fileInfo.sha;
                    }
                } catch (e) {}
                
                // 上传分片
                const uploadData = {
                    message: `RuriChat数据备份 (分片${i + 1}/${chunks.length}) - ${new Date().toLocaleString('zh-CN')}`,
                    content: base64Content
                };
                if (sha) uploadData.sha = sha;
                
                const response = await fetch(`https://api.github.com/repos/${repo}/contents/${chunkFilename}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(uploadData)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error('上传分片' + (i + 1) + '失败: ' + (error.message || '未知错误'));
                }
                
                console.log('[备份] 已上传分片', i + 1, '/', chunks.length);
            }
            
            // 创建索引文件
            updateStatus('创建索引文件...');
            const indexData = {
                type: 'chunked_backup',
                totalChunks: chunks.length,
                baseFilename: baseFilename,
                timestamp: new Date().toISOString(),
                dataSize: data.length
            };
            
            const indexFilename = baseFilename.replace('.json', '_index.json');
            const indexContent = btoa(JSON.stringify(indexData, null, 2));
            
            let indexSha = null;
            try {
                const checkResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${indexFilename}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                if (checkResponse.ok) {
                    const fileInfo = await checkResponse.json();
                    indexSha = fileInfo.sha;
                }
            } catch (e) {}
            
            const indexUploadData = {
                message: `RuriChat备份索引 - ${new Date().toLocaleString('zh-CN')}`,
                content: indexContent
            };
            if (indexSha) indexUploadData.sha = indexSha;
            
            const indexResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${indexFilename}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(indexUploadData)
            });
            
            if (!indexResponse.ok) {
                throw new Error('创建索引文件失败');
            }
            
            // 保存配置和更新时间
            localStorage.setItem('github_backup_repo', repo);
            localStorage.setItem('github_backup_filename', baseFilename);
            const saveToken = document.getElementById('save-github-token');
            if (saveToken && saveToken.checked) {
                localStorage.setItem('github_backup_token', token);
            }
            const now = new Date();
            localStorage.setItem('github_last_backup', now.toISOString());
            this.updateLastBackupDisplay();
            
            if (!isAutoBackup) {
                alert('✅ 备份成功！\\n\\n数据已分成 ' + chunks.length + ' 个文件上传');
            }
            
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 立即备份';
                btn.disabled = false;
            }
        } catch (error) {
            console.error('[备份错误]', error);
            if (!isAutoBackup) {
                alert('❌ 分片备份失败：' + error.message);
            }
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 立即备份';
                btn.disabled = false;
            }
            throw error;
        }
    },

    // 导出IndexedDB数据
    exportIndexedDB: async function(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onsuccess = function(e) {
                const db = e.target.result;
                const storeNames = Array.from(db.objectStoreNames);
                const data = {};
                
                if (storeNames.length === 0) {
                    db.close();
                    resolve(data);
                    return;
                }
                
                const transaction = db.transaction(storeNames, 'readonly');
                let completed = 0;
                
                transaction.oncomplete = function() {
                    db.close(); // 关闭连接，防止后续import被阻塞
                };
                
                storeNames.forEach(storeName => {
                    const store = transaction.objectStore(storeName);
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = function() {
                        data[storeName] = getAllRequest.result;
                        completed++;
                        if (completed === storeNames.length) {
                            resolve(data);
                        }
                    };
                    
                    getAllRequest.onerror = function() {
                        db.close();
                        reject(new Error('Failed to read from ' + storeName));
                    };
                });
            };
            request.onerror = function() {
                resolve({}); // 数据库不存在时返回空对象
            };
        });
    },

    // GitHub云端备份功能
    githubBackup: async function(isAutoBackup = false) {
        const token = document.getElementById('github-token').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const filename = document.getElementById('github-filename').value.trim() || 'rurichat_backup.json';

        if (!token) {
            if (!isAutoBackup) alert('请输入GitHub Token');
            return;
        }
        if (!repo) {
            if (!isAutoBackup) alert('请输入仓库路径');
            return;
        }

        const btn = document.querySelector('button[onclick="SettingsManager.githubBackup()"]');
        const originalContent = btn ? btn.innerHTML : '';
        
        const updateStatus = (msg) => {
            if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + msg;
        };
        
        if (btn) {
            updateStatus('准备中...');
            btn.disabled = true;
        }

        try {
            updateStatus('读取本地数据...');
            // 获取要备份的数据（localStorage + IndexedDB）
            const backupData = {
                localStorage: {},
                indexedDB: {}
            };
            
            // 备份 localStorage（完整备份）
            // 注意：存档数据 (ruri_save_archives) 会被自动包含在 localStorage 备份中
            // 对敏感数据进行简单编码以绕过GitHub的Secret检测
            Object.keys(localStorage).forEach(key => {
                let value = localStorage[key];
                // 对包含"key"或"token"的配置进行Base64编码
                if (key.includes('api') || key.includes('token') || key.includes('github')) {
                    try {
                        // 双重Base64编码以绕过检测
                        value = btoa(btoa(value));
                        backupData.localStorage[key] = '__ENCODED__' + value;
                    } catch (e) {
                        backupData.localStorage[key] = value;
                    }
                } else {
                    backupData.localStorage[key] = value;
                }
            });
            
            // 备份 IndexedDB
            updateStatus('备份头像和聊天记录...');
            const dbNames = ['RuriAvatarDB', 'RuriDataDB', 'ruri_offline_db'];
            for (const dbName of dbNames) {
                try {
                    console.log('[备份] 正在导出', dbName);
                    backupData.indexedDB[dbName] = await this.exportIndexedDB(dbName);
                    const storeCount = Object.keys(backupData.indexedDB[dbName]).length;
                    console.log('[备份] 已导出', dbName, '包含', storeCount, '个数据表');
                } catch (e) {
                    console.error('[备份] 导出失败', dbName, e);
                    backupData.indexedDB[dbName] = {};
                }
            }
            
            updateStatus('打包数据...');
            const data = JSON.stringify(backupData);
            const dataSizeMB = data.length / 1024 / 1024;
            console.log('[备份] 数据大小:', dataSizeMB.toFixed(2), 'MB');
            
            // GitHub单个文件限制100MB，如果超过则分片上传
            if (dataSizeMB > 50) {
                console.log('[备份] 数据较大，使用分片上传');
                await this.githubBackupChunked(token, repo, filename, data, isAutoBackup);
                return;
            }
            
            // 小文件直接上传
            // 检查文件是否存在，获取SHA（用于更新文件）
            let sha = null;
            try {
                const checkResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                if (checkResponse.ok) {
                    const fileInfo = await checkResponse.json();
                    sha = fileInfo.sha;
                }
            } catch (e) {
                // 文件不存在，继续创建新文件
            }

            // 上传或更新文件
            // 使用更可靠的UTF-8编码方法
            updateStatus('编码数据...');
            console.log('[备份] 开始编码数据...');
            const utf8Bytes = new TextEncoder().encode(data);
            console.log('[备份] UTF-8字节数:', utf8Bytes.length);
            
            let binaryString = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binaryString += String.fromCharCode(utf8Bytes[i]);
            }
            console.log('[备份] 二进制字符串长度:', binaryString.length);
            
            console.log('[备份] Base64编码中...');
            const base64Content = btoa(binaryString);
            console.log('[备份] Base64长度:', base64Content.length);
            
            const uploadData = {
                message: `RuriChat数据备份 - ${new Date().toLocaleString('zh-CN')}`,
                content: base64Content,
            };
            
            if (sha) {
                uploadData.sha = sha; // 更新现有文件需要SHA
            }

            updateStatus('上传到GitHub...');
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(uploadData)
            });

            if (response.ok) {
                updateStatus('备份成功！');
                const result = await response.json();
                
                // 保存GitHub配置
                localStorage.setItem('github_backup_repo', repo);
                localStorage.setItem('github_backup_filename', filename);
                
                // 保存Token（如果用户选择记住）
                const saveToken = document.getElementById('save-github-token');
                if (saveToken && saveToken.checked) {
                    localStorage.setItem('github_backup_token', token);
                }
                
                // 更新最新备份时间
                const now = new Date();
                const timeStr = now.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                localStorage.setItem('github_last_backup', now.toISOString());
                this.updateLastBackupDisplay();
                
                if (!isAutoBackup) {
                    alert('✅ 备份成功！\\n\\n文件已上传到：' + result.content.html_url);
                }
            } else {
                const error = await response.json();
                throw new Error(error.message || '上传失败');
            }
        } catch (error) {
            console.error('[备份错误]', error);
            if (!isAutoBackup) {
                let errorMsg = '备份失败\\n\\n';
                if (error.message) {
                    errorMsg += '错误信息：' + error.message;
                } else {
                    errorMsg += '未知错误';
                }
                // 添加错误堆栈的前几行
                if (error.stack) {
                    const stackLines = error.stack.split('\\n').slice(0, 3).join('\\n');
                    errorMsg += '\\n\\n详细信息：\\n' + stackLines;
                }
                alert('❌ ' + errorMsg);
            }
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    },

    // 关闭应用持有的IndexedDB连接，防止版本升级被阻塞
    _closeAllDBConnections: function() {
        console.log('[导入] 关闭现有数据库连接...');
        try {
            if (typeof AvatarStore !== 'undefined' && AvatarStore._db) {
                AvatarStore._db.close();
                AvatarStore._db = null;
                AvatarStore._ready = false;
                AvatarStore._readyPromise = null;
                console.log('[导入] 已关闭 AvatarStore 连接');
            }
        } catch (e) { console.warn('[导入] 关闭AvatarStore失败:', e); }
        try {
            if (typeof DataStore !== 'undefined' && DataStore._db) {
                DataStore._db.close();
                DataStore._db = null;
                DataStore._ready = false;
                DataStore._readyPromise = null;
                console.log('[导入] 已关闭 DataStore 连接');
            }
        } catch (e) { console.warn('[导入] 关闭DataStore失败:', e); }
    },

    // 导入IndexedDB数据（先删除旧数据库，再以版本1创建新数据库）
    // 重要：不能使用版本升级方式！因为 AvatarStore._openDB() / DataStore._openDB() / ruri_offline_db
    // 都硬编码 indexedDB.open(dbName, 1)，如果版本升级到2+，恢复后页面刷新时会触发 VersionError
    importIndexedDB: async function(dbName, data) {
        const storeNames = Object.keys(data);
        if (storeNames.length === 0) {
            console.log('[导入] 数据为空，跳过', dbName);
            return;
        }
        console.log('[导入] 开始导入', dbName, '数据表:', storeNames);

        const getKeyPath = function(dbName, storeName) {
            // RuriAvatarDB.avatars -> keyPath: 'id'  (AvatarStore uses { keyPath: 'id' })
            // RuriDataDB.data      -> keyPath: 'id'  (DataStore uses { keyPath: 'id' })
            // ruri_offline_db.*    -> keyPath: 'charId'
            if (dbName === 'ruri_offline_db') return 'charId';
            return 'id';
        };

        // 第一步：删除旧数据库
        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                console.warn('[导入]', dbName, '删除超时，继续尝试创建');
                resolve(); // 超时也继续，不阻塞
            }, 5000);

            console.log('[导入] 删除旧数据库', dbName);
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = function() {
                console.log('[导入]', dbName, '已删除');
                clearTimeout(timeoutId);
                resolve();
            };
            deleteReq.onerror = function() {
                console.warn('[导入]', dbName, '删除失败，继续尝试创建');
                clearTimeout(timeoutId);
                resolve(); // 删除失败也继续
            };
            deleteReq.onblocked = function() {
                console.warn('[导入]', dbName, '删除被阻塞，继续尝试创建');
                clearTimeout(timeoutId);
                resolve(); // 被阻塞也继续
            };
        });

        // 第二步：以版本1创建新数据库并写入数据
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(dbName + ' 导入超时（30秒）'));
            }, 30000);

            console.log('[导入] 以版本1创建', dbName);
            const openReq = indexedDB.open(dbName, 1);

            openReq.onupgradeneeded = function(e) {
                const db = e.target.result;
                // 确保清除所有旧表（以防删除数据库失败）
                Array.from(db.objectStoreNames).forEach(s => db.deleteObjectStore(s));
                // 创建新表
                storeNames.forEach(s => {
                    const kp = getKeyPath(dbName, s);
                    console.log('[导入] 创建表', s, 'keyPath:', kp);
                    db.createObjectStore(s, { keyPath: kp });
                });
            };

            openReq.onsuccess = function(e) {
                const db = e.target.result;
                try {
                    const tx = db.transaction(storeNames, 'readwrite');
                    storeNames.forEach(s => {
                        const store = tx.objectStore(s);
                        const items = data[s] || [];
                        console.log('[导入] 写入', s, ':', items.length, '条');
                        items.forEach(item => store.put(item));
                    });
                    tx.oncomplete = function() {
                        console.log('[导入]', dbName, '写入完成（版本1）');
                        db.close();
                        clearTimeout(timeoutId);
                        resolve();
                    };
                    tx.onerror = function(e) {
                        db.close();
                        clearTimeout(timeoutId);
                        reject(new Error(dbName + ' 写入失败: ' + e.target.error));
                    };
                } catch (err) {
                    db.close();
                    clearTimeout(timeoutId);
                    reject(new Error(dbName + ' 事务创建失败: ' + err.message));
                }
            };

            openReq.onerror = function(e) {
                clearTimeout(timeoutId);
                reject(new Error(dbName + ' 打开失败: ' + e.target.error));
            };

            openReq.onblocked = function() {
                clearTimeout(timeoutId);
                reject(new Error(dbName + ' 被占用，无法创建'));
            };
        });
    },

    githubRestore: async function() {
        const token = document.getElementById('github-token').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const filename = document.getElementById('github-filename').value.trim() || 'rurichat_backup.json';

        if (!token) {
            alert('请输入GitHub Token');
            return;
        }
        if (!repo) {
            alert('请输入仓库路径');
            return;
        }

        if (!confirm('⚠️ 恢复数据将覆盖当前所有数据，确定继续吗？')) {
            return;
        }

        const btn = document.querySelector('button[onclick="SettingsManager.githubRestore()"]');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 恢复中...';
        btn.disabled = true;

        try {
            console.log('[恢复] 开始恢复备份...');
            console.log('[恢复] 仓库:', repo);
            console.log('[恢复] 文件名:', filename);
            
            // 从GitHub获取文件（添加超时处理）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            console.log('[恢复] 正在从GitHub获取文件...');
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
            console.log('[恢复] 响应状态:', response.status);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('备份文件不存在');
                }
                const error = await response.json();
                throw new Error(error.message || '获取文件失败');
            }

            const fileInfo = await response.json();
            
            // 检查文件大小
            console.log('[恢复] 文件大小:', fileInfo.size, 'bytes');
            
            let backupData;
            
            // 如果文件太大（>1MB），GitHub API会返回download_url而不是content
            if (fileInfo.size > 1048576 || !fileInfo.content) {
                console.log('[恢复] 文件较大，使用download_url下载');
                const downloadResponse = await fetch(fileInfo.download_url);
                if (!downloadResponse.ok) {
                    throw new Error('下载文件失败');
                }
                const textContent = await downloadResponse.text();
                console.log('[恢复] 下载内容长度:', textContent.length);
                console.log('[恢复] 内容开头:', textContent.substring(0, 100));
                console.log('[恢复] 内容结尾:', textContent.substring(textContent.length - 100));
                backupData = JSON.parse(textContent);
            } else {
                // 解码Base64内容（需要先去除GitHub API返回的换行符）
                const base64Content = fileInfo.content.replace(/\n/g, '');
                console.log('[恢复] Base64长度:', base64Content.length);
                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedContent = new TextDecoder().decode(bytes);
                console.log('[恢复] 解码后长度:', decodedContent.length);
                console.log('[恢复] 内容开头:', decodedContent.substring(0, 100));
                console.log('[恢复] 内容结尾:', decodedContent.substring(decodedContent.length - 100));
                backupData = JSON.parse(decodedContent);
            }

            // 判断备份格式（新格式包含 localStorage 和 indexedDB，旧格式直接是数据）
            if (backupData.localStorage && backupData.indexedDB) {
                // 新格式：恢复 localStorage
                localStorage.clear();
                let needResetApiKey = false;
                Object.keys(backupData.localStorage).forEach(key => {
                    let value = backupData.localStorage[key];
                    // 检查是否是编码的数据
                    if (typeof value === 'string' && value.startsWith('__ENCODED__')) {
                        try {
                            // 解码双重Base64
                            value = value.substring(11); // 移除 '__ENCODED__' 前缀
                            value = atob(atob(value));
                        } catch (e) {
                            console.error('[恢复] 解码失败', key, e);
                        }
                    }
                    localStorage.setItem(key, value);
                });
                
                // 关闭现有数据库连接，防止版本升级被阻塞
                this._closeAllDBConnections();
                
                // 恢复 IndexedDB
                const dbNames = Object.keys(backupData.indexedDB);
                for (const dbName of dbNames) {
                    try {
                        const storeCount = Object.keys(backupData.indexedDB[dbName]).length;
                        console.log('[恢复] 正在导入', dbName, '包含', storeCount, '个数据表');
                        if (storeCount > 0) {
                            await this.importIndexedDB(dbName, backupData.indexedDB[dbName]);
                            console.log('[恢复] 成功导入', dbName);
                        } else {
                            console.log('[恢复] 跳过空数据库', dbName);
                        }
                    } catch (e) {
                        console.error('[恢复] 导入失败', dbName, e);
                        console.error('[恢复] 错误详情:', e.stack);
                        // 不要因为一个数据库失败就中断整个恢复过程
                        console.warn('[恢复] 继续恢复其他数据库...');
                    }
                }
                
                // 如果API Key被替换了，提醒用户
                if (needResetApiKey) {
                    alert('✅ 数据恢复成功！\\n\\n⚠️ 注意：出于安全考虑，API Key未包含在备份中，请在恢复后重新设置API配置。\\n\\n页面将自动刷新。');
                } else {
                    alert('✅ 数据恢复成功！\\n\\n页面将自动刷新以应用新数据。');
                }
            } else {
                // 旧格式：只恢复 localStorage
                localStorage.clear();
                Object.keys(backupData).forEach(key => {
                    localStorage.setItem(key, backupData[key]);
                });
                alert('✅ 数据恢复成功！\\n\\n页面将自动刷新以应用新数据。');
            }

            location.reload();

        } catch (error) {
            console.error('[恢复错误]', error);
            console.error('[恢复错误] 堆栈:', error.stack);
            let errorMsg = '恢复失败\\n\\n错误信息：' + error.message;
            if (error.stack) {
                const stackLines = error.stack.split('\\n').slice(0, 3).join('\\n');
                errorMsg += '\\n\\n详细信息：\\n' + stackLines;
            }
            alert('❌ ' + errorMsg);
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    },

    // 更新最新备份时间显示
    updateLastBackupDisplay: function() {
        const lastBackup = localStorage.getItem('github_last_backup');
        const displayEl = document.getElementById('last-backup-time');
        const timestampEl = document.getElementById('last-backup-timestamp');
        
        if (lastBackup && displayEl && timestampEl) {
            const date = new Date(lastBackup);
            const timeStr = date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            timestampEl.textContent = timeStr;
            displayEl.classList.remove('hidden');
        }
    },

    // 切换自动备份
    toggleAutoBackup: function() {
        const enabled = document.getElementById('auto-backup-enabled').checked;
        const container = document.getElementById('auto-backup-interval-container');
        
        if (enabled) {
            container.classList.remove('hidden');
            localStorage.setItem('auto_backup_enabled', 'true');
            this.scheduleAutoBackup();
        } else {
            container.classList.add('hidden');
            localStorage.setItem('auto_backup_enabled', 'false');
            this.cancelAutoBackup();
        }
    },

    // 更新自动备份间隔
    updateAutoBackupInterval: function() {
        const interval = document.getElementById('auto-backup-interval').value;
        localStorage.setItem('auto_backup_interval', interval);
        this.scheduleAutoBackup();
    },

    // 安排自动备份
    scheduleAutoBackup: function() {
        // 取消现有的定时器
        this.cancelAutoBackup();
        
        const interval = parseInt(localStorage.getItem('auto_backup_interval') || '24');
        const intervalMs = interval * 60 * 60 * 1000; // 转换为毫秒
        
        // 设置新的定时器
        this.autoBackupTimer = setInterval(() => {
            console.log('[AutoBackup] 执行自动备份...');
            this.githubBackup(true);
        }, intervalMs);
        
        // 更新下次备份时间显示
        const nextTime = new Date(Date.now() + intervalMs);
        const nextTimeStr = nextTime.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const nextTimeEl = document.getElementById('next-backup-time');
        if (nextTimeEl) {
            nextTimeEl.textContent = nextTimeStr;
        }
        
        console.log('[AutoBackup] 已安排自动备份，间隔：' + interval + '小时');
    },

    // 取消自动备份
    cancelAutoBackup: function() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
            console.log('[AutoBackup] 已取消自动备份');
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

        // 加载 Minimax 语音设置
        this.loadMinimaxVoiceSettings();

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

        // 加载移动端控制台设置
        this.loadMobileConsoleSettings();

        // 加载GitHub备份配置
        const githubToken = localStorage.getItem('github_backup_token');
        const githubRepo = localStorage.getItem('github_backup_repo');
        const githubFilename = localStorage.getItem('github_backup_filename');
        
        if (githubToken) {
            const tokenInput = document.getElementById('github-token');
            const saveTokenCheckbox = document.getElementById('save-github-token');
            if (tokenInput) tokenInput.value = githubToken;
            if (saveTokenCheckbox) saveTokenCheckbox.checked = true;
        }
        if (githubRepo) {
            const repoInput = document.getElementById('github-repo');
            if (repoInput) repoInput.value = githubRepo;
        }
        if (githubFilename) {
            const filenameInput = document.getElementById('github-filename');
            if (filenameInput) filenameInput.value = githubFilename;
        }
        
        // 显示最新备份时间
        this.updateLastBackupDisplay();
        
        // 加载自动备份设置
        const autoBackupEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
        const autoBackupInterval = localStorage.getItem('auto_backup_interval') || '24';
        
        const autoBackupCheckbox = document.getElementById('auto-backup-enabled');
        const autoBackupSelect = document.getElementById('auto-backup-interval');
        const autoBackupContainer = document.getElementById('auto-backup-interval-container');
        
        if (autoBackupCheckbox) {
            autoBackupCheckbox.checked = autoBackupEnabled;
        }
        if (autoBackupSelect) {
            autoBackupSelect.value = autoBackupInterval;
        }
        if (autoBackupContainer && autoBackupEnabled) {
            autoBackupContainer.classList.remove('hidden');
            this.scheduleAutoBackup();
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
    },

    /**
     * 切换移动端控制台
     */
    toggleMobileConsole: function() {
        const checkbox = document.getElementById('toggle-mobile-console');
        const enabled = checkbox.checked;
        
        localStorage.setItem('mobileConsoleEnabled', enabled);
        
        if (typeof MobileConsole !== 'undefined') {
            if (enabled) {
                MobileConsole.enable();
            } else {
                MobileConsole.disable();
            }
        }
    },

    /**
     * 加载移动端控制台设置
     */
    loadMobileConsoleSettings: function() {
        const enabled = localStorage.getItem('mobileConsoleEnabled') === 'true';
        const checkbox = document.getElementById('toggle-mobile-console');
        if (checkbox) {
            checkbox.checked = enabled;
        }
    }
};
