/**
 * api.js
 * 负责所有涉及联网请求、API 调用、处理聊天数据的逻辑
 */

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
            try {
                return JSON.parse(localStorage.getItem('ruri_memories_' + charId) || '[]');
            } catch (e) {
                console.error('Error parsing memories:', e);
                return [];
            }
        },

        saveMemories: function(charId, memories) {
            if (!charId) return;
            localStorage.setItem('ruri_memories_' + charId, JSON.stringify(memories));
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

        generateSummary: async function(charId, charName, history, summaryPrompt) {
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
            
            // 如果绑定了用户面具，获取面具内容作为用户人设信息
            if (settings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === settings.userPersonaId);
                if (persona) {
                    userPersonaContent = persona.content || '';
                }
            }

            // Filter out recalled messages and format history
            const visibleHistory = history.filter(m => !m.recalled);
            const recentMessages = visibleHistory.slice(-20).map(m =>
                (m.sender === 'user' ? userName : charDisplayName) + ': ' + (m.type === 'image' ? '[发送了一张图片]' : m.content)
            ).join('\n');

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
                    temperature: 0.5
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
        getChars: function() {
            try {
                return JSON.parse(localStorage.getItem('ruri_chars') || '[]');
            } catch (e) {
                console.error('Error parsing chars:', e);
                return [];
            }
        },

        saveChars: function(chars) {
            localStorage.setItem('ruri_chars', JSON.stringify(chars));
        },

        getChar: function(charId) {
            const chars = this.getChars();
            return chars.find(c => c.id === charId);
        },

        addChar: function(charData) {
            let chars = this.getChars();
            chars.unshift(charData);
            this.saveChars(chars);
            return chars;
        },

        updateChar: function(charId, updateData) {
            let chars = this.getChars();
            const idx = chars.findIndex(c => c.id === charId);
            if (idx !== -1) {
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
            localStorage.removeItem('ruri_chat_history_' + charId);
            localStorage.removeItem('ruri_memories_' + charId);
        },

        getHistory: function(charId) {
            if (!charId) return [];
            try {
                return JSON.parse(localStorage.getItem('ruri_chat_history_' + charId) || '[]');
            } catch (e) {
                console.error('Error parsing history:', e);
                return [];
            }
        },

        saveHistory: function(charId, history) {
            if (!charId) return;
            localStorage.setItem('ruri_chat_history_' + charId, JSON.stringify(history));
            
            // Update last message in char list
            const lastMsg = history[history.length - 1];
            if (lastMsg) {
                let chars = this.getChars();
                const idx = chars.findIndex(c => c.id === charId);
                if (idx !== -1) {
                    chars[idx].lastMessage = lastMsg.type === 'image' ? '[图片]' : lastMsg.content;
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
            
            systemPrompt += '\n\n【聊天风格要求】';
            systemPrompt += '\n1. 这是线上即时通讯聊天，请像真人发微信/QQ一样说话';
            systemPrompt += '\n2. 每次回复至少说3句话以上，可以分多条消息发送（用换行分隔）';
            systemPrompt += '\n3. 根据角色性格决定话多话少：活泼的角色可以说更多，冷淡的角色可以简短但也要有内容';
            systemPrompt += '\n4. 只输出角色说的话，不要加任何动作描写、心理描写、场景描写、括号注释';
            systemPrompt += '\n5. 可以使用表情符号emoji来表达情绪，比如😊😂🤔😅等';
            systemPrompt += '\n6. 说话要自然口语化，可以用语气词如"嗯"、"啊"、"哈哈"、"emmm"等';
            systemPrompt += '\n7. 可以发多条消息，每条消息用换行符分隔，模拟真实聊天节奏';
            
            systemPrompt += '\n\n【错误示范 - 不要这样写】';
            systemPrompt += '\n❌ *微微一笑* 好的呀~ （这种带动作描写的不行）';
            systemPrompt += '\n❌ 「好开心」她说道。（这种带叙述的不行）';
            systemPrompt += '\n❌ (内心很高兴) 好啊！（这种带心理描写的不行）';
            
            systemPrompt += '\n\n【正确示范 - 应该这样写】';
            systemPrompt += '\n✅ 好的呀~';
            systemPrompt += '\n✅ 哈哈哈好啊！';
            systemPrompt += '\n✅ emmm让我想想';
            systemPrompt += '\n✅ 你在干嘛呢😊';
            
            // Add special commands instruction - more detailed and emphasized
            systemPrompt += '\n\n【特殊功能指令】';
            systemPrompt += '\n你可以使用以下指令增强聊天体验：';
            systemPrompt += '\n';
            systemPrompt += '\n★ 引用回复 [QUOTE:xxx]：';
            systemPrompt += '\n  格式：[QUOTE:关键词]你的回复';
            systemPrompt += '\n  示例：[QUOTE:好累]怎么了？工作太忙了吗？';
            systemPrompt += '\n';
            systemPrompt += '\n★ 撤回消息 [RECALL]：';
            systemPrompt += '\n  格式：消息内容[RECALL]';
            systemPrompt += '\n  用途：说错话或表现犹豫时使用';
            systemPrompt += '\n';
            systemPrompt += '\n★ 文字意念传图 [图片:描述]：';
            systemPrompt += '\n  格式：[图片:你想描述的画面内容]';
            systemPrompt += '\n  用途：当你想分享一张图片、描述一个场景、或展示某个画面时使用';
            systemPrompt += '\n  效果：会生成一张白底卡片，上面显示你描述的文字';
            systemPrompt += '\n  示例：[图片:窗外的夕阳，金色的光芒洒在云层上，美极了]';
            systemPrompt += '\n  示例：[图片:刚做好的蛋糕，上面有草莓和奶油装饰]';
            systemPrompt += '\n  注意：这是单独一条消息，不要和其他文字混在一起';

            // --- Memory Integration ---
            const memories = API.Memory.getMemories(charId);
            if (memories.length > 0) {
                const recentMemories = memories.slice(-5).map(m => m.content).join('; ');
                systemPrompt += '\n[Past Memories/Context: ' + recentMemories + ']';
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
            if (settings.userPersonaId) {
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
                    systemPrompt += '\n- 发送表情包时，只需要单独一行输出完整的URL即可';
                    systemPrompt += '\n\n可用表情包列表（含义: URL）：\n' + emojiList;
                }
            }

            const fullHistory = this.getHistory(charId);
            // Filter out recalled messages so AI doesn't see them
            const visibleHistory = fullHistory.filter(msg => !msg.recalled);
            const recentHistory = visibleHistory.slice(-ctxLength).map(msg => {
                let content = '';
                
                // 处理图片/表情包消息 - 尝试匹配表情包含义
                if (msg.type === 'image') {
                    const imgUrl = msg.content;
                    if (emojiMap[imgUrl]) {
                        // 匹配到表情包，显示含义
                        content = '[发送了表情包：' + emojiMap[imgUrl] + ']';
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
                
                // 处理引用消息 - 显示完整引用内容，让AI清楚知道用户引用了什么
                if (msg.quote) {
                    const quotedMsg = fullHistory.find(m => m.id === msg.quote.id);
                    if (quotedMsg && !quotedMsg.recalled) {
                        let quotedContent = quotedMsg.content;
                        let quotedType = '文字消息';
                        
                        // 如果引用的是表情包，显示含义
                        if (quotedMsg.type === 'image' && emojiMap[quotedMsg.content]) {
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
                
                return {
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: content
                };
            });

            const messages = [
                { role: 'system', content: systemPrompt }
            ].concat(recentHistory);

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
                    max_tokens: 4096  // 限制AI单次输出不超过约1万字符
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            
            const data = await response.json();
            const reply = data.choices[0].message.content;
            
            // Return bubbles array
            return reply.split('\n').filter(t => t.trim());
        },

        checkAutoSummary: async function(charId) {
            const char = this.getChar(charId);
            if (!char) return;
            const settings = char.settings || {};
            
            if (settings.autoSummary) {
                const history = this.getHistory(charId);
                if (history.length % (settings.summaryFreq || 10) === 0) {
                    try {
                        const summary = await API.Memory.generateSummary(charId, char.name, history, settings.summaryPrompt);
                        API.Memory.addMemory(charId, summary, 'auto');
                        console.log('Auto summary generated for', char.name);
                    } catch (e) {
                        console.error('Auto summary failed:', e);
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
    }
};
