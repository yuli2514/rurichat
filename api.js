/**
 * api.js
 * 负责所有涉及联网请求、API 调用、处理聊天数据的逻辑
 */

/**
 * AvatarStore - 头像存储在 IndexedDB，内存缓存同步读取
 * 解决 localStorage 5MB 限制导致的"存储数据已损坏"问题
 */
const AvatarStore = {
    _db: null,
    _cache: {},       // 内存缓存: { charId: base64String }
    _ready: false,
    _readyPromise: null,
    DB_NAME: 'RuriAvatarDB',
    STORE_NAME: 'avatars',

    /** 打开 IndexedDB */
    _openDB: function() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    /** 初始化：打开DB + 预加载所有头像到内存 */
    init: async function() {
        if (this._readyPromise) return this._readyPromise;
        this._readyPromise = this._doInit();
        return this._readyPromise;
    },

    _doInit: async function() {
        try {
            this._db = await this._openDB();
            // 预加载所有头像到内存缓存
            const all = await this._getAllFromDB();
            all.forEach(item => {
                this._cache[item.id] = item.data;
            });
            this._ready = true;
            console.log('[AvatarStore] Ready, cached ' + Object.keys(this._cache).length + ' avatars');
        } catch (e) {
            console.error('[AvatarStore] Init failed:', e);
            this._ready = true; // 即使失败也标记ready，降级到无头像模式
        }
    },

    /** 从 DB 读取所有记录 */
    _getAllFromDB: function() {
        return new Promise((resolve, reject) => {
            if (!this._db) return resolve([]);
            const tx = this._db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },

    /** 同步获取头像（从内存缓存） */
    get: function(charId) {
        return this._cache[charId] || null;
    },

    /** 异步保存头像到 IndexedDB + 更新内存缓存 */
    set: async function(charId, base64Data) {
        this._cache[charId] = base64Data;
        if (!this._db) return;
        try {
            const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.put({ id: charId, data: base64Data });
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.error('[AvatarStore] Failed to save avatar for', charId, e);
        }
    },

    /** 异步删除头像 */
    remove: async function(charId) {
        delete this._cache[charId];
        if (!this._db) return;
        try {
            const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.delete(charId);
        } catch (e) {
            console.error('[AvatarStore] Failed to remove avatar for', charId, e);
        }
    },

    /**
     * 一次性迁移：从 localStorage 的 ruri_chars 中剥离 base64 头像
     * 转存到 IndexedDB，localStorage 中只保留 'idb' 标记
     */
    migrateFromLocalStorage: async function() {
        const MIGRATION_KEY = 'ruri_avatar_migrated_v2';
        if (localStorage.getItem(MIGRATION_KEY)) return;

        console.log('[AvatarStore] Starting avatar migration from localStorage...');
        try {
            const raw = localStorage.getItem('ruri_chars');
            if (!raw) {
                localStorage.setItem(MIGRATION_KEY, 'true');
                return;
            }

            let chars;
            try {
                chars = JSON.parse(raw);
            } catch (e) {
                console.error('[AvatarStore] ruri_chars JSON parse failed, cannot migrate:', e);
                localStorage.setItem(MIGRATION_KEY, 'true');
                return;
            }

            if (!Array.isArray(chars)) {
                localStorage.setItem(MIGRATION_KEY, 'true');
                return;
            }

            let migrated = 0;
            let totalSaved = 0;

            for (const char of chars) {
                if (!char || !char.id) continue;
                // 检测 base64 头像（data:image 开头且长度超过 500 字符）
                if (char.avatar && typeof char.avatar === 'string' &&
                    char.avatar.startsWith('data:') && char.avatar.length > 500) {
                    // 存入 IndexedDB
                    await this.set(char.id, char.avatar);
                    totalSaved += char.avatar.length;
                    // 替换为标记
                    char.avatar = 'idb';
                    migrated++;
                }
            }

            // 瘦身后重新保存到 localStorage
            const slimJSON = JSON.stringify(chars);
            localStorage.setItem('ruri_chars', slimJSON);
            localStorage.setItem(MIGRATION_KEY, 'true');

            console.log('[AvatarStore] Migration done: ' + migrated + ' avatars moved to IndexedDB, saved ~' + Math.round(totalSaved / 1024) + 'KB from localStorage');
        } catch (e) {
            console.error('[AvatarStore] Migration failed:', e);
            // 迁移失败也标记完成，避免反复尝试
            localStorage.setItem(MIGRATION_KEY, 'true');
        }
    }
};

/**
 * DataStore - 通用数据存储在 IndexedDB，内存缓存同步读取
 * 解决 localStorage 5MB 限制导致聊天记录/总结等数据无法保存的问题
 * 设计模式与 AvatarStore 一致：启动时预加载到内存，读取同步，写入异步
 */
const DataStore = {
    _db: null,
    _cache: {},       // 内存缓存: { key: value }
    _ready: false,
    _readyPromise: null,
    _dirty: {},       // 标记哪些 key 需要写入
    _saveTimer: null,
    DB_NAME: 'RuriDataDB',
    STORE_NAME: 'data',

    /** 打开 IndexedDB */
    _openDB: function() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    /** 初始化：打开DB + 预加载所有数据到内存 */
    init: async function() {
        if (this._readyPromise) return this._readyPromise;
        this._readyPromise = this._doInit();
        return this._readyPromise;
    },

    _doInit: async function() {
        try {
            this._db = await this._openDB();
            const all = await this._getAllFromDB();
            all.forEach(item => {
                this._cache[item.id] = item.data;
            });
            this._ready = true;
            console.log('[DataStore] Ready, cached ' + Object.keys(this._cache).length + ' entries');
        } catch (e) {
            console.error('[DataStore] Init failed:', e);
            this._ready = true;
        }
    },

    /** 从 DB 读取所有记录 */
    _getAllFromDB: function() {
        return new Promise((resolve, reject) => {
            if (!this._db) return resolve([]);
            const tx = this._db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },

    /** 同步获取数据（从内存缓存） */
    get: function(key) {
        return this._cache.hasOwnProperty(key) ? this._cache[key] : null;
    },

    /** 同步设置数据（更新内存缓存 + 标记脏数据延迟写入） */
    set: function(key, value) {
        this._cache[key] = value;
        this._dirty[key] = true;
        if (!this._saveTimer) {
            this._saveTimer = setTimeout(() => this._flush(), 150);
        }
    },

    /** 同步删除数据 */
    remove: function(key) {
        delete this._cache[key];
        delete this._dirty[key];
        if (!this._db) return;
        try {
            const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.delete(key);
        } catch (e) {
            console.error('[DataStore] Failed to remove:', key, e);
        }
    },

    /** 将脏数据批量写入 IndexedDB */
    _flush: function() {
        this._saveTimer = null;
        if (!this._db) return;
        const dirtyKeys = Object.keys(this._dirty);
        if (dirtyKeys.length === 0) return;
        try {
            const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            dirtyKeys.forEach(key => {
                if (this._cache.hasOwnProperty(key)) {
                    store.put({ id: key, data: this._cache[key] });
                }
            });
            this._dirty = {};
        } catch (e) {
            console.error('[DataStore] Flush failed:', e);
        }
    },

    /** 立即刷入（用于页面关闭前） */
    flushSync: function() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._flush();
    },

    /**
     * 一次性迁移：从 localStorage 迁移数据到 IndexedDB
     * 迁移后删除 localStorage 中的旧数据以释放空间
     */
    migrateFromLocalStorage: async function() {
        const MIGRATION_KEY = 'ruri_datastore_migrated_v1';
        if (localStorage.getItem(MIGRATION_KEY)) return;

        console.log('[DataStore] Starting migration from localStorage...');
        try {
            let migrated = 0;
            let totalSaved = 0;
            const keysToRemove = [];

            // 遍历所有 localStorage keys，迁移匹配的数据
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                // 匹配需要迁移的 key 模式
                if (key.startsWith('ruri_chat_history_') ||
                    key.startsWith('ruri_offline_history_') ||
                    key.startsWith('ruri_memories_') ||
                    key.startsWith('ruri_offline_summaries_') ||
                    key.startsWith('ruri_offline_settings_')) {
                    
                    const raw = localStorage.getItem(key);
                    if (raw && raw.length > 2) { // 跳过空数组 '[]' 或空对象 '{}'
                        try {
                            const parsed = JSON.parse(raw);
                            this._cache[key] = parsed;
                            // 直接写入 IndexedDB
                            if (this._db) {
                                const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
                                const store = tx.objectStore(this.STORE_NAME);
                                store.put({ id: key, data: parsed });
                            }
                            totalSaved += raw.length;
                            migrated++;
                        } catch (e) {
                            console.warn('[DataStore] Skip invalid JSON key:', key);
                        }
                        keysToRemove.push(key);
                    }
                }
            }

            // 迁移完成后删除 localStorage 中的旧数据
            keysToRemove.forEach(key => {
                try { localStorage.removeItem(key); } catch(e) {}
            });

            localStorage.setItem(MIGRATION_KEY, 'true');
            console.log('[DataStore] Migration done: ' + migrated + ' entries moved to IndexedDB, freed ~' + Math.round(totalSaved / 1024) + 'KB from localStorage');
        } catch (e) {
            console.error('[DataStore] Migration failed:', e);
            localStorage.setItem(MIGRATION_KEY, 'true');
        }
    }
};

const API = {
    // ==================== EMOJI DATA ====================
    Emoji: {
        getGroups: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_emoji_groups') || '[]');
            } catch (e) {
                console.error('Error parsing emoji groups:', e);
                return [];
            }
        },

        saveGroups: function(groups) {
            localStorage.setItem('ruri_emoji_groups', JSON.stringify(groups));
        },

        getGroupEmojis: function(groupId) {
            const groups = this.getGroups();
            const group = groups.find(g => g.id === groupId);
            return group ? group.emojis : [];
        },

        parseBatchInput: function(batchText) {
            const lines = batchText.split('\n').filter(l => l.trim());
            const emojis = [];
            const urlRegex = /(https?:\/\/[^\s]+)/;

            lines.forEach(line => {
                const match = line.match(urlRegex);
                if (match) {
                    const url = match[0].trim();
                    let meaningPart = line.replace(urlRegex, '').trim();
                    meaningPart = meaningPart.replace(/^[:：\s\-]+|[:：\s\-]+$/g, '').trim();
                    const meaning = meaningPart || '表情';
                    emojis.push({ meaning: meaning, url: url });
                }
            });
            return emojis;
        },

        addGroup: function(name, emojis) {
            const groups = this.getGroups();
            groups.push({
                id: 'emoji_group_' + Date.now(),
                name: name,
                emojis: emojis,
                timestamp: Date.now()
            });
            this.saveGroups(groups);
            return groups;
        },

        deleteGroup: function(groupId) {
            let groups = this.getGroups();
            groups = groups.filter(g => g.id !== groupId);
            this.saveGroups(groups);
            return groups;
        }
    },

    // ==================== MEMORY DATA ====================
    Memory: {
        getMemories: function(charId) {
            if (!charId) return [];
            return DataStore.get('ruri_memories_' + charId) || [];
        },

        saveMemories: function(charId, memories) {
            if (!charId) return;
            DataStore.set('ruri_memories_' + charId, memories);
        },

        addMemory: function(charId, content, type = 'manual') {
            const memories = this.getMemories(charId);
            memories.push({
                id: 'mem_' + Date.now(),
                content: content,
                timestamp: Date.now(),
                type: type
            });
            this.saveMemories(charId, memories);
            return memories;
        },

        updateMemory: function(charId, index, content) {
            const memories = this.getMemories(charId);
            if (memories[index]) {
                memories[index].content = content;
                this.saveMemories(charId, memories);
            }
            return memories;
        },

        deleteMemory: function(charId, index) {
            const memories = this.getMemories(charId);
            memories.splice(index, 1);
            this.saveMemories(charId, memories);
            return memories;
        },

        generateSummary: async function(charId, charName, history, summaryPrompt, summaryRounds) {
            const config = API.Settings.getApiConfig();
            if (!config.endpoint || !config.key) throw new Error('请先在设置中配置 API');

            if (history.length === 0) throw new Error('暂无聊天记录可总结');

            // Get character info
            const char = API.Chat.getChar(charId);
            const settings = char && char.settings ? char.settings : {};
            
            // 角色名称：优先使用角色设置中的 charNameForSummary（用户在角色信息中填写的"角色名字"）
            // 如果没有设置，则使用角色的 name 字段，最后使用传入的 charName
            const charDisplayName = settings.charNameForSummary || (char ? char.name : null) || charName;
            const charPrompt = char && char.prompt ? char.prompt : '';
            
            // 用户名称：优先使用角色设置中保存的 userName（添加角色时填写的"你的称呼"）
            let userName = settings.userName || '用户';
            let userPersonaContent = '';
            
            // 优先使用角色设置中的自定义人设内容（customPersonaContent），其次使用面具预设
            if (settings.customPersonaContent) {
                userPersonaContent = settings.customPersonaContent;
            } else if (settings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    userPersonaContent = persona.content || '';
                }
            }

            // 使用用户设置的轮数来决定总结范围，默认20轮
            const rounds = summaryRounds || settings.summaryFreq || 20;
            
            // Filter out recalled messages and format history
            const visibleHistory = history.filter(m => !m.recalled);
            // 根据用户设置的轮数来获取最近的对话进行总结
            const recentMessages = visibleHistory.slice(-rounds).map(m => {
                let content = m.content;
                if (m.type === 'image') content = '[发送了一张图片]';
                else if (m.type === 'emoji') content = '[发送了表情包：' + (m.emojiMeaning || '表情') + ']';
                else if (m.type === 'voice') content = '[发送了语音消息：' + (m.voiceData && m.voiceData.transcription ? m.voiceData.transcription : '语音') + ']';
                else if (m.type === 'transfer') content = '[转账消息]';
                return (m.sender === 'user' ? userName : charDisplayName) + ': ' + content;
            }).join('\n');

            // Build system prompt for summary
            let systemContent = '';
            
            if (summaryPrompt) {
                // User custom summary prompt
                systemContent = summaryPrompt;
            } else {
                // Default third-person summary prompt
                systemContent = '你是一个聊天记录总结助手。请以第三人称视角总结以下对话的关键信息。';
                systemContent += '\n\n【角色信息】';
                systemContent += '\n- 角色名称: ' + charDisplayName;
                if (charPrompt) {
                    systemContent += '\n- 角色设定: ' + charPrompt;
                }
                systemContent += '\n\n【用户信息】';
                systemContent += '\n- 用户名称: ' + userName;
                if (userPersonaContent) {
                    systemContent += '\n- 用户人设: ' + userPersonaContent;
                }
                systemContent += '\n\n【总结要求】';
                systemContent += '\n1. 使用第三人称描述（如"' + userName + '和' + charDisplayName + '聊了..."）';
                systemContent += '\n2. 提取重要的事件、情感和细节';
                systemContent += '\n3. 用简洁的语言概括，不超过200字';
            }

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
                        { role: 'user', content: '以下是聊天记录：\n\n' + recentMessages }
                    ],
                    temperature: 0.5,
                    safety_settings: API.Settings.getSafetySettings()
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            
            const data = await response.json();
            return data.choices[0].message.content;
        }
    },

    // ==================== SETTINGS DATA ====================
    Settings: {
        getApiConfig: function() {
            try {
                return JSON.parse(localStorage.getItem('apiConfig') || '{}');
            } catch (e) {
                console.error('Error parsing apiConfig:', e);
                return {};
            }
        },

        saveApiConfig: function(config) {
            localStorage.setItem('apiConfig', JSON.stringify(config));
        },

        /**
         * 获取 Gemini 安全设置（所有类别设为 BLOCK_NONE）
         * 用于避免 API 400 错误
         */
        getSafetySettings: function() {
            return [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
            ];
        },

        getPresets: function() {
            try {
                return JSON.parse(localStorage.getItem('apiPresets') || '[]');
            } catch (e) {
                console.error('Error parsing apiPresets:', e);
                return [];
            }
        },

        savePresets: function(presets) {
            localStorage.setItem('apiPresets', JSON.stringify(presets));
        },

        fetchModels: async function(endpoint, key) {
            const headers = { 'Content-Type': 'application/json' };
            if (key) headers['Authorization'] = 'Bearer ' + key;
            
            const response = await fetch(endpoint + '/models', {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + response.statusText);
            
            const data = await response.json();
            let models = [];
            if (data.data && Array.isArray(data.data)) {
                models = data.data;
            } else if (Array.isArray(data)) {
                models = data;
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models;
            }
            return models;
        },

        getCssPresets: function() {
            try {
                return JSON.parse(localStorage.getItem('css_presets') || '[]');
            } catch (e) {
                console.error('Error parsing css_presets:', e);
                return [];
            }
        },

        saveCssPresets: function(presets) {
            localStorage.setItem('css_presets', JSON.stringify(presets));
        }
    },

    // ==================== WORLDBOOK DATA ====================
    WorldBook: {
        getBooks: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_worldbooks') || '[]');
            } catch (e) {
                console.error('Error parsing worldbooks:', e);
                return [];
            }
        },

        saveBooks: function(books) {
            localStorage.setItem('ruri_worldbooks', JSON.stringify(books));
        },

        saveBook: function(bookData) {
            let books = this.getBooks();
            if (bookData.id) {
                const index = books.findIndex(b => b.id === bookData.id);
                if (index !== -1) {
                    books[index] = { ...books[index], ...bookData, timestamp: Date.now() };
                }
            } else {
                books.push({
                    ...bookData,
                    id: 'wb_' + Date.now(),
                    timestamp: Date.now()
                });
            }
            this.saveBooks(books);
            return books;
        },

        deleteBook: function(id) {
            let books = this.getBooks();
            books = books.filter(b => b.id !== id);
            this.saveBooks(books);
            return books;
        }
    },

    // ==================== CHAT DATA & LOGIC ====================
    Chat: {
        // 内存缓存层 - 避免重复 JSON.parse/stringify 导致卡顿
        _cache: {
            chars: null,        // 角色列表缓存
            history: {}         // 聊天历史缓存 { charId: array }
        },

        // 清除缓存（外部修改localStorage后调用）
        clearCache: function() {
            this._cache.chars = null;
            this._cache.history = {};
        },

        getChars: function() {
            if (this._cache.chars) return this._cache.chars;
            try {
                const raw = localStorage.getItem('ruri_chars');
                if (!raw || raw === 'undefined' || raw === 'null') return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    console.error('ruri_chars is not an array, resetting. Value type:', typeof parsed);
                    return [];
                }
                // 过滤掉无效的角色数据（必须有id），并从 AvatarStore 恢复头像和壁纸
                const result = parsed.filter(c => c && typeof c === 'object' && c.id).map(c => {
                    if (c.avatar === 'idb') {
                        const cached = AvatarStore.get(c.id);
                        if (cached) {
                            c.avatar = cached;
                        } else {
                            c.avatar = 'icon.png';
                        }
                    }
                    // 从 IndexedDB 恢复壁纸数据
                    if (c.settings && c.settings.wallpaper === 'idb') {
                        const cachedWp = AvatarStore.get('wallpaper_' + c.id);
                        if (cachedWp) {
                            c.settings.wallpaper = cachedWp;
                        } else {
                            c.settings.wallpaper = '';
                        }
                    }
                    return c;
                });
                this._cache.chars = result;
                return result;
            } catch (e) {
                console.error('Error parsing chars:', e);
                return [];
            }
        },

        saveChars: function(chars) {
            if (!Array.isArray(chars)) {
                console.error('saveChars: chars is not an array!');
                chars = [];
            }
            // 更新缓存
            this._cache.chars = chars;

            const validChars = chars.filter(c => c && typeof c === 'object' && c.id);

            // 剥离 base64 头像和大型壁纸 → 存入 IndexedDB，localStorage 只保留 'idb' 标记
            const slimChars = validChars.map(c => {
                const copy = { ...c };
                if (copy.avatar && typeof copy.avatar === 'string' &&
                    copy.avatar.startsWith('data:') && copy.avatar.length > 500) {
                    // 异步存入 IndexedDB（fire-and-forget）
                    AvatarStore.set(copy.id, copy.avatar);
                    copy.avatar = 'idb';
                }
                // 剥离大型壁纸数据 → 存入 IndexedDB，避免 localStorage 超限
                if (copy.settings && copy.settings.wallpaper && typeof copy.settings.wallpaper === 'string' &&
                    copy.settings.wallpaper.startsWith('data:') && copy.settings.wallpaper.length > 500) {
                    copy.settings = { ...copy.settings };
                    AvatarStore.set('wallpaper_' + copy.id, copy.settings.wallpaper);
                    copy.settings.wallpaper = 'idb';
                }
                return copy;
            });

            try {
                localStorage.setItem('ruri_chars', JSON.stringify(slimChars));
            } catch (e) {
                console.error('saveChars localStorage write failed:', e);
                // 如果还是超限，尝试强制清理所有头像后重试
                if (e.name === 'QuotaExceededError') {
                    const ultraSlim = slimChars.map(c => {
                        const copy = { ...c };
                        if (copy.avatar && copy.avatar !== 'idb' && copy.avatar.length > 200) {
                            copy.avatar = 'idb';
                        }
                        return copy;
                    });
                    try {
                        localStorage.setItem('ruri_chars', JSON.stringify(ultraSlim));
                    } catch (e2) {
                        console.error('saveChars: even ultra-slim save failed:', e2);
                    }
                }
            }
        },

        getChar: function(charId) {
            const chars = this.getChars();
            return chars.find(c => c.id === charId);
        },

        addChar: function(charData) {
            if (!charData || !charData.id) {
                throw new Error('角色数据无效：缺少ID');
            }
            // 如果有 base64 头像，先存入 IndexedDB
            if (charData.avatar && typeof charData.avatar === 'string' &&
                charData.avatar.startsWith('data:') && charData.avatar.length > 500) {
                AvatarStore.set(charData.id, charData.avatar);
            }
            let chars = this.getChars();
            if (!Array.isArray(chars)) {
                console.error('getChars returned non-array, using empty array');
                chars = [];
            }
            chars.unshift(charData);
            this.saveChars(chars);
            return chars;
        },

        updateChar: function(charId, updateData) {
            let chars = this.getChars();
            const idx = chars.findIndex(c => c.id === charId);
            if (idx !== -1) {
                // 如果更新了头像，先存入 IndexedDB
                if (updateData.avatar && typeof updateData.avatar === 'string' &&
                    updateData.avatar.startsWith('data:') && updateData.avatar.length > 500) {
                    AvatarStore.set(charId, updateData.avatar);
                }
                chars[idx] = { ...chars[idx], ...updateData };
                this.saveChars(chars);
                return chars[idx];
            }
            return null;
        },

        updateCharSettings: function(charId, newSettings) {
            let chars = this.getChars();
            const idx = chars.findIndex(c => c.id === charId);
            if (idx !== -1) {
                chars[idx].settings = { ...chars[idx].settings, ...newSettings };
                this.saveChars(chars);
            }
        },

        deleteChar: function(charId) {
            let chars = this.getChars();
            chars = chars.filter(c => c.id !== charId);
            this.saveChars(chars);
            // 同时清理 IndexedDB 中的头像和壁纸
            AvatarStore.remove(charId);
            AvatarStore.remove('wallpaper_' + charId);
            // 清理 DataStore 中的聊天记录和记忆
            DataStore.remove('ruri_chat_history_' + charId);
            DataStore.remove('ruri_memories_' + charId);
            delete this._cache.history[charId];
        },

        getHistory: function(charId) {
            if (!charId) return [];
            // 优先从内存缓存读取
            if (this._cache.history[charId]) return this._cache.history[charId];
            // 从 DataStore (IndexedDB) 读取
            const result = DataStore.get('ruri_chat_history_' + charId) || [];
            this._cache.history[charId] = result;
            return result;
        },

        saveHistory: function(charId, history) {
            if (!charId) return;
            // 更新内存缓存
            this._cache.history[charId] = history;
            // 写入 DataStore (IndexedDB)，自动延迟批量写入
            DataStore.set('ruri_chat_history_' + charId, history);
            
            // Update last message in char list (使用缓存，不再重复解析)
            const lastMsg = history[history.length - 1];
            if (lastMsg) {
                let chars = this.getChars();
                const idx = chars.findIndex(c => c.id === charId);
                if (idx !== -1) {
                    chars[idx].lastMessage = lastMsg.type === 'image' ? '[图片]' : (lastMsg.type === 'emoji' ? '[表情包]' : (lastMsg.type === 'transfer' ? '[转账]' : lastMsg.content));
                    // Move to top
                    const updatedChar = chars.splice(idx, 1)[0];
                    chars.unshift(updatedChar);
                    this.saveChars(chars);
                }
            }
        },

        addMessage: function(charId, msg) {
            const history = this.getHistory(charId);
            history.push(msg);
            this.saveHistory(charId, history);
            return history;
        },

        // Core LLM Logic
        generateReply: async function(charId) {
            const config = API.Settings.getApiConfig();
            if (!config.endpoint || !config.key) throw new Error('请先在设置中配置 API');

            const char = this.getChar(charId);
            if (!char) throw new Error('Character not found');

            const settings = char.settings || {};
            const ctxLength = settings.contextLength || 20;
            
            // 构建线上聊天系统提示词
            let systemPrompt = '【角色扮演设定】';
            systemPrompt += '\n你正在扮演一个角色进行线上聊天。';
            systemPrompt += '\n角色名称：' + char.name;
            systemPrompt += '\n角色设定：' + (char.prompt || '无特殊设定');

            // --- 角色感知现实世界 ---
            if (settings.realWorldAwareness) {
                const now = new Date();
                const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekDays[now.getDay()];
                const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                systemPrompt += '\n\n【现实世界时间感知】';
                systemPrompt += '\n当前现实世界的日期和时间：' + dateStr + ' ' + timeStr;
                systemPrompt += '\n你可以感知到现在的真实时间，可以据此做出合理的反应（如问候早安/晚安、节日祝福、评论时间等）。';
            }
            
            systemPrompt += '\n\n【线上聊天模式 - 核心规则】';
            systemPrompt += '\n⚠️ 你现在是【线上聊天】，模拟真人发微信/QQ！';
            systemPrompt += '\n';
            systemPrompt += '\n★★★ 最重要的规则 ★★★';
            systemPrompt += '\n你必须像真人发消息一样，把回复拆成多条短消息发送！';
            systemPrompt += '\n每次回复【必须至少5条消息】，用换行符分隔每条消息。';
            systemPrompt += '\n';
            systemPrompt += '\n【真人发消息的特点】';
            systemPrompt += '\n- 一条消息可以只有几个字，比如"嗯"、"好的"、"哈哈哈"';
            systemPrompt += '\n- 想到什么说什么，不会把所有话攒成一大段';
            systemPrompt += '\n- 口语化，用语气词：嗯、啊、哈哈、emmm、额、呃、诶、哦';
            systemPrompt += '\n- 说话随意自然，不会像写作文一样';
            systemPrompt += '\n';
            systemPrompt += '\n【格式示例】';
            systemPrompt += '\n哈哈哈';
            systemPrompt += '\n你说的这个我知道';
            systemPrompt += '\n之前还看过相关的';
            systemPrompt += '\n挺有意思的';
            systemPrompt += '\n你是怎么知道的呀';
            systemPrompt += '\n';
            systemPrompt += '\n【禁止事项】';
            systemPrompt += '\n- 禁止动作描写（*微笑*、*点头*等）';
            systemPrompt += '\n- 禁止心理描写';
            systemPrompt += '\n- 禁止场景描写';
            systemPrompt += '\n- 禁止括号注释';
            systemPrompt += '\n- 禁止把所有内容写成一条长消息';
            systemPrompt += '\n';
            systemPrompt += '\n记住：你必须严格按照角色人设来回复，但表达方式要像真人发微信！';
            
            // 特殊功能指令（精简版）
            systemPrompt += '\n\n【特殊指令】';
            systemPrompt += '\n[QUOTE:关键词]回复内容 - 引用回复';
            systemPrompt += '\n消息[RECALL] - 撤回（说错话时用）';
            systemPrompt += '\n[图片:描述] - 文字传图（单独一行）';
            systemPrompt += '\n[语音:内容] - 语音消息（单独一行）';
            systemPrompt += '\n[转账:金额:备注] - 转账（单独一行，不重复发）';
            systemPrompt += '\n[领取转账] - 领取用户转账（已领取不重复）';
            systemPrompt += '\n[换头像] - 当用户提到换头像并发送图片时，使用此指令将用户发送的图片设为你的新头像（单独一行）';
            
            systemPrompt += '\n\n⚠️ 格式要求：表情包URL/语音/图片/转账/换头像必须单独一行！';

            // --- 身份隔离铁律 ---
            systemPrompt += '\n\n[CRITICAL: 你必须严格区分用户和你自己的身份。用户发出的表情和情绪仅属于用户，严禁你在回复中认领这些情绪或复读用户的表情描述。]';
            systemPrompt += '\n[严禁复读任何带中括号的系统说明文本，如"[表情: xxx]""[用户发送了...]"等，这些是系统内部标注，不是对话内容。]';

            // --- Memory Integration (强化版) ---
            const memories = API.Memory.getMemories(charId);
            if (memories.length > 0) {
                systemPrompt += '\n\n【角色记忆 - 必须参考】';
                systemPrompt += '\n以下是你（角色）关于之前对话的记忆，这些记忆非常重要，请务必参考来保持对话的连贯性和一致性：';
                memories.forEach((m, i) => {
                    const typeLabel = m.type === 'auto' ? '自动总结' : '手动记忆';
                    systemPrompt += '\n[' + typeLabel + ' #' + (i + 1) + '] ' + m.content;
                });
                systemPrompt += '\n\n⚠️ 请认真阅读以上所有记忆条目，在回复时体现出你记得这些事情。';
            }

            // --- World Book Integration (支持多选) ---
            const worldBookIds = settings.worldBookIds || (settings.worldBookId ? [settings.worldBookId] : []);
            if (worldBookIds.length > 0) {
                const books = API.WorldBook.getBooks();
                const selectedBooks = books.filter(b => worldBookIds.includes(b.id));
                if (selectedBooks.length > 0) {
                    systemPrompt += '\n\n【世界背景设定】';
                    selectedBooks.forEach(wb => {
                        systemPrompt += '\n[' + wb.title + ']: ' + wb.content;
                    });
                }
            }

            // --- User Persona Integration ---
            // 优先使用角色设置中的自定义人设内容（customPersonaContent），其次使用面具预设
            if (settings.customPersonaContent) {
                systemPrompt += '\n[User Persona/Info: ' + settings.customPersonaContent + ']';
            } else if (settings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    systemPrompt += '\n[User Persona/Info: ' + persona.content + ']';
                }
            }

            // --- Emoji Integration (支持多选) ---
            let emojiMap = {}; // URL到含义的映射
            const emojiGroupIds = settings.emojiGroupIds || (settings.emojiGroupId ? [settings.emojiGroupId] : []);
            if (emojiGroupIds.length > 0) {
                let allEmojis = [];
                emojiGroupIds.forEach(groupId => {
                    const emojis = API.Emoji.getGroupEmojis(groupId);
                    allEmojis = allEmojis.concat(emojis);
                });
                
                if (allEmojis.length > 0) {
                    // 建立URL到含义的映射
                    allEmojis.forEach(e => {
                        emojiMap[e.url] = e.meaning;
                    });
                    const emojiList = allEmojis.map(e => '「' + e.meaning + '」: ' + e.url).join('\n');
                    systemPrompt += '\n\n【表情包功能】';
                    systemPrompt += '\n你可以使用以下表情包来表达情绪，根据你的人设性格决定发送频率：';
                    systemPrompt += '\n- 如果人设活泼开朗，可以多发表情包';
                    systemPrompt += '\n- 如果人设冷淡高冷，可以少发或不发';
                    systemPrompt += '\n- 发送表情包时，只需要单独一行输出完整的URL即可，不要添加任何markdown格式、括号、感叹号或其他修饰符号';
                    systemPrompt += '\n- 错误示例：![表情](URL) 或 [表情](URL) 或 ![](URL)';
                    systemPrompt += '\n- 正确示例：直接输出URL，如 https://example.com/emoji.png';
                    systemPrompt += '\n\n可用表情包列表（含义: URL）：\n' + emojiList;
                }
            }

            const fullHistory = this.getHistory(charId);
            // 获取线下历史记录，实现线上线下上下文互通
            const offlineHistory = API.Offline.getHistory(charId);
            
            // 合并线上和线下历史，按时间戳排序
            const mergedHistory = [];
            fullHistory.forEach(msg => {
                // 跳过从线下同步过来的摘要消息（以 [线下剧情] 开头的），避免重复
                if (msg.content && typeof msg.content === 'string' && msg.content.startsWith('[线下剧情] ')) return;
                // 保留撤回的消息，但标记为撤回状态，让AI知道自己撤回了什么
                if (msg.recalled && msg.recalledContent) {
                    mergedHistory.push({ ...msg, _source: 'online', _isRecalled: true });
                } else if (!msg.recalled) {
                    mergedHistory.push({ ...msg, _source: 'online' });
                }
            });
            offlineHistory.forEach(msg => {
                // 线下消息也加入合并列表
                mergedHistory.push({ ...msg, _source: 'offline' });
            });
            
            // 按时间戳排序
            mergedHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            // 取最近 ctxLength 轮
            const recentMerged = mergedHistory.slice(-ctxLength);
            
            const recentHistory = recentMerged.map(msg => {
                const isOffline = msg._source === 'offline';
                let content = '';
                
                // 处理转账消息 - 告诉AI转账状态，避免重复转账
                if (msg.type === 'transfer') {
                    const td = msg.transferData || {};
                    const amount = td.amount || 0;
                    const remark = td.remark || '';
                    const status = td.status || 'pending';
                    
                    if (td.fromUser) {
                        // 用户发的转账
                        if (status === 'received') {
                            content = '[用户给你转账了' + amount.toFixed(2) + '元' + (remark ? '，备注：' + remark : '') + '，你已经领取了这笔转账]';
                        } else {
                            content = '[用户给你转账了' + amount.toFixed(2) + '元' + (remark ? '，备注：' + remark : '') + '，你尚未领取，可以用[领取转账]来领取]';
                        }
                    } else {
                        // AI发的转账
                        if (status === 'received') {
                            content = '[你之前给用户转账了' + amount.toFixed(2) + '元' + (remark ? '，备注：' + remark : '') + '，用户已经领取了]';
                        } else {
                            content = '[你之前给用户转账了' + amount.toFixed(2) + '元' + (remark ? '，备注：' + remark : '') + '，用户尚未领取]';
                        }
                    }
                }
                // 处理语音消息 - 优先直传音频给AI（多模态），否则用文字
                else if (msg.type === 'voice') {
                    const voiceData = msg.voiceData || {};
                    const transcription = voiceData.transcription || msg.content || '';
                    const sender = msg.sender === 'user' ? '用户' : char.name;
                    
                    // 如果有原始音频 base64 数据（移动端直传方案），使用多模态格式让 Gemini 直接听音频
                    if (voiceData.audioBase64ForAI && voiceData.audioMimeType) {
                        // 从 data URL 中提取纯 base64 数据
                        const base64Data = voiceData.audioBase64ForAI.includes(',')
                            ? voiceData.audioBase64ForAI.split(',')[1]
                            : voiceData.audioBase64ForAI;
                        // 从 MIME 类型中提取格式（如 audio/webm;codecs=opus -> webm, audio/mp4 -> mp4）
                        const audioFormat = voiceData.audioMimeType.split('/')[1].split(';')[0];
                        content = [
                            {
                                type: 'text',
                                text: '[' + sender + '发送了一条语音消息，请仔细听取音频内容，理解用户说了什么，然后自然地回应。注意：请直接根据音频内容回复，不要说"我听到了你的语音"之类的话]'
                            },
                            {
                                type: 'input_audio',
                                input_audio: {
                                    data: base64Data,
                                    format: audioFormat
                                }
                            }
                        ];
                    } else if (transcription && transcription !== '[语音消息]' && transcription !== '[语音识别中...]') {
                        // 有识别出的文字内容（电脑端前端ASR），直接告诉AI用户说了什么
                        content = '[' + sender + '发送了一条语音消息，说的是：「' + transcription + '」]';
                    } else {
                        // 没有识别出文字也没有音频数据，告诉AI用户发了语音但无法转文字
                        content = '[' + sender + '发送了一条语音消息，语音转文字失败，请根据上下文推测用户可能在说什么，并自然地回应]';
                    }
                }
                // 处理表情包消息（新的emoji类型）- 脱水：缩减为短标记
                else if (msg.type === 'emoji') {
                    const meaning = msg.emojiMeaning || emojiMap[msg.content] || '未知表情';
                    content = '[表情: ' + meaning + ']';
                }
                // 处理图片消息
                else if (msg.type === 'image') {
                    const imgUrl = msg.content;
                    if (emojiMap[imgUrl]) {
                        // 匹配到表情包 - 脱水：缩减为短标记
                        content = '[表情: ' + emojiMap[imgUrl] + ']';
                    } else if (msg.isVisionImage && msg.content && msg.content.startsWith('data:image/')) {
                        // 用户发送的真实图片，使用Vision API格式让AI识别
                        content = [
                            {
                                type: 'text',
                                text: '[用户发送了一张图片，请描述你看到的内容并做出回应]'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: msg.content,
                                    detail: 'low'  // 使用low以节省token
                                }
                            }
                        ];
                    } else {
                        content = '[发送了一张图片]';
                    }
                } else {
                    content = msg.content;
                }
                
                // 处理撤回的消息 - 让AI知道自己撤回了什么
                if (msg._isRecalled && msg.recalledContent && typeof content === 'string') {
                    content = '[你之前发送了这条消息但立即撤回了：「' + msg.recalledContent + '」]';
                }

                // 如果是线下模式的消息，添加标记让AI知道这是线下剧情对话
                if (isOffline && typeof content === 'string') {
                    content = '[线下剧情对话] ' + content;
                }
                
                // 处理引用消息 - 显示完整引用内容，让AI清楚知道用户引用了什么
                if (msg.quote) {
                    const quotedMsg = fullHistory.find(m => m.id === msg.quote.id);
                    if (quotedMsg && !quotedMsg.recalled) {
                        let quotedContent = quotedMsg.content;
                        let quotedType = '文字消息';
                        
                        // 如果引用的是表情包（新emoji类型）
                        if (quotedMsg.type === 'emoji') {
                            quotedContent = quotedMsg.emojiMeaning || emojiMap[quotedMsg.content] || '表情包';
                            quotedType = '表情包';
                        }
                        // 如果引用的是旧的image类型但实际是表情包
                        else if (quotedMsg.type === 'image' && emojiMap[quotedMsg.content]) {
                            quotedContent = emojiMap[quotedMsg.content];
                            quotedType = '表情包';
                        } else if (quotedMsg.type === 'image') {
                            // 检查是否是意念图（白底文字卡片）
                            if (quotedMsg.content && quotedMsg.content.startsWith('data:image/')) {
                                quotedContent = '一张图片';
                                quotedType = '图片';
                            } else {
                                quotedContent = quotedMsg.content;
                                quotedType = '图片';
                            }
                        }
                        
                        const quoteSender = quotedMsg.sender === 'user' ? '用户' : char.name;
                        // 更详细的引用格式，让AI清楚知道引用的类型和内容
                        content = '[用户引用了' + quoteSender + '发送的' + quotedType + '："' + quotedContent + '"，并回复说：] ' + content;
                    }
                }
                
                // --- 上下文脱水：清洗残留的长表情包描述 ---
                if (typeof content === 'string') {
                    content = content.replace(/\[用户发送了一个表情包[^\]]*含义是[：:]\s*「([^」]+)」[^\]]*\]/g, '[表情: $1]');
                }

                return {
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: content
                };
            });

            // 构建 messages 数组：system prompt + 历史记录 + 末尾格式锁死提醒
            const messages = [
                { role: 'system', content: systemPrompt }
            ].concat(recentHistory);

            // --- 线上模式逻辑隔离：在 messages 末尾追加独立 system 消息 ---
            // 不污染用户消息内容，避免破坏 AI 分条发送的格式
            messages.push({
                role: 'system',
                content: '⚠️⚠️⚠️ 【最高优先级】你必须像真人发微信一样回复！\n\n1. 必须发送【至少5条消息】，用换行符分隔\n2. 每条消息可以很短，几个字也行\n3. 口语化、自然、随意\n4. 严格按照角色人设回复\n5. 禁止动作描写、心理描写、括号注释\n\n示例格式：\n哈哈\n你说的对\n我也这么觉得\n不过话说回来\n你最近怎么样啊'
            });

            const response = await fetch(config.endpoint + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.key
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: config.temperature !== undefined ? config.temperature : 0.8,
                    max_tokens: 4096,
                    stream: true,  // 启用流式传输
                    safety_settings: API.Settings.getSafetySettings()
                })
            });

            if (!response.ok) {
                let errDetail = 'HTTP ' + response.status;
                try {
                    const errData = await response.json();
                    if (errData.error) {
                        errDetail += ' | ' + (errData.error.message || errData.error.type || JSON.stringify(errData.error));
                        if (errData.error.code) errDetail += ' (' + errData.error.code + ')';
                    }
                } catch (_) {
                    try { errDetail += ' | ' + await response.text(); } catch (_2) {}
                }
                const err = new Error(errDetail);
                err.httpStatus = response.status;
                throw err;
            }
            
            // 流式读取响应 - 接收完整内容后再分割
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullReply = '';
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;
                        
                        try {
                            const jsonStr = trimmed.substring(6);
                            const chunk = JSON.parse(jsonStr);
                            const content = chunk.choices?.[0]?.delta?.content;
                            
                            if (content) {
                                fullReply += content;
                            }
                        } catch (e) {
                            console.warn('[Stream] 解析chunk失败:', e);
                        }
                    }
                }
                
                // 接收完整内容后进行智能分段
                if (!fullReply.trim()) {
                    throw new Error('AI返回内容为空');
                }
                
                // 智能分段逻辑:确保AI回复被拆分成多条消息
                return this._smartSplitReply(fullReply);
                
            } catch (e) {
                console.error('[Stream] 读取失败:', e);
                throw e;
            }
        },

        /**
         * 智能分段函数 - 简单直接，信任AI的换行
         * AI已经被提示要分多条发送，这里只做简单处理
         */
        _smartSplitReply: function(fullReply) {
            // 直接按换行符分割，信任AI的分段
            let segments = fullReply.split('\n').filter(t => t.trim());
            
            // 如果AI没有分段或分段太少，简单拆分
            if (segments.length < 5) {
                segments = this._simpleSplit(fullReply);
            }
            
            return segments;
        },

        /**
         * 简单拆分 - 按标点符号拆分成多条
         */
        _simpleSplit: function(text) {
            const bubbles = [];
            
            // 按句号、问号、感叹号、省略号拆分
            const sentences = text.match(/[^。！？…\n]+[。！？…]?/g) || [text];
            
            for (const sentence of sentences) {
                const trimmed = sentence.trim();
                if (trimmed) {
                    bubbles.push(trimmed);
                }
            }
            
            // 如果还是不够5条，继续按逗号拆
            if (bubbles.length < 5) {
                const moreBubbles = [];
                for (const bubble of bubbles) {
                    if (bubble.length > 30) {
                        // 长句按逗号拆
                        const parts = bubble.match(/[^，、,]+[，、,]?/g) || [bubble];
                        moreBubbles.push(...parts.map(p => p.trim()).filter(p => p));
                    } else {
                        moreBubbles.push(bubble);
                    }
                }
                return moreBubbles.filter(b => b.trim());
            }
            
            return bubbles.filter(b => b.trim());
        },

        /**
         * 获取统一的轮数计数器（线上+线下合并计算）
         * 返回：{ totalRounds: 总轮数, onlineRounds: 线上轮数, offlineRounds: 线下轮数 }
         */
        _getUnifiedRoundCount: function(charId) {
            const onlineHistory = this.getHistory(charId);
            const offlineHistory = API.Offline.getHistory(charId);
            
            // 只计算AI回复的轮数（1次AI回复 = 1轮）
            const onlineRounds = onlineHistory.filter(m => m.sender === 'ai' || m.sender === 'assistant').length;
            const offlineRounds = offlineHistory.filter(m => m.sender === 'ai').length;
            const totalRounds = onlineRounds + offlineRounds;
            
            return { totalRounds, onlineRounds, offlineRounds };
        },
        
        /**
         * 获取上次总结时的轮数
         */
        _getLastSummaryRound: function(charId) {
            const key = 'ruri_unified_last_summary_round_' + charId;
            return parseInt(DataStore.get(key) || '0') || 0;
        },
        
        /**
         * 设置上次总结时的轮数
         */
        _setLastSummaryRound: function(charId, round) {
            const key = 'ruri_unified_last_summary_round_' + charId;
            DataStore.set(key, round);
        },
        
        /**
         * 重置轮数计数器（手动总结或自动总结后调用）
         */
        _resetRoundCounter: function(charId) {
            const currentCount = this._getUnifiedRoundCount(charId);
            this._setLastSummaryRound(charId, currentCount.totalRounds);
            console.log('[RoundCounter] 计数器已重置 - 角色:', charId, '当前总轮数:', currentCount.totalRounds);
        },

        checkAutoSummary: async function(charId) {
            const char = this.getChar(charId);
            if (!char) return;
            const settings = char.settings || {};
            
            if (settings.autoSummary) {
                const freq = settings.summaryFreq || 10;
                
                // 使用统一的轮数计数器（线上+线下）
                const currentCount = this._getUnifiedRoundCount(charId);
                const lastSummaryRound = this._getLastSummaryRound(charId);
                const newRounds = currentCount.totalRounds - lastSummaryRound;
                
                console.log('[AutoSummary] 检查自动总结 - 当前总轮数:', currentCount.totalRounds, '(线上:', currentCount.onlineRounds, '线下:', currentCount.offlineRounds, ') 上次总结轮数:', lastSummaryRound, '新增轮数:', newRounds, '设定频率:', freq);
                
                if (currentCount.totalRounds > 0 && newRounds >= freq) {
                    try {
                        // 合并线上线下历史进行总结
                        const onlineHistory = this.getHistory(charId);
                        const offlineHistory = API.Offline.getHistory(charId);
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
                        
                        // 传入freq作为总结的轮数范围
                        const summary = await API.Memory.generateSummary(charId, char.name, mergedHistory, settings.summaryPrompt, freq);
                        API.Memory.addMemory(charId, summary, 'auto');
                        
                        // 重置计数器
                        this._resetRoundCounter(charId);
                        
                        console.log('[AutoSummary] 自动总结已生成并重置计数器, 角色:', char.name, '总结轮数:', freq);
                    } catch (e) {
                        console.error('[AutoSummary] 自动总结失败:', e);
                    }
                }
            }
        }
    },

    // ==================== PROFILE DATA ====================
    Profile: {
        getProfile: function() {
            try {
                return JSON.parse(localStorage.getItem('user_profile') || '{}');
            } catch (e) {
                console.error('Error parsing profile:', e);
                return {};
            }
        },

        saveProfile: function(profile) {
            localStorage.setItem('user_profile', JSON.stringify(profile));
        },

        getPersonas: function() {
            try {
                return JSON.parse(localStorage.getItem('user_persona_presets') || '[]');
            } catch (e) {
                console.error('Error parsing personas:', e);
                return [];
            }
        },

        savePersonas: function(personas) {
            localStorage.setItem('user_persona_presets', JSON.stringify(personas));
        }
    },

    // ==================== HOME SCREEN DATA ====================
    Home: {
        getData: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_home_data') || '{}');
            } catch (e) {
                console.error('Error parsing home data:', e);
                return {};
            }
        },

        saveData: function(data) {
            const current = this.getData();
            localStorage.setItem('ruri_home_data', JSON.stringify({ ...current, ...data }));
        }
    },

    // ==================== OFFLINE MODE DATA ====================
    Offline: {
        getHistory: function(charId) {
            if (!charId) return [];
            return DataStore.get('ruri_offline_history_' + charId) || [];
        },

        saveHistory: function(charId, history) {
            if (!charId) return;
            DataStore.set('ruri_offline_history_' + charId, history);
        },

        addMessage: function(charId, msg) {
            const history = this.getHistory(charId);
            history.push(msg);
            this.saveHistory(charId, history);
            return history;
        },

        getSettings: function(charId) {
            if (!charId) return {};
            return DataStore.get('ruri_offline_settings_' + charId) || {};
        },

        saveSettings: function(charId, update) {
            if (!charId) return;
            const current = this.getSettings(charId);
            const merged = { ...current, ...update };
            
            // 检查壁纸大小，大型图片存到 IndexedDB（线下壁纸）
            if (merged.wallpaper && merged.wallpaper.length > 500000) {
                const wallpaperData = merged.wallpaper;
                merged.wallpaper = ''; // 清空大图
                this._saveWallpaperToIndexedDB(charId, wallpaperData);
            }
            
            DataStore.set('ruri_offline_settings_' + charId, merged);
        },

        // ---- 全局预设管理（所有角色共用预设内容，每个角色单独启用） ----
        
        /**
         * 获取全局预设列表
         */
        getGlobalPresets: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_presets_global') || '[]');
            } catch (e) {
                console.error('Error parsing global offline presets:', e);
                return [];
            }
        },

        /**
         * 保存全局预设列表
         */
        saveGlobalPresets: function(presets) {
            localStorage.setItem('ruri_offline_presets_global', JSON.stringify(presets));
        },

        /**
         * 获取角色启用的预设ID列表
         */
        getEnabledPresetIds: function(charId) {
            if (!charId) return [];
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_preset_enabled_' + charId) || '[]');
            } catch (e) {
                console.error('Error parsing enabled preset ids:', e);
                return [];
            }
        },

        /**
         * 保存角色启用的预设ID列表
         */
        saveEnabledPresetIds: function(charId, ids) {
            if (!charId) return;
            localStorage.setItem('ruri_offline_preset_enabled_' + charId, JSON.stringify(ids));
        },

        /**
         * 获取预设列表（带角色启用状态）- 兼容旧接口
         */
        getPresets: function(charId) {
            const globalPresets = this.getGlobalPresets();
            if (!charId) return globalPresets.map(p => ({ ...p, enabled: false }));
            
            const enabledIds = this.getEnabledPresetIds(charId);
            return globalPresets.map(p => ({
                ...p,
                enabled: enabledIds.includes(p.id)
            }));
        },

        /**
         * 添加全局预设
         */
        addPreset: function(charId, preset) {
            const presets = this.getGlobalPresets();
            const newId = Date.now();
            presets.push({
                id: newId,
                name: preset.name,
                content: preset.content
            });
            this.saveGlobalPresets(presets);
            
            // 默认在当前角色中启用
            if (charId && preset.enabled !== false) {
                const enabledIds = this.getEnabledPresetIds(charId);
                enabledIds.push(newId);
                this.saveEnabledPresetIds(charId, enabledIds);
            }
            
            return this.getPresets(charId);
        },

        /**
         * 更新全局预设内容（名字和内容）
         */
        updatePreset: function(charId, presetId, update) {
            const presets = this.getGlobalPresets();
            const idx = presets.findIndex(p => p.id === presetId);
            if (idx !== -1) {
                if (update.name !== undefined) presets[idx].name = update.name;
                if (update.content !== undefined) presets[idx].content = update.content;
                this.saveGlobalPresets(presets);
            }
            return this.getPresets(charId);
        },

        /**
         * 删除全局预设
         */
        deletePreset: function(charId, presetId) {
            let presets = this.getGlobalPresets();
            presets = presets.filter(p => p.id !== presetId);
            this.saveGlobalPresets(presets);
            return this.getPresets(charId);
        },

        /**
         * 切换角色的预设启用状态
         */
        togglePreset: function(charId, presetId) {
            if (!charId) return [];
            const enabledIds = this.getEnabledPresetIds(charId);
            const idx = enabledIds.indexOf(presetId);
            if (idx !== -1) {
                enabledIds.splice(idx, 1);
            } else {
                enabledIds.push(presetId);
            }
            this.saveEnabledPresetIds(charId, enabledIds);
            return this.getPresets(charId);
        },

        /**
         * 数据迁移：将旧的按角色存储的预设迁移到全局
         */
        migratePresetsToGlobal: function() {
            if (localStorage.getItem('ruri_offline_presets_migrated')) return;
            
            const globalPresets = this.getGlobalPresets();
            const existingNames = new Set(globalPresets.map(p => p.name));
            const chars = API.Chat.getChars();
            
            chars.forEach(char => {
                try {
                    const oldPresets = JSON.parse(localStorage.getItem('ruri_offline_presets_' + char.id) || '[]');
                    const enabledIds = [];
                    
                    oldPresets.forEach(oldPreset => {
                        // 检查是否已存在同名预设
                        const existingGlobal = globalPresets.find(g => g.name === oldPreset.name && g.content === oldPreset.content);
                        if (existingGlobal) {
                            // 已存在，只记录启用状态
                            if (oldPreset.enabled) {
                                enabledIds.push(existingGlobal.id);
                            }
                        } else {
                            // 不存在，添加到全局
                            const newId = oldPreset.id || Date.now() + Math.random();
                            globalPresets.push({
                                id: newId,
                                name: oldPreset.name,
                                content: oldPreset.content
                            });
                            existingNames.add(oldPreset.name);
                            if (oldPreset.enabled) {
                                enabledIds.push(newId);
                            }
                        }
                    });
                    
                    if (enabledIds.length > 0) {
                        this.saveEnabledPresetIds(char.id, enabledIds);
                    }
                } catch (e) {
                    console.error('Error migrating presets for char:', char.id, e);
                }
            });
            
            this.saveGlobalPresets(globalPresets);
            localStorage.setItem('ruri_offline_presets_migrated', 'true');
            console.log('[Offline] Presets migrated to global storage');
        },

        // ==================== 字体预设 ====================

        getFontPresets: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_font_presets') || '[]');
            } catch (e) { return []; }
        },

        saveFontPresets: function(presets) {
            localStorage.setItem('ruri_offline_font_presets', JSON.stringify(presets));
        },

        addFontPreset: function(preset) {
            const presets = this.getFontPresets();
            presets.push({ id: Date.now(), name: preset.name, fontFamily: preset.fontFamily });
            this.saveFontPresets(presets);
        },

        updateFontPreset: function(id, update) {
            const presets = this.getFontPresets();
            const idx = presets.findIndex(p => p.id === id);
            if (idx !== -1) {
                if (update.name !== undefined) presets[idx].name = update.name;
                if (update.fontFamily !== undefined) presets[idx].fontFamily = update.fontFamily;
                this.saveFontPresets(presets);
            }
        },

        deleteFontPreset: function(id) {
            const presets = this.getFontPresets().filter(p => p.id !== id);
            this.saveFontPresets(presets);
        },

        // ==================== CSS 预设 ====================

        getCssPresets: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_css_presets') || '[]');
            } catch (e) { return []; }
        },

        saveCssPresets: function(presets) {
            localStorage.setItem('ruri_offline_css_presets', JSON.stringify(presets));
        },

        addCssPreset: function(preset) {
            const presets = this.getCssPresets();
            presets.push({ id: Date.now(), name: preset.name, css: preset.css });
            this.saveCssPresets(presets);
        },

        updateCssPreset: function(id, update) {
            const presets = this.getCssPresets();
            const idx = presets.findIndex(p => p.id === id);
            if (idx !== -1) {
                if (update.name !== undefined) presets[idx].name = update.name;
                if (update.css !== undefined) presets[idx].css = update.css;
                this.saveCssPresets(presets);
            }
        },

        deleteCssPreset: function(id) {
            const presets = this.getCssPresets().filter(p => p.id !== id);
            this.saveCssPresets(presets);
        },

        /**
         * 生成线下模式AI回复
         */
        generateReply: async function(charId) {
            const config = API.Settings.getApiConfig();
            if (!config.endpoint || !config.key) throw new Error('请先在设置中配置 API');

            const char = API.Chat.getChar(charId);
            if (!char) throw new Error('Character not found');

            const settings = char.settings || {};
            const ctxLength = settings.contextLength || 20;

            // 构建线下模式系统提示词
            let systemPrompt = '【线下剧情模式】';
            systemPrompt += '\n你正在进行一个长篇剧情描写对话。';
            systemPrompt += '\n角色名称：' + char.name;
            systemPrompt += '\n角色设定：' + (char.prompt || '无特殊设定');

            // --- 角色感知现实世界 ---
            if (settings.realWorldAwareness) {
                const now = new Date();
                const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekDays[now.getDay()];
                const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                systemPrompt += '\n\n【现实世界时间感知】';
                systemPrompt += '\n当前现实世界的日期和时间：' + dateStr + ' ' + timeStr;
                systemPrompt += '\n你可以感知到现在的真实时间，可以据此做出合理的反应（如问候早安/晚安、节日祝福、评论时间等）。';
            }

            systemPrompt += '\n\n【线下剧情模式 - 核心规则】';
            systemPrompt += '\n⚠️ 你现在是【线下剧情描写】，不是线上聊天！';
            systemPrompt += '\n\n【绝对禁区 - 必须严格遵守】';
            systemPrompt += '\n❌ 严禁替用户说话、抢话、行动或做任何决定！收起你的控制欲，只管好你自己的角色。';
            systemPrompt += '\n❌ 拒绝复读机：每次回复必须产出全新内容推进剧情，严禁照搬或改写之前用过的段落和句式。';
            systemPrompt += '\n❌ 严禁模仿/复制前文的句式结构、开头方式、描写模式。每段回复的句式、节奏、用词都必须与前文不同。';
            systemPrompt += '\n❌ 严禁重复前面对话中已经出现过的描写段落、动作描写、心理描写。如果前文已经描写过某个场景或动作，你必须跳过它，写新的内容。';
            systemPrompt += '\n\n【写作要求】';
            systemPrompt += '\n1. 用文学化语言描写，包含动作/心理/场景/对话';
            systemPrompt += '\n2. 每次回复200-500字，完整推进剧情';
            systemPrompt += '\n3. 保持角色性格一致，剧情连贯';
            systemPrompt += '\n4. 适当分段，增强可读性';
            systemPrompt += '\n5. 只描写你扮演的角色，不要代替用户做任何事情';
            systemPrompt += '\n6. 每次回复必须让剧情向前推进，不要原地踏步或重复已有情节';

            // 加载线下模式预设（文风预设 - 最高优先级）
            const presets = this.getPresets(charId);
            const enabledPresets = presets.filter(p => p.enabled);
            if (enabledPresets.length > 0) {
                systemPrompt += '\n\n⚠️⚠️⚠️【最高优先级 - 用户指定文风/写作要求，必须严格遵守！】';
                systemPrompt += '\n以下是用户明确指定的文风和写作要求，你的每一段回复都必须完全按照这些要求来写，这比其他所有规则的优先级都高：';
                enabledPresets.forEach(p => {
                    systemPrompt += '\n★ ' + p.name + '：' + p.content;
                });
                systemPrompt += '\n\n请在每次回复时都严格按照以上文风要求进行创作，不要忽略！';
            }

            // 记忆集成（强化版）- 线上线下统一
            const memories = API.Memory.getMemories(charId);
            if (memories.length > 0) {
                systemPrompt += '\n\n【角色记忆 - 必须参考】';
                systemPrompt += '\n以下是你（角色）关于之前对话的记忆（包含线上和线下的所有记忆），请务必参考来保持剧情的连贯性：';
                memories.forEach((m, i) => {
                    const typeLabel = m.type === 'auto' ? '自动总结' : '手动记忆';
                    systemPrompt += '\n[' + typeLabel + ' #' + (i + 1) + '] ' + m.content;
                });
            }

            // 世界书集成
            const worldBookIds = settings.worldBookIds || (settings.worldBookId ? [settings.worldBookId] : []);
            if (worldBookIds.length > 0) {
                const books = API.WorldBook.getBooks();
                const selectedBooks = books.filter(b => worldBookIds.includes(b.id));
                if (selectedBooks.length > 0) {
                    systemPrompt += '\n\n【世界背景设定】';
                    selectedBooks.forEach(wb => {
                        systemPrompt += '\n[' + wb.title + ']: ' + wb.content;
                    });
                }
            }

            // 用户面具集成 - 优先使用自定义人设内容，其次使用面具预设
            if (settings.customPersonaContent) {
                systemPrompt += '\n[用户人设信息: ' + settings.customPersonaContent + ']';
            } else if (settings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    systemPrompt += '\n[用户人设信息: ' + persona.content + ']';
                }
            }

            // 获取线下聊天记录，并合并线上聊天记录实现上下文互通
            const offlineHistory = this.getHistory(charId);
            const onlineHistory = API.Chat.getHistory(charId);
            
            // 合并线上和线下历史，按时间戳排序
            const mergedHistory = [];
            onlineHistory.forEach(msg => {
                // 跳过从线下同步过来的摘要消息（以 [线下剧情] 开头的），避免重复
                if (msg.content && typeof msg.content === 'string' && msg.content.startsWith('[线下剧情] ')) return;
                if (!msg.recalled) {
                    mergedHistory.push({ ...msg, _source: 'online' });
                }
            });
            offlineHistory.forEach(msg => {
                mergedHistory.push({ ...msg, _source: 'offline' });
            });
            
            // 按时间戳排序
            mergedHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            // 取最近 ctxLength 轮
            const recentMerged = mergedHistory.slice(-ctxLength);
            
            const recentHistory = recentMerged.map(msg => {
                const isOnline = msg._source === 'online';
                let content = msg.content;
                // 如果是线上模式的消息，添加标记让AI知道这是线上聊天
                if (isOnline && typeof content === 'string') {
                    content = '[线上聊天] ' + content;
                }
                return {
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: content
                };
            });

            const messages = [
                { role: 'system', content: systemPrompt }
            ].concat(recentHistory);

            // 末尾追加防重复+文风强制提醒
            let endReminder = '⚠️【回复前必读】\n1. 严禁重复前文已有的段落、句式、描写模式，每次回复必须是全新的内容和表达方式。\n2. 不要模仿前面对话的开头方式、句式结构，换一种完全不同的写法。\n3. 推进剧情向前发展，不要原地踏步。';
            if (enabledPresets.length > 0) {
                endReminder += '\n4. 严格按照用户指定的文风要求写作，不要忽略！';
            }
            messages.push({ role: 'system', content: endReminder });

            const response = await fetch(config.endpoint + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.key
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: config.temperature !== undefined ? config.temperature : 0.8,
                    max_tokens: 4096,
                    stream: true,  // 启用流式传输
                    safety_settings: API.Settings.getSafetySettings()
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            
            // 流式读取响应 - 接收完整内容后返回
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullReply = '';
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;
                        
                        try {
                            const jsonStr = trimmed.substring(6);
                            const chunk = JSON.parse(jsonStr);
                            const content = chunk.choices?.[0]?.delta?.content;
                            
                            if (content) {
                                fullReply += content;
                            }
                        } catch (e) {
                            console.warn('[OfflineStream] 解析chunk失败:', e);
                        }
                    }
                }
                
                // 接收完整内容后返回
                if (!fullReply.trim()) {
                    throw new Error('AI返回内容为空');
                }
                return fullReply.trim();
                
            } catch (e) {
                console.error('[OfflineStream] 读取失败:', e);
                throw e;
            }
        },

        /**
         * 线下剧情自动总结（使用统一的轮数计数器和记忆系统）
         */
        autoSummarizeOfflineChat: async function(charId) {
            // 线下模式也使用统一的轮数计数器和记忆系统
            // 直接调用线上的 checkAutoSummary，记忆会自动合并到统一的记忆App中
            await API.Chat.checkAutoSummary(charId);
        },

        // 线下总结存储 - 已废弃，统一使用 API.Memory
        // 保留这些方法是为了向后兼容，但实际上会重定向到统一的记忆系统
        getOfflineSummaries: function(charId) {
            // 返回空数组，因为线下总结已经合并到统一的记忆系统中
            return [];
        },

        saveOfflineSummaries: function(charId, summaries) {
            // 不再单独保存线下总结
            console.warn('[Offline] saveOfflineSummaries is deprecated, use API.Memory instead');
        },

        addOfflineSummary: function(charId, content) {
            // 重定向到统一的记忆系统
            return API.Memory.addMemory(charId, content, 'auto');
        },

        updateOfflineSummary: function(charId, index, content) {
            // 重定向到统一的记忆系统
            return API.Memory.updateMemory(charId, index, content);
        },

        deleteOfflineSummary: function(charId, index) {
            // 重定向到统一的记忆系统
            return API.Memory.deleteMemory(charId, index);
        },

        /**
         * IndexedDB 壁纸存储 - 保存
         */
        _saveWallpaperToIndexedDB: function(charId, data) {
            const request = indexedDB.open('ruri_offline_db', 1);
            request.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('wallpapers')) {
                    db.createObjectStore('wallpapers', { keyPath: 'charId' });
                }
            };
            request.onsuccess = function(e) {
                const db = e.target.result;
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                store.put({ charId: charId, data: data });
                console.log('[Offline] Wallpaper saved to IndexedDB for', charId);
            };
            request.onerror = function(e) {
                console.error('[Offline] IndexedDB open error:', e);
            };
        },

        /**
         * IndexedDB 壁纸存储 - 删除
         */
        _deleteWallpaperFromIndexedDB: function(charId) {
            const request = indexedDB.open('ruri_offline_db', 1);
            request.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('wallpapers')) {
                    db.createObjectStore('wallpapers', { keyPath: 'charId' });
                }
            };
            request.onsuccess = function(e) {
                const db = e.target.result;
                const tx = db.transaction('wallpapers', 'readwrite');
                const store = tx.objectStore('wallpapers');
                store.delete(charId);
                console.log('[Offline] Wallpaper deleted from IndexedDB for', charId);
            };
            request.onerror = function(e) {
                console.error('[Offline] IndexedDB open error:', e);
            };
        },

        /**
         * IndexedDB 壁纸存储 - 读取
         */
        _getWallpaperFromIndexedDB: function(charId, callback) {
            const request = indexedDB.open('ruri_offline_db', 1);
            request.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('wallpapers')) {
                    db.createObjectStore('wallpapers', { keyPath: 'charId' });
                }
            };
            request.onsuccess = function(e) {
                const db = e.target.result;
                const tx = db.transaction('wallpapers', 'readonly');
                const store = tx.objectStore('wallpapers');
                const getReq = store.get(charId);
                getReq.onsuccess = function() {
                    if (getReq.result && getReq.result.data) {
                        callback(getReq.result.data);
                    } else {
                        callback(null);
                    }
                };
                getReq.onerror = function() {
                    callback(null);
                };
            };
            request.onerror = function(e) {
                console.error('[Offline] IndexedDB open error:', e);
                callback(null);
            };
        }
    }
};
