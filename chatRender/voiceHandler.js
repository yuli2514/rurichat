/**
 * chatRender/voiceHandler.js
 * 聊天渲染模块 - 语音处理器
 * 
 * 包含：
 * - 语音面板显示/隐藏
 * - 真实录音（MediaRecorder + webkitSpeechRecognition）
 * - 伪造语音（文字输入生成语音气泡）
 * - 语音消息气泡构建与播放
 */

const VoiceHandler = {
    // 状态变量
    mediaRecorder: null,
    audioChunks: [],
    recognition: null,
    recognizedText: '',
    isRecording: false,
    recordingStartTime: 0,
    recordingTimer: null,
    currentAudioBlob: null,

    /**
     * 检测是否为移动端
     */
    _isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * 打开语音面板
     */
    openVoicePanel: function() {
        // 确保聊天界面存在
        const chatInterface = document.getElementById('super-chat-interface');
        if (!chatInterface) {
            console.error('[VoiceHandler] 聊天界面不存在');
            return;
        }
        
        let panel = document.getElementById('voice-panel');
        if (!panel) {
            this.createVoicePanel();
            panel = document.getElementById('voice-panel');
        }
        
        if (panel) {
            panel.classList.remove('hidden');
            // 重置状态
            this.resetState();
        } else {
            console.error('[VoiceHandler] 语音面板创建失败');
        }
    },

    /**
     * 关闭语音面板
     */
    closeVoicePanel: function() {
        const panel = document.getElementById('voice-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
        this.stopRecording();
        this.resetState();
    },

    /**
     * 重置状态
     */
    resetState: function() {
        this.audioChunks = [];
        this.recognizedText = '';
        this._interimTranscript = '';
        this.isRecording = false;
        this.currentAudioBlob = null;
        this._shouldRestart = false;
        this._recognitionEnded = false;
        this._pendingDuration = 0;
        this._lastRecognitionError = '';
        // 注意：不在这里释放 _playbackObjectURL，因为它可能还在被使用
        // objectURL 会在页面关闭时自动释放
        if (this._sendTimer) {
            clearTimeout(this._sendTimer);
            this._sendTimer = null;
        }
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        const fakeInput = document.getElementById('voice-fake-input');
        if (fakeInput) fakeInput.value = '';
        const recordingTime = document.getElementById('voice-recording-time');
        if (recordingTime) recordingTime.textContent = '0:00';
        const recordBtn = document.getElementById('voice-record-btn');
        if (recordBtn) {
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="fa-solid fa-microphone text-2xl"></i>';
        }
    },

    /**
     * 创建语音面板DOM
     */
    createVoicePanel: function() {
        console.log('[VoiceHandler] 创建语音面板');
        
        const panel = document.createElement('div');
        panel.id = 'voice-panel';
        panel.className = 'hidden absolute inset-0 bg-black/50 flex items-center justify-center z-[100]';
        panel.innerHTML = `
            <div class="bg-white rounded-2xl p-5 w-[85%] max-w-[320px] shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg text-gray-800">语音消息</h3>
                    <button onclick="VoiceHandler.closeVoicePanel()" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                
                <!-- 伪造语音输入区 -->
                <div class="mb-4">
                    <label class="text-xs text-gray-500 mb-1 block">伪造语音（输入文字）</label>
                    <div class="flex gap-2">
                        <input type="text" id="voice-fake-input"
                            class="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="输入文字生成语音气泡...">
                        <button onclick="VoiceHandler.sendFakeVoice()"
                            class="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95 transition">
                            发送
                        </button>
                    </div>
                </div>
                
                <div class="border-t border-gray-200 my-4"></div>
                
                <!-- 真实录音区 -->
                <div class="text-center">
                    <label class="text-xs text-gray-500 mb-3 block">真实录音（长按录音）</label>
                    <div id="voice-recording-time" class="text-2xl font-mono text-gray-700 mb-3">0:00</div>
                    <div id="voice-record-btn"
                        class="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center text-white cursor-pointer active:scale-95 transition select-none">
                        <i class="fa-solid fa-microphone text-2xl"></i>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">长按说话，松开发送</p>
                </div>
            </div>
        `;
        
        // 点击背景关闭面板
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.closeVoicePanel();
            }
        });
        
        // 添加到聊天界面
        const chatInterface = document.getElementById('super-chat-interface');
        if (chatInterface) {
            chatInterface.appendChild(panel);
            console.log('[VoiceHandler] 语音面板已添加到DOM');
            
            // 绑定录音按钮事件（使用addEventListener而不是内联事件，更可靠）
            const recordBtn = panel.querySelector('#voice-record-btn');
            if (recordBtn) {
                recordBtn.addEventListener('touchstart', (e) => this.startRecording(e), { passive: false });
                recordBtn.addEventListener('touchend', (e) => this.stopRecording(e), { passive: false });
                recordBtn.addEventListener('mousedown', (e) => this.startRecording(e));
                recordBtn.addEventListener('mouseup', (e) => this.stopRecording(e));
                recordBtn.addEventListener('mouseleave', (e) => this.stopRecording(e));
                console.log('[VoiceHandler] 录音按钮事件已绑定');
            }
        } else {
            console.error('[VoiceHandler] 找不到聊天界面容器');
        }
    },

    /**
     * 开始录音
     */
    startRecording: async function(event) {
        if (event) event.preventDefault();
        if (this.isRecording) return;
        
        const isMobile = this._isMobile();
        
        try {
            // 电脑端：保持原样；移动端：约束采样率和声道
            let stream;
            if (isMobile) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            
            // 移动端：检测浏览器支持的音频 MIME 类型
            if (isMobile) {
                let mimeType = '';
                const preferredTypes = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/ogg;codecs=opus',
                    'audio/ogg',
                    'audio/mp4',
                    'audio/aac',
                    'audio/wav'
                ];
                for (const type of preferredTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        mimeType = type;
                        break;
                    }
                }
                console.log('[VoiceHandler] 移动端使用音频格式:', mimeType || '浏览器默认');
                const recorderOptions = {};
                if (mimeType) recorderOptions.mimeType = mimeType;
                this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
                this._recordingMimeType = mimeType || 'audio/webm';
            } else {
                // 电脑端：保持原样
                this.mediaRecorder = new MediaRecorder(stream);
                this._recordingMimeType = 'audio/webm';
            }
            
            this.audioChunks = [];
            this.recognizedText = '';
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            // 更新UI
            const recordBtn = document.getElementById('voice-record-btn');
            if (recordBtn) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fa-solid fa-stop text-2xl"></i>';
                recordBtn.style.backgroundColor = '#ef4444';
            }
            
            // 开始计时
            this.recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                const timeEl = document.getElementById('voice-recording-time');
                if (timeEl) {
                    timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 100);
            
            // 收集音频数据
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.currentAudioBlob = new Blob(this.audioChunks, { type: this._recordingMimeType });
                // 移动端：立刻生成 objectURL 用于回放，确保原声清晰
                if (isMobile && this.currentAudioBlob) {
                    this._playbackObjectURL = URL.createObjectURL(this.currentAudioBlob);
                    console.log('[VoiceHandler] 移动端回放URL已生成:', this._playbackObjectURL);
                }
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            
            // 启动语音识别：移动端彻底关闭前端识别，改由后端处理
            if (!isMobile) {
                this.startSpeechRecognition();
            } else {
                console.log('[VoiceHandler] 移动端：跳过前端语音识别，将由后端处理');
            }
            
            // 震动反馈
            if (navigator.vibrate) navigator.vibrate(50);
            
        } catch (err) {
            console.error('录音启动失败:', err);
            alert('无法访问麦克风，请检查权限设置');
            this.resetState();
        }
    },

    /**
     * 停止录音
     */
    stopRecording: function(event) {
        if (event) event.preventDefault();
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        // 停止计时
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        // 计算录音时长
        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        
        // 停止录音
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        // 更新UI
        const recordBtn = document.getElementById('voice-record-btn');
        if (recordBtn) {
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="fa-solid fa-microphone text-2xl"></i>';
            recordBtn.style.backgroundColor = '#22c55e';
        }
        
        // 如果录音时间太短，不发送
        if (duration < 1) {
            if (this.recognition) {
                try { this.recognition.abort(); } catch(e) {}
            }
            this.resetState();
            return;
        }
        
        if (this._isMobile()) {
            // ===== 移动端：不使用前端识别，直接发送，后端异步处理语音转文字 =====
            this._pendingDuration = duration;
            
            // 移动端不再有 recognition，直接等待音频数据准备好后发送
            setTimeout(() => {
                this.sendRealVoice(duration);
            }, 500);
        } else {
            // ===== 电脑端：保持原样，停止识别后固定延迟发送 =====
            if (this.recognition) {
                this.recognition.stop();
            }
            
            // 延迟发送，等待音频数据和识别结果
            setTimeout(() => {
                this.sendRealVoice(duration);
            }, 800);
        }
    },

    /**
     * 启动语音识别
     */
    startSpeechRecognition: function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[VoiceHandler] 浏览器不支持语音识别');
            return;
        }
        
        const isMobile = this._isMobile();
        
        this.recognition = new SpeechRecognition();
        this.recognition.interimResults = true;
        this.recognition.lang = 'zh-CN';
        
        if (isMobile) {
            // 移动端：非连续模式（更稳定），识别完手动重启
            this.recognition.continuous = false;
            if ('maxAlternatives' in this.recognition) {
                this.recognition.maxAlternatives = 1;
            }
        } else {
            // 电脑端：保持原样，连续模式
            this.recognition.continuous = true;
        }
        
        // 用于保存中间识别结果作为fallback
        this._interimTranscript = '';
        this._recognitionEnded = false;
        this._lastRecognitionError = '';
        this._shouldRestart = isMobile; // 只有移动端需要自动重启
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            if (finalTranscript) {
                this.recognizedText += finalTranscript;
                this._interimTranscript = ''; // 有最终结果时清空中间结果
                console.log('[VoiceHandler] 识别到最终文本:', finalTranscript, '累计:', this.recognizedText);
            } else if (interimTranscript) {
                // 保存最新的中间识别结果作为fallback
                this._interimTranscript = interimTranscript;
                console.log('[VoiceHandler] 中间识别结果:', interimTranscript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.warn('[VoiceHandler] 语音识别错误:', event.error);
            this._lastRecognitionError = event.error;
            if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'not-allowed') {
                this._shouldRestart = false;
            }
        };
        
        this.recognition.onend = () => {
            console.log('[VoiceHandler] 语音识别 onend, isRecording:', this.isRecording, 'isMobile:', isMobile);
            this._recognitionEnded = true;
            
            if (isMobile) {
                if (this.isRecording && this._shouldRestart) {
                    // 移动端非连续模式：识别自动结束但用户还在录音，手动重启
                    try {
                        this.recognition.start();
                        console.log('[VoiceHandler] 移动端语音识别已重启');
                    } catch(e) {
                        console.warn('[VoiceHandler] 移动端语音识别重启失败:', e);
                    }
                } else if (!this.isRecording && this._sendTimer) {
                    // 用户已松手，识别已结束，立即发送（取消超时等待）
                    clearTimeout(this._sendTimer);
                    this._sendTimer = null;
                    setTimeout(() => {
                        this.sendRealVoice(this._pendingDuration);
                    }, 300);
                }
            }
            // 电脑端 onend 不需要特殊处理，靠 stopRecording 的 setTimeout 发送
        };
        
        try {
            this.recognition.start();
            console.log('[VoiceHandler] 语音识别已启动, 模式:', isMobile ? '移动端(非连续)' : '电脑端(连续)');
        } catch(e) {
            console.error('[VoiceHandler] 语音识别启动失败:', e);
        }
    },

    /**
     * 发送真实语音消息
     */
    sendRealVoice: function(duration) {
        if (!ChatInterface.currentCharId) return;
        
        const isMobile = this._isMobile();
        
        // 在关闭面板之前保存识别文本和音频数据，因为closeVoicePanel会调用resetState清空recognizedText
        // 优先使用最终识别结果，如果没有则使用中间识别结果作为fallback
        const savedText = this.recognizedText || this._interimTranscript || '';
        const savedAudioBlob = this.currentAudioBlob;
        const savedPlaybackURL = this._playbackObjectURL || null;
        const lastError = this._lastRecognitionError || '';
        
        console.log('[VoiceHandler] 发送真实语音, 识别文本:', savedText, '移动端:', isMobile, '回放URL:', savedPlaybackURL);
        
        // 电脑端：ASR 失败时给出明确提示（移动端不使用前端ASR，不提示）
        if (!isMobile && !savedText) {
            let errorMsg = '语音转文字失败';
            if (lastError === 'not-allowed') {
                errorMsg = '麦克风语音识别权限被拒绝，请在浏览器设置中允许语音识别权限（注意：语音识别权限和麦克风权限是分开的）';
            } else if (lastError === 'no-speech') {
                errorMsg = '未检测到语音输入，请靠近麦克风说话';
            } else if (lastError === 'network') {
                errorMsg = '语音识别需要网络连接（浏览器会将音频发送到云端识别），请检查网络';
            } else if (lastError === 'service-not-available') {
                errorMsg = '语音识别服务不可用，当前浏览器可能不支持语音识别功能';
            } else if (lastError) {
                errorMsg = '语音识别失败: ' + lastError;
            } else {
                errorMsg = '语音转文字失败，浏览器未返回识别结果。请确认：\n1. 使用 Chrome 浏览器\n2. 网络连接正常\n3. 已授予语音识别权限';
            }
            console.error('[VoiceHandler]', errorMsg);
            alert(errorMsg);
        }
        
        // 先关闭面板
        this.closeVoicePanel();
        
        if (isMobile && savedAudioBlob) {
            // ===== 移动端：原生录制 + 直传 API 方案 =====
            // 1. 将原始 Blob 转为 base64，用于回放和 AI 直传
            // 2. 不使用 objectURL（blob: URL 在页面刷新后失效，导致退出后无法播放）
            // 3. 绝不使用 OfflineAudioContext 转码！绝不调用 Whisper API！
            
            const mimeType = this._recordingMimeType || 'audio/webm';
            
            // 将原始 Blob 转为 base64，保留原始格式
            const reader = new FileReader();
            reader.onloadend = () => {
                const originalBase64 = reader.result; // data:audio/webm;base64,...
                console.log('[VoiceHandler] 移动端原始音频 base64 已生成, MIME:', mimeType, '大小:', savedAudioBlob.size);
                
                // 回放和 AI 都使用 base64（持久化，退出后仍可播放）
                this.createAndSendVoiceMessage(duration, originalBase64, originalBase64, '[语音消息]', false, null, mimeType);
            };
            reader.onerror = () => {
                console.error('[VoiceHandler] 移动端音频 base64 转换失败');
                // 降级：只有回放，没有 AI 音频数据
                this.createAndSendVoiceMessage(duration, playbackURL, null, '[语音消息]', false);
            };
            reader.readAsDataURL(savedAudioBlob);
        } else if (savedAudioBlob) {
            // ===== 电脑端：保持原有逻辑 =====
            // 先将原始 Blob 转为 base64 用于回放
            const reader = new FileReader();
            reader.onloadend = () => {
                const originalBase64 = reader.result;
                
                // 同时用 OfflineAudioContext 重采样为 16kHz WAV 供 AI 使用
                this._resampleToWAV16k(savedAudioBlob).then(wavBase64 => {
                    console.log('[VoiceHandler] 16kHz WAV 转码成功');
                    this.createAndSendVoiceMessage(duration, originalBase64, wavBase64, savedText || '[语音消息]', false);
                }).catch(err => {
                    console.warn('[VoiceHandler] 16kHz 转码失败，AI 将使用原始音频:', err);
                    this.createAndSendVoiceMessage(duration, originalBase64, originalBase64, savedText || '[语音消息]', false);
                });
            };
            reader.readAsDataURL(savedAudioBlob);
        } else {
            this.createAndSendVoiceMessage(duration, null, null, savedText || '[语音消息]', false);
        }
    },

    /**
     * 后端语音转文字 API
     * 将 16kHz WAV base64 发送给后端进行语音识别
     * @param {string} wavBase64 - WAV 格式的 base64 data URL
     * @returns {Promise<string>} 识别出的文字
     */
    _backendSpeechToText: async function(wavBase64) {
        const config = API.Settings.getApiConfig();
        if (!config.endpoint || !config.key) {
            throw new Error('请先在设置中配置 API');
        }
        
        // 使用 OpenAI 兼容的 Whisper API 进行语音转文字
        // 将 base64 转为 Blob 再发送
        const base64Data = wavBase64.split(',')[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const wavBlob = new Blob([bytes], { type: 'audio/wav' });
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        formData.append('model', 'whisper-1');
        formData.append('language', 'zh');
        
        const response = await fetch(config.endpoint + '/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + config.key
            },
            body: formData
        });
        
        if (!response.ok) {
            // 如果 Whisper API 不可用，回退到使用 LLM 描述
            console.warn('[VoiceHandler] Whisper API 不可用 (HTTP ' + response.status + ')，回退到 LLM 方案');
            return await this._llmSpeechToText(wavBase64);
        }
        
        const data = await response.json();
        return data.text || '';
    },

    /**
     * 使用 LLM 进行语音转文字的回退方案
     * 当 Whisper API 不可用时，将音频 base64 发送给 LLM 请求转写
     * @param {string} wavBase64 - WAV 格式的 base64 data URL
     * @returns {Promise<string>} 识别出的文字
     */
    _llmSpeechToText: async function(wavBase64) {
        const config = API.Settings.getApiConfig();
        
        try {
            const response = await fetch(config.endpoint + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.key
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个语音转文字助手。用户会发送一段音频，请将音频中的语音内容转写为文字。只输出转写的文字内容，不要添加任何解释或格式。如果无法识别，请输出"[无法识别]"。'
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: '请将这段音频转写为文字：' },
                                { type: 'input_audio', input_audio: { data: wavBase64.split(',')[1], format: 'wav' } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    safety_settings: API.Settings.getSafetySettings()
                })
            });
            
            if (!response.ok) {
                console.warn('[VoiceHandler] LLM 语音转文字也失败');
                return '';
            }
            
            const data = await response.json();
            const text = data.choices[0].message.content || '';
            return text.replace(/^\[|]$/g, '').trim();
        } catch (e) {
            console.error('[VoiceHandler] LLM 语音转文字异常:', e);
            return '';
        }
    },

    /**
     * 更新已发送的语音消息的识别文字
     * @param {number} msgId - 消息ID
     * @param {string} text - 识别出的文字
     */
    _updateVoiceMessageText: function(msgId, text) {
        if (!ChatInterface.currentCharId) return;
        
        const history = API.Chat.getHistory(ChatInterface.currentCharId);
        const msgIndex = history.findIndex(m => m.id === msgId);
        if (msgIndex !== -1) {
            history[msgIndex].content = text;
            if (history[msgIndex].voiceData) {
                history[msgIndex].voiceData.transcription = text;
            }
            API.Chat.saveHistory(ChatInterface.currentCharId, history);
            ChatInterface.renderMessages();
            console.log('[VoiceHandler] 语音消息文字已更新:', text);
        }
    },

    /**
     * 使用 OfflineAudioContext 将音频重采样为 16000Hz 单声道 16-bit PCM WAV
     * 只用于发送给 AI 的数据，不影响本地回放
     * @param {Blob} blob - 原始录音 Blob
     * @returns {Promise<string>} WAV 格式的 base64 data URL
     */
    _resampleToWAV16k: async function(blob) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const targetSampleRate = 16000;
            const offlineCtx = new OfflineAudioContext(
                1, // 单声道
                Math.ceil(audioBuffer.duration * targetSampleRate),
                targetSampleRate
            );
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineCtx.destination);
            source.start(0);
            
            const resampledBuffer = await offlineCtx.startRendering();
            const pcmData = resampledBuffer.getChannelData(0);
            
            // 编码为 16-bit PCM WAV
            const wavBuffer = new ArrayBuffer(44 + pcmData.length * 2);
            const view = new DataView(wavBuffer);
            const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
            
            writeStr(0, 'RIFF');
            view.setUint32(4, 36 + pcmData.length * 2, true);
            writeStr(8, 'WAVE');
            writeStr(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, targetSampleRate, true);
            view.setUint32(28, targetSampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeStr(36, 'data');
            view.setUint32(40, pcmData.length * 2, true);
            
            for (let i = 0; i < pcmData.length; i++) {
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
            
            const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
            console.log('[VoiceHandler] 音频已重采样为 16kHz WAV, 大小:', wavBlob.size, 'bytes');
            
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(wavBlob);
            });
        } finally {
            audioContext.close();
        }
    },

    /**
     * 发送伪造语音消息
     */
    sendFakeVoice: function() {
        const input = document.getElementById('voice-fake-input');
        const text = input ? input.value.trim() : '';
        if (!text) {
            alert('请输入文字内容');
            return;
        }
        if (!ChatInterface.currentCharId) return;
        
        // 根据字数计算伪造时长（约每秒3-4个字）
        const duration = Math.max(1, Math.ceil(text.length / 3.5));
        
        this.createAndSendVoiceMessage(duration, null, null, text, true);
        this.closeVoicePanel();
    },

    /**
     * 创建并发送语音消息
     * @param {number} duration - 语音时长
     * @param {string|null} audioData - 原始音频 base64 或 objectURL（用于本地回放）
     * @param {string|null} audioDataForAI - 音频 base64（用于发送给 AI，移动端为原始格式，电脑端为 16kHz WAV）
     * @param {string} text - 识别文本
     * @param {boolean} isFake - 是否伪造
     * @param {number} [customMsgId] - 自定义消息ID（移动端用于后续更新）
     * @param {string} [audioMimeType] - 音频 MIME 类型（如 audio/webm, audio/mp4），移动端直传用
     */
    createAndSendVoiceMessage: function(duration, audioData, audioDataForAI, text, isFake, customMsgId, audioMimeType) {
        const msg = {
            id: customMsgId || Date.now(),
            sender: 'user',
            content: text,
            type: 'voice',
            timestamp: Date.now(),
            voiceData: {
                duration: duration,
                audioBase64: audioData,
                audioBase64ForAI: audioDataForAI,
                audioMimeType: audioMimeType || null,
                isFake: isFake,
                transcription: text
            }
        };
        
        API.Chat.addMessage(ChatInterface.currentCharId, msg);
        ChatInterface.renderMessages();
        
        if (typeof ChatManager !== 'undefined' && ChatManager.renderList) {
            ChatManager.renderList();
        }
    },

    /**
     * 播放语音消息
     */
    playVoice: function(msgIndex) {
        const history = API.Chat.getHistory(ChatInterface.currentCharId);
        const msg = history[msgIndex];
        if (!msg || msg.type !== 'voice') return;
        
        const voiceData = msg.voiceData;
        if (!voiceData) return;
        
        // 切换文字展开/折叠
        const textEl = document.getElementById(`voice-text-${msgIndex}`);
        if (textEl) {
            textEl.classList.toggle('hidden');
        }
        
        // 如果有真实音频，播放它
        if (voiceData.audioBase64 && !voiceData.isFake) {
            // 支持 objectURL（blob:开头）和 base64（data:开头）两种格式
            const audioSrc = voiceData.audioBase64;
            console.log('[VoiceHandler] 播放AI语音:', audioSrc);
            
            const audio = new Audio(audioSrc);
            
            // 移动端兼容性处理
            const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                console.log('[VoiceHandler] 检测到移动端，使用兼容模式播放');
                // 移动端需要设置一些属性
                audio.preload = 'auto';
                audio.controls = false;
            }
            
            audio.play().catch(err => {
                console.error('音频播放失败:', err);
                console.error('错误详情:', {
                    name: err.name,
                    message: err.message,
                    audioSrc: audioSrc.substring(0, 50) + '...',
                    isMobile: isMobile,
                    userAgent: navigator.userAgent
                });
                
                // objectURL 可能已过期，尝试提示用户
                if (audioSrc.startsWith('blob:')) {
                    console.warn('[VoiceHandler] objectURL 可能已过期，无法回放');
                }
                
                // 移动端特殊处理
                if (isMobile) {
                    console.warn('[VoiceHandler] 移动端音频播放失败，可能需要用户手动交互');
                }
            });
        } else {
            console.log('[VoiceHandler] 无法播放语音 - audioBase64:', voiceData.audioBase64, 'isFake:', voiceData.isFake);
        }
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceHandler;
}
