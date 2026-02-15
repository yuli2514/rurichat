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
            
            // 如果绑定了用户面具，获取面具内容作为用户人设信息
            if (settings.userPersonaId) {
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
                const raw = localStorage.getItem('ruri_chars');
                if (!raw || raw === 'undefined' || raw === 'null') return [];
                const parsed = JSON.parse(raw);
                // 确保返回的是数组
                if (!Array.isArray(parsed)) {
                    console.error('ruri_chars is not an array, resetting. Value type:', typeof parsed);
                    return [];
                }
                // 过滤掉无效的角色数据（必须有id）
                return parsed.filter(c => c && typeof c === 'object' && c.id);
            } catch (e) {
                console.error('Error parsing chars:', e);
                // 尝试备份损坏的数据
                try {
                    const corrupted = localStorage.getItem('ruri_chars');
                    if (corrupted) {
                        localStorage.setItem('ruri_chars_backup_' + Date.now(), corrupted);
                        console.log('Corrupted chars data backed up');
                    }
                } catch (backupErr) {
                    console.error('Failed to backup corrupted data:', backupErr);
                }
                return [];
            }
        },

        saveChars: function(chars) {
            try {
                // 确保是数组
                if (!Array.isArray(chars)) {
                    console.error('saveChars: chars is not an array!');
                    chars = [];
                }
                // 过滤掉无效数据
                const validChars = chars.filter(c => c && typeof c === 'object' && c.id);
                localStorage.setItem('ruri_chars', JSON.stringify(validChars));
            } catch (e) {
                console.error('Error saving chars:', e);
                // 如果是存储空间满，尝试清理
                if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                    console.error('Storage quota exceeded! Trying to save without avatars...');
                    try {
                        // 尝试压缩：移除大型头像数据
                        const compressedChars = chars.map(c => {
                            if (c && c.avatar && c.avatar.length > 10000) {
                                return { ...c, avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name || 'AI') + '&background=random' };
                            }
                            return c;
                        });
                        localStorage.setItem('ruri_chars', JSON.stringify(compressedChars));
                        console.log('Saved chars with compressed avatars');
                    } catch (e2) {
                        console.error('Still failed to save chars:', e2);
                        throw new Error('存储空间不足，请清理一些数据后重试');
                    }
                } else {
                    throw e;
                }
            }
        },

        getChar: function(charId) {
            const chars = this.getChars();
            return chars.find(c => c.id === charId);
        },

        addChar: function(charData) {
            // 验证角色数据
            if (!charData || !charData.id) {
                throw new Error('角色数据无效：缺少ID');
            }
            let chars = this.getChars();
            // 确保是数组
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
                    chars[idx].lastMessage = lastMsg.type === 'image' ? '[图片]' : (lastMsg.type === 'emoji' ? '[表情包]' : lastMsg.content);
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
            systemPrompt += '\n';
            systemPrompt += '\n★ 语音消息 [语音:内容]：';
            systemPrompt += '\n  格式：[语音:你想说的话]';
            systemPrompt += '\n  用途：当你想发送语音消息时使用，会显示为语音气泡';
            systemPrompt += '\n  示例：[语音:哈喽~在干嘛呢]';
            systemPrompt += '\n  示例：[语音:好的好的，我知道啦]';
            systemPrompt += '\n  注意：这是单独一条消息，不要和其他文字混在一起';
            systemPrompt += '\n';
            systemPrompt += '\n★ 转账消息 [转账:金额] 或 [转账:金额:备注]：';
            systemPrompt += '\n  格式：[转账:100] 或 [转账:100:给你买奶茶]';
            systemPrompt += '\n  用途：当你想给用户转账/发红包时使用，会显示为粉色转账卡片';
            systemPrompt += '\n  示例：[转账:520:爱你哦]';
            systemPrompt += '\n  示例：[转账:88.88:生日快乐]';
            systemPrompt += '\n  注意：这是单独一条消息，不要和其他文字混在一起，不要用[图片:]来描述转账';
            systemPrompt += '\n  ⚠️ 重要：如果聊天记录中已经有你发过的转账记录，不要重复发送新转账！除非用户明确要求你再转一次。';
            systemPrompt += '\n';
            systemPrompt += '\n★ 领取转账 [领取转账]：';
            systemPrompt += '\n  格式：[领取转账]';
            systemPrompt += '\n  用途：当用户给你转账后，你想收下时使用';
            systemPrompt += '\n  注意：根据角色性格和剧情决定是否领取，可以拒绝或犹豫';
            systemPrompt += '\n  ⚠️ 重要：如果聊天记录显示你已经领取了某笔转账，不要重复领取。已领取的转账会标注"已经领取"。';


            systemPrompt += '\\n\\n【⚠️ 格式严格要求 - 必须遵守】';
            systemPrompt += '\\n以下格式必须严格遵守，每种特殊消息必须单独占一行，不能和普通文字混在同一行：';
            systemPrompt += '\\n';
            systemPrompt += '\\n1. 表情包格式：必须单独一行输出完整URL，不加任何修饰';
            systemPrompt += '\\n   ✅ 正确：https://example.com/emoji.png';
            systemPrompt += '\\n   ❌ 错误：![表情](https://example.com/emoji.png)';
            systemPrompt += '\\n   ❌ 错误：[表情](https://example.com/emoji.png)';
            systemPrompt += '\\n   ❌ 错误：看这个表情 https://example.com/emoji.png';
            systemPrompt += '\\n';
            systemPrompt += '\\n2. 语音格式：[语音:内容] 必须单独一行';
            systemPrompt += '\\n   ✅ 正确（单独一行）：[语音:你好呀~]';
            systemPrompt += '\\n   ❌ 错误（混在文字里）：我想说[语音:你好呀~]给你听';
            systemPrompt += '\\n';
            systemPrompt += '\\n3. 图片格式：[图片:描述] 必须单独一行';
            systemPrompt += '\\n   ✅ 正确（单独一行）：[图片:窗外的夕阳]';
            systemPrompt += '\\n   ❌ 错误（混在文字里）：你看[图片:窗外的夕阳]好美';
            systemPrompt += '\\n';
            systemPrompt += '\\n4. 转账格式：[转账:金额] 或 [转账:金额:备注] 必须单独一行';
            systemPrompt += '\\n   ✅ 正确（单独一行）：[转账:100:请你喝奶茶]';
            systemPrompt += '\\n   ❌ 错误（混在文字里）：给你[转账:100]买东西';
            systemPrompt += '\\n';
            systemPrompt += '\\n5. 引用格式：[QUOTE:关键词] 必须在行首，后面紧跟回复内容';
            systemPrompt += '\\n   ✅ 正确：[QUOTE:好累]怎么了？';
            systemPrompt += '\\n';
            systemPrompt += '\\n⚠️ 再次强调：语音、图片、转账、表情包URL 都必须单独占一行，绝对不能和其他文字混在一起！';

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
                if (!msg.recalled) {
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
                // 处理表情包消息（新的emoji类型）
                else if (msg.type === 'emoji') {
                    const meaning = msg.emojiMeaning || emojiMap[msg.content] || '未知表情';
                    content = '[用户发送了一个表情包，表情包的含义是：「' + meaning + '」，请注意这不是图片，是表情包，请根据表情包的含义来理解用户的情绪和意图]';
                }
                // 处理图片消息
                else if (msg.type === 'image') {
                    const imgUrl = msg.content;
                    if (emojiMap[imgUrl]) {
                        // 匹配到表情包，显示含义
                        content = '[用户发送了一个表情包，表情包的含义是：「' + emojiMap[imgUrl] + '」，请注意这不是图片，是表情包，请根据表情包的含义来理解用户的情绪和意图]';
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
                const freq = settings.summaryFreq || 10;
                // 只有当历史消息数量达到freq的倍数时才触发总结
                if (history.length > 0 && history.length % freq === 0) {
                    try {
                        // 传入freq作为总结的轮数范围，确保根据用户设置的轮数来总结
                        const summary = await API.Memory.generateSummary(charId, char.name, history, settings.summaryPrompt, freq);
                        API.Memory.addMemory(charId, summary, 'auto');
                        console.log('[AutoSummary] 自动总结已生成, 角色:', char.name, '总结轮数:', freq, '历史总数:', history.length);
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
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_history_' + charId) || '[]');
            } catch (e) {
                console.error('Error parsing offline history:', e);
                return [];
            }
        },

        saveHistory: function(charId, history) {
            if (!charId) return;
            localStorage.setItem('ruri_offline_history_' + charId, JSON.stringify(history));
        },

        addMessage: function(charId, msg) {
            const history = this.getHistory(charId);
            history.push(msg);
            this.saveHistory(charId, history);
            return history;
        },

        getSettings: function(charId) {
            if (!charId) return {};
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_settings_' + charId) || '{}');
            } catch (e) {
                console.error('Error parsing offline settings:', e);
                return {};
            }
        },

        saveSettings: function(charId, update) {
            if (!charId) return;
            const current = this.getSettings(charId);
            const merged = { ...current, ...update };
            
            // 检查壁纸大小，大型图片存到 IndexedDB
            if (merged.wallpaper && merged.wallpaper.length > 500000) {
                const wallpaperData = merged.wallpaper;
                merged.wallpaper = ''; // 清空 localStorage 中的大图
                this._saveWallpaperToIndexedDB(charId, wallpaperData);
            }
            
            localStorage.setItem('ruri_offline_settings_' + charId, JSON.stringify(merged));
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

            systemPrompt += '\n\n【写作要求】';
            systemPrompt += '\n1. 这是线下剧情描写模式，请用文学化的语言进行描写';
            systemPrompt += '\n2. 可以包含动作描写、心理描写、场景描写、对话等';
            systemPrompt += '\n3. 每次回复请写一段完整的剧情推进，字数在200-500字之间';
            systemPrompt += '\n4. 保持角色性格一致，注意剧情连贯性';
            systemPrompt += '\n5. 适当使用段落分隔，增强可读性';

            // 加载线下模式预设
            const presets = this.getPresets(charId);
            const enabledPresets = presets.filter(p => p.enabled);
            if (enabledPresets.length > 0) {
                systemPrompt += '\n\n【用户自定义写作要求】';
                enabledPresets.forEach(p => {
                    systemPrompt += '\n- ' + p.name + ': ' + p.content;
                });
            }

            // 记忆集成（强化版）
            const memories = API.Memory.getMemories(charId);
            if (memories.length > 0) {
                systemPrompt += '\n\n【角色记忆 - 必须参考】';
                systemPrompt += '\n以下是你（角色）关于之前对话的记忆，请务必参考来保持剧情的连贯性：';
                memories.forEach((m, i) => {
                    const typeLabel = m.type === 'auto' ? '自动总结' : '手动记忆';
                    systemPrompt += '\n[' + typeLabel + ' #' + (i + 1) + '] ' + m.content;
                });
            }

            // 线下总结集成
            const offlineSummaries = this.getOfflineSummaries(charId);
            if (offlineSummaries.length > 0) {
                const recentSummaries = offlineSummaries.slice(-3).map(s => s.content).join('; ');
                systemPrompt += '\n\n[线下剧情总结: ' + recentSummaries + ']';
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

            // 用户面具集成
            if (settings.userPersonaId) {
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
                    max_tokens: 4096
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            
            const data = await response.json();
            return data.choices[0].message.content;
        },

        /**
         * 线下剧情自动总结
         */
        autoSummarizeOfflineChat: async function(charId) {
            const char = API.Chat.getChar(charId);
            if (!char) return;
            const settings = char.settings || {};
            
            if (settings.autoSummary) {
                const history = this.getHistory(charId);
                const freq = settings.summaryFreq || 10;
                if (history.length > 0 && history.length % freq === 0) {
                    try {
                        const summary = await this.generateOfflineSummary(charId, char.name, history, settings.summaryPrompt);
                        this.addOfflineSummary(charId, summary);
                        console.log('[Offline] Auto summary generated for', char.name);
                    } catch (e) {
                        console.error('[Offline] Auto summary failed:', e);
                    }
                }
            }
        },

        /**
         * 生成线下剧情总结
         */
        generateOfflineSummary: async function(charId, charName, history, summaryPrompt) {
            const config = API.Settings.getApiConfig();
            if (!config.endpoint || !config.key) throw new Error('请先在设置中配置 API');
            if (history.length === 0) throw new Error('暂无线下聊天记录可总结');

            const char = API.Chat.getChar(charId);
            const settings = char && char.settings ? char.settings : {};
            const charDisplayName = settings.charNameForSummary || (char ? char.name : null) || charName;
            let userName = settings.userName || '用户';

            // 使用用户设置的轮数来决定总结范围
            const rounds = settings.summaryFreq || 20;
            const recentMessages = history.slice(-rounds).map(m =>
                (m.sender === 'user' ? userName : charDisplayName) + ': ' + m.content
            ).join('\n');

            let systemContent = '';
            if (summaryPrompt) {
                systemContent = summaryPrompt;
            } else {
                systemContent = '你是一个剧情总结助手。请以第三人称视角总结以下线下剧情对话的关键信息。';
                systemContent += '\n\n【角色信息】';
                systemContent += '\n- 角色名称: ' + charDisplayName;
                systemContent += '\n\n【总结要求】';
                systemContent += '\n1. 使用第三人称描述剧情发展';
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
                        { role: 'user', content: '以下是线下剧情聊天记录：\n\n' + recentMessages }
                    ],
                    temperature: 0.5
                })
            });

            if (!response.ok) throw new Error('API Request Failed');
            const data = await response.json();
            return data.choices[0].message.content;
        },

        // 线下总结存储
        getOfflineSummaries: function(charId) {
            if (!charId) return [];
            try {
                return JSON.parse(localStorage.getItem('ruri_offline_summaries_' + charId) || '[]');
            } catch (e) {
                console.error('Error parsing offline summaries:', e);
                return [];
            }
        },

        saveOfflineSummaries: function(charId, summaries) {
            if (!charId) return;
            localStorage.setItem('ruri_offline_summaries_' + charId, JSON.stringify(summaries));
        },

        addOfflineSummary: function(charId, content) {
            const summaries = this.getOfflineSummaries(charId);
            summaries.push({
                id: 'offline_sum_' + Date.now(),
                content: content,
                timestamp: Date.now(),
                type: 'auto'
            });
            this.saveOfflineSummaries(charId, summaries);
            return summaries;
        },

        updateOfflineSummary: function(charId, index, content) {
            const summaries = this.getOfflineSummaries(charId);
            if (summaries[index]) {
                summaries[index].content = content;
                this.saveOfflineSummaries(charId, summaries);
            }
            return summaries;
        },

        deleteOfflineSummary: function(charId, index) {
            const summaries = this.getOfflineSummaries(charId);
            summaries.splice(index, 1);
            this.saveOfflineSummaries(charId, summaries);
            return summaries;
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
