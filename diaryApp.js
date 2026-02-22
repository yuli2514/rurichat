/**
 * DiaryApp - 日记功能模块
 * 提供日记生成、查看、设置等功能
 */

const DiaryApp = {
    currentCharId: null,
    isGenerating: false,
    currentDiaryDate: null,
    scheduleCheckInterval: null,

    /**
     * 初始化日记应用
     */
    init: function() {
        // 等待组件加载完成后再初始化
        if (typeof AppEvents !== 'undefined') {
            AppEvents.on('components:allLoaded', () => {
                this.initExpandPanelSwipe();
                this.initSettingsListeners();
            });
        } else {
            // 如果AppEvents不存在，延迟初始化
            setTimeout(() => {
                this.initExpandPanelSwipe();
                this.initSettingsListeners();
            }, 1000);
        }
        
        // 启动定时检查
        this.startScheduleCheck();
    },

    /**
     * 初始化expand panel滑动功能
     */
    initExpandPanelSwipe: function() {
        const container = document.getElementById('expand-pages-container');
        if (!container) return;

        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        let currentPage = 0;

        // 触摸事件处理
        const handleStart = (clientX) => {
            startX = clientX;
            isDragging = true;
            container.style.transition = 'none';
        };

        const handleMove = (clientX) => {
            if (!isDragging) return;
            currentX = clientX;
            const diff = currentX - startX;
            const offset = -currentPage * 50 + (diff / container.offsetWidth) * 50;
            container.style.transform = `translateX(${offset}%)`;
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            container.style.transition = 'transform 0.3s';

            const diff = currentX - startX;
            const threshold = container.offsetWidth * 0.2;

            if (diff < -threshold && currentPage < 1) {
                currentPage++;
            } else if (diff > threshold && currentPage > 0) {
                currentPage--;
            }

            container.style.transform = `translateX(-${currentPage * 50}%)`;
            this.updatePageIndicators(currentPage);
        };

        // 触摸事件
        container.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientX);
        });

        container.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].clientX);
        });

        container.addEventListener('touchend', (e) => {
            handleEnd();
        });

        // 鼠标事件（电脑端）
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleStart(e.clientX);
        });

        container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                handleMove(e.clientX);
            }
        });

        container.addEventListener('mouseup', (e) => {
            handleEnd();
        });

        container.addEventListener('mouseleave', (e) => {
            if (isDragging) {
                handleEnd();
            }
        });
    },

    /**
     * 更新页面指示器
     */
    updatePageIndicators: function(page) {
        for (let i = 0; i < 2; i++) {
            const indicator = document.getElementById(`expand-indicator-${i}`);
            if (indicator) {
                if (i === page) {
                    indicator.classList.remove('bg-gray-300');
                    indicator.classList.add('bg-gray-400');
                } else {
                    indicator.classList.remove('bg-gray-400');
                    indicator.classList.add('bg-gray-300');
                }
            }
        }
    },

    /**
     * 打开日记界面
     */
    open: function() {
        this.currentCharId = ChatInterface.currentCharId;
        if (!this.currentCharId) {
            alert('请先选择一个角色');
            return;
        }

        const diaryApp = document.getElementById('diary-app');
        diaryApp.classList.remove('hidden');
        
        // 加载设置
        this.loadSettings();
        
        // 加载今天的日记（如果有）
        this.loadTodayDiary();
    },

    /**
     * 关闭日记界面
     */
    close: function() {
        const diaryApp = document.getElementById('diary-app');
        diaryApp.classList.add('hidden');
    },

    /**
     * 生成日记 - 直接调用API，绕过聊天系统提示词
     */
    generateDiary: async function() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        const diaryText = document.getElementById('diary-text');
        diaryText.textContent = '正在生成日记...';

        try {
            // 获取API配置
            const config = API.Settings.getApiConfig();
            if (!config.endpoint || !config.key) {
                throw new Error('请先在设置中配置 API');
            }

            // 获取角色信息
            const character = API.Chat.getChar(this.currentCharId);
            if (!character) {
                throw new Error('角色不存在');
            }

            const charSettings = character.settings || {};

            // 获取用户人设
            let userPersona = '';
            if (charSettings.customPersonaContent) {
                userPersona = charSettings.customPersonaContent;
            } else if (charSettings.userPersonaId) {
                const personas = API.Profile.getPersonas();
                const persona = personas.find(p => p.id === charSettings.userPersonaId);
                if (persona) userPersona = persona.content || '';
            }
            
            // 获取今天的聊天记忆
            const todayMemories = this.getTodayMemories();
            
            // 获取记忆条目
            const memories = API.Memory.getMemories(this.currentCharId);
            
            // 获取设置
            const settings = this.getSettings();
            const wordCount = settings.wordCount || 500;
            const customStyle = settings.customStyle || '';

            // 获取当前日期
            const today = new Date();
            const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 ${weekDays[today.getDay()]}`;
            
            // 构建系统提示词（专门用于日记生成，不含聊天模式限制）
            let systemPrompt = '你是一个日记写作助手。你需要以指定角色的第一人称视角写一篇日记。';
            systemPrompt += '\n\n【角色信息】';
            systemPrompt += '\n角色名称：' + character.name;
            systemPrompt += '\n角色设定：' + (character.prompt || '无特殊设定');
            
            if (userPersona) {
                systemPrompt += '\n\n【用户信息（日记中的"你"或对方）】';
                systemPrompt += '\n' + userPersona;
            }

            // 获取上下文（最近聊天记录）
            const ctxLength = charSettings.contextLength || 20;
            const history = API.Chat.getHistory(this.currentCharId);
            if (history && history.length > 0) {
                const recentHistory = history.slice(-ctxLength);
                const charName = character.name;
                const contextLines = recentHistory.map(msg => {
                    const sender = msg.sender === 'user' ? '用户' : charName;
                    let content = msg.content || '';
                    if (msg.type === 'image') content = '[发送了一张图片]';
                    else if (msg.type === 'emoji') content = '[发送了表情包]';
                    else if (msg.type === 'transfer') content = '[转账]';
                    else if (msg.type === 'voice') content = (msg.voiceData && msg.voiceData.transcription) || '[语音消息]';
                    return sender + ': ' + content;
                }).join('\n');
                systemPrompt += '\n\n【近期上下文对话】';
                systemPrompt += '\n' + contextLines;
            }
            
            if (memories.length > 0) {
                systemPrompt += '\n\n【角色记忆】';
                memories.forEach((m, i) => {
                    systemPrompt += '\n' + (i + 1) + '. ' + m.content;
                });
            }

            // 获取绑定的世界书
            const worldBookIds = charSettings.worldBookIds || (charSettings.worldBookId ? [charSettings.worldBookId] : []);
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

            // 构建用户提示词
            let userPrompt = `请以第一人称写一篇日记。\n\n`;
            userPrompt += `【要求】\n`;
            userPrompt += `1. 第一行写上日期：${dateStr}\n`;
            userPrompt += `2. 以"${character.name}"的口吻和风格来写，要符合角色性格\n`;
            userPrompt += `3. 字数约${wordCount}字\n`;
            userPrompt += `4. 内容要真实自然，像真正的日记，有情感和细节\n`;
            
            if (todayMemories) {
                userPrompt += `\n【今天发生的事情（参考素材）】\n${todayMemories}\n`;
            }
            
            if (customStyle) {
                userPrompt += `\n【文风要求】\n${customStyle}\n`;
            }
            
            userPrompt += `\n请直接开始写日记，不要加任何前缀说明。`;

            console.log('[DiaryApp] 系统提示词:', systemPrompt);
            console.log('[DiaryApp] 用户提示词:', userPrompt);

            // 直接调用API
            const response = await fetch(config.endpoint + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.key
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.8,
                    max_tokens: Math.max(wordCount * 3, 1500)
                })
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error('API请求失败: HTTP ' + response.status + (errText ? ' - ' + errText : ''));
            }

            const data = await response.json();
            const diaryContent = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            
            console.log('[DiaryApp] AI返回结果:', diaryContent);
            
            if (diaryContent && diaryContent.trim()) {
                diaryText.textContent = diaryContent.trim();
                this.saveDiary(diaryContent.trim());
            } else {
                throw new Error('AI未返回内容');
            }
        } catch (error) {
            console.error('生成日记失败:', error);
            diaryText.textContent = '生成失败，请重试';
            alert('生成日记失败: ' + error.message);
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * 获取今天的聊天记忆
     */
    getTodayMemories: function() {
        try {
            const history = API.Chat.getHistory(this.currentCharId);
            if (!history || history.length === 0) return '';
            
            const today = new Date().toDateString();
            const char = API.Chat.getChar(this.currentCharId);
            const charName = char ? char.name : '角色';
            
            const todayMessages = history.filter(msg => {
                const msgDate = new Date(msg.timestamp || 0).toDateString();
                return msgDate === today;
            });
            
            if (todayMessages.length === 0) return '';
            
            // 只取最近50条避免过长
            const recent = todayMessages.slice(-50);
            return recent.map(msg => {
                const sender = msg.sender === 'user' ? '用户' : charName;
                let content = msg.content || '';
                if (msg.type === 'image') content = '[发送了一张图片]';
                else if (msg.type === 'emoji') content = '[发送了表情包]';
                else if (msg.type === 'transfer') content = '[转账]';
                else if (msg.type === 'voice') content = (msg.voiceData && msg.voiceData.transcription) || '[语音消息]';
                return sender + ': ' + content;
            }).join('\n');
        } catch (error) {
            console.error('获取今天记忆失败:', error);
            return '';
        }
    },

    /**
     * 保存日记
     */
    saveDiary: function(content) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const diaries = this.loadDiaries();
            
            diaries[date] = {
                content: content,
                timestamp: Date.now(),
                charId: this.currentCharId
            };
            
            localStorage.setItem(`diaries_${this.currentCharId}`, JSON.stringify(diaries));
            this.currentDiaryDate = date;
        } catch (error) {
            console.error('保存日记失败:', error);
        }
    },

    /**
     * 加载所有日记
     */
    loadDiaries: function() {
        try {
            return JSON.parse(localStorage.getItem(`diaries_${this.currentCharId}`) || '{}');
        } catch (error) {
            console.error('加载日记失败:', error);
            return {};
        }
    },

    /**
     * 加载今天的日记
     */
    loadTodayDiary: function() {
        const date = new Date().toISOString().split('T')[0];
        const diaries = this.loadDiaries();
        const diaryText = document.getElementById('diary-text');
        
        if (diaries[date]) {
            diaryText.textContent = diaries[date].content;
            this.currentDiaryDate = date;
        } else {
            diaryText.textContent = '点击右上角"生成"按钮来创建今天的日记';
        }
    },

    /**
     * 打开历史日记
     */
    openHistory: function() {
        const historyDiv = document.getElementById('diary-history');
        const listDiv = document.getElementById('diary-history-list');
        
        historyDiv.classList.remove('hidden');
        
        // 加载历史日记列表
        const diaries = this.loadDiaries();
        const dates = Object.keys(diaries).sort().reverse();
        
        if (dates.length === 0) {
            listDiv.innerHTML = '<div class="text-center text-gray-500 mt-10">暂无历史日记</div>';
            return;
        }
        
        let html = '';
        dates.forEach(date => {
            const diary = diaries[date];
            const preview = diary.content.substring(0, 100) + (diary.content.length > 100 ? '...' : '');
            html += `
                <div onclick="DiaryApp.viewHistoryDiary('${date}')" class="bg-white rounded-lg p-4 mb-3 shadow-sm active:scale-95 transition cursor-pointer">
                    <div class="font-medium text-gray-900 mb-2">${date}</div>
                    <div class="text-sm text-gray-600 line-clamp-3">${preview}</div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    },

    /**
     * 关闭历史日记
     */
    closeHistory: function() {
        const historyDiv = document.getElementById('diary-history');
        historyDiv.classList.add('hidden');
    },

    /**
     * 查看历史日记
     */
    viewHistoryDiary: function(date) {
        const diaries = this.loadDiaries();
        const diary = diaries[date];
        
        if (diary) {
            const diaryText = document.getElementById('diary-text');
            diaryText.textContent = diary.content;
            this.currentDiaryDate = date;
            this.closeHistory();
        }
    },

    /**
     * 打开设置
     */
    openSettings: function() {
        const settingsDiv = document.getElementById('diary-settings');
        settingsDiv.classList.remove('hidden');
        
        // 加载当前设置
        this.loadSettings();
    },

    /**
     * 关闭设置
     */
    closeSettings: function() {
        const settingsDiv = document.getElementById('diary-settings');
        settingsDiv.classList.add('hidden');
    },

    /**
     * 初始化设置监听器
     */
    initSettingsListeners: function() {
        // 字体大小滑块
        const fontSizeInput = document.getElementById('diary-font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        
        if (fontSizeInput && fontSizeValue) {
            fontSizeInput.addEventListener('input', (e) => {
                fontSizeValue.textContent = e.target.value;
            });
        }

        // 字体预设选择
        const fontPresetSelect = document.getElementById('diary-font-preset');
        if (fontPresetSelect) {
            fontPresetSelect.addEventListener('change', (e) => {
                const name = e.target.value;
                if (!name) return;
                
                const presets = JSON.parse(localStorage.getItem('diary_font_presets') || '[]');
                const preset = presets.find(p => p.name === name);
                
                if (preset) {
                    document.getElementById('diary-font-url').value = preset.fontUrl || '';
                    document.getElementById('diary-font-size').value = preset.fontSize || 16;
                    document.getElementById('font-size-value').textContent = preset.fontSize || 16;
                    document.getElementById('diary-font-color').value = preset.fontColor || '#000000';
                }
            });
        }

        // 文风预设选择
        const stylePresetSelect = document.getElementById('diary-style-preset');
        if (stylePresetSelect) {
            stylePresetSelect.addEventListener('change', (e) => {
                const name = e.target.value;
                if (!name) return;
                
                const presets = JSON.parse(localStorage.getItem('diary_style_presets') || '[]');
                const preset = presets.find(p => p.name === name);
                
                if (preset) {
                    document.getElementById('diary-custom-style').value = preset.customStyle || '';
                }
            });
        }

        // 背景图上传
        const bgUpload = document.getElementById('diary-bg-upload');
        if (bgUpload) {
            bgUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const diaryContent = document.getElementById('diary-content');
                        diaryContent.style.backgroundImage = `url(${event.target.result})`;
                        localStorage.setItem(`diary_bg_${this.currentCharId}`, event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    },

    /**
     * 保存设置
     */
    saveSettings: function() {
        const settings = {
            fontUrl: document.getElementById('diary-font-url').value,
            fontSize: document.getElementById('diary-font-size').value,
            fontColor: document.getElementById('diary-font-color').value,
            wordCount: document.getElementById('diary-word-count').value,
            scheduleEnabled: document.getElementById('diary-schedule-enabled').checked,
            scheduleTime: document.getElementById('diary-schedule-time').value,
            customStyle: document.getElementById('diary-custom-style').value
        };
        
        localStorage.setItem(`diary_settings_${this.currentCharId}`, JSON.stringify(settings));
        
        // 应用设置
        this.applySettings(settings);
        
        alert('设置已保存');
        this.closeSettings();
    },

    /**
     * 加载设置
     */
    loadSettings: function() {
        const settings = this.getSettings();
        
        document.getElementById('diary-font-url').value = settings.fontUrl || '';
        document.getElementById('diary-font-size').value = settings.fontSize || 16;
        document.getElementById('font-size-value').textContent = settings.fontSize || 16;
        document.getElementById('diary-font-color').value = settings.fontColor || '#000000';
        document.getElementById('diary-word-count').value = settings.wordCount || 500;
        document.getElementById('diary-schedule-enabled').checked = settings.scheduleEnabled || false;
        document.getElementById('diary-schedule-time').value = settings.scheduleTime || '21:00';
        document.getElementById('diary-custom-style').value = settings.customStyle || '';
        
        // 加载字体预设列表
        this.loadFontPresets();
        
        // 加载文风预设列表
        this.loadStylePresets();
        
        // 应用设置
        this.applySettings(settings);
        
        // 加载背景图
        const bg = localStorage.getItem(`diary_bg_${this.currentCharId}`);
        if (bg) {
            const diaryContent = document.getElementById('diary-content');
            diaryContent.style.backgroundImage = `url(${bg})`;
        }
    },

    /**
     * 加载字体预设列表
     */
    loadFontPresets: function() {
        const presets = JSON.parse(localStorage.getItem('diary_font_presets') || '[]');
        const select = document.getElementById('diary-font-preset');
        
        select.innerHTML = '<option value="">选择预设</option>';
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = preset.name;
            select.appendChild(option);
        });
    },

    /**
     * 保存字体预设
     */
    saveFontPreset: function() {
        const name = document.getElementById('diary-font-preset-name').value.trim();
        if (!name) {
            alert('请输入预设名称');
            return;
        }

        const fontUrl = document.getElementById('diary-font-url').value;
        const fontSize = document.getElementById('diary-font-size').value;
        const fontColor = document.getElementById('diary-font-color').value;

        const presets = JSON.parse(localStorage.getItem('diary_font_presets') || '[]');
        
        // 检查是否已存在
        const existingIndex = presets.findIndex(p => p.name === name);
        const preset = {
            name: name,
            fontUrl: fontUrl,
            fontSize: fontSize,
            fontColor: fontColor
        };

        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }

        localStorage.setItem('diary_font_presets', JSON.stringify(presets));
        this.loadFontPresets();
        alert('字体预设已保存');
    },

    /**
     * 删除字体预设
     */
    deleteFontPreset: function() {
        const select = document.getElementById('diary-font-preset');
        const name = select.value;
        
        if (!name) {
            alert('请先选择要删除的预设');
            return;
        }

        if (!confirm(`确定要删除预设"${name}"吗？`)) {
            return;
        }

        const presets = JSON.parse(localStorage.getItem('diary_font_presets') || '[]');
        const filtered = presets.filter(p => p.name !== name);
        localStorage.setItem('diary_font_presets', JSON.stringify(filtered));
        
        this.loadFontPresets();
        alert('预设已删除');
    },

    /**
     * 加载文风预设列表
     */
    loadStylePresets: function() {
        const presets = JSON.parse(localStorage.getItem('diary_style_presets') || '[]');
        const select = document.getElementById('diary-style-preset');
        
        select.innerHTML = '<option value="">选择预设</option>';
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = preset.name;
            select.appendChild(option);
        });
    },

    /**
     * 保存文风预设
     */
    saveStylePreset: function() {
        const name = document.getElementById('diary-style-preset-name').value.trim();
        if (!name) {
            alert('请输入预设名称');
            return;
        }

        const customStyle = document.getElementById('diary-custom-style').value;

        const presets = JSON.parse(localStorage.getItem('diary_style_presets') || '[]');
        
        // 检查是否已存在
        const existingIndex = presets.findIndex(p => p.name === name);
        const preset = {
            name: name,
            customStyle: customStyle
        };

        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }

        localStorage.setItem('diary_style_presets', JSON.stringify(presets));
        this.loadStylePresets();
        alert('文风预设已保存');
    },

    /**
     * 删除文风预设
     */
    deleteStylePreset: function() {
        const select = document.getElementById('diary-style-preset');
        const name = select.value;
        
        if (!name) {
            alert('请先选择要删除的预设');
            return;
        }

        if (!confirm(`确定要删除预设"${name}"吗？`)) {
            return;
        }

        const presets = JSON.parse(localStorage.getItem('diary_style_presets') || '[]');
        const filtered = presets.filter(p => p.name !== name);
        localStorage.setItem('diary_style_presets', JSON.stringify(filtered));
        
        this.loadStylePresets();
        alert('预设已删除');
    },

    /**
     * 获取设置
     */
    getSettings: function() {
        try {
            return JSON.parse(localStorage.getItem(`diary_settings_${this.currentCharId}`) || '{}');
        } catch (error) {
            return {};
        }
    },

    /**
     * 应用设置
     */
    applySettings: function(settings) {
        const diaryText = document.getElementById('diary-text');
        
        if (settings.fontUrl) {
            const fontUrl = settings.fontUrl.trim();
            
            // 移除之前的自定义字体样式
            const oldStyle = document.getElementById('diary-custom-font-style');
            if (oldStyle) oldStyle.remove();
            
            // 判断字体类型
            const lowerUrl = fontUrl.toLowerCase();
            const isCssFile = lowerUrl.endsWith('.css');
            
            if (isCssFile) {
                // CSS文件：通过link标签加载
                const link = document.createElement('link');
                link.id = 'diary-custom-font-style';
                link.rel = 'stylesheet';
                link.href = fontUrl;
                document.head.appendChild(link);
                // CSS文件中通常定义了font-family，需要用户在URL中指定字体名
                // 尝试从URL中提取字体名，或使用通用名
                diaryText.style.setProperty('font-family', 'CustomDiaryFont, serif', 'important');
            } else {
                // ttf/woff2/其他字体文件：通过@font-face加载
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
                style.id = 'diary-custom-font-style';
                style.textContent = `
                    @font-face {
                        font-family: 'CustomDiaryFont';
                        src: url('${fontUrl}') ${format};
                        font-display: swap;
                    }
                `;
                document.head.appendChild(style);
                diaryText.style.setProperty('font-family', "'CustomDiaryFont', serif", 'important');
            }
        } else if (settings.fontPreset) {
            diaryText.style.setProperty('font-family', settings.fontPreset, 'important');
        } else {
            diaryText.style.removeProperty('font-family');
        }
        
        if (settings.fontSize) {
            diaryText.style.fontSize = settings.fontSize + 'px';
        }
        
        if (settings.fontColor) {
            diaryText.style.color = settings.fontColor;
        }
    },

    /**
     * 清除背景图
     */
    clearBackground: function() {
        const diaryContent = document.getElementById('diary-content');
        diaryContent.style.backgroundImage = '';
        localStorage.removeItem(`diary_bg_${this.currentCharId}`);
        alert('背景图已清除');
    },

    /**
     * 启动定时检查
     */
    startScheduleCheck: function() {
        // 每分钟检查一次
        this.scheduleCheckInterval = setInterval(() => {
            this.checkSchedule();
        }, 60000);
        
        // 立即检查一次
        this.checkSchedule();
    },

    /**
     * 检查是否需要定时写日记
     */
    checkSchedule: function() {
        const settings = this.getSettings();
        
        if (!settings.scheduleEnabled || !settings.scheduleTime) {
            return;
        }
        
        const now = new Date();
        const [hours, minutes] = settings.scheduleTime.split(':');
        const scheduleTime = new Date();
        scheduleTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // 检查是否在设定时间的1分钟内
        const diff = Math.abs(now - scheduleTime);
        if (diff < 60000) {
            // 检查今天是否已经生成过日记
            const date = new Date().toISOString().split('T')[0];
            const diaries = this.loadDiaries();
            
            if (!diaries[date]) {
                // 自动生成日记
                this.autoGenerateDiary();
            }
        }
    },

    /**
     * 自动生成日记
     */
    autoGenerateDiary: async function() {
        try {
            await this.generateDiary();
            
            // 可以添加通知
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('日记已生成', {
                    body: '今天的日记已自动生成完成',
                    icon: 'icon.png'
                });
            }
        } catch (error) {
            console.error('自动生成日记失败:', error);
        }
    }
};

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DiaryApp.init());
} else {
    DiaryApp.init();
}
